const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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
    this.baseUrl = baseUrl
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
    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Login failed')
    }

    const result: AuthResponse = await response.json()
    this.setToken(result.access_token)
    this.setRefreshToken(result.refresh_token)
    this.setUser(result.user)
    return result
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Registration failed')
    }

    const result: AuthResponse = await response.json()
    this.setToken(result.access_token)
    this.setRefreshToken(result.refresh_token)
    this.setUser(result.user)
    return result
  }

  async getCurrentUser(): Promise<AuthResponse['user']> {
    const response = await fetch(`${this.baseUrl}/api/v1/auth/me`, {
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
      const response = await fetch(`${this.baseUrl}/api/v1/training/sessions/${sessionId}/evaluate`, {
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
    const response = await fetch(`${this.baseUrl}/api/v1/training/sessions?limit=${limit}&skip=${skip}`, {
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
    const response = await fetch(`${this.baseUrl}/api/v1/training/sessions/${sessionId}/evaluation`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to fetch evaluation')
    }

    return response.json()
  }
}

export const apiClient = new ApiClient(API_URL)

