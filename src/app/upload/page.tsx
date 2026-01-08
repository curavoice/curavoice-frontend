'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Plus, BookOpen, Clock, ChevronRight, FolderOpen, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import DashboardNav from '@/components/DashboardNav'
import { useUploadContext } from '@/contexts/UploadContext'

// Supported file types
const SUPPORTED_TYPES = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
    'text/plain': 'Text File',
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

interface Lecture {
    id: string
    title: string
    file_type: string
    status: string
    total_chunks: number
    created_at: string
    has_artifacts: boolean
}

export default function LibraryPage() {
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()
    const { uploadState, setUploadState, setFile, resetUpload } = useUploadContext()
    const [isDragging, setIsDragging] = useState(false)
    const [showUploadSection, setShowUploadSection] = useState(false)
    const [lectures, setLectures] = useState<Lecture[]>([])
    const [loadingLectures, setLoadingLectures] = useState(true)
    // Content relevance warning modal state
    const [showRelevanceWarning, setShowRelevanceWarning] = useState(false)
    const [relevanceWarningMessage, setRelevanceWarningMessage] = useState('')
    const [pendingLectureId, setPendingLectureId] = useState<string | null>(null)
    const [deletingLectureId, setDeletingLectureId] = useState<string | null>(null)
    const [navigatingToId, setNavigatingToId] = useState<string | null>(null)

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/auth/login')
        }
    }, [authLoading, user, router])

    // Reset stale upload state on page load (only keep if actively uploading/processing)
    useEffect(() => {
        if (uploadState.status === 'success' || uploadState.status === 'error') {
            // Reset completed/failed uploads when revisiting the page
            resetUpload()
            setShowUploadSection(false)
        }
    }, []) // Only run on mount

    // Fetch lectures on mount
    useEffect(() => {
        if (user) {
            fetchLectures()
        }
    }, [user])

    const fetchLectures = async () => {
        const token = apiClient.getToken()
        if (!token) return

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(`${apiUrl}/api/v1/lectures`, {
                headers: { 'Authorization': `Bearer ${token}` },
            })
            if (response.ok) {
                const data = await response.json()
                setLectures(data)
            }
        } catch (error) {
            console.error('Failed to fetch lectures:', error)
        } finally {
            setLoadingLectures(false)
        }
    }

    const validateFile = (file: File): string | null => {
        if (!Object.keys(SUPPORTED_TYPES).includes(file.type)) {
            return `Unsupported file type. Please upload PDF, PowerPoint, Word, or text files.`
        }
        if (file.size > MAX_FILE_SIZE) {
            return `File too large. Maximum size is 50MB.`
        }
        return null
    }

    const handleFileSelect = useCallback((file: File) => {
        const error = validateFile(file)
        if (error) {
            setUploadState(prev => ({ ...prev, error, status: 'error' }))
            return
        }
        setFile(file)
    }, [setUploadState, setFile])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) handleFileSelect(file)
    }, [handleFileSelect])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) handleFileSelect(file)
    }, [handleFileSelect])

    const uploadFile = async () => {
        const token = apiClient.getToken()
        if (!uploadState.file || !token) return

        setUploadState(prev => ({ ...prev, status: 'uploading', progress: 10 }))

        try {
            const formData = new FormData()
            formData.append('file', uploadState.file)

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(`${apiUrl}/api/v1/lectures/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                body: formData,
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.detail || 'Upload failed')
            }

            const data = await response.json()

            // Check if this is a duplicate (already exists)
            if (data.message?.includes('already exists')) {
                // Existing lecture - skip processing, go straight to success
                setUploadState(prev => ({
                    ...prev,
                    status: 'success',
                    progress: 100,
                    lectureId: data.id,
                }))
                fetchLectures()
                return
            }

            // Check for content relevance warning
            if (data.relevance_warning && !data.is_relevant) {
                // Show warning modal - user must confirm to continue
                setRelevanceWarningMessage(data.relevance_warning)
                setPendingLectureId(data.id)
                setShowRelevanceWarning(true)
                setUploadState(prev => ({
                    ...prev,
                    status: 'idle',
                    progress: 0,
                }))
                return
            }

            setUploadState(prev => ({
                ...prev,
                status: 'processing',
                progress: 50,
                lectureId: data.id,
            }))

            // Poll for processing status
            pollLectureStatus(data.id)

        } catch (error) {
            // Check if it's a network error (Failed to fetch)
            const errorMessage = error instanceof Error ? error.message : 'Upload failed'
            const isNetworkError = errorMessage.toLowerCase().includes('failed to fetch') || 
                                   errorMessage.toLowerCase().includes('network') ||
                                   errorMessage.toLowerCase().includes('connection')
            
            setUploadState(prev => ({
                ...prev,
                status: 'error',
                error: isNetworkError 
                    ? `Unable to connect to server. Please check your connection and try again.`
                    : errorMessage,
            }))
        }
    }

    const pollLectureStatus = async (lectureId: string) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const token = apiClient.getToken()
        let attempts = 0
        const maxAttempts = 60

        const checkStatus = async () => {
            try {
                const response = await fetch(`${apiUrl}/api/v1/lectures/${lectureId}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                })

                if (!response.ok) throw new Error('Failed to check status')

                const data = await response.json()

                if (data.status === 'completed') {
                    setUploadState(prev => ({
                        ...prev,
                        status: 'success',
                        progress: 100,
                    }))
                    // Refresh lectures list
                    fetchLectures()
                    return
                }

                if (data.status === 'failed') {
                    setUploadState(prev => ({
                        ...prev,
                        status: 'error',
                        error: data.error_message || 'Processing failed',
                    }))
                    return
                }

                attempts++
                if (attempts < maxAttempts) {
                    setUploadState(prev => ({
                        ...prev,
                        progress: Math.min(50 + (attempts / maxAttempts) * 40, 90),
                    }))
                    setTimeout(checkStatus, 2000)
                } else {
                    setUploadState(prev => ({
                        ...prev,
                        status: 'error',
                        error: 'Processing timeout. Please try again.',
                    }))
                }
            } catch (error) {
                setUploadState(prev => ({
                    ...prev,
                    status: 'error',
                    error: 'Failed to check processing status',
                }))
            }
        }

        setTimeout(checkStatus, 2000)
    }

    const viewArtifacts = (lectureId?: string) => {
        const id = lectureId || uploadState.lectureId
        if (id) {
            setNavigatingToId(id)
            router.push(`/artifacts/${id}`)
        }
    }

    const deleteLecture = async (e: React.MouseEvent, lectureId: string, title: string) => {
        e.stopPropagation() // Prevent card click

        if (!confirm(`Delete "${title}"? This will also delete all generated study materials.`)) {
            return
        }

        const token = apiClient.getToken()
        if (!token) return

        setDeletingLectureId(lectureId)
        
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(`${apiUrl}/api/v1/lectures/${lectureId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            })

            if (response.ok) {
                // Remove from local state immediately
                setLectures(prev => prev.filter(l => l.id !== lectureId))
            } else {
                alert('Failed to delete lecture')
            }
        } catch (error) {
            console.error('Delete failed:', error)
            alert('Failed to delete lecture')
        } finally {
            setDeletingLectureId(null)
        }
    }

    const handleAddNewClick = () => {
        resetUpload()
        setShowUploadSection(true)
    }

    // Handler to confirm off-topic content upload
    const confirmRelevanceWarning = async () => {
        if (!pendingLectureId) return
        setShowRelevanceWarning(false)
        setUploadState(prev => ({
            ...prev,
            status: 'processing',
            progress: 50,
            lectureId: pendingLectureId,
        }))
        pollLectureStatus(pendingLectureId)
        setPendingLectureId(null)
        setRelevanceWarningMessage('')
    }

    // Handler to cancel off-topic content upload
    const cancelRelevanceWarning = async () => {
        if (pendingLectureId) {
            // Delete the uploaded lecture
            const token = apiClient.getToken()
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
                await fetch(`${apiUrl}/api/v1/lectures/${pendingLectureId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` },
                })
            } catch (e) {
                console.error('Failed to delete rejected lecture:', e)
            }
        }
        setShowRelevanceWarning(false)
        setPendingLectureId(null)
        setRelevanceWarningMessage('')
        resetUpload()
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const getFileTypeIcon = (fileType: string) => {
        const icons: Record<string, string> = {
            'pdf': '📄',
            'pptx': '📊',
            'docx': '📝',
            'txt': '📃',
        }
        return icons[fileType] || '📁'
    }

    return (
        <div className="dashboard-page-container">
            <DashboardNav />

            <div className="max-w-[1512px] mx-auto px-2 sm:px-4 lg:px-16 pb-6 sm:pb-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 pt-2">
                    <div>
                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-montserrat font-bold text-[#344895]">
                            📚 My Library
                        </h1>
                        <p className="text-sm sm:text-base font-lato text-gray-600 mt-1">
                            {lectures.length} lecture{lectures.length !== 1 ? 's' : ''} • Click any to study
                        </p>
                    </div>
                    <button
                        onClick={handleAddNewClick}
                        className="bg-gradient-to-r from-[#3DD6D0] to-[#2BB5AF] text-[#1A1F71] font-montserrat font-bold px-5 py-3 rounded-full flex items-center justify-center gap-2 hover:shadow-lg transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Add New Lecture
                    </button>
                </div>

                {/* Upload Section - Collapsible */}
                {(showUploadSection || uploadState.status !== 'idle') && (
                    <div className="bg-[#344895] border-2 border-[#3DD6D0] rounded-2xl p-4 sm:p-6 mb-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold text-lg">Upload New Lecture</h3>
                            {uploadState.status === 'idle' && (
                                <button
                                    onClick={() => setShowUploadSection(false)}
                                    className="text-white/60 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {/* Upload States */}
                        {(uploadState.status === 'idle' || uploadState.status === 'error') && (
                            <>
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    className={`
                                        border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                                        ${isDragging ? 'border-[#3DD6D0] bg-[#3DD6D0]/10' : 'border-white/30 hover:border-[#3DD6D0]'}
                                    `}
                                >
                                    <input
                                        type="file"
                                        id="file-input"
                                        className="hidden"
                                        accept=".pdf,.pptx,.docx,.txt"
                                        onChange={handleFileInput}
                                    />
                                    <label htmlFor="file-input" className="cursor-pointer">
                                        {!uploadState.file ? (
                                            <>
                                                <Upload className="w-10 h-10 mx-auto mb-2 text-[#3DD6D0]" />
                                                <p className="text-white font-semibold">Drop file or click to browse</p>
                                                <p className="text-white/60 text-sm mt-1">PDF, PowerPoint, Word, or Text</p>
                                            </>
                                        ) : (
                                            <div className="flex items-center justify-center gap-3">
                                                <FileText className="w-8 h-8 text-[#3DD6D0]" />
                                                <div className="text-left">
                                                    <p className="text-white font-semibold truncate max-w-[200px]">{uploadState.file.name}</p>
                                                    <p className="text-white/60 text-sm">{(uploadState.file.size / 1024 / 1024).toFixed(1)} MB</p>
                                                </div>
                                                <button onClick={(e) => { e.preventDefault(); resetUpload() }} className="text-white/60 hover:text-white ml-2">
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                    </label>
                                </div>

                                {uploadState.error && (
                                    <div className="mt-3 p-3 bg-red-500/20 border border-red-400/30 rounded-lg">
                                        <div className="flex items-center gap-2 text-red-300">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                            <span className="text-sm">{uploadState.error}</span>
                                        </div>
                                        {uploadState.error.includes('Unable to connect') && (
	                                            <button
	                                                onClick={() => {
	                                                    setUploadState(prev => ({ ...prev, error: null, status: 'idle' }))
	                                                }}
	                                                className="mt-2 text-xs text-[#3DD6D0] hover:underline"
	                                            >
	                                                Try again
                                            </button>
                                        )}
                                    </div>
                                )}

                                {uploadState.file && (
                                    <button
                                        onClick={uploadFile}
                                        className="w-full mt-4 bg-[#3DD6D0] text-[#1A1F71] font-bold py-3 rounded-full hover:bg-[#2BB5AF] transition-colors"
                                    >
                                        Upload & Process
                                    </button>
                                )}
                            </>
                        )}

                        {(uploadState.status === 'uploading' || uploadState.status === 'processing') && (
                            <div className="text-center py-4">
                                <Loader2 className="w-10 h-10 mx-auto mb-3 text-[#3DD6D0] animate-spin" />
                                <p className="text-white font-semibold">
                                    {uploadState.status === 'uploading' ? 'Uploading...' : 'Processing...'}
                                </p>
                                <div className="w-full bg-white/20 rounded-full h-2 mt-3">
                                    <div
                                        className="bg-[#3DD6D0] h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadState.progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {uploadState.status === 'success' && (
                            <div className="text-center py-4">
                                <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
                                <p className="text-white font-semibold mb-3">Lecture processed!</p>
                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => viewArtifacts()}
                                        className="bg-[#3DD6D0] text-[#1A1F71] font-bold px-5 py-2 rounded-full"
                                    >
                                        View Study Materials →
                                    </button>
                                    <button
                                        onClick={() => { resetUpload(); setShowUploadSection(false) }}
                                        className="text-white/70 hover:text-white"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Lectures Grid */}
                {loadingLectures ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 text-[#344895] animate-spin" />
                    </div>
                ) : lectures.length === 0 && !showUploadSection ? (
                    <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                        <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="font-montserrat font-bold text-xl text-gray-700 mb-2">Your library is empty</h3>
                        <p className="text-gray-500 mb-6">Upload your first lecture to start learning</p>
                        <button
                            onClick={handleAddNewClick}
                            className="bg-[#344895] text-white font-bold px-6 py-3 rounded-full inline-flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            Add Your First Lecture
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {lectures.map((lecture) => (
                            <div
                                key={lecture.id}
                                onClick={() => !navigatingToId && !deletingLectureId && viewArtifacts(lecture.id)}
                                className={`bg-white rounded-2xl border-2 p-5 transition-all group relative ${
                                    navigatingToId === lecture.id || deletingLectureId === lecture.id
                                        ? 'border-[#3DD6D0] opacity-70 cursor-wait'
                                        : 'border-gray-100 hover:border-[#3DD6D0] cursor-pointer hover:shadow-lg'
                                }`}
                            >
                                {/* Loading overlay */}
                                {(navigatingToId === lecture.id || deletingLectureId === lecture.id) && (
                                    <div className="absolute inset-0 bg-white/50 rounded-2xl flex items-center justify-center z-10">
                                        <Loader2 className="w-8 h-8 text-[#3DD6D0] animate-spin" />
                                    </div>
                                )}
                                
                                <div className="flex items-start gap-4">
                                    <div className="text-3xl">{getFileTypeIcon(lecture.file_type)}</div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-montserrat font-bold text-[#344895] text-lg truncate group-hover:text-[#3DD6D0] transition-colors">
                                            {lecture.title}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>{formatDate(lecture.created_at)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-3">
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${lecture.status === 'completed'
                                                ? 'bg-green-100 text-green-700'
                                                : lecture.status === 'failed'
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {lecture.status === 'completed' ? '✓ Ready' : lecture.status}
                                            </span>
                                            <span className="text-xs text-gray-400 uppercase">{lecture.file_type}</span>
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-5 h-5 transition-all ${
                                        navigatingToId === lecture.id 
                                            ? 'text-[#3DD6D0]' 
                                            : 'text-gray-300 group-hover:text-[#3DD6D0] group-hover:translate-x-1'
                                    }`} />
                                </div>

                                {/* Quick Actions */}
                                {lecture.status === 'completed' && (
                                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <BookOpen className="w-3.5 h-3.5" />
                                            Flashcards, Quiz, Mind Map...
                                        </span>
                                        <button
                                            onClick={(e) => deleteLecture(e, lecture.id, lecture.title)}
                                            disabled={deletingLectureId === lecture.id}
                                            className={`p-1.5 rounded-lg transition-colors ${
                                                deletingLectureId === lecture.id
                                                    ? 'text-gray-300 cursor-wait'
                                                    : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                            }`}
                                            title={deletingLectureId === lecture.id ? 'Deleting...' : 'Delete lecture'}
                                        >
                                            {deletingLectureId === lecture.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                )}
                                {lecture.status !== 'completed' && (
                                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-end">
                                        <button
                                            onClick={(e) => deleteLecture(e, lecture.id, lecture.title)}
                                            disabled={deletingLectureId === lecture.id}
                                            className={`p-1.5 rounded-lg transition-colors ${
                                                deletingLectureId === lecture.id
                                                    ? 'text-gray-300 cursor-wait'
                                                    : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                            }`}
                                            title={deletingLectureId === lecture.id ? 'Deleting...' : 'Delete lecture'}
                                        >
                                            {deletingLectureId === lecture.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Content Relevance Warning Modal */}
            {showRelevanceWarning && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                <span className="text-2xl">⚠️</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">Content Review</h3>
                        </div>

                        <p className="text-gray-600 mb-4">
                            {relevanceWarningMessage || "This content doesn't appear to be pharmacy or healthcare educational material (like lecture notes, textbook chapters, or clinical case studies)."}
                        </p>
                        
                        <p className="text-gray-500 text-sm mb-6">
                            CuraVoice works best with pharmacy/healthcare study materials. You can still upload this file, but the generated flashcards and quizzes may not be as effective.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={cancelRelevanceWarning}
                                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                            >
                                Cancel Upload
                            </button>
                            <button
                                onClick={confirmRelevanceWarning}
                                className="flex-1 px-4 py-3 bg-[#3DD6D0] text-[#1A1F71] rounded-xl font-bold hover:bg-[#2BB5AF] transition-colors"
                            >
                                Upload Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
