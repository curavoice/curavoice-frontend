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
 * WebSocket connection manager with ping/pong and auto-reconnection
 */
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isManualClose = false;
  private sessionId: string;
  private onMessage: (data: any) => void;
  private onAudio: (audioBlob: Blob) => void;
  private onError: (error: Error) => void;
  private onReconnecting?: (attempt: number) => void;
  private onReconnected?: () => void;

  constructor(
    sessionId: string,
    onMessage: (data: any) => void,
    onAudio: (audioBlob: Blob) => void,
    onError: (error: Error) => void,
    onReconnecting?: (attempt: number) => void,
    onReconnected?: () => void
  ) {
    this.sessionId = sessionId;
    this.onMessage = onMessage;
    this.onAudio = onAudio;
    this.onError = onError;
    this.onReconnecting = onReconnecting;
    this.onReconnected = onReconnected;
  }

  connect(): WebSocket {
    const wsBase = API_V1_BASE.replace('http://', 'ws://').replace('https://', 'wss://');

    // Get auth token and add it as query parameter
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    const wsUrl = token
      ? `${wsBase}/training/sessions/${this.sessionId}/conversation?token=${encodeURIComponent(token)}`
      : `${wsBase}/training/sessions/${this.sessionId}/conversation`;

    console.log('[WebSocket] Connecting:', wsUrl.split('?')[0] + (token ? '?token=***' : ''));
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WebSocket] ✅ OPENED - Connected to session:', this.sessionId);
      console.log('[WebSocket] ReadyState:', this.ws?.readyState);

      // Reset reconnection attempts on successful connection
      this.reconnectAttempts = 0;

      // Start ping/pong to keep connection alive (every 30 seconds)
      this.startPingPong();

      // Notify reconnection success if this was a reconnect
      if (this.reconnectAttempts > 0 && this.onReconnected) {
        this.onReconnected();
      }
    };

    this.ws.onmessage = (event) => {
      // console.log('[WebSocket] Message received, type:', typeof event.data);

      if (event.data instanceof Blob) {
        // Audio data
        console.log('[WebSocket] 📥 Received audio blob:', {
          size: event.data.size,
          type: event.data.type
        });
        this.onAudio(event.data);
      } else {
        // JSON message
        // console.log('[WebSocket] 📥 Received text:', event.data);
        try {
          const data = JSON.parse(event.data);

          // Handle pong response
          if (data.type === 'pong') {
            console.log('[WebSocket] 📥 Pong received - connection alive');
            return;
          }

          console.log('[WebSocket] 📥 Parsed message:', data);
          this.onMessage(data);
        } catch (error) {
          console.error('[WebSocket] ❌ Failed to parse message:', error, 'Raw:', event.data);
        }
      }
    };

    this.ws.onerror = (event) => {
      console.error('[WebSocket] ❌ ERROR:', event);
      console.error('[WebSocket] ReadyState:', this.ws?.readyState);
      this.onError(new Error('WebSocket connection error'));
    };

    this.ws.onclose = (event) => {
      console.log('[WebSocket] ❌ CLOSED:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        readyState: this.ws?.readyState,
        isManualClose: this.isManualClose
      });

      // Stop ping/pong
      this.stopPingPong();

      // WebSocket close codes:
      // 1000 = Normal Closure (expected)
      // 1001 = Going Away (expected - server shutting down)
      // 1006 = Abnormal Closure (connection lost - network issue)
      // 1011 = Internal Server Error (server error)

      const isExpectedClose = event.code === 1000 || event.code === 1001 || this.isManualClose;
      const isNetworkIssue = event.code === 1006;
      const isServerError = event.code === 1011;

      if (isExpectedClose) {
        console.log('[WebSocket] Closed normally, no reconnection');
      } else if (isNetworkIssue && !this.isManualClose) {
        console.warn('[WebSocket] ⚠️ Connection lost (network issue), attempting reconnection...');
        this.attemptReconnect();
      } else if (isServerError) {
        console.error('[WebSocket] Server error:', event.reason);
        this.onError(new Error(`Server error: ${event.reason || 'Internal server error'}`));
      } else if (!this.isManualClose) {
        console.warn('[WebSocket] Unexpected closure:', event.code, event.reason);
        this.attemptReconnect();
      }
    };

    return this.ws;
  }

  private startPingPong() {
    this.stopPingPong(); // Clear any existing interval

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('[WebSocket] 📤 Ping sent');
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 30 seconds

    console.log('[WebSocket] ⏰ Ping/pong started (30s interval)');
  }

  private stopPingPong() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      console.log('[WebSocket] ⏰ Ping/pong stopped');
    }
  }

  private attemptReconnect() {
    // Don't reconnect if manually closed or max attempts reached
    if (this.isManualClose || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] ❌ Max reconnection attempts reached');
        this.onError(new Error('Connection lost. Please refresh the page.'));
      }
      return;
    }

    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 32000);
    this.reconnectAttempts++;

    console.log(`[WebSocket] 🔄 Reconnecting in ${delay/1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    if (this.onReconnecting) {
      this.onReconnecting(this.reconnectAttempts);
    }

    this.reconnectTimeout = setTimeout(() => {
      console.log('[WebSocket] 🔄 Attempting to reconnect...');
      this.connect();
    }, delay);
  }

  send(data: string | Blob | ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      console.warn('[WebSocket] ⚠️ Cannot send, not connected. State:', this.ws?.readyState);
    }
  }

  close() {
    console.log('[WebSocket] Manual close requested');
    this.isManualClose = true;
    this.stopPingPong();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getWebSocket(): WebSocket | null {
    return this.ws;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

/**
 * Connect to training conversation WebSocket (with ping/pong and auto-reconnection)
 */
export function connectToTrainingConversation(
  sessionId: string,
  onMessage: (data: any) => void,
  onAudio: (audioBlob: Blob) => void,
  onError: (error: Error) => void,
  onReconnecting?: (attempt: number) => void,
  onReconnected?: () => void
): WebSocketManager {
  const wsManager = new WebSocketManager(
    sessionId,
    onMessage,
    onAudio,
    onError,
    onReconnecting,
    onReconnected
  );

  wsManager.connect();
  return wsManager;
}

/**
 * Send audio data to training conversation
 */
export function sendAudioToTraining(ws: WebSocket | WebSocketManager, audioData: Blob | ArrayBuffer) {
  if (ws instanceof WebSocketManager) {
    ws.send(audioData);
  } else if (ws.readyState === WebSocket.OPEN) {
    ws.send(audioData);
  }
}

/**
 * Send text message to training conversation
 */
export function sendTextToTraining(ws: WebSocket | WebSocketManager, text: string) {
  const message = JSON.stringify({
    type: 'text',
    text: text
  });

  if (ws instanceof WebSocketManager) {
    ws.send(message);
  } else if (ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  }
}

