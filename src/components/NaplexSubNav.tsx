'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, BookOpen, ClipboardList, Layers, Timer } from 'lucide-react'

import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/naplex', label: 'Overview', Icon: BookOpen },
  { href: '/naplex/practice', label: 'Practice', Icon: ClipboardList },
  { href: '/naplex/exam', label: 'Exam', Icon: Timer },
  { href: '/naplex/decks', label: 'Decks', Icon: Layers },
  { href: '/naplex/analytics', label: 'Analytics', Icon: BarChart3 },
]

export default function NaplexSubNav() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href

  return (
    <div
      className="mb-4 sm:mb-6 rounded-[20px] sm:rounded-[33px] border-2 border-[#3DD6D0] bg-white p-2 shadow-sm overflow-x-auto scrollbar-hide [-webkit-overflow-scrolling:touch]"
      aria-label="NAPLEX Prep navigation"
    >
      <div className="flex w-max gap-2">
        {LINKS.map(({ href, label, Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-montserrat font-bold transition-all',
                active
                  ? 'bg-gradient-to-r from-[#344895] to-[#1A1F71] text-white shadow'
                  : 'bg-[#F0F0F0] text-[#1A1F71] hover:bg-[#3DD6D0]/20'
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-white' : 'text-[#344895]')} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
