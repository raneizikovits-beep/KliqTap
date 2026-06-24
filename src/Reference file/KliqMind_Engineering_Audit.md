# KliqMind V5.2 — Principal Engineering Audit
### Files: `useAppStore.js` · `wellnessSlice.js` · `webrtc.js` · `webrtc.web.js`
**Audit Level:** Enterprise / Production-Grade  
**Auditor Profile:** Principal Engineer — Distributed Systems, AI Platforms, Security  
**Date:** 2026-06-15

---

## 1. Executive Summary

| Dimension | Status |
|---|---|
| Architecture | ✅ Solid foundation, slice pattern correct |
| Security | ⚠️ GPS in query params, AsyncStorage PII, no input validation |
| Performance | ⚠️ Full-profile fetch for follow-status, no request deduplication |
| Scalability | ✅ Cache TTL + LRU in place; concerns at >100k users |
| Reliability | ⚠️ Timeout leak, race condition on GPS, missing error states |
| Production Readiness | **68 / 100** |

**Overall Assessment:**  
The store layer is well-engineered for an early-stage product. The migration system, optimistic update patterns, and LRU cache are notably thoughtful. However, there are **4 security findings** (one critical) and **6 reliability bugs** that must be resolved before scaling. None require architectural rework — all are surgical fixes.

---

## 2. Critical Findings

---

### 🔴 CRITICAL-1 — GPS Coordinates in Query String

**File:** `useAppStore.js` line 633  
**Severity:** Critical — Privacy / Security  

```js
// CURRENT — VULNERABLE
const data = await fetchAPI(`/geo/radar?lat=${latitude}&lon=${longitude}`);
```

**Root Cause:** Precise GPS coordinates in URL query params are persisted in:  
- Server access logs  
- CDN/proxy logs  
- Browser history  
- Network monitoring tools  

**Impact:** Exact physical location of every KliqMind user is permanently logged outside your control. This is a GDPR/CCPA liability.

**Fix — move to POST body:**
```js
const data = await fetchAPI('/geo/radar', {
  method: 'POST',
  body: JSON.stringify({
    lat: parseFloat(latitude.toFixed(4)),   // ≤11m precision — sufficient for radar
    lon: parseFloat(longitude.toFixed(4)),
  }),
});
```

Coordinate precision should also be reduced to 4 decimal places (~11 m accuracy), which is more than sufficient for social radar while reducing fingerprinting resolution.

---

### 🔴 CRITICAL-2 — Roulette Timeout Memory Leak

**File:** `useAppStore.js` lines 522–527  
**Severity:** Critical — Memory / State Corruption  

```js
// CURRENT — LEAKS
setTimeout(() => {
  if (get().isRouletteSearching) {
    set({ isRouletteSearching: false });
    Toast.show({ ... });
  }
}, 30_000);
```

**Root Cause:** `setTimeout` ID is never stored or cleared. If:
- `onRouletteMatchReceived` fires before 30s
- The user navigates away  
- `findStreamRouletteMatch` is called again (double-tap guard prevents, but only within one invocation)  

...the timeout still fires and calls `set()` and `Toast.show()` on a stale state.

**Fix:**
```js
// Store the timeout ID at module level or inside state
let _rouletteTimeoutId = null;

findStreamRouletteMatch: async () => {
  if (get().isRouletteSearching) return;

  // Clear any previous timeout
  if (_rouletteTimeoutId) {
    clearTimeout(_rouletteTimeoutId);
    _rouletteTimeoutId = null;
  }

  set({ isRouletteSearching: true, rouletteMatch: null });

  try {
    const data = await fetchAPI('/live/roulette', { method: 'POST' });

    if (data?.match) {
      set({ rouletteMatch: data.match, isRouletteSearching: false });
      Toast.show({ ... });
    } else if (data?.queued) {
      Toast.show({ ... });
      _rouletteTimeoutId = setTimeout(() => {
        _rouletteTimeoutId = null;
        if (get().isRouletteSearching) {
          set({ isRouletteSearching: false });
          Toast.show({ type: 'info', text1: 'No match found', text2: 'Try again in a moment.' });
        }
      }, 30_000);
    } else {
      set({ isRouletteSearching: false });
    }
  } catch (error) { ... }
},

onRouletteMatchReceived: (match) => {
  if (_rouletteTimeoutId) {
    clearTimeout(_rouletteTimeoutId);
    _rouletteTimeoutId = null;
  }
  set({ rouletteMatch: match, isRouletteSearching: false });
  Toast.show({ ... });
},
```

