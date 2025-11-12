'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import DashboardNav from '@/components/DashboardNav'
import EchoLoader from '@/components/EchoLoader'
import { 
  ArrowLeft,
  Download,
  CheckCircle2,
  Target,
  Award,
  Lightbulb,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  FileText,
  Sparkles,
  Clock
} from 'lucide-react'
import { apiClient } from '@/lib/api'

interface Insights {
  strengths: string[]
  weaknesses: string[]
  best_scenarios: Array<{
    scenario: string
    average_score: number
    sessions: number
  }>
  improvement_areas: string[]
  recommendations: string[]
}

interface Trends {
  scores_over_time: Array<{
    score: number
    date: string
  }>
  improvement_rate: number
  consistency: number
}

interface DashboardStats {
  empathy_score: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
  total_sessions: { value: number; change: number; trend: 'up' | 'down' | 'neutral' }
  total_time: { value: number; unit: string; change: number; trend: 'up' | 'down' | 'neutral' }
  avg_session_length: { value: number; unit: string; change: number; trend: 'up' | 'down' | 'neutral' }
}

export default function ReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [trends, setTrends] = useState<Trends | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'csv'>('pdf')

  const { user, loading: authLoading } = useAuth()
  
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return
      
      try {
        setLoading(true)
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const headers = {
          'X-User-ID': user.id,
          'Content-Type': 'application/json',
          ...apiClient.getAuthHeaders(),
        }

        // Fetch all data in parallel
        const [insightsResponse, trendsResponse, statsResponse] = await Promise.all([
          fetch(`${API_URL}/api/v1/statistics/analytics/insights`, { headers }).catch(() => null),
          fetch(`${API_URL}/api/v1/statistics/analytics/trends`, { headers }).catch(() => null),
          fetch(`${API_URL}/api/v1/statistics/dashboard`, { headers }).catch(() => null),
        ])

        if (insightsResponse?.ok) {
          const insightsData = await insightsResponse.json()
          console.log('📊 Insights data:', insightsData)
          setInsights(insightsData)
        } else {
          console.warn('⚠️ Insights response not OK:', insightsResponse?.status, insightsResponse?.statusText)
          if (insightsResponse) {
            const errorText = await insightsResponse.text()
            console.warn('⚠️ Insights error:', errorText)
          }
        }

        if (trendsResponse?.ok) {
          const trendsData = await trendsResponse.json()
          console.log('📈 Trends data:', trendsData)
          setTrends(trendsData)
        } else {
          console.warn('⚠️ Trends response not OK:', trendsResponse?.status, trendsResponse?.statusText)
          if (trendsResponse) {
            const errorText = await trendsResponse.text()
            console.warn('⚠️ Trends error:', errorText)
          }
        }

        if (statsResponse?.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData)
        }
      } catch (error) {
        console.error('❌ Failed to fetch analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchData()
    }
  }, [user])

  const handleDownloadReports = async (format: 'pdf' | 'csv' = 'pdf') => {
    if (!user) return

    try {
      setDownloading(true)
      setDownloadFormat(format)
      
      const blob = await apiClient.exportAllReports(format)
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `curavoice_reports_${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      console.log(`✅ Reports downloaded as ${format.toUpperCase()}`)
    } catch (error) {
      console.error('❌ Failed to download reports:', error)
      alert('Failed to download reports. Please try again.')
    } finally {
      setDownloading(false)
    }
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
            <h1 className="reports-title">Performance Analytics & Reports</h1>
          </div>

          <div className="reports-actions">
            <div className="flex gap-2">
              <button
                onClick={() => handleDownloadReports('pdf')}
                disabled={downloading}
                className="reports-action-button flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {downloading && downloadFormat === 'pdf' ? 'Downloading...' : 'Download PDF'}
                </span>
              </button>
              <button
                onClick={() => handleDownloadReports('csv')}
                disabled={downloading}
                className="reports-action-button flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {downloading && downloadFormat === 'csv' ? 'Downloading...' : 'Download CSV'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="reports-metrics-grid">
            <div className="reports-metric-card">
              <div className="reports-metric-icon reports-metric-icon-cyan">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div className="reports-metric-content">
                <span className="reports-metric-label">Total Sessions</span>
                <div className="flex items-baseline gap-2">
                  <span className="reports-metric-value">{stats.total_sessions.value}</span>
                  {stats.total_sessions.trend === 'up' && (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  )}
                  {stats.total_sessions.trend === 'down' && (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
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
                  <span className="reports-metric-value">{stats.empathy_score.value}</span>
                  <span className="reports-metric-unit">/ 100</span>
                  {stats.empathy_score.trend === 'up' && (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  )}
                  {stats.empathy_score.trend === 'down' && (
                    <TrendingDown className="w-4 h-4 text-red-500" />
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
                  <span className="reports-metric-value">{stats.total_time.value}</span>
                  <span className="reports-metric-unit">{stats.total_time.unit}</span>
                </div>
              </div>
            </div>

            {trends && trends.improvement_rate !== 0 && (
              <div className="reports-metric-card">
                <div className="reports-metric-icon reports-metric-icon-green">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div className="reports-metric-content">
                  <span className="reports-metric-label">Improvement Rate</span>
                  <div className="flex items-baseline gap-2">
                    <span className="reports-metric-value">
                      {trends.improvement_rate > 0 ? '+' : ''}{trends.improvement_rate.toFixed(1)}%
                    </span>
                    {trends.improvement_rate > 0 && (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    )}
                    {trends.improvement_rate < 0 && (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mem0 Analytics Summary */}
        <div className="mt-6 space-y-6">
          {/* Learning Insights */}
          {insights && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Learning Insights</h2>
                  <p className="text-sm text-gray-600">Cumulative analysis from all your training sessions</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Strengths */}
                {insights.strengths && insights.strengths.length > 0 && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-5 border-2 border-green-200">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-green-900">Your Consistent Strengths</h3>
                    </div>
                    <ul className="space-y-2">
                      {insights.strengths.map((strength, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-green-800">
                          <span className="text-green-600 mt-1">✓</span>
                          <span className="font-medium">{strength}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-green-700 mt-4 italic">
                      These strengths appear consistently across your sessions
                    </p>
                  </div>
                )}

                {/* Areas for Improvement */}
                {insights.improvement_areas && insights.improvement_areas.length > 0 && (
                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg p-5 border-2 border-amber-200">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                        <Target className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-amber-900">Focus Areas</h3>
                    </div>
                    <ul className="space-y-2">
                      {insights.improvement_areas.map((area, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-amber-800">
                          <span className="text-amber-600 mt-1">•</span>
                          <span className="font-medium">{area}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-700 mt-4 italic">
                      Areas that need improvement across your sessions
                    </p>
                  </div>
                )}

                {/* Best Scenarios */}
                {insights.best_scenarios && insights.best_scenarios.length > 0 && (
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-5 border-2 border-blue-200">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                        <Award className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-blue-900">Best Performing Scenarios</h3>
                    </div>
                    <ul className="space-y-3">
                      {insights.best_scenarios.map((scenario, idx) => (
                        <li key={idx} className="flex items-center justify-between text-blue-800">
                          <span className="font-medium">{scenario.scenario}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{scenario.average_score.toFixed(1)}%</span>
                            <span className="text-xs text-blue-600">({scenario.sessions} sessions)</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-blue-700 mt-4 italic">
                      Scenarios where you consistently perform well
                    </p>
                  </div>
                )}

                {/* Recommendations */}
                {insights.recommendations && insights.recommendations.length > 0 && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-5 border-2 border-purple-200">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                        <Lightbulb className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-lg font-bold text-purple-900">Personalized Recommendations</h3>
                    </div>
                    <ul className="space-y-3">
                      {insights.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-purple-800">
                          <span className="text-purple-600 mt-1">💡</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-purple-700 mt-4 italic">
                      AI-generated recommendations based on your performance patterns
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Performance Trends */}
          {trends && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Performance Trends</h2>
                  <p className="text-sm text-gray-600">Your progress over time</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {trends.improvement_rate !== 0 && (
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-5 border-2 border-indigo-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-indigo-700">Improvement Rate</span>
                      {trends.improvement_rate > 0 ? (
                        <TrendingUp className="w-5 h-5 text-green-500" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div className="text-3xl font-bold text-indigo-900">
                      {trends.improvement_rate > 0 ? '+' : ''}{trends.improvement_rate.toFixed(1)}%
                    </div>
                    <p className="text-xs text-indigo-600 mt-2">
                      {trends.improvement_rate > 0 
                        ? 'Improving over time' 
                        : 'Needs attention'}
                    </p>
                  </div>
                )}

                {trends.consistency > 0 && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-5 border-2 border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-700">Consistency</span>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="text-3xl font-bold text-green-900">
                      {trends.consistency.toFixed(1)}%
                    </div>
                    <p className="text-xs text-green-600 mt-2">
                      Score consistency across sessions
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Download Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Download All Reports</h2>
                <p className="text-sm text-gray-600">Export all your training session reports</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => handleDownloadReports('pdf')}
                disabled={downloading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-5 h-5" />
                <span>
                  {downloading && downloadFormat === 'pdf' ? 'Downloading PDF...' : 'Download PDF'}
                </span>
              </button>
              <button
                onClick={() => handleDownloadReports('csv')}
                disabled={downloading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-5 h-5" />
                <span>
                  {downloading && downloadFormat === 'csv' ? 'Downloading CSV...' : 'Download CSV'}
                </span>
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              Downloads include all evaluated sessions with complete evaluation data, scores, feedback, and metadata.
            </p>
          </div>

          {/* No Data Message */}
          {!insights && !trends && !stats && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Analytics Data Yet</h3>
              <p className="text-gray-600 mb-6">
                Complete training sessions and get evaluations to see your performance analytics here.
              </p>
              <button
                onClick={() => router.push('/training')}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Start Training
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
