// client/src/store/authSlice.js
// 🔐 V3.1 PRODUCTION: Fixed Silent Failures for Email Verification 🔐
//
// שינויים מ-V3.0:
//   • תוקן באג Silent Fail ב-register: עכשיו מזהה כשסופרבייס לא מחזיר טוקן
//     (בגלל דרישת אימות אימייל) ומחזיר requiresVerification: true ל-UI.

import { Alert, Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import * as api from './api';
import { supabase } from '../lib/supabase';
import { socialInitialState } from './socialSlice';
import { chatInitialState } from './chatSlice';

// ─────────────────────────────────────────────────────────────
// Auth-specific initial state
// ─────────────────────────────────────────────────────────────
const authInitialState = {
    user: null,
    token: null,
    isInitialized: false,
    isAuthLoading: false,
    needsOnboarding: false,
    _isInitializing: false,           // moved from module-level flag
    kliqKingId: null,
    points: 0,
    streak: 0,
    badges: [],
    dailyVibeStatus: 'The Seeker',
    userSettings: {
        gpsEnabled: true,
        showOnMap: true,
        preciseLocation: false,
        activityStatus: true,
        ghostMode: false,
        readReceipts: true,
        autoVoice: false,
        suppReminders: true,
        motoReminders: true,
        darkMode: false,
        notifications: true,
    },
    userCache: {},
    followStatuses: {},
    aiRecommendations: [],
    radarResults: [],
    leaderboard: [],
    profilePeekUser: null,
    viewingUserId: null,
    pulseImageUri: null,

    // explore data (lives in useAppStore but reset here for safety)
    trendingTopics: [],
    featuredCards: [],
    liveZones: [],
    trendingCommunities: [],
};

// ─────────────────────────────────────────────────────────────
// Composed global state — drift-proof
// ─────────────────────────────────────────────────────────────
export const initialGlobalState = Object.freeze({
    ...authInitialState,
    ...socialInitialState,
    ...chatInitialState,
});

// ─────────────────────────────────────────────────────────────
// Google config — env-first
// ─────────────────────────────────────────────────────────────
const GOOGLE_WEB_CLIENT_ID =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    '808544466960-o2f69b7hiqse0n43rfbmktopurnu46jm.apps.googleusercontent.com';

// ─────────────────────────────────────────────────────────────
// Slice factory
// ─────────────────────────────────────────────────────────────
export const createAuthSlice = (set, get) => {

    const logoutCleanup = async () => {
        if (__DEV__) console.log('🧹 [AuthSlice] Performing full cleanup...');

        // Pull down active connections before wiping state
        try { get().disconnectSocket?.(); } catch (e) {}
        try { get().leaveVoiceRoom?.(); } catch (e) {}
        try { get().leaveVideoRoom?.(); } catch (e) {}

        api.clearLocalTokens();

        // Composed wipe — every slice's initial state is restored
        set({ ...initialGlobalState, isInitialized: true });
    };

    api.setAuthFailureCallback(logoutCleanup);

    return {
        ...authInitialState,

        initialize: async () => {
            if (get()._isInitializing) return;
            set({ _isInitializing: true });

            if (__DEV__) console.log('🚀 [AuthSlice] App initializing...');

            try {
                const { currentAccessToken, currentRefreshToken } = await api.loadTokensFromStorage();

                if (!currentAccessToken) {
                    if (__DEV__) console.log('[AuthSlice] No token found. Ready for login.');
                    set({ isInitialized: true, token: null, user: null, _isInitializing: false });
                    return;
                }

                api.setAuthTokens(currentAccessToken, currentRefreshToken || null);
                set({ token: currentAccessToken });

                try {
                    const user = await api.fetchAPI('/users/me');

                    if (user?.id) {
                        const isCurrentlyOnboarding = get().needsOnboarding;
                        const lockedOnboarding = isCurrentlyOnboarding
                            ? true
                            : (user.needsOnboarding || false);

                        set({
                            user,
                            isInitialized: true,
                            needsOnboarding: lockedOnboarding,
                        });

                        get().connectSocket?.();
                        get().refreshAllData?.();
                        get().fetchSettings?.();
                    } else {
                        throw new Error('Invalid user object received from API.');
                    }
                } catch (apiError) {
                    if (__DEV__) console.warn('[AuthSlice] Token invalid during init. Logging out...', apiError);
                    await logoutCleanup();
                }
            } catch (e) {
                if (__DEV__) console.error('[AuthSlice] Init Error:', e);
                set({ isInitialized: true, user: null, token: null });
            } finally {
                set({ _isInitializing: false });
            }
        },

        loadAuthAndMotivation: async () => {
            set({ isAuthLoading: false });
        },

        login: async (email, password) => {
            set({ isAuthLoading: true });
            try {
                const response = await api.fetchAPI('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email, password }),
                    auth: false,
                });

                const { access_token, refresh_token, user: apiUser } = response;
                api.setAuthTokens(access_token, refresh_token);

                set({
                    user: apiUser,
                    token: access_token,
                    needsOnboarding: apiUser.needsOnboarding || false,
                    isInitialized: true,
                    isAuthLoading: false,
                });

                get().connectSocket?.();
                get().refreshAllData?.();
                get().fetchSettings?.();
            } catch (error) {
                if (__DEV__) console.error('[AuthSlice] Login failed:', error);
                set({ isAuthLoading: false });
                throw error;
            }
        },

        loginWithGoogle: async () => {
            set({ isAuthLoading: true });

            try {
                GoogleSignin.configure({
                    scopes: [
                        'https://www.googleapis.com/auth/userinfo.email',
                        'https://www.googleapis.com/auth/userinfo.profile',
                    ],
                    webClientId: GOOGLE_WEB_CLIENT_ID,
                    offlineAccess: true,
                });

                await GoogleSignin.hasPlayServices();
                const userInfo = await GoogleSignin.signIn();

                const idToken = userInfo.data?.idToken || userInfo.idToken;
                if (!idToken) throw new Error('No ID token present!');

                const { data, error } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    token: idToken,
                });

                if (error) throw error;

                api.setAuthTokens(data.session.access_token, data.session.refresh_token);
                set({ token: data.session.access_token });

                const apiUser = await api.fetchAPI('/users/me');

                set({
                    user: apiUser,
                    needsOnboarding: apiUser.needsOnboarding || false,
                    isInitialized: true,
                    isAuthLoading: false,
                });

                get().connectSocket?.();
                get().refreshAllData?.();
                get().fetchSettings?.();
            } catch (error) {
                if (__DEV__) console.error('[AuthSlice] Google Login failed:', error);
                Alert.alert('Google Login Failed', error.message);
                set({ isAuthLoading: false });
            }
        },

        register: async (name, username, email, password, gender, dateOfBirth) => {
            set({ isAuthLoading: true });
            try {
                const response = await api.fetchAPI('/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ name, username, email, password, gender, dateOfBirth }),
                    auth: false,
                });

                const { access_token, refresh_token, user: apiUser } = response;
                
                // ⭐️ KLIQMIND FIX: בודקים אם יש טוקן. אם אין, זה אומר שסופרבייס דורש אימות אימייל!
                if (!access_token) {
                    set({ isAuthLoading: false });
                    return { requiresVerification: true };
                }

                api.setAuthTokens(access_token, refresh_token);

                set({
                    user: apiUser,
                    token: access_token,
                    needsOnboarding: true,
                    isInitialized: true,
                    isAuthLoading: false,
                });

                get().connectSocket?.();
                get().refreshAllData?.();
                
                return { requiresVerification: false };
            } catch (error) {
                if (__DEV__) console.error('[AuthSlice] Registration failed:', error);
                set({ isAuthLoading: false });
                throw error;
            }
        },

        resetPassword: async (email) => {
            try {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: 'kliqtap://reset-password',
                });
                if (error) throw error;
                return true;
            } catch (error) {
                if (__DEV__) console.error('Reset Password Error:', error);
                throw new Error(error.message || 'Failed to send reset email.');
            }
        },

        logout: logoutCleanup,

        submitOnboarding: async (intentText) => {
            try {
                await api.fetchAPI('/ai/onboarding', {
                    method: 'POST',
                    body: JSON.stringify({ intent: intentText }),
                });

                const currentUser = get().user;
                set({
                    needsOnboarding: false,
                    user: currentUser ? { ...currentUser, needsOnboarding: false } : null,
                });

                get().refreshAllData?.();
            } catch (e) {
                if (__DEV__) console.error('[AuthSlice] Onboarding Submit Error:', e);
                throw e;
            }
        },

        updateUserProfile: async (updates) => {
            const { user } = get();
            if (!user) return false;

            const previousUser = user;
            set({ user: { ...user, ...updates } }); // optimistic
            try {
                await api.fetchAPI('/users/me', {
                    method: 'PATCH',
                    body: JSON.stringify(updates),
                });
                get().fetchUserDataAndMotivation?.();
                return true;
            } catch (e) {
                if (__DEV__) console.error('[AuthSlice] Failed to update profile:', e);
                set({ user: previousUser }); // rollback
                Alert.alert('Error', 'Failed to save profile changes.');
                return false;
            }
        },

        fetchUserDataAndMotivation: async () => {
            if (!get().token) return;
            try {
                const data = await api.fetchAPI('/users/me');
                let kingData = null;
                try { kingData = await api.fetchAPI('/kliq-king/current'); } catch (e) {}

                if (data) {
                    const isCurrentlyOnboarding = get().needsOnboarding;
                    const lockedOnboarding = isCurrentlyOnboarding
                        ? true
                        : (data.needsOnboarding || false);

                    set({
                        user: data,
                        points: data.points || 0,
                        streak: data.streak || 0,
                        badges: data.badges || [],
                        kliqKingId: kingData?.id ? String(kingData.id) : null,
                        needsOnboarding: lockedOnboarding,
                    });
                }
            } catch (e) {
                if (__DEV__) console.warn('[AuthSlice] Failed to fetch user data', e);
            }
        },

        fetchDailyVibeStatus: async () => {
            if (!get().token) return;
            try {
                const data = await api.fetchAPI('/pulse/daily-status');
                if (data?.status) {
                    set({ dailyVibeStatus: data.status });
                }
            } catch (e) {
                if (__DEV__) console.warn('[AuthSlice] Failed to fetch daily vibe status', e);
            }
        },

        leaveVideoRoom: () => {
            const { localStream, peerConnections } = get();
            if (localStream) {
                try { localStream.getTracks().forEach(t => t.stop()); } catch (e) {}
            }
            if (peerConnections) {
                Object.values(peerConnections).forEach(pc => {
                    try { pc.close(); } catch (e) {}
                });
            }
            set({ localStream: null, peerConnections: {}, currentVideoRoomId: null });
        },

        leaveVoiceRoom: () => {
            const { localStream } = get();
            if (localStream) {
                try { localStream.getTracks().forEach(t => t.stop()); } catch (e) {}
            }
            set({ currentVoiceRoomId: null, localStream: null });
        },
    };
};