---

### 🟠 HIGH-1 — wellnessSlice: Zero Input Validation

**File:** `wellnessSlice.js` lines 18, 40, 89  
**Severity:** High — Security / API Abuse  

```js
// All three pass raw user input to API with no sanitization:
body: JSON.stringify({ mood, note: note || undefined }),       // logMood
body: JSON.stringify({ text, mood: mood || undefined }),       // createJournalEntry
body: JSON.stringify({ text }),                                // replyToTicket
```

**Root Cause:** No validation layer between UI input and API call.  
**Impact:** Users can submit arbitrarily large payloads. A `text` field of 10MB in `createJournalEntry` will be forwarded to the API directly.

**Fix — add a thin validation helper:**
```js
// wellnessSlice.js — add at top of file
const MOOD_VALUES   = ['great', 'good', 'okay', 'bad', 'terrible'];
const MAX_NOTE_LEN  = 500;
const MAX_TEXT_LEN  = 10_000;

const validateMood = (mood) => {
  if (!MOOD_VALUES.includes(mood)) throw new Error(`Invalid mood: ${mood}`);
};
const truncate = (str, max) =>
  typeof str === 'string' ? str.slice(0, max) : undefined;

// Inside logMood:
logMood: async (mood, note) => {
  validateMood(mood);
  const safeNote = truncate(note, MAX_NOTE_LEN);
  ...
},

// Inside createJournalEntry:
createJournalEntry: async (text, mood) => {
  if (!text?.trim()) throw new Error('Journal text required');
  if (mood) validateMood(mood);
  const safeText = truncate(text, MAX_TEXT_LEN);
  ...
},
```

The server must also enforce these — client validation is a UX guard, not a security boundary.

---

### 🟠 HIGH-2 — `streak` State Collision Between Store and wellnessSlice

**File:** `useAppStore.js` line 151 + `wellnessSlice.js` line 20 (inside `wellnessStats`)  
**Severity:** High — State Correctness  

The main store declares:
```js
// useAppStore.js line 151
streak: 0,
```

`wellnessSlice` declares:
```js
// wellnessSlice.js
wellnessStats: {
  streak: 0,   // nested inside object — OK
  ...
},
```

These are structurally different (`state.streak` vs `state.wellnessStats.streak`) but semantically represent the same concept. **Which is the source of truth?**

- `state.streak` is persisted and gamification-linked  
- `state.wellnessStats.streak` comes from the server via `fetchWellnessStats`  

They will diverge. The `award('Streak')` action updates `state.streak` but `wellnessStats.streak` is only updated by the server. Callers reading different fields will show inconsistent streak counts.

**Fix:** Designate one source of truth. If the server is authoritative, remove `state.streak` from the top-level store and derive it only from `wellnessStats.streak`, or sync them explicitly inside `fetchWellnessStats`:
```js
fetchWellnessStats: async () => {
  ...
  const stats = await fetchAPI('/support/wellness/stats');
  set({
    wellnessStats: stats || { ... },
    streak: stats?.streak ?? get().streak, // sync to top-level
  });
},
```

---

### 🟠 HIGH-3 — `checkFollowStatus` Fetches Full User Profile for One Flag

**File:** `useAppStore.js` lines 399–414  
**Severity:** High — Performance / Over-fetching  

```js
checkFollowStatus: async (targetId) => {
  const response = await fetchAPI(`/users/${targetId}`);  // full profile fetch
  if (response && typeof response.isFollowing !== 'undefined') { ... }
},
```

