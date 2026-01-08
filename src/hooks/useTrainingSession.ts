/**
 * Custom hook for managing training sessions with comprehensive logging
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  createTrainingSession,
  connectToTrainingConversation,
  endTrainingSession,
  sendAudioToTraining,
  TrainingSession,
  CreateSessionRequest
} from '@/lib/trainingApi';

interface UseTrainingSessionReturn {
  session: TrainingSession | null;
  isConnected: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  error: string | null;
  lastAiMessage: string | null;
  conversationEnding: boolean;
  startSession: (request?: CreateSessionRequest) => Promise<void>;
  stopSession: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

// Phrases that indicate the patient is ending the conversation
const CONVERSATION_ENDING_PHRASES = [
  'have a great day',
  'have a good day',
  'take care',
  'thanks for your help',
  'thank you for your help',
  'i feel better now',
  'i feel much better',
  'that\'s all i needed',
  'that\'s everything',
  'i think i\'m good',
  'i\'m good now',
  'thanks so much',
  'thank you so much',
  'bye',
  'goodbye',
  'see you',
  'i appreciate your help',
  'you\'ve been very helpful',
  'that answers my questions',
  'that answers everything',
  'i understand now',
  'that makes sense now',
  'i\'ll do that',
  'i\'ll follow those instructions',
];

function detectConversationEnding(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return CONVERSATION_ENDING_PHRASES.some(phrase => lowerMessage.includes(phrase));
}

export function useTrainingSession(): UseTrainingSessionReturn {
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAiMessage, setLastAiMessage] = useState<string | null>(null);
  const [conversationEnding, setConversationEnding] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef(false);
  const audioChunksRef = useRef<Blob[]>([]); // Accumulate audio chunks before sending

  // Log everything for debugging
  useEffect(() => {
    console.log('[useTrainingSession] State updated:', {
      hasSession: !!session,
      sessionId: session?.id,
      isConnected,
      isRecording,
      isSpeaking,
      error
    });
  }, [session, isConnected, isRecording, isSpeaking, error]);

  // Play audio from queue
  const playNextInQueue = useCallback(async () => {
    console.log('[Audio Queue] Checking queue, length:', audioQueueRef.current.length, 'isPlaying:', isPlayingRef.current);
    
    if (audioQueueRef.current.length === 0) {
      console.log('[Audio Queue] Queue empty, stopping playback');
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }
    
    if (!audioContextRef.current) {
      console.error('[Audio Queue] AudioContext not initialized!');
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    try {
      isPlayingRef.current = true;
      setIsSpeaking(true);
      const audioBlob = audioQueueRef.current.shift()!;
      
      console.log('[Audio Queue] Playing audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type,
        queueRemaining: audioQueueRef.current.length
      });

      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log('[Audio Queue] ArrayBuffer size:', arrayBuffer.byteLength);
      
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      console.log('[Audio Queue] Decoded audio:', {
        duration: audioBuffer.duration,
        channels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate
      });
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        console.log('[Audio Queue] Audio chunk finished playing');
        playNextInQueue();
      };
      
      console.log('[Audio Queue] Starting playback...');
      source.start();
      
    } catch (err) {
      console.error('[Audio Queue] Failed to play audio:', err);
      isPlayingRef.current = false;
      setIsSpeaking(false);
      // Try to play next in queue
      if (audioQueueRef.current.length > 0) {
        playNextInQueue();
      }
    }
  }, []);

  // Handle received audio
  const handleAudio = useCallback(async (audioBlob: Blob) => {
    console.log('[WebSocket Audio] Received audio blob:', {
      size: audioBlob.size,
      type: audioBlob.type
    });

    if (!audioContextRef.current) {
      console.log('[WebSocket Audio] Creating new AudioContext...');
      try {
        audioContextRef.current = new AudioContext();
        console.log('[WebSocket Audio] AudioContext created:', {
          sampleRate: audioContextRef.current.sampleRate,
          state: audioContextRef.current.state
        });
      } catch (err) {
        console.error('[WebSocket Audio] Failed to create AudioContext:', err);
        setError('Failed to initialize audio playback');
        return;
      }
    }

    // Resume AudioContext if suspended (browser autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      console.log('[WebSocket Audio] AudioContext suspended, attempting to resume...');
      try {
        await audioContextRef.current.resume();
        console.log('[WebSocket Audio] AudioContext resumed, state:', audioContextRef.current.state);
      } catch (err) {
        console.error('[WebSocket Audio] Failed to resume AudioContext:', err);
      }
    }

    audioQueueRef.current.push(audioBlob);
    console.log('[WebSocket Audio] Added to queue, total in queue:', audioQueueRef.current.length);
    
    if (!isPlayingRef.current) {
      console.log('[WebSocket Audio] Queue not playing, starting playback...');
      playNextInQueue();
    } else {
      console.log('[WebSocket Audio] Queue already playing, will play when ready');
    }
  }, [playNextInQueue]);

  // Start training session
  const startSession = useCallback(async (request?: CreateSessionRequest) => {
    console.log('[Session] Starting new training session with request:', request);
    try {
      setError(null);
      
      // 1. Create session
      console.log('[Session] Creating session via API...');
      const newSession = await createTrainingSession(request || {});
      console.log('[Session] Session created:', {
        id: newSession.id,
        scenario: newSession.scenario_title,
        mood: newSession.patient_mood,
        category: newSession.category
      });
      setSession(newSession);
      
      // Reset conversation ending state for new session
      setConversationEnding(false);
      setLastAiMessage(null);
      
      // 2. Connect WebSocket
      console.log('[WebSocket] Connecting to session:', newSession.id);
      const ws = connectToTrainingConversation(
        newSession.id,
        (data) => {
          console.log('[WebSocket Message] Received:', data);
          if (data.type === 'status' && data.message === 'connected') {
            console.log('[WebSocket] Connection confirmed!');
            setIsConnected(true);
          } else if (data.type === 'error') {
            console.error('[WebSocket Error]:', data.message);
            setError(data.message);
          } else if (data.type === 'ai_response_text' && data.text) {
            // Track AI response and detect conversation ending
            console.log('[WebSocket] AI response text:', data.text);
            setLastAiMessage(data.text);
            
            // Check if the patient is signaling end of conversation
            if (detectConversationEnding(data.text)) {
              console.log('[WebSocket] Conversation ending detected!');
              setConversationEnding(true);
            }
          }
        },
        handleAudio,
        (err) => {
          console.error('[WebSocket] Connection error:', err);
          // Don't show error if it's an expected closure (e.g., when ending session)
          // Check if error message indicates a normal closure or network issue
          if (err.message && (
            err.message.includes('WebSocket closed') ||
            err.message.includes('closed unexpectedly') ||
            err.message.includes('Connection closed') ||
            err.message.includes('network') ||
            err.message.includes('Connection lost')
          )) {
            console.log('[WebSocket] Expected closure or network issue, not showing error');
            setIsConnected(false);
            return;
          }
          // Only set error for unexpected errors, not network issues
          if (!err.message.includes('network') && !err.message.includes('Connection lost')) {
            setError(err.message);
          }
          setIsConnected(false);
        }
      );
      
      wsRef.current = ws;
      console.log('[WebSocket] Connection initiated, readyState:', ws.readyState);
      
    } catch (err) {
      console.error('[Session] Failed to start:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  }, [handleAudio]);

  // Stop training session
  const stopSession = useCallback(async () => {
    console.log('[Session] Stopping session...');
    console.trace('[Session] Stack trace for stopSession call:'); // Add stack trace to see who's calling it
    try {
      // Stop recording if active
      if (mediaRecorderRef.current && isRecording) {
        console.log('[Recording] Stopping recording...');
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => {
          console.log('[Recording] Stopping track:', track.kind);
          track.stop();
        });
        setIsRecording(false);
      }

      // Close WebSocket
      if (wsRef.current) {
        console.log('[WebSocket] Closing connection...');
        wsRef.current.close();
        wsRef.current = null;
      }

      // End session
      if (session) {
        console.log('[Session] Ending session via API:', session.id);
        await endTrainingSession(session.id);
      }

      // Clear audio context
      if (audioContextRef.current) {
        console.log('[Audio] Closing AudioContext...');
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      audioQueueRef.current = [];
      isPlayingRef.current = false;
      setIsConnected(false);
      setSession(null);
      setIsSpeaking(false);
      console.log('[Session] Session stopped successfully');
      
    } catch (err) {
      console.error('[Session] Error stopping session:', err);
      setError(err instanceof Error ? err.message : 'Failed to stop session');
    }
  }, [session, isRecording]);

  // Start recording user audio
  const startRecording = useCallback(async () => {
    console.log('[Recording] Requesting microphone access...');
    
    // Clear any previous audio chunks
    audioChunksRef.current = [];
    console.log('[Recording] Cleared previous audio chunks');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });

      console.log('[Recording] Microphone access granted');
      console.log('[Recording] Audio tracks:', stream.getAudioTracks().map(t => ({
        kind: t.kind,
        label: t.label,
        enabled: t.enabled,
        muted: t.muted
      })));

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      
      console.log('[Recording] Using mimeType:', mimeType);

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('[Recording] Audio chunk available:', {
            size: event.data.size,
            type: event.data.type
          });
          
          // Accumulate chunks instead of sending immediately
          audioChunksRef.current.push(event.data);
          console.log('[Recording] Accumulated chunks:', audioChunksRef.current.length, 'Total size:', audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0));
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('[Recording] MediaRecorder error:', event);
      };

      mediaRecorder.onstart = () => {
        console.log('[Recording] MediaRecorder started');
      };

      mediaRecorder.onstop = () => {
        console.log('[Recording] MediaRecorder stopped');
      };

      console.log('[Recording] Starting MediaRecorder with 100ms timeslice...');
      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      console.log('[Recording] Recording started successfully');
      
    } catch (err) {
      console.error('[Recording] Failed to access microphone:', err);
      setError('Failed to access microphone. Please check permissions.');
    }
  }, []);

  // Stop recording user audio
  const stopRecording = useCallback(() => {
    console.log('[Recording] Stopping recording...');
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
        
        // Send accumulated audio chunks
        if (audioChunksRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
          console.log('[Recording] Combining', audioChunksRef.current.length, 'chunks, total size:', totalSize);
          
          // Combine all chunks into one blob
          const combinedBlob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0].type });
          console.log('[Recording] Combined blob size:', combinedBlob.size, 'type:', combinedBlob.type);
          
          console.log('[Recording] Sending combined audio to server...');
          sendAudioToTraining(wsRef.current, combinedBlob);
          
          // Clear chunks for next recording
          audioChunksRef.current = [];
        } else if (audioChunksRef.current.length === 0) {
          console.warn('[Recording] No audio chunks to send');
        } else {
          console.warn('[Recording] WebSocket not open, cannot send audio. State:', wsRef.current?.readyState);
        }
        
        mediaRecorderRef.current.stream.getTracks().forEach(track => {
          console.log('[Recording] Stopping track:', track.kind);
          track.stop();
        });
        mediaRecorderRef.current = null;
        setIsRecording(false);
        console.log('[Recording] Recording stopped successfully');
      } catch (err) {
        console.error('[Recording] Error stopping recording:', err);
      }
    } else {
      console.warn('[Recording] No active MediaRecorder to stop');
    }
  }, []);

  return {
    session,
    isConnected,
    isRecording,
    isSpeaking,
    error,
    lastAiMessage,
    conversationEnding,
    startSession,
    stopSession,
    startRecording,
    stopRecording,
  };
}

