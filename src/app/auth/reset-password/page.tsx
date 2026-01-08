'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import LogoIcon from '@/components/icons/Logo'
import EchoIcon from '@/components/icons/Echo'
import { Eye, EyeOff, Lock, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
import { apiClient } from '@/lib/api'

// Password requirements
const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lowercase', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number', test: (p: string) => /\d/.test(p) },
  { id: 'special', label: 'One special character', test: (p: string) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;\'`~]/.test(p) },
]

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [success, setSuccess] = useState(false)

  // Check if password meets all requirements
  const passwordMeetsRequirements = PASSWORD_REQUIREMENTS.every(req => req.test(password))
  const passwordsMatch = password === confirmPassword && password.length > 0

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token')
    if (!tokenFromUrl) {
      setValidating(false)
      setTokenValid(false)
      return
    }

    setToken(tokenFromUrl)

    // Validate the token
    const validateToken = async () => {
      try {
        const result = await apiClient.validateResetToken(tokenFromUrl)
        setTokenValid(result.success === true)
      } catch {
        setTokenValid(false)
      } finally {
        setValidating(false)
      }
    }

    validateToken()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!passwordMeetsRequirements) {
      toast({
        title: 'Invalid Password',
        description: 'Please ensure your password meets all requirements.',
        variant: 'destructive',
      })
      return
    }

    if (!passwordsMatch) {
      toast({
        title: 'Passwords Don\'t Match',
        description: 'Please ensure both passwords are the same.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      if (!token) {
        throw new Error('Missing reset token. Please request a new password reset.')
      }

      await apiClient.resetPassword(token, password)

      setSuccess(true)
      toast({
        title: 'Password Reset Successful',
        description: 'You can now log in with your new password.',
      })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset password. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Loading state while validating token
  if (validating) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-left-panel">
            <div className="w-full flex flex-col items-center">
              <div className="login-brand-row">
                <div className="w-[56px] h-[56px] lg:w-[68px] lg:h-[68px] rounded-lg flex items-center justify-center flex-shrink-0">
                  <LogoIcon className="w-full h-auto" />
                </div>
                <div className="login-brand-title">CuraVoice</div>
              </div>
            </div>
            <div className="hidden lg:flex mt-8 items-center justify-center w-full">
              <EchoIcon className="object-contain w-auto h-auto max-w-[469px]" />
            </div>
          </div>

          <div className="login-right-panel">
            <div className="w-full flex flex-col items-center text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#344895]"></div>
              <p className="mt-4 text-gray-600">Validating your reset link...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Invalid or expired token
  if (!tokenValid && !success) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-left-panel">
            <div className="w-full flex flex-col items-center">
              <div className="login-brand-row">
                <div className="w-[56px] h-[56px] lg:w-[68px] lg:h-[68px] rounded-lg flex items-center justify-center flex-shrink-0">
                  <LogoIcon className="w-full h-auto" />
                </div>
                <div className="login-brand-title">CuraVoice</div>
              </div>
            </div>
            <div className="hidden lg:flex mt-8 items-center justify-center w-full">
              <EchoIcon className="object-contain w-auto h-auto max-w-[469px]" />
            </div>
          </div>

          <div className="login-right-panel">
            <div className="w-full flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              
              <h2 className="login-title">Invalid or Expired Link</h2>
              
              <p className="login-subtitle max-w-[380px] mb-6">
                This password reset link is invalid or has expired. Reset links are only valid for 1 hour.
              </p>

              <Link href="/auth/forgot-password">
                <Button className="login-button mb-4">
                  Request New Reset Link
                </Button>
              </Link>

              <Link href="/auth/login" className="flex items-center gap-2 text-[#344895] hover:underline text-sm">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-left-panel">
            <div className="w-full flex flex-col items-center">
              <div className="login-brand-row">
                <div className="w-[56px] h-[56px] lg:w-[68px] lg:h-[68px] rounded-lg flex items-center justify-center flex-shrink-0">
                  <LogoIcon className="w-full h-auto" />
                </div>
                <div className="login-brand-title">CuraVoice</div>
              </div>
            </div>
            <div className="hidden lg:flex mt-8 items-center justify-center w-full">
              <EchoIcon className="object-contain w-auto h-auto max-w-[469px]" />
            </div>
          </div>

          <div className="login-right-panel">
            <div className="w-full flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              
              <h2 className="login-title">Password Reset!</h2>
              
              <p className="login-subtitle max-w-[380px] mb-8">
                Your password has been successfully reset. You can now log in with your new password.
              </p>

              <Link href="/auth/login">
                <Button className="login-button">
                  Go to Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Reset password form
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-left-panel">
          <div className="w-full flex flex-col items-center">
            <div className="login-brand-row">
              <div className="w-[56px] h-[56px] lg:w-[68px] lg:h-[68px] rounded-lg flex items-center justify-center flex-shrink-0">
                <LogoIcon className="w-full h-auto" />
              </div>
              <div className="login-brand-title">CuraVoice</div>
            </div>
            
            <div className="hidden lg:block login-tagline w-full max-w-[360px]">
              AI-Powered Patient Simulation Training
            </div>
          </div>

          <div className="hidden lg:flex mt-8 items-center justify-center w-full">
            <EchoIcon className="object-contain w-auto h-auto max-w-[469px]" />
          </div>
        </div>

        <div className="login-right-panel">
          <div className="w-full flex flex-col items-center">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-6">
              <Lock className="w-7 h-7 text-[#344895]" />
            </div>
            
            <h2 className="login-title">Create New Password</h2>
            
            <p className="login-subtitle max-w-[380px]">
              Choose a strong password for your account
            </p>

            <form onSubmit={handleSubmit} className="login-form">
              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="login-label">
                  New Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="login-input pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Password requirements */}
              <div className="text-sm space-y-1">
                {PASSWORD_REQUIREMENTS.map(req => (
                  <div 
                    key={req.id}
                    className={`flex items-center gap-2 ${
                      password.length > 0 
                        ? req.test(password) ? 'text-green-600' : 'text-red-500'
                        : 'text-gray-400'
                    }`}
                  >
                    {password.length > 0 && req.test(password) ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : password.length > 0 ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-gray-300" />
                    )}
                    <span>{req.label}</span>
                  </div>
                ))}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="login-label">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="login-input pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-red-500 text-sm">Passwords don&apos;t match</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="login-button" 
                disabled={loading || !passwordMeetsRequirements || !passwordsMatch}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>

            <div className="login-divider" />

            <Link href="/auth/login" className="flex items-center gap-2 text-[#344895] hover:underline text-sm">
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#344895]"></div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}

