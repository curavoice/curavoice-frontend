/**
 * Training API Service
 * Handles communication with the backend training API
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_V1_BASE = `${API_BASE}/api/v1`;

export interface TrainingSession {
  id: string;
  user_id: string;
  category: string;
  scenario_type: string;
  scenario_id: string;
  scenario_title: string;
  patient_mood: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
}

export interface TrainingSessionDetail extends TrainingSession {
  system_prompt: string;
  conversation_data?: any;
  evaluation_score?: number;
  evaluation_feedback?: string;
}

export interface CreateSessionRequest {
  category?: string;
  scenario_type?: string;
  mode?: string; // "clinical" or "nonclinical"
  medical_category?: string; // "cardiovascular", "otc", "random", etc.
  custom_scenario?: string; // Custom scenario description
  forced_random?: boolean;
}

export interface TrainingFeatures {
  enabled_categories: Record<string, boolean>;
  evaluation_available: boolean;
  message: string;
}

/**
 * Get authentication token from localStorage
 */
async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  // Get token from localStorage (set by apiClient.login/register)
  return localStorage.getItem('access_token') || null;
}

/**
 * Create a new training session
 */
export async function createTrainingSession(
  request: CreateSessionRequest = {}
): Promise<TrainingSession> {
  console.log('[TrainingAPI] Creating training session with request:', request);
  const token = await getAuthToken();
  console.log('[TrainingAPI] Auth token:', token ? `${token.substring(0, 20)}...` : 'None');
  
  const url = `${API_V1_BASE}/training/sessions`;
  console.log('[TrainingAPI] POST to:', url);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    body: JSON.stringify(request),
  });

  console.log('[TrainingAPI] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[TrainingAPI] Error response:', errorText);
    throw new Error(`Failed to create training session: ${response.statusText}`);
  }

  const data = await response.json();
  console.log('[TrainingAPI] Session created:', data);
  return data;
}

/**
 * Get training session details
 */
export async function getTrainingSession(sessionId: string): Promise<TrainingSessionDetail> {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_V1_BASE}/training/sessions/${sessionId}`, {
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get training session: ${response.statusText}`);
  }

  return response.json();
}

/**
 * List user's training sessions
 */
export async function listTrainingSessions(
  skip: number = 0,
  limit: number = 20
): Promise<TrainingSession[]> {
  const token = await getAuthToken();
  
  const response = await fetch(
    `${API_V1_BASE}/training/sessions?skip=${skip}&limit=${limit}`,
    {
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to list training sessions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * End a training session
 */
export async function endTrainingSession(
  sessionId: string,
  conversationData?: any
): Promise<TrainingSession> {
  const token = await getAuthToken();
  
  if (!token) {
    console.warn('[TrainingAPI] No auth token available for ending session');
    // Don't throw error - session will be saved via WebSocket disconnect
    return { id: sessionId } as TrainingSession;
  }
  
  const response = await fetch(`${API_V1_BASE}/training/sessions/${sessionId}/end`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ conversation_data: conversationData }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[TrainingAPI] Failed to end session:', response.status, errorText);
    // Don't throw - session is already saved via WebSocket disconnect
    return { id: sessionId } as TrainingSession;
  }

  return response.json();
}

/**
 * Delete a training session
 */
export async function deleteTrainingSession(sessionId: string): Promise<void> {
  const token = await getAuthToken();
  
  const response = await fetch(`${API_V1_BASE}/training/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete training session: ${response.statusText}`);
  }
}

/**
 * Connect to training conversation WebSocket
 */
export function connectToTrainingConversation(
  sessionId: string,
  onMessage: (data: any) => void,
  onAudio: (audioBlob: Blob) => void,
  onError: (error: Error) => void,
  onClose?: (event: CloseEvent) => void
): WebSocket {
  const wsBase = API_V1_BASE.replace('http://', 'ws://').replace('https://', 'wss://');
  
  // Get auth token and add it as query parameter
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const wsUrl = token 
    ? `${wsBase}/training/sessions/${sessionId}/conversation?token=${encodeURIComponent(token)}`
    : `${wsBase}/training/sessions/${sessionId}/conversation`;
  
  console.log('[TrainingAPI] Connecting to WebSocket:', wsUrl.split('?')[0] + (token ? '?token=***' : ''));
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[TrainingAPI] WebSocket OPENED - Connected to training session:', sessionId);
    console.log('[TrainingAPI] WebSocket readyState:', ws.readyState);
  };

  ws.onmessage = (event) => {
    console.log('[TrainingAPI] WebSocket message received, type:', typeof event.data);
    
    if (event.data instanceof Blob) {
      // Audio data
      console.log('[TrainingAPI] Received audio blob:', {
        size: event.data.size,
        type: event.data.type
      });
      onAudio(event.data);
    } else {
      // JSON message
      console.log('[TrainingAPI] Received text message:', event.data);
      try {
        const data = JSON.parse(event.data);
        console.log('[TrainingAPI] Parsed message:', data);
        onMessage(data);
      } catch (error) {
        console.error('[TrainingAPI] Failed to parse message:', error, 'Raw data:', event.data);
      }
    }
  };

  ws.onerror = (event) => {
    console.error('[TrainingAPI] WebSocket ERROR:', event);
    console.error('[TrainingAPI] WebSocket readyState:', ws.readyState);
    onError(new Error('WebSocket connection error'));
  };

  ws.onclose = (event) => {
    console.log('[TrainingAPI] WebSocket CLOSED:', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      readyState: ws.readyState
    });
    // WebSocket close codes:
    // 1000 = Normal Closure (expected)
    // 1001 = Going Away (expected - server shutting down)
    // 1006 = Abnormal Closure (connection lost - network issue, don't treat as error)
    // 1011 = Internal Server Error (server error)
    // 1008 = Policy Violation
    // Others = Unexpected
    
    // 1000 = Normal Closure
    // 1001 = Going Away (page navigation)
    // 1005 = No Status Received (normal close without status - NOT an error)
    // 1006 = Abnormal Closure (network issue)
    // 1011 = Internal Server Error
    const isExpectedClose = event.code === 1000 || event.code === 1001 || event.code === 1005;
    const isNetworkIssue = event.code === 1006;
    const isServerError = event.code === 1011;
    
    if (isExpectedClose) {
      console.log('[TrainingAPI] WebSocket closed normally (code:', event.code, ')');
      // Don't call onError for expected closes
    } else if (isNetworkIssue) {
      console.warn('[TrainingAPI] WebSocket connection lost (network issue)');
      // Network issues are common, don't show scary error - just log
    } else if (isServerError) {
      console.error('[TrainingAPI] WebSocket closed due to server error:', event.reason);
      onError(new Error(`Server error: ${event.reason || 'Internal server error'}`));
    } else {
      console.warn('[TrainingAPI] WebSocket closed unexpectedly:', event.code, event.reason);
      // Only show error for truly unexpected closures (not 1005, 1006)
    }

    if (onClose) {
      onClose(event);
    }
  };

  return ws;
}

/**
 * Send audio data to training conversation
 */
export function sendAudioToTraining(ws: WebSocket, audioData: Blob | ArrayBuffer) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(audioData);
  }
}

/**
 * Send text message to training conversation
 */
export function sendTextToTraining(ws: WebSocket, text: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'text',
      text: text
    }));
  }
}

export async function getTrainingFeatures(): Promise<TrainingFeatures> {
  const response = await fetch(`${API_V1_BASE}/training/features`);
  if (!response.ok) {
    throw new Error('Failed to load training features');
  }
  return response.json();
}
