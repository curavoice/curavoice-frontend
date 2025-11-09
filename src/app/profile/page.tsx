'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import DashboardNav from '@/components/DashboardNav'
import EchoLoader from '@/components/EchoLoader'
import { 
  ArrowLeft, 
  Mail, 
  Briefcase, 
  Calendar, 
  Shield, 
  Edit2, 
  LogOut,
  X,
  Check
} from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading: authLoading, signOut } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [editedFirstName, setEditedFirstName] = useState('')
  const [editedLastName, setEditedLastName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  const handleBackToDashboard = () => {
    router.push('/dashboard')
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  // const getDaysActive = (dateString: string | undefined) => {
  //   if (!dateString) return 0
  //   const createdDate = new Date(dateString)
  //   const today = new Date()
  //   const diffTime = Math.abs(today.getTime() - createdDate.getTime())
  //   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  //   return diffDays
  // }

  const handleEditProfile = () => {
    if (user?.full_name) {
      const nameParts = user.full_name.split(' ')
      setEditedFirstName(nameParts[0] || '')
      setEditedLastName(nameParts.slice(1).join(' ') || '')
    }
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedFirstName('')
    setEditedLastName('')
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      if (!user) return
      
      // TODO: Update profile via API
      // For now, just update local state
      // const fullName = `${editedFirstName} ${editedLastName}`.trim()
      // await apiClient.updateProfile({ full_name: fullName })
      
      setIsEditing(false)
      alert(`Profile update feature coming soon. Name would be: ${editedFirstName} ${editedLastName}`.trim())
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (authLoading) {
    return (
      <div className="profile-page-container">
        <DashboardNav />
        <EchoLoader context="profile" />
      </div>
    )
  }

  return (
    <div className="profile-page-container">
      <DashboardNav />
      
      <div className="profile-content-container">
        {/* Header with Breadcrumb */}
        <div className="profile-header">
          <button 
            onClick={handleBackToDashboard}
            className="profile-back-button"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
        </div>

        {/* Profile Banner */}
        <div className="profile-banner">
          <div className="profile-banner-gradient"></div>
          <div className="profile-banner-content">
            {/* Avatar */}
            <div className="profile-avatar-large">
              <div className="profile-avatar-ring"></div>
              <span className="profile-avatar-initial-large">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </span>
              <div className="profile-status-badge">
                <Shield className="w-4 h-4" />
              </div>
            </div>

            {/* User Info */}
            <div className="profile-user-info">
              <h1 className="profile-user-name">{user?.full_name || 'User'}</h1>
              <p className="profile-user-title">
                Healthcare Professional
              </p>
            </div>

            {/* Action Buttons */}
            <div className="profile-actions">
              <button 
                onClick={handleEditProfile}
                className="profile-action-button profile-action-primary"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
              <button 
                onClick={handleSignOut}
                className="profile-action-button profile-action-secondary"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="profile-info-card max-w-2xl mx-auto">
          <div className="profile-card-header">
            <h2 className="profile-card-title">Personal Information</h2>
          </div>
          <div className="profile-card-body">
            <div className="profile-field">
              <div className="profile-field-icon">
                <Mail className="w-5 h-5 text-[#344895]" />
              </div>
              <div className="profile-field-content">
                <label className="profile-field-label">Email Address</label>
                <p className="profile-field-value">{user?.email || 'Not provided'}</p>
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-icon">
                <Briefcase className="w-5 h-5 text-[#344895]" />
              </div>
              <div className="profile-field-content">
                <label className="profile-field-label">Healthcare Domain</label>
                <p className="profile-field-value">Pharmacy</p>
              </div>
            </div>

            <div className="profile-field">
              <div className="profile-field-icon">
                <Calendar className="w-5 h-5 text-[#344895]" />
              </div>
              <div className="profile-field-content">
                <label className="profile-field-label">Member Since</label>
                <p className="profile-field-value">{formatDate(user?.created_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Profile Modal */}
        {isEditing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-montserrat font-bold text-black">Edit Profile</h2>
                <button 
                  onClick={handleCancelEdit}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-lato font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={editedFirstName}
                    onChange={(e) => setEditedFirstName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3DD6D0] focus:border-transparent font-lato"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-lato font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editedLastName}
                    onChange={(e) => setEditedLastName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3DD6D0] focus:border-transparent font-lato"
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-lato font-medium hover:bg-gray-50 transition-colors"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving || !editedFirstName.trim()}
                  className="flex-1 px-4 py-3 bg-[#3DD6D0] text-white rounded-lg font-lato font-medium hover:bg-[#1A1F71] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
