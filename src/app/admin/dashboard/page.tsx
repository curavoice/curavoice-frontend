'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Users, Clock, TrendingUp, LogOut, Search, ChevronRight } from 'lucide-react'
import EchoLoader from '@/components/EchoLoader'

interface User {
  user_id: string
  email: string
  full_name: string
  healthcare_domain: string
  session_count: number
  total_time_seconds: number
  latest_session_date: string | null
  created_at: string
}

interface Stats {
  total_users: number
  total_sessions: number
  completed_sessions: number
  total_training_time_hours: number
  average_session_duration_seconds: number
  sessions_by_category: Record<string, number>
  sessions_with_audio: number
  sessions_with_evaluation: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    // Check if admin is authenticated
    const credentials = sessionStorage.getItem('admin_credentials')
    if (!credentials) {
      router.push('/admin/login')
      return
    }

    fetchData(credentials)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = async (credentials: string) => {
    try {
      setLoading(true)

      // Fetch users
      const usersResponse = await fetch('http://localhost:8000/api/v1/admin/users', {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      })

      if (!usersResponse.ok) {
        throw new Error('Unauthorized')
      }

      const usersData = await usersResponse.json()
      setUsers(usersData.users)

      // Fetch stats
      const statsResponse = await fetch('http://localhost:8000/api/v1/admin/stats', {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      })

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }
    } catch (error) {
      console.error('Error fetching admin data:', error)
      sessionStorage.removeItem('admin_credentials')
      router.push('/admin/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_credentials')
    router.push('/admin/login')
  }

  const handleUserClick = (userId: string) => {
    router.push(`/admin/users/${userId}`)
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch {
      return 'Invalid date'
    }
  }

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <EchoLoader context="admin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-indigo-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-600">CuraVoice Session Management</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Users</h3>
                <Users className="h-5 w-5 text-indigo-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.total_users}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Total Sessions</h3>
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.total_sessions}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.completed_sessions} completed</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">Training Time</h3>
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.total_training_time_hours.toFixed(1)}h</p>
              <p className="text-xs text-gray-500 mt-1">Avg: {Math.round(stats.average_session_duration_seconds / 60)}m/session</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">With Audio</h3>
                <div className="text-purple-600">🎙️</div>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.sessions_with_audio}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.sessions_with_evaluation} evaluated</p>
            </div>
          </div>
        )}

        {/* Users List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">All Users</h2>
              <span className="text-sm text-gray-600">{filteredUsers.length} users</span>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="divide-y">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No users found
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.user_id}
                  onClick={() => handleUserClick(user.user_id)}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{user.full_name}</h3>
                        <span className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded">
                          {user.healthcare_domain}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{user.email}</p>
                      
                      <div className="flex items-center gap-6 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          <span>{user.session_count} sessions</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{formatDuration(user.total_time_seconds)} total</span>
                        </div>
                        <div>
                          Last active: {formatDate(user.latest_session_date)}
                        </div>
                      </div>
                    </div>
                    
                    <ChevronRight className="h-6 w-6 text-gray-400" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

