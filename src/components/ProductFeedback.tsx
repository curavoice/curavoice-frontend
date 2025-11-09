"use client"

import { useState } from 'react'
import { X, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react'
import EchoIcon from '@/components/icons/Echo'
import { useAuth } from '@/hooks/useAuth'

interface ProductFeedbackProps {
  sessionId: string
  onClose: () => void
}

export default function ProductFeedback({ sessionId, onClose }: ProductFeedbackProps) {
  const { user } = useAuth()
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!rating) return

    setIsSubmitting(true)
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${API_URL}/api/v1/feedback/product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user?.id || '',
        },
        body: JSON.stringify({
          session_id: sessionId,
          rating: rating,
          comment: comment.trim() || null,
        }),
      })

      if (response.ok) {
        setSubmitted(true)
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        console.error('Failed to submit feedback')
        onClose()
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in duration-200">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4">
              <EchoIcon width={120} height={138} className="mx-auto" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You! 🙏</h3>
            <p className="text-gray-600">Your feedback helps us improve Echo!</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-1">
              How are you liking Echo?
            </h3>
            <p className="text-sm text-gray-600">
              Your feedback helps us make Echo even better!
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <div className="flex gap-4 justify-center mb-4">
            <button
              onClick={() => setRating('positive')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                rating === 'positive'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-green-300'
              }`}
            >
              <ThumbsUp className={`w-8 h-8 ${rating === 'positive' ? 'text-green-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${rating === 'positive' ? 'text-green-700' : 'text-gray-600'}`}>
                Loving it!
              </span>
            </button>
            <button
              onClick={() => setRating('negative')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                rating === 'negative'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-red-300'
              }`}
            >
              <ThumbsDown className={`w-8 h-8 ${rating === 'negative' ? 'text-red-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${rating === 'negative' ? 'text-red-700' : 'text-gray-600'}`}>
                Needs work
              </span>
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MessageSquare className="w-4 h-4 inline mr-1" />
              Tell us more (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What do you like? What could be better?"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3DD6D0] focus:border-transparent resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={!rating || isSubmitting}
            className="flex-1 px-4 py-2.5 bg-[#344895] text-white rounded-lg font-medium hover:bg-[#1A1F71] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Submitting...</span>
              </>
            ) : (
              'Submit Feedback'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}


