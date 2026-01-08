'use client'

import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import DashboardNav from '@/components/DashboardNav'
import {
    BookOpen, CreditCard, HelpCircle, Stethoscope, MessageSquare,
    Loader2, CheckCircle, XCircle, ChevronLeft, ChevronRight,
    Eye, EyeOff, Play, RotateCcw
} from 'lucide-react'

// Lazy load the D3 Knowledge Graph for better performance
const KnowledgeGraph = lazy(() => import('@/components/KnowledgeGraph'))

let mermaidInstance: any = null

const loadMermaid = async () => {
    if (typeof window === 'undefined') return null
    
    // Return cached instance if already loaded
    if (mermaidInstance) return mermaidInstance
    
    try {
	        const m = await import('mermaid')
	        const mermaid = m.default || m
	        if (mermaid && typeof mermaid.initialize === 'function') {
	            const config: any = {
	                startOnLoad: false,
	                suppressErrorRendering: true, // Don't render error messages in the DOM
	                securityLevel: 'strict',
	                theme: 'base',
	                themeVariables: {
	                    fontFamily: 'Montserrat, sans-serif',
	                    primaryColor: '#3DD6D0',
	                    primaryTextColor: '#1A1F71',
	                    primaryBorderColor: '#344895',
	                    lineColor: '#344895',
	                    secondaryColor: '#EAF7F7',
	                    tertiaryColor: '#F4F6FB',
	                },
	            }
	            mermaid.initialize(config)
	            mermaidInstance = mermaid
	        }
	        return mermaid
	    } catch (e) {
        console.error('Failed to load mermaid:', e)
        return null
    }
}

