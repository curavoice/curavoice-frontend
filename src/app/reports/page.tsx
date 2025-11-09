'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import DashboardNav from '@/components/DashboardNav'
import EchoLoader from '@/components/EchoLoader'
import OSCEFeedback from '@/components/OSCEFeedback'
import { 
  ArrowLeft,
  Calendar,
  Clock,
  Award,
  BarChart3,
  MessageSquare,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { apiClient } from '@/lib/api'

interface TrainingSession {
  id: string
  scenario_title: string
  category: string
  scenario_type: string
  patient_mood: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  total_turns: number
  has_evaluation: boolean
  evaluation_score: number | null
  evaluation_completed_at: string | null
}

export default function ReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [filteredSessions, setFilteredSessions] = useState<TrainingSession[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [dateRange, setDateRange] = useState('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'evaluated' | 'not_evaluated'>('all')

  const { user, loading: authLoading } = useAuth()
  
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user) return
      
      try {
        setLoading(true)
        console.log('📚 Fetching sessions for user:', user.id)
        const data = await apiClient.getAllSessions(100, 0)
        console.log('📊 Received sessions:', data)
        console.log('📊 Number of sessions:', data?.length || 0)
        setSessions(data)
        setFilteredSessions(data)
      } catch (error) {
        console.error('❌ Failed to fetch sessions:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchSessions()
    }
  }, [user])

  useEffect(() => {
    let filtered = [...sessions]

    // Filter by date range
    if (dateRange !== 'all') {
      const now = new Date()
      const cutoffDate = new Date()
      
      switch (dateRange) {
        case '7days':
          cutoffDate.setDate(now.getDate() - 7)
          break
        case '30days':
          cutoffDate.setDate(now.getDate() - 30)
          break
        case '90days':
          cutoffDate.setDate(now.getDate() - 90)
          break
      }
      
      filtered = filtered.filter(session => 
        new Date(session.started_at) >= cutoffDate
      )
    }

    // Filter by evaluation status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(session => 
        filterStatus === 'evaluated' ? session.has_evaluation : !session.has_evaluation
      )
    }

    setFilteredSessions(filtered)
  }, [dateRange, filterStatus, sessions])

  const handleViewFeedback = (sessionId: string) => {
    setSelectedSession(sessionId)
    setShowFeedback(true)
  }

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-gray-400'
    if (score >= 80) return 'text-green-600'  // 80/100 = 80% passing threshold
    return 'text-red-600'
  }

  const getResultBadge = (score: number | null) => {
    if (!score) return null
    if (score >= 80) {  // 80/100 = 80% passing threshold
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle2 className="w-3 h-3" />
          Pass
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" />
        Fail
      </span>
    )
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate stats
  // Only count sessions that ended AND have evaluation (got feedback)
  const completedSessionsWithFeedback = sessions.filter(
    s => s.ended_at !== null && s.has_evaluation
  )
  
  const stats = {
    totalSessions: completedSessionsWithFeedback.length,
    evaluatedSessions: completedSessionsWithFeedback.length,
    averageScore: completedSessionsWithFeedback.length > 0
      ? Math.round(
          completedSessionsWithFeedback
            .filter(s => s.evaluation_score !== null)
            .reduce((sum, s) => sum + (s.evaluation_score || 0), 0) /
          completedSessionsWithFeedback.filter(s => s.evaluation_score !== null).length
        )
      : 0,
    totalTime: completedSessionsWithFeedback.reduce((sum, s) => sum + (s.duration_seconds || 0), 0),
    passRate: completedSessionsWithFeedback.length > 0
      ? Math.round(
          (completedSessionsWithFeedback.filter(s => (s.evaluation_score || 0) >= 80).length /  // 80/100 = 80% passing threshold
          completedSessionsWithFeedback.length) * 100
        )
      : 0
  }

  if (loading || authLoading) {
    return (
      <div className="dashboard-page-container">
        <DashboardNav />
        <EchoLoader context="reports" />
      </div>
    )
  }

  return (
    <div className="dashboard-page-container">
      <DashboardNav />
      
      <div className="max-w-[1512px] mx-auto px-2 sm:px-4 lg:px-16 pb-6 sm:pb-8">
        {/* Header */}
        <div className="reports-header">
          <button 
            onClick={() => router.push('/dashboard')}
            className="reports-back-button"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="reports-title-section">
            <h1 className="reports-title">Training Session Reports</h1>
            <p className="reports-subtitle">
              View all your training sessions and performance evaluations
            </p>
          </div>

          <div className="reports-actions">
            <button className="reports-action-button">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="reports-metrics-grid">
          <div className="reports-metric-card">
            <div className="reports-metric-icon reports-metric-icon-cyan">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div className="reports-metric-content">
              <span className="reports-metric-label">Total Sessions</span>
              <div className="flex items-baseline gap-2">
                <span className="reports-metric-value">{stats.totalSessions}</span>
              </div>
            </div>
          </div>

          <div className="reports-metric-card">
            <div className="reports-metric-icon reports-metric-icon-purple">
              <Award className="w-6 h-6" />
            </div>
            <div className="reports-metric-content">
              <span className="reports-metric-label">Average Score</span>
              <div className="flex items-baseline gap-2">
                <span className="reports-metric-value">{stats.averageScore}</span>
                <span className="reports-metric-unit">/ 100</span>
              </div>
            </div>
          </div>

          <div className="reports-metric-card">
            <div className="reports-metric-icon reports-metric-icon-green">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="reports-metric-content">
              <span className="reports-metric-label">Pass Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="reports-metric-value">{stats.passRate}%</span>
                {stats.passRate >= 80 && (
                  <span className="reports-metric-change-positive">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                )}
                {stats.passRate < 60 && (
                  <span className="reports-metric-change-negative">
                    <TrendingDown className="w-4 h-4" />
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="reports-metric-card">
            <div className="reports-metric-icon reports-metric-icon-blue">
              <Clock className="w-6 h-6" />
            </div>
            <div className="reports-metric-content">
              <span className="reports-metric-label">Total Time</span>
              <div className="flex items-baseline gap-2">
                <span className="reports-metric-value">{Math.round(stats.totalTime / 3600 * 10) / 10}</span>
                <span className="reports-metric-unit">hrs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Date Range Selector */}
          <div className="reports-date-selector flex-1">
            <button 
              className={`reports-date-button ${dateRange === '7days' ? 'active' : ''}`}
              onClick={() => setDateRange('7days')}
            >
              Last 7 Days
            </button>
            <button 
              className={`reports-date-button ${dateRange === '30days' ? 'active' : ''}`}
              onClick={() => setDateRange('30days')}
            >
              Last 30 Days
            </button>
            <button 
              className={`reports-date-button ${dateRange === '90days' ? 'active' : ''}`}
              onClick={() => setDateRange('90days')}
            >
              Last 90 Days
            </button>
            <button 
              className={`reports-date-button ${dateRange === 'all' ? 'active' : ''}`}
              onClick={() => setDateRange('all')}
            >
              All Time
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Sessions</option>
              <option value="evaluated">Evaluated Only</option>
              <option value="not_evaluated">Not Evaluated</option>
            </select>
          </div>
        </div>

        {/* Sessions List */}
        <div className="reports-section-card">
          <div className="reports-section-header">
            <h2 className="reports-section-title">Training Sessions</h2>
            <span className="reports-badge">{filteredSessions.length} Sessions</span>
          </div>
          
          {filteredSessions.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No training sessions found</p>
              <button
                onClick={() => router.push('/training')}
                className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Start Training
              </button>
            </div>
          ) : (
            <div className="reports-sessions-list">
              {filteredSessions.map((session) => (
                <div key={session.id} className="reports-session-item">
                  <div className="reports-session-header">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="reports-session-icon">
                        <BarChart3 className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="reports-session-title">{session.scenario_title}</h3>
                        <div className="reports-session-meta">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(session.started_at)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(session.duration_seconds)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {session.total_turns} turns
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {session.has_evaluation ? (
                        <>
                          <div className="text-right">
                            <div className={`text-2xl font-bold ${getScoreColor(session.evaluation_score)}`}>
                              {session.evaluation_score}
                            </div>
                            <div className="text-xs text-gray-500">/ 100</div>
                          </div>
                          {getResultBadge(session.evaluation_score)}
                          <button
                            onClick={() => handleViewFeedback(session.id)}
                            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm"
                          >
                            <Eye className="w-4 h-4" />
                            View Report
                          </button>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600">
                          <AlertCircle className="w-4 h-4" />
                          Not Evaluated
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedback && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <OSCEFeedback
              sessionId={selectedSession}
              viewOnly={true}
              onClose={() => {
                setShowFeedback(false)
                setSelectedSession(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
