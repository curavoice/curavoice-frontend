/**
 * Mobile Optimization Utilities
 * Handles Safari/iOS audio support, network quality detection, and mobile-specific features
 */

/**
 * Audio format detection for cross-browser compatibility
 * Returns the best supported audio MIME type for MediaRecorder
 * Priority: WebM/Opus > WebM > MP4 > WAV
 */
export function getOptimalAudioMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',  // Chrome, Firefox, Edge - Best quality/compression
    'audio/webm',               // Chrome, Firefox, Edge - Fallback
    'audio/mp4',                // Safari, iOS - Required for Apple devices
    'audio/wav'                 // Universal fallback
  ];

  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      console.log(`[Audio Format] ✅ Using: ${type}`);
      return type;
    }
  }

  // Last resort - MediaRecorder might use default
  console.warn('[Audio Format] ⚠️ No supported format found, using default');
  return 'audio/webm';
}

/**
 * Network quality detection
 * Returns optimal audio bitrate based on connection speed
 */
export function getOptimalAudioBitrate(): number {
  // Default to medium quality if Network Information API not available
  const defaultBitrate = 64000;

  // Check if Network Information API is available
  const connection = (navigator as any).connection ||
                     (navigator as any).mozConnection ||
                     (navigator as any).webkitConnection;

  if (!connection) {
    console.log('[Network Quality] Network API not available, using default bitrate:', defaultBitrate);
    return defaultBitrate;
  }

  const effectiveType = connection.effectiveType;

  const bitrateMap: Record<string, number> = {
    'slow-2g': 32000,   // Low quality for very slow networks
    '2g': 32000,        // Low quality
    '3g': 64000,        // Medium quality
    '4g': 128000,       // High quality
    '5g': 128000        // High quality
  };

  const bitrate = bitrateMap[effectiveType] || defaultBitrate;
  console.log(`[Network Quality] Connection: ${effectiveType}, using bitrate: ${bitrate}bps`);

  return bitrate;
}

/**
 * Battery-aware audio quality adjustment
 * Reduces audio quality when battery is low
 */
export async function getBatteryAwareBitrate(baseBitrate: number): Promise<number> {
  try {
    if ('getBattery' in navigator) {
      const battery = await (navigator as any).getBattery();

      // If battery is low (<20%) and not charging, reduce quality
      if (battery.level < 0.2 && !battery.charging) {
        console.log('[Battery] Low battery detected, reducing audio quality');
        return 32000; // Low bitrate
      }
    }
  } catch (err) {
    console.log('[Battery] Battery API not available or failed:', err);
  }

  return baseBitrate;
}

/**
 * iOS AudioContext initialization helper
 * iOS requires AudioContext to be created/resumed on user interaction
 */
export async function initializeAudioContext(): Promise<AudioContext | null> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;

    if (!AudioContextClass) {
      console.error('[AudioContext] AudioContext not supported in this browser');
      return null;
    }

    const audioContext = new AudioContextClass();

    // iOS requires resume on user interaction
    if (audioContext.state === 'suspended') {
      console.log('[AudioContext] Resuming suspended AudioContext (iOS fix)');
      await audioContext.resume();
    }

    console.log('[AudioContext] ✅ Initialized:', {
      sampleRate: audioContext.sampleRate,
      state: audioContext.state
    });

    return audioContext;
  } catch (err) {
    console.error('[AudioContext] Failed to initialize:', err);
    return null;
  }
}

/**
 * Screen Wake Lock API
 * Prevents screen from sleeping during training sessions
 */
export class WakeLockManager {
  private wakeLock: any = null;

  async request(): Promise<boolean> {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');

        this.wakeLock.addEventListener('release', () => {
          console.log('[Wake Lock] 🔓 Released');
        });

        console.log('[Wake Lock] ✅ Screen wake lock active');
        return true;
      } else {
        console.log('[Wake Lock] ⚠️ Wake Lock API not supported');
        return false;
      }
    } catch (err) {
      console.error('[Wake Lock] ❌ Failed to acquire:', err);
      return false;
    }
  }

  release() {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
      console.log('[Wake Lock] Released manually');
    }
  }

  isActive(): boolean {
    return this.wakeLock !== null && !this.wakeLock.released;
  }
}

/**
 * Browser detection utilities
 */
export function isSafari(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.indexOf('safari') !== -1 && ua.indexOf('chrome') === -1;
}

export function isIOS(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

export function isMobile(): boolean {
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
}

/**
 * Background/Foreground detection for mobile
 * Calls callback when app is backgrounded or foregrounded
 */
export function setupVisibilityChangeHandler(
  onBackground: () => void,
  onForeground: () => void
): () => void {
  const handler = () => {
    if (document.hidden) {
      console.log('[Visibility] ⏸️ App backgrounded');
      onBackground();
    } else {
      console.log('[Visibility] ▶️ App foregrounded');
      onForeground();
    }
  };

  document.addEventListener('visibilitychange', handler);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handler);
  };
}

/**
 * Connection type information
 */
export function getConnectionInfo(): {
  type: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
} | null {
  const connection = (navigator as any).connection ||
                     (navigator as any).mozConnection ||
                     (navigator as any).webkitConnection;

  if (!connection) {
    return null;
  }

  return {
    type: connection.type || 'unknown',
    effectiveType: connection.effectiveType || 'unknown',
    downlink: connection.downlink || 0,
    rtt: connection.rtt || 0
  };
}

/**
 * Log mobile optimization info for debugging
 */
export function logMobileOptimizationInfo() {
  console.log('=== Mobile Optimization Info ===');
  console.log('Browser:', {
    isSafari: isSafari(),
    isIOS: isIOS(),
    isMobile: isMobile(),
    userAgent: navigator.userAgent
  });

  const audioFormat = getOptimalAudioMimeType();
  console.log('Audio Format:', audioFormat);

  const bitrate = getOptimalAudioBitrate();
  console.log('Audio Bitrate:', bitrate);

  const connectionInfo = getConnectionInfo();
  console.log('Connection:', connectionInfo);

  console.log('Wake Lock Support:', 'wakeLock' in navigator);
  console.log('Battery API Support:', 'getBattery' in navigator);
  console.log('================================');
}
