/**
 * Fun loading messages for Echo loader
 * Messages rotate randomly or can be context-specific
 */

export type LoadingContext = 'dashboard' | 'profile' | 'reports' | 'training' | 'general' | 'admin' | 'reload'

const loadingMessages: Record<LoadingContext, string[]> = {
  dashboard: [
    "Hang tight with Echo here...",
    "Echo's gathering your stats...",
    "Echo's doing some quick math...",
    "Echo's counting your wins...",
    "Echo's preparing your dashboard...",
    "Echo's got your back, just a sec...",
    "Echo's organizing everything...",
    "Echo's almost there, promise!",
  ],
  profile: [
    "Echo's fetching your profile...",
    "Echo's getting your info together...",
    "Echo's reading your profile...",
    "Hang on with Echo here...",
    "Echo's gathering your details...",
    "Echo's almost ready...",
  ],
  reports: [
    "Echo's compiling your reports...",
    "Echo's analyzing your sessions...",
    "Echo's crunching the numbers...",
    "Echo's preparing your performance data...",
    "Hang tight, Echo's working on it...",
    "Echo's gathering all your stats...",
  ],
  training: [
    "Echo's getting ready to train...",
    "Echo's preparing scenarios...",
    "Echo's setting up your session...",
    "Hang on, Echo's almost ready...",
    "Echo's loading training scenarios...",
    "Echo's getting everything set up...",
  ],
  admin: [
    "Echo's loading admin data...",
    "Echo's gathering admin info...",
    "Echo's preparing the dashboard...",
    "Hang on with Echo here...",
    "Echo's almost there...",
  ],
  general: [
    "Hang on with Echo here...",
    "Echo's working on it...",
    "Echo's got this, just a moment...",
    "Echo's doing something cool...",
    "Echo's almost ready...",
    "Echo's preparing something awesome...",
    "Echo's on it, hang tight...",
    "Echo's making magic happen...",
  ],
  reload: [
    "Echo's reloading...",
    "Echo's refreshing...",
    "Echo's updating...",
    "Echo's reloading the data...",
    "Echo's refreshing everything...",
    "Hang on, Echo's reloading...",
  ],
}

/**
 * Get a random loading message for a given context
 */
export function getLoadingMessage(context: LoadingContext = 'general'): string {
  const messages = loadingMessages[context] || loadingMessages.general
  return messages[Math.floor(Math.random() * messages.length)]
}

/**
 * Get all messages for a context (useful for cycling)
 */
export function getLoadingMessages(context: LoadingContext = 'general'): string[] {
  return loadingMessages[context] || loadingMessages.general
}