**Root Cause:** The endpoint `/users/${targetId}` returns a full user profile object just to read a single boolean.  
**Impact:** Every time a user sees another profile, you're transmitting a full user payload. At 100k concurrent users, this is a significant bandwidth and server cost multiplier.

**Fix:** Add a lightweight endpoint — or better, always include `isFollowing` in the profile preview returned by `fetchProfilePreview`, which already does this correctly (lines 306–314). Then `checkFollowStatus` becomes redundant and can be removed. Where standalone follow-status is needed, add a dedicated endpoint:
```
GET /users/:id/follow-status → { isFollowing: boolean }
```

---

### 🟠 HIGH-4 — `wellnessSlice.replyToTicket` is in the Wrong Slice

**File:** `wellnessSlice.js` lines 89–100  
**Severity:** High — Architectural Boundary Violation  

`replyToTicket` handles support ticket replies. It uses `get().fetchMyTickets?.()` — a method that almost certainly lives in `authSlice` or a `supportSlice`. This function has zero conceptual relation to wellness state.

**Impact:** Future developers will not find ticket logic when looking for support features. Hidden cross-slice coupling (`fetchMyTickets`) from an unexpected location.

**Fix:** Move `replyToTicket` to the support/tickets domain — likely `authSlice` or a new `supportSlice`. `wellnessSlice` should only contain mood, journal, and activity management.

---

### 🟡 MEDIUM-1 — `__DEV__` Global May Be Undefined on Web

**File:** `useAppStore.js` (30+ occurrences) + `wellnessSlice.js` (5 occurrences)  
**Severity:** Medium — Runtime Error Risk  

`__DEV__` is a React Native Metro bundler global. When the app runs in a web browser (confirmed by `webrtc.web.js` existing), Webpack does not inject `__DEV__` unless explicitly configured.

**Risk:** `ReferenceError: __DEV__ is not defined` crashing entire async actions.

**Fix:** Add a shim at the top of the store entry or in a `globals.js`:
```js
// globals.js — import this before the store
if (typeof __DEV__ === 'undefined') {
  global.__DEV__ = process.env.NODE_ENV !== 'production';
}
```
Or replace all occurrences with `process.env.NODE_ENV !== 'production'` which works in both environments.

---

### 🟡 MEDIUM-2 — Stale GPS Persisted and Served on App Restart

**File:** `useAppStore.js` lines 728–742 (partialize)  
**Severity:** Medium — Data Correctness  

`userLocation` including `latitude` and `longitude` is persisted to AsyncStorage. On app restart, rehydration restores coordinates that could be hours or days old. Features consuming `userLocation` (like Radar) will silently operate on stale data until GPS updates.

**Fix:** Either exclude `userLocation` from persistence entirely, or persist only the `name` string and null the coordinates on rehydration:
```js
partialize: (state) => ({
  ...
  // Persist name only; coordinates re-acquired from device on next mount
  userLocation: { name: state.userLocation?.name || 'Global', latitude: null, longitude: null },
  ...
}),
```

---

### 🟡 MEDIUM-3 — Wellness Loading Actions Have No Request Deduplication

**File:** `wellnessSlice.js` — `fetchMoodHistory`, `fetchJournalEntries`  
**Severity:** Medium — Performance / Race Condition  

Both functions have no in-flight guard, unlike `fetchWeeklyChallenge` which correctly checks `isWeeklyChallengeLoading`. Rapid re-renders or tab switches can fire multiple simultaneous API calls, causing race conditions where an older response overwrites a newer one.

**Fix** — consistent loading guard pattern:
```js
fetchMoodHistory: async (days = 30) => {
  if (get().isWellnessLoading) return;   // ← add guard
  set({ isWellnessLoading: true });
  try {
    ...
  } finally {
    set({ isWellnessLoading: false });
  }
},
```
Each fetch function should have its own boolean flag (e.g., `isMoodHistoryLoading`) rather than sharing the single `isWellnessLoading`, so they don't block each other.

