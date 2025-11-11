/**
 * API Response Caching Service
 * Reduces API calls and improves mobile performance
 * Uses localStorage for persistent caching
 */

export interface CacheConfig {
  key: string;
  expiryMs: number; // Cache expiry time in milliseconds
}

export interface CachedData<T> {
  data: T;
  timestamp: number;
}

/**
 * Generic cache service for API responses
 */
export class ApiCache {
  /**
   * Get cached data if available and not expired
   * @param key Cache key
   * @param expiryMs Cache expiry time in milliseconds
   * @returns Cached data or null if not found/expired
   */
  static get<T>(key: string, expiryMs: number): T | null {
    try {
      const cached = localStorage.getItem(key);
      const timestamp = localStorage.getItem(`${key}_timestamp`);

      if (!cached || !timestamp) {
        console.log(`[Cache] Miss for key: ${key}`);
        return null;
      }

      const age = Date.now() - parseInt(timestamp);
      if (age >= expiryMs) {
        console.log(`[Cache] Expired for key: ${key} (age: ${age}ms, expiry: ${expiryMs}ms)`);
        this.invalidate(key);
        return null;
      }

      console.log(`[Cache] ✅ Hit for key: ${key} (age: ${age}ms)`);
      return JSON.parse(cached);
    } catch (err) {
      console.error(`[Cache] Error getting cache for ${key}:`, err);
      return null;
    }
  }

  /**
   * Set cached data with timestamp
   * @param key Cache key
   * @param data Data to cache
   */
  static set<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(`${key}_timestamp`, Date.now().toString());
      console.log(`[Cache] ✅ Set for key: ${key}`);
    } catch (err) {
      console.error(`[Cache] Error setting cache for ${key}:`, err);
    }
  }

  /**
   * Invalidate (remove) cached data
   * @param key Cache key
   */
  static invalidate(key: string): void {
    try {
      localStorage.removeItem(key);
      localStorage.removeItem(`${key}_timestamp`);
      console.log(`[Cache] 🗑️ Invalidated key: ${key}`);
    } catch (err) {
      console.error(`[Cache] Error invalidating cache for ${key}:`, err);
    }
  }

  /**
   * Clear all cached data
   */
  static clearAll(): void {
    try {
      // Only clear our app's cache keys (prefix with 'curavoice_')
      const keys = Object.keys(localStorage);
      const appKeys = keys.filter(k => k.startsWith('curavoice_'));

      appKeys.forEach(key => {
        localStorage.removeItem(key);
      });

      console.log(`[Cache] 🗑️ Cleared all cache (${appKeys.length} keys)`);
    } catch (err) {
      console.error('[Cache] Error clearing all cache:', err);
    }
  }

  /**
   * Get cache size information
   */
  static getSize(): { keys: number; estimatedBytes: number } {
    try {
      const keys = Object.keys(localStorage);
      const appKeys = keys.filter(k => k.startsWith('curavoice_'));

      let estimatedBytes = 0;
      appKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          estimatedBytes += key.length + value.length;
        }
      });

      return {
        keys: appKeys.length,
        estimatedBytes
      };
    } catch (err) {
      console.error('[Cache] Error getting cache size:', err);
      return { keys: 0, estimatedBytes: 0 };
    }
  }
}

/**
 * Cached API fetch wrapper
 * Automatically handles caching logic
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  expiryMs: number = 3600000 // Default: 1 hour
): Promise<T> {
  // Try to get from cache first
  const cached = ApiCache.get<T>(key, expiryMs);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  console.log(`[Cache] Fetching fresh data for key: ${key}`);
  const data = await fetcher();

  // Store in cache
  ApiCache.set(key, data);

  return data;
}

/**
 * Pre-defined cache keys and expiry times
 */
export const CACHE_KEYS = {
  TRAINING_FEATURES: 'curavoice_training_features',
  PHARMACY_SCENARIOS: 'curavoice_pharmacy_scenarios',
  USER_PROFILE: 'curavoice_user_profile'
};

export const CACHE_EXPIRY = {
  ONE_HOUR: 3600000,      // 1 hour
  ONE_DAY: 86400000,      // 24 hours
  ONE_WEEK: 604800000,    // 7 days
  FIVE_MINUTES: 300000    // 5 minutes
};

/**
 * Example usage:
 *
 * // Get training features with 1-hour cache
 * const features = await cachedFetch(
 *   CACHE_KEYS.TRAINING_FEATURES,
 *   async () => {
 *     const response = await fetch('/api/v1/training/features');
 *     return response.json();
 *   },
 *   CACHE_EXPIRY.ONE_HOUR
 * );
 *
 * // Get scenarios with 1-hour cache
 * const scenarios = await cachedFetch(
 *   CACHE_KEYS.PHARMACY_SCENARIOS,
 *   async () => {
 *     const response = await fetch('/api/v1/training/scenarios');
 *     return response.json();
 *   },
 *   CACHE_EXPIRY.ONE_HOUR
 * );
 *
 * // Invalidate cache when needed
 * ApiCache.invalidate(CACHE_KEYS.TRAINING_FEATURES);
 *
 * // Clear all cache
 * ApiCache.clearAll();
 */
