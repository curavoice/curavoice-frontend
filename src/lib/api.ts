// Get API URL and ensure it doesn't have a trailing slash or /api/v1 prefix
const getApiUrl = (): string => {
  // Production backend URL (Railway)
  const url = process.env.NEXT_PUBLIC_API_URL || 'https://curavoice-backend-production-3ea1.up.railway.app'
  // Remove trailing slash
  const cleanUrl = url.replace(/\/$/, '')
  
  // Debug logging
  console.log('[API] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
  console.log('[API] Resolved API URL:', cleanUrl);
  
  return cleanUrl
}

const API_URL = getApiUrl()

export interface AuthResponse {
  user: {
    id: string
    email: string
    full_name: string | null
    is_active: boolean
    is_verified: boolean
    role: string
    created_at: string
    updated_at: string
  }
  access_token: string
  refresh_token: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    // Remove trailing slash and ensure clean base URL
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * Get the API base URL with /api/v1 prefix
   * Handles cases where baseUrl might already include /api/v1
   */
  private getApiBase(): string {
    // Remove /api/v1 if it exists at the end to avoid duplication
    let cleanBase = this.baseUrl.replace(/\/api\/v1\/?$/, '')
    
    // Ensure no trailing slash
    cleanBase = cleanBase.replace(/\/$/, '')
    
    // Always append /api/v1 to ensure consistent API path
    return `${cleanBase}/api/v1`
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getToken()
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('access_token')
  }

  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', token)
    }
  }

  setRefreshToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('refresh_token', token)
    }
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('refresh_token')
  }

  clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
    }
  }

  setUser(user: AuthResponse['user']): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user))
    }
  }

  getUser(): AuthResponse['user'] | null {
    if (typeof window === 'undefined') return null
    const userStr = localStorage.getItem('user')
    if (!userStr) return null
    try {
      return JSON.parse(userStr)
    } catch {
      return null
    }
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const loginUrl = `${this.getApiBase()}/auth/login`;
    const timestamp = new Date().toISOString();
    
    console.log(`[${timestamp}] [API] 🔐 Login attempt started`);
    console.log(`[${timestamp}] [API] Login URL:`, loginUrl);
    console.log(`[${timestamp}] [API] Base URL:`, this.baseUrl);
    console.log(`[${timestamp}] [API] API Base:`, this.getApiBase());
    console.log(`[${timestamp}] [API] Email:`, data.email);
    
    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(data),
      })

      console.log(`[${timestamp}] [API] Response status:`, response.status);
      console.log(`[${timestamp}] [API] Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorDetail = 'Login failed';
        try {
          const error = await response.json()
          errorDetail = error.detail || error.message || errorDetail;
          console.error(`[${timestamp}] [API] ❌ Login failed:`, error);
        } catch (parseError) {
          console.error(`[${timestamp}] [API] ❌ Failed to parse error response:`, parseError);
          errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorDetail)
      }

      const result: AuthResponse = await response.json()
      console.log(`[${timestamp}] [API] ✅ Login successful for user:`, result.user.email);
      console.log(`[${timestamp}] [API] User ID:`, result.user.id);
      console.log(`[${timestamp}] [API] User role:`, result.user.role);
      
      this.setToken(result.access_token)
      this.setRefreshToken(result.refresh_token)
      this.setUser(result.user)
      
      console.log(`[${timestamp}] [API] ✅ Tokens and user data saved to localStorage`);
      return result
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`[${timestamp}] [API] ❌ Network error - cannot reach backend:`, error);
        throw new Error('Cannot connect to server. Please check your connection and try again.');
      }
      console.error(`[${timestamp}] [API] ❌ Login error:`, error);
      throw error;
    }
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const registerUrl = `${this.getApiBase()}/auth/register`;
    const timestamp = new Date().toISOString();
    
    console.log(`[${timestamp}] [API] 📝 Registration attempt started`);
    console.log(`[${timestamp}] [API] Register URL:`, registerUrl);
    console.log(`[${timestamp}] [API] Email:`, data.email);
    console.log(`[${timestamp}] [API] Full name:`, data.full_name);
    
    try {
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(data),
      })

      console.log(`[${timestamp}] [API] Response status:`, response.status);

      if (!response.ok) {
        let errorDetail = 'Registration failed';
        try {
          const error = await response.json()
          errorDetail = error.detail || error.message || errorDetail;
          console.error(`[${timestamp}] [API] ❌ Registration failed:`, error);
        } catch (parseError) {
          console.error(`[${timestamp}] [API] ❌ Failed to parse error response:`, parseError);
          errorDetail = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorDetail)
      }

      const result: AuthResponse = await response.json()
      console.log(`[${timestamp}] [API] ✅ Registration successful for user:`, result.user.email);
      
      this.setToken(result.access_token)
      this.setRefreshToken(result.refresh_token)
      this.setUser(result.user)
      
      console.log(`[${timestamp}] [API] ✅ Tokens and user data saved to localStorage`);
      return result
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`[${timestamp}] [API] ❌ Network error - cannot reach backend:`, error);
        throw new Error('Cannot connect to server. Please check your connection and try again.');
      }
      console.error(`[${timestamp}] [API] ❌ Registration error:`, error);
      throw error;
    }
  }

  async getCurrentUser(): Promise<AuthResponse['user']> {
    const response = await fetch(`${this.getApiBase()}/auth/me`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error('Failed to get user')
    }

    const user = await response.json()
    this.setUser(user)
    return user
  }

  async logout(): Promise<void> {
    this.clearTokens()
  }

  async evaluateTrainingSession(sessionId: string): Promise<any> {
    try {
      const response = await fetch(`${this.getApiBase()}/training/sessions/${sessionId}/evaluate`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      })

      if (!response.ok) {
        let errorDetail = 'Evaluation failed'
        try {
          const error = await response.json()
          errorDetail = error.detail || error.message || errorDetail
        } catch {
          errorDetail = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorDetail)
      }

      return await response.json()
    } catch (error) {
      // Re-throw with more context if it's a network error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Failed to fetch evaluation. Please check your connection and try again.')
      }
      throw error
    }
  }

  async getAllSessions(limit: number = 100, skip: number = 0): Promise<any[]> {
    const response = await fetch(`${this.getApiBase()}/training/sessions?limit=${limit}&skip=${skip}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to fetch sessions')
    }

    return response.json()
  }

  async getSessionEvaluation(sessionId: string): Promise<any> {
    const response = await fetch(`${this.getApiBase()}/training/sessions/${sessionId}/evaluation`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to fetch evaluation')
    }

    return response.json()
  }

  async getStudentInsights(userId: string): Promise<any> {
    const response = await fetch(`${this.getApiBase()}/statistics/analytics/insights`, {
      method: 'GET',
      headers: {
        ...this.getAuthHeaders(),
        'X-User-ID': userId,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to fetch insights')
    }

    return response.json()
  }

  async getPerformanceTrends(userId: string, scenarioType?: string): Promise<any> {
    const url = new URL(`${this.getApiBase()}/statistics/analytics/trends`)
    if (scenarioType) {
      url.searchParams.set('scenario_type', scenarioType)
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        ...this.getAuthHeaders(),
        'X-User-ID': userId,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to fetch trends')
    }

    return response.json()
  }

  async exportAllReports(format: 'pdf' | 'csv' = 'pdf'): Promise<Blob> {
    const response = await fetch(`${this.getApiBase()}/training/sessions/export?format=${format}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to export reports')
    }

    return response.blob()
  }
}

export const apiClient = new ApiClient(API_URL)

