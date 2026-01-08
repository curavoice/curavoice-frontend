'use client'

import { Clock, Sparkles } from 'lucide-react'

interface ComingSoonProps {
  title?: string
  description?: string
  icon?: React.ReactNode
}

export default function ComingSoon({
  title = 'Coming Soon',
  description = 'We\'re working hard to bring you this feature. Stay tuned!',
  icon,
}: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-12">
      <div className="bg-white border-2 border-[#3DD6D0] rounded-[20px] sm:rounded-[33px] p-8 sm:p-12 max-w-2xl w-full text-center shadow-lg">
        <div className="flex justify-center mb-6">
          {icon || (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#3DD6D0] to-[#344895] rounded-full blur-xl opacity-30 animate-pulse" />
              <div className="relative bg-white rounded-full p-5 border-2 border-[#3DD6D0]">
                <Clock className="w-12 h-12 text-[#344895]" />
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-[#3DD6D0]" />
          <h2 className="text-2xl sm:text-3xl font-montserrat font-extrabold text-[#1A1F71]">
            {title}
          </h2>
          <Sparkles className="w-5 h-5 text-[#3DD6D0]" />
        </div>
        
        <p className="text-base sm:text-lg font-lato text-gray-600 mb-8 max-w-md mx-auto">
          {description}
        </p>
        
        <div className="h-1 w-24 bg-gradient-to-r from-[#3DD6D0] to-[#344895] mx-auto rounded-full" />
      </div>
    </div>
  )
}
