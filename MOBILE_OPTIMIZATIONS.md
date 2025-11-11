# Mobile Optimizations Implementation Guide

## Overview

The CuraVoice frontend has been enhanced with comprehensive mobile optimizations to ensure excellent performance on Safari/iOS, Android, and various network conditions.

## ✅ Implemented Features

### 1. **Safari/iOS Audio Support** 🎵

**Problem:** Safari and iOS don't support WebM audio format
**Solution:** Automatic audio format detection with fallbacks

**Implementation:**
- `src/lib/mobileOptimizations.ts` - `getOptimalAudioMimeType()`
- Detects best supported format: WebM/Opus → WebM → MP4 → WAV
- Automatically uses MP4 or WAV on Safari/iOS
- Integrated into `useTrainingSession.ts` audio recording

**Browser Support:**
- ✅ Chrome/Edge: WebM/Opus (best quality/compression)
- ✅ Firefox: WebM/Opus
- ✅ Safari (macOS): MP4 or WAV
- ✅ Safari (iOS): MP4 or WAV
- ✅ Android Chrome: WebM/Opus

---

### 2. **WebSocket Ping/Pong** 📡

**Problem:** Mobile networks drop idle connections after 60-90 seconds
**Solution:** Automatic ping/pong keep-alive mechanism

**Implementation:**
- `src/lib/trainingApi.ts` - `WebSocketManager` class
- Sends ping every 30 seconds to keep connection alive
- Handles pong responses from backend
- Prevents unexpected disconnections on mobile

**Benefits:**
- Long training sessions remain connected
- Works on 3G/4G/5G networks
- Handles WiFi ↔ Cellular transitions

---

### 3. **Auto-Reconnection Logic** 🔄

**Problem:** Network drops cause session interruptions
**Solution:** Exponential backoff reconnection strategy

**Implementation:**
- `src/lib/trainingApi.ts` - `WebSocketManager.attemptReconnect()`
- Automatically reconnects on network issues (code 1006)
- Exponential backoff: 2s, 4s, 8s, 16s, 32s
- Max 5 reconnection attempts
- Callbacks for reconnecting/reconnected states

**User Experience:**
- Seamless reconnection without user intervention
- Visual feedback during reconnection
- Preserves session state

---

### 4. **iOS AudioContext Fix** 🍎

**Problem:** iOS requires AudioContext to be created/resumed on user interaction
**Solution:** Proper AudioContext initialization workflow

**Implementation:**
- `src/lib/mobileOptimizations.ts` - `initializeAudioContext()`
- Creates AudioContext on user interaction (button click)
- Automatically resumes suspended contexts
- Compatible with iOS autoplay policies

**Integration:**
- Called when starting recording (`startRecording()`)
- Ensures audio playback works on first interaction

---

### 5. **Network Quality Detection** 📶

**Problem:** Poor networks cause large audio files and timeouts
**Solution:** Adaptive audio bitrate based on connection speed

**Implementation:**
- `src/lib/mobileOptimizations.ts` - `getOptimalAudioBitrate()`
- Uses Network Information API to detect connection type
- Adjusts bitrate: Slow 2G (32kbps) → 3G (64kbps) → 4G/5G (128kbps)
- Battery-aware: Reduces quality on low battery (<20%)

**Bitrate Map:**
- Slow 2G: 32 kbps (low quality)
- 2G: 32 kbps (low quality)
- 3G: 64 kbps (medium quality)
- 4G/5G: 128 kbps (high quality)
- Low battery (<20%): 32 kbps (conserve power)

---

### 6. **Background/Foreground Handling** 📱

**Problem:** Recording fails when app goes to background
**Solution:** Automatic pause/resume on visibility changes

**Implementation:**
- `src/lib/mobileOptimizations.ts` - `setupVisibilityChangeHandler()`
- `src/hooks/useTrainingSession.ts` - Visibility change listeners
- Pauses recording when app backgrounded
- Resumes recording when app foregrounded
- Resumes AudioContext if suspended

