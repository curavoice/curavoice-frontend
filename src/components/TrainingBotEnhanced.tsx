'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Mic, MicOff, Square, AlertCircle, Award, HelpCircle } from 'lucide-react'
import { useTrainingSession } from '@/hooks/useTrainingSession'
import OSCEFeedback from './OSCEFeedback'
import MicrophoneTutorial from './MicrophoneTutorial'
import MicrophoneHelp from './MicrophoneHelp'
import { formatScenarioTitle } from '@/lib/utils'
import { getTrainingFeatures } from '@/lib/trainingApi'

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
  const [showTutorial, setShowTutorial] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  
  // New state for mode, category, and custom scenario
  const [mode, setMode] = useState<'clinical' | 'nonclinical'>('clinical')
  const [medicalCategory, setMedicalCategory] = useState<string>('random')
  const [customScenario, setCustomScenario] = useState<string>('')
  const [useCustomScenario, setUseCustomScenario] = useState(false)
  const [evaluationAvailable, setEvaluationAvailable] = useState(true)

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

  useEffect(() => {
    let isMounted = true
    const fetchFeatures = async () => {
      try {
        const data = await getTrainingFeatures()
        if (isMounted) {
          setEvaluationAvailable(data.evaluation_available !== false)
        }
      } catch (err) {
        console.warn('[TrainingBot] Failed to load training feature flags', err)
      }
    }
    fetchFeatures()
    return () => {
      isMounted = false
    }
  }, [])

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

  // Check if user has seen tutorial before
  useEffect(() => {
    if (session && isConnected) {
      const hasSeenTutorial = localStorage.getItem('curavoice_tutorial_seen')
      if (!hasSeenTutorial) {
        // Small delay to let UI settle
        setTimeout(() => {
          setShowTutorial(true)
        }, 500)
      }
    }
  }, [session, isConnected])

  const handleTutorialClose = () => {
    setShowTutorial(false)
    localStorage.setItem('curavoice_tutorial_seen', 'true')
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

              {/* Controls */}
              <div className="voice-bot-controls relative">
                {/* Help Button - Top Right */}
                {session && isConnected && (
                  <button
                    onClick={() => setShowHelp(true)}
                    className="absolute top-0 right-0 p-2 text-gray-400 hover:text-indigo-600 transition-colors rounded-full hover:bg-indigo-50 z-10"
                    aria-label="Show microphone help"
                    title="How to use the microphone"
                  >
                    <HelpCircle className="w-5 h-5" />
                  </button>
                )}

                {/* Microphone Button (Main Control) */}
                <div className="flex flex-col items-center gap-4">
                  <button
                    onClick={handleToggleMicrophone}
                    className={`voice-bot-mic-main ${isRecording ? 'active' : ''} ${isSpeaking ? 'opacity-50' : ''}`}
                    disabled={!isConnected || isSpeaking}
                    aria-label={isRecording ? 'Stop speaking and send' : 'Start speaking'}
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
                  
                  {/* Clean Status Display */}
                  <div className="flex flex-col items-center gap-2">
                    {/* Single Status Badge */}
                    <span
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                        isRecording
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : isSpeaking
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-gray-50 text-gray-600 border border-gray-200'
                      }`}
                    >
                      {isRecording ? 'Listening...' : isSpeaking ? 'Echo is replying...' : 'Ready to speak'}
                    </span>
                    
                    {/* Subtle Hint - Only show when idle */}
                    {!isRecording && !isSpeaking && isConnected && (
                      <p className="text-xs text-gray-500 text-center max-w-[200px]">
                        Tap to start, tap again to send
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons - Clear separation between End Session and Get Feedback */}
                <div className="flex flex-col items-center gap-3 mt-4">
                  {/* Get Feedback Button - Primary action when available */}
                  {(completedSessionId || session) && timer >= 35 && evaluationAvailable && (
                    <button
                      onClick={handleViewFeedback}
                      disabled={isEndingSession}
                      className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl transition-all duration-200 ${isEndingSession ? 'opacity-50 cursor-wait' : ''}`}
                      aria-label="Get performance feedback"
                      title="End session and get your performance evaluation"
                    >
                      {isEndingSession ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      ) : (
                        <Award className="w-5 h-5" />
                      )}
                      <span>{isEndingSession ? 'Evaluating...' : 'Get Feedback'}</span>
                    </button>
                  )}
                  
                  {/* Feedback not ready yet indicator */}
                  {(completedSessionId || session) && timer < 35 && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm">
                      <Award className="w-4 h-4" />
                      <span>Feedback available after 30s ({timer}s)</span>
                    </div>
                  )}

                  {/* End Session Button - Always visible, clearly styled as destructive action */}
                  <button
                    onClick={handleResetSession}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white border-2 border-red-300 text-red-600 font-medium hover:bg-red-50 hover:border-red-400 hover:text-red-700 transition-all duration-200"
                    aria-label="End session without feedback"
                    title="End this training session"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>End Session</span>
                  </button>

                  {/* Evaluation unavailable notice */}
                  {!evaluationAvailable && (
                    <p className="text-xs text-amber-600 text-center max-w-[250px]">
                      ⚠️ Feedback temporarily unavailable. Your sessions are still saved.
                    </p>
                  )}
                </div>
              </div>

              {/* Helpful Tips - Cleaner */}
              {session && isConnected && (
                <div className="voice-bot-tips">
                  <button
                    onClick={() => setShowTutorial(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 underline transition-colors"
                  >
                    Need help? View microphone guide
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Microphone Tutorial */}
      {showTutorial && (
        <MicrophoneTutorial
          onClose={handleTutorialClose}
        />
      )}

      {/* Microphone Help */}
      {showHelp && (
        <MicrophoneHelp
          onClose={() => setShowHelp(false)}
        />
      )}

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
