'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Calendar, Clock, MessageCircle, Award, Volume2, Play, Pause, User, Bot } from 'lucide-react'
import { formatScenarioTitle } from '@/lib/utils'

interface Session {
  session_id: string
  scenario_title: string
  scenario_type: string
  category: string
  patient_mood: string
  started_at: string
  ended_at: string
  duration_seconds: number
  total_turns: number
  has_audio: boolean
  student_audio_count: number
  patient_audio_count: number
  evaluation_score: number | null
  evaluation_feedback: boolean
}

interface SessionDetails {
  session_id: string
  user: {
    user_id: string
    email: string
    full_name: string
    healthcare_domain: string
  }
  scenario: {
    title: string
    type: string
    category: string
    patient_mood: string
    system_prompt: string
  }
  timing: {
    started_at: string
    ended_at: string
    duration_seconds: number
  }
  conversation: {
    total_turns: number
    transcript: Array<{
      speaker: string
      text: string
      timestamp: number
    }>
  }
  audio: {
    has_audio: boolean
    student_audio: Array<{
      timestamp: number
      audio_base64: string
      size_bytes: number
      duration: number | null
    }>
    patient_audio: Array<{
      timestamp: number
      audio_base64: string
      size_bytes: number
      duration: number | null
    }>
  }
  evaluation: {
    score: number | null
    feedback: any
  }
}

export default function UserSessionsPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params?.userId as string

  const [user, setUser] = useState<any>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [playingAudio, setPlayingAudio] = useState<{ type: 'student' | 'patient', index: number } | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    const credentials = sessionStorage.getItem('admin_credentials')
    if (!credentials) {
      router.push('/admin/login')
      return
    }

    fetchUserSessions(credentials)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const fetchUserSessions = async (credentials: string) => {
    try {
      setLoading(true)
      const response = await fetch(`http://localhost:8000/api/v1/admin/users/${userId}/sessions`, {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      })

      if (!response.ok) {
        throw new Error('Unauthorized')
      }

      const data = await response.json()
      setUser(data.user)
      setSessions(data.sessions)
    } catch (error) {
      console.error('Error fetching user sessions:', error)
      router.push('/admin/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchSessionDetails = async (sessionId: string) => {
    const credentials = sessionStorage.getItem('admin_credentials')
    if (!credentials) return

    try {
      setDetailsLoading(true)
      const response = await fetch(`http://localhost:8000/api/v1/admin/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setSelectedSession(data)
      }
    } catch (error) {
      console.error('Error fetching session details:', error)
    } finally {
      setDetailsLoading(false)
    }
  }

  const playAudio = (base64Audio: string, type: 'student' | 'patient', index: number) => {
    // Stop current audio if playing
    if (audioElement) {
      audioElement.pause()
      audioElement.src = ''
    }

    // Check if clicking the same audio that's playing
    if (playingAudio?.type === type && playingAudio?.index === index) {
      setPlayingAudio(null)
      setAudioElement(null)
      return
    }

    // Create audio from base64
    const audio = new Audio(`data:audio/wav;base64,${base64Audio}`)
    
    audio.onended = () => {
      setPlayingAudio(null)
      setAudioElement(null)
    }

    audio.play()
    setAudioElement(audio)
    setPlayingAudio({ type, index })
  }

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user sessions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Dashboard
          </button>
          
          {user && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{user.full_name}</h1>
              <p className="text-gray-600">{user.email}</p>
              <div className="flex items-center gap-4 mt-2">
                <span className="px-3 py-1 text-sm font-medium bg-indigo-100 text-indigo-800 rounded">
                  {user.healthcare_domain}
                </span>
                <span className="text-sm text-gray-600">{sessions.length} sessions</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sessions List */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Training Sessions</h2>
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.session_id}
                  onClick={() => fetchSessionDetails(session.session_id)}
                  className={`bg-white rounded-lg shadow p-6 cursor-pointer transition-all ${
                    selectedSession?.session_id === session.session_id
                      ? 'ring-2 ring-indigo-500'
                      : 'hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{formatScenarioTitle(session.scenario_title)}</h3>
                      <p className="text-sm text-gray-600">{session.category}</p>
                    </div>
                    {session.evaluation_score !== null && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                        <Award className="h-4 w-4" />
                        {session.evaluation_score}/100
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(session.started_at)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {Math.floor(session.duration_seconds / 60)}m
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" />
                      {session.total_turns} turns
                    </div>
                    {session.has_audio && (
                      <div className="flex items-center gap-1">
                        <Volume2 className="h-4 w-4" />
                        Audio
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {sessions.length === 0 && (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  No sessions found for this user
                </div>
              )}
            </div>
          </div>

          {/* Session Details */}
          <div>
            {detailsLoading ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading session details...</p>
              </div>
            ) : selectedSession ? (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">{formatScenarioTitle(selectedSession.scenario.title)}</h2>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="px-2 py-1 bg-gray-100 rounded">{selectedSession.scenario.category}</span>
                    <span className="px-2 py-1 bg-gray-100 rounded">{selectedSession.scenario.patient_mood}</span>
                  </div>
                </div>

                {/* Transcript */}
                <div className="p-6 max-h-[600px] overflow-y-auto">
                  <h3 className="font-semibold text-gray-900 mb-4">Conversation Transcript</h3>
                  <div className="space-y-4">
                    {selectedSession.conversation.transcript.map((turn, index) => {
                      const isStudent = turn.speaker === 'Student'
                      const audioArray = isStudent
                        ? selectedSession.audio.student_audio
                        : selectedSession.audio.patient_audio
                      const audioIndex = Math.floor(index / 2)
                      const hasAudio = audioArray[audioIndex]
                      const isPlaying = playingAudio?.type === (isStudent ? 'student' : 'patient') && playingAudio?.index === audioIndex

                      return (
                        <div key={index} className={`flex gap-3 ${isStudent ? 'justify-end' : 'justify-start'}`}>
                          {!isStudent && <Bot className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />}
                          
                          <div className={`max-w-[80%] ${isStudent ? 'order-first' : ''}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-medium ${isStudent ? 'text-indigo-600' : 'text-purple-600'}`}>
                                {turn.speaker}
                              </span>
                              <span className="text-xs text-gray-500">{formatTimestamp(turn.timestamp)}</span>
                              {hasAudio && (
                                <button
                                  onClick={() => playAudio(audioArray[audioIndex].audio_base64, isStudent ? 'student' : 'patient', audioIndex)}
                                  className={`p-1 rounded hover:bg-gray-100 transition-colors ${isPlaying ? 'text-indigo-600' : 'text-gray-400'}`}
                                  title="Play audio"
                                >
                                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                </button>
                              )}
                            </div>
                            <div className={`p-3 rounded-lg ${
                              isStudent
                                ? 'bg-indigo-100 text-indigo-900'
                                : 'bg-gray-100 text-gray-900'
                            }`}>
                              {turn.text}
                            </div>
                          </div>

                          {isStudent && <User className="h-6 w-6 text-indigo-600 flex-shrink-0 mt-1" />}
                        </div>
                      )
                    })}
                  </div>

                  {/* Evaluation */}
                  {selectedSession.evaluation.score !== null && (
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="h-5 w-5 text-green-600" />
                        <h4 className="font-semibold text-green-900">Evaluation Score</h4>
                      </div>
                      <p className="text-2xl font-bold text-green-900">
                        {selectedSession.evaluation.score}/100
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                Select a session to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

