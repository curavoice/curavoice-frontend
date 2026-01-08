'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, RefreshCw, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  answerNaplexQuestion,
  createNaplexSession,
  submitNaplexSession,
  type NaplexAnswerResponse,
  type NaplexSessionResponse,
  type NaplexSubmitResponse,
} from '@/lib/naplexApi'

function optionToLetter(option: string): string | null {
  const trimmed = option.trim()
  const m = trimmed.match(/^([A-D])\)/i)
  return m ? m[1].toUpperCase() : null
}

export default function NaplexPracticePage() {
  const { toast } = useToast()

  const [numQuestions, setNumQuestions] = useState(10)
  const [topicsText, setTopicsText] = useState('')
  const [generationMode, setGenerationMode] = useState<'template' | 'adaptive' | 'ai'>('adaptive')
  const [sourceLectureId, setSourceLectureId] = useState('')

  const [session, setSession] = useState<NaplexSessionResponse | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<string, string>>({})
  const [feedbackByQuestion, setFeedbackByQuestion] = useState<Record<string, NaplexAnswerResponse>>({})
  const [confidenceByQuestion, setConfidenceByQuestion] = useState<Record<string, number>>({})
  const [rationaleByQuestion, setRationaleByQuestion] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<NaplexSubmitResponse | null>(null)

  const topics = useMemo(
    () =>
      topicsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [topicsText]
  )

  const currentQuestion = session?.questions?.[currentIndex] || null
  const currentFeedback = currentQuestion ? feedbackByQuestion[currentQuestion.id] : undefined
  const currentSelected = currentQuestion ? selectedByQuestion[currentQuestion.id] : undefined

  const startQuiz = async () => {
    try {
      setSubmitting(true)
      setResult(null)
      setFeedbackByQuestion({})
      setSelectedByQuestion({})
      setConfidenceByQuestion({})
      setRationaleByQuestion({})

      const created = await createNaplexSession({
        session_type: 'quiz',
        num_questions: numQuestions,
        topics,
        timed: false,
        generation_mode: generationMode,
        source_lecture_id: generationMode === 'ai' ? sourceLectureId || null : null,
        deck_id: 'top200',
      })
      setSession(created)
      setCurrentIndex(0)
    } catch (e: any) {
      toast({
        title: 'Failed to start quiz',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const checkAnswer = async () => {
    if (!session || !currentQuestion || !currentSelected) return
    try {
      setSubmitting(true)
      const resp = await answerNaplexQuestion(session.id, {
        question_id: currentQuestion.id,
        answer: currentSelected,
        confidence: confidenceByQuestion[currentQuestion.id] ?? null,
        rationale_transcript: rationaleByQuestion[currentQuestion.id] ?? null,
      })
      setFeedbackByQuestion((prev) => ({ ...prev, [currentQuestion.id]: resp }))
    } catch (e: any) {
      toast({
        title: 'Failed to submit answer',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Count how many questions have been answered (have feedback)
  const answeredCount = session ? Object.keys(feedbackByQuestion).length : 0
  const allAnswered = session ? answeredCount === session.total_questions : false

  const submit = async () => {
    if (!session) return
    
    // Validate that all questions have been answered
    if (!allAnswered) {
      toast({
        title: 'Complete all questions',
        description: `You've answered ${answeredCount} of ${session.total_questions} questions. Please answer all questions before submitting.`,
        variant: 'destructive',
      })
      return
    }
    
    try {
      setSubmitting(true)
      const resp = await submitNaplexSession(session.id)
      setResult(resp)
      toast({
        title: 'Quiz submitted',
        description: `Score: ${resp.score}/${resp.total} (${resp.percentage}%)`,
      })
    } catch (e: any) {
      toast({
        title: 'Failed to submit quiz',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setSession(null)
    setResult(null)
    setFeedbackByQuestion({})
    setSelectedByQuestion({})
    setConfidenceByQuestion({})
    setRationaleByQuestion({})
    setCurrentIndex(0)
  }

  if (!session) {
    return (
      <div className="pt-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-[#344895]" />
          <h1 className="text-2xl sm:text-3xl font-montserrat font-bold text-[#344895]">
            Practice Quiz
          </h1>
        </div>
        <p className="mt-1 text-sm sm:text-base font-lato text-gray-700">
          Generate a quiz and get instant explanations after each question.
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
              <p className="mt-2 text-xs font-lato text-gray-500">
                Adaptive mixes Top 200 + calculations based on your performance. AI mode requires a processed lecture ID.
              </p>
            </div>

            <div>
              <Label className="font-montserrat font-bold text-black">Lecture ID (AI mode)</Label>
              <Input
                value={sourceLectureId}
                onChange={(e) => setSourceLectureId(e.target.value)}
                placeholder="Paste lecture_id"
                className="mt-2"
                disabled={generationMode !== 'ai'}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button
              data-tour="naplex-start-quiz"
              onClick={startQuiz}
              disabled={submitting || (generationMode === 'ai' && !sourceLectureId)}
              className="rounded-full bg-gradient-to-r from-[#344895] to-[#1A1F71] text-white font-montserrat font-bold h-12"
            >
              {submitting ? 'Starting...' : 'Start Quiz'}
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
            Quiz Results
          </h1>
          <Button
            onClick={reset}
            className="rounded-full bg-white border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white font-montserrat font-bold"
          >
            <RefreshCw className="h-4 w-4" />
            New Quiz
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
              Keep going: do another quiz or try timed exam mode.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 justify-center">
            <Button
              onClick={() => {
                setResult(null)
                startQuiz()
              }}
              disabled={submitting}
              className="rounded-full bg-gradient-to-r from-[#344895] to-[#1A1F71] text-white font-montserrat font-bold h-12"
            >
              {submitting ? 'Starting...' : 'Run It Back'}
            </Button>
            <Link
              href="/naplex/decks"
              className="rounded-full bg-white border-2 border-[#3DD6D0] text-[#1A1F71] hover:bg-[#3DD6D0]/20 font-montserrat font-bold h-12 inline-flex items-center justify-center px-6"
            >
              Review Deck
            </Link>
            <Button
              onClick={reset}
              className="rounded-full bg-white border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white font-montserrat font-bold h-12"
            >
              Change Settings
            </Button>
            <Link
              href="/naplex/analytics"
              className="rounded-full bg-white border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white font-montserrat font-bold h-12 inline-flex items-center justify-center px-6"
            >
              View Analytics
            </Link>
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

  const answered = Boolean(currentFeedback)
  const progressText = `Question ${currentIndex + 1} of ${session.total_questions}`

  return (
    <div className="pt-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-montserrat font-bold text-[#344895]">
            Practice Quiz
          </h1>
          <p className="mt-1 text-sm font-lato text-gray-600">{progressText}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={reset}
            variant="outline"
            className="rounded-full border-2 border-[#344895] text-[#344895] hover:bg-[#344895] hover:text-white font-montserrat font-bold"
          >
            <RefreshCw className="h-4 w-4" />
            Exit
          </Button>
        </div>
      </div>

      <div className="mt-6 bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-5 sm:p-6 shadow-sm">
        <div className="text-base sm:text-lg font-lato font-bold text-black">
          {currentQuestion.question}
        </div>

        <div className="mt-4 space-y-2">
          {currentQuestion.options.map((opt) => {
            const letter = optionToLetter(opt)
            const selected = letter && currentSelected === letter
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  if (!letter) return
                  setSelectedByQuestion((prev) => ({ ...prev, [currentQuestion.id]: letter }))
                }}
                className={`w-full text-left rounded-2xl border-2 px-4 py-3 font-lato font-bold transition-colors ${
                  selected
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

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="font-montserrat font-bold text-black">Confidence (optional)</Label>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((v) => {
                const active = confidenceByQuestion[currentQuestion.id] === v
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setConfidenceByQuestion((prev) => ({ ...prev, [currentQuestion.id]: v }))}
                    className={`h-10 w-10 rounded-full border-2 font-montserrat font-bold transition-colors ${
                      active
                        ? 'border-[#344895] bg-[#344895] text-white'
                        : 'border-[#344895] bg-white text-[#344895] hover:bg-[#344895] hover:text-white'
                    }`}
                  >
                    {v}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label className="font-montserrat font-bold text-black">Rationale (optional)</Label>
            <textarea
              value={rationaleByQuestion[currentQuestion.id] || ''}
              onChange={(e) =>
                setRationaleByQuestion((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))
              }
              className="mt-2 w-full rounded-2xl border-2 border-gray-200 p-3 font-lato text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3DD6D0]"
              rows={3}
              placeholder="Explain your reasoning in 1–3 sentences..."
            />
          </div>
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

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={checkAnswer}
              disabled={submitting || !currentSelected || answered}
              className="rounded-full bg-gradient-to-r from-[#344895] to-[#1A1F71] text-white font-montserrat font-bold h-12"
            >
              {answered ? 'Answered' : submitting ? 'Submitting...' : 'Check Answer'}
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || !allAnswered}
              className={`rounded-full border-2 font-montserrat font-bold h-12 ${
                allAnswered 
                  ? 'bg-gradient-to-r from-[#3DD6D0] to-[#2BC4BE] text-[#1A1F71] hover:opacity-90' 
                  : 'bg-white border-[#3DD6D0] text-[#1A1F71] hover:bg-[#3DD6D0]/20'
              }`}
            >
              Submit Quiz ({answeredCount}/{session.total_questions} answered)
            </Button>
          </div>
        </div>

        {currentFeedback && (
          <div className="mt-6 rounded-[20px] border-2 p-4 sm:p-5" style={{ borderColor: '#3DD6D0' }}>
            <div className="flex items-center gap-2">
              {currentFeedback.is_correct ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <div className="font-montserrat font-bold text-black">
                {currentFeedback.is_correct ? 'Correct' : `Incorrect (Answer: ${currentFeedback.correct_answer})`}
              </div>
            </div>
            {currentFeedback.explanation && (
              <p className="mt-2 text-sm font-lato text-gray-700">{currentFeedback.explanation}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
