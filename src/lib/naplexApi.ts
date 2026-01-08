/**
 * NAPLEX Prep API Service
 * Thin client for /api/v1/naplex endpoints.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')
const API_V1_BASE = `${API_BASE}/api/v1`

async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAuthToken()
  const url = `${API_V1_BASE}${path}`
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers || {}),
  }

  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const data = await res.json()
      detail = data?.detail || data?.message || detail
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  return res.json()
}

export interface NaplexOnboardingRequest {
  exam_date?: string | null
  daily_minutes?: number
}

export interface NaplexOnboardingResponse {
  user_id: string
  exam_date?: string | null
  daily_minutes: number
  updated_at: string
}

export interface NaplexDeckInfo {
  deck_id: string
  title: string
  total_cards: number
}

export interface NaplexDeckListResponse {
  decks: NaplexDeckInfo[]
}

export interface NaplexDeckCard {
  id: string
  front: string
  back: string
  tags: string[]
}

export interface NaplexNextCardResponse {
  deck_id: string
  due_count: number
  new_count: number
  card: NaplexDeckCard | null
  due_at?: string | null
}

export type NaplexReviewRating = 'again' | 'hard' | 'good' | 'easy'

export interface NaplexReviewRequest {
  rating: NaplexReviewRating
}

export interface NaplexReviewResponse {
  deck_id: string
  card_id: string
  next_due_at: string
  interval_days: number
  ease_factor: number
  repetitions: number
}

export interface NaplexQuestion {
  id: string
  question: string
  question_type: string
  options: string[]
  tags: string[]
  difficulty: string
}

export type NaplexSessionType = 'quiz' | 'exam'

export interface NaplexSessionResponse {
  id: string
  session_type: NaplexSessionType
  status: string
  created_at: string
  started_at?: string | null
  duration_seconds?: number | null
  total_questions: number
  questions: NaplexQuestion[]
  settings: Record<string, unknown>
}

export type NaplexGenerationMode = 'template' | 'adaptive' | 'ai'

export interface NaplexSessionCreateRequest {
  session_type?: NaplexSessionType
  num_questions?: number
  topics?: string[]
  timed?: boolean
  duration_seconds?: number | null
  generation_mode?: NaplexGenerationMode
  source_lecture_id?: string | null
  deck_id?: string | null
}

export interface NaplexAnswerRequest {
  question_id: string
  answer: string
  confidence?: number | null
  rationale_transcript?: string | null
}

export interface NaplexAnswerResponse {
  recorded: boolean
  session_id: string
  question_id: string
  is_correct?: boolean | null
  correct_answer?: string | null
  explanation?: string | null
  status: string
}

export interface NaplexSubmitResponse {
  session_id: string
  status: string
  score: number
  total: number
  percentage: number
}

export interface NaplexAnalyticsTopicBreakdown {
  topic: string
  attempts: number
  correct: number
  accuracy: number
}

export interface NaplexAnalyticsDomainBreakdown {
  domain_id: number
  domain: string
  attempts: number
  correct: number
  accuracy: number
}

export interface NaplexAnalyticsSubdomainBreakdown {
  subdomain_code: string
  subdomain: string
  attempts: number
  correct: number
  accuracy: number
}

export interface NaplexAnalyticsModuleBreakdown {
  module: string
  attempts: number
  correct: number
  accuracy: number
}

export interface NaplexAnalyticsResponse {
  readiness_score: number
  band: 'low' | 'medium' | 'high' | string
  total_attempts: number
  accuracy: number
  topics: NaplexAnalyticsTopicBreakdown[]
  domains?: NaplexAnalyticsDomainBreakdown[]
  subdomains?: NaplexAnalyticsSubdomainBreakdown[]
  modules?: NaplexAnalyticsModuleBreakdown[]
}

export async function naplexOnboarding(request: NaplexOnboardingRequest): Promise<NaplexOnboardingResponse> {
  return requestJson<NaplexOnboardingResponse>('/naplex/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      exam_date: request.exam_date ?? null,
      daily_minutes: request.daily_minutes ?? 20,
    }),
  })
}

export async function listNaplexDecks(): Promise<NaplexDeckListResponse> {
  return requestJson<NaplexDeckListResponse>('/naplex/decks')
}

export async function getNextNaplexCard(deckId: string): Promise<NaplexNextCardResponse> {
  return requestJson<NaplexNextCardResponse>(`/naplex/decks/${encodeURIComponent(deckId)}/next`)
}

export async function reviewNaplexCard(
  deckId: string,
  cardId: string,
  request: NaplexReviewRequest
): Promise<NaplexReviewResponse> {
  return requestJson<NaplexReviewResponse>(
    `/naplex/decks/${encodeURIComponent(deckId)}/cards/${encodeURIComponent(cardId)}/review`,
    { method: 'POST', body: JSON.stringify(request) }
  )
}

export async function createNaplexSession(request: NaplexSessionCreateRequest): Promise<NaplexSessionResponse> {
  return requestJson<NaplexSessionResponse>('/naplex/sessions', {
    method: 'POST',
    body: JSON.stringify({
      session_type: request.session_type ?? 'quiz',
      num_questions: request.num_questions ?? 10,
      topics: request.topics ?? [],
      timed: request.timed ?? false,
      duration_seconds: request.duration_seconds ?? null,
      generation_mode: request.generation_mode ?? 'template',
      source_lecture_id: request.source_lecture_id ?? null,
      deck_id: request.deck_id ?? 'top200',
    }),
  })
}

export async function getNaplexSession(sessionId: string): Promise<NaplexSessionResponse> {
  return requestJson<NaplexSessionResponse>(`/naplex/sessions/${encodeURIComponent(sessionId)}`)
}

export async function answerNaplexQuestion(
  sessionId: string,
  request: NaplexAnswerRequest
): Promise<NaplexAnswerResponse> {
  return requestJson<NaplexAnswerResponse>(`/naplex/sessions/${encodeURIComponent(sessionId)}/answer`, {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export async function submitNaplexSession(sessionId: string): Promise<NaplexSubmitResponse> {
  return requestJson<NaplexSubmitResponse>(`/naplex/sessions/${encodeURIComponent(sessionId)}/submit`, {
    method: 'POST',
  })
}

export async function getNaplexAnalytics(): Promise<NaplexAnalyticsResponse> {
  return requestJson<NaplexAnalyticsResponse>('/naplex/analytics')
}
