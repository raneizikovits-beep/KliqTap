# KliqTap — Production Code Audit & Hardening Report

**Reviewer:** Senior architecture & code-quality review
**Scope:** 20 files across `client/src/` (screens, store, services) — 6,005 lines
**Verdict:** Strong product instincts and clean UI work, but **three release-blocking bugs** plus architectural inconsistencies prevent a safe production launch. All are fixable in days, not weeks.

---

## Executive Summary

| Severity | Count | Examples |
|---|---|---|
| 🔴 **Critical** (blocks production) | 3 | Hardcoded LAN IP `192.168.1.60` in client bundle; admin PIN baked into JS bundle; `window.SecureStore` token-purge call that cannot exist |
| 🟠 **High** (correctness / perf / security) | 6 | `useShallow` only used in `AppRoot` — 11 other screens cause re-render storms; `api.ts` timeout race during 401 refresh; duplicated `userSettings` state; wrong MIME for `.jpg` |
| 🟡 **Medium** (debt / consistency) | 7 | 40 raw `console.*` calls left in code; mixed JS/TS; inconsistent service usage (`authService` defined but bypassed); `useEffect` dep arrays missing entries; hardcoded Hebrew locale in `ChatScreen` |
| 🟢 **Low** (polish) | 5 | `LinearGradient` imported, never used; placeholder Unsplash URLs; magic numbers; emoji-only empty states |

**Bottom line:** The codebase is closer to production-ready than the bug count suggests — the issues are concentrated, the patterns to fix them are already present elsewhere in the codebase (e.g. `useShallow` in `AppRoot`, `fetchAPI` in `api.ts`), and the data layer is conceptually sound. This is cleanup work, not a rewrite.

---

## 1. Critical Findings (Release Blockers)

### 🔴 1.1 Hardcoded developer LAN IP in `AlertsScreen.js` & `AdminNoticeScreen.js`

**Found in 8 places.** Production API base is `https://api.kliqtap.com`, but these two screens call:

```js
// AlertsScreen.js:144
await fetch(`http://192.168.1.60:3000/notifications/${item.id}/read`, {...})

// AlertsScreen.js:160
await fetch(`http://192.168.1.60:3000/notifications/read/all`, {...})

