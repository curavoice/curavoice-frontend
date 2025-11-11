/**
 * Custom hook for managing training sessions with comprehensive logging
 * Enhanced with mobile optimizations: Safari/iOS support, ping/pong, auto-reconnection
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  createTrainingSession,
  connectToTrainingConversation,
  endTrainingSession,
  sendAudioToTraining,
  TrainingSession,
  CreateSessionRequest,
  WebSocketManager
} from '@/lib/trainingApi';
import {
  getOptimalAudioMimeType,
  getOptimalAudioBitrate,
  getBatteryAwareBitrate,
  initializeAudioContext,
  WakeLockManager,
  setupVisibilityChangeHandler,
  logMobileOptimizationInfo
} from '@/lib/mobileOptimizations';

interface UseTrainingSessionReturn {
  session: TrainingSession | null;
  isConnected: boolean;
  isRecording: boolean;
  isSpeaking: boolean;
  error: string | null;
  startSession: (request?: CreateSessionRequest) => Promise<void>;
  stopSession: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useTrainingSession(): UseTrainingSessionReturn {
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef(false);
  const audioChunksRef = useRef<Blob[]>([]); // Accumulate audio chunks before sending
  const wakeLockManagerRef = useRef<WakeLockManager | null>(null);
  const visibilityCleanupRef = useRef<(() => void) | null>(null);

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

  // Initialize mobile optimizations on mount
  useEffect(() => {
    console.log('[Mobile Optimization] Initializing...');
    logMobileOptimizationInfo();

    // Initialize wake lock manager
    wakeLockManagerRef.current = new WakeLockManager();

    // Setup background/foreground handling
    visibilityCleanupRef.current = setupVisibilityChangeHandler(
      () => {
        // App backgrounded - pause recording
        console.log('[Mobile] App backgrounded');
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          console.log('[Mobile] Pausing recording due to background');
          try {
            mediaRecorderRef.current.pause();
          } catch (err) {
            console.error('[Mobile] Failed to pause recording:', err);
          }
        }
      },
      () => {
        // App foregrounded - resume recording
        console.log('[Mobile] App foregrounded');
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
          console.log('[Mobile] Resuming recording');
          try {
            mediaRecorderRef.current.resume();
          } catch (err) {
            console.error('[Mobile] Failed to resume recording:', err);
          }
        }

        // Ensure AudioContext is running
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          console.log('[Mobile] Resuming AudioContext');
          audioContextRef.current.resume();
        }
      }
    );

    // Cleanup on unmount
    return () => {
      console.log('[Mobile Optimization] Cleaning up...');
      if (visibilityCleanupRef.current) {
        visibilityCleanupRef.current();
      }
      if (wakeLockManagerRef.current) {
        wakeLockManagerRef.current.release();
      }
    };
  }, []);

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
      console.log('[WebSocket Audio] Creating new AudioContext (iOS-compatible)...');
      try {
        const context = await initializeAudioContext();
        if (!context) {
          console.error('[WebSocket Audio] Failed to initialize AudioContext');
          setError('Failed to initialize audio playback');
          return;
        }
        audioContextRef.current = context;
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

    // Resume AudioContext if suspended (browser autoplay policy / iOS)
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

      // Request wake lock to prevent screen sleep
      if (wakeLockManagerRef.current) {
        console.log('[Session] Requesting wake lock...');
        await wakeLockManagerRef.current.request();
      }

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

      // 2. Connect WebSocket with auto-reconnection
      console.log('[WebSocket] Connecting to session:', newSession.id);
      const wsManager = connectToTrainingConversation(
        newSession.id,
        (data) => {
          console.log('[WebSocket Message] Received:', data);
          if (data.type === 'status' && data.message === 'connected') {
            console.log('[WebSocket] Connection confirmed!');
            setIsConnected(true);
          } else if (data.type === 'error') {
            console.error('[WebSocket Error]:', data.message);
            setError(data.message);
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
        },
        (attempt) => {
          // On reconnecting
          console.log(`[WebSocket] Reconnection attempt ${attempt}...`);
          setIsConnected(false);
        },
        () => {
          // On reconnected
          console.log('[WebSocket] Successfully reconnected!');
          setIsConnected(true);
        }
      );

      wsManagerRef.current = wsManager;
      console.log('[WebSocket] WebSocketManager created and connecting...');

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

      // Close WebSocket (using WebSocketManager)
      if (wsManagerRef.current) {
        console.log('[WebSocket] Closing connection...');
        wsManagerRef.current.close();
        wsManagerRef.current = null;
      }

      // Release wake lock
      if (wakeLockManagerRef.current) {
        console.log('[Session] Releasing wake lock...');
        wakeLockManagerRef.current.release();
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

    // Initialize AudioContext for iOS (must be called on user interaction)
    if (!audioContextRef.current) {
      console.log('[Recording] Initializing AudioContext for iOS...');
      const context = await initializeAudioContext();
      if (context) {
        audioContextRef.current = context;
      }
    }

    // Clear any previous audio chunks
    audioChunksRef.current = [];
    console.log('[Recording] Cleared previous audio chunks');

    try {
      // Detect optimal audio format for this browser
      const mimeType = getOptimalAudioMimeType();

      // Detect optimal bitrate based on network quality and battery
      let bitrate = getOptimalAudioBitrate();
      bitrate = await getBatteryAwareBitrate(bitrate);

      console.log('[Recording] Optimal settings:', { mimeType, bitrate });

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

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: bitrate
      });

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
        if (audioChunksRef.current.length > 0 && wsManagerRef.current?.isConnected()) {
          const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
          console.log('[Recording] Combining', audioChunksRef.current.length, 'chunks, total size:', totalSize);

          // Combine all chunks into one blob
          const combinedBlob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0].type });
          console.log('[Recording] Combined blob size:', combinedBlob.size, 'type:', combinedBlob.type);

          console.log('[Recording] Sending combined audio to server...');
          sendAudioToTraining(wsManagerRef.current, combinedBlob);

          // Clear chunks for next recording
          audioChunksRef.current = [];
        } else if (audioChunksRef.current.length === 0) {
          console.warn('[Recording] No audio chunks to send');
        } else {
          console.warn('[Recording] WebSocket not connected, cannot send audio');
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
    startSession,
    stopSession,
    startRecording,
    stopRecording,
  };
}