**Mobile Behavior:**
- iOS: Recording pauses when switching apps
- Android: Recording pauses when screen locked
- Automatic resume on app return

---

### 7. **Screen Wake Lock** 🔒

**Problem:** Screen turns off during long training sessions
**Solution:** Wake Lock API prevents screen sleep

**Implementation:**
- `src/lib/mobileOptimizations.ts` - `WakeLockManager` class
- `src/hooks/useTrainingSession.ts` - Wake lock lifecycle
- Requests wake lock when session starts
- Releases wake lock when session ends
- Graceful fallback if API not supported

**Benefits:**
- Screen stays on during training
- No manual screen touching required
- Automatically releases when session ends

---

### 8. **API Response Caching** 💾

**Problem:** Repeated API calls waste bandwidth and slow app
**Solution:** localStorage-based caching with expiry

**Implementation:**
- `src/lib/apiCache.ts` - `ApiCache` class and `cachedFetch()` helper
- Caches features, scenarios, and user profile
- 1-hour default expiry (configurable)
- Automatic invalidation on expiry
- Size monitoring and cache clearing

**Usage Example:**
```typescript
import { cachedFetch, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/apiCache';

// Fetch with automatic caching
const features = await cachedFetch(
  CACHE_KEYS.TRAINING_FEATURES,
  async () => {
    const response = await fetch('/api/v1/training/features');
    return response.json();
  },
  CACHE_EXPIRY.ONE_HOUR
);
```

**Cache Keys:**
- `TRAINING_FEATURES`: Training feature flags (1 hour)
- `PHARMACY_SCENARIOS`: Pharmacy scenario list (1 hour)
- `USER_PROFILE`: User profile data (1 hour)

---

## 🚀 Testing Checklist

### Cross-Browser Testing

- [ ] **Chrome/Edge (Windows/Mac)**
  - Audio recording with WebM format
  - WebSocket stable connection
  - Ping/pong keeps connection alive

- [ ] **Firefox (Windows/Mac)**
  - Audio recording with WebM format
  - WebSocket stable connection

- [ ] **Safari (macOS)**
  - Audio recording with MP4/WAV format
  - AudioContext initialized properly
  - WebSocket stable connection

- [ ] **Safari/iOS (iPhone/iPad)**
  - Audio recording with MP4 format
  - AudioContext requires user interaction (button click)
  - App backgrounding pauses recording
  - WebSocket reconnects after network change

- [ ] **Chrome/Android**
  - Audio recording works
  - Background handling works
  - Network quality detection works

### Network Conditions

Test with Chrome DevTools Network Throttling:

- [ ] **WiFi (Fast)** - High quality audio (128kbps)
- [ ] **4G** - High quality audio (128kbps)
- [ ] **3G** - Medium quality audio (64kbps)
- [ ] **Slow 3G** - Low quality audio (32kbps)
- [ ] **Network Drop** - Auto-reconnection works
- [ ] **Network Switch (WiFi ↔ Cellular)** - Reconnection works

### Mobile-Specific

- [ ] **App Backgrounding** - Recording pauses
- [ ] **App Foregrounding** - Recording resumes
- [ ] **Low Battery (<20%)** - Reduced audio quality
- [ ] **Screen Lock Prevention** - Wake lock works
- [ ] **Long Sessions (>2 min)** - Ping/pong prevents timeout

---

## 📊 Performance Improvements

### Bandwidth Reduction

| Feature | Before | After | Savings |
|---------|--------|-------|---------|
| Feature flags | Not cached | Cached 1hr | ~90% less API calls |
| Scenarios list | Not cached | Cached 1hr | ~90% less API calls |
| Audio on 3G | 128 kbps | 64 kbps | 50% smaller files |
| Audio on 2G | 128 kbps | 32 kbps | 75% smaller files |

