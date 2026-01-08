'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

import { apiClient } from '@/lib/api'
import {
  completeOnboardingTour,
  dismissOnboardingTour,
  getOnboardingTourEventName,
  getOnboardingTourState,
  setOnboardingTourStep,
  startOnboardingTour,
  type OnboardingTourState,
} from '@/lib/onboardingTour'
import { isFeatureEnabled } from '@/lib/featureFlags'

type PathMatchMode = 'any' | 'equals' | 'startsWith'

type StepAdvance =
  | { type: 'click'; selector?: string }
  | { type: 'change'; selector: string }
  | { type: 'route'; path: string; match?: PathMatchMode }
  | { type: 'manual' }

interface TourStep {
  id: string
  title: string
  description: string
  route: { path: string; match?: PathMatchMode }
  target: string
  advance: StepAdvance
}

type HighlightRect = { top: number; left: number; width: number; height: number }

function matchPathname(pathname: string, expected: string, mode: PathMatchMode = 'equals') {
  if (mode === 'any') return true
  if (mode === 'startsWith') return pathname === expected || pathname.startsWith(`${expected}/`)
  return pathname === expected
}

function isElementVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  return true
}

function findVisibleTarget(selector: string): HTMLElement | null {
  const matches = Array.from(document.querySelectorAll<HTMLElement>(selector))
  let best: { el: HTMLElement; area: number } | null = null
  for (const el of matches) {
    if (!isElementVisible(el)) continue
    const rect = el.getBoundingClientRect()
    const area = rect.width * rect.height
    if (!best || area > best.area) best = { el, area }
  }
  return best?.el ?? null
}

const STEPS: TourStep[] = [
  {
    id: 'nav_library',
    title: 'Library',
    description: 'Upload lectures and access study materials. Use Library to manage what you study.',
    route: { path: '*', match: 'any' },
    target: '[data-tour="nav-library"]',
    advance: { type: 'click' },
  },
  {
    id: 'nav_naplex',
    title: 'NAPLEX Prep',
    description: 'Adaptive quizzes, timed exams, Top 200 deck, and readiness analytics live here.',
    route: { path: '*', match: 'any' },
    target: '[data-tour="nav-naplex"]',
    advance: { type: 'click' },
  },
  {
    id: 'nav_training',
    title: 'Training',
    description: 'Voice patient simulations to practice counseling and communication skills.',
    route: { path: '*', match: 'any' },
    target: '[data-tour="nav-training"]',
    advance: { type: 'click' },
  },
  {
    id: 'nav_dashboard',
    title: 'Dashboard',
    description: 'Your progress and daily activity live here.',
    route: { path: '*', match: 'any' },
    target: '[data-tour="nav-dashboard"]',
    advance: { type: 'click' },
  },
  {
    id: 'nav_profile',
    title: 'Profile',
    description: 'Manage your account details and preferences.',
    route: { path: '*', match: 'any' },
    target: '[data-tour="nav-profile"]',
    advance: { type: 'click' },
  },
]