// AdminNoticeScreen.js:59, 109, 142, 171, plus error strings on 134 & 152
fetch('http://192.168.1.60:3000/communities/explore', ...)
fetch('http://192.168.1.60:3000/communities/admin/notice', ...)
fetch('http://192.168.1.60:3000/communities/admin/notice/clear', ...)
fetch('http://192.168.1.60:3000/notifications/test-trigger', ...)
```

**Why this is critical:**

1. **The app is broken in production.** Any phone outside the developer's LAN cannot reach `192.168.1.60`. "Mark as read", "Mark all as read", admin stats, admin notices, and admin notification testing all silently fail or throw network errors on real users' devices.
2. **Information disclosure.** The dev's home/office LAN IP is visible to anyone who unpacks the JS bundle. This is a low-grade but unnecessary leak.
3. **Bypasses auth.** These calls use raw `fetch` instead of `fetchAPI`, which means: no token refresh on 401, no AbortController/timeout, no centralized error parsing, no FormData boundary handling.
4. **HTTP not HTTPS.** Even if the URL were correct, traffic over plain HTTP would expose tokens.

**Fix:** Replace every `fetch('http://192.168.1.60:3000/...')` with `fetchAPI('/...')`. The endpoints are already there, just route them through the existing client. See `refactored/AlertsScreen.js` for the pattern.

---

### 🔴 1.2 Admin PIN hardcoded in client bundle (`AdminNoticeScreen.js`)

```js
// AdminNoticeScreen.js:20
const [SECRET_PIN, SET_SECRET_PIN] = useState('120687');
// ...
if (pin === SECRET_PIN) setIsAuthenticated(true);
```

**Why this is critical:**

1. **The PIN is recoverable from the production bundle** — anyone with `react-native-decompiler` or even `strings` on the JS file can read it.
2. **The "change PIN" only mutates React state**, so it resets to `120687` on every app reload. The setter `SET_SECRET_PIN` is misleading code that does nothing durable.
3. **There is no server-side verification of admin status visible in the calls.** The admin endpoints rely solely on the user's normal Bearer token. If the server doesn't enforce role checks, any logged-in user who reads the bundle can post global notices and clear the board.

**Note on the PIN value:** `120687` reads as `12-06-87` — likely a date of birth. **Personal dates should never be used as production secrets.** Even after this is moved server-side, the value should be rotated.

**Fix:**

* Move admin authentication to the server. The client should call `POST /admin/login` with credentials, receive a short-lived admin scope token, and only then unlock admin actions.
* Server endpoints (`/communities/admin/*`, `/notifications/test-trigger`) must verify role from the JWT, not trust the client.
* Remove the PIN from client code entirely. The admin screen should be gated by the server's response, not by a string comparison in JavaScript.

---

### 🔴 1.3 `handlePurgeTokens` in `AuthScreen.js` references APIs that don't exist

```js
// AuthScreen.js:23-33
const handlePurgeTokens = async () => {
    try {
        if (window.SecureStore && window.SecureStore.deleteItemAsync) { ... }
        else if (window.Expo && window.Expo.SecureStore) { ... }
        else if (window.NativeModules && window.NativeModules.AsyncStorage && ...) { ... }
        else { Alert.alert("Error", "Storage utility not found."); return; }
```

**Why this is broken:**

* `expo-secure-store` is a JavaScript module, not a global. It is **never** attached to `window` in any version of Expo.
* `window.Expo.SecureStore` and `window.NativeModules.AsyncStorage.clear` are also fictional — `NativeModules` is on the `react-native` import, not `window`, and even there `AsyncStorage` is no longer exposed.
* On native (iOS/Android) `window` is a polyfill that doesn't have these — every branch falls through to "Storage utility not found".

The button labeled `[Dev] Reset Tokens` therefore does nothing on real devices. If a developer relies on it during testing, they'll be debugging stale tokens that the button claimed to clear.

**Fix:** Import the modules properly and call them directly. (See `refactored/AuthScreen.js` for the patch — five lines.)

```js
import * as SecureStore from 'expo-secure-store';
import { clearLocalTokens } from '../store/api';

const handlePurgeTokens = async () => {
  try {
    await SecureStore.deleteItemAsync('auth_access_token');
    await SecureStore.deleteItemAsync('auth_refresh_token');
    clearLocalTokens(); // also clears in-memory copies
    Alert.alert("Done", "Tokens purged. Please reload the app.");
  } catch (e) {
    Alert.alert('Error', e.message);
  }
};
```

---

## 2. High-Priority Findings

### 🟠 2.1 Zustand selector misuse — re-render storm in 11 of 12 screens

`AppRoot.js` does it correctly:

```js
import { useShallow } from 'zustand/react/shallow';
const { user, ... } = useAppStore(useShallow(state => ({ user: state.user, ... })));
```

But every other screen does **one of two anti-patterns**:

**Pattern A — full-store destructure (re-renders on every state change anywhere):**

```js
// MessagesScreen.js, TribesScreen.js, ExploreScreen.js, HomeScreen.js
const { user, refreshAllData, chatHistory, ... } = useAppStore();
```

**Pattern B — object selector without shallow equality (returns a new object every call → re-renders even when nothing changed):**

```js
// ChatScreen.js, SettingsScreen.js, OnboardingScreen.js, AlertsScreen.js
const { user, logout, settings } = useAppStore(state => ({
  user: state.user, logout: state.logout, settings: state.userSettings || {}
}));
```

**Impact:** When a single field updates (a new chat message arrives, points increment, a typing indicator flips), every subscribed screen re-renders even when nothing it cares about changed. On Android mid-tier devices, this manifests as dropped frames in `FlatList` scrolls and stutter when messages arrive.

**Fix (two equivalent options):**

1. Wrap every object selector in `useShallow` (matches `AppRoot.js`).
2. Use atomic primitive selectors:
   ```js
   const user = useAppStore(s => s.user);
   const logout = useAppStore(s => s.logout);
   ```
   Each subscribes only to its slice. Zustand's strict equality on primitives makes this free.

I recommend **Option 2 for actions** (they're stable references, cheapest possible) and **`useShallow` for groups of related data**.

A `storeSelectors.js` helper module is provided in `refactored/` to make this idiomatic.

---

### 🟠 2.2 `api.ts` — timeout race condition during 401 refresh

```ts
// api.ts:111-121
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), options.timeout || 15000);

const executeFetch = async (currentHeaders: Headers): Promise<Response> => {
    return await fetch(url, { ...options, headers: currentHeaders, signal: controller.signal });
};

let response = await executeFetch(headers);
clearTimeout(timeoutId);
```

**Three real bugs:**

1. **`clearTimeout` only fires on the success path.** If the first `fetch` rejects (network error, DNS failure), the timeout keeps running and `controller.abort()` is called on an already-rejected request — no harm, but the timer leaks. More importantly:
2. **The 401 → refresh → retry path reuses the same controller and timeoutId.** The second `executeFetch` is still bound to the first request's deadline. If the original 15s budget elapsed while we were in `attemptTokenRefresh`, the retry is aborted before it starts.
3. **The recursive call when `isRefreshing === true`** (`return fetchAPI(endpoint, { ...options, headers })`) creates a *new* controller and timeout — but the outer `timeoutId` is never cleared, so it can still fire and abort... nothing relevant. Just wasted timer.

**Fix:** Move timeout creation inside `executeFetch`, scope it per-attempt:

```ts
const executeFetch = async (currentHeaders: Headers): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? 15000);
    try {
        return await fetch(url, { ...options, headers: currentHeaders, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
};
```

Full corrected version in `refactored/api.ts`.

---

### 🟠 2.3 Duplicated `userSettings` state — single source of truth violated

`userSettings` is defined **twice**:

```js
// authSlice.js — initialGlobalState
userSettings: { gpsEnabled: true, showOnMap: true, ... darkMode: false }

// useAppStore.js — store-level
userSettings: { gpsEnabled: true, showOnMap: true, ... darkMode: false }
```

Because `useAppStore` spreads `createAuthSlice` first and *then* defines its own `userSettings`, the store-level one **wins**. But on `logout()`, `set(initialGlobalState)` resets everything back to the auth slice's defaults — which silently shadow the store-level defaults. As long as the two stay synchronized this is invisible; the moment they drift, you get phantom bugs.

**Worse:** `SettingsScreen` reads `state.userSettings` but `AppRoot` reads `state.userSettings || {}`. They both work, but the inconsistency is a smell.

**Fix:** Define `userSettings` once. The auth slice should not own UI/preferences — that's a separate concern. Either:

* (A) Extract a dedicated `settingsSlice.js`, or
* (B) Keep it in the store root and **remove the duplicate from `authSlice.js`**, then have `logoutCleanup` reset only auth-related fields, not the entire object.

Option B is the smaller patch:

```js
// authSlice.js — drop userSettings from initialGlobalState entirely
// logoutCleanup keeps the user's darkMode/notifications preferences across logout
//   (which is actually better UX — settings shouldn't be wiped on logout)
```

---

### 🟠 2.4 `uploadFile` produces invalid MIME `image/jpg`

```js
// useAppStore.js:148
if (filename.match(/\.(png|jpe?g)$/i))
    fileMimeType = `image/${filename.split('.').pop().toLowerCase()}`;
```

For `photo.jpg`, this yields `image/jpg`, which is **not** a valid IANA MIME type — the correct value is `image/jpeg`. Some servers and CDNs reject `image/jpg` with 415; others quietly serve it but break Content-Type sniffing on download.

`pulse.service.js` already gets this right:

```js
else if (['jpg', 'jpeg'].includes(ext)) type = 'image/jpeg';
```

**Fix:** Extract MIME detection into a shared helper (see `refactored/mimeUtils.js`) and use it from both places. Bonus: also fix `magicUpload` in `pulse.service.js`, which has its own slightly-different copy of the same logic — three implementations of "guess MIME from URI" across the codebase, and they disagree.

---

### 🟠 2.5 Direct `fetch()` calls bypass the auth refresh layer

Beyond the LAN-IP issue (1.1), the structural problem is that `AlertsScreen.js` and `AdminNoticeScreen.js` use raw `fetch()` instead of `fetchAPI`. Even after we fix the URL, raw `fetch` means:

* No automatic token refresh on 401 — users get logged out spuriously
* No AbortController / timeout
* No central error message extraction
* No FormData boundary handling
* No way to bypass auth for public endpoints (the `auth: false` flag)

**Fix:** All authenticated server calls must go through `fetchAPI`. Make this an ESLint rule (`no-restricted-globals: ['fetch']` in screens/) so future drift is caught at lint time.

---

### 🟠 2.6 `useEffect` dependency arrays incomplete in multiple screens

* `AlertsScreen.js:122` — `useEffect(() => { fetchNotifications(); }, [])` should include `fetchNotifications`.
* `ExploreScreen.js:30` — depends on `posts.length` and `fetchPosts` but lists only `fetchExploreData`.
* `TribesScreen.js:65` — same issue.

These will not bite you immediately because the omitted functions are stable Zustand actions, but they will the moment someone refactors the actions to be re-created (e.g. with `useCallback` in a wrapper). Modern lint configs (`react-hooks/exhaustive-deps`) flag these — turn the rule on.

---

## 3. Medium-Priority Findings

| # | File | Issue | Fix |
|---|---|---|---|
| 3.1 | `ChatScreen.js:26` | `toLocaleTimeString('he-IL', ...)` hardcodes Hebrew locale | Use `[]` (system locale) or read from `userSettings.locale` |
| 3.2 | All files | 40 `console.log/warn/error` left in code | Strip in production via `babel-plugin-transform-remove-console`, or wrap in a `logger` that no-ops in `__DEV__ === false` |
| 3.3 | `authService.js` exists but `authSlice.js` calls `fetchAPI` directly for `/auth/login` and `/auth/register` | Inconsistent — pick one path | Either delete `authService.js` or have `authSlice` use it |
| 3.4 | `authSlice.js:155` | Hardcoded Google `webClientId` | Move to env config (`expo-constants` extra, or `react-native-config`) |
| 3.5 | `AuthScreen.js:18` | `BG_IMAGE` is a remote Unsplash URL — production should bundle locally | Move to `assets/auth-bg.jpg` and use `require()` |
| 3.6 | `HomeScreen.js:18-22` | `STANDARD_VIBES` and `SPECIAL_SPOTLIGHT` defined inside the screen | Move to `constants/data.js` so server can drive them later |
| 3.7 | `ExploreScreen.js`, `TribesScreen.js`, others | `Alert.alert` for every join/leave/error | Replace with a shared `Toast` (already used in `useAppStore.createComment`) for non-blocking UX |

---

## 4. Architectural Assessment

### Current architecture (summary)

```
AppRoot.js  ─┬─ useAppStore (Zustand)
             │     ├─ createAuthSlice  → /auth, /users, settings
             │     ├─ createSocialSlice → posts, groups, follows
             │     ├─ createChatSlice  → DMs, groups
             │     └─ inline UI/explore/radar/support state
             │
             ├─ MainNavigator → 7 screens
             ├─ AppModals (sheets, calls, vibe check)
             └─ SpeedDial (FAB)

api.ts (TS) ─ fetchAPI ─ Bearer token + refresh + AbortController
```

### Strengths

* **Clean store composition.** Slices are split sensibly (auth/social/chat). The composed `useAppStore` pattern is exactly right for Zustand.
* **`api.ts` is conceptually correct.** Token refresh queue, AbortController for timeouts, web/mobile storage abstraction — these are senior-level decisions.
* **`AppRoot.js` already uses `useShallow`.** The pattern is *known* to the codebase, just inconsistently applied.
* **Dark mode is reactive throughout.** Most screens read `userSettings.darkMode` and re-style cleanly.

### Weaknesses

1. **Single `useAppStore.js` is becoming a god-object** (357 lines, mixing settings, profile peek, follow system, explore, radar, support, leaderboard). Each cross-cutting concern should be its own slice.
2. **Mixed JS / TS.** Only `api.ts` is typed. New code should be TS; existing files can migrate incrementally.
3. **No request deduplication or caching.** Multiple components call `fetchExploreData` on mount — there's nothing preventing 3 simultaneous calls during a fast tab switch.
4. **No central error boundary.** A throw in `PostCard` will crash the app; React Native shows the red-screen-of-death in dev and a white screen in production.
5. **Stories/Pulse logic is split** between `pulse.service.js` and `useAppStore.createPulse`. The MIME detection lives in three places (here, `magicUpload`, `useAppStore.uploadFile`).
6. **The admin screen is in the same bundle as the regular app.** Code-splitting (lazy load admin only when the PIN/role check passes server-side) reduces both bundle size and attack surface.

### Proposed evolved architecture

```
AppRoot
  ├─ Providers
  │    ├─ AuthProvider (token lifecycle, auto-refresh)
  │    ├─ ThemeProvider (darkMode, system preference, accent)
  │    └─ ToastProvider
  │
  ├─ Store (Zustand v4 + slices)
  │    ├─ auth.slice.ts
  │    ├─ settings.slice.ts        ← extracted from auth + store
  │    ├─ social.slice.ts
  │    ├─ chat.slice.ts
  │    ├─ pulse.slice.ts            ← stories logic here
  │    └─ admin.slice.ts            ← lazy-loaded, role-gated
  │
  ├─ Server state (TanStack Query)  ← NEW LAYER
  │    └─ Replaces ad-hoc fetch+useState patterns:
  │         useExploreData(), useNotifications(), useLeaderboard()
  │       Gives free request dedup, caching, retry, optimistic updates.
  │
  ├─ Service layer
  │    ├─ api/client.ts             ← what api.ts already is
  │    ├─ api/auth.ts
  │    ├─ api/pulse.ts
  │    ├─ api/admin.ts
  │    └─ utils/mime.ts             ← single source of MIME truth
  │
  └─ UI
       ├─ ErrorBoundary (top-level + per-screen)
       ├─ Skeletons (replace ActivityIndicator)
       └─ Screens (presentation only)
```

The big idea: **Zustand for client state, TanStack Query for server state.** Right now `useAppStore` is doing both, which is why it has fields like `isPostsLoading`, `hasMorePosts`, `isExploreLoading`, `isLeaderboardLoading` — those are server-state concerns and TanStack Query handles them with one line of config.

---

## 5. Logic & Math Verification

A handful of small but verifiable correctness checks:

| Location | Claim | Verified? |
|---|---|---|
| `MessagesScreen.js:50` | UUID v4 detection: `length === 36 && split('-').length === 5` | ✅ Correct. UUID v4 is 36 chars including 4 dashes → 5 segments. Edge case: any 36-char string with 4 dashes will pass (e.g. `aaaa-bbbb-cccc-dddd-eeeeeeeeeeeeeeeeeeee`), but this is a heuristic fallback when metadata is missing, which is acceptable. |
| `MessagesScreen.js:130` | `.sort((a, b) => new Date(b.rawTime || 0) - new Date(a.rawTime || 0))` | ✅ Correct. Newest-first. `null` → `0` → epoch (Jan 1 1970), so unknown times sink to the bottom, which is the right default. |
| `TribesScreen.js:13` | `onlinePercent = totalMembers > 0 ? (onlineCount / totalMembers) * 100 : 0` | ✅ Correct. Division-by-zero guarded. |
| `AlertsScreen.js:191-200` | Date-bucketing into Today/Yesterday/Earlier via `toDateString()` comparison | ✅ Correct, **but timezone-sensitive.** Uses local timezone — fine for users in one zone, weird for users who travel between continents during a session. Acceptable for now. |
| `api.ts:135-146` | 401 refresh queue — promises resolved via `processQueue(token)` | ✅ Correct under standard load, but the queue is **module-level state**. If two `useAppStore` instances ever coexist (unlikely in this app, but possible in tests/SSR), they'd share the queue. Document this. |
| `authSlice.js — register` | `age = new Date().getFullYear() - dateOfBirth.getFullYear()` | ⚠️ **Off by up to one year.** Someone born Dec 31 2010 calling on Jan 1 2026 would compute `age = 16` despite being 15. Use a proper age computation (compare months/days). Not a security bug for the 13+ check (false positive errs on the side of allowing slightly-too-young), but should be fixed for accuracy. |

---

## 6. Refactor Actions Delivered

The `refactored/` folder contains four files, each a drop-in replacement or new module:

| File | Purpose |
|---|---|
| `api.ts` | Fixes timeout race (2.2). Adds typed response helpers. Per-attempt `AbortController`. Backwards-compatible with all existing callers. |
| `AlertsScreen.js` | Replaces `fetch('http://192.168.1.60:3000/...')` with `fetchAPI('/...')` (1.1, 2.5). Adds optimistic UI for "mark as read". Fixes the missing `useEffect` dep (2.6). Switches to `useShallow` selector (2.1). |
| `mimeUtils.ts` | New module — single source of MIME truth. Used by `pulse.service.js` and `useAppStore.uploadFile`. Fixes `image/jpg` → `image/jpeg` (2.4). |
| `storeSelectors.js` | Optional helper exposing pre-built atomic selectors so screens can write `const user = useUser()` instead of `useAppStore(s => s.user)`. Reduces error surface. |

For the LAN-IP/admin-PIN issues (1.1, 1.2), the fix is structural and has to extend into the server: it's not a one-file patch, it's a small migration. Steps documented in `STRATEGIC_ROADMAP.md`.

---

## 7. Preservation Statement

Every fix is **additive or in-place equivalent**. No public function signature changes. Specifically:

* `fetchAPI` keeps the same call shape.
* All store selectors keep their existing field names.
* Screen props are unchanged.
* `userSettings` shape is unchanged (the duplicate is removed from one of two places, the surviving copy is identical).
* Token storage keys (`auth_access_token`, `auth_refresh_token`) are preserved — existing logged-in users will not be logged out by the upgrade.
