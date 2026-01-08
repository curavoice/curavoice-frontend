'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import LogoIcon from '@/components/icons/Logo'

export default function DashboardNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()

  const isTraining = pathname === '/training'
  const isDashboard = pathname === '/dashboard'
  const isProfile = pathname === '/profile'
  const isLibrary = pathname === '/upload'
  const isNaplex = pathname === '/naplex' || pathname.startsWith('/naplex/')

  const handleProfileClick = () => {
    router.push('/profile')
    // setIsMenuOpen(false)
  }

  const getUserInitial = () => {
    const name = user?.full_name || 'User'
    return name.charAt(0).toUpperCase()
  }

  const handleLogoClick = () => {
    router.push('/dashboard')
  }

  return (
    <nav className="dashboard-nav-container">
      <div className="dashboard-nav-content">
        {/* Logo and Brand - Clickable */}
        <button
          onClick={handleLogoClick}
          className="dashboard-brand dashboard-brand-clickable"
        >
          <LogoIcon className="w-[50px] h-[50px] lg:w-[68px] lg:h-[68px]" />
          <span className="dashboard-brand-text">CuraVoice</span>
        </button>

        {/* Navigation Links - Desktop */}
        <div className="dashboard-nav-links">
          <Link
            href="/training"
            data-tour="nav-training"
            className={`dashboard-nav-link ${isTraining ? 'dashboard-nav-link-active' : ''}`}
          >
            Training
          </Link>
          <Link
            href="/naplex"
            data-tour="nav-naplex"
            className={`dashboard-nav-link ${isNaplex ? 'dashboard-nav-link-active' : ''}`}
          >
            NAPLEX Prep
          </Link>
          <Link
            href="/upload"
            data-tour="nav-library"
            className={`dashboard-nav-link ${isLibrary ? 'dashboard-nav-link-active' : ''}`}
          >
            Library
          </Link>
          <Link
            href="/dashboard"
            data-tour="nav-dashboard"
            className={`dashboard-nav-link ${isDashboard ? 'dashboard-nav-link-active' : ''}`}
          >
            Dashboard
          </Link>
        </div>

        {/* Mobile Navigation Menu */}
        <div className="dashboard-mobile-menu">
          <Link
            href="/training"
            data-tour="nav-training"
            className={`dashboard-mobile-nav-link ${isTraining ? 'text-[#3DD6D0]' : ''}`}
          >
            Training
          </Link>
          <span className="text-gray-400">|</span>
          <Link
            href="/naplex"
            data-tour="nav-naplex"
            className={`dashboard-mobile-nav-link ${isNaplex ? 'text-[#3DD6D0]' : ''}`}
          >
            NAPLEX
          </Link>
          <span className="text-gray-400">|</span>
          <Link
            href="/upload"
            data-tour="nav-library"
            className={`dashboard-mobile-nav-link ${isLibrary ? 'text-[#3DD6D0]' : ''}`}
          >
            Library
          </Link>
          <span className="text-gray-400">|</span>
          <Link
            href="/dashboard"
            data-tour="nav-dashboard"
            className={`dashboard-mobile-nav-link ${isDashboard ? 'text-[#3DD6D0]' : ''}`}
          >
            Dashboard
          </Link>
        </div>

        {/* User Profile Circle with Dropdown */}
        <div className="dashboard-user-section">
          <button
            onClick={handleProfileClick}
            data-tour="nav-profile"
            className={`dashboard-user-circle ${isProfile ? 'dashboard-user-circle-active' : ''}`}
            aria-label="User profile"
          >
            <span className="dashboard-user-initial">{getUserInitial()}</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