export default function OnboardingTour() {
  const pathname = usePathname()
  const isComingSoon = isFeatureEnabled('naplexComingSoon')

  const [tourState, setTourState] = useState<OnboardingTourState | null>(null)
  const [highlight, setHighlight] = useState<HighlightRect | null>(null)

  const initializedRef = useRef(false)

  // Filter out NAPLEX step if Coming Soon mode is active
  const filteredSteps = useMemo(() => {
    return isComingSoon ? STEPS.filter(step => step.id !== 'nav_naplex') : STEPS
  }, [isComingSoon])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    setTourState(getOnboardingTourState())
  }, [])

  useEffect(() => {
    const eventName = getOnboardingTourEventName()
    const refresh = () => setTourState(getOnboardingTourState())

    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as OnboardingTourState | undefined
      if (detail) setTourState(detail)
      else refresh()
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'curavoice:onboarding_tour:v1') refresh()
    }

    window.addEventListener(eventName, onCustom)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(eventName, onCustom)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const isAuthenticated = useMemo(() => Boolean(apiClient.getToken()), [pathname])

  useEffect(() => {
    if (!tourState) return
    if (tourState.status !== 'not_started') return
    if (!isAuthenticated) return
    if (pathname.startsWith('/auth')) return

    const user = apiClient.getUser()
    const createdAt = user?.created_at
    if (createdAt) {
      const createdMs = Date.parse(createdAt)
      if (!Number.isNaN(createdMs)) {
        const ageDays = (Date.now() - createdMs) / (1000 * 60 * 60 * 24)
        if (ageDays > 14) return
      }
    }

    setTourState(startOnboardingTour(0))
  }, [isAuthenticated, pathname, tourState])

  const isActive = tourState?.status === 'active' && isAuthenticated

  const stepIndex = useMemo(() => {
    if (!tourState) return 0
    return Math.max(0, Math.min(tourState.step_index, filteredSteps.length - 1))
  }, [tourState, filteredSteps.length])

  const step = useMemo(() => filteredSteps[stepIndex], [stepIndex, filteredSteps])
  const isOnStepRoute = matchPathname(pathname, step.route.path, step.route.match ?? 'equals')

  const goToStep = (nextIndex: number) => {
    if (!tourState || tourState.status !== 'active') return
    const clamped = Math.max(0, Math.min(nextIndex, filteredSteps.length - 1))
    setTourState(setOnboardingTourStep(clamped))
  }

  const finish = () => setTourState(completeOnboardingTour())
  const dismiss = () => setTourState(dismissOnboardingTour())

  const next = () => {
    if (!tourState || tourState.status !== 'active') return
    const nextIndex = tourState.step_index + 1
    if (nextIndex >= filteredSteps.length) finish()
    else setTourState(setOnboardingTourStep(nextIndex))
  }

  const back = () => goToStep(stepIndex - 1)

  useEffect(() => {
    if (!isActive) return
    if (tourState.step_index >= filteredSteps.length) {
      setTourState(completeOnboardingTour())
    }
  }, [isActive, tourState?.step_index, filteredSteps.length])

  useEffect(() => {
    if (!isActive) return
    const current = filteredSteps[stepIndex]
    if (current.advance.type !== 'route') return
    if (matchPathname(pathname, current.advance.path, current.advance.match ?? 'startsWith')) {
      next()
    }
  }, [isActive, pathname, stepIndex, filteredSteps])

  useEffect(() => {
    if (!isActive) return
    if (!isOnStepRoute) {
      setHighlight(null)
      return
    }

    let raf = 0

    const update = () => {
      const el = findVisibleTarget(step.target)
      if (!el) {
        setHighlight(null)
        return
      }

      const rect = el.getBoundingClientRect()
      const pad = 10
      const top = Math.max(8, rect.top - pad)
      const left = Math.max(8, rect.left - pad)
      const width = Math.min(window.innerWidth - left - 8, rect.width + pad * 2)
      const height = Math.min(window.innerHeight - top - 8, rect.height + pad * 2)

      setHighlight({ top, left, width, height })
    }

    const schedule = () => {
      window.cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(update)
    }

    const initialEl = findVisibleTarget(step.target)
    if (initialEl) {
      try {
        initialEl.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
      } catch {
        // ignore scroll errors
      }
    }

    schedule()
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [isActive, isOnStepRoute, step.target, stepIndex])

  useEffect(() => {
    if (!isActive) return
    if (!isOnStepRoute) return

    const current = filteredSteps[stepIndex]
    if (current.advance.type !== 'click' && current.advance.type !== 'change') return

    const selector = current.advance.type === 'change' ? current.advance.selector : current.advance.selector ?? current.target
    const target = findVisibleTarget(selector)
    if (!target) return

    const handler = () => next()
    const eventName = current.advance.type === 'change' ? 'change' : 'click'
    target.addEventListener(eventName, handler)
    return () => target.removeEventListener(eventName, handler)
  }, [isActive, isOnStepRoute, stepIndex, filteredSteps])

  useEffect(() => {
    if (!isActive) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isActive])

  if (!isActive) return null

  const progress = `${stepIndex + 1} / ${filteredSteps.length}`

  return (
    <div className="fixed inset-0 z-[1000] pointer-events-none">
      {highlight && (
        <div
          className="fixed rounded-2xl border-[3px] border-[#3DD6D0] shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] transition-all duration-150"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}

      <div className="fixed left-3 right-3 bottom-4 sm:left-6 sm:right-auto sm:bottom-6 sm:w-[440px] pointer-events-auto">
        <div className="bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-4 sm:p-5 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-montserrat font-bold text-[#344895]">Walkthrough • {progress}</div>
              <div className="mt-1 text-base sm:text-lg font-montserrat font-extrabold text-[#1A1F71]">
                {step.title}
              </div>
              <div className="mt-1 text-sm font-lato text-gray-700">{step.description}</div>

              <div className="mt-3 rounded-2xl border-2 border-[#344895]/20 bg-[#344895]/5 px-3 py-2 text-sm font-lato text-gray-700">
                Use the highlighted navbar item to continue.
              </div>
            </div>

            <button
              type="button"
              onClick={dismiss}
              className="h-9 w-9 flex items-center justify-center rounded-full border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white transition-colors"
              aria-label="Skip walkthrough"
            >
              ×
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={back}
              disabled={stepIndex === 0}
              className="rounded-full px-4 py-2 border-2 border-[#344895] text-[#344895] font-montserrat font-bold hover:bg-[#344895] hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#344895]"
            >
              Back
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={next}
                className="rounded-full px-4 py-2 bg-[#344895] text-white font-montserrat font-bold hover:bg-[#1A1F71] transition-colors"
              >
                {stepIndex === filteredSteps.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>

          {highlight && <div className="mt-3 text-xs font-lato text-gray-500">Tip: click the highlighted item to continue.</div>}
        </div>
      </div>
    </div>
  )
}
