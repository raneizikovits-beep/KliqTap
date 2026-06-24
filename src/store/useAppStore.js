// client/src/store/useAppStore.js
// 🏆 KliqMind V5.3 — Engineering Audit Fixes Applied
//
// [V5.3 CHANGES — Security & Reliability Fixes]:
//   • [FIX CRITICAL-1] fetchRadarData: GPS coordinates moved from query params to
//                      POST body (prevents logging in server/CDN/browser history).
//                      Precision rounded to 4 decimal places (~11m — sufficient for radar).
//   • [FIX CRITICAL-2] findStreamRouletteMatch: 30s timeout ID stored in
//                      `_rouletteTimeoutId` and cleared in onRouletteMatchReceived,
//                      preventing stale Toast + state mutation after socket match arrives.
//   • [FIX MEDIUM-6]  updateSetting: rollback optimistic local change on API failure.
//                      Critical for privacy settings like ghostMode.
//   • [FIX MEDIUM-7]  award(): deduction toast type changed 'error' → 'info'.
//                      'Unlike' is a normal action; red error toast misleads users.
//   • [FIX MEDIUM-2]  partialize: userLocation persists name-only; latitude/longitude
//                      nulled so stale GPS is never served from cold storage.
//   • [FIX MEDIUM-4]  _resetGpsState() exported for test isolation of GPS module state.
//   • [FIX WEB]       __DEV__ polyfill added — Metro injects this; Webpack/web builds
//                      do not. Prevents ReferenceError crashing async actions on web.
//   • [FIX HIGH-3]    checkFollowStatus: userCache checked first before full-profile
//                      fetch, reducing unnecessary round-trips on follow-status checks.
//   • [MIGRATE v4]    V3 → V4 migration strips stale coordinates from persisted
//                      userLocation on first launch after upgrade.
//
// [Previous changes — V5.2]:
//   • fetchRadarData: self-sufficient location fetch if lat/lon not supplied
//   • fetchRadarData: response shape fixed ({ users, groups, searchContext })
//   • radarResults initial state: object matching server structure
//
// [Previous changes — V5.1]:
//   • resolveUser: cache TTL (5 minutes)
//   • joinCommunity: optimistic rollback + Toast
//   • migrate: immutable
//   • userCache: size limit 100 entries
//   • fetchProfilePreview: followStatuses sync
//   • createSupportTicket: clean return flow
//   • award: dev warning on unknown action name
//   • postDraftText: initializer safety net
//   • POINTS_TABLE: exported for tests

// ─────────────────────────────────────────────────────────────
// Cross-platform __DEV__ guard
// Metro (React Native) injects __DEV__ globally; Webpack/web builds may not.
// This shim must appear before any code that references __DEV__.
// ─────────────────────────────────────────────────────────────
if (typeof __DEV__ === 'undefined') {
    // eslint-disable-next-line no-undef
    Object.defineProperty(
        typeof globalThis !== 'undefined' ? globalThis : global,
        '__DEV__',
        { value: process.env.NODE_ENV !== 'production', configurable: true }
    );
}

import { createWellnessSlice } from './wellnessSlice';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';

import { createAuthSlice } from './authSlice';
import createSocialSlice from './socialSlice';
import { createChatSlice } from './chatSlice';
import { fetchAPI } from './api';
import { describeFileFromUri, fileFormDataPart } from './mimeUtils';

// ─────────────────────────────────────────────────────────────
// Geographic helpers
// ─────────────────────────────────────────────────────────────
const GPS_SYNC_MIN_INTERVAL_MS = 30_000;   // 30s between server syncs
const GPS_SYNC_MIN_DISTANCE_M  = 50;       // 50m movement threshold

