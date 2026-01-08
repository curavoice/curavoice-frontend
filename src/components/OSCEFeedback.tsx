'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle2, AlertCircle, TrendingUp, Award, Heart, MessageCircle, BookOpen, Pill, Activity } from 'lucide-react'
import EchoLoader from '@/components/EchoLoader'
import ProductFeedback from '@/components/ProductFeedback'

interface OSCEEvaluation {
  overall_score: number
  max_score: number
  percentage: number
  result: string
  scenario_title: string
  scenario_type: string
  patient_mood: string
  transcript_length: number
  evaluation_time?: number
  partial_evaluation?: boolean
  note?: string
  categories: {
    [key: string]: {
      score: number
      max: number
      breakdown: {
        [key: string]: {
          score: number
          evidence: string
        }
      }
    }
  }
  feedback: {
    strengths: string[]
    weaknesses: string[]
    improvements: string[]
  }
  empathy_analysis?: {
    score: number
    indicators: string[]
    positive_examples: string[]
    gaps: string[]
  }
  key_moments?: Array<{
    timestamp: string
    speaker: string
    text: string
    note: string
  }>
  ideal_clinical_response?: {
    recommended_treatment: string
    key_counseling_points: string[]
    monitoring_plan: string
  }
  error?: string
}

interface OSCEFeedbackProps {
  sessionId: string
  onClose: () => void
  viewOnly?: boolean  // If true, fetch saved evaluation instead of creating new one
  lectureSimulation?: {
    lecture_id?: string
    lecture_title?: string
    scenario_id?: string
    title?: string
  } | null
  onTryAnother?: () => void  // Callback to try another scenario
}