---

### 🟡 MEDIUM-4 — GPS Module-Level State Creates Cross-Instance Pollution

**File:** `useAppStore.js` lines 58–59  
**Severity:** Medium — Test Reliability / SSR Safety  

```js
let lastGpsSyncAt     = 0;   // module-level mutable
let lastSyncedCoords  = null;
```

**Root Cause:** Module-level `let` variables are shared across all instances of the module in the same process. In test runners (Jest), each test that imports the store will share these values, causing test interference. In SSR environments, these bleed across requests.

**Fix:** If SSR is not a concern, this is acceptable. For test isolation, export a `_resetGpsState()` helper:
```js
export const _resetGpsState = () => {
  lastGpsSyncAt    = 0;
  lastSyncedCoords = null;
};
```
Call it in `beforeEach` in tests that test `setUserLocation`.

---

### 🟡 MEDIUM-5 — userCache in AsyncStorage Contains User PII

**File:** `useAppStore.js` lines 736–741  
**Severity:** Medium — Privacy  

`userCache` stores profile data (names, avatars, possibly bios) in AsyncStorage, which is unencrypted plain text on device. If the device is jailbroken/rooted or the app backup is accessed, this data is exposed.

**Recommendation:** Either exclude `userCache` from persistence (cache is fast to rebuild), or migrate to `expo-secure-store` for any fields containing personal data. Given the 5-minute TTL, the performance benefit of persisting the cache is marginal.

---

### 🟡 MEDIUM-6 — `updateSetting` Has No Rollback on API Failure

**File:** `useAppStore.js` lines 194–206  
**Severity:** Medium — UX Consistency  

```js
updateSetting: async (key, value) => {
  set(state => ({ userSettings: { ...state.userSettings, [key]: value } })); // optimistic
  try {
    await fetchAPI('/users/settings', { ... });
  } catch (error) {
    // ❌ setting stays changed locally even though server rejected it
  }
},
```

On API failure, the setting remains changed locally, creating a split between UI state and server state. For example, if the user disables `ghostMode` and the API fails, the app shows ghost mode as off, but the server still has it on — potentially exposing the user's location contrary to their intent.

**Fix:**
```js
updateSetting: async (key, value) => {
  const previous = get().userSettings[key];
  set(state => ({ userSettings: { ...state.userSettings, [key]: value } }));
  try {
    await fetchAPI('/users/settings', { method: 'PATCH', body: JSON.stringify({ [key]: value }) });
  } catch (error) {
    // Rollback
    set(state => ({ userSettings: { ...state.userSettings, [key]: previous } }));
    Toast.show({ type: 'error', text1: 'Settings could not be saved', text2: 'Please try again.' });
    if (__DEV__) console.error(`[Store] Failed to sync setting "${key}":`, error);
  }
},
```

---

### 🟡 MEDIUM-7 — `award('Unlike')` Shows Error Toast for Normal Action

**File:** `useAppStore.js` lines 174–186  
**Severity:** Low-Medium — UX  

```js
} else {
  Toast.show({
    type: 'error',         // ← "error" implies something went wrong
    text1: `😞 ${pointsToAdd} PTS`,
    text2: 'Point removed.',
  });
}
```

`'error'` toast type (typically red) is semantically wrong for a routine action like unliking a post. Users will think they triggered an error.

**Fix:** Use `'info'` type for deductions from normal actions.

---

### 🟡 MEDIUM-8 — webrtc.web.js Has No Environment Guard

**File:** `webrtc.web.js` lines 1–4  
**Severity:** Low-Medium — SSR Safety  

```js
export const RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
```

`window` is not defined in Node.js/SSR environments. If this file is ever imported server-side (e.g., during SSR, testing, or build tooling), it will throw immediately.