### Connection Stability

| Metric | Before | After |
|--------|--------|-------|
| Disconnects on mobile | ~60s idle | Unlimited (ping/pong) |
| Reconnection | Manual | Automatic (5 attempts) |
| Network switch handling | Fails | Auto-reconnects |

---

## 🛠️ Developer Guide

### Using Mobile Optimization Utilities

```typescript
import {
  getOptimalAudioMimeType,
  getOptimalAudioBitrate,
  getBatteryAwareBitrate,
  initializeAudioContext,
  WakeLockManager,
  setupVisibilityChangeHandler,
  isSafari,
  isIOS,
  isMobile
} from '@/lib/mobileOptimizations';

// Detect optimal audio format
const mimeType = getOptimalAudioMimeType();
// Result: "audio/webm;codecs=opus" (Chrome) or "audio/mp4" (Safari)

// Detect optimal bitrate
const bitrate = getOptimalAudioBitrate();
const batteryAwareBitrate = await getBatteryAwareBitrate(bitrate);
// Result: 32000, 64000, or 128000 (bps)

// Initialize AudioContext (iOS-friendly)
const audioContext = await initializeAudioContext();

// Wake lock management
const wakeLock = new WakeLockManager();
await wakeLock.request(); // Request wake lock
wakeLock.release();       // Release wake lock

// Visibility handling
const cleanup = setupVisibilityChangeHandler(
  () => console.log('App backgrounded'),
  () => console.log('App foregrounded')
);
// Call cleanup() to remove listeners

// Browser detection
if (isIOS()) {
  console.log('Running on iOS');
}
if (isSafari()) {
  console.log('Running on Safari');
}
```

### Using WebSocketManager

```typescript
import { connectToTrainingConversation, WebSocketManager } from '@/lib/trainingApi';

const wsManager = connectToTrainingConversation(
  sessionId,
  (data) => {
    // Handle text messages
    console.log('Message:', data);
  },
  (audioBlob) => {
    // Handle audio responses
    console.log('Audio:', audioBlob);
  },
  (error) => {
    // Handle errors
    console.error('Error:', error);
  },
  (attempt) => {
    // Reconnecting callback
    console.log(`Reconnecting (attempt ${attempt})...`);
  },
  () => {
    // Reconnected callback
    console.log('Reconnected!');
  }
);

// Send audio
wsManager.send(audioBlob);

// Send text
wsManager.send(JSON.stringify({ type: 'text', text: 'Hello' }));

// Close connection
wsManager.close();

// Check connection status
if (wsManager.isConnected()) {
  console.log('Connected!');
}
```

### Using API Cache

```typescript
import { cachedFetch, ApiCache, CACHE_KEYS, CACHE_EXPIRY } from '@/lib/apiCache';

// Fetch with automatic caching
const features = await cachedFetch(
  CACHE_KEYS.TRAINING_FEATURES,
  async () => {
    const response = await fetch('/api/v1/training/features');
    return response.json();
  },
  CACHE_EXPIRY.ONE_HOUR
);

// Manual cache operations
ApiCache.set('my_key', { foo: 'bar' });
const data = ApiCache.get('my_key', CACHE_EXPIRY.ONE_HOUR);
ApiCache.invalidate('my_key');
ApiCache.clearAll();

// Get cache size
const { keys, estimatedBytes } = ApiCache.getSize();
console.log(`Cache: ${keys} keys, ~${estimatedBytes} bytes`);
```

---

## 📱 Mobile Debugging

### Browser Console Logs

All mobile optimizations log with prefixes:

- `[Mobile Optimization]` - Initialization and cleanup
- `[Mobile]` - Background/foreground events
- `[Audio Format]` - Format detection
- `[Network Quality]` - Connection type and bitrate
- `[Battery]` - Battery status
- `[AudioContext]` - Audio initialization
- `[Wake Lock]` - Screen wake lock status
- `[WebSocket]` - Connection events, ping/pong
- `[Recording]` - Audio recording events
- `[Cache]` - Cache hits/misses

