'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Timer, UploadCloud } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  answerNaplexQuestion,
  createNaplexSession,
  submitNaplexSession,
  type NaplexSessionResponse,
  type NaplexSubmitResponse,
} from '@/lib/naplexApi'

function optionToLetter(option: string): string | null {
  const trimmed = option.trim()
  const m = trimmed.match(/^([A-D])\)/i)
  return m ? m[1].toUpperCase() : null
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export default function NaplexExamPage() {
  const { toast } = useToast()

  const [numQuestions, setNumQuestions] = useState(50)
  const [topicsText, setTopicsText] = useState('')
  const [generationMode, setGenerationMode] = useState<'template' | 'adaptive' | 'ai'>('adaptive')
  const [sourceLectureId, setSourceLectureId] = useState('')
  const [durationMinutes, setDurationMinutes] = useState<number | ''>('')

  const [session, setSession] = useState<NaplexSessionResponse | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<string, string>>({})
  const [lastSavedAnswerByQuestion, setLastSavedAnswerByQuestion] = useState<Record<string, string>>({})
  const [savingByQuestion, setSavingByQuestion] = useState<Record<string, boolean>>({})
  const [saveErrorByQuestion, setSaveErrorByQuestion] = useState<Record<string, string>>({})
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<NaplexSubmitResponse | null>(null)

  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null)
  const autoSubmittedRef = useRef(false)
  const sessionIdRef = useRef<string | null>(null)
  const lastSavedRef = useRef<Record<string, string>>({})
  const savingRef = useRef<Record<string, boolean>>({})

  const topics = useMemo(
    () =>
      topicsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [topicsText]
  )

  const currentQuestion = session?.questions?.[currentIndex] || null

  const reset = () => {
    setSession(null)
    setResult(null)
    setSelectedByQuestion({})
    setLastSavedAnswerByQuestion({})
    setSavingByQuestion({})
    setSaveErrorByQuestion({})
    setCurrentIndex(0)
    setTimeLeftSeconds(null)
    autoSubmittedRef.current = false
    sessionIdRef.current = null
  }

  const startExam = async () => {
    try {
      setStarting(true)
      setResult(null)
      setSelectedByQuestion({})
      setLastSavedAnswerByQuestion({})
      setSavingByQuestion({})
      setSaveErrorByQuestion({})
      setCurrentIndex(0)
      setTimeLeftSeconds(null)
      autoSubmittedRef.current = false

      const duration_seconds =
        typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes * 60 : null

      const created = await createNaplexSession({
        session_type: 'exam',
        num_questions: numQuestions,
        topics,
        timed: true,
        duration_seconds,
        generation_mode: generationMode,
        source_lecture_id: generationMode === 'ai' ? sourceLectureId || null : null,
        deck_id: 'top200',
      })
      setSession(created)
      sessionIdRef.current = created.id
      toast({ title: 'Exam started', description: 'Timer is running. Good luck!' })
    } catch (e: any) {
      toast({
        title: 'Failed to start exam',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setStarting(false)
    }
  }

  useEffect(() => {
    lastSavedRef.current = lastSavedAnswerByQuestion
  }, [lastSavedAnswerByQuestion])

  useEffect(() => {
    savingRef.current = savingByQuestion
  }, [savingByQuestion])

  const saveAnswerForQuestion = useCallback(
    async (questionId: string, answer: string, opts?: { showToast?: boolean }) => {
      const showToast = opts?.showToast ?? false
      const sessionId = sessionIdRef.current
      if (!sessionId) return

      if (savingRef.current[questionId]) return
      if (lastSavedRef.current[questionId] === answer) return

      setSavingByQuestion((prev) => ({ ...prev, [questionId]: true }))
      setSaveErrorByQuestion((prev) => {
        if (!prev[questionId]) return prev
        const next = { ...prev }
        delete next[questionId]
        return next
      })

      try {
        await answerNaplexQuestion(sessionId, { question_id: questionId, answer })
        setLastSavedAnswerByQuestion((prev) => ({ ...prev, [questionId]: answer }))
      } catch (e: any) {
        const message = e?.message || 'Please try again.'
        setSaveErrorByQuestion((prev) => ({ ...prev, [questionId]: message }))
        if (showToast) {
          toast({
            title: 'Failed to save answer',
            description: message,
            variant: 'destructive',
          })
        }
      } finally {
        setSavingByQuestion((prev) => ({ ...prev, [questionId]: false }))
      }
    },
    [toast]
  )

  // Count how many questions have been answered (saved to server)
  const totalAnswered = Object.keys(lastSavedAnswerByQuestion).length
  const allQuestionsAnswered = session ? totalAnswered === session.total_questions : false

  const submit = async (options?: { force?: boolean }) => {
    if (!session) return
    
    // Validate that all questions have been answered (unless forced by timer)
    if (!options?.force && !allQuestionsAnswered) {
      toast({
        title: 'Complete all questions',
        description: `You've answered ${totalAnswered} of ${session.total_questions} questions. Please answer all questions before submitting.`,
        variant: 'destructive',
      })
      return
    }
    
    try {
      setSubmitting(true)
      const resp = await submitNaplexSession(session.id)
      setResult(resp)
      toast({ title: 'Exam submitted', description: `Score: ${resp.score}/${resp.total}` })
    } catch (e: any) {
      toast({
        title: 'Failed to submit exam',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Timer loop
  useEffect(() => {
    if (!session || result) return
    const startedAt = session.started_at || session.created_at
    const duration = session.duration_seconds || null
    if (!startedAt || !duration) return

    const deadline = new Date(startedAt).getTime() + duration * 1000

    const tick = () => {
      const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000))
      setTimeLeftSeconds(remaining)
      if (remaining === 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true
        submit({ force: true }) // Force submit when time runs out
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session, result])

  if (!session) {
    return (
      <div className="pt-2">
        <div className="flex items-center gap-2">
          <Timer className="h-6 w-6 text-[#344895]" />
          <h1 className="text-2xl sm:text-3xl font-montserrat font-bold text-[#344895]">
            Timed Exam Mode
          </h1>
        </div>
        <p className="mt-1 text-sm sm:text-base font-lato text-gray-700">
          Simulate exam conditions. Answers are hidden until you submit.
        </p>

        <div className="mt-6 bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-5 sm:p-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="font-montserrat font-bold text-black">Questions</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="max-w-[140px]"
                />
                <span className="text-sm font-lato text-gray-600">1–100</span>
              </div>
            </div>

            <div>
              <Label className="font-montserrat font-bold text-black">Duration (minutes, optional)</Label>
              <Input
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Auto"
                className="mt-2 max-w-[180px]"
              />
              <p className="mt-2 text-xs font-lato text-gray-500">
                Leave blank for auto timing based on question count.
              </p>
            </div>

            <div>
              <Label className="font-montserrat font-bold text-black">Topics (optional)</Label>
              <Input
                value={topicsText}
                onChange={(e) => setTopicsText(e.target.value)}
                placeholder="e.g. cardio, ID, renal"
                className="mt-2"
              />
            </div>

            <div>
              <Label className="font-montserrat font-bold text-black">Generation Mode</Label>
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setGenerationMode('template')}
                  className={`flex-1 rounded-full px-4 py-3 font-montserrat font-bold border-2 transition-colors ${
                    generationMode === 'template'
                      ? 'bg-[#344895] border-[#344895] text-white'
                      : 'bg-white border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white'
                  }`}
                >
                  Template
                </button>
                <button
                  type="button"
                  onClick={() => setGenerationMode('adaptive')}
                  className={`flex-1 rounded-full px-4 py-3 font-montserrat font-bold border-2 transition-colors ${
                    generationMode === 'adaptive'
                      ? 'bg-[#344895] border-[#344895] text-white'
                      : 'bg-white border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white'
                  }`}
                >
                  Adaptive
                </button>
                <button
                  type="button"
                  onClick={() => setGenerationMode('ai')}
                  className={`flex-1 rounded-full px-4 py-3 font-montserrat font-bold border-2 transition-colors ${
                    generationMode === 'ai'
                      ? 'bg-[#344895] border-[#344895] text-white'
                      : 'bg-white border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white'
                  }`}
                >
                  AI (Lecture)
                </button>
              </div>
            </div>

            <div>
              <Label className="font-montserrat font-bold text-black">Lecture ID (AI mode)</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={sourceLectureId}
                  onChange={(e) => setSourceLectureId(e.target.value)}
                  placeholder="Paste lecture_id"
                  disabled={generationMode !== 'ai'}
                />
                <UploadCloud className="h-5 w-5 text-[#344895]" />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={startExam}
              disabled={starting || (generationMode === 'ai' && !sourceLectureId)}
              className="rounded-full bg-gradient-to-r from-[#344895] to-[#1A1F71] text-white font-montserrat font-bold h-12"
            >
              {starting ? 'Starting...' : 'Start Timed Exam'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (result) {
    return (
      <div className="pt-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-montserrat font-bold text-[#344895]">
            Exam Results
          </h1>
          <Button
            onClick={reset}
            className="rounded-full bg-white border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white font-montserrat font-bold"
          >
            <RefreshCw className="h-4 w-4" />
            New Exam
          </Button>
        </div>

        <div className="mt-6 bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-6 shadow-sm">
          <div className="text-center">
            <div className="text-5xl font-montserrat font-extrabold text-[#1A1F71]">
              {result.percentage}%
            </div>
            <div className="mt-2 text-lg font-montserrat font-bold text-black">
              {result.score}/{result.total} correct
            </div>
            <p className="mt-2 text-sm font-lato text-gray-600">
              Review your weak areas in Practice mode and decks.
            </p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/naplex/analytics"
              className="rounded-full bg-white border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white font-montserrat font-bold h-12 inline-flex items-center justify-center px-6"
            >
              View Analytics
            </Link>
            <Link
              href="/naplex/decks"
              className="rounded-full bg-white border-2 border-[#3DD6D0] text-[#1A1F71] hover:bg-[#3DD6D0]/20 font-montserrat font-bold h-12 inline-flex items-center justify-center px-6"
            >
              Review Deck
            </Link>
            <Button
              onClick={reset}
              className="rounded-full bg-gradient-to-r from-[#344895] to-[#1A1F71] text-white font-montserrat font-bold h-12"
            >
              Back to Setup
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="pt-2">
        <p className="font-lato text-gray-700">No questions found.</p>
        <Button onClick={reset} className="mt-4 rounded-full font-montserrat font-bold">
          Back
        </Button>
      </div>
    )
  }

  const progressText = `Question ${currentIndex + 1} of ${session.total_questions}`
  const selected = selectedByQuestion[currentQuestion.id]

  const showTimer = typeof timeLeftSeconds === 'number'
  const isSaving = Boolean(savingByQuestion[currentQuestion.id])
  const isSaved = Boolean(lastSavedAnswerByQuestion[currentQuestion.id]) && lastSavedAnswerByQuestion[currentQuestion.id] === selected
  const saveError = saveErrorByQuestion[currentQuestion.id]

  return (
    <div className="pt-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-montserrat font-bold text-[#344895]">
            Timed Exam
          </h1>
          <p className="mt-1 text-sm font-lato text-gray-600">
            {progressText} • Answered {totalAnswered}/{session.total_questions}
          </p>
          <p className="mt-1 text-xs font-lato text-gray-500">Selections auto-save; you can change answers anytime.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showTimer && (
            <div className="rounded-full border-2 border-[#3DD6D0] bg-white px-4 py-2 font-montserrat font-bold text-[#1A1F71]">
              Time left: {formatTime(timeLeftSeconds as number)}
            </div>
          )}
          <Button
            onClick={() => submit()}
            disabled={submitting || !allQuestionsAnswered}
            className={`rounded-full font-montserrat font-bold ${
              allQuestionsAnswered 
                ? 'bg-gradient-to-r from-[#344895] to-[#1A1F71] text-white' 
                : 'bg-white border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white'
            }`}
          >
            Submit Exam ({totalAnswered}/{session.total_questions})
          </Button>
          <Button
            onClick={reset}
            variant="outline"
            className="rounded-full border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white font-montserrat font-bold"
          >
            Exit
          </Button>
        </div>
      </div>

      <div className="mt-4 bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-4 sm:p-5 shadow-sm overflow-x-auto scrollbar-hide [-webkit-overflow-scrolling:touch]">
        <div className="flex w-max gap-2">
          {session.questions.map((q, idx) => {
            const active = idx === currentIndex
            const saved = Boolean(lastSavedAnswerByQuestion[q.id])
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`h-10 w-10 shrink-0 rounded-full border-2 font-montserrat font-bold transition-colors ${
                  active
                    ? 'border-[#1A1F71] bg-[#1A1F71] text-white'
                    : saved
                      ? 'border-[#3DD6D0] bg-[#3DD6D0]/20 text-[#1A1F71]'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-[#3DD6D0]'
                }`}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-5 sm:p-6 shadow-sm">
        <div className="text-base sm:text-lg font-lato font-bold text-black">
          {currentQuestion.question}
        </div>

        <div className="mt-4 space-y-2">
          {currentQuestion.options.map((opt) => {
            const letter = optionToLetter(opt)
            const isSelected = letter && selected === letter
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  if (!letter) return
                  const questionId = currentQuestion.id
                  setSelectedByQuestion((prev) => ({ ...prev, [currentQuestion.id]: letter }))
                  saveAnswerForQuestion(questionId, letter, { showToast: false })
                }}
                className={`w-full text-left rounded-2xl border-2 px-4 py-3 font-lato font-bold transition-colors ${
                  isSelected
                    ? 'border-[#344895] bg-[#344895]/10'
                    : 'border-gray-200 bg-white hover:border-[#3DD6D0]'
                }`}
                disabled={submitting}
              >
                {opt}
              </button>
            )
          })}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={submitting || currentIndex === 0}
              className="rounded-full bg-white border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white font-montserrat font-bold"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              onClick={() => setCurrentIndex((i) => Math.min(session.total_questions - 1, i + 1))}
              disabled={submitting || currentIndex === session.total_questions - 1}
              className="rounded-full bg-white border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white font-montserrat font-bold"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            onClick={() => {
              if (!currentQuestion || !selected) return
              saveAnswerForQuestion(currentQuestion.id, selected, { showToast: true })
            }}
            disabled={submitting || !selected || isSaving}
            className="rounded-full bg-gradient-to-r from-[#344895] to-[#1A1F71] text-white font-montserrat font-bold h-12"
          >
            {isSaving ? 'Saving...' : isSaved ? 'Saved' : saveError ? 'Retry Save' : 'Save Answer'}
          </Button>
        </div>

        {saveError ? (
          <div className="mt-3 text-xs font-lato text-red-600">
            Not saved: {saveError}
          </div>
        ) : null}
      </div>
    </div>
  )
}