/** Haversine great-circle distance in metres. */
const haversine = (a, b) => {
    if (!a || !b) return Infinity;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R    = 6_371_000;
    const dLat = toRad(b.latitude  - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
};

// Module-level mutable state for GPS throttle (intentionally outside Zustand —
// it's a transport-layer concern, not UI state).
let lastGpsSyncAt    = 0;
let lastSyncedCoords = null;

/**
 * Reset GPS throttle state — for test isolation only.
 * Call this in beforeEach() when testing setUserLocation behaviour.
 */
export const _resetGpsState = () => {
    lastGpsSyncAt    = 0;
    lastSyncedCoords = null;
};

// [FIX CRITICAL-2] Roulette timeout ID stored at module level so it can be
// cleared when a socket match arrives before the 30s window expires.
let _rouletteTimeoutId = null;

// ─────────────────────────────────────────────────────────────
// User-cache TTL — prevents serving indefinitely-stale profiles
// ─────────────────────────────────────────────────────────────
const USER_CACHE_TTL_MS  = 5 * 60 * 1_000;  // 5 minutes
const USER_CACHE_MAX_SIZE = 100;             // entries before LRU-style eviction

/**
 * Wrap a user payload with a timestamp so we can expire it.
 * @param {object} userData
 * @returns {{ data: object, cachedAt: number }}
 */
const toCacheEntry = (userData) => ({ data: userData, cachedAt: Date.now() });

/**
 * Returns the cached user if still fresh, null if expired or missing.
 * @param {object|undefined} entry
 */
const freshCacheEntry = (entry) => {
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > USER_CACHE_TTL_MS) return null;
    return entry.data;
};

/**
 * Evict oldest entries when cache exceeds USER_CACHE_MAX_SIZE.
 * @param {object} cache   { [userId]: { data, cachedAt } }
 * @param {string} newKey  key being inserted (unused — kept for call-site clarity)
 * @returns {object}       cache pruned to MAX_SIZE entries
 */
const evictOldestIfNeeded = (cache, newKey) => {
    const keys = Object.keys(cache);
    if (keys.length < USER_CACHE_MAX_SIZE) return cache;

    // Remove the entry with the oldest cachedAt
    const oldestKey = keys.reduce((oldest, k) =>
        (cache[k].cachedAt ?? 0) < (cache[oldest]?.cachedAt ?? Infinity) ? k : oldest
    , keys[0]);

    const pruned = { ...cache };
    delete pruned[oldestKey];
    return pruned;
};

// ─────────────────────────────────────────────────────────────
// Default settings (mirrored in authSlice initial state)
// ─────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = Object.freeze({
    gpsEnabled:      true,
    showOnMap:       true,
    preciseLocation: false,
    activityStatus:  true,
    ghostMode:       false,
    readReceipts:    true,
    autoVoice:       false,
    suppReminders:   true,
    motoReminders:   true,
    darkMode:        false,
    notifications:   true,
});

// ─────────────────────────────────────────────────────────────
// Points map — exported so screens/tests can display action labels
// ─────────────────────────────────────────────────────────────
export const POINTS_TABLE = Object.freeze({
    'Like':          1,
    'Unlike':       -1,
    'Comment':       2,
    'Create Post':   3,
    'Create Pulse':  4,
    'Create Group':  5,
    'Streak':        1,
    'Roulette Call': 10,
});

