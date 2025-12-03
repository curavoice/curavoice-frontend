/**
 * Custom hook for managing training sessions with comprehensive logging
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef(false);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null); // Track current playing audio
  const audioChunksRef = useRef<Blob[]>([]); // Accumulate audio chunks before sending
  const closingRef = useRef(false);
  const lastResynthRequestRef = useRef(0);
  const lastDisconnectToastRef = useRef(0);

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

  const requestResynthesis = useCallback((reason: string) => {
    const now = Date.now();
    if (now - lastResynthRequestRef.current < 1500) {
      console.log('[WebSocket Audio] Resynthesis recently requested, skipping duplicate');
      return;
    }

    lastResynthRequestRef.current = now;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'request_resynthesis', reason }));
        console.log('[WebSocket Audio] Requested re-synthesis:', reason);
      } catch (err) {
        console.error('[WebSocket Audio] Failed to request re-synthesis:', err);
      }
    } else {
      console.warn('[WebSocket Audio] Cannot request re-synthesis - WebSocket not open');
    }

    toast({
      title: 'Replaying Echo\'s response',
      description: 'Audio glitch detected. Asking Echo to resend a clean take.',
    });
  }, [toast]);

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

      if (audioBlob.size === 0) {
        console.warn('[Audio Queue] Received empty audio blob, requesting re-synthesis');
        isPlayingRef.current = false;
        setIsSpeaking(false);
        requestResynthesis('empty_blob');
        if (audioQueueRef.current.length > 0) {
          playNextInQueue();
        }
        return;
      }
      
      console.log('[Audio Queue] Playing audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type,
        queueRemaining: audioQueueRef.current.length
      });

      const arrayBuffer = await audioBlob.arrayBuffer();
      console.log('[Audio Queue] ArrayBuffer size:', arrayBuffer.byteLength);

      if (arrayBuffer.byteLength === 0) {
        console.warn('[Audio Queue] Audio buffer empty after conversion, requesting re-synthesis');
        isPlayingRef.current = false;
        setIsSpeaking(false);
        requestResynthesis('empty_buffer');
        if (audioQueueRef.current.length > 0) {
          playNextInQueue();
        }
        return;
      }
      
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      } catch (decodeError) {
        console.error('[Audio Queue] Failed to decode audio buffer:', decodeError);
        isPlayingRef.current = false;
        setIsSpeaking(false);
        requestResynthesis('decode_error');
        if (audioQueueRef.current.length > 0) {
          playNextInQueue();
        }
        return;
      }

      if (!audioBuffer || !Number.isFinite(audioBuffer.duration) || audioBuffer.duration === 0) {
        console.warn('[Audio Queue] Invalid or silent audio buffer, requesting re-synthesis');
        isPlayingRef.current = false;
        setIsSpeaking(false);
        requestResynthesis('invalid_audio_buffer');
        if (audioQueueRef.current.length > 0) {
          playNextInQueue();
        }
        return;
      }

      if (audioBuffer.duration < 0.15 && audioBlob.size < 1000) {
        console.warn('[Audio Queue] Audio buffer extremely short, requesting cleaner synthesis', {
          duration: audioBuffer.duration,
          size: audioBlob.size
        });
        isPlayingRef.current = false;
        setIsSpeaking(false);
        requestResynthesis('too_short_audio');
        if (audioQueueRef.current.length > 0) {
          playNextInQueue();
        }
        return;
      }
      console.log('[Audio Queue] Decoded audio:', {
        duration: audioBuffer.duration,
        channels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate
      });
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      // Store reference to current audio source so we can stop it if needed
      currentAudioSourceRef.current = source;
      
      source.onended = () => {
        console.log('[Audio Queue] Audio chunk finished playing');
        currentAudioSourceRef.current = null; // Clear ref when done
        playNextInQueue();
      };
      
      console.log('[Audio Queue] Starting playback...');
      source.start();
      
    } catch (err) {
      console.error('[Audio Queue] Failed to play audio:', err);
      currentAudioSourceRef.current = null; // Clear ref on error
      isPlayingRef.current = false;
      setIsSpeaking(false);
      // Try to play next in queue
      if (audioQueueRef.current.length > 0) {
        playNextInQueue();
      }
    }
  }, [requestResynthesis]);

  // Handle received audio
  const handleAudio = useCallback(async (audioBlob: Blob) => {
    console.log('[WebSocket Audio] Received audio blob:', {
      size: audioBlob.size,
      type: audioBlob.type
    });

    if (audioBlob.size === 0) {
      console.warn('[WebSocket Audio] Empty audio blob received, requesting re-synthesis');
      requestResynthesis('empty_blob');
      return;
    }

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
  }, [playNextInQueue, requestResynthesis]);

  const handleSocketClose = useCallback((event: CloseEvent) => {
    console.log('[WebSocket] Close event received:', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });

    isPlayingRef.current = false;
    setIsSpeaking(false);
    setIsConnected(false);

    if (closingRef.current) {
      console.log('[WebSocket] Closure initiated by client, skipping toast');
      closingRef.current = false;
      return;
    }

    // 1005 = No Status Received - this is a normal close, NOT an error
    const isExpectedClose = event.code === 1000 || event.code === 1001 || event.code === 1005;
    const isNetworkIssue = event.code === 1006;

    // Only show errors for truly unexpected closures (server errors, etc.)
    // Don't show errors for normal closes (1000, 1001, 1005) or network issues (1006)
    if (!isExpectedClose && !isNetworkIssue && event.code !== 0) {
      const disconnectReason = event.reason || 'Connection closed unexpectedly';
      const now = Date.now();
      if (now - lastDisconnectToastRef.current > 2000) {
        lastDisconnectToastRef.current = now;
        toast({
          variant: 'destructive',
          title: 'Session Error',
          description: `${disconnectReason}. Start a new session to continue.`,
        });
      }
      setError(disconnectReason);
    }
    // For expected closes and network issues, just clear state silently
  }, [toast]);

  // Start training session
  const startSession = useCallback(async (request?: CreateSessionRequest) => {
    console.log('[Session] Starting new training session with request:', request);
    try {
      setError(null);
      closingRef.current = false;
      lastDisconnectToastRef.current = 0;
      
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
          }
        },
        handleAudio,
        (err) => {
          console.error('[WebSocket] Connection error:', err);
          setError(err.message || 'Connection lost. Tap End Session to reconnect.');
          setIsConnected(false);
        },
        handleSocketClose
      );
      
      wsRef.current = ws;
      console.log('[WebSocket] Connection initiated, readyState:', ws.readyState);
      
    } catch (err) {
      console.error('[Session] Failed to start:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
    }
  }, [handleAudio, handleSocketClose]);

  // Stop training session
  const stopSession = useCallback(async () => {
    console.log('[Session] Stopping session...');
    console.trace('[Session] Stack trace for stopSession call:'); // Add stack trace to see who's calling it
    try {
      closingRef.current = true;
      
      // Stop any currently playing audio immediately
      if (currentAudioSourceRef.current) {
        console.log('[Audio] Stopping current audio playback...');
        try {
          currentAudioSourceRef.current.stop();
          currentAudioSourceRef.current = null;
        } catch (err) {
          // Audio source may have already finished, ignore error
          console.log('[Audio] Audio source already stopped or finished');
        }
      }
      
      // Clear audio queue to prevent any more audio from playing
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      setIsSpeaking(false);
      
      // Stop recording if active
      if (mediaRecorderRef.current && isRecording) {
        console.log('[Recording] Stopping recording...');
        try {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(track => {
            console.log('[Recording] Stopping track:', track.kind);
            track.stop();
          });
        } catch (err) {
          console.warn('[Recording] Error stopping recorder:', err);
        }
        setIsRecording(false);
      }

      // Close WebSocket (this will stop any pending requests)
      if (wsRef.current) {
        console.log('[WebSocket] Closing connection...');
        try {
          wsRef.current.close();
        } catch (err) {
          console.warn('[WebSocket] Error closing connection:', err);
        }
        wsRef.current = null;
      }

      // End session via API
      if (session) {
        console.log('[Session] Ending session via API:', session.id);
        try {
          await endTrainingSession(session.id);
        } catch (err) {
          console.warn('[Session] Error ending session via API:', err);
          // Continue anyway - session will be saved on disconnect
        }
      }

      // Close audio context (this will stop all audio processing)
      if (audioContextRef.current) {
        console.log('[Audio] Closing AudioContext...');
        try {
          await audioContextRef.current.close();
        } catch (err) {
          console.warn('[Audio] Error closing AudioContext:', err);
        }
        audioContextRef.current = null;
      }

      // Clear all state
      setIsConnected(false);
      setSession(null);
      console.log('[Session] Session stopped successfully - all operations halted');
      
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

      // Use 250ms timeslice for better audio chunks (100ms was too small)
      console.log('[Recording] Starting MediaRecorder with 250ms timeslice...');
      mediaRecorder.start(250);
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const recorder = mediaRecorderRef.current;
      const stream = recorder.stream;
      
      // Set up onstop handler BEFORE calling stop() to ensure we capture all data
      recorder.onstop = () => {
        console.log('[Recording] MediaRecorder stopped, processing chunks...');
        
        // Give a small delay to ensure all ondataavailable events have fired
        setTimeout(() => {
          // Send accumulated audio chunks
          if (audioChunksRef.current.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
            const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
            console.log('[Recording] Combining', audioChunksRef.current.length, 'chunks, total size:', totalSize);
            
            // Check minimum audio size (at least 1KB for meaningful audio)
            if (totalSize < 1000) {
              console.warn('[Recording] Audio too short, may not be recognized. Size:', totalSize);
            }
            
            // Combine all chunks into one blob
            const combinedBlob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' });
            console.log('[Recording] Combined blob size:', combinedBlob.size, 'type:', combinedBlob.type);
            
            console.log('[Recording] Sending combined audio to server...');
            sendAudioToTraining(wsRef.current, combinedBlob);
            
            // Clear chunks for next recording
            audioChunksRef.current = [];
          } else if (audioChunksRef.current.length === 0) {
            console.warn('[Recording] No audio chunks to send - speak longer or check microphone');
          } else {
            console.warn('[Recording] WebSocket not open, cannot send audio. State:', wsRef.current?.readyState);
          }
          
          // Stop all tracks
          stream.getTracks().forEach(track => {
            console.log('[Recording] Stopping track:', track.kind);
            track.stop();
          });
        }, 100); // Small delay to ensure all data is captured
      };
      
      try {
        // Request final data before stopping
        if (recorder.state === 'recording') {
          recorder.requestData(); // Force any pending data to be delivered
        }
        recorder.stop();
        mediaRecorderRef.current = null;
        setIsRecording(false);
        console.log('[Recording] Stop requested, waiting for data...');
      } catch (err) {
        console.error('[Recording] Error stopping recording:', err);
        setIsRecording(false);
      }
    } else {
      console.warn('[Recording] No active MediaRecorder to stop');
      setIsRecording(false);
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