**Fix:**
```js
const _win = typeof window !== 'undefined' ? window : {};
export const RTCPeerConnection  = _win.RTCPeerConnection  || _win.webkitRTCPeerConnection || null;
export const RTCIceCandidate    = _win.RTCIceCandidate    || null;
export const RTCSessionDescription = _win.RTCSessionDescription || null;
export const mediaDevices       = _win.navigator?.mediaDevices || null;
```

---

## 3. Architecture Assessment

### Strengths

**Slice Composition Pattern** — The `create(persist(...(set, get) => ({ ...createAuthSlice, ...createSocialSlice, ...createChatSlice, ...createWellnessSlice })))` pattern is the canonical Zustand approach for large stores. Executed correctly.

**Cache Layer** — TTL + LRU eviction (`evictOldestIfNeeded`, `freshCacheEntry`) is well-implemented. The `USER_CACHE_MAX_SIZE = 100` + `persist 50 entries` split is a smart memory management decision.

**Immutable Migrations** — The `migrate` function correctly builds `next = { ...persisted }` before mutating, preventing storage corruption across version upgrades. The V2→V3 migration wrapping old cache entries as `{ data: v, cachedAt: 0 }` (marking them expired) is particularly elegant.

**Optimistic Updates** — Both `toggleFollow` and `joinCommunity` implement correct optimistic-update-then-reconcile patterns with rollback.

**Platform Adapter** — The `.web.js` / `.js` dual-file pattern for WebRTC is the right approach. Metro (React Native) and Webpack/Expo both support this file-extension override cleanly.

**Haversine Throttle** — Dual-condition GPS throttle (time AND distance) prevents the common mistake of only checking time, which would hammer the server when a user stands in one place.

### Weaknesses

1. **No slice conflict detection** — Spread merging of slices silently overwrites duplicate keys. `streak` is declared in both the main store and inside `wellnessStats`. As the app grows, key collisions will become harder to debug.
   
2. **`wellnessSlice` is an over-stuffed module** — It currently handles: moods, journals, wellness activities, stats, AND support ticket replies. Should be split into `wellnessSlice` + `supportSlice`.

3. **No centralized error state** — Each slice handles errors locally with console warnings. There's no global `errors: {}` state map that the UI can react to, making it difficult to show persistent error messages.

4. **Missing `fetchMyTickets`** — Referenced via `get().fetchMyTickets?.()` in both `wellnessSlice` and `createSupportTicket`, but not visible in the provided code. Optional chaining (`?.`) masks whether this method actually exists. This is a hidden coupling.

---

## 4. Security Assessment

| Vector | Status | Finding |
|---|---|---|
| GPS location exposure | 🔴 Vulnerable | Coordinates in URL query params (CRITICAL-1) |
| AsyncStorage PII | 🟠 At Risk | userCache stores profile data unencrypted |
| Input validation | 🟠 Missing | No validation on mood, journal text, ticket reply |
| Token handling | ✅ Correct | Token excluded from AsyncStorage persist |
| Optimistic mutation safety | ✅ Safe | Rollback patterns prevent silent data corruption |
| Ghost mode rollback | 🟠 Missing | updateSetting doesn't roll back on failure (MEDIUM-6) |
| Prompt Injection (AI layer) | N/A | No AI prompt logic visible in provided files |
| XSS | ✅ Mitigated | React Native doesn't render HTML; not applicable |

**Priority Actions:**
1. Move GPS to POST body immediately
2. Add input validation in wellnessSlice
3. Add rollback to `updateSetting` — especially critical for privacy settings like `ghostMode`

---

## 5. Performance Assessment

### Bottlenecks

**`checkFollowStatus`** fires a full `/users/${targetId}` profile fetch just to read `isFollowing`. In a feed with 20 users, that's 20 full-profile fetches on mount. Estimated overhead: ~50-200ms per call × 20 = 1-4s of unnecessary network time.

**Radar API precision** — Sending 15-digit float coordinates to the server when 4 decimal places is sufficient adds unnecessary entropy and prevents server-side query caching (identical locations never match).