const repairMermaidCode = (code: string): string => {
    if (!code) return ''
    
    let fixed = code.replace(/\r\n?/g, '\n').trim()
    // Replace unicode spaces
    fixed = fixed.replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ')

    const headerLine = fixed
        .split('\n')
        .map(l => l.trim())
        .find(l => l.length > 0 && !l.startsWith('%%'))

    if (headerLine && !/^(flowchart|graph|mindmap|stateDiagram(?:-v2)?)(\s|$)/.test(headerLine)) {
        fixed = `flowchart TD\n${fixed}`
    }

    // Helper to sanitize labels
    const sanitizeLabel = (label: string): string => {
        return label
            .replace(/\u202f/g, ' ')
            .replace(/\u00a0/g, ' ')
            .replace(/\(/g, ' - ')
            .replace(/\)/g, '')
            .replace(/\[/g, '')
            .replace(/\]/g, '')
            .replace(/\{/g, '')
            .replace(/\}/g, '')
            .replace(/</g, '')
            .replace(/>/g, '')
            .replace(/"/g, "'")
            .replace(/`/g, "'")
            .replace(/#/g, 'No.')
            .replace(/&/g, 'and')
            .replace(/;/g, ',')
            .replace(/:/g, ' -')
            .replace(/\s{2,}/g, ' ')
            .replace(/\s*-\s*-\s*/g, ' - ')
            .replace(/\s*-\s*/g, ' - ')
            .trim()
            .replace(/^-+|-+$/g, '')
            .trim()
    }

    fixed = fixed
        .split('\n')
        .map(line => line.replace(/^\s*(?:[-*]\s+|\d+\.\s+)/, '').replace(/→/g, '-->'))
        .join('\n')

    fixed = fixed.replace(/([A-Za-z0-9_]+\[[^\]\n]*?)\|\s*([A-Za-z0-9_]+\[)/g, '$1] --> $2')
    fixed = fixed.replace(/\[([^\]\n]*?)\|([^\]\n]*?)\]/g, '[$1/$2]')

    // Sanitize edge labels between pipes
    fixed = fixed.replace(/\|([^|\n]+)\|/g, (_, label) => {
        const cleaned = sanitizeLabel(label)
        return cleaned ? `|${cleaned}|` : ''
    })

    // Sanitize node labels in square brackets
    fixed = fixed.replace(/\[([^\]\n]*)\]/g, (_, label) => {
        return `[${sanitizeLabel(label).replace(/\|/g, '/')}]`
    })

    // Sanitize diamond nodes in curly braces (but skip directives)
    fixed = fixed
        .split('\n')
        .map(line => {
            if (line.trim().startsWith('%%{')) return line
            return line.replace(/\{([^}\n]*)\}/g, (_, label) => {
                return `{${sanitizeLabel(label).replace(/\|/g, '/')}}`
            })
        })
        .join('\n')

    return fixed
}

interface Artifact {
    id: string
    lecture_id: string
    artifact_type: string
    status: string
    content: any
    error_message?: string
}

export default function ArtifactsPage() {
    const router = useRouter()
    const params = useParams()
    const lectureId = params.lectureId as string
    const { user, loading: authLoading } = useAuth()
    const { toast } = useToast()

    const [lectureTitle, setLectureTitle] = useState('')
    const [artifacts, setArtifacts] = useState<Artifact[]>([])
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [generating, setGenerating] = useState(false)
    const [activeTab, setActiveTab] = useState('overview')
    const [mermaidSvg, setMermaidSvg] = useState<string | null>(null)
    const [mermaidLoading, setMermaidLoading] = useState(false)
    const [mermaidError, setMermaidError] = useState<string | null>(null)
    const [retryingArtifact, setRetryingArtifact] = useState<string | null>(null)
    
    // Practiced simulations tracking
    const [practicedScenarios, setPracticedScenarios] = useState<string[]>([])
    const [simulationHistory, setSimulationHistory] = useState<Record<string, { practicedAt: string; sessionId: string }>>({})
    
    // Handle tab query parameter (for returning from practice)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search)
            const tab = urlParams.get('tab')
            if (tab && ['overview', 'flashcards', 'quiz', 'clinical_case', 'simulation', 'concept_map'].includes(tab)) {
                setActiveTab(tab)
                // Clean up the URL
                window.history.replaceState({}, '', `/artifacts/${lectureId}`)
            }
        }
    }, [lectureId])
    
    // Load practiced scenarios from localStorage
    useEffect(() => {
        if (lectureId && typeof window !== 'undefined') {
            const practiceKey = `practiced_simulations_${lectureId}`
            const practiced = JSON.parse(localStorage.getItem(practiceKey) || '[]')
            setPracticedScenarios(practiced)
            
            const historyKey = `simulation_history_${lectureId}`
            const history = JSON.parse(localStorage.getItem(historyKey) || '{}')
            setSimulationHistory(history)
        }
    }, [lectureId])

    // Flashcard state
    const [currentCardIndex, setCurrentCardIndex] = useState(0)
    const [showAnswer, setShowAnswer] = useState(false)

    // Quiz state
    const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({})
    const [quizResult, setQuizResult] = useState<any>(null)
    const [submittingQuiz, setSubmittingQuiz] = useState(false)
    const [reviewMode, setReviewMode] = useState(false)
    const [quizHistory, setQuizHistory] = useState<any[]>([])
    const [regeneratingQuiz, setRegeneratingQuiz] = useState(false)

    // Fetch quiz history from API
    const fetchQuizHistory = async () => {
        try {
            const token = apiClient.getToken()
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const res = await fetch(`${apiUrl}/api/v1/artifacts/lecture/${lectureId}/quiz/history`, {
                headers: { 'Authorization': `Bearer ${token}` },
            })
            if (res.ok) {
                const data = await res.json()
                setQuizHistory(data.entries || [])
            }
        } catch (e) {
            console.error('Failed to fetch quiz history:', e)
        }
    }

    // Load quiz history from API when lectureId changes
    useEffect(() => {
        if (lectureId && user) {
            fetchQuizHistory()
        }
    }, [lectureId, user])

    // Clinical case state
    const [caseRevealed, setCaseRevealed] = useState<boolean[]>([])
    const [currentCaseIndex, setCurrentCaseIndex] = useState(0)

	    // Simulation state
	    const [currentSimIndex, setCurrentSimIndex] = useState(0)
	    const [isStartingSimulation, setIsStartingSimulation] = useState(false)

	    const fetchArtifacts = useCallback(async () => {
	        try {
	            setFetchError(null)
            const token = apiClient.getToken()
            if (!token) {
                router.push('/auth/login')
                return
            }
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(`${apiUrl}/api/v1/artifacts/lecture/${lectureId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            })
            if (response.status === 401 || response.status === 403) {
                router.push('/auth/login')
                return
            }
            if (!response.ok) {
                const detail = await response.text().catch(() => '')
                console.error('Failed to fetch artifacts:', response.status, detail)
                if (response.status === 404) {
                    setFetchError('Lecture not found. It may have been deleted or you may not have access.')
                } else {
                    setFetchError(`Failed to load this lecture (HTTP ${response.status}).`)
                }
                return
            }
            const data = await response.json()
            setLectureTitle(data.lecture_title)
            setArtifacts(data.artifacts)
        } catch (e) {
            console.error(e)
            setFetchError('Network error while loading this lecture.')
        } finally {
            setLoading(false)
        }
    }, [lectureId, router])

    // Poll for artifact generation status
    const pollStatus = useCallback(() => {
        const token = apiClient.getToken()
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        let attempts = 0
        const check = async () => {
            const res = await fetch(`${apiUrl}/api/v1/artifacts/lecture/${lectureId}/status`, {
                headers: { 'Authorization': `Bearer ${token}` },
            })
            const data = await res.json()
            if (data.in_progress === 0 || attempts++ > 60) { setGenerating(false); fetchArtifacts(); return }
            setTimeout(check, 3000)
        }
        setTimeout(check, 3000)
    }, [lectureId, fetchArtifacts])

    // Auto-generate artifacts (called automatically, not by user)
	    const generateArtifactsAuto = useCallback(async () => {
	        if (generating) return // Prevent double-trigger
	        setGenerating(true)
	        try {
            const token = apiClient.getToken()
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            await fetch(`${apiUrl}/api/v1/artifacts/generate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ lecture_id: lectureId }),
            })
            pollStatus()
	        } catch (e) { setGenerating(false) }
	    }, [lectureId, generating, pollStatus])

	    useEffect(() => {
	        if (!authLoading && !user) { router.push('/auth/login'); return }
	        if (lectureId && user) fetchArtifacts()
	    }, [lectureId, user, authLoading, router, fetchArtifacts])
	    
	    // Auto-generate if no artifacts exist
	    useEffect(() => {
	        if (!loading && artifacts.length === 0 && lectureTitle && !generating) {
	            generateArtifactsAuto()
	        }
	    }, [loading, artifacts.length, lectureTitle, generating, generateArtifactsAuto])

	    const submitQuiz = async () => {
	        // Check if all questions are answered
	        const totalAnswered = Object.keys(quizAnswers).length
	        if (totalAnswered < quizQuestions.length) {
            alert(`Please answer all ${quizQuestions.length} questions before submitting. You have answered ${totalAnswered}.`)
            return
        }

        setSubmittingQuiz(true)
        const token = apiClient.getToken()
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const res = await fetch(`${apiUrl}/api/v1/artifacts/lecture/${lectureId}/quiz/submit`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: quizAnswers }),
        })
        const result = await res.json()
        setQuizResult(result)

        // Refresh quiz history from API (backend already saved the result)
        await fetchQuizHistory()

        setSubmittingQuiz(false)
    }

    const regenerateQuiz = async () => {
        setRegeneratingQuiz(true)
        try {
            const token = apiClient.getToken()
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

            // Call regenerate endpoint to get fresh questions
            const res = await fetch(`${apiUrl}/api/v1/artifacts/lecture/${lectureId}/quiz/regenerate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            })

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }))
                console.error('Failed to regenerate quiz:', errorData)
                toast({
                    title: 'Failed to regenerate quiz',
                    description: errorData.detail || 'Please try again later.',
                    variant: 'destructive',
                })
                return
            }

            const result = await res.json()
            console.log('Quiz regenerated:', result)

            // Reset quiz state
            setQuizResult(null)
            setQuizAnswers({})
            setReviewMode(false)

            // Show success toast
            toast({
                title: '✨ New Quiz Generated!',
                description: result.message || `${result.questions_generated} fresh questions ready.`,
                variant: 'success',
            })

            // Reload artifacts to get new questions
            await fetchArtifacts()

        } catch (e) {
            console.error('Error regenerating quiz:', e)
            toast({
                title: 'Connection Error',
                description: 'Unable to connect to server. Please check your connection.',
                variant: 'destructive',
            })
        } finally {
            setRegeneratingQuiz(false)
        }
    }

	    // Generate More state
	    const [generatingMore, setGeneratingMore] = useState<string | null>(null)

    // Helper to get artifact display name (inline to avoid circular dependency)
    const getArtifactDisplayName = (t: string) => 
        ({ concept_map: 'Concept Map', flashcards: 'Flashcards', quiz: 'Quiz', clinical_case: 'Clinical Case', simulation: 'Simulation' }[t] || t)

    // Retry failed artifact generation
    const retryFailedArtifact = useCallback(async (artifactType: string) => {
        setRetryingArtifact(artifactType)
        
        const displayName = getArtifactDisplayName(artifactType)
        
        toast({
            title: `🔄 Retrying ${displayName}...`,
            description: 'Please wait while we regenerate this content.',
        })
        
        try {
            const token = apiClient.getToken()
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(
                `${apiUrl}/api/v1/artifacts/lecture/${lectureId}/retry-failed?artifact_type=${artifactType}`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                }
            )
            
            if (response.ok) {
                // Poll for completion
                const pollRetry = async () => {
                    await new Promise(resolve => setTimeout(resolve, 2000))
                    await fetchArtifacts()
                    
                    // Check if still generating
                    const updatedArtifacts = artifacts.find(a => a.artifact_type === artifactType)
                    if (updatedArtifacts?.status === 'generating') {
                        pollRetry()
                    } else if (updatedArtifacts?.status === 'completed') {
                        toast({
                            title: `✅ ${displayName} ready!`,
                            description: 'Successfully generated.',
                            variant: 'success',
                        })
                        setRetryingArtifact(null)
                    } else {
                        toast({
                            title: `❌ ${displayName} failed again`,
                            description: 'Try uploading the lecture again or contact support.',
                            variant: 'destructive',
                        })
                        setRetryingArtifact(null)
                    }
                }
                pollRetry()
            } else {
                throw new Error('Retry request failed')
            }
        } catch (e) {
            console.error('Retry error:', e)
            toast({
                title: 'Retry failed',
                description: 'Please try again or re-upload the lecture.',
                variant: 'destructive',
            })
            setRetryingArtifact(null)
        }
    }, [lectureId, toast, fetchArtifacts, artifacts])

    const generateMore = useCallback(async (artifactType: string, count: number = 5) => {
        setGeneratingMore(artifactType)
        
        // Show "generating" toast
        const typeLabel = artifactType === 'flashcards' 
            ? `${count} flashcard${count > 1 ? 's' : ''}` 
            : artifactType === 'clinical_case' 
                ? 'clinical case' 
                : artifactType === 'simulation'
                    ? `${count} scenario${count > 1 ? 's' : ''}`
                    : `${count} ${artifactType}`
        
        toast({
            title: `✨ Generating ${typeLabel}...`,
            description: 'This may take a few moments.',
        })
        
        try {
            const token = apiClient.getToken()
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(
                `${apiUrl}/api/v1/artifacts/lecture/${lectureId}/generate-more?artifact_type=${artifactType}&count=${count}`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                }
            )
            if (response.ok) {
                // Refresh artifacts to get updated content
                await fetchArtifacts()
                
                // Show success toast
                const successLabel = artifactType === 'flashcards' 
                    ? `${count} new flashcard${count > 1 ? 's' : ''}`
                    : artifactType === 'clinical_case'
                        ? 'New clinical case'
                        : artifactType === 'simulation'
                            ? `${count} new scenario${count > 1 ? 's' : ''}`
                            : `${count} new ${artifactType}`
                
                toast({
                    title: `🎉 ${successLabel} ready!`,
                    description: artifactType === 'flashcards' 
                        ? 'Swipe through to study the new cards.'
                        : artifactType === 'clinical_case'
                            ? 'Your new case study is ready to explore.'
                            : artifactType === 'simulation'
                                ? 'New patient scenarios are ready to practice.'
                                : 'New content has been added.',
                })
            } else {
                console.error('Failed to generate more:', await response.text())
                toast({
                    title: 'Generation failed',
                    description: 'Something went wrong. Please try again.',
                    variant: 'destructive',
                })
            }
        } catch (e) {
            console.error('Generate more error:', e)
            toast({
                title: 'Generation failed',
                description: 'Network error. Please check your connection.',
                variant: 'destructive',
            })
        } finally {
            setGeneratingMore(null)
        }
    }, [lectureId, toast, fetchArtifacts])

    // Memoize artifact lookups for performance
    const getArtifact = useCallback((type: string) => 
        artifacts.find(a => a.artifact_type === type && a.status === 'completed'), 
        [artifacts]
    )
    
    const flashcards = useMemo(() => getArtifact('flashcards')?.content?.cards || [], [getArtifact])
    const quizQuestions = useMemo(() => getArtifact('quiz')?.content?.questions || [], [getArtifact])
    const conceptMap = useMemo(() => getArtifact('concept_map')?.content, [getArtifact])
    const mermaidCode = useMemo(() => typeof conceptMap?.mermaid === 'string' ? conceptMap.mermaid : null, [conceptMap])
    const hasMermaidMap = Boolean(mermaidCode)
    const hasLegacyMap = useMemo(() => Array.isArray(conceptMap?.nodes) && conceptMap.nodes.length > 0, [conceptMap])
    const showMermaidSpinner = hasMermaidMap && (mermaidLoading || (!mermaidSvg && !mermaidError))

    // Clinical case - handle both single case and array of cases
    const clinicalCaseContent = useMemo(() => getArtifact('clinical_case')?.content, [getArtifact])
    const clinicalCases = useMemo(() => {
        if (clinicalCaseContent?.cases) return clinicalCaseContent.cases
        if (clinicalCaseContent) return [clinicalCaseContent]
        return []
    }, [clinicalCaseContent])
    const currentCase = clinicalCases[currentCaseIndex] || null

    // Simulation data - handle both old single format and new multi-scenario format
    const simulationContent = useMemo(() => getArtifact('simulation')?.content, [getArtifact])
    const simulationScenarios = useMemo(() => {
        if (!simulationContent) return []
        // New format: has scenarios array
        if (simulationContent.scenarios && Array.isArray(simulationContent.scenarios)) {
            return simulationContent.scenarios
        }
        // Old format: single scenario object
        return [simulationContent]
    }, [simulationContent])
	    const lectureTopics = useMemo(() => simulationContent?.lecture_topics || [], [simulationContent])
	    const currentSimulation = simulationScenarios[currentSimIndex] || null

	    const startSimulation = useCallback(() => {
	        // Prevent double-clicks
	        if (isStartingSimulation) return
	        setIsStartingSimulation(true)
	        
	        // Use the currently selected scenario
	        if (currentSimulation) {
	            localStorage.setItem('lecture_simulation', JSON.stringify({
	                ...currentSimulation,
	                lecture_id: lectureId,
	                lecture_title: lectureTitle
	            }))
	            router.push('/training?mode=lecture_simulation')
	        } else {
	            setIsStartingSimulation(false)
	        }
	    }, [currentSimulation, lectureId, lectureTitle, router, isStartingSimulation])

	    const getIcon = useCallback((t: string) => {
	        const icons: Record<string, any> = { concept_map: BookOpen, flashcards: CreditCard, quiz: HelpCircle, clinical_case: Stethoscope, simulation: MessageSquare }
	        const Icon = icons[t] || BookOpen
        return <Icon className="w-6 h-6" />
    }, [])

    const getName = useCallback((t: string) => 
        ({ concept_map: 'Concept Map', flashcards: 'Flashcards', quiz: 'Quiz', clinical_case: 'Clinical Case', simulation: 'Simulation' }[t] || t)
    , [])

    useEffect(() => {
        if (!mermaidCode) {
            setMermaidSvg(null)
            setMermaidError(null)
            setMermaidLoading(false)
            return
        }

        let cancelled = false
        const renderMermaid = async () => {
            try {
                setMermaidLoading(true)
                setMermaidError(null)
                setMermaidSvg(null)
                const mermaid = await loadMermaid()
                if (!mermaid || cancelled) {
                    if (!cancelled) setMermaidError('Unable to load the diagram renderer.')
                    return
                }

                const render = async (code: string) => {
                    const renderId = `mermaid-${lectureId.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`
                    const { svg } = await mermaid.render(renderId, code)
                    return svg
                }

                try {
                    const svg = await render(mermaidCode)
                    if (!cancelled) setMermaidSvg(svg)
                } catch (e) {
                    const repaired = repairMermaidCode(mermaidCode)
                    if (repaired !== mermaidCode) {
                        const svg = await render(repaired)
                        if (!cancelled) setMermaidSvg(svg)
                    } else {
                        throw e
                    }
                }
            } catch (e) {
                if (!cancelled) {
                    console.error('Mermaid render failed:', e)
                    setMermaidError('Unable to render this concept map.')
                    setMermaidSvg(null)
                }
            } finally {
                if (!cancelled) {
                    setMermaidLoading(false)
                }
            }
        }

        renderMermaid()
        return () => {
            cancelled = true
        }
    }, [mermaidCode, lectureId])

    if (loading) return <div className="dashboard-page-container"><DashboardNav /><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-12 h-12 text-[#344895] animate-spin" /></div></div>

    if (fetchError) {
        return (
            <div className="dashboard-page-container">
                <DashboardNav />
                <div className="max-w-[1512px] mx-auto px-3 sm:px-4 lg:px-16 pb-8 pt-6">
                    <div className="bg-white border-2 border-red-200 rounded-2xl p-6 max-w-2xl mx-auto text-center">
                        <h1 className="font-montserrat font-bold text-[#344895] text-xl mb-2">Unable to load lecture</h1>
                        <p className="text-gray-600 mb-5">{fetchError}</p>
                        <button
                            onClick={() => router.push('/upload')}
                            className="bg-[#344895] text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-[#1A1F71] transition-colors"
                        >
                            Back to Library
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="dashboard-page-container">
            <DashboardNav />
            <div className="max-w-[1512px] mx-auto px-3 sm:px-4 lg:px-16 pb-8">
                {/* Header - responsive */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 pt-2">
                    <div>
                        <button onClick={() => router.push('/upload')} className="text-[#344895] hover:text-[#3DD6D0] mb-2 flex items-center gap-1 text-sm touch-manipulation min-h-[44px]">
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                        <h1 className="text-xl sm:text-2xl lg:text-4xl font-montserrat font-bold text-[#344895] leading-tight">{lectureTitle}</h1>
                    </div>
                    {generating && (
                        <div className="bg-[#344895]/10 text-[#344895] font-montserrat font-bold px-5 py-3 rounded-full flex items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Generating study materials...
                        </div>
                    )}
                </div>

                {/* Tabs - horizontal scrollable with fade indicators */}
                <div className="relative mb-6">
                    <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-gray-50 to-transparent z-10 pointer-events-none sm:hidden" />
                    <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-gray-50 to-transparent z-10 pointer-events-none sm:hidden" />
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
                        {['overview', 'flashcards', 'quiz', 'clinical_case', 'simulation', 'concept_map'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`
                                    px-4 py-2.5 sm:py-2 rounded-full font-montserrat font-bold text-sm whitespace-nowrap transition-all
                                    min-h-[44px] touch-manipulation flex-shrink-0
                                    ${activeTab === tab
                                        ? 'bg-[#344895] text-white shadow-md'
                                        : 'bg-white text-[#344895] border-2 border-[#344895]/20 hover:border-[#344895] active:bg-gray-50'
                                    }
                                `}
                            >
                                {getName(tab)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Overview */}
                {activeTab === 'overview' && (
                    <div className="space-y-4">
                        {/* Failed artifacts warning banner */}
                        {artifacts.some(a => a.status === 'failed') && (
                            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-start gap-3">
                                <div className="text-2xl">⚠️</div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-amber-800 mb-1">Some content failed to generate</h4>
                                    <p className="text-amber-700 text-sm mb-3">
                                        Click "Retry" on any failed item below. If it keeps failing, try re-uploading the lecture file.
                                    </p>
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            onClick={() => {
                                                artifacts
                                                    .filter(a => a.status === 'failed')
                                                    .forEach(a => retryFailedArtifact(a.artifact_type))
                                            }}
                                            disabled={retryingArtifact !== null}
                                            className="bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {retryingArtifact ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Retrying...
                                                </>
                                            ) : (
                                                <>
                                                    <RotateCcw className="w-4 h-4" />
                                                    Retry All Failed
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => router.push('/upload')}
                                            className="bg-white text-amber-700 text-sm font-semibold px-4 py-2 rounded-lg border border-amber-300 hover:bg-amber-50 transition-colors"
                                        >
                                            Re-upload Lecture
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {artifacts.length === 0 ? (
                            <div className="col-span-full bg-gradient-to-br from-[#344895]/5 to-[#3DD6D0]/5 rounded-2xl p-10 text-center border-2 border-[#3DD6D0]/30">
                                <Loader2 className="w-12 h-12 mx-auto mb-4 text-[#344895] animate-spin" />
                                <h3 className="font-montserrat font-bold text-[#344895] text-xl mb-2">Creating Your Study Materials</h3>
                                <p className="text-gray-600 max-w-md mx-auto">We're generating flashcards, quizzes, clinical cases, and more. This usually takes 30-60 seconds...</p>
                            </div>
                        ) : artifacts.map(a => (
                            <div 
                                key={a.id} 
                                onClick={() => a.status === 'completed' && setActiveTab(a.artifact_type)} 
                                className={`bg-white border-2 rounded-2xl p-6 transition-all ${
                                    a.status === 'completed' 
                                        ? 'border-[#3DD6D0]/30 hover:border-[#3DD6D0] cursor-pointer hover:shadow-lg' 
                                        : a.status === 'failed'
                                            ? 'border-red-200'
                                            : 'border-yellow-200'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="text-[#344895]">{getIcon(a.artifact_type)}</div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        a.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                        a.status === 'generating' ? 'bg-yellow-100 text-yellow-800' : 
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {a.status === 'completed' ? 'Ready' : a.status === 'generating' ? 'Generating...' : 'Failed'}
                                    </span>
                                </div>
                                <h3 className="font-montserrat font-bold text-[#344895] text-lg">{getName(a.artifact_type)}</h3>
                                
                                {/* Retry button for failed artifacts */}
                                {a.status === 'failed' && (
                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <p className="text-red-600 text-xs mb-3">
                                            {a.error_message || 'Generation failed. Click retry to try again.'}
                                        </p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                retryFailedArtifact(a.artifact_type)
                                            }}
                                            disabled={retryingArtifact === a.artifact_type}
                                            className="w-full bg-[#344895] text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-[#1A1F71] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {retryingArtifact === a.artifact_type ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Retrying...
                                                </>
                                            ) : (
                                                <>
                                                    <RotateCcw className="w-4 h-4" />
                                                    Retry Generation
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        </div>
                    </div>
                )}

                {/* Mind Map - Educational Visual Display */}
                {activeTab === 'concept_map' && conceptMap && (
                    <div className="space-y-6 max-w-4xl mx-auto">
                        {/* Header */}
                        <div className="text-center mb-8">
                            <h2 className="font-montserrat font-bold text-[#344895] text-2xl sm:text-3xl mb-2">
                                🧠 Knowledge Map
                            </h2>
                            <p className="text-gray-600 text-base">Master the key concepts and how they connect</p>
                        </div>

                        {hasMermaidMap ? (
                            <>
                                <div className="bg-white border-2 border-[#3DD6D0]/30 rounded-2xl p-4 sm:p-6 shadow-sm">
                                    {showMermaidSpinner && (
                                        <div className="flex items-center justify-center gap-2 py-10 text-[#344895]">
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span className="font-montserrat font-bold text-sm">Rendering your map...</span>
                                        </div>
                                    )}
                                    {mermaidError && (
                                        <div className="space-y-3">
                                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm font-medium">
                                                {mermaidError}
                                                            </div>
                                            {mermaidCode && (
                                                <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs whitespace-pre-wrap break-words">
                                                    {mermaidCode}
                                                </pre>
                                            )}
                                                        </div>
                                                    )}
                                    {!showMermaidSpinner && !mermaidError && mermaidSvg && (
                                        <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: mermaidSvg }} />
                                    )}
                                    {!showMermaidSpinner && !mermaidError && !mermaidSvg && (
                                        <div className="text-center text-gray-500 text-sm py-8">Map unavailable. Try regenerating.</div>
                                    )}
                                    </div>

                                <div className="bg-gradient-to-r from-[#3DD6D0]/10 to-[#344895]/10 rounded-2xl p-5 border border-[#3DD6D0]/30">
                                    <div className="flex items-start gap-4">
                                        <div className="text-3xl">📝</div>
                                        <div>
                                            <h4 className="font-bold text-[#344895] mb-1">Test Your Understanding</h4>
                                            <p className="text-gray-600 text-sm mb-3">
                                                Can you explain each step or branch without looking? Try recreating the map from memory.
                                            </p>
                                            <button
                                                onClick={() => setActiveTab('quiz')}
                                                className="bg-[#344895] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#1A1F71] transition-colors"
                                            >
                                                Take the Quiz →
                                            </button>
                                                        </div>
                                            </div>
                                        </div>
                            </>
                        ) : hasLegacyMap ? (
                            <>
                                {/* Interactive D3 Knowledge Graph */}
                                <Suspense fallback={
                                    <div className="flex items-center justify-center gap-2 py-20 text-[#344895]">
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span className="font-montserrat font-bold">Loading interactive graph...</span>
                                        </div>
                                }>
                                    <KnowledgeGraph 
                                        nodes={conceptMap.nodes || []} 
                                        edges={conceptMap.edges || []}
                                        title={lectureTitle}
                                    />
                                </Suspense>

                                    {/* Study Action */}
                                    <div className="bg-gradient-to-r from-[#3DD6D0]/10 to-[#344895]/10 rounded-2xl p-5 border border-[#3DD6D0]/30">
                                        <div className="flex items-start gap-4">
                                            <div className="text-3xl">📝</div>
                                            <div>
                                                <h4 className="font-bold text-[#344895] mb-1">Test Your Understanding</h4>
                                                <p className="text-gray-600 text-sm mb-3">
                                                    Can you explain how each branch connects to the main topic? Try closing this mind map and drawing it from memory!
                                                </p>
                                                <button
                                                    onClick={() => setActiveTab('quiz')}
                                                    className="bg-[#344895] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#1A1F71] transition-colors"
                                                >
                                                    Take the Quiz →
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-gray-500 text-sm">
                                Concept map is not available yet. Try regenerating or check back soon.
                            </div>
                        )}
                    </div>
                )}

                {/* Flashcards */}
                {activeTab === 'flashcards' && flashcards.length > 0 && (
                    <div className="max-w-2xl mx-auto px-2 sm:px-0">
                        {/* Card */}
                        <div
                            onClick={() => setShowAnswer(!showAnswer)}
                            className="bg-[#344895] border-2 border-[#3DD6D0] rounded-2xl sm:rounded-[33px] p-6 sm:p-10 lg:p-12 min-h-[280px] sm:min-h-[300px] flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all active:scale-[0.98] touch-manipulation"
                        >
                            {!showAnswer ? (
                                <>
                                    <p className="text-white/60 text-xs sm:text-sm mb-3 sm:mb-4 uppercase tracking-wider">Question</p>
                                    <p className="text-white font-montserrat font-bold text-lg sm:text-xl lg:text-2xl text-center leading-relaxed max-w-lg">
                                        {flashcards[currentCardIndex]?.question}
                                    </p>
                                    <p className="text-white/60 text-xs sm:text-sm mt-6 sm:mt-8 flex items-center gap-2">
                                        <Eye className="w-4 h-4" />
                                        <span className="hidden sm:inline">Click to reveal</span>
                                        <span className="sm:hidden">Tap to reveal</span>
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-[#3DD6D0] text-xs sm:text-sm mb-3 sm:mb-4 uppercase tracking-wider">Answer</p>
                                    <p className="text-white text-base sm:text-lg text-center leading-relaxed max-w-lg">
                                        {flashcards[currentCardIndex]?.answer}
                                    </p>
                                    <p className="text-white/60 text-xs sm:text-sm mt-6 sm:mt-8 flex items-center gap-2">
                                        <EyeOff className="w-4 h-4" />
                                        <span className="hidden sm:inline">Click to hide</span>
                                        <span className="sm:hidden">Tap to hide</span>
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-between mt-4 sm:mt-6 gap-3">
                            <button
                                onClick={() => { setCurrentCardIndex(Math.max(0, currentCardIndex - 1)); setShowAnswer(false) }}
                                disabled={currentCardIndex === 0}
                                className="bg-white text-[#344895] font-bold px-4 sm:px-5 py-3 rounded-full disabled:opacity-40 flex items-center gap-1 sm:gap-2 min-h-[48px] active:scale-95 transition-transform touch-manipulation text-sm sm:text-base"
                            >
                                <ChevronLeft className="w-5 h-5" />
                                <span className="hidden sm:inline">Previous</span>
                            </button>

                            <span className="text-[#344895] font-bold text-sm sm:text-base">
                                {currentCardIndex + 1} / {flashcards.length}
                            </span>

                            <button
                                onClick={() => { setCurrentCardIndex(Math.min(flashcards.length - 1, currentCardIndex + 1)); setShowAnswer(false) }}
                                disabled={currentCardIndex === flashcards.length - 1}
                                className="bg-white text-[#344895] font-bold px-4 sm:px-5 py-3 rounded-full disabled:opacity-40 flex items-center gap-1 sm:gap-2 min-h-[48px] active:scale-95 transition-transform touch-manipulation text-sm sm:text-base"
                            >
                                <span className="hidden sm:inline">Next</span>
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Generate More */}
                        <div className="mt-6 text-center">
                            <button
                                onClick={() => generateMore('flashcards', 5)}
                                disabled={generatingMore === 'flashcards'}
                                className="bg-[#3DD6D0]/10 hover:bg-[#3DD6D0]/20 text-[#344895] font-semibold px-6 py-3 rounded-full text-sm transition-all disabled:opacity-50 flex items-center gap-2 mx-auto min-h-[48px] active:scale-95"
                            >
                                {generatingMore === 'flashcards' ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                                ) : (
                                    <>+ Generate 5 More Cards</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Quiz */}
                {activeTab === 'quiz' && quizQuestions.length > 0 && (!quizResult || reviewMode) && (
                    <div className="max-w-3xl mx-auto space-y-6">
                        {/* Review mode header */}
                        {reviewMode && (
                            <div className="bg-[#344895] text-white rounded-2xl p-4 text-center">
                                <p className="font-bold">📚 Review Mode</p>
                                <p className="text-sm text-white/80">Green = Correct, Red = Your incorrect answer</p>
                            </div>
                        )}

                        {quizQuestions.map((q: any, i: number) => {
                            const feedback = reviewMode ? quizResult?.feedback?.find((f: any) => f.question_id === q.id) : null
                            const userAnswer = quizAnswers[q.id]

                            return (
                                <div key={q.id} className={`bg-white border-2 rounded-2xl p-6 ${reviewMode ? (feedback?.is_correct ? 'border-green-400' : 'border-red-400') : 'border-[#3DD6D0]/30'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[#344895]/60 text-sm">Question {i + 1}</p>
                                        {reviewMode && (
                                            <span className={`text-sm font-bold px-3 py-1 rounded-full ${feedback?.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {feedback?.is_correct ? '✓ Correct' : '✗ Incorrect'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="font-montserrat font-bold text-[#344895] text-lg mb-4">{q.question}</p>
                                    {q.options?.map((opt: string, j: number) => {
                                        const optLetter = opt.charAt(0)
                                        const isUserAnswer = userAnswer === optLetter
                                        const isCorrectAnswer = reviewMode && feedback?.correct_answer === optLetter
                                        const isWrongUserAnswer = reviewMode && isUserAnswer && !feedback?.is_correct

                                        let className = 'block p-3 rounded-xl mb-2 transition-all '
                                        if (reviewMode) {
                                            if (isCorrectAnswer) {
                                                className += 'bg-green-500 text-white font-bold'
                                            } else if (isWrongUserAnswer) {
                                                className += 'bg-red-400 text-white line-through'
                                            } else {
                                                className += 'bg-gray-50 text-gray-500'
                                            }
                                        } else {
                                            className += isUserAnswer ? 'bg-[#344895] text-white cursor-pointer' : 'bg-gray-50 hover:bg-gray-100 cursor-pointer'
                                        }

                                        return (
                                            <label key={j} className={className}>
                                                <input
                                                    type="radio"
                                                    name={q.id}
                                                    value={optLetter}
                                                    onChange={(e) => !reviewMode && setQuizAnswers({ ...quizAnswers, [q.id]: e.target.value })}
                                                    disabled={reviewMode}
                                                    className="hidden"
                                                />
                                                {opt}
                                            </label>
                                        )
                                    })}
                                    {reviewMode && feedback?.explanation && (
                                        <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                                            <p className="text-sm text-blue-800"><strong>💡 Explanation:</strong> {feedback.explanation}</p>
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {!reviewMode ? (
                            <button
                                onClick={submitQuiz}
                                disabled={submittingQuiz || Object.keys(quizAnswers).length < quizQuestions.length}
                                className={`w-full font-bold py-4 rounded-full disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px] ${
                                    Object.keys(quizAnswers).length === quizQuestions.length
                                        ? 'bg-gradient-to-r from-[#3DD6D0] to-[#2BB5AF] text-[#1A1F71]'
                                        : 'bg-gray-200 text-gray-600'
                                }`}
                            >
                                {submittingQuiz ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" />Submitting...</>
                                ) : Object.keys(quizAnswers).length < quizQuestions.length ? (
                                    `Answer all questions (${Object.keys(quizAnswers).length}/${quizQuestions.length})`
                                ) : (
                                    `Submit Quiz ✓`
                                )}
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <button
                                    onClick={regenerateQuiz}
                                    disabled={regeneratingQuiz}
                                    className="w-full bg-gradient-to-r from-[#344895] to-[#1A1F71] text-white font-bold py-4 rounded-full min-h-[48px] disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {regeneratingQuiz ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" />Generating New Questions...</>
                                    ) : (
                                        <>🔄 Start Fresh Quiz</>
                                    )}
                                </button>
                                <p className="text-xs text-gray-500 text-center">
                                    New questions will focus on concepts you got wrong
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'quiz' && quizResult && !reviewMode && (
                    <div className="max-w-xl mx-auto bg-white border-2 border-[#3DD6D0] rounded-2xl p-6 sm:p-8 text-center">
                        {quizResult.passed ? <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" /> : <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />}
                        <h2 className="font-montserrat font-bold text-xl sm:text-2xl text-[#344895]">
                            {quizResult.passed ? '🎉 Great Job!' : '💪 Keep Going!'}
                        </h2>
                        <p className="text-gray-600 mt-2 text-lg">
                            {quizResult.score} / {quizResult.total} ({Math.round(quizResult.percentage)}%)
                        </p>

                        {/* Action buttons */}
                        <div className="mt-6 space-y-3">
                            <button
                                onClick={() => setReviewMode(true)}
                                className="w-full bg-[#344895] text-white font-bold py-3 px-8 rounded-full min-h-[48px] active:scale-95 transition-transform"
                            >
                                📖 Review Answers
                            </button>

                            {/* Start new quiz */}
                            <div className="pt-4 border-t">
                                <p className="text-gray-500 text-sm mb-3">
                                    {quizResult.passed 
                                        ? "Ready for more practice? Get fresh questions."
                                        : "New quiz will focus on concepts you missed."}
                                </p>
                                <button
                                    onClick={regenerateQuiz}
                                    disabled={regeneratingQuiz}
                                    className={`w-full font-bold py-3 px-8 rounded-full min-h-[48px] transition-all flex items-center justify-center gap-2 ${regeneratingQuiz
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-[#3DD6D0] to-[#2BB5AF] text-[#1A1F71] active:scale-95'
                                        }`}
                                >
                                    {regeneratingQuiz ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" />Generating New Questions...</>
                                    ) : (
                                        <>🔄 {quizResult.passed ? 'Start New Quiz' : 'Practice Weak Areas'}</>
                                    )}
                                </button>
                            </div>

                            {/* Quiz History */}
                            {quizHistory.length > 1 && (
                                <div className="pt-4 border-t">
                                    <p className="text-gray-500 text-sm mb-2">📊 Your Quiz History</p>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {quizHistory.slice(-5).map((h, i) => (
                                            <div
                                                key={i}
                                                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium ${h.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                                            >
                                                {Math.round(h.percentage)}%
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Avg: {Math.round(quizHistory.reduce((a: number, b: any) => a + b.percentage, 0) / quizHistory.length)}% over {quizHistory.length} attempts
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Clinical Case */}
                {activeTab === 'clinical_case' && currentCase && (
                    <div className="max-w-3xl mx-auto bg-white border-2 border-[#3DD6D0] rounded-2xl p-6 sm:p-8">
                        {/* Case navigation header */}
                        {clinicalCases.length > 1 && (
                            <div className="flex items-center justify-between mb-4 pb-4 border-b">
                                <button
                                    onClick={() => { setCurrentCaseIndex(Math.max(0, currentCaseIndex - 1)); setCaseRevealed([]) }}
                                    disabled={currentCaseIndex === 0}
                                    className="bg-gray-100 text-[#344895] px-4 py-2 rounded-full text-sm disabled:opacity-40 flex items-center gap-1 min-h-[44px]"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Previous
                                </button>
                                <span className="text-[#344895] font-bold text-sm">
                                    Case {currentCaseIndex + 1} of {clinicalCases.length}
                                </span>
                                <button
                                    onClick={() => { setCurrentCaseIndex(Math.min(clinicalCases.length - 1, currentCaseIndex + 1)); setCaseRevealed([]) }}
                                    disabled={currentCaseIndex === clinicalCases.length - 1}
                                    className="bg-gray-100 text-[#344895] px-4 py-2 rounded-full text-sm disabled:opacity-40 flex items-center gap-1 min-h-[44px]"
                                >
                                    Next <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        <h2 className="font-montserrat font-bold text-[#344895] text-xl sm:text-2xl mb-2">{currentCase.title}</h2>

                        {/* SOAP Format Display */}
                        {currentCase.soap ? (
                            <div className="space-y-4 mt-6">
                                {/* SUBJECTIVE Section */}
                                <div className="bg-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
                                    <h3 className="font-bold text-blue-800 text-lg mb-3 flex items-center gap-2">
                                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">S</span>
                                        Subjective
                                    </h3>
                                    <div className="space-y-2 text-gray-700">
                                        <p><strong>Chief Complaint:</strong> &quot;{currentCase.soap.subjective?.chief_complaint}&quot;</p>
                                        <p><strong>HPI:</strong> {currentCase.soap.subjective?.history_of_present_illness}</p>
                                        {currentCase.soap.subjective?.past_medical_history?.length > 0 && (
                                            <p><strong>PMH:</strong> {currentCase.soap.subjective.past_medical_history.join(', ')}</p>
                                        )}
                                        {currentCase.soap.subjective?.medications?.length > 0 && (
                                            <p><strong>Medications:</strong> {currentCase.soap.subjective.medications.join(', ')}</p>
                                        )}
                                        {currentCase.soap.subjective?.allergies?.length > 0 && (
                                            <p><strong>Allergies:</strong> {currentCase.soap.subjective.allergies.join(', ')}</p>
                                        )}
                                        {currentCase.soap.subjective?.social_history && (
                                            <p><strong>Social Hx:</strong> {currentCase.soap.subjective.social_history}</p>
                                        )}
                                    </div>
                                </div>

                                {/* OBJECTIVE Section */}
                                <div className="bg-green-50 rounded-xl p-4 border-l-4 border-green-500">
                                    <h3 className="font-bold text-green-800 text-lg mb-3 flex items-center gap-2">
                                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">O</span>
                                        Objective
                                    </h3>
                                    <div className="space-y-2 text-gray-700">
                                        {currentCase.soap.objective?.vitals && (
                                            <div className="flex flex-wrap gap-3 text-sm">
                                                <span className="bg-white px-2 py-1 rounded border">BP: {currentCase.soap.objective.vitals.bp}</span>
                                                <span className="bg-white px-2 py-1 rounded border">HR: {currentCase.soap.objective.vitals.hr}</span>
                                                <span className="bg-white px-2 py-1 rounded border">Temp: {currentCase.soap.objective.vitals.temp}</span>
                                                <span className="bg-white px-2 py-1 rounded border">RR: {currentCase.soap.objective.vitals.rr}</span>
                                                <span className="bg-white px-2 py-1 rounded border">O2: {currentCase.soap.objective.vitals.o2_sat}</span>
                                            </div>
                                        )}
                                        {currentCase.soap.objective?.physical_exam?.length > 0 && (
                                            <div><strong>Physical Exam:</strong>
                                                <ul className="list-disc pl-5 mt-1">{currentCase.soap.objective.physical_exam.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul>
                                            </div>
                                        )}
                                        {currentCase.soap.objective?.labs?.length > 0 && (
                                            <div><strong>Labs:</strong>
                                                <ul className="list-disc pl-5 mt-1">{currentCase.soap.objective.labs.map((l: string, i: number) => <li key={i}>{l}</li>)}</ul>
                                            </div>
                                        )}
                                        {currentCase.soap.objective?.imaging && (
                                            <p><strong>Imaging:</strong> {currentCase.soap.objective.imaging}</p>
                                        )}
                                    </div>
                                </div>

                                {/* ASSESSMENT Section - Hidden until revealed */}
                                <div className="border-t pt-4">
                                    <h3 className="font-bold text-[#344895] mb-4">What&apos;s your assessment?</h3>
                                    {caseRevealed.length === 0 ? (
                                        <button
                                            onClick={() => setCaseRevealed([true])}
                                            className="bg-[#344895] text-white px-6 py-3 rounded-full text-sm min-h-[48px] font-bold"
                                        >
                                            Reveal Assessment & Plan
                                        </button>
                                    ) : (
                                        <>
                                            <div className="bg-amber-50 rounded-xl p-4 border-l-4 border-amber-500 mb-4">
                                                <h3 className="font-bold text-amber-800 text-lg mb-3 flex items-center gap-2">
                                                    <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded">A</span>
                                                    Assessment
                                                </h3>
                                                <div className="space-y-2 text-gray-700">
                                                    <p><strong className="text-green-700">Primary Diagnosis:</strong> {currentCase.soap.assessment?.primary_diagnosis}</p>
                                                    {currentCase.soap.assessment?.differential_diagnoses?.length > 0 && (
                                                        <p><strong>Differential:</strong> {currentCase.soap.assessment.differential_diagnoses.join(', ')}</p>
                                                    )}
                                                    {currentCase.soap.assessment?.clinical_reasoning && (
                                                        <p><strong>Clinical Reasoning:</strong> {currentCase.soap.assessment.clinical_reasoning}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* PLAN Section */}
                                            <div className="bg-purple-50 rounded-xl p-4 border-l-4 border-purple-500">
                                                <h3 className="font-bold text-purple-800 text-lg mb-3 flex items-center gap-2">
                                                    <span className="bg-purple-500 text-white text-xs px-2 py-1 rounded">P</span>
                                                    Plan
                                                </h3>
                                                <div className="space-y-2 text-gray-700">
                                                    {currentCase.soap.plan?.medications?.length > 0 && (
                                                        <div><strong>Medications:</strong>
                                                            <ul className="list-disc pl-5 mt-1">{currentCase.soap.plan.medications.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>
                                                        </div>
                                                    )}
                                                    {currentCase.soap.plan?.non_pharmacological?.length > 0 && (
                                                        <div><strong>Non-Pharmacological:</strong>
                                                            <ul className="list-disc pl-5 mt-1">{currentCase.soap.plan.non_pharmacological.map((n: string, i: number) => <li key={i}>{n}</li>)}</ul>
                                                        </div>
                                                    )}
                                                    {currentCase.soap.plan?.monitoring && (
                                                        <p><strong>Monitoring:</strong> {currentCase.soap.plan.monitoring}</p>
                                                    )}
                                                    {currentCase.soap.plan?.follow_up && (
                                                        <p><strong>Follow-up:</strong> {currentCase.soap.plan.follow_up}</p>
                                                    )}
                                                    {currentCase.soap.plan?.patient_education?.length > 0 && (
                                                        <div><strong>Patient Education:</strong>
                                                            <ul className="list-disc pl-5 mt-1">{currentCase.soap.plan.patient_education.map((e: string, i: number) => <li key={i}>{e}</li>)}</ul>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Learning Points */}
                                            {currentCase.learning_points?.length > 0 && (
                                                <div className="mt-4 bg-gray-100 rounded-xl p-4">
                                                    <strong className="text-[#344895]">📚 Key Learning Points:</strong>
                                                    <ul className="list-disc pl-5 mt-2 text-gray-700">
                                                        {currentCase.learning_points.map((p: string, i: number) => <li key={i}>{p}</li>)}
                                                    </ul>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Legacy format display (backward compatibility) */
                            <div className="space-y-6 mt-6">
                                <div><h3 className="font-bold text-[#344895] mb-2">Patient Presentation</h3><p className="text-gray-700">{currentCase.patient_presentation}</p></div>
                                <div><h3 className="font-bold text-[#344895] mb-2">History</h3><p className="text-gray-700">{currentCase.history}</p></div>
                                <div><h3 className="font-bold text-[#344895] mb-2">Key Findings</h3><ul className="list-disc pl-5 text-gray-700">{currentCase.key_findings?.map((f: string, i: number) => <li key={i}>{f}</li>)}</ul></div>

                                <div className="border-t pt-6">
                                    <h3 className="font-bold text-[#344895] mb-4">What&apos;s your differential diagnosis?</h3>
                                    <button onClick={() => setCaseRevealed([...caseRevealed, true])} className="bg-[#344895] text-white px-4 py-2 rounded-full text-sm min-h-[44px]">Reveal Answer</button>
                                    {caseRevealed.length > 0 && (
                                        <div className="mt-4 bg-[#3DD6D0]/10 p-4 rounded-xl">
                                            <p className="font-bold text-[#344895]">Differential: {currentCase.differential_diagnosis?.join(', ')}</p>
                                            <p className="font-bold text-green-600 mt-2">Correct Diagnosis: {currentCase.correct_diagnosis}</p>
                                            <p className="text-gray-700 mt-2"><strong>Treatment:</strong> {currentCase.treatment_plan}</p>
                                            <div className="mt-4"><strong className="text-[#344895]">Learning Points:</strong><ul className="list-disc pl-5 mt-2">{currentCase.learning_points?.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Generate More */}
                        <div className="mt-6 pt-6 border-t text-center">
                            <button
                                onClick={() => generateMore('clinical_case', 1)}
                                disabled={generatingMore === 'clinical_case'}
                                className="bg-[#344895] hover:bg-[#1A1F71] text-white font-semibold px-6 py-3 rounded-full text-sm transition-all disabled:opacity-50 flex items-center gap-2 mx-auto min-h-[48px] active:scale-95"
                            >
                                {generatingMore === 'clinical_case' ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" />Generating...</>
                                ) : (
                                    <>+ Generate Another Case</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Simulation */}
                {activeTab === 'simulation' && simulationScenarios.length > 0 && (
                    <div className="space-y-6 max-w-4xl mx-auto">
                        {/* Header */}
                        <div className="text-center mb-6">
                            <h2 className="font-montserrat font-bold text-[#344895] text-2xl sm:text-3xl mb-2">
                                🎭 Patient Simulations
                            </h2>
                            <p className="text-gray-600 text-base">Practice your communication skills with diverse patient scenarios</p>
                            {lectureTopics.length > 0 && (
                                <div className="flex flex-wrap gap-2 justify-center mt-3">
                                    {lectureTopics.map((topic: string, i: number) => (
                                        <span key={i} className="px-3 py-1 bg-[#3DD6D0]/10 text-[#344895] text-xs font-medium rounded-full">
                                            {topic}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Scenario Selector - Horizontal Pills */}
                        {simulationScenarios.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {simulationScenarios.map((sim: any, i: number) => (
                                    <button
                                        key={sim.scenario_id || i}
                                        onClick={() => setCurrentSimIndex(i)}
                                        className={`flex-shrink-0 px-4 py-2.5 rounded-full font-montserrat font-bold text-sm transition-all min-h-[44px] ${
                                            currentSimIndex === i
                                                ? 'bg-[#344895] text-white shadow-md'
                                                : practicedScenarios.includes(sim.scenario_id)
                                                    ? 'bg-green-50 text-green-700 border-2 border-green-300 hover:border-green-500'
                                                    : 'bg-white text-[#344895] border-2 border-[#344895]/20 hover:border-[#344895]'
                                        }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            {practicedScenarios.includes(sim.scenario_id) ? (
                                                <CheckCircle className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <span className={`w-2 h-2 rounded-full ${
                                                    sim.difficulty === 'beginner' ? 'bg-green-400' :
                                                    sim.difficulty === 'intermediate' ? 'bg-yellow-400' : 'bg-red-400'
                                                }`} />
                                            )}
                                            Case {i + 1}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Current Scenario Card - Voice-First, Minimal Text */}
                        {currentSimulation && (
                            <div className={`bg-gradient-to-br from-[#344895] to-[#1A1F71] border-2 ${
                                practicedScenarios.includes(currentSimulation.scenario_id) 
                                    ? 'border-green-400' 
                                    : 'border-[#3DD6D0]'
                            } rounded-2xl overflow-hidden shadow-xl`}>
                                <div className="p-8 sm:p-12 flex flex-col items-center text-center">
                                    {/* Practiced Badge */}
                                    {practicedScenarios.includes(currentSimulation.scenario_id) && (
                                        <div className="bg-green-400/20 text-green-300 px-4 py-2 rounded-full text-sm font-bold mb-4 flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4" />
                                            Practiced {simulationHistory[currentSimulation.scenario_id]?.practicedAt && 
                                                `• ${new Date(simulationHistory[currentSimulation.scenario_id].practicedAt).toLocaleDateString()}`
                                            }
                                        </div>
                                    )}
                                    
                                    {/* Difficulty Badge */}
                                    {currentSimulation.difficulty && (
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase mb-6 ${
                                            currentSimulation.difficulty === 'beginner' ? 'bg-green-400/20 text-green-300' :
                                            currentSimulation.difficulty === 'intermediate' ? 'bg-yellow-400/20 text-yellow-300' : 'bg-red-400/20 text-red-300'
                                        }`}>
                                            {currentSimulation.difficulty}
                                        </span>
                                    )}

                                    {/* Large Patient Avatar with Pulse Animation */}
                                    <div className="relative mb-8">
                                        {!practicedScenarios.includes(currentSimulation.scenario_id) && (
                                            <div className="absolute inset-0 bg-[#3DD6D0]/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                                        )}
                                        <div className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center shadow-2xl ${
                                            practicedScenarios.includes(currentSimulation.scenario_id)
                                                ? 'bg-gradient-to-br from-green-400 to-green-500'
                                                : 'bg-gradient-to-br from-[#3DD6D0] to-[#2BB5AF]'
                                        }`}>
                                            <span className="text-6xl sm:text-7xl">
                                                {currentSimulation.patient_persona?.gender === 'male' ? '👨' : 
                                                 currentSimulation.patient_persona?.gender === 'female' ? '👩' : '🧑'}
                                            </span>
                                        </div>
                                        {/* Voice indicator */}
                                        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                                            practicedScenarios.includes(currentSimulation.scenario_id)
                                                ? 'bg-green-400 text-green-900'
                                                : 'bg-[#3DD6D0] text-[#1A1F71]'
                                        }`}>
                                            {practicedScenarios.includes(currentSimulation.scenario_id) ? (
                                                <>
                                                    <CheckCircle className="w-3 h-3" />
                                                    Completed
                                                </>
                                            ) : (
                                                <>
                                                    <span className="w-2 h-2 bg-[#1A1F71] rounded-full animate-pulse" />
                                                    Voice Patient
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Simple Title */}
                                    <h3 className="text-white font-montserrat font-bold text-xl sm:text-2xl mb-2">
                                        {currentSimulation.title}
                                    </h3>
                                    
                                    {/* Topic Focus */}
                                    {currentSimulation.topic_focus && (
                                        <p className="text-[#3DD6D0] text-sm mb-8">
                                            Topic: {currentSimulation.topic_focus}
                                        </p>
                                    )}

                                    {/* Voice Waveform Animation - only show if not practiced */}
                                    {!practicedScenarios.includes(currentSimulation.scenario_id) && (
                                        <div className="flex items-center justify-center gap-1 mb-8 h-12">
                                            {[20, 35, 15, 40, 25, 30, 18, 38, 22, 32, 28, 24].map((height, i) => (
                                                <div 
                                                    key={i}
                                                    className="w-1 bg-[#3DD6D0]/60 rounded-full animate-pulse"
                                                    style={{ 
                                                        height: `${height}px`,
                                                        animationDelay: `${i * 0.1}s`,
                                                        animationDuration: '1s'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {/* Instruction */}
                                    <p className="text-white/60 text-sm mb-8 max-w-md">
                                        {practicedScenarios.includes(currentSimulation.scenario_id)
                                            ? 'You\'ve practiced this scenario. Want to try again or pick a different one?'
                                            : 'Click below to start a voice conversation with this patient. Listen to their concerns and respond naturally.'
                                        }
                                    </p>

                                    {/* Large Start Button */}
                                    <button 
                                        onClick={startSimulation}
                                        disabled={isStartingSimulation}
                                        className={`w-full max-w-sm font-montserrat font-bold px-8 py-5 rounded-full flex items-center justify-center gap-3 hover:shadow-2xl transition-all hover:scale-105 group text-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                                            practicedScenarios.includes(currentSimulation.scenario_id)
                                                ? 'bg-gradient-to-r from-[#344895] to-[#1A1F71] text-white'
                                                : 'bg-gradient-to-r from-[#3DD6D0] to-[#2BB5AF] text-[#1A1F71]'
                                        }`}
                                    >
                                        {isStartingSimulation ? (
                                            <>
                                                <Loader2 className="w-6 h-6 animate-spin" /> 
                                                Loading...
                                            </>
                                        ) : practicedScenarios.includes(currentSimulation.scenario_id) ? (
                                            <>
                                                <RotateCcw className="w-6 h-6 group-hover:scale-110 transition-transform" /> 
                                                Practice Again
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-6 h-6 group-hover:scale-110 transition-transform" /> 
                                                Start Conversation
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Progress & Navigation */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-xl border border-gray-200 p-4">
                            <div className="flex items-center gap-4">
                                {/* Navigation */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentSimIndex(Math.max(0, currentSimIndex - 1))}
                                        disabled={currentSimIndex === 0}
                                        className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-[#344895]" />
                                    </button>
                                    <span className="text-sm text-gray-600 font-medium px-3">
                                        Scenario {currentSimIndex + 1} of {simulationScenarios.length}
                                    </span>
                                    <button
                                        onClick={() => setCurrentSimIndex(Math.min(simulationScenarios.length - 1, currentSimIndex + 1))}
                                        disabled={currentSimIndex === simulationScenarios.length - 1}
                                        className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5 text-[#344895]" />
                                    </button>
                                </div>
                                
                                {/* Practice Progress */}
                                {simulationScenarios.length > 0 && (
                                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                                        <CheckCircle className={`w-4 h-4 ${
                                            practicedScenarios.filter(id => simulationScenarios.some((s: any) => s.scenario_id === id)).length === simulationScenarios.length
                                                ? 'text-green-500'
                                                : 'text-gray-400'
                                        }`} />
                                        <span className="text-xs font-medium text-gray-600">
                                            {practicedScenarios.filter(id => simulationScenarios.some((s: any) => s.scenario_id === id)).length}/{simulationScenarios.length} practiced
                                        </span>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => generateMore('simulation', 2)}
                                disabled={generatingMore === 'simulation'}
                                className="flex items-center gap-2 px-4 py-2 bg-[#344895] text-white font-medium rounded-lg hover:bg-[#1A1F71] transition-colors disabled:opacity-50"
                            >
                                {generatingMore === 'simulation' ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                                ) : (
                                    <>✨ Generate More Scenarios</>
                                )}
                            </button>
                        </div>

                        {/* Tips Card */}
                        <div className="bg-gradient-to-r from-[#3DD6D0]/10 to-[#344895]/10 rounded-xl p-5 border border-[#3DD6D0]/30">
                            <h4 className="font-bold text-[#344895] mb-2 flex items-center gap-2">
                                💡 Practice Tips
                            </h4>
                            <ul className="text-gray-600 text-sm space-y-1">
                                <li>• Start with <span className="text-green-600 font-medium">beginner</span> cases and progress to <span className="text-red-600 font-medium">advanced</span></li>
                                <li>• Each scenario tests different aspects of the lecture material</li>
                                <li>• Pay attention to patient personality - adapt your communication style</li>
                                <li>• Look for red flags and address patient concerns empathetically</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* Empty states */}
                {activeTab !== 'overview' && !getArtifact(activeTab) && (
                    <div className="bg-white rounded-2xl p-8 text-center border-2 border-dashed border-[#3DD6D0]/30">
                        {getIcon(activeTab)}
                        <p className="text-gray-600 mt-4">{getName(activeTab)} not ready. Generate artifacts first.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
