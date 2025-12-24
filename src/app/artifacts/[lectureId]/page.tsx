'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import DashboardNav from '@/components/DashboardNav'
import {
    BookOpen, CreditCard, HelpCircle, Stethoscope, MessageSquare,
    Loader2, CheckCircle, XCircle, ChevronLeft, ChevronRight,
    Eye, EyeOff, Play
} from 'lucide-react'

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

    const [lectureTitle, setLectureTitle] = useState('')
    const [artifacts, setArtifacts] = useState<Artifact[]>([])
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [activeTab, setActiveTab] = useState('overview')

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

    useEffect(() => {
        if (!authLoading && !user) { router.push('/auth/login'); return }
        if (lectureId && user) fetchArtifacts()
    }, [lectureId, user, authLoading])

    const fetchArtifacts = async () => {
        try {
            const token = apiClient.getToken()
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(`${apiUrl}/api/v1/artifacts/lecture/${lectureId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            })
            if (!response.ok) throw new Error('Failed to fetch')
            const data = await response.json()
            setLectureTitle(data.lecture_title)
            setArtifacts(data.artifacts)

            // Auto-generate if no artifacts exist
            if (data.artifacts.length === 0) {
                generateArtifactsAuto()
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    // Auto-generate artifacts (called automatically, not by user)
    const generateArtifactsAuto = async () => {
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
    }

    const pollStatus = () => {
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
    }

    const submitQuiz = async () => {
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
                console.error('Failed to regenerate quiz')
                return
            }

            const result = await res.json()
            console.log('Quiz regenerated:', result)

            // Reset quiz state
            setQuizResult(null)
            setQuizAnswers({})
            setReviewMode(false)

            // Reload artifacts to get new questions
            await fetchArtifacts()

        } catch (e) {
            console.error('Error regenerating quiz:', e)
        } finally {
            setRegeneratingQuiz(false)
        }
    }

    const startSimulation = () => {
        const sim = artifacts.find(a => a.artifact_type === 'simulation' && a.status === 'completed')
        if (sim?.content) {
            localStorage.setItem('lecture_simulation', JSON.stringify({
                ...sim.content,
                lecture_id: lectureId,
                lecture_title: lectureTitle
            }))
            router.push('/training?mode=lecture_simulation')
        }
    }

    // Generate More state
    const [generatingMore, setGeneratingMore] = useState<string | null>(null)

    const generateMore = async (artifactType: string, count: number = 5) => {
        setGeneratingMore(artifactType)
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
            } else {
                console.error('Failed to generate more:', await response.text())
            }
        } catch (e) {
            console.error('Generate more error:', e)
        } finally {
            setGeneratingMore(null)
        }
    }

    const getArtifact = (type: string) => artifacts.find(a => a.artifact_type === type && a.status === 'completed')
    const flashcards = getArtifact('flashcards')?.content?.cards || []
    const quizQuestions = getArtifact('quiz')?.content?.questions || []
    const conceptMap = getArtifact('concept_map')?.content

    // Clinical case - handle both single case and array of cases
    const clinicalCaseContent = getArtifact('clinical_case')?.content
    const clinicalCases = clinicalCaseContent?.cases
        ? clinicalCaseContent.cases
        : clinicalCaseContent
            ? [clinicalCaseContent]
            : []
    const currentCase = clinicalCases[currentCaseIndex] || null

    const simulation = getArtifact('simulation')?.content

    const getIcon = (t: string) => {
        const icons: Record<string, any> = { concept_map: BookOpen, flashcards: CreditCard, quiz: HelpCircle, clinical_case: Stethoscope, simulation: MessageSquare }
        const Icon = icons[t] || BookOpen
        return <Icon className="w-6 h-6" />
    }

    const getName = (t: string) => ({ concept_map: 'Concept Map', flashcards: 'Flashcards', quiz: 'Quiz', clinical_case: 'Clinical Case', simulation: 'Simulation' }[t] || t)

    if (loading) return <div className="dashboard-page-container"><DashboardNav /><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-12 h-12 text-[#344895] animate-spin" /></div></div>

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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {artifacts.length === 0 ? (
                            <div className="col-span-full bg-gradient-to-br from-[#344895]/5 to-[#3DD6D0]/5 rounded-2xl p-10 text-center border-2 border-[#3DD6D0]/30">
                                <Loader2 className="w-12 h-12 mx-auto mb-4 text-[#344895] animate-spin" />
                                <h3 className="font-montserrat font-bold text-[#344895] text-xl mb-2">Creating Your Study Materials</h3>
                                <p className="text-gray-600 max-w-md mx-auto">We're generating flashcards, quizzes, clinical cases, and more. This usually takes 30-60 seconds...</p>
                            </div>
                        ) : artifacts.map(a => (
                            <div key={a.id} onClick={() => a.status === 'completed' && setActiveTab(a.artifact_type)} className="bg-white border-2 border-[#3DD6D0]/30 rounded-2xl p-6 hover:border-[#3DD6D0] cursor-pointer transition-all hover:shadow-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="text-[#344895]">{getIcon(a.artifact_type)}</div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${a.status === 'completed' ? 'bg-green-100 text-green-800' : a.status === 'generating' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                        {a.status === 'completed' ? 'Ready' : a.status === 'generating' ? 'Generating...' : 'Failed'}
                                    </span>
                                </div>
                                <h3 className="font-montserrat font-bold text-[#344895] text-lg">{getName(a.artifact_type)}</h3>
                            </div>
                        ))}
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

                        {(() => {
                            const rootNode = conceptMap.nodes?.find((n: any) => n.level === 0) || conceptMap.nodes?.[0];
                            const level1Nodes = conceptMap.nodes?.filter((n: any) => n.level === 1 || (n.parent_id === rootNode?.id && n.level !== 0)) || [];

                            const categoryConfig: Record<string, { bg: string, lightBg: string, text: string, border: string, icon: string, label: string }> = {
                                main: { bg: 'bg-gradient-to-r from-[#344895] to-[#4B5FAA]', lightBg: 'bg-[#344895]/5', text: 'text-white', border: 'border-[#344895]', icon: '🎯', label: 'Core Topic' },
                                mechanism: { bg: 'bg-gradient-to-r from-blue-500 to-blue-600', lightBg: 'bg-blue-50', text: 'text-white', border: 'border-blue-400', icon: '⚙️', label: 'Mechanism' },
                                treatment: { bg: 'bg-gradient-to-r from-emerald-500 to-emerald-600', lightBg: 'bg-emerald-50', text: 'text-white', border: 'border-emerald-400', icon: '💊', label: 'Treatment' },
                                symptom: { bg: 'bg-gradient-to-r from-amber-500 to-orange-500', lightBg: 'bg-amber-50', text: 'text-white', border: 'border-amber-400', icon: '🩺', label: 'Symptoms' },
                                diagnosis: { bg: 'bg-gradient-to-r from-purple-500 to-purple-600', lightBg: 'bg-purple-50', text: 'text-white', border: 'border-purple-400', icon: '🔬', label: 'Diagnosis' },
                                pharmacology: { bg: 'bg-gradient-to-r from-teal-500 to-cyan-500', lightBg: 'bg-teal-50', text: 'text-white', border: 'border-teal-400', icon: '💉', label: 'Pharmacology' },
                            };

                            return (
                                <>
                                    {/* Central Topic Card - Full Width Hero */}
                                    {rootNode && (
                                        <div className={`${categoryConfig.main.bg} rounded-2xl p-6 sm:p-8 text-white shadow-xl`}>
                                            <div className="flex items-start gap-4">
                                                <div className="text-4xl">{categoryConfig.main.icon}</div>
                                                <div className="flex-1">
                                                    <span className="text-white/70 text-xs font-medium uppercase tracking-wider">Central Concept</span>
                                                    <h3 className="font-bold text-xl sm:text-2xl mt-1">{rootNode.label}</h3>
                                                    <p className="text-white/90 mt-2 text-base leading-relaxed">{rootNode.description}</p>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
                                                <span className="text-white/60 text-sm">📚 {level1Nodes.length} main branches to explore</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Branches - Expandable Cards */}
                                    <div className="space-y-4">
                                        <h4 className="font-montserrat font-bold text-[#344895] text-lg flex items-center gap-2 px-1">
                                            <span className="w-2 h-2 bg-[#3DD6D0] rounded-full"></span>
                                            Key Concepts ({level1Nodes.length})
                                        </h4>

                                        {level1Nodes.map((node: any, index: number) => {
                                            const config = categoryConfig[node.category] || categoryConfig.mechanism;
                                            const level2Nodes = conceptMap.nodes?.filter((n: any) => n.parent_id === node.id) || [];

                                            return (
                                                <details
                                                    key={node.id}
                                                    className={`group bg-white rounded-2xl border-2 ${config.border} shadow-sm hover:shadow-lg transition-all overflow-hidden`}
                                                    open={index === 0}
                                                >
                                                    <summary className="cursor-pointer list-none p-4 sm:p-5">
                                                        <div className="flex items-start gap-4">
                                                            {/* Number Badge */}
                                                            <div className={`${config.bg} ${config.text} w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-md`}>
                                                                {config.icon}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.lightBg} ${config.border.replace('border-', 'text-')}`}>
                                                                        {config.label}
                                                                    </span>
                                                                    {level2Nodes.length > 0 && (
                                                                        <span className="text-xs text-gray-400">{level2Nodes.length} sub-topics</span>
                                                                    )}
                                                                </div>
                                                                <h4 className="font-bold text-[#344895] text-lg mt-1">{node.label}</h4>
                                                                <p className="text-gray-600 text-sm mt-1 leading-relaxed">{node.description}</p>
                                                            </div>

                                                            {/* Expand indicator */}
                                                            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1 group-open:rotate-90 transition-transform" />
                                                        </div>
                                                    </summary>

                                                    {/* Sub-topics */}
                                                    {level2Nodes.length > 0 && (
                                                        <div className={`${config.lightBg} px-4 sm:px-5 pb-4 sm:pb-5 pt-2`}>
                                                            <div className="pl-16">
                                                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Related Details</p>
                                                                <div className="space-y-3">
                                                                    {level2Nodes.map((subNode: any, subIndex: number) => (
                                                                        <div
                                                                            key={subNode.id}
                                                                            className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
                                                                        >
                                                                            <div className="flex items-start gap-3">
                                                                                <span className="text-gray-400 font-mono text-xs mt-0.5">{String(subIndex + 1).padStart(2, '0')}</span>
                                                                                <div>
                                                                                    <h5 className="font-semibold text-gray-800 text-sm">{subNode.label}</h5>
                                                                                    <p className="text-gray-500 text-sm mt-1 leading-relaxed">{subNode.description}</p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </details>
                                            );
                                        })}
                                    </div>

                                    {/* Relationships Section - How Concepts Connect */}
                                    {conceptMap.edges?.length > 0 && (
                                        <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-5 sm:p-6">
                                            <h4 className="font-montserrat font-bold text-[#344895] text-lg mb-4 flex items-center gap-2">
                                                🔗 How These Concepts Connect
                                            </h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {conceptMap.edges?.slice(0, 8).map((edge: any, i: number) => {
                                                    const source = conceptMap.nodes?.find((n: any) => n.id === edge.source);
                                                    const target = conceptMap.nodes?.find((n: any) => n.id === edge.target);
                                                    if (!source || !target) return null;
                                                    return (
                                                        <div
                                                            key={i}
                                                            className="bg-white rounded-xl p-3 border border-gray-100 flex items-center gap-2"
                                                        >
                                                            <span className="font-medium text-[#344895] text-sm truncate flex-1">{source.label}</span>
                                                            <span className="flex-shrink-0 px-2 py-0.5 bg-[#3DD6D0]/20 text-[#1A1F71] text-xs font-medium rounded-full">
                                                                {edge.label}
                                                            </span>
                                                            <span className="font-medium text-[#344895] text-sm truncate flex-1 text-right">{target.label}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quick Reference - Category Legend */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                                        <h4 className="font-montserrat font-bold text-gray-700 text-sm mb-3">📌 Category Guide</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(categoryConfig).filter(([key]) => key !== 'main').map(([key, config]) => (
                                                <span
                                                    key={key}
                                                    className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${config.lightBg} ${config.border.replace('border-', 'text-')} font-medium`}
                                                >
                                                    {config.icon} {config.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

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
                            );
                        })()}
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
                                disabled={submittingQuiz || Object.keys(quizAnswers).length === 0}
                                className="w-full bg-gradient-to-r from-[#3DD6D0] to-[#2BB5AF] text-[#1A1F71] font-bold py-4 rounded-full disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px]"
                            >
                                {submittingQuiz ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" />Submitting...</>
                                ) : Object.keys(quizAnswers).length === 0 ? (
                                    'Answer at least one question to submit'
                                ) : (
                                    `Submit Quiz (${Object.keys(quizAnswers).length}/${quizQuestions.length} answered)`
                                )}
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <button
                                    onClick={() => { setReviewMode(false); setQuizResult(null); setQuizAnswers({}) }}
                                    className="w-full bg-[#344895] text-white font-bold py-4 rounded-full min-h-[48px]"
                                >
                                    Start Fresh Quiz
                                </button>
                                <button
                                    onClick={() => { setReviewMode(false); generateMore('quiz', 10) }}
                                    disabled={generatingMore === 'quiz'}
                                    className="w-full bg-gradient-to-r from-[#3DD6D0] to-[#2BB5AF] text-[#1A1F71] font-bold py-3 rounded-full min-h-[48px] disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {generatingMore === 'quiz' ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" />Generating...</>
                                    ) : (
                                        <>✨ Generate 10 New Questions</>
                                    )}
                                </button>
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
                                    Ready for more practice? Get fresh questions.
                                </p>
                                <button
                                    onClick={regenerateQuiz}
                                    disabled={regeneratingQuiz}
                                    className={`w-full font-bold py-3 px-8 rounded-full min-h-[48px] transition-all ${regeneratingQuiz
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-[#3DD6D0] to-[#2BB5AF] text-[#1A1F71] active:scale-95'
                                        }`}
                                >
                                    {regeneratingQuiz ? '🔄 Generating New Questions...' : '🔄 Start New Quiz'}
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
                {activeTab === 'simulation' && simulation && (
                    <div className="max-w-2xl mx-auto bg-[#344895] border-2 border-[#3DD6D0] rounded-[33px] p-8 text-center">
                        <MessageSquare className="w-16 h-16 mx-auto mb-6 text-[#3DD6D0]" />
                        <h2 className="text-white font-montserrat font-bold text-2xl mb-2">{simulation.title}</h2>
                        <p className="text-white/80 mb-4">{simulation.patient_context}</p>
                        <p className="text-white/60 text-sm mb-8">Practice your communication skills with this patient scenario based on your lecture.</p>
                        <button onClick={startSimulation} className="bg-gradient-to-r from-[#3DD6D0] to-[#2BB5AF] text-[#1A1F71] font-montserrat font-bold px-8 py-4 rounded-full flex items-center gap-2 mx-auto hover:shadow-lg transition-all">
                            <Play className="w-5 h-5" /> Start Voice Practice
                        </button>
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
