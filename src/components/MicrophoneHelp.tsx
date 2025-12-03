'use client'

import { X, Mic, MicOff, ArrowRight, Play, HelpCircle } from 'lucide-react'

interface MicrophoneHelpProps {
  onClose: () => void
}

export default function MicrophoneHelp({ onClose }: MicrophoneHelpProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">Microphone Guide</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close help"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Quick Guide */}
        <div className="space-y-4 mb-6">
          <div className="bg-indigo-50 rounded-lg p-4">
            <h3 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Quick Steps
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-indigo-800">
              <li>Tap the microphone button to start recording</li>
              <li>Speak your message clearly</li>
              <li>Tap the microphone button again to send</li>
              <li>Wait for Echo to respond before speaking again</li>
            </ol>
          </div>

          {/* Status Indicators */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 mb-2">Status Indicators</h3>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-gray-400"></div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">Mic: Idle</div>
                <div className="text-sm text-gray-600">Ready to start recording</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">Mic: Listening</div>
                <div className="text-sm text-gray-600">Recording your voice - tap again to send</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">Echo is replying</div>
                <div className="text-sm text-gray-600">Wait for Echo to finish speaking</div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-yellow-50 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">💡 Tips</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
              <li>Speak clearly and at a normal pace</li>
              <li>Wait for Echo to finish before speaking again</li>
              <li>The microphone button is disabled while Echo is speaking</li>
              <li>You can tap the button multiple times - it toggles recording on/off</li>
            </ul>
          </div>

          {/* Troubleshooting */}
          <div className="bg-red-50 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2">🔧 Troubleshooting</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
              <li>If microphone doesn't work, check browser permissions</li>
              <li>Make sure you're in a quiet environment</li>
              <li>If Echo doesn't respond, check your internet connection</li>
              <li>Try refreshing the page if issues persist</li>
            </ul>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          Got it!
        </button>
      </div>
    </div>
  )
}

