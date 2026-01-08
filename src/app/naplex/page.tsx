'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { BarChart3, ClipboardList, Layers, Timer } from 'lucide-react'

import { useToast } from '@/hooks/use-toast'
import {
  getNaplexAnalytics,
  type NaplexAnalyticsResponse,
} from '@/lib/naplexApi'

export default function NaplexHomePage() {
  const { toast } = useToast()
  const [analytics, setAnalytics] = useState<NaplexAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setAnalytics(await getNaplexAnalytics())
      } catch (e: any) {
        toast({
          title: 'NAPLEX Prep',
          description: e?.message || 'Failed to load analytics',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [toast])

  // Calculate values for rendering
  const readiness = analytics?.readiness_score ?? 0
  const band = analytics?.band ?? 'low'
  const accuracy = Math.round((analytics?.accuracy ?? 0) * 100)
  const attempts = analytics?.total_attempts ?? 0

  // Always call useMemo before any conditional returns (Rules of Hooks)
  const dailyPlan = useMemo(() => {
    if (!analytics || loading) {
      return {
        title: 'Today\'s plan',
        subtitle: 'Pick one to start; we\'ll adapt as you go.',
        bullets: ['10-question adaptive quiz', '10-card Top 200 review', 'Optional: timed mini set'],
      }
    }

    if (attempts === 0) {
      return {
        title: 'Start strong (first session)',
        subtitle: 'Do these once to calibrate your readiness.',
        bullets: ['10-question adaptive quiz', '10-card Top 200 review', 'Finish by checking Analytics'],
      }
    }

    if (band === 'high') {
      return {
        title: 'Maintain momentum',
        subtitle: 'Short reps to keep recall sharp.',
        bullets: ['10-question adaptive quiz', '10-card Top 200 review', 'Target one weak domain in Analytics'],
      }
    }

    if (band === 'medium') {
      return {
        title: 'Build accuracy',
        subtitle: 'Mix practice + timing to improve consistency.',
        bullets: ['15-question adaptive quiz', '10-card Top 200 review', '25-question timed mini exam'],
      }
    }

    return {
      title: 'Close gaps fast',
      subtitle: 'High-yield reps + calculations to raise your baseline.',
      bullets: ['10-question adaptive quiz', '10-card Top 200 review', '25-question timed mini exam'],
    }
  }, [analytics, attempts, band, loading])

  // Early return for loading state (after all hooks have been called)
  if (loading && !analytics) {
    return (
      <div className="pt-2">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-montserrat font-bold text-[#344895]">NAPLEX Prep</h1>
        <p className="mt-2 text-sm font-lato text-gray-600">Loading...</p>
      </div>
    )
  }

  return (
    <div className="pt-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-montserrat font-bold text-[#344895]">
            NAPLEX Prep
          </h1>
          <p className="mt-1 text-sm sm:text-base font-lato text-gray-700">
            Practice quizzes, timed exam mode, Top 200 deck, and readiness analytics.
          </p>
        </div>
        <Link
          href="/naplex/practice"
          className="inline-flex items-center justify-center rounded-full px-5 py-3 font-montserrat font-bold text-white bg-gradient-to-r from-[#344895] to-[#1A1F71] hover:from-[#1A1F71] hover:to-[#344895] transition-all shadow"
        >
          Start Practice
        </Link>
      </div>

      <div className="mt-6 bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-montserrat font-bold text-black">{dailyPlan.title}</h2>
            <p className="mt-1 text-sm font-lato text-gray-700">{dailyPlan.subtitle}</p>
          </div>
          <div className="inline-flex items-center rounded-full border-2 border-[#344895] bg-white px-4 py-2 font-montserrat font-bold text-[#344895]">
            Band: {loading && !analytics ? '-' : band}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <Link
            href="/naplex/practice"
            data-tour="naplex-adaptive-quiz"
            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 font-montserrat font-bold bg-gradient-to-r from-[#344895] to-[#1A1F71] text-white hover:opacity-95 transition-all shadow"
          >
            <ClipboardList className="h-4 w-4" />
            Adaptive Quiz
          </Link>
          <Link
            href="/naplex/decks"
            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 font-montserrat font-bold bg-white border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white transition-colors"
          >
            <Layers className="h-4 w-4" />
            Deck Review
          </Link>
          <Link
            href="/naplex/exam"
            className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 font-montserrat font-bold bg-white border-2 border-[#3DD6D0] text-[#1A1F71] hover:bg-[#3DD6D0]/20 transition-colors"
          >
            <Timer className="h-4 w-4" />
            Timed Exam
          </Link>
        </div>

        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm font-lato text-gray-700">
          {dailyPlan.bullets.map((b) => (
            <li key={b} className="rounded-2xl border-2 border-gray-200 bg-white px-4 py-3">
              {b}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#344895]" />
            <h2 className="font-montserrat font-bold text-lg text-black">Readiness</h2>
          </div>

          <div className="mt-4 flex items-end justify-between">
            <div>
              <div className="text-4xl font-montserrat font-extrabold text-[#1A1F71]">
                {loading ? '-' : readiness.toFixed(1)}
              </div>
              <div className="mt-1 text-sm font-lato text-gray-600">
                Band: <span className="font-bold text-black">{band}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-lato text-gray-600">Accuracy</div>
              <div className="text-2xl font-montserrat font-bold text-[#344895]">
                {loading ? '-' : `${accuracy}%`}
              </div>
              <div className="text-xs font-lato text-gray-500">
                {loading ? '' : `${attempts} attempts (30d)`}
              </div>
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#3DD6D0] to-[#344895] transition-all"
              style={{ width: `${Math.min(100, Math.max(0, readiness))}%` }}
            />
          </div>

          <Link
            href="/naplex/analytics"
            className="mt-5 inline-flex items-center gap-2 text-sm font-montserrat font-bold text-[#1A1F71] hover:text-[#344895]"
          >
            View details
          </Link>
        </div>

        <div className="bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#344895]" />
            <h2 className="font-montserrat font-bold text-lg text-black">Quizzes</h2>
          </div>
          <p className="mt-2 text-sm font-lato text-gray-700">
            Generate NAPLEX-style quizzes. Choose template (Top 200) or AI mode grounded in your lecture content.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/naplex/practice"
              className="flex-1 text-center rounded-full px-4 py-3 font-montserrat font-bold bg-[#344895] text-white hover:bg-[#1A1F71] transition-colors"
            >
              Practice Quiz
            </Link>
            <Link
              href="/naplex/exam"
              className="flex-1 text-center rounded-full px-4 py-3 font-montserrat font-bold bg-white border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white transition-colors"
            >
              Timed Exam
            </Link>
          </div>
        </div>

        <div className="bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#344895]" />
            <h2 className="font-montserrat font-bold text-lg text-black">Top 200 Deck</h2>
          </div>
          <p className="mt-2 text-sm font-lato text-gray-700">
            Spaced repetition reviews to lock in brand/generic recall.
          </p>
          <div className="mt-4 flex items-center justify-between">
            <Link
              href="/naplex/decks"
              className="inline-flex items-center gap-2 rounded-full px-4 py-3 font-montserrat font-bold bg-gradient-to-r from-[#3DD6D0] to-[#344895] text-white hover:opacity-95 transition-all shadow"
            >
              <Timer className="h-4 w-4" />
              Review Now
            </Link>
            <div className="text-right text-xs font-lato text-gray-500">
              Start with 10-15 min/day
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
