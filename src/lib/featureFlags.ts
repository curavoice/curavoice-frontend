/**
 * Feature flags configuration
 * 
 * Feature flags are controlled via environment variables.
 * Set NEXT_PUBLIC_NAPLEX_COMING_SOON=true to show the "Coming Soon" page.
 */

export const featureFlags = {
  /**
   * NAPLEX Coming Soon toggle
   * When true, the NAPLEX section shows a placeholder.
   * When false (default), the full feature is active.
   */
  naplexComingSoon: process.env.NEXT_PUBLIC_NAPLEX_COMING_SOON === 'true',
} as const

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof featureFlags): boolean {
  return featureFlags[feature]
}
