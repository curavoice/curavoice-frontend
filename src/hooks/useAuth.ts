'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient, type AuthResponse } from '@/lib/api'

interface UseAuthReturn {
  user: AuthResponse['user'] | null
  loading: boolean
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthResponse['user'] | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Get user from localStorage first
    const storedUser = apiClient.getUser()
    const token = apiClient.getToken()

    if (storedUser && token) {
      setUser(storedUser)
      setLoading(false)
      
      // Verify token is still valid by fetching current user
      apiClient.getCurrentUser()
        .then((currentUser) => {
          setUser(currentUser)
        })
        .catch((error) => {
          // Only clear tokens and redirect for actual authentication errors (401)
          // Don't sign out for network errors, server errors, etc.
          const isAuthError = error?.message?.toLowerCase().includes('unauthorized') ||
                              error?.message?.toLowerCase().includes('invalid token') ||
                              error?.message?.toLowerCase().includes('token expired') ||
                              error?.status === 401
          
          if (isAuthError) {
            console.log('[useAuth] Token invalid, clearing and redirecting to login')
            apiClient.clearTokens()
            setUser(null)
            router.push('/auth/login')
          } else {
            // For other errors (network, server issues), keep the user logged in
            // They can retry or the issue may resolve
            console.warn('[useAuth] Error verifying user, but keeping session:', error?.message || error)
          }
        })
    } else {
      setLoading(false)
    }
  }, [router])

  const signOut = async () => {
    await apiClient.logout()
    setUser(null)
    router.push('/auth/login')
  }

  return {
    user,
    loading,
    signOut,
  }
}
