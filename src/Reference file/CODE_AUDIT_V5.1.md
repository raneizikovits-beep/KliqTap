# 📋 KliqTap — useAppStore.js Code Audit Report
**Reviewer:** Senior Software Architect  
**File audited:** `client/src/store/useAppStore.js` (V5.0 → V5.1)  
**Audit date:** May 14, 2026  
**Prior audit context:** FINAL_CONSOLIDATED_AUDIT.md, CODE_AUDIT_REPORT_ROUND2.md, STRATEGIC_ROADMAP.md

---

## Executive Summary

V5.0 was a significant improvement over V4.1 — lean composition, no duplicate methods, throttled GPS sync. This audit found **6 bugs and 3 quality issues** remaining. None are critical security holes (the `chat.gateway.ts` JWT issue is already documented in `chat_gateway_PATCH.md` and is outside this file's scope). All 9 issues have been resolved in V5.1.

| Severity | Count | Fixed in V5.1? |
|---|---|---|
| 🟠 Correctness bug | 4 | ✅ All |
| 🟡 Quality / logic issue | 3 | ✅ All |
| 🔵 Enhancement | 2 | ✅ Both |

---

## 🟠 Bug 1 — `resolveUser`: Unbounded cache with no TTL

**Location:** Lines 235–251 (V5.0)

**Problem:** The `userCache` never expires entries. A resolved user is served from cache indefinitely — even if their display name, avatar, or follow-count changed hours ago. The only eviction happens at persist time (capped to 50 entries), meaning the live in-memory cache could grow to thousands of entries and serve stale profile data until the app is killed.

**Concrete scenario:** User A changes their avatar. User B, who had A in cache, will see the old avatar for the entire session.

**Fix in V5.1:**
- Added `USER_CACHE_TTL_MS = 5 * 60 * 1000` (5 minutes)
- Each cached entry is wrapped as `{ data, cachedAt: Date.now() }`
- `freshCacheEntry()` returns `null` if entry is older than TTL, triggering a re-fetch
- `evictOldestIfNeeded()` caps live cache at `USER_CACHE_MAX_SIZE = 100` entries using oldest-first eviction
- `migrate()` bumped to version 3 to upgrade existing flat-object entries to the new format on app update (expired immediately so they re-fetch)

---

## 🟠 Bug 2 — `joinCommunity`: No rollback on API failure

**Location:** Lines 364–382 (V5.0)

**Problem:** The function performs an optimistic UI update (sets `isMember: true`, increments `member_count`) but on catch it silently returns `false` — the UI remains in the "joined" state even though the join failed. The user sees themselves as a member of a community they never actually joined.

**Fix in V5.1:**
- Snapshot `previousCommunities` before the optimistic update
- On catch, restore `set({ trendingCommunities: previousCommunities })`
- Show `Toast.show({ type: 'error', ... })` so the user knows something went wrong
- Log the error in `__DEV__` for debugging

---

## 🟠 Bug 3 — `migrate()`: Direct mutation of `persisted` argument

**Location:** Lines 458–463 (V5.0)

**Problem:**
```js
// V5.0 — mutates the argument
if (version < 2 && persisted?.userSettings) {
    persisted.userSettings = { ...DEFAULT_SETTINGS, ...persisted.userSettings };
}
return persisted;
```
`persisted` is the deserialized object from AsyncStorage. Mutating it directly is safe in practice with Zustand's current implementation, but it is undefined behaviour — the middleware does not guarantee the object is a fresh copy. If Zustand ever passes a frozen or shared reference, this throws. It also makes migrations harder to compose and test.

**Fix in V5.1:**
```js
let next = { ...persisted };
if (version < 2 && next.userSettings) {
    next = { ...next, userSettings: { ...DEFAULT_SETTINGS, ...next.userSettings } };
}
if (version < 3 && next.userCache) { /* V3 upgrade */ }
return next;
```
Each migration step produces a new object. Immutable, composable, safe.

---

## 🟠 Bug 4 — `createSupportTicket`: Confusing double-return-false

**Location:** Lines 405–419 (V5.0)

**Problem:**
```js
createSupportTicket: async (subject, message) => {
    try {
        const response = await fetchAPI(...);
        if (response) {
            get().fetchMyTickets?.();
            return true;
        }
        // Falls through here if response is falsy — implicit undefined, not false
    } catch (error) {
        return false;
    }
    return false;  // ← Misleading — suggests this is reachable from catch
},
```
The logic has three exit paths where two are equivalent. When `response` is falsy (API returned null), the function falls through to the final `return false` — but the reader has to trace all paths to know that. The silent null response case is also not logged in dev.

**Fix in V5.1:**
```js
createSupportTicket: async (subject, message) => {
    try {
        const response = await fetchAPI('/support/ticket', { ... });
        if (!response) return false;
        get().fetchMyTickets?.();
        return true;
    } catch (error) {
        if (__DEV__) console.error('[Store] createSupportTicket failed:', error);
        return false;
    }
},
```
Single try/catch, clear early-return, dev logging.

---

## 🟡 Quality Issue 1 — `fetchProfilePreview` doesn't sync `followStatuses`

**Location:** Lines 206–220 (V5.0)

**Problem:** When the peek sheet opens and a profile is fetched, the `isFollowing` field from the server response is stored on `profilePeekUser` but not in `followStatuses`. This means the `checkFollowStatus` cache is stale, and if another component reads from `followStatuses[userId]` it gets the wrong value. Two sources of truth for one boolean is a guaranteed source of inconsistency.

**Fix in V5.1:** After setting `profilePeekUser`, if `data.isFollowing !== undefined`, the follow status is synced into `followStatuses` in the same `set()` call.

---

## 🟡 Quality Issue 2 — `award()` silently ignores unknown action names

**Location:** Lines 96–115 (V5.0)

**Problem:**
```js
const pointsToAdd = POINTS_TABLE[actionName] ?? 0;
if (pointsToAdd === 0) return;
```
`POINTS_TABLE[unknownAction]` is `undefined`, coerced to `0` by `??`, and silently no-ops. A typo like `award('create post')` (lowercase) disappears without a trace. This has already happened with `'Unlike'` being `-1` — calling `award('Unfollow')` (wrong name) would fail silently in production.

**Fix in V5.1:**
```js
const pointsToAdd = POINTS_TABLE[actionName];
if (pointsToAdd === undefined) {
    if (__DEV__) console.warn(`[Store] award() unknown action "${actionName}". Valid: ...`);
    return;
}
if (pointsToAdd === 0) return;
```
Also exports `POINTS_TABLE` so screens can reference valid keys without importing the constant separately.

---

## 🟡 Quality Issue 3 — `POINTS_TABLE` not exported

**Location:** Line 72 (V5.0)

**Problem:** `POINTS_TABLE` is defined as a module-level constant but not exported. Any screen that wants to display point values (e.g. a "How to earn points" info card) must either hardcode the numbers again or import the store and read private internals.

**Fix in V5.1:** `export const POINTS_TABLE = Object.freeze({ ... });` — no other change needed.

---

## 🔵 Enhancement 1 — `postDraftText` missing from global initializer

**Location:** partialize (line 449, V5.0)

**Problem:** `partialize` references `state.postDraftText`, but this field is presumably defined only in `socialSlice`. If `socialSlice` is ever refactored to remove it, the persist configuration will silently serialize `undefined` with no error at the store level. Adding a safety-net default costs nothing.

**Fix in V5.1:** Added `postDraftText: ''` to the global initializer. If `socialSlice` also defines it, its spread wins — no conflict.

---

## 🔵 Enhancement 2 — `partialize` sorts cache entries before slicing

**Location:** Lines 454–456 (V5.0)

**Problem:** The original `Object.entries(...).slice(0, 50)` keeps the first 50 keys in insertion order. On a device where an old set of 50 entries was persisted, the 50 slots stay filled with the oldest profiles indefinitely (until a different 50 keys happen to be inserted at the top). Sorting by `cachedAt` descending before slicing ensures the 50 most recently seen users are always persisted.

**Fix in V5.1:**
```js
Object.entries(state.userCache || {})
    .sort(([, a], [, b]) => (b?.cachedAt ?? 0) - (a?.cachedAt ?? 0))
    .slice(0, 50)
```

---

## Architecture Assessment

### Strengths (unchanged from V5.0)

- **Correct slice composition** — `createAuthSlice`, `createSocialSlice`, `createChatSlice` spread cleanly into the root store. The `toggleFollow` override with optimistic UI is a legitimate composition pattern.
- **GPS throttle outside Zustand** — `lastGpsSyncAt` and `lastSyncedCoords` as module-level mutable state is the right call. They're transport concern, not UI state.
- **Haversine implementation** — mathematically correct and well-scoped.
- **Persist partialize** — excluding tokens, loading flags, and chat history is exactly right.
- **`onRehydrateStorage` pattern** — returns a callback function (correct Zustand persist API usage).
- **`DEFAULT_SETTINGS` as `Object.freeze`** — prevents accidental mutation.

### Remaining architectural concern (not in scope of this file)

The store still carries server-state fields (`leaderboard`, `trendingCommunities`, `radarResults`, `featuredCards`, `trendingTopics`, `liveZones`) that belong in TanStack Query. This is tracked in `STRATEGIC_ROADMAP.md §1.2` and is a Phase 1 migration item, not a bug in V5.1.

---

## Files Changed

| File | Status |
|---|---|
| `client/src/store/useAppStore.js` | ✅ V5.0 → V5.1 (9 fixes) |

No other files require changes for this audit round.

---

## Changelog Summary (V5.0 → V5.1)

```
[FIX]   resolveUser: TTL-based cache (5 min), LRU eviction at 100 entries
[FIX]   joinCommunity: full optimistic rollback + error Toast
[FIX]   migrate(): immutable — no longer mutates persisted argument
[FIX]   createSupportTicket: clean single-path return flow + dev logging
[FIX]   fetchProfilePreview: syncs followStatuses from server response
[FIX]   award(): warn on unknown action name in __DEV__; change ?? 0 to undefined check
[EXPORT] POINTS_TABLE: now exported for screens and tests
[INIT]  postDraftText: '' safety-net initializer in global state
[PERF]  partialize: sort cache by cachedAt desc before slicing to 50
[SCHEMA] persist version: 2 → 3; migrate() handles V2→V3 cache shape upgrade
```
