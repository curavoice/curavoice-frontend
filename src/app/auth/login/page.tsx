'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Eye, EyeOff } from 'lucide-react'
import LogoIcon from '@/components/icons/Logo'
import EchoIcon from '@/components/icons/Echo'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const timestamp = new Date().toISOString()
    
    console.log(`[${timestamp}] [LOGIN] 🔐 Login form submitted`)
    console.log(`[${timestamp}] [LOGIN] Email:`, email)
    console.log(`[${timestamp}] [LOGIN] Password length:`, password.length)
    
    setLoading(true)

    try {
      console.log(`[${timestamp}] [LOGIN] Calling apiClient.login()...`)
      const result = await apiClient.login({ email, password })
      
      console.log(`[${timestamp}] [LOGIN] ✅ Login successful!`)
      console.log(`[${timestamp}] [LOGIN] User:`, result.user.email)
      console.log(`[${timestamp}] [LOGIN] Redirecting to dashboard...`)
      
      toast({
        title: 'Success',
        description: 'Signed in successfully!',
      })
      
      router.push('/dashboard')
    } catch (error: any) {
      console.error(`[${timestamp}] [LOGIN] ❌ Login failed:`, error)
      console.error(`[${timestamp}] [LOGIN] Error name:`, error.name)
      console.error(`[${timestamp}] [LOGIN] Error message:`, error.message)
      console.error(`[${timestamp}] [LOGIN] Error stack:`, error.stack)
      
      let errorMessage = error.message || 'An unexpected error occurred'
      
      // Provide more helpful error messages
      if (error.message?.includes('Cannot connect to server')) {
        errorMessage = 'Cannot connect to server. Please ensure the backend is running.'
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your internet connection and backend server.'
      } else if (error.message?.includes('Incorrect email or password')) {
        errorMessage = 'Incorrect email or password. Please try again.'
      }
      
      toast({
        title: 'Login Failed',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      console.log(`[${timestamp}] [LOGIN] Loading state set to false`)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
          {/* Left panel - Branding (570x677) */}
          <div className="login-left-panel">
            <div className="w-full flex flex-col items-center">
            {/* Brand: Logo 68x68 + CuraVoice */}
            <div className="login-brand-row">
              <div className="w-[56px] h-[56px] lg:w-[68px] lg:h-[68px] rounded-lg flex items-center justify-center flex-shrink-0">
                <LogoIcon className="w-full h-auto" />
              </div>
              <div className="login-brand-title">CuraVoice</div>
            </div>
            
            {/* Tagline: 360x24 - Desktop only */}
            <div className="hidden lg:block login-tagline w-full max-w-[360px]">
              AI-Powered Patient Simulation Training
            </div>
          </div>

          {/* Echo Character: 469x541 - Desktop only */}
          <div className="hidden lg:flex mt-8 items-center justify-center w-full">
            <EchoIcon className="object-contain w-auto h-auto max-w-[469px]" />
          </div>
        </div>

        {/* Right panel - Login form (573x677) */}
        <div className="login-right-panel">
          <div className="w-full flex flex-col items-center">
            {/* Welcome Back: Montserrat Bold 32px */}
            <h2 className="login-title">Welcome Back!</h2>
            
            {/* Subtitle: 438x19 */}
            <p className="login-subtitle max-w-[438px]">
              Sign in to continue your healthcare training
            </p>

            {/* Form: 282px width */}
            <form onSubmit={handleSubmit} className="login-form">
              {/* Email: 282x88 total height */}
              <div className="space-y-2">
                <Label htmlFor="email" className="login-label">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="login-input"
                  required
                />
              </div>

              {/* Password: 282x84 total height */}
              <div className="space-y-2">
                <Label htmlFor="password" className="login-label">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="login-input pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me: 151x16 */}
              <div className="login-checkbox-row">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe} 
                  onCheckedChange={(v) => setRememberMe(Boolean(v))} 
                  className="w-4 h-4"
                />
                <label htmlFor="remember" className="text-black font-lato font-bold text-[11px] leading-[1.2] select-none">
                  Remember me
                </label>
              </div>

              {/* Sign In Button: 282x52 */}
              <Button type="submit" className="login-button" disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            {/* Divider: 441x1 */}
            <div className="login-divider" />

            {/* Sign up section */}
            <div className="text-center">
              <p className="login-signup-text mb-1">
                New to CuraVoice?{' '}
                <Link href="/auth/register" className="login-signup-link">
                  Create your account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
