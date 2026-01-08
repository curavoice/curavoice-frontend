'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import LogoIcon from '@/components/icons/Logo'
import EchoIcon from '@/components/icons/Echo'
import { ArrowLeft, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  return (
    <div className="login-container">
      <div className="login-card">
        {/* Left panel - Branding */}
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

        {/* Right panel - Forgot password form */}
        <div className="login-right-panel">
          <div className="w-full flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-6">
              <Mail className="w-7 h-7 text-[#344895]" />
            </div>
            
            <h2 className="login-title">Coming Soon</h2>
            
            <p className="login-subtitle max-w-[420px] mb-6">
              Forgot password is not available yet. Please create a new account instead, or contact curavoiceapp@gmail.com for help.
            </p>

            <div className="w-full max-w-[282px] space-y-3">
              <Link href="/auth/register">
                <Button className="login-button">Create New Account</Button>
              </Link>
              <a href="mailto:curavoiceapp@gmail.com" className="block">
                <Button variant="outline" className="w-full">
                  Contact Support
                </Button>
              </a>
            </div>

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
