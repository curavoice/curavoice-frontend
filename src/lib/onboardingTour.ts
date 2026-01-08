export type OnboardingTourStatus = 'not_started' | 'active' | 'dismissed' | 'completed'

export interface OnboardingTourState {
  version: 1
  status: OnboardingTourStatus
  step_index: number
  started_at: string | null
  updated_at: string | null
}

const STORAGE_KEY = 'curavoice:onboarding_tour:v1'
const EVENT_NAME = 'curavoice:onboarding_tour_state'

export function defaultOnboardingTourState(): OnboardingTourState {
  return {
    version: 1,
    status: 'not_started',
    step_index: 0,
    started_at: null,
    updated_at: null,
  }
}

function normalizeState(value: unknown): OnboardingTourState | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<OnboardingTourState>

  const status: OnboardingTourStatus =
    v.status === 'active' || v.status === 'dismissed' || v.status === 'completed' || v.status === 'not_started'
      ? v.status
      : 'not_started'

  const stepIndex = Number.isFinite(v.step_index as number) ? Math.max(0, (v.step_index as number) | 0) : 0

  const startedAt = typeof v.started_at === 'string' || v.started_at === null ? v.started_at : null
  const updatedAt = typeof v.updated_at === 'string' || v.updated_at === null ? v.updated_at : null

  return {
    version: 1,
    status,
    step_index: stepIndex,
    started_at: startedAt,
    updated_at: updatedAt,
  }
}

export function getOnboardingTourState(): OnboardingTourState {
  if (typeof window === 'undefined') return defaultOnboardingTourState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultOnboardingTourState()
    const parsed = JSON.parse(raw)
    return normalizeState(parsed) ?? defaultOnboardingTourState()
  } catch {
    return defaultOnboardingTourState()
  }
}

function emitState(state: OnboardingTourState) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: state }))
}

export function setOnboardingTourState(state: OnboardingTourState): OnboardingTourState {
  if (typeof window === 'undefined') return state
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  emitState(state)
  return state
}

export function startOnboardingTour(stepIndex = 0): OnboardingTourState {
  const prev = getOnboardingTourState()
  const now = new Date().toISOString()
  const next: OnboardingTourState = {
    version: 1,
    status: 'active',
    step_index: Math.max(0, stepIndex | 0),
    started_at: prev.started_at ?? now,
    updated_at: now,
  }
  return setOnboardingTourState(next)
}

export function setOnboardingTourStep(stepIndex: number): OnboardingTourState {
  const prev = getOnboardingTourState()
  if (prev.status !== 'active') return prev
  const now = new Date().toISOString()
  const next: OnboardingTourState = {
    ...prev,
    step_index: Math.max(0, stepIndex | 0),
    updated_at: now,
  }
  return setOnboardingTourState(next)
}

export function dismissOnboardingTour(): OnboardingTourState {
  const prev = getOnboardingTourState()
  const now = new Date().toISOString()
  const next: OnboardingTourState = {
    ...prev,
    status: 'dismissed',
    updated_at: now,
  }
  return setOnboardingTourState(next)
}

export function completeOnboardingTour(): OnboardingTourState {
  const prev = getOnboardingTourState()
  const now = new Date().toISOString()
  const next: OnboardingTourState = {
    ...prev,
    status: 'completed',
    updated_at: now,
  }
  return setOnboardingTourState(next)
}

export function resetOnboardingTour(): OnboardingTourState {
  const next = defaultOnboardingTourState()
  return setOnboardingTourState(next)
}

export function getOnboardingTourEventName(): string {
  return EVENT_NAME
}