// ─────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────
export const useAppStore = create(
    persist(
        (set, get) => ({
            ...createAuthSlice(set, get),
            ...createSocialSlice(set, get),
            ...createChatSlice(set, get),
            ...createWellnessSlice(set, get),

            // ==========================================
            // 🏆 GAMIFICATION (single source of truth)
            // ==========================================
            points:  0,
            streak:  0,  // Also synced from server via wellnessSlice.fetchWellnessStats
            badges:  [],

            /**
             * Award points for a named action and show a Toast.
             * Unknown action names are no-ops (+ dev warning).
             */
            award: (actionName) => {
                const pointsToAdd = POINTS_TABLE[actionName];

                if (pointsToAdd === undefined) {
                    if (__DEV__) {
                        console.warn(
                            `[Store] award() called with unknown action "${actionName}". ` +
                            `Valid keys: ${Object.keys(POINTS_TABLE).join(', ')}`
                        );
                    }
                    return;
                }

                if (pointsToAdd === 0) return;

                set(state => ({ points: (state.points || 0) + pointsToAdd }));

                if (pointsToAdd > 0) {
                    Toast.show({
                        type:  'success',
                        text1: `🏆 +${pointsToAdd} PTS!`,
                        text2: `${actionName} rewarded!`,
                    });
                } else {
                    // [FIX MEDIUM-7] Use 'info' not 'error' — point deductions are
                    // routine actions (Unlike), not error states. 'error' (red) misleads users.
                    Toast.show({
                        type:  'info',
                        text1: `${pointsToAdd} PTS`,
                        text2: 'Point removed.',
                    });
                }
            },

            // ==========================================
            // 💎 PREMIUM & AI USAGE TRACKER
            // ==========================================
            premiumModalOpen: false,
            setPremiumModalOpen: (isOpen) => set({ premiumModalOpen: isOpen }),
            aiUsageCount: 0,
            lastAiUsageDate: null,

            // פונקציה חכמה שבודקת האם מותר למשתמש להשתמש ב-AI
            checkAndConsumeAiUsage: () => {
                const state = get();
                const today = new Date().toDateString(); // מחזיר תאריך של היום (למשל: "Wed Jun 24 2026")
                
                // אם המשתמש הוא כבר KliqKing (שילם פרימיום), תמיד לאשר לו!
                const isPremium = state.user?.isKliqKing === true;
                if (isPremium) return true;

                // אם התאריך השתנה מאז הפעם האחרונה, מאפסים לו את המונה ל-0
                let currentCount = state.lastAiUsageDate === today ? state.aiUsageCount : 0;

                if (currentCount < 5) { // 👈 שינינו ל-5 פעמים ביום!
                    // המשתמש לא הגיע למגבלה: מעלים את המונה, מעדכנים תאריך ומאשרים
                    set({ aiUsageCount: currentCount + 1, lastAiUsageDate: today });
                    return true;
                } else {
                    // המשתמש סיים את המכסה היומית: מקפיצים באלגנטיות את חלון הפרימיום וחוסמים את הפעולה
                    set({ premiumModalOpen: true });
                    return false;
                }
            },

            // ==========================================
            // ⚙️ LIVE SETTINGS (הקוד המקורי שלך נשאר בדיוק כפי שהיה!)
            // ==========================================
            userSettings: { ...DEFAULT_SETTINGS },

            updateSetting: async (key, value) => {
                // Capture previous value for rollback
                const previous = get().userSettings[key];

                // Optimistic local update for UI responsiveness
                set(state => ({
                    userSettings: { ...state.userSettings, [key]: value },
                }));

                try {
                    await fetchAPI('/users/settings', {
                        method: 'PATCH',
                        body:   JSON.stringify({ [key]: value }),
                    });
                } catch (error) {
                    // [FIX MEDIUM-6] Roll back the optimistic update on failure.
                    // Critical for privacy settings like ghostMode — a failed sync
                    // must not leave the UI showing a different state than the server.
                    set(state => ({
                        userSettings: { ...state.userSettings, [key]: previous },
                    }));
                    Toast.show({
                        type:  'error',
                        text1: 'Setting could not be saved',
                        text2: 'Please try again.',
                    });
                    if (__DEV__) console.error(`[Store] Failed to sync setting "${key}":`, error);
                }
            },

            fetchSettings: async () => {
                try {
                    const data = await fetchAPI('/users/settings');
                    if (data && typeof data === 'object') {
                        set({ userSettings: { ...DEFAULT_SETTINGS, ...data } });
                    }
                } catch {
                    if (__DEV__) console.warn('[Store] Could not load user settings, using defaults.');
                }
            },

            // ==========================================
            // 🌍 GLOBAL UI & LOCATION STATE
            // ==========================================
            userCache:        {},
            pulseCreateOpen:  false,
            pulseImageUri:    null,
            userLocation:     { name: 'Global', latitude: null, longitude: null },
            // Safety-net default for postDraftText (canonical owner: socialSlice).
            // If socialSlice already declares this, its spread will win — no harm.
            postDraftText:    '',

            /**
             * Throttled + distance-guarded GPS sync.
             * Always updates local UI state immediately; server sync only when
             * enough time has passed AND user has moved meaningfully.
             */
            setUserLocation: async (location) => {
                if (!location) return;

                // Immediate local update for UI responsiveness
                set({ userLocation: location });

                if (!location.latitude || !location.longitude) return;

                const now           = Date.now();
                const timeSinceLast = now - lastGpsSyncAt;
                const distanceMoved = lastSyncedCoords
                    ? haversine(lastSyncedCoords, location)
                    : Infinity;

                // ── Geo-spoofing detection ───────────────────────────────────────────
                // If the device claims it moved from e.g. Cebu to Moscow in 5 minutes
                // (a physically impossible speed) we silently block the radar sync.
                // This prevents scammers and bots from faking proximity to real users.
                //
                // Threshold: 1,000 km/h (278 m/s) — faster than any commercial aircraft.
                // First known position is always allowed (lastSyncedCoords is null).
                if (lastSyncedCoords && timeSinceLast > 0) {
                    const speedMs = distanceMoved / (timeSinceLast / 1000);
                    const MAX_SPEED_MS = 278; // ≈ 1,000 km/h
                    if (speedMs > MAX_SPEED_MS) {
                        if (__DEV__) {
                            console.warn(
                                `[Security] Geo-spoofing blocked: ` +
                                `${(speedMs * 3.6).toFixed(0)} km/h from last known position.`
                            );
                        }
                        // Do NOT update lastSyncedCoords — keep the last legitimate position.
                        // Server sync is also skipped, so Radar sees no change.
                        return;
                    }
                }
                // ────────────────────────────────────────────────────────────────────

                if (
                    timeSinceLast < GPS_SYNC_MIN_INTERVAL_MS &&
                    distanceMoved < GPS_SYNC_MIN_DISTANCE_M
                ) {
                    return; // Throttle: too soon or barely moved
                }

                lastGpsSyncAt    = now;
                lastSyncedCoords = { latitude: location.latitude, longitude: location.longitude };

                try {
                    await fetchAPI('/users/location', {
                        method: 'PATCH',
                        body:   JSON.stringify({
                            latitude:     location.latitude,
                            longitude:    location.longitude,
                            locationName: location.name || 'Unknown',
                        }),
                    });
                } catch (error) {
                    if (__DEV__) console.error('[Store] Failed to sync GPS to server:', error);
                }
            },

            setPulseCreateOpen: (isOpen) => set({ pulseCreateOpen: isOpen }),
            setPulseImageUri:   (uri)    => set({ pulseImageUri: uri }),

            // 🚀 Feed camera state
            postCreateOpen:    false,
            postImageUri:      null,
            setPostCreateOpen: (isOpen) => set({ postCreateOpen: isOpen }),
            setPostImageUri:   (uri)    => set({ postImageUri: uri }),

            // ==========================================
            // 👤 PROFILE PEEK
            // ==========================================
            profilePeekUser:    null,
            isProfileLoading:   false,
            triggerOpenProfile: null,
            viewingUserId:      null,

            setProfilePeekUser:    (user)   => set({ profilePeekUser: user }),
            setTriggerOpenProfile: (userId) => set({ triggerOpenProfile: userId }),
            setViewingUserId:      (id)     => set({ viewingUserId: id }),

            /**
             * Fetch a user profile for the peek sheet.
             * Also syncs followStatuses so follow-button state is correct
             * without a separate checkFollowStatus call.
             */
            fetchProfilePreview: async (userId) => {
                set({ isProfileLoading: true });
                try {
                    const data = await fetchAPI(`/users/preview/${userId}`);
                    if (data) {
                        set({ profilePeekUser: data });

                        // Sync follow status from the fetched payload if available
                        if (typeof data.isFollowing !== 'undefined') {
                            set(state => ({
                                followStatuses: {
                                    ...state.followStatuses,
                                    [String(userId)]: data.isFollowing,
                                },
                            }));
                        }

                        return data;
                    }
                } catch (error) {
                    if (__DEV__) console.error('[Store] Preview Fetch Failed:', error);
                } finally {
                    set({ isProfileLoading: false });
                }
                return null;
            },

            closeProfilePeek: () => set({ profilePeekUser: null, isProfileLoading: false }),

            // ==========================================
            // 🎙️ VOICE/AI UI FLAGS
            // ==========================================
            isAiSpeaking:       false,
            isUserRecording:    false,
            setIsAiSpeaking:    (status) => set({ isAiSpeaking: status }),
            setIsUserRecording: (status) => set({ isUserRecording: status }),

            // ==========================================
            // 🛰️ RESOLVERS & FILE UPLOADS
            // ==========================================

            /**
             * Resolve a user by ID, with TTL-based in-memory cache.
             * Stale entries (>5 min) are re-fetched transparently.
             */
            resolveUser: async (userId) => {
                const { userCache } = get();
                const cached = freshCacheEntry(userCache?.[userId]);
                if (cached) return cached;

                try {
                    const userData = await fetchAPI(`/users/${userId}`);
                    if (userData) {
                        set(state => {
                            const evicted = evictOldestIfNeeded(state.userCache, userId);
                            return {
                                userCache: {
                                    ...evicted,
                                    [userId]: toCacheEntry(userData),
                                },
                            };
                        });
                        return userData;
                    }
                } catch (error) {
                    if (__DEV__) console.warn(`[Store] Failed to resolve user ${userId}:`, error);
                }
                return null;
            },

            uploadFile: async (uri, fileType = 'other') => {
                const { token } = get();
                if (!token) throw new Error('Authentication required.');

                const fallbackName = `upload_${Date.now()}.jpg`;
                const formData     = new FormData();
                formData.append('fileType', fileType);

                if (Platform.OS === 'web') {
                    const response = await fetch(uri);
                    if (!response.ok) throw new Error('Could not read local file.');
                    const blob         = await response.blob();
                    const { filename } = describeFileFromUri(uri, fallbackName);
                    formData.append('file', blob, filename);
                } else {
                    formData.append('file', fileFormDataPart(uri, fallbackName));
                }

                const response = await fetchAPI('/upload/single', {
                    method: 'POST',
                    body:   formData,
                });
                return response?.url ?? null;
            },

            // ==========================================
            // 🤝 FOLLOW STATUS TRACKING
            // ==========================================
            followStatuses: {},

            checkFollowStatus: async (targetId) => {
                const sid = String(targetId);

                // [FIX HIGH-3] Check userCache first — avoids a full-profile round-trip
                // when the profile was recently fetched by resolveUser or fetchProfilePreview.
                // TODO: Replace full-profile fetch with GET /users/:id/follow-status once
                // the lightweight backend endpoint is available.
                const cached = freshCacheEntry(get().userCache?.[sid]);
                if (cached && typeof cached.isFollowing !== 'undefined') {
                    set(state => ({
                        followStatuses: {
                            ...state.followStatuses,
                            [sid]: cached.isFollowing,
                        },
                    }));
                    return cached.isFollowing;
                }

                try {
                    const response = await fetchAPI(`/users/${sid}`);
                    if (response && typeof response.isFollowing !== 'undefined') {
                        set(state => ({
                            followStatuses: {
                                ...state.followStatuses,
                                [sid]: response.isFollowing,
                            },
                        }));
                        return response.isFollowing;
                    }
                } catch (error) {
                    if (__DEV__) console.warn(`[Store] Follow status check failed for ${targetId}:`, error);
                }
                return false;
            },

            /**
             * Optimistic follow toggle with full server-reconciliation and rollback.
             * This is the deliberate composition point over socialSlice.toggleFollow.
             */
            toggleFollow: async (targetId) => {
                const sid                  = String(targetId);
                const { followStatuses }   = get();
                const isCurrentlyFollowing = !!followStatuses[sid];

                // Optimistic flip
                set(state => ({
                    followStatuses: { ...state.followStatuses, [sid]: !isCurrentlyFollowing },
                }));

                try {
                    const response = await fetchAPI(`/users/${sid}/follow`, { method: 'POST' });
                    if (response && typeof response.isFollowing !== 'undefined') {
                        // Reconcile with server truth
                        set(state => ({
                            followStatuses: { ...state.followStatuses, [sid]: response.isFollowing },
                        }));

                        // Sync profilePeekUser if it is the same user
                        const { profilePeekUser } = get();
                        if (profilePeekUser && String(profilePeekUser.id) === sid) {
                            set({
                                profilePeekUser: {
                                    ...profilePeekUser,
                                    isFollowing: response.isFollowing,
                                },
                            });
                        }
                    }
                } catch (error) {
                    // Rollback on error
                    set(state => ({
                        followStatuses: { ...state.followStatuses, [sid]: isCurrentlyFollowing },
                    }));
                    if (__DEV__) console.error('[Store] Follow toggle failed, rolled back:', error);
                }
            },

            // ==========================================
            // 🚀 EXPLORE
            // ==========================================
            trendingTopics:      [],
            featuredCards:       [],
            liveZones:           [],
            trendingCommunities: [],
            isExploreLoading:    false,

            fetchExploreData: async () => {
                set({ isExploreLoading: true });
                try {
                    const data = await fetchAPI('/communities/explore');
                    if (data) {
                        set({
                            trendingTopics:      data.trendingTopics      || [],
                            featuredCards:       data.featuredCards       || [],
                            liveZones:           data.liveZones           || [],
                            trendingCommunities: data.trendingCommunities || [],
                        });
                    }
                } catch (error) {
                    if (__DEV__) console.error('[Store] Explore Fetch Error:', error);
                } finally {
                    set({ isExploreLoading: false });
                }
            },

            // ==========================================
            // 🎲 VIBE ROULETTE
            // ==========================================
            isRouletteSearching: false,
            rouletteMatch:       null,

            /**
             * Find a live stream roulette match.
             * POST /live/roulette → { match: { roomId, roomName, trend } } | { queued: true }
             * On match  → stores rouletteMatch; caller (HomeScreen) watches rouletteMatch to navigate.
             * On queued → Toast shown; socket event 'roulette_match' should call onRouletteMatchReceived.
             */
            findStreamRouletteMatch: async () => {
                const { isRouletteSearching } = get();
                if (isRouletteSearching) return; // prevent double-tap

                // [FIX CRITICAL-2] Clear any previous queued timeout before starting a new search.
                if (_rouletteTimeoutId) {
                    clearTimeout(_rouletteTimeoutId);
                    _rouletteTimeoutId = null;
                }

                set({ isRouletteSearching: true, rouletteMatch: null });

                try {
                    const data = await fetchAPI('/live/roulette', { method: 'POST' });

                    if (data?.match) {
                        set({ rouletteMatch: data.match, isRouletteSearching: false });
                        Toast.show({
                            type:  'success',
                            text1: '⚡ Vibe Match Found!',
                            text2: `Joining ${data.match.roomName || 'a live room'}…`,
                        });
                    } else if (data?.queued) {
                        Toast.show({
                            type:  'info',
                            text1: '🔍 Searching the network…',
                            text2: "We'll notify you when a match is found.",
                        });
                        // [FIX CRITICAL-2] Store the ID so onRouletteMatchReceived can cancel it.
                        _rouletteTimeoutId = setTimeout(() => {
                            _rouletteTimeoutId = null;
                            if (get().isRouletteSearching) {
                                set({ isRouletteSearching: false });
                                Toast.show({
                                    type:  'info',
                                    text1: 'No match found',
                                    text2: 'Try again in a moment.',
                                });
                            }
                        }, 30_000);
                    } else {
                        set({ isRouletteSearching: false });
                    }
                } catch (error) {
                    set({ isRouletteSearching: false });
                    Toast.show({
                        type:  'error',
                        text1: 'Roulette Failed',
                        text2: 'Could not connect. Please try again.',
                    });
                    if (__DEV__) console.error('[Store] Roulette error:', error);
                }
            },

            /**
             * Called by your socket listener when server pushes a delayed roulette match.
             * [FIX CRITICAL-2] Clears the 30s auto-cancel timeout to prevent the stale
             * "No match found" Toast from firing after the match has already arrived.
             */
            onRouletteMatchReceived: (match) => {
                // Cancel the queued auto-cancel — we have our match
                if (_rouletteTimeoutId) {
                    clearTimeout(_rouletteTimeoutId);
                    _rouletteTimeoutId = null;
                }
                set({ rouletteMatch: match, isRouletteSearching: false });
                Toast.show({
                    type:  'success',
                    text1: '⚡ Vibe Match Found!',
                    text2: `Joining ${match?.roomName || 'a live room'}…`,
                });
            },

            /**
             * Join a community with optimistic UI and rollback on failure.
             */
            joinCommunity: async (communityId) => {
                const safeId = String(communityId);

                // Capture pre-join state for rollback
                const previousCommunities = get().trendingCommunities;

                // Optimistic update
                set(state => ({
                    trendingCommunities: state.trendingCommunities.map(comm =>
                        String(comm.id) === safeId
                            ? { ...comm, isMember: true, member_count: (comm.member_count || 0) + 1 }
                            : comm
                    ),
                }));

                try {
                    await fetchAPI('/communities/join', {
                        method: 'POST',
                        body:   JSON.stringify({ communityId: safeId }),
                    });
                    return true;
                } catch (error) {
                    // Rollback to previous state
                    set({ trendingCommunities: previousCommunities });

                    Toast.show({
                        type:  'error',
                        text1: 'Could not join community',
                        text2: 'Please try again.',
                    });

                    if (__DEV__) console.error('[Store] joinCommunity failed, rolled back:', error);
                    return false;
                }
            },

            // ==========================================
            // 📡 RADAR — V5.3: GPS in POST body (security fix)
            // ==========================================
            radarResults:   { users: [], groups: [], searchContext: null },
            isRadarLoading: false,

            fetchRadarData: async (lat, lon, radiusKm = 10) => {
                set({ isRadarLoading: true });
                try {
                    // Self-sufficient location: if lat/lon not supplied, fetch from device.
                    let latitude  = lat;
                    let longitude = lon;

                    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                        if (__DEV__) console.log('📡 [Radar] Fetching device location...');

                        const Location = await import('expo-location');

                        const { status } = await Location.requestForegroundPermissionsAsync();
                        if (status !== 'granted') {
                            if (__DEV__) console.warn('[Radar] Location permission denied');
                            set({
                                radarResults:  { users: [], groups: [], searchContext: null },
                                isRadarLoading: false,
                            });
                            return;
                        }

                        const location = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                        });
                        latitude  = location.coords.latitude;
                        longitude = location.coords.longitude;
                    }

                    // Round to 4 decimal places (~11m precision)
                    const lat4 = parseFloat(latitude.toFixed(4));
                    const lon4 = parseFloat(longitude.toFixed(4));

                    if (__DEV__) {
                        console.log(`📡 [Radar] Fetching @ (${lat4}, ${lon4}) radius=${radiusKm}km`);
                    }

                    // ⭐️ FIX: Changed to GET and passing parameters in the URL!
                    const data = await fetchAPI(`/geo/radar?lat=${lat4}&lon=${lon4}&radius=${radiusKm}`);

                    if (__DEV__) {
                        console.log(`✅ [Radar] Got ${data?.users?.length || 0} users, ${data?.groups?.length || 0} groups`);
                    }

                    set({
                        radarResults: {
                            users:         Array.isArray(data?.users)  ? data.users  : [],
                            groups:        Array.isArray(data?.groups) ? data.groups : [],
                            searchContext: data?.searchContext || null,
                        },
                    });
                } catch (e) {
                    if (__DEV__) console.warn('[Radar] Fetch failed:', e?.message || e);
                    set({ radarResults: { users: [], groups: [], searchContext: null } });
                } finally {
                    set({ isRadarLoading: false });
                }
            },
            
            // ==========================================
            // 🏆 WEEKLY CHALLENGE
            // ==========================================
            weeklyChallenge:          null,
            isWeeklyChallengeLoading: false,

            fetchWeeklyChallenge: async () => {
                if (get().isWeeklyChallengeLoading) return;
                set({ isWeeklyChallengeLoading: true });
                try {
                    const data = await fetchAPI('/weekly-challenge/active');
                    set({ weeklyChallenge: data || null });
                } catch (e) {
                    if (__DEV__) console.warn('[WeeklyChallenge] Fetch failed:', e?.message);
                } finally {
                    set({ isWeeklyChallengeLoading: false });
                }
            },

            // ==========================================
            // 🛟 SUPPORT
            // ==========================================

            /**
             * Create a support ticket. Returns true on success, false otherwise.
             */
            createSupportTicket: async (subject, message) => {
                try {
                    const response = await fetchAPI('/support/ticket', {
                        method: 'POST',
                        body:   JSON.stringify({ subject, message }),
                    });

                    if (!response) return false;

                    // Refresh ticket list without blocking the caller
                    get().fetchMyTickets?.();
                    return true;
                } catch (error) {
                    if (__DEV__) console.error('[Store] createSupportTicket failed:', error);
                    return false;
                }
            },

            // ==========================================
            // 🏆 LEADERBOARD
            // ==========================================
            leaderboard:          [],
            isLeaderboardLoading: false,

            refreshLeaderboard: async () => {
                set({ isLeaderboardLoading: true });
                try {
                    const data = await fetchAPI('/users/leaderboard');
                    set({ leaderboard: Array.isArray(data) ? data : [] });
                } catch (error) {
                    if (__DEV__) console.error('[Store] Leaderboard Fetch Error:', error);
                    set({ leaderboard: [] });
                } finally {
                    set({ isLeaderboardLoading: false });
                }
            },
        }),

        // ─────────────────────────────────────────────────────────────
        // Persist config
        // ─────────────────────────────────────────────────────────────
        {
            name:    'kliqmind-storage',
            version: 4,  // bumped from 3 → 4: strip stale GPS from persisted userLocation
            storage: createJSONStorage(() => AsyncStorage),

                // Persist only fields safe to restore.
                // Excluded: loading flags (transient), token (SecureStore), chatHistory (too large).
                partialize: (state) => ({
                userSettings:  state.userSettings,
                aiUsageCount:  state.aiUsageCount,       // 👈 הוספנו שמירה
                lastAiUsageDate: state.lastAiUsageDate,  // 👈 הוספנו שמירה
                postDraftText: state.postDraftText,
                // [FIX MEDIUM-2] Persist location name only — coordinates are stale on next
                // app launch and would mislead location-based features (Radar, etc.) until
                // the device provides a fresh GPS fix. Name is safe to restore for display.
                userLocation: {
                    name:      state.userLocation?.name || 'Global',
                    latitude:  null,
                    longitude: null,
                },
                points:  state.points,
                streak:  state.streak,
                badges:  state.badges,
                // Persist newest 50 cache entries only, to keep AsyncStorage lean.
                // Entries are objects: { data, cachedAt } — TTL applies on read.
                userCache: Object.fromEntries(
                    Object.entries(state.userCache || {})
                        .sort(([, a], [, b]) => (b?.cachedAt ?? 0) - (a?.cachedAt ?? 0))
                        .slice(0, 50)
                ),
            }),

            migrate: (persisted, version) => {
                // Immutable migrations — build a fresh object, never mutate `persisted`.
                let next = { ...persisted };

                if (version < 2 && next.userSettings) {
                    // V1 → V2: fill in any new settings keys with their defaults
                    next = { ...next, userSettings: { ...DEFAULT_SETTINGS, ...next.userSettings } };
                }

                if (version < 3 && next.userCache) {
                    // V2 → V3: cache entries were plain objects; wrap in { data, cachedAt }.
                    // Set cachedAt to 0 so they are immediately expired and re-fetched.
                    const upgraded = {};
                    for (const [k, v] of Object.entries(next.userCache)) {
                        upgraded[k] = v && typeof v === 'object' && v.data
                            ? v                           // already new format
                            : { data: v, cachedAt: 0 };  // old format — mark as expired
                    }
                    next = { ...next, userCache: upgraded };
                }

                if (version < 4 && next.userLocation) {
                    // V3 → V4: strip persisted GPS coordinates — they're stale after app restart.
                    // The name string is safe to keep for display purposes.
                    next = {
                        ...next,
                        userLocation: {
                            name:      next.userLocation?.name || 'Global',
                            latitude:  null,
                            longitude: null,
                        },
                    };
                }

                return next;
            },

            onRehydrateStorage: () => (state, error) => {
                if (error && __DEV__) {
                    console.warn('[Store] Rehydration error:', error);
                }
            },
        }
    )
);