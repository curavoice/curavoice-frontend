'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Eye, EyeOff } from 'lucide-react'
import LogoIcon from '@/components/icons/Logo'
import EchoIcon from '@/components/icons/Echo'

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  healthcareDomain: z.string().min(1, 'Please select a healthcare domain'),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions to continue',
  }),
})

type RegisterFormData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showTermsDialog, setShowTermsDialog] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      healthcareDomain: '',
      termsAccepted: false,
    },
  })

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true)
    try {
      await apiClient.register({
        email: data.email,
        password: data.password,
        full_name: data.name,
      })

      toast({
        title: 'Success!',
        description: 'Account created successfully!',
      })

      router.push('/dashboard')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="register-container">
      <div className="register-card">
        {/* Left panel - Branding (same as login) */}
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

        {/* Right panel - Registration form (573x802) */}
        <div className="register-right-panel">
          <div className="w-full flex flex-col items-center">
            {/* Start Your Journey: Montserrat Bold 32px */}
            <h1 className="register-title">Start Your Journey</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="register-form">
              {/* Full Name Field: 282x88 */}
              <div className="register-field-group">
                <Label htmlFor="name" className="register-label">
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  {...register('name')}
                  className="register-input"
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                )}
              </div>

              {/* Email Field: 282x84 */}
              <div className="register-field-group">
                <Label htmlFor="email" className="register-label">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  {...register('email')}
                  className="register-input"
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Password Field: 282x84 */}
              <div className="register-field-group">
                <Label htmlFor="password" className="register-label">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your email password"
                    {...register('password')}
                    className="register-input pr-10"
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
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Healthcare Domain Field: 282x84 */}
              <div className="register-field-group">
                <Label htmlFor="healthcareDomain" className="register-label">
                  Healthcare Domain
                </Label>
                <div className="relative">
                  <select
                    id="healthcareDomain"
                    {...register('healthcareDomain')}
                    className="register-select"
                  >
                    <option value="">Select your specialization</option>
                    <option value="pharmacy">Pharmacy</option>
                    {/* Coming Soon */}
                    <option value="nursing" disabled>Nursing (Coming Soon)</option>
                    <option value="medicine" disabled>Medicine (Coming Soon)</option>
                  </select>
                  {/* Custom dropdown arrow */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L6 6L11 1" stroke="#656565" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
                {errors.healthcareDomain && (
                  <p className="text-red-500 text-xs mt-1">{errors.healthcareDomain.message}</p>
                )}
              </div>

              {/* Terms and Conditions Checkbox */}
              <div className="register-field-group">
                <Controller
                  name="termsAccepted"
                  control={control}
                  render={({ field }) => (
                    <div className="login-checkbox-row">
                      <Checkbox
                        id="terms"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="w-4 h-4"
                      />
                      <label htmlFor="terms" className="text-black font-lato font-bold text-[11px] leading-[1.2] select-none cursor-pointer">
                        I agree to the{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            setShowTermsDialog(true)
                          }}
                          className="underline hover:text-gray-700 focus:outline-none"
                        >
                          Terms and Conditions
                        </button>
                      </label>
                    </div>
                  )}
                />
                {errors.termsAccepted && (
                  <p className="text-red-500 text-xs mt-1">{errors.termsAccepted.message}</p>
                )}
              </div>

              {/* Create Account Button: 282x52 */}
              <Button
                type="submit"
                disabled={isLoading}
                className="register-button"
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>

            {/* Divider: 441x1 */}
            <div className="register-divider" />

            {/* Sign In Link */}
            <div className="register-signin-link">
              <p className="register-signin-text">
                Already have an account?
              </p>
              <Link href="/auth/login" className="register-signin-button">
                Sign In Instead
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Terms and Conditions Dialog */}
      <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-black font-montserrat">
              Terms and Conditions
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-2">
              Last updated: {new Date().toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4 text-sm text-gray-700 font-lato">
            <section>
              <h3 className="font-bold text-base mb-2">1. Acceptance of Terms</h3>
              <p className="mb-3">
                By accessing and using CuraVoice, you accept and agree to be bound by the terms and provision of this agreement. 
                If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">2. Use License</h3>
              <p className="mb-3">
                Permission is granted to temporarily use CuraVoice for personal, non-commercial transitory viewing only. 
                This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose or for any public display</li>
                <li>Attempt to reverse engineer any software contained in CuraVoice</li>
                <li>Remove any copyright or other proprietary notations from the materials</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">3. Healthcare Training Disclaimer</h3>
              <p className="mb-3">
                CuraVoice is designed for educational and training purposes only. The AI-powered patient simulations 
                are not a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice 
                of your physician or other qualified health provider with any questions you may have regarding a medical condition.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">4. User Account</h3>
              <p className="mb-3">
                You are responsible for maintaining the confidentiality of your account and password. You agree to accept 
                responsibility for all activities that occur under your account or password. You must notify us immediately 
                of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">5. Privacy Policy</h3>
              <p className="mb-3">
                Your use of CuraVoice is also governed by our Privacy Policy. Please review our Privacy Policy to understand 
                our practices regarding the collection and use of your personal information.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">6. Limitation of Liability</h3>
              <p className="mb-3">
                In no event shall CuraVoice or its suppliers be liable for any damages (including, without limitation, damages 
                for loss of data or profit, or due to business interruption) arising out of the use or inability to use the 
                materials on CuraVoice, even if CuraVoice or a CuraVoice authorized representative has been notified orally or 
                in writing of the possibility of such damage.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">7. Revisions</h3>
              <p className="mb-3">
                CuraVoice may revise these terms of service at any time without notice. By using this service you are agreeing 
                to be bound by the then current version of these terms of service.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-base mb-2">8. Contact Information</h3>
              <p className="mb-3">
                If you have any questions about these Terms and Conditions, please contact us through our support channels.
              </p>
            </section>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              onClick={() => setShowTermsDialog(false)}
              className="px-6"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
