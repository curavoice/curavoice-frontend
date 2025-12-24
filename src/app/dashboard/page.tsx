'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import DashboardNav from '@/components/DashboardNav'
import EchoLoader from '@/components/EchoLoader'
import Image from 'next/image'
import { TrendingUp, TrendingDown, Minus, X, Trophy, Zap, Target, CheckCircle, Lock, Flame } from 'lucide-react'

// Calculate level from XP (every 500 XP = 1 level)
const calculateLevel = (xp: number) => Math.floor(xp / 500) + 1
const xpForNextLevel = (level: number) => level * 500
const xpProgress = (xp: number) => {
  const currentLevel = calculateLevel(xp)
  const currentLevelXP = (currentLevel - 1) * 500
  const nextLevelXP = currentLevel * 500
  return ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
}

// Achievement definitions
const ACHIEVEMENTS = [
  { id: 'first_lecture', name: 'First Steps', desc: 'Upload your first lecture', icon: '📚', xp: 50 },
  { id: 'quiz_master', name: 'Quiz Master', desc: 'Score 80%+ on 3 quizzes', icon: '🧠', xp: 100 },
  { id: 'streak_3', name: 'On Fire', desc: 'Maintain a 3-day streak', icon: '🔥', xp: 75 },
  { id: 'streak_7', name: 'Week Warrior', desc: 'Maintain a 7-day streak', icon: '⚡', xp: 150 },
  { id: 'voice_first', name: 'Voice Explorer', desc: 'Complete first voice session', icon: '🎙️', xp: 50 },
  { id: 'empathy_70', name: 'Empathy Expert', desc: 'Reach 70+ empathy score', icon: '💚', xp: 100 },
  { id: 'lectures_5', name: 'Knowledge Seeker', desc: 'Study 5 lectures', icon: '📖', xp: 100 },
  { id: 'lectures_10', name: 'Scholar', desc: 'Study 10 lectures', icon: '🎓', xp: 200 },
]

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [showComingSoon, setShowComingSoon] = useState(false)

  // Gamification state
  const [xp, setXp] = useState(0)
  const [earnedAchievements, setEarnedAchievements] = useState<string[]>([])
  const [streak, setStreak] = useState({ current: 0, longest: 0 })
  const [todaysChallenges, setTodaysChallenges] = useState([
    { id: 'daily_quiz', name: 'Complete a Quiz', xp: 25, completed: false, icon: '📝' },
    { id: 'daily_voice', name: 'Voice Practice', xp: 30, completed: false, icon: '🎙️' },
    { id: 'daily_review', name: 'Review Topics', xp: 20, completed: false, icon: '📖' },
  ])

  // Stats
  const [stats, setStats] = useState({
    quizAverage: 0,
    quizzesCompleted: 0,
    lecturesCount: 0,
    voiceSessions: 0,
    empathyScore: 0,
    practiceHours: 0
  })
  const [recentFeedback, setRecentFeedback] = useState<any>(null)
  const [weakTopics, setWeakTopics] = useState<any[]>([])

  const level = useMemo(() => calculateLevel(xp), [xp])
  const progress = useMemo(() => xpProgress(xp), [xp])
  const xpToNext = useMemo(() => xpForNextLevel(level) - xp, [xp, level])

  // Check and unlock achievements
  const checkAchievements = (stats: any, streak: any) => {
    const unlocked: string[] = []
    if (stats.lecturesCount >= 1) unlocked.push('first_lecture')
    if (stats.lecturesCount >= 5) unlocked.push('lectures_5')
    if (stats.lecturesCount >= 10) unlocked.push('lectures_10')
    if (stats.voiceSessions >= 1) unlocked.push('voice_first')
    if (stats.empathyScore >= 70) unlocked.push('empathy_70')
    if (streak.current >= 3 || streak.longest >= 3) unlocked.push('streak_3')
    if (streak.current >= 7 || streak.longest >= 7) unlocked.push('streak_7')
    if (stats.quizzesCompleted >= 3 && stats.quizAverage >= 80) unlocked.push('quiz_master')
    return unlocked
  }

  // Calculate total XP
  const calculateTotalXP = (achievements: string[], stats: any) => {
    let total = 0
    achievements.forEach(id => {
      const ach = ACHIEVEMENTS.find(a => a.id === id)
      if (ach) total += ach.xp
    })
    total += stats.quizzesCompleted * 10
    total += stats.voiceSessions * 15
    total += stats.lecturesCount * 5
    return total
  }

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id || authLoading) return

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const headers = {
        'X-User-ID': user.id,
        'Authorization': `Bearer ${localStorage.getItem('curavoice_token')}`
      }

      try {
        const [statsRes, quizRes, insightsRes, lecturesRes, streakRes, feedbackRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/statistics/dashboard`, { headers }).catch(() => null),
          fetch(`${API_URL}/api/v1/statistics/quiz-summary`, { headers }).catch(() => null),
          fetch(`${API_URL}/api/v1/statistics/learning-insights`, { headers }).catch(() => null),
          fetch(`${API_URL}/api/v1/lectures`, { headers }).catch(() => null),
          fetch(`${API_URL}/api/v1/statistics/streak`, { headers }).catch(() => null),
          fetch(`${API_URL}/api/v1/statistics/recent-feedback`, { headers }).catch(() => null)
        ])

        let newStats = { ...stats }

        if (statsRes?.ok) {
          const data = await statsRes.json()
          newStats.empathyScore = data.empathy_score?.value || 0
          newStats.voiceSessions = data.total_sessions?.value || 0
          newStats.practiceHours = data.total_time?.value || 0
        }

        if (quizRes?.ok) {
          const data = await quizRes.json()
          if (data.has_history) {
            newStats.quizAverage = data.stats?.average_score || 0
            newStats.quizzesCompleted = data.stats?.total_attempts || 0
          }
        }

        if (lecturesRes?.ok) {
          const data = await lecturesRes.json()
          newStats.lecturesCount = data.length || 0
        }

        let newStreak = { current: 0, longest: 0 }
        if (streakRes?.ok) {
          const data = await streakRes.json()
          newStreak = { current: data.current_streak || 0, longest: data.longest_streak || 0 }
        }

        if (feedbackRes?.ok) {
          setRecentFeedback(await feedbackRes.json())
        }

        // Fetch weak topics from learning insights
        if (insightsRes?.ok) {
          const data = await insightsRes.json()
          if (data.weak_topics && data.weak_topics.length > 0) {
            setWeakTopics(data.weak_topics.slice(0, 3))
          }
        }

        setStats(newStats)
        setStreak(newStreak)

        const achievements = checkAchievements(newStats, newStreak)
        setEarnedAchievements(achievements)
        setXp(calculateTotalXP(achievements, newStats))

        setTodaysChallenges(prev => prev.map(c => ({
          ...c,
          completed: c.id === 'daily_quiz' ? newStats.quizzesCompleted > 0 :
            c.id === 'daily_voice' ? newStats.voiceSessions > 0 :
              c.id === 'daily_review' ? newStats.lecturesCount > 0 : false
        })))

      } catch (e) {
        console.error('Dashboard error:', e)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user, authLoading])

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
    if (trend === 'down') return <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
    return <Minus className="w-3 h-3 sm:w-4 sm:h-4 text-white/50" />
  }

  if (authLoading || isLoading) {
    return (
      <div className="dashboard-page-container">
        <DashboardNav />
        <EchoLoader context="dashboard" />
      </div>
    )
  }

  return (
    <div className="dashboard-page-container">
      <DashboardNav />

      {/* Welcome Section - Mobile optimized */}
      <div className="dashboard-welcome">
        <div className="dashboard-welcome-content">
          <h1 className="dashboard-welcome-title text-xl sm:text-2xl lg:text-4xl">
            Level {level} • {user?.full_name?.split(' ')[0] || 'Student'}
          </h1>
          <p className="dashboard-welcome-subtitle text-xs sm:text-sm lg:text-lg">
            {xpToNext} XP to Level {level + 1} • {earnedAchievements.length}/{ACHIEVEMENTS.length} Achievements
          </p>
        </div>
        {streak.current > 0 && (
          <div
            className="flex items-center gap-1.5 sm:gap-2 text-white font-montserrat font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm"
            style={{ background: 'linear-gradient(to right, #f97316, #ef4444)' }}
          >
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span className="whitespace-nowrap">{streak.current} Day Streak!</span>
          </div>
        )}
      </div>

      {/* XP Progress Bar - Mobile optimized */}
      <div className="w-full max-w-[1512px] mx-auto px-2 sm:px-4 lg:px-16 mb-4 sm:mb-6">
        <div
          className="p-3 sm:p-4 lg:p-6 rounded-2xl sm:rounded-[33px]"
          style={{
            backgroundColor: '#344895',
            border: '2px solid #3DD6D0',
            boxShadow: '0px 4px 15px 10px rgba(0,0,0,0.19)'
          }}
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-white font-montserrat font-bold text-sm sm:text-base lg:text-lg">Level {level} Progress</span>
            <span className="font-montserrat font-bold text-xs sm:text-sm" style={{ color: '#3DD6D0' }}>{xp} XP</span>
          </div>
          <div
            className="w-full h-3 sm:h-4 rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(to right, #3DD6D0, white)'
              }}
            />
          </div>
        </div>
      </div>

      {/* Daily Challenges - Mobile grid */}
      <div className="w-full max-w-[1512px] mx-auto px-2 sm:px-4 lg:px-16 mb-4 sm:mb-6">
        <div
          className="p-3 sm:p-4 lg:p-6 rounded-2xl sm:rounded-[33px]"
          style={{
            backgroundColor: 'white',
            border: '2px solid #3DD6D0',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
          }}
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Target className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#344895' }} />
              <h2 className="font-montserrat font-bold text-base sm:text-lg lg:text-xl" style={{ color: '#344895' }}>Daily Challenges</h2>
            </div>
            <span
              className="font-montserrat font-bold text-xs px-2 py-0.5 sm:px-3 sm:py-1 rounded-full"
              style={{ backgroundColor: '#3DD6D0', color: '#1A1F71' }}
            >
              {todaysChallenges.filter(c => c.completed).length}/{todaysChallenges.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            {todaysChallenges.map((challenge) => (
              <button
                key={challenge.id}
                onClick={() => {
                  if (challenge.id === 'daily_quiz') router.push('/upload')
                  else if (challenge.id === 'daily_voice') router.push('/training')
                  else router.push('/upload')
                }}
                className="p-2 sm:p-3 lg:p-4 rounded-xl sm:rounded-2xl text-center transition-all duration-200 active:scale-95"
                style={{
                  backgroundColor: challenge.completed ? '#f0fdf4' : '#f9fafb',
                  border: `2px solid ${challenge.completed ? '#86efac' : 'rgba(61,214,208,0.3)'}`,
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <div className="text-2xl sm:text-3xl lg:text-4xl mb-1 sm:mb-2">{challenge.icon}</div>
                <div className="font-montserrat font-bold text-xs sm:text-sm flex items-center justify-center gap-1" style={{ color: '#344895' }}>
                  <span className="hidden sm:inline">{challenge.name}</span>
                  <span className="sm:hidden">{challenge.name.split(' ')[0]}</span>
                  {challenge.completed && <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />}
                </div>
                <div className="flex items-center justify-center gap-0.5 sm:gap-1 mt-1">
                  <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500" />
                  <span className="text-xs text-amber-600 font-bold">+{challenge.xp}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid - Mobile 2x2 */}
      <div className="stats-grid">
        {/* Quiz Average */}
        <div className="stat-card stat-card-interactive" onClick={() => router.push('/upload')}>
          <div className="stat-card-header">
            <h3 className="stat-card-title text-xs sm:text-sm lg:text-lg">Quiz Average</h3>
            <div className="stat-card-trend">
              {getTrendIcon(stats.quizAverage >= 70 ? 'up' : 'neutral')}
            </div>
          </div>
          <div className="stat-card-content">
            <div className="stat-card-icon">
              <Image src="/assets/pill-icon.svg" alt="" width={78} height={76} className="w-full h-auto" />
            </div>
            <div className="flex flex-col items-start">
              <div className="stat-card-value text-2xl sm:text-4xl lg:text-6xl">{stats.quizAverage}%</div>
              <div className="stat-card-progress">
                <div className="stat-card-progress-bar" style={{ width: `${stats.quizAverage}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Lectures Studied */}
        <div className="stat-card stat-card-interactive" onClick={() => router.push('/upload')}>
          <div className="stat-card-header">
            <h3 className="stat-card-title text-xs sm:text-sm lg:text-lg">Lectures</h3>
          </div>
          <div className="stat-card-content">
            <div className="stat-card-icon">
              <Image src="/assets/graph-icon.svg" alt="" width={78} height={76} className="w-full h-auto" />
            </div>
            <div className="stat-card-value text-2xl sm:text-4xl lg:text-6xl">{stats.lecturesCount}</div>
          </div>
        </div>

        {/* Empathy Score */}
        <div className="stat-card stat-card-interactive" onClick={() => router.push('/training')}>
          <div className="stat-card-header">
            <h3 className="stat-card-title text-xs sm:text-sm lg:text-lg">Empathy</h3>
            <div className="stat-card-trend">
              {getTrendIcon(stats.empathyScore >= 70 ? 'up' : 'neutral')}
            </div>
          </div>
          <div className="stat-card-content">
            <div className="stat-card-icon">
              <Image src="/assets/pill-icon.svg" alt="" width={78} height={76} className="w-full h-auto" />
            </div>
            <div className="flex flex-col items-start">
              <div className="stat-card-value text-2xl sm:text-4xl lg:text-6xl">{stats.empathyScore}</div>
              <div className="stat-card-progress">
                <div className="stat-card-progress-bar" style={{ width: `${stats.empathyScore}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Practice Time */}
        <div className="stat-card stat-card-interactive" onClick={() => router.push('/training')}>
          <div className="stat-card-header">
            <h3 className="stat-card-title text-xs sm:text-sm lg:text-lg">Practice</h3>
          </div>
          <div className="stat-card-content">
            <div className="stat-card-icon">
              <Image src="/assets/clock-icon.svg" alt="" width={68} height={68} className="w-full h-auto" />
            </div>
            <div className="flex flex-col items-start">
              <div className="stat-card-value text-2xl sm:text-4xl lg:text-6xl">{stats.practiceHours}</div>
              <div className="stat-card-unit text-xs sm:text-base lg:text-2xl">hrs</div>
            </div>
          </div>
        </div>
      </div>

      {/* Focus Areas - Weak Topics with Practice Button */}
      {weakTopics.length > 0 && (
        <div className="w-full max-w-[1512px] mx-auto px-2 sm:px-4 lg:px-16 mt-4 sm:mt-6">
          <div
            className="p-3 sm:p-4 lg:p-6 rounded-2xl sm:rounded-[33px]"
            style={{
              backgroundColor: 'white',
              border: '2px solid #3DD6D0',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
            }}
          >
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Target className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#344895' }} />
                <h2 className="font-montserrat font-bold text-base sm:text-lg lg:text-xl" style={{ color: '#344895' }}>
                  Focus Areas
                </h2>
              </div>
              <span className="text-xs sm:text-sm text-gray-500 font-lato">
                Based on quiz performance
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {weakTopics.map((topic) => (
                <div
                  key={topic.lecture_id}
                  className="p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all"
                  style={{
                    background: topic.priority === 'high'
                      ? 'linear-gradient(to bottom right, #fef2f2, #fee2e2)'
                      : topic.priority === 'medium'
                        ? 'linear-gradient(to bottom right, #fffbeb, #fef3c7)'
                        : 'linear-gradient(to bottom right, #f0fdf4, #dcfce7)',
                    border: `2px solid ${topic.priority === 'high' ? '#fca5a5' : topic.priority === 'medium' ? '#fcd34d' : '#86efac'}`
                  }}
                >
                  {/* Priority Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: topic.priority === 'high' ? '#fecaca' : topic.priority === 'medium' ? '#fde68a' : '#bbf7d0',
                        color: topic.priority === 'high' ? '#b91c1c' : topic.priority === 'medium' ? '#b45309' : '#15803d'
                      }}
                    >
                      {topic.priority === 'high' ? '🔴 Needs Work' : topic.priority === 'medium' ? '🟡 Review' : '🟢 Almost There'}
                    </span>
                    <span className="text-sm font-bold" style={{ color: '#344895' }}>
                      {topic.average_score}%
                    </span>
                  </div>

                  {/* Lecture Title */}
                  <h3 className="font-montserrat font-bold text-sm sm:text-base mb-2 truncate" style={{ color: '#344895' }}>
                    {topic.lecture_title}
                  </h3>

                  {/* Missed Concepts */}
                  {topic.missed_concepts && topic.missed_concepts.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 font-lato mb-1">Weak areas:</p>
                      <div className="flex flex-wrap gap-1">
                        {topic.missed_concepts.slice(0, 3).map((concept: string, idx: number) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
                          >
                            {concept}
                          </span>
                        ))}
                        {topic.missed_concepts.length > 3 && (
                          <span className="text-xs text-gray-400">+{topic.missed_concepts.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Practice Now Button */}
                  <button
                    onClick={() => router.push(`/artifacts/${topic.lecture_id}?tab=quiz`)}
                    className="w-full py-2 rounded-lg font-montserrat font-bold text-sm text-white transition-all active:scale-95"
                    style={{
                      backgroundColor: '#344895',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  >
                    Practice Now →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Achievements - Mobile 2 columns */}
      <div className="w-full max-w-[1512px] mx-auto px-2 sm:px-4 lg:px-16 mt-4 sm:mt-6">
        <div
          className="p-3 sm:p-4 lg:p-6 rounded-2xl sm:rounded-[33px]"
          style={{
            backgroundColor: 'white',
            border: '2px solid #3DD6D0',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
          }}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
            <h2 className="font-montserrat font-bold text-base sm:text-lg lg:text-xl" style={{ color: '#344895' }}>Achievements</h2>
            <span
              className="font-montserrat font-bold text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: '#3DD6D0', color: '#1A1F71' }}
            >
              {earnedAchievements.length}/{ACHIEVEMENTS.length}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            {ACHIEVEMENTS.map((ach) => {
              const isUnlocked = earnedAchievements.includes(ach.id)
              return (
                <div
                  key={ach.id}
                  className="relative p-2 sm:p-3 lg:p-4 rounded-xl sm:rounded-2xl text-center transition-all"
                  style={{
                    background: isUnlocked
                      ? 'linear-gradient(to bottom right, #fffbeb, #fef3c7)'
                      : '#f3f4f6',
                    border: `2px solid ${isUnlocked ? '#3DD6D0' : '#e5e7eb'}`,
                    opacity: isUnlocked ? 1 : 0.6
                  }}
                >
                  <div className="text-2xl sm:text-3xl lg:text-4xl mb-1 sm:mb-2">{ach.icon}</div>
                  <h3 className="font-montserrat font-bold text-xs sm:text-sm" style={{ color: '#344895' }}>{ach.name}</h3>
                  <p className="text-gray-500 text-xs mt-0.5 sm:mt-1 font-lato hidden sm:block leading-tight">{ach.desc}</p>
                  <div className="flex items-center justify-center gap-0.5 sm:gap-1 mt-1 sm:mt-2">
                    <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500" />
                    <span className="text-xs text-amber-600 font-bold">+{ach.xp}</span>
                  </div>
                  {!isUnlocked && (
                    <div
                      className="absolute inset-0 flex items-center justify-center rounded-xl sm:rounded-2xl"
                      style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
                    >
                      <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom: Feedback + Streak */}
      <div className="content-grid">
        <div className="content-grid-left">
          <div className="feedback-card">
            <div className="feedback-header">
              <h2 className="feedback-title text-base sm:text-xl lg:text-2xl">Recent Feedback</h2>
            </div>
            {recentFeedback?.has_feedback ? (
              <>
                <p className="feedback-text text-sm sm:text-base lg:text-xl">{recentFeedback.feedback_summary || 'Great session!'}</p>
                <div className="feedback-actions">
                  <button onClick={() => setShowComingSoon(true)} className="feedback-action-button text-xs sm:text-sm">
                    View Report
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="feedback-text text-sm sm:text-base lg:text-xl">Complete a training session to get feedback!</p>
                <div className="feedback-actions">
                  <button onClick={() => router.push('/training')} className="feedback-action-button text-xs sm:text-sm">
                    Start Training
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="content-grid-right">
          <div className="streak-card">
            <div className="streak-flame-container">
              <Image src="/assets/flame-icon.svg" alt="" width={97} height={130} className="streak-flame w-16 h-20 sm:w-20 sm:h-24 lg:w-24 lg:h-32" />
              <div className="streak-glow" />
            </div>
            <h3 className="streak-title text-lg sm:text-xl lg:text-3xl">Current Streak</h3>
            <div className="streak-value-container">
              <div className="streak-value text-4xl sm:text-5xl lg:text-7xl">{streak.current}</div>
              <div className="streak-unit text-sm sm:text-lg lg:text-2xl">days</div>
            </div>
            <div className="streak-info">
              <p className="streak-info-text text-sm sm:text-base">{streak.current > 0 ? "🔥 Keep it up!" : "Start training!"}</p>
              <p className="streak-info-subtext text-xs sm:text-sm">Longest: {streak.longest} days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Modal - Touch friendly */}
      {showComingSoon && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowComingSoon(false)}
        >
          <div
            className="w-full max-w-md p-6 sm:p-8 relative rounded-2xl sm:rounded-[33px]"
            style={{ backgroundColor: 'white' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowComingSoon(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 text-gray-400 active:text-gray-600"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center">
              <div className="text-5xl sm:text-6xl mb-4">🚀</div>
              <h2 className="text-xl sm:text-2xl font-montserrat font-bold mb-2" style={{ color: '#344895' }}>Coming Soon</h2>
              <p className="text-gray-600 font-lato mb-6 text-sm sm:text-base">Full reports are under development!</p>
              <button
                onClick={() => setShowComingSoon(false)}
                className="font-montserrat font-bold px-6 py-2 rounded-full text-white text-sm sm:text-base active:scale-95 transition-transform"
                style={{ backgroundColor: '#344895', WebkitTapHighlightColor: 'transparent' }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
