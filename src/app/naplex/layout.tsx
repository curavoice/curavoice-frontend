'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import DashboardNav from '@/components/DashboardNav'
import EchoLoader from '@/components/EchoLoader'
import NaplexSubNav from '@/components/NaplexSubNav'
import { useAuth } from '@/hooks/useAuth'
import { isFeatureEnabled } from '@/lib/featureFlags'
import ComingSoon from '@/components/ComingSoon'

export default function NaplexLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const isComingSoon = isFeatureEnabled('naplexComingSoon')

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  if (authLoading || !user) {
    return (
      <div className="dashboard-page-container">
        <DashboardNav />
        <EchoLoader message="Loading NAPLEX Prep..." context="general" />
      </div>
    )
  }

  // Show "coming soon" if the toggle is active
  if (isComingSoon) {
    return (
      <div className="dashboard-page-container">
        <DashboardNav />
        <div className="dashboard-main-content">
          <ComingSoon 
            title="NAPLEX Prep Coming Soon" 
            description="We're building an advanced adaptive learning platform for your NAPLEX preparation. Stay tuned for practice exams, top 200 drugs decks, and more!"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page-container">
      <DashboardNav />
      <div className="dashboard-main-content">
        <NaplexSubNav />
        {children}
      </div>
    </div>
  )
}