**No request deduplication in wellnessSlice** — If `fetchMoodHistory` is called from multiple components (e.g., HomeScreen + WellnessTab both mounting), two identical requests fire simultaneously. The later response wins, discarding the earlier — wasted bandwidth and server load.

**`userCache` persisted as JSON** — Serializing/deserializing 50 user profile objects on every app launch adds ~10-50ms to time-to-interactive depending on device. Consider excluding from persistence given the 5-minute TTL makes it stale quickly anyway.

### Positive Performance Decisions

- GPS throttling (30s + 50m) is correct — prevents location-spam
- `fetchWeeklyChallenge` has correct in-flight guard (`isWeeklyChallengeLoading`)
- `moodHistory.slice(0, 365)` prevents unbounded growth
- `journalEntries.slice(0, 200)` same

---

## 6. AI Systems Assessment

The provided files are store/state management and platform adapters. No AI orchestration logic (agents, prompts, RAG) is visible. The following observations apply to the AI-adjacent store properties:

**`isAiSpeaking` / `isUserRecording` flags (lines 331–334):** Simple booleans — correct for boolean UI state. If the AI voice pipeline is async (WebRTC + STT + LLM + TTS), consider adding an `aiConversationPhase: 'idle' | 'listening' | 'processing' | 'speaking'` state machine rather than two independent booleans, which can fall out of sync.

**WebRTC integration:** The adapter pattern is correct. No issues with the platform split. Ensure that `RTCPeerConnection` is null-checked before use — both adapters can return `null` in environments that don't support WebRTC.

---

## 7. Refactoring Report

The following changes are recommended. Items marked ✅ are safe to apply immediately. Items marked ⚠️ require backend coordination.

| # | Change | Why | Impact |
|---|---|---|---|
| 1 ✅ | Move GPS from query param to POST body | Privacy/security | No user-visible change |
| 2 ✅ | Store and clear roulette `setTimeout` ID | Prevents stale state/toast | No user-visible change |
| 3 ✅ | Add rollback to `updateSetting` | Prevent ghost-mode state split | UX improvement |
| 4 ✅ | Add `__DEV__` shim for web | Prevent runtime crash | Stability |
| 5 ✅ | Add window guard in webrtc.web.js | SSR/test safety | No runtime change |
| 6 ✅ | Add mood enum + length validation | Security + UX | API call rejects invalid input |
| 7 ✅ | Move `replyToTicket` to support domain | Architectural clarity | No behavior change |
| 8 ✅ | Add in-flight guards to mood/journal fetches | Prevent race conditions | Stability |
| 9 ✅ | Change 'error' toast to 'info' for Unlike | UX correctness | Visual-only change |
| 10 ✅ | Exclude `userLocation.coordinates` from persist | Prevent stale GPS | On next app open |
| 11 ⚠️ | Add `/users/:id/follow-status` endpoint | Remove over-fetching | Requires backend |
| 12 ⚠️ | Add coordinate precision rounding (4dp) | Privacy + cache-friendliness | Requires backend compatibility check |

---

## 8. Production Readiness Scores

| Dimension | Score | Notes |
|---|---|---|
| Architecture | **80/100** | Slice composition solid; `streak` collision and over-stuffed wellness slice are the primary gaps |
| Security | **55/100** | GPS in query params is a critical finding; input validation absent; unencrypted PII cache |
| Performance | **70/100** | Throttling and LRU are good; over-fetching on follow-status and no dedup on wellness calls |
| Scalability | **72/100** | Cache design scales well; no pagination visible on leaderboard or radar results |
| Maintainability | **78/100** | Clear naming; good comments; architectural boundary violations will compound over time |
| Reliability | **65/100** | Timeout leak, missing rollback on settings, race conditions in wellness fetch |
| AI Readiness | **60/100** | AI state flags present but binary; no conversation state machine visible |
| Enterprise Readiness | **62/100** | Missing observability hooks, no request ID tracing, no error reporting integration |
| **Overall** | **68/100** | |

---

## 9. Strategic Roadmap

