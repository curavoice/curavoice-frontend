import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Formats a scenario title by converting underscores to spaces and title casing.
 * Examples:
 * - "pain_management" -> "Pain Management"
 * - "mental_health" -> "Mental Health"
 * - "womens_health" -> "Womens Health"
 * - "Start Pain_management Scenario" -> "Start Pain Management Scenario"
 */
export function formatScenarioTitle(title: string | null | undefined): string {
  if (!title) return 'Training Session'
  
  // Replace underscores with spaces and split into words
  const words = title.replace(/_/g, ' ').split(/\s+/)
  
  // Title case each word (capitalize first letter, lowercase rest)
  const formattedWords = words.map(word => {
    if (word.length === 0) return word
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })
  
  return formattedWords.join(' ')
}


