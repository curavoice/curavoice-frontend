'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import DashboardNav from '@/components/DashboardNav'
import EchoIcon from '@/components/icons/Echo'
import EchoLoader from '@/components/EchoLoader'
import Image from 'next/image'
import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react'
import { formatScenarioTitle } from '@/lib/utils'

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<{
    empathyScore: { value: number; change: number; trend: 'up' | 'down' | 'neutral' };
    totalSessions: { value: number; change: number; trend: 'up' | 'down' | 'neutral' };
    totalTime: { value: number; unit: string; change: number; trend: 'up' | 'down' | 'neutral' };
    avgSessionLength: { value: number; unit: string; change: number; trend: 'up' | 'down' | 'neutral' };
  } | null>(null)
  const [recentFeedback, setRecentFeedback] = useState<{
    has_feedback: boolean;
    scenario_title?: string;
    score?: number;
    feedback_summary?: string;
    message?: string;
    session_id?: string;
  } | null>(null)
  const [streak, setStreak] = useState<{
    current_streak: number;
    longest_streak: number;
    message?: string;
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  // Fetch all dashboard data in parallel for better performance
  useEffect(() => {
    const fetchAllData = async () => {
      if (!user?.id || authLoading) return

      setIsLoading(true)
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const headers = {
        'X-User-ID': user.id,
        'Content-Type': 'application/json'
      }

      try {
        // Fetch all three endpoints in parallel
        const [statsResponse, feedbackResponse, streakResponse] = await Promise.all([
          fetch(`${API_URL}/api/v1/statistics/dashboard`, { headers }),
          fetch(`${API_URL}/api/v1/statistics/recent-feedback`, { headers }),
          fetch(`${API_URL}/api/v1/statistics/streak`, { headers })
        ])

        // Process dashboard statistics
        if (statsResponse.ok) {
          const data = await statsResponse.json()
          setStats({
            empathyScore: {
              value: data.empathy_score.value,
              change: data.empathy_score.change,
              trend: data.empathy_score.trend
            },
            totalSessions: {
              value: data.total_sessions.value,
              change: data.total_sessions.change,
              trend: data.total_sessions.trend
            },
            totalTime: {
              value: data.total_time.value,
              unit: data.total_time.unit,
              change: data.total_time.change,
              trend: data.total_time.trend
            },
            avgSessionLength: {
              value: data.avg_session_length.value,
              unit: data.avg_session_length.unit,
              change: data.avg_session_length.change,
              trend: data.avg_session_length.trend
            }
          })
        } else {
          console.error('Failed to fetch statistics:', statsResponse.statusText)
          // Fallback to default values
          setStats({
            empathyScore: { value: 0, change: 0, trend: 'neutral' },
            totalSessions: { value: 0, change: 0, trend: 'neutral' },
            totalTime: { value: 0, unit: 'hrs', change: 0, trend: 'neutral' },
            avgSessionLength: { value: 0, unit: 'min', change: 0, trend: 'neutral' }
          })
        }

        // Process recent feedback
        if (feedbackResponse.ok) {
          const data = await feedbackResponse.json()
          setRecentFeedback(data)
        }

        // Process streak
        if (streakResponse.ok) {
          const data = await streakResponse.json()
          setStreak(data)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        // Fallback to default values
        setStats({
          empathyScore: { value: 0, change: 0, trend: 'neutral' },
          totalSessions: { value: 0, change: 0, trend: 'neutral' },
          totalTime: { value: 0, unit: 'hrs', change: 0, trend: 'neutral' },
          avgSessionLength: { value: 0, unit: 'min', change: 0, trend: 'neutral' }
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchAllData()
  }, [user, authLoading])

  if (authLoading || isLoading || !stats || !user) {
    return (
      <div className="dashboard-page-container">
        <DashboardNav />
        <EchoLoader context="dashboard" />
      </div>
    )
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />
    return <Minus className="w-4 h-4 text-gray-500" />
  }

  const getTrendColor = (trend: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return 'text-green-500'
    if (trend === 'down') return 'text-red-500'
    return 'text-gray-500'
  }

  return (
    <div className="dashboard-page-container">
      <DashboardNav />
      
      {/* Welcome Section */}
      <div className="dashboard-welcome">
        <div className="dashboard-welcome-content">
          <h1 className="dashboard-welcome-title">Welcome back, {user?.full_name?.split(' ')[0] || 'User'}! 👋</h1>
          <p className="dashboard-welcome-subtitle">Here's your training progress at a glance</p>
        </div>
        <button 
          onClick={() => router.push('/training')}
          className="dashboard-cta-button"
        >
          Start Training
          <ChevronRight className="w-5 h-5 ml-1" />
        </button>
      </div>

      {/* Stats Grid - Top 4 Cards */}
      <div className="stats-grid">
        {/* Empathy Score */}
        <div className="stat-card stat-card-interactive" role="article" aria-label="Empathy Score Statistics">
          <div className="stat-card-header">
            <h3 className="stat-card-title">Empathy Score</h3>
            <div className="stat-card-trend">
              {getTrendIcon(stats.empathyScore.trend)}
              <span className={`stat-card-change ${getTrendColor(stats.empathyScore.trend)}`}>
                +{stats.empathyScore.change}
              </span>
            </div>
          </div>
          <div className="stat-card-content">
            <div className="stat-card-icon">
              <Image
                src="/assets/pill-icon.svg"
                alt=""
                width={136}
                height={81}
                className="w-full h-auto"
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-col items-start">
              <div className="stat-card-value">{stats.empathyScore.value}</div>
              <div className="stat-card-progress">
                <div className="stat-card-progress-bar" style={{ width: `${stats.empathyScore.value}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Total Sessions Practiced */}
        <div className="stat-card stat-card-interactive" role="article" aria-label="Total Sessions Practiced">
          <div className="stat-card-header">
            <h3 className="stat-card-title">Total Sessions</h3>
            <div className="stat-card-trend">
              {getTrendIcon(stats.totalSessions.trend)}
              <span className={`stat-card-change ${getTrendColor(stats.totalSessions.trend)}`}>
                +{stats.totalSessions.change}
              </span>
            </div>
          </div>
          <div className="stat-card-content">
            <div className="stat-card-icon">
              <Image
                src="/assets/graph-icon.svg"
                alt=""
                width={78}
                height={77}
                className="w-full h-auto"
                aria-hidden="true"
              />
            </div>
            <div className="stat-card-value">{stats.totalSessions.value}</div>
          </div>
        </div>

        {/* Total Time Practiced */}
        <div className="stat-card stat-card-interactive" role="article" aria-label="Total Time Practiced">
          <div className="stat-card-header">
            <h3 className="stat-card-title">Total Time</h3>
            <div className="stat-card-trend">
              {getTrendIcon(stats.totalTime.trend)}
              <span className={`stat-card-change ${getTrendColor(stats.totalTime.trend)}`}>
                +{stats.totalTime.change}h
              </span>
            </div>
          </div>
          <div className="stat-card-content">
            <div className="stat-card-icon">
              <Image
                src="/assets/clock-icon.svg"
                alt=""
                width={68}
                height={68}
                className="w-full h-auto"
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-col items-start">
              <div className="stat-card-value">{stats.totalTime.value}</div>
              <div className="stat-card-unit">{stats.totalTime.unit}</div>
            </div>
          </div>
        </div>

        {/* Average Session Length */}
        <div className="stat-card stat-card-interactive" role="article" aria-label="Average Session Length">
          <div className="stat-card-header">
            <h3 className="stat-card-title">Avg Session</h3>
            <div className="stat-card-trend">
              {getTrendIcon(stats.avgSessionLength.trend)}
              <span className={`stat-card-change ${getTrendColor(stats.avgSessionLength.trend)}`}>
                {stats.avgSessionLength.change}
              </span>
            </div>
          </div>
          <div className="stat-card-content">
            <div className="stat-card-icon">
              <Image
                src="/assets/running-man-icon.svg"
                alt=""
                width={83}
                height={65}
                className="w-full h-auto"
                aria-hidden="true"
              />
            </div>
            <div className="flex flex-col items-start">
              <div className="stat-card-value">{stats.avgSessionLength.value}</div>
              <div className="stat-card-unit">{stats.avgSessionLength.unit}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Feedback + Streak */}
      <div className="content-grid">
        <div className="content-grid-left">
          <div className="feedback-card" role="article" aria-label="Recent Feedback">
            <div className="feedback-header">
              <h2 className="feedback-title">Recent Feedback</h2>
            </div>
            {recentFeedback?.has_feedback ? (
              <>
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>{formatScenarioTitle(recentFeedback.scenario_title)}</strong> - Score: {recentFeedback.score}%
                  </p>
                  <p className="feedback-text">
                    {recentFeedback.feedback_summary || 'Great session! Keep practicing to improve your skills.'}
                  </p>
                </div>
                <div className="feedback-actions">
                  <button 
                    onClick={() => router.push('/reports')}
                    className="feedback-action-button"
                  >
                    View Full Report
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="feedback-text">
                  {recentFeedback?.message || 'Complete a training session and get feedback to see your results here.'}
                </p>
                <div className="feedback-actions">
                  <button 
                    onClick={() => router.push('/training')}
                    className="feedback-action-button"
                  >
                    Start Training
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="content-grid-right">
          <div className="streak-card" role="article" aria-label="Current Streak">
            <div className="streak-flame-container">
              <Image 
                src="/assets/flame-icon.svg" 
                alt=""
                width={97} 
                height={130}
                className="streak-flame"
                aria-hidden="true"
              />
              <div className="streak-glow"></div>
            </div>
            <h3 className="streak-title">Current Streak</h3>
            <div className="streak-value-container">
              <div className="streak-value">{streak?.current_streak ?? 0}</div>
              <div className="streak-unit">days</div>
            </div>
            <div className="streak-info">
              <p className="streak-info-text">
                {streak?.current_streak && streak.current_streak > 0
                  ? "🔥 Keep it up! You're on fire!"
                  : "Start training to begin your streak!"}
              </p>
              <p className="streak-info-subtext">
                Longest streak: {streak?.longest_streak ?? 0} days
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
