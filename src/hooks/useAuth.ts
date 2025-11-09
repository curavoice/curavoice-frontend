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
        .catch(() => {
          // Token invalid, clear and redirect
          apiClient.clearTokens()
          setUser(null)
          router.push('/auth/login')
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