### 0–30 Days (Immediate — Pre-Scale Blockers)
- [ ] **CRITICAL-1:** Move GPS to POST body
- [ ] **CRITICAL-2:** Fix roulette timeout leak
- [ ] **HIGH-1:** Add input validation in wellnessSlice
- [ ] **HIGH-2:** Decide on single source of truth for `streak`
- [ ] **MEDIUM-6:** Add rollback to `updateSetting` (especially for privacy settings)
- [ ] Add `__DEV__` shim for web build
- [ ] Move `replyToTicket` to a support slice

### 1–3 Months (Reliability & Performance)
- [ ] **HIGH-3:** Add `/users/:id/follow-status` endpoint; remove full-profile fetch for status
- [ ] Add per-action loading flags to wellnessSlice (`isMoodHistoryLoading`, `isJournalLoading`)
- [ ] Add global `errorStates: Record<string, string>` map for UI to surface persistent errors
- [ ] Implement request deduplication (AbortController pattern) for parallel fetch guards
- [ ] Add integration tests for optimistic update + rollback scenarios (follow, joinCommunity, settings)
- [ ] Migrate userCache out of AsyncStorage or encrypt it

### 3–6 Months (Architecture Maturity)
- [ ] Extract `supportSlice` (tickets, replies, wellness stats — server-side concern)
- [ ] Implement slice key conflict detection (lint rule or runtime check in dev mode)
- [ ] Add observability: integrate Sentry or similar; attach `userId` context to all error reports
- [ ] Add pagination support for leaderboard (`/users/leaderboard?page=&limit=`)
- [ ] Add request ID headers (`x-request-id`) for distributed tracing
- [ ] Build a `useWellness()` selector hook to decouple wellness UI from full store

### 6–12 Months (AI Platform Evolution)
- [ ] Replace `isAiSpeaking` + `isUserRecording` booleans with `voiceConversationPhase` state machine
- [ ] Add AI conversation context persistence (compressed sliding window, not full history)
- [ ] Implement token-efficient context compression for long wellness journal conversations
- [ ] Build AI activity recommendations based on mood history patterns
- [ ] Add server-sent events (SSE) or WebSocket subscription for real-time wellnessStats updates

### 12–24 Months (Enterprise Scale)
- [ ] Extract store into domain-specific micro-stores with Zustand `createStore` (non-singleton pattern) for feature-flag-gated module loading
- [ ] Implement offline-first architecture: queue mood/journal entries locally (MMKV) when offline, sync on reconnect
- [ ] Move GPS data to a separate privacy-controlled data store with explicit consent versioning
- [ ] Add E2E encryption for journal entries (client-side key, server stores ciphertext only)
- [ ] Implement GDPR data export and right-to-erasure endpoints surfaced through the store

---

## Appendix: Positive Patterns Worth Preserving

The following are done correctly and should not be changed:

```js
// ✅ Haversine dual-condition throttle — keep exactly as-is
if (timeSinceLast < GPS_SYNC_MIN_INTERVAL_MS && distanceMoved < GPS_SYNC_MIN_DISTANCE_M) return;

// ✅ LRU eviction — correctly removes oldest by cachedAt timestamp
const oldestKey = keys.reduce((oldest, k) =>
    (cache[k].cachedAt ?? 0) < (cache[oldest]?.cachedAt ?? Infinity) ? k : oldest
, keys[0]);

// ✅ Immutable migration — builds fresh object, never mutates persisted
let next = { ...persisted };

// ✅ Radar response normalization — defensive array checks
users:  Array.isArray(data?.users)  ? data.users  : [],
groups: Array.isArray(data?.groups) ? data.groups : [],

// ✅ V5.2 self-sufficient fetchRadarData — callers don't need to manage permissions
const Location = await import('expo-location');
const { status } = await Location.requestForegroundPermissionsAsync();
```

---

*End of Audit — KliqMind V5.2 Store Layer*  
*Next audit should include: `authSlice.js`, `socialSlice.js`, `chatSlice.js`, `api.js`, `mimeUtils.js`*