export default function OSCEFeedback({ sessionId, onClose, viewOnly = false, lectureSimulation, onTryAnother }: OSCEFeedbackProps) {
  const [evaluation, setEvaluation] = useState<OSCEEvaluation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProductFeedback, setShowProductFeedback] = useState(false)
  const [shouldShowFeedback, setShouldShowFeedback] = useState(false)

  // Determine if we should show product feedback (30% chance, but not in view-only mode)
  useEffect(() => {
    if (!viewOnly && evaluation && !loading) {
      // 30% chance to show feedback
      setShouldShowFeedback(Math.random() < 0.3)
    }
  }, [evaluation, loading, viewOnly])

  useEffect(() => {
    fetchEvaluation()
  }, [sessionId, viewOnly])

  const fetchEvaluation = async () => {
    try {
      setLoading(true)
      setError(null)

      const { apiClient } = await import('@/lib/api')
      
      // If viewOnly, fetch saved evaluation; otherwise, trigger new evaluation
      const data = viewOnly 
        ? await apiClient.getSessionEvaluation(sessionId)
        : await apiClient.evaluateTrainingSession(sessionId)
      
      console.log('[OSCEFeedback] Evaluation data received:', data)
      console.log('[OSCEFeedback] ideal_clinical_response:', data?.ideal_clinical_response)
      
      setEvaluation(data)
    } catch (err) {
      console.error('Error fetching evaluation:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load evaluation'
      
      // Check if it's a "conversation too short" error
      if (errorMessage.includes('too short') || errorMessage.includes('Minimum 30 seconds')) {
        setError('Conversation too short for evaluation. Please complete at least 30 seconds of conversation to receive feedback.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-100'
    if (percentage >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <EchoLoader message="Echo's evaluating your performance..." />
        </div>
      </div>
    )
  }

  if (error || !evaluation) {
    const isShortConversation = error?.includes('too short') || error?.includes('30 seconds')
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-md w-full">
          <div className="flex flex-col items-center">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-4 ${isShortConversation ? 'bg-yellow-100' : 'bg-red-100'}`}>
              <AlertCircle className={`h-10 w-10 ${isShortConversation ? 'text-yellow-600' : 'text-red-500'}`} />
            </div>
            
            <h3 className="text-xl font-semibold mb-2 text-gray-900">
              {isShortConversation ? 'Consultation Incomplete' : 'Evaluation Failed'}
            </h3>
            
            <p className="text-gray-600 text-center mb-6">
              {error}
            </p>
            
            {isShortConversation && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 w-full">
                <p className="text-sm text-blue-800 font-medium mb-2">💡 To receive feedback:</p>
                <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                  <li>Continue the conversation for at least 30 seconds</li>
                  <li>Engage with the patient meaningfully</li>
                  <li>Complete the consultation before requesting feedback</li>
                </ul>
              </div>
            )}
            
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              {isShortConversation ? 'Continue Training' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-6xl mx-4 my-8 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-lg">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">OSCE Evaluation Report</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Partial Evaluation Warning */}
          {evaluation.partial_evaluation && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-blue-900">Partial Evaluation</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    {evaluation.note || 'Some details may be incomplete due to a technical issue, but your score and main feedback are accurate.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Overall Score Hero */}
          <div className={`${getScoreBgColor(evaluation.percentage)} rounded-xl p-8 text-center`}>
            <div className="flex items-center justify-center gap-3 mb-4">
              {evaluation.result === 'PASS' ? (
                <Award className="h-12 w-12 text-green-600" />
              ) : (
                <AlertCircle className="h-12 w-12 text-yellow-600" />
              )}
              <h3 className="text-4xl font-bold">{evaluation.percentage.toFixed(1)}%</h3>
            </div>
            <p className="text-xl font-semibold mb-2">
              {evaluation.overall_score} / {evaluation.max_score} points
            </p>
            <div className={`inline-block px-6 py-2 rounded-full font-bold ${
              evaluation.result === 'PASS' ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'
            }`}>
              {evaluation.result}
            </div>
            <p className="mt-4 text-gray-700">
              {evaluation.result === 'PASS'
                ? 'Congratulations! You demonstrated competency in this scenario.'
                : 'Keep practicing. Review the feedback below to improve.'}
            </p>
          </div>

          {/* Category Breakdown - Coming Soon */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
            <div className="flex flex-col items-center justify-center">
              <TrendingUp className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-xl font-bold text-gray-700 mb-2">Category Performance</h3>
              <p className="text-gray-500 text-sm">Coming Soon</p>
            </div>
          </div>

          {/* Structured Feedback Section */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <MessageCircle className="h-6 w-6" />
              Detailed Feedback
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Strengths */}
              <div className="border-2 border-green-300 rounded-xl p-5 bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-bold text-green-900 text-lg">Strengths</h4>
                </div>
                {evaluation.feedback.strengths.length > 0 ? (
                  <ul className="space-y-3">
                    {evaluation.feedback.strengths.map((strength, idx) => (
                      <li key={idx} className="text-sm text-green-900 flex items-start gap-3">
                        <span className="text-green-600 mt-0.5 font-bold">✓</span>
                        <span className="leading-relaxed">{strength}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-green-700 italic">No specific strengths identified.</p>
                )}
              </div>

              {/* Areas for Improvement */}
              <div className="border-2 border-amber-300 rounded-xl p-5 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-bold text-amber-900 text-lg">Areas to Improve</h4>
                </div>
                {evaluation.feedback.weaknesses.length > 0 ? (
                  <ul className="space-y-3">
                    {evaluation.feedback.weaknesses.map((weakness, idx) => (
                      <li key={idx} className="text-sm text-amber-900 flex items-start gap-3">
                        <span className="text-amber-600 mt-0.5 font-bold">!</span>
                        <span className="leading-relaxed">{weakness}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-amber-700 italic">No major weaknesses identified.</p>
                )}
              </div>

              {/* Recommendations */}
              <div className="border-2 border-indigo-300 rounded-xl p-5 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-bold text-indigo-900 text-lg">Recommendations</h4>
                </div>
                {evaluation.feedback.improvements.length > 0 ? (
                  <ul className="space-y-3">
                    {evaluation.feedback.improvements.map((improvement, idx) => (
                      <li key={idx} className="text-sm text-indigo-900 flex items-start gap-3">
                        <span className="text-indigo-600 mt-0.5 font-bold">→</span>
                        <span className="leading-relaxed">{improvement}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-indigo-700 italic">Continue practicing to maintain your skills.</p>
                )}
              </div>
            </div>
          </div>

          {/* Empathy Analysis - Only show if available */}
          {evaluation.empathy_analysis && (
          <div className="border-2 border-pink-200 rounded-lg p-6 bg-gradient-to-br from-pink-50 to-purple-50">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="h-6 w-6 text-pink-600" />
              <h3 className="text-xl font-bold text-pink-900">Empathy Analysis</h3>
              <span className="ml-auto text-2xl font-bold text-pink-600">
                  {evaluation.empathy_analysis.score?.toFixed(1) || '0.0'}/5.0
              </span>
            </div>
            
              {evaluation.empathy_analysis.indicators && evaluation.empathy_analysis.indicators.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Observed Behaviors:</h4>
                <div className="flex flex-wrap gap-2">
                  {evaluation.empathy_analysis.indicators.map((indicator, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-white rounded-full text-sm text-pink-700 border border-pink-200"
                    >
                      {indicator}
                    </span>
                  ))}
                </div>
              </div>
            )}

              {evaluation.empathy_analysis.positive_examples && evaluation.empathy_analysis.positive_examples.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Positive Examples:</h4>
                <div className="space-y-2">
                  {evaluation.empathy_analysis.positive_examples.map((example, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 text-sm text-gray-700 border-l-4 border-pink-400">
                      <MessageCircle className="h-4 w-4 inline mr-2 text-pink-500" />
                      "{example}"
                    </div>
                  ))}
                </div>
              </div>
            )}

              {evaluation.empathy_analysis.gaps && evaluation.empathy_analysis.gaps.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Opportunities for Growth:</h4>
                <ul className="space-y-1">
                  {evaluation.empathy_analysis.gaps.map((gap, idx) => (
                    <li key={idx} className="text-sm text-gray-600 ml-4">• {gap}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          )}

          {/* The Correct Clinical Answer - What a Real Pharmacist Would Do */}
          {evaluation.ideal_clinical_response && (
            evaluation.ideal_clinical_response.recommended_treatment ||
            (evaluation.ideal_clinical_response.key_counseling_points && evaluation.ideal_clinical_response.key_counseling_points.length > 0) ||
            evaluation.ideal_clinical_response.monitoring_plan
          ) ? (
            <div className="border-2 border-[#344895] rounded-xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#344895] to-[#1A1F71] p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <BookOpen className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">💡 The Correct Answer</h3>
                    <p className="text-sm text-white/80">What a pharmacist should have done in this scenario</p>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gradient-to-br from-[#344895]/5 to-[#3DD6D0]/10 space-y-5">
                {/* Diagnosis / Recommended Treatment */}
                {evaluation.ideal_clinical_response.recommended_treatment && (
                  <div className="bg-white rounded-lg p-5 border-l-4 border-[#344895] shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Pill className="h-5 w-5 text-[#344895]" />
                      <h4 className="font-bold text-[#344895]">Diagnosis & Recommended Treatment</h4>
                    </div>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {evaluation.ideal_clinical_response.recommended_treatment}
                    </p>
                  </div>
                )}

                {/* What the Pharmacist Should Say - Key Counseling Points */}
                {evaluation.ideal_clinical_response.key_counseling_points && 
                 evaluation.ideal_clinical_response.key_counseling_points.length > 0 && (
                  <div className="bg-white rounded-lg p-5 border-l-4 border-[#3DD6D0] shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageCircle className="h-5 w-5 text-[#3DD6D0]" />
                      <h4 className="font-bold text-[#344895]">What the Pharmacist Should Say</h4>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">Key counseling points to communicate to the patient:</p>
                    <ul className="space-y-3">
                      {evaluation.ideal_clinical_response.key_counseling_points.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-gray-700 bg-[#3DD6D0]/5 p-3 rounded-lg">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#3DD6D0] text-white text-sm font-bold flex items-center justify-center">{idx + 1}</span>
                          <span className="leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Follow-up & Monitoring */}
                {evaluation.ideal_clinical_response.monitoring_plan && (
                  <div className="bg-white rounded-lg p-5 border-l-4 border-amber-500 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="h-5 w-5 text-amber-500" />
                      <h4 className="font-bold text-[#344895]">Follow-up & Monitoring Plan</h4>
                    </div>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                      {evaluation.ideal_clinical_response.monitoring_plan}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Fallback when no ideal response - show scenario context */
            <div className="border-2 border-gray-200 rounded-xl p-6 bg-gray-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-700">Clinical Reference</h3>
                  <p className="text-sm text-gray-500">Scenario: {evaluation.scenario_title}</p>
                </div>
              </div>
              <p className="text-gray-600 text-sm">
                Review the feedback above to understand what could be improved. Practice more scenarios to build your clinical communication skills.
              </p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 rounded-b-lg flex flex-col sm:flex-row justify-between gap-3">
          {/* Left side - Print */}
          <button
            onClick={() => window.print()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm"
          >
            Print Report
          </button>
          
          {/* Right side - Navigation buttons */}
          <div className="flex gap-3">
            {/* Try Another Scenario - Only show for lecture simulations */}
            {lectureSimulation?.lecture_id && onTryAnother && (
              <button
                onClick={() => {
                  // Mark this scenario as practiced before navigating
                  if (lectureSimulation.scenario_id && lectureSimulation.lecture_id) {
                    const practiceKey = `practiced_simulations_${lectureSimulation.lecture_id}`
                    const practiced = JSON.parse(localStorage.getItem(practiceKey) || '[]')
                    if (!practiced.includes(lectureSimulation.scenario_id)) {
                      practiced.push(lectureSimulation.scenario_id)
                      localStorage.setItem(practiceKey, JSON.stringify(practiced))
                    }
                    // Also store the timestamp
                    const historyKey = `simulation_history_${lectureSimulation.lecture_id}`
                    const history = JSON.parse(localStorage.getItem(historyKey) || '{}')
                    history[lectureSimulation.scenario_id] = {
                      practicedAt: new Date().toISOString(),
                      sessionId: sessionId
                    }
                    localStorage.setItem(historyKey, JSON.stringify(history))
                  }
                  onTryAnother()
                }}
                className="px-5 py-2 bg-gradient-to-r from-[#3DD6D0] to-[#2BB5AF] text-[#1A1F71] rounded-lg hover:shadow-lg transition-all font-medium flex items-center gap-2"
              >
                🔄 Try Another Scenario
              </button>
            )}
            
            <button
              onClick={() => {
                // Mark scenario as practiced before closing
                if (lectureSimulation?.scenario_id && lectureSimulation?.lecture_id) {
                  const practiceKey = `practiced_simulations_${lectureSimulation.lecture_id}`
                  const practiced = JSON.parse(localStorage.getItem(practiceKey) || '[]')
                  if (!practiced.includes(lectureSimulation.scenario_id)) {
                    practiced.push(lectureSimulation.scenario_id)
                    localStorage.setItem(practiceKey, JSON.stringify(practiced))
                  }
                  const historyKey = `simulation_history_${lectureSimulation.lecture_id}`
                  const history = JSON.parse(localStorage.getItem(historyKey) || '{}')
                  history[lectureSimulation.scenario_id] = {
                    practicedAt: new Date().toISOString(),
                    sessionId: sessionId
                  }
                  localStorage.setItem(historyKey, JSON.stringify(history))
                }
                
                if (shouldShowFeedback) {
                  setShowProductFeedback(true)
                } else {
                  onClose()
                }
              }}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              {lectureSimulation?.lecture_id ? 'Done' : 'Continue Training'}
            </button>
          </div>
        </div>
      </div>

      {/* Product Feedback Modal */}
      {showProductFeedback && (
        <ProductFeedback
          sessionId={sessionId}
          onClose={() => {
            setShowProductFeedback(false)
            onClose()
          }}
        />
      )}
    </div>
  )
}


