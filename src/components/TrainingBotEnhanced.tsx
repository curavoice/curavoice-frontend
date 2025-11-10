'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Mic, MicOff, RotateCcw, AlertCircle, Award } from 'lucide-react'
import { useTrainingSession } from '@/hooks/useTrainingSession'
import OSCEFeedback from './OSCEFeedback'
import { formatScenarioTitle } from '@/lib/utils'

interface Scenario {
  id: string
  name: string
  description: string
  icon: string
}

interface TrainingBotProps {
  scenarios: Scenario[]
}

export default function TrainingBotEnhanced({ scenarios }: TrainingBotProps) {
  const {
    session,
    isConnected,
    isRecording,
    isSpeaking,
    error,
    startSession,
    stopSession,
    startRecording,
    stopRecording,
  } = useTrainingSession();

  const [timer, setTimer] = useState(0)
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null) // Store the selected category
  const [showFeedback, setShowFeedback] = useState(false)
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null)
  const [isEndingSession, setIsEndingSession] = useState(false)
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false)
  
  // New state for mode, category, and custom scenario
  const [mode, setMode] = useState<'clinical' | 'nonclinical'>('clinical')
  const [medicalCategory, setMedicalCategory] = useState<string>('random')
  const [customScenario, setCustomScenario] = useState<string>('')
  const [useCustomScenario, setUseCustomScenario] = useState(false)

  // Timer effect
  useEffect(() => {
    console.log('[TrainingBot] Effect - session exists:', !!session, 'isConnected:', isConnected);
    let interval: NodeJS.Timeout
    if (session && isConnected) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [session, isConnected])

  // Helper function to format category name
  const formatCategoryName = (category: string): string => {
    if (category === 'random') return 'Random Scenario';
    if (category === 'otc') return 'OTC Scenario';
    // Use formatScenarioTitle for categories with underscores
    return formatScenarioTitle(category) + ' Scenario';
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStartSession = async () => {
    console.log('[TrainingBot] Starting session with mode:', mode, 'category:', medicalCategory, 'custom:', customScenario);
    
    // Prepare session request
    const sessionRequest: any = {
      mode: mode,
    };
    
    if (useCustomScenario && customScenario.trim()) {
      sessionRequest.custom_scenario = customScenario.trim();
      setSelectedScenario('Custom Scenario');
      setSelectedCategory(null); // Clear category for custom scenarios
    } else if (mode === 'nonclinical') {
      setSelectedScenario('Nonclinical Scenario');
      setSelectedCategory('nonclinical');
    } else if (mode === 'clinical' && medicalCategory !== 'random') {
      sessionRequest.medical_category = medicalCategory;
      const categoryDisplayName = formatCategoryName(medicalCategory);
      setSelectedScenario(categoryDisplayName);
      setSelectedCategory(medicalCategory); // Store the category
    } else {
      setSelectedScenario('Random Scenario');
      setSelectedCategory('random');
    }
    
    await startSession(sessionRequest);
  }

  const handleToggleMicrophone = () => {
    console.log('[TrainingBot] Toggle microphone, current state:', { isRecording, isConnected });
    
    if (!isConnected) {
      console.warn('[TrainingBot] Cannot toggle mic - not connected');
      return;
    }
    
    if (isRecording) {
      console.log('[TrainingBot] Stopping recording...');
      stopRecording();
    } else {
      console.log('[TrainingBot] Starting recording...');
      startRecording();
    }
  }

  const handleResetSession = async () => {
    console.log('[TrainingBot] Resetting session...');
    // Store session ID before stopping
    if (session?.id) {
      setCompletedSessionId(session.id);
    }
    await stopSession();
    setSelectedScenario(null);
    setSelectedCategory(null);
    setTimer(0);
  }

  const handleViewFeedback = () => {
    // If session is active, show confirmation dialog
    if (session && isConnected) {
      setShowEndSessionConfirm(true);
    } else if (completedSessionId || session?.id) {
      // Session already ended, just show feedback
      setShowFeedback(true);
    }
  }

  const handleConfirmEndSession = async () => {
    setShowEndSessionConfirm(false);
    
    // If session is still active, end it first before showing feedback
    if (session && isConnected) {
      try {
        setIsEndingSession(true);
        console.log('[Feedback] Ending session before showing feedback...');
        
        // Store session ID before stopping
        const sessionIdToEvaluate = session.id;
        
        // End the session (this will close WebSocket and save transcript)
        await stopSession();
        
        // Small delay to ensure WebSocket is fully closed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setCompletedSessionId(sessionIdToEvaluate);
        setSelectedScenario(null);
        setTimer(0);
        setIsEndingSession(false);
        
        // Now show feedback
        setShowFeedback(true);
      } catch (err) {
        console.error('[Feedback] Error ending session:', err);
        setIsEndingSession(false);
        // Still try to show feedback if we have a session ID
        if (session?.id) {
          setCompletedSessionId(session.id);
          setShowFeedback(true);
        }
      }
    }
  }

  const getStatusMessage = () => {
    if (error) return `Error: ${error}`;
    if (!session) return 'Select a scenario to begin';
    if (!isConnected) return 'Connecting...';
    if (isSpeaking) return 'Echo is speaking...';
    if (isRecording) return 'Listening to you...';
    return 'Tap the mic to speak';
  }

  const getConversationState = () => {
    if (isSpeaking) return 'bot-speaking';
    if (isRecording) return 'user-speaking';
    return 'idle';
  }

  const conversationState = getConversationState();

  return (
    <div className="voice-bot-container">
      <div className="voice-bot-card">
        {/* Header with Timer */}
        <div className="voice-bot-header">
          <div className="flex items-center gap-3">
            <div className="voice-bot-status-indicator">
              <div className={`voice-bot-status-dot ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            </div>
            <div>
              <h2 className="voice-bot-title">Voice Training Session</h2>
              <p className="voice-bot-subtitle">
                {isConnected ? 'Connected' : session ? 'Connecting...' : 'Not started'}
              </p>
            </div>
          </div>
          <div className="voice-bot-timer">
            <span className="voice-bot-timer-text">{formatTime(timer)}</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800 mb-1">Connection Error</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Main Voice Interface */}
        <div className="voice-bot-main">
          {!session ? (
            /* Scenario Selection */
            <div className="voice-bot-scenario-selection">
              <h3 className="voice-bot-scenario-title">Choose Your Training Scenario</h3>
              <p className="voice-bot-scenario-subtitle">Select a patient interaction to practice</p>
              
              {/* Mode Selection */}
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Training Mode</label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setMode('clinical')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        mode === 'clinical'
                          ? 'bg-[#344895] text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Clinical
                    </button>
                    <button
                      onClick={() => setMode('nonclinical')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        mode === 'nonclinical'
                          ? 'bg-[#344895] text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Nonclinical
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {mode === 'clinical' 
                      ? 'Patient Education, Drug Interactions, Counselling' 
                      : 'Insurance, Copays, Logistics'}
                  </p>
                </div>

                {/* Medical Category (Clinical only) */}
                {mode === 'clinical' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Medical Category</label>
                    <select
                      value={medicalCategory}
                      onChange={(e) => setMedicalCategory(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#344895]"
                      disabled={useCustomScenario}
                    >
                      <option value="random">Random</option>
                      <option value="cardiovascular">Cardiovascular</option>
                      <option value="otc">OTC</option>
                      <option value="respiratory">Respiratory</option>
                      <option value="diabetes">Diabetes</option>
                      <option value="pain_management">Pain Management</option>
                      <option value="mental_health">Mental Health</option>
                      <option value="pediatric">Pediatric</option>
                      <option value="geriatric">Geriatric</option>
                      <option value="womens_health">Women's Health</option>
                    </select>
                  </div>
                )}

                {/* Custom Scenario Option */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                    <input
                      type="checkbox"
                      checked={useCustomScenario}
                      onChange={(e) => {
                        setUseCustomScenario(e.target.checked);
                        if (!e.target.checked) {
                          setCustomScenario('');
                        }
                      }}
                      className="w-4 h-4"
                    />
                    Use Custom Scenario
                  </label>
                  {useCustomScenario && (
                    <textarea
                      value={customScenario}
                      onChange={(e) => setCustomScenario(e.target.value)}
                      placeholder="e.g., a hypertension patient with cough, an old patient on lisinopril"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#344895] min-h-[80px]"
                    />
                  )}
                </div>
              </div>

              {/* Start Session Button */}
              <div className="mb-6">
                <button
                  onClick={() => handleStartSession()}
                  disabled={useCustomScenario && !customScenario.trim()}
                  className="w-full px-6 py-3 bg-[#344895] text-white rounded-lg font-semibold hover:bg-[#1A1F71] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {useCustomScenario 
                    ? 'Start Custom Scenario' 
                    : mode === 'clinical'
                    ? `Start ${medicalCategory === 'random' ? 'Random' : formatScenarioTitle(medicalCategory)} Scenario`
                    : 'Start Nonclinical Scenario'}
                </button>
              </div>
              
              {/* Legacy Scenario Cards (Optional - can be hidden) */}
              {false && (
                <div className="voice-bot-scenarios-grid">
                  {scenarios.map((scenarioItem) => (
                    <button
                      key={scenarioItem.id}
                      onClick={() => handleStartSession()}
                      className="voice-bot-scenario-card"
                    >
                      <div className="voice-bot-scenario-icon">{scenarioItem.icon}</div>
                      <h4 className="voice-bot-scenario-name">{scenarioItem.name}</h4>
                      <p className="voice-bot-scenario-desc">{scenarioItem.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Active Voice Session */
            <div className="voice-bot-active-session">
              {/* Current Scenario Badge */}
              <div className="voice-bot-scenario-badge">
                <span className="voice-bot-badge-text">
                  {selectedScenario || (selectedCategory ? formatCategoryName(selectedCategory) : formatScenarioTitle(session?.scenario_title)) || 'Training Session'}
                </span>
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
                  onClick={handleToggleMicrophone}
                  className={`voice-bot-mic-main ${isRecording ? 'active' : ''}`}
                  disabled={!isConnected || isSpeaking}
                  aria-label={isRecording ? 'Stop speaking' : 'Start speaking'}
                >
                  <div className="voice-bot-mic-inner">
                    {isRecording ? (
                      <MicOff className="voice-bot-mic-icon" />
                    ) : (
                      <Mic className="voice-bot-mic-icon" />
                    )}
                  </div>
                  {isRecording && (
                    <div className="voice-bot-mic-pulse"></div>
                  )}
                </button>

                {/* Secondary Controls */}
                <div className="voice-bot-secondary-controls">
                  <button
                    onClick={handleResetSession}
                    className="voice-bot-control-button voice-bot-reset-button"
                    aria-label="Reset session"
                  >
                    <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  {(completedSessionId || session) && timer >= 35 && (
                    <button
                      onClick={handleViewFeedback}
                      disabled={isEndingSession}
                      className={`voice-bot-control-button bg-indigo-600 hover:bg-indigo-700 text-white ${isEndingSession ? 'opacity-50 cursor-wait' : ''}`}
                      aria-label="View feedback"
                      title={isEndingSession ? "Ending session..." : "Get performance feedback"}
                    >
                      {isEndingSession ? (
                        <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-white"></div>
                      ) : (
                        <Award className="w-5 h-5 sm:w-6 sm:h-6" />
                      )}
                    </button>
                  )}
                  {(completedSessionId || session) && timer < 35 && (
                    <button
                      disabled
                      className="voice-bot-control-button bg-gray-400 cursor-not-allowed opacity-50"
                      aria-label="View feedback"
                      title={`Minimum 30 seconds of conversation required (${timer}s elapsed)`}
                    >
                      <Award className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  )}
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

      {/* End Session Confirmation Dialog */}
      {showEndSessionConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <Award className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  End Session & Get Feedback?
                </h3>
                <p className="text-sm text-gray-600 mb-1">
                  This will end your current training session and generate your performance evaluation.
                </p>
                <p className="text-xs text-gray-500">
                  Session duration: <strong>{formatTime(timer)}</strong>
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEndSessionConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Continue Session
              </button>
              <button
                onClick={handleConfirmEndSession}
                disabled={isEndingSession}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2"
              >
                {isEndingSession ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Ending...</span>
                  </>
                ) : (
                  'End & Get Feedback'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OSCE Feedback Modal */}
      {showFeedback && (completedSessionId || session?.id) && (
        <OSCEFeedback
          sessionId={completedSessionId || session!.id}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  )
}

