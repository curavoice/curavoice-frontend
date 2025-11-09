'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Mic, MicOff, Volume2, VolumeX, RotateCcw } from 'lucide-react'

type ConversationState = 'idle' | 'user-speaking' | 'bot-speaking' | 'processing'

interface Scenario {
  id: string
  name: string
  description: string
  icon: string
}

interface TrainingBotProps {
  scenarios: Scenario[]
  domain: string
}

export default function TrainingBot({ scenarios }: TrainingBotProps) {
  const [conversationState, setConversationState] = useState<ConversationState>('idle')
  const [isMicEnabled, setIsMicEnabled] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)
  const [scenario, setScenario] = useState<string | null>(null)
  const [timer, setTimer] = useState(0)
  const [isSessionActive, setIsSessionActive] = useState(false)

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isSessionActive) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isSessionActive])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startSession = (selectedScenario: string) => {
    setScenario(selectedScenario)
    setIsSessionActive(true)
    setConversationState('bot-speaking')
    
    // Simulate bot greeting
    setTimeout(() => {
      setConversationState('idle')
    }, 3000)
  }

  const toggleMicrophone = () => {
    if (!isSessionActive) return
    
    if (isMicEnabled) {
      // Stop speaking
      setIsMicEnabled(false)
      setConversationState('processing')
      
      // Simulate processing and bot response
      setTimeout(() => {
        setConversationState('bot-speaking')
        setTimeout(() => {
          setConversationState('idle')
        }, 4000)
      }, 1500)
    } else {
      // Start speaking
      setIsMicEnabled(true)
      setConversationState('user-speaking')
    }
  }

  const resetSession = () => {
    setConversationState('idle')
    setIsMicEnabled(false)
    setScenario(null)
    setTimer(0)
    setIsSessionActive(false)
  }

  const getStatusMessage = () => {
    switch (conversationState) {
      case 'user-speaking':
        return 'Listening to you...'
      case 'bot-speaking':
        return 'Echo is speaking...'
      case 'processing':
        return 'Processing your response...'
      default:
        return isSessionActive ? 'Tap the mic to speak' : 'Select a scenario to begin'
    }
  }

  // const getEchoAnimationClass = () => {
  //   switch (conversationState) {
  //     case 'bot-speaking':
  //       return 'voice-bot-echo-speaking'
  //     case 'user-speaking':
  //       return 'voice-bot-echo-listening'
  //     case 'processing':
  //       return 'voice-bot-echo-processing'
  //     default:
  //       return ''
  //   }
  // }

  return (
    <div className="voice-bot-container">
      <div className="voice-bot-card">
        {/* Header with Timer */}
        <div className="voice-bot-header">
          <div className="flex items-center gap-3">
            <div className="voice-bot-status-indicator">
              <div className="voice-bot-status-dot" />
            </div>
            <div>
              <h2 className="voice-bot-title">Voice Training Session</h2>
              <p className="voice-bot-subtitle">Real-time AI Conversation</p>
            </div>
          </div>
          <div className="voice-bot-timer">
            <span className="voice-bot-timer-text">{formatTime(timer)}</span>
          </div>
        </div>

        {/* Main Voice Interface */}
        <div className="voice-bot-main">
          {!scenario ? (
            /* Scenario Selection */
            <div className="voice-bot-scenario-selection">
              <h3 className="voice-bot-scenario-title">Choose Your Training Scenario</h3>
              <p className="voice-bot-scenario-subtitle">Select a patient interaction to practice</p>
              
              <div className="voice-bot-scenarios-grid">
                {scenarios.map((scenarioItem) => (
                  <button
                    key={scenarioItem.id}
                    onClick={() => startSession(scenarioItem.name)}
                    className="voice-bot-scenario-card"
                  >
                    <div className="voice-bot-scenario-icon">{scenarioItem.icon}</div>
                    <h4 className="voice-bot-scenario-name">{scenarioItem.name}</h4>
                    <p className="voice-bot-scenario-desc">{scenarioItem.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Active Voice Session */
            <div className="voice-bot-active-session">
              {/* Current Scenario Badge */}
              <div className="voice-bot-scenario-badge">
                <span className="voice-bot-badge-text">{scenario}</span>
              </div>

              {/* Echo Character with Animations */}
              <div className="voice-bot-echo-container">
                {/* Animated sound waves */}
                <div className={`voice-bot-soundwave-container ${conversationState !== 'idle' ? 'active' : ''}`}>
                  <div className="voice-bot-soundwave voice-bot-wave-1"></div>
                  <div className="voice-bot-soundwave voice-bot-wave-2"></div>
                  <div className="voice-bot-soundwave voice-bot-wave-3"></div>
                  <div className="voice-bot-soundwave voice-bot-wave-4"></div>
                  <div className="voice-bot-soundwave voice-bot-wave-5"></div>
                </div>

                {/* Echo Avatar - Static */}
                <div className="voice-bot-echo-avatar">
                  <Image
                    src="/assets/echo-character-figma.svg"
                    alt="Echo"
                    width={200}
                    height={230}
                    className="voice-bot-echo-image"
                    priority
                  />
                </div>

                {/* User speaking indicator */}
                {conversationState === 'user-speaking' && (
                  <div className="voice-bot-user-indicator">
                    <div className="voice-bot-user-wave-container">
                      <div className="voice-bot-user-wave"></div>
                      <div className="voice-bot-user-wave"></div>
                      <div className="voice-bot-user-wave"></div>
                      <div className="voice-bot-user-wave"></div>
                      <div className="voice-bot-user-wave"></div>
                    </div>
                    <span className="voice-bot-user-label">You</span>
                  </div>
                )}
              </div>

              {/* Status Message */}
              <div className="voice-bot-status-message">
                <p className="voice-bot-status-text">{getStatusMessage()}</p>
              </div>

              {/* Controls */}
              <div className="voice-bot-controls">
                {/* Microphone Button (Main Control) */}
                <button
                  onClick={toggleMicrophone}
                  className={`voice-bot-mic-main ${isMicEnabled ? 'active' : ''}`}
                  disabled={conversationState === 'processing' || conversationState === 'bot-speaking'}
                  aria-label={isMicEnabled ? 'Stop speaking' : 'Start speaking'}
                >
                  <div className="voice-bot-mic-inner">
                    {isMicEnabled ? (
                      <MicOff className="voice-bot-mic-icon" />
                    ) : (
                      <Mic className="voice-bot-mic-icon" />
                    )}
                  </div>
                  {isMicEnabled && (
                    <div className="voice-bot-mic-pulse"></div>
                  )}
                </button>

                {/* Secondary Controls */}
                <div className="voice-bot-secondary-controls">
                  <button
                    onClick={() => setIsSoundEnabled(!isSoundEnabled)}
                    className="voice-bot-control-button"
                    aria-label={isSoundEnabled ? 'Mute' : 'Unmute'}
                  >
                    {isSoundEnabled ? (
                      <Volume2 className="w-5 h-5 sm:w-6 sm:h-6" />
                    ) : (
                      <VolumeX className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
                  </button>

                  <button
                    onClick={resetSession}
                    className="voice-bot-control-button voice-bot-reset-button"
                    aria-label="Reset session"
                  >
                    <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>
              </div>

              {/* Helpful Tips */}
              <div className="voice-bot-tips">
                <p className="voice-bot-tip-text">
                  💡 <strong>Tip:</strong> Speak clearly and naturally. Echo will respond based on your tone and empathy.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
