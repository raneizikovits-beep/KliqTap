// client/src/store/useAppStore.js
// 🏆 KliqMind V5.1 — Production-Hardened Store
//
// שינויים מ-V5.0:
//   • resolveUser: cache TTL (5 דקות) — מונע שרות נתונים מיושנים ללא הגבלה
//   • joinCommunity: rollback אופטימיסטי מלא + Toast על שגיאה
//   • migrate: immutable — לא מוטציה על persisted ישירות
//   • userCache: גבול גודל (100 entries) גם ב-live state, לא רק ב-partialize
//   • fetchProfilePreview: מסנכרן followStatuses אוטומטית
//   • createSupportTicket: return flow נקי וברור
//   • award: dev warning על action name לא מוכר
//   • postDraftText: initializer ב-global state (safety net אם socialSlice לא מגדיר)
//   • POINTS_TABLE: מיוצא לצורך testing ו-display

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
// it's transport-layer concern, not UI state).
let lastGpsSyncAt     = 0;
let lastSyncedCoords  = null;

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
 * @param {string} newKey  key being inserted
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
    gpsEnabled:     true,
    showOnMap:      true,
    preciseLocation: false,
    activityStatus: true,
    ghostMode:      false,
    readReceipts:   true,
    autoVoice:      false,
    suppReminders:  true,
    motoReminders:  true,
    darkMode:       false,
    notifications:  true,
});

// ─────────────────────────────────────────────────────────────
// Points map — exported so screens/tests can display action labels
// ─────────────────────────────────────────────────────────────
export const POINTS_TABLE = Object.freeze({
    'Like':         1,
    'Unlike':      -1,
    'Comment':      2,
    'Create Post':  3,
    'Create Pulse': 4,
    'Streak':       1,
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

            // ==========================================
            // 🏆 GAMIFICATION (single source of truth)
            // ==========================================
            points:  0,
            streak:  0,
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
                    Toast.show({
                        type:  'error',
                        text1: `😞 ${pointsToAdd} PTS`,
                        text2: 'Point removed.',
                    });
                }
            },

            // ==========================================
            // ⚙️ LIVE SETTINGS
            // ==========================================
            userSettings: { ...DEFAULT_SETTINGS },

            updateSetting: async (key, value) => {
                set(state => ({
                    userSettings: { ...state.userSettings, [key]: value },
                }));
                try {
                    await fetchAPI('/users/settings', {
                        method: 'PATCH',
                        body:   JSON.stringify({ [key]: value }),
                    });
                } catch (error) {
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
            isAiSpeaking:     false,
            isUserRecording:  false,
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
                    const blob             = await response.blob();
                    const { filename }     = describeFileFromUri(uri, fallbackName);
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
                try {
                    const response = await fetchAPI(`/users/${targetId}`);
                    if (response && typeof response.isFollowing !== 'undefined') {
                        set(state => ({
                            followStatuses: {
                                ...state.followStatuses,
                                [targetId]: response.isFollowing,
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
                const sid                 = String(targetId);
                const { followStatuses }  = get();
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
            trendingTopics:       [],
            featuredCards:        [],
            liveZones:            [],
            trendingCommunities:  [],
            isExploreLoading:     false,

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
            // 📡 RADAR
            // ==========================================
            radarResults:    [],
            isRadarLoading:  false,

            fetchRadarData: async (lat, lon) => {
                set({ isRadarLoading: true });
                try {
                    const data = await fetchAPI(`/geo/radar?lat=${lat}&lon=${lon}`);
                    set({ radarResults: Array.isArray(data) ? data : [] });
                } catch {
                    set({ radarResults: [] });
                } finally {
                    set({ isRadarLoading: false });
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
            version: 3,  // bumped from 2 → 3 for cache shape change (entries now { data, cachedAt })
            storage: createJSONStorage(() => AsyncStorage),

            // Persist only fields safe to restore.
            // Excluded: loading flags (transient), token (SecureStore), chatHistory (too large).
            partialize: (state) => ({
                userSettings:  state.userSettings,
                postDraftText: state.postDraftText,
                userLocation:  state.userLocation,
                points:        state.points,
                streak:        state.streak,
                badges:        state.badges,
                // Persist newest 50 cache entries only, to keep AsyncStorage lean.
                // Entries are objects: { data, cachedAt } — the TTL applies on read.
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
                    // V1 → V2: fill in any new settings keys
                    next = { ...next, userSettings: { ...DEFAULT_SETTINGS, ...next.userSettings } };
                }

                if (version < 3 && next.userCache) {
                    // V2 → V3: cache entries were plain objects; wrap them in { data, cachedAt }.
                    // Set cachedAt to 0 so they are considered expired and re-fetched on next access.
                    const upgraded = {};
                    for (const [k, v] of Object.entries(next.userCache)) {
                        upgraded[k] = v && typeof v === 'object' && v.data
                            ? v                            // already new format
                            : { data: v, cachedAt: 0 };   // old format — mark as expired
                    }
                    next = { ...next, userCache: upgraded };
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