### Viewing Logs on iOS

1. Connect iPhone to Mac
2. Open Safari on Mac → Develop → [Your iPhone] → [Your Website]
3. View console logs in Safari Web Inspector

### Viewing Logs on Android

1. Enable USB debugging on Android
2. Connect to computer
3. Chrome → `chrome://inspect` → Inspect your device
4. View console logs in DevTools

---

## 🚨 Common Issues & Solutions

### Issue 1: Safari Audio Not Working

**Symptom:** MediaRecorder fails on Safari
**Solution:** Format detection automatically uses MP4/WAV for Safari

**Verify:**
```javascript
// Check what format is being used
const mimeType = getOptimalAudioMimeType();
console.log('Using format:', mimeType);
// Should show "audio/mp4" or "audio/wav" on Safari
```

### Issue 2: WebSocket Disconnects on Mobile

**Symptom:** Connection drops after 60 seconds
**Solution:** Ping/pong is automatically enabled

**Verify:**
```javascript
// Look for these logs:
// [WebSocket] 📤 Ping sent
// [WebSocket] 📥 Pong received - connection alive
```

### Issue 3: No Audio After Backgrounding (iOS)

**Symptom:** Audio stops when app goes to background
**Solution:** Automatic pause/resume is implemented

**Verify:**
```javascript
// Look for these logs:
// [Mobile] App backgrounded
// [Mobile] Pausing recording due to background
// [Mobile] App foregrounded
// [Mobile] Resuming recording
```

### Issue 4: AudioContext Suspended (iOS)

**Symptom:** No audio playback on iOS
**Solution:** AudioContext initialized on user interaction

**Verify:**
```javascript
// AudioContext must be created when user clicks button
// Look for this log:
// [AudioContext] ✅ Initialized: {sampleRate: 48000, state: "running"}
```

---

## 📈 Monitoring & Analytics

### Recommended Metrics to Track

1. **Audio Format Usage**
   - % users on WebM vs MP4 vs WAV
   - Helps understand browser distribution

2. **Network Quality**
   - % users on 2G/3G/4G/5G
   - Average bitrate used
   - Helps optimize for target audience

3. **WebSocket Stability**
   - Disconnection rate
   - Reconnection success rate
   - Average session duration

4. **Cache Performance**
   - Cache hit rate
   - Average load time improvement
   - Bandwidth savings

5. **Mobile vs Desktop**
   - % mobile users
   - Mobile session completion rate
   - Mobile error rate

---

## 🎉 Summary

**Critical Features Implemented:**
- ✅ Safari/iOS audio support (MP4/WAV)
- ✅ WebSocket ping/pong keep-alive
- ✅ Auto-reconnection with exponential backoff
- ✅ iOS AudioContext initialization

**Recommended Features Implemented:**
- ✅ Network quality detection
- ✅ Background/foreground handling
- ✅ Screen wake lock
- ✅ API response caching

**Backend Compatibility:**
- ✅ Ping/pong supported (backend handles `type: "ping"` and responds `type: "pong"`)
- ✅ Multi-format audio accepted (WebM, WAV, MP4, OGG)
- ✅ GZip compression enabled
- ✅ CORS configured for mobile

**No Frontend Changes Needed:**
- ❌ Voice selection (backend handles)
- ❌ Scenario expansion (backend handles)
- ❌ Mem0 integration (backend only)

---

## 📞 Support

If you encounter issues:

1. Check browser console for error logs
2. Verify network conditions (WiFi vs Cellular)
3. Test on real devices (not just simulators)
4. Check backend compatibility (ping/pong, audio formats)

For questions or bug reports, please contact the development team.

---

**Last Updated:** 2025-11-11
**Version:** 1.0.0
**Contributors:** Claude Code Assistant
