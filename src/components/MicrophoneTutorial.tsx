'use client'

import { useState, useEffect } from 'react'
import { X, Mic, MicOff, ArrowRight, Play } from 'lucide-react'

interface MicrophoneTutorialProps {
  onClose: () => void
  onStartDemo?: () => void
}

export default function MicrophoneTutorial({ onClose, onStartDemo }: MicrophoneTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    {
      title: 'Step 1: Tap to Start',
      description: 'Tap the microphone button to start recording your voice.',
      icon: <Mic className="w-12 h-12 text-indigo-600" />,
      visual: '🎤',
    },
    {
      title: 'Step 2: Speak Your Message',
      description: 'Speak clearly and naturally. The button will show you\'re recording.',
      icon: <MicOff className="w-12 h-12 text-green-600" />,
      visual: '🔴',
    },
    {
      title: 'Step 3: Tap Again to Send',
      description: 'Tap the microphone button again to send your message to Echo.',
      icon: <ArrowRight className="w-12 h-12 text-blue-600" />,
      visual: '📤',
    },
    {
      title: 'Step 4: Wait for Echo',
      description: 'Echo will process and respond. Listen to the response before speaking again.',
      icon: <Play className="w-12 h-12 text-purple-600" />,
      visual: '🤖',
    },
  ]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onClose()
    }
  }

  const handleSkip = () => {
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">How to Use the Microphone</h2>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close tutorial"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 flex-1 rounded-full transition-all ${
                index <= currentStep ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Current Step Content */}
        <div className="text-center mb-6">
          <div className="mb-4 flex justify-center">
            {steps[currentStep].icon}
          </div>
          <div className="text-6xl mb-4">{steps[currentStep].visual}</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {steps[currentStep].title}
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            {steps[currentStep].description}
          </p>
        </div>

        {/* Visual Guide */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            {currentStep === 0 && (
              <>
                <span className="px-3 py-1 bg-gray-200 rounded-full">Mic: Idle</span>
                <ArrowRight className="w-4 h-4" />
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">Tap to Start</span>
              </>
            )}
            {currentStep === 1 && (
              <>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">🔴 Listening...</span>
                <ArrowRight className="w-4 h-4" />
                <span className="text-gray-500">Speak now</span>
              </>
            )}
            {currentStep === 2 && (
              <>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">Recording</span>
                <ArrowRight className="w-4 h-4" />
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">Tap to Send</span>
              </>
            )}
            {currentStep === 3 && (
              <>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">📤 Sending...</span>
                <ArrowRight className="w-4 h-4" />
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full">🤖 Echo Responds</span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Previous
            </button>
          )}
          <button
            onClick={handleNext}
            className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors ${
              currentStep === steps.length - 1
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {currentStep === steps.length - 1 ? 'Got it!' : 'Next'}
          </button>
        </div>

        {/* Skip Link */}
        <div className="mt-4 text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Skip tutorial
          </button>
        </div>
      </div>
    </div>
  )
}

