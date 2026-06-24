// client/src/store/authSlice.js
// 🔐 V3.5 PRODUCTION: Bulletproof Refresh Token Extraction 🔐

import { Alert, AppState, Platform, ToastAndroid } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import * as api from './api';
import { supabase } from '../lib/supabase';
import { socialInitialState } from './socialSlice';
import { chatInitialState } from './chatSlice';
import { notificationBridge } from '../services/notificationBridge';

// ─────────────────────────────────────────────────────────────
// Auth-specific initial state
// ─────────────────────────────────────────────────────────────
const authInitialState = {
    user: null,
    token: null,
    isInitialized: false,
    isAuthLoading: false,
    needsOnboarding: false,
    _isInitializing: false,
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
    radarResults: { users: [], groups: [], searchContext: null },
    leaderboard: [],
    profilePeekUser: null,
    viewingUserId: null,
    pulseImageUri: null,
    _fcmRegistered: false, // ⭐️ הוסף את השורה הזאת כאן!

    trendingTopics: [],
    featuredCards: [],
    liveZones: [],
    trendingCommunities: [],
};

export const initialGlobalState = Object.freeze({
    ...authInitialState,
    ...socialInitialState,
    ...chatInitialState,
});

const GOOGLE_WEB_CLIENT_ID =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    '808544466960-o2f69b7hiqse0n43rfbmktopurnu46jm.apps.googleusercontent.com';

const registerPushTokenSilently = () => {
    notificationBridge.emit('auth:login', {});
};

// ─────────────────────────────────────────────────────────────
// Slice factory
// ─────────────────────────────────────────────────────────────
     export const createAuthSlice = (set, get) => {

     let isCurrentlyLoggingOut = false;
     let appStateSubscription = null;

      const logoutCleanup = async (force = false) => {
        if (isCurrentlyLoggingOut) return;

        // הוספנו בדיקה: אם האפליקציה פעילה (active) ואנחנו לא במצב force, 
        // אל תתנתק, לא משנה מה קרה לטוקן.
        const appState = AppState.currentState;
        if (!force && appState === 'active') {
            if (__DEV__) console.log('🛡️ [AuthSlice] Cleanup blocked: App is active, ignoring failure.');
            return; 
        }

        isCurrentlyLoggingOut = true;
        if (__DEV__) console.log('🧹 [AuthSlice] Performing full cleanup...');

        try { get().disconnectSocket?.(); } catch (e) {}
        try { get().leaveVoiceRoom?.(); } catch (e) {}
        try { get().leaveVideoRoom?.(); } catch (e) {}

        api.clearLocalTokens();
        set({ ...initialGlobalState, isInitialized: true });

        setTimeout(() => {
            isCurrentlyLoggingOut = false;
        }, 1000);
    };

    api.setAuthFailureCallback(logoutCleanup);

    // 🛡️ משתנה גלובלי בתוך הסלייס שזוכר מתי הייתה הבדיקה האחרונה
    let lastRefreshTime = 0; 

    appStateSubscription = AppState.addEventListener('change', async (nextState) => {
        if (nextState !== 'active') return;

        // מנגנון הגנה: אם עברו פחות מ-15 שניות מהבדיקה האחרונה, אנחנו לא עושים כלום
        const now = Date.now();
        if (now - lastRefreshTime < 15000) {
            if (__DEV__) console.log('🛡️ [AuthSlice] Throttle active, skipping duplicate check.');
            return;
        }
        lastRefreshTime = now;

        const { token } = get();
        if (!token) return;

        if (__DEV__) console.log('[AuthSlice] 📱 App foregrounded. Checking token health...');

        try {
            await api.ensureFreshToken();
            get().connectSocket?.();
        } catch (e) {
            if (__DEV__) console.warn('[AuthSlice] Foreground token check failed:', e);
        }
        });

    return {
        ...authInitialState,

            initialize: async () => {
            if (!get()._fcmRegistered) {
            registerPushTokenSilently();
            set({ _fcmRegistered: true });
         }

            if (__DEV__) console.log('🚀 [AuthSlice] App initializing... (Sequential Mode)');

            // פונקציית עזר להשהיה קצרה (למניעת הצפת השרת)
            const delay = (ms) => new Promise(res => setTimeout(res, ms));

            try {
                const { currentAccessToken, currentRefreshToken } = await api.loadTokensFromStorage();

                if (!currentAccessToken) {
                    set({ isInitialized: true, token: null, user: null, _isInitializing: false });
                    return;
                }

                api.setAuthTokens(currentAccessToken, currentRefreshToken || null);
                set({ token: currentAccessToken });

                try {
                    // 1. קודם כל נתוני משתמש בסיסיים
                    const user = await api.fetchAPI('/users/me');

                    if (user?.id) {
                        set({ user, isInitialized: true, needsOnboarding: user.needsOnboarding || false });

                        // 2. חיבור הסוקט
                        get().connectSocket?.();
                        await delay(800); // ⭐️ השהייה קריטית לפני בקשות נוספות

                        // 3. משיכת מידע לפי סדר חשיבות (מדורג)
                        await get().refreshAllData?.(); 
                        await delay(800);
                        
                        await get().fetchSettings?.();
                        await delay(800);
                        
                        registerPushTokenSilently();
                    }
                } catch (apiError) {
                    // טיפול בשגיאות 429
                    if (__DEV__) console.warn('[AuthSlice] Init error, but session kept.', apiError);
                    set({ isInitialized: true });
                }
            } catch (e) {
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

                // ⭐️ התיקון: חולצים את הטוקנים בצורה בטוחה ללא תלות ב-casing
                const accessToken = response.access_token || response.accessToken;
                const refreshToken = response.refresh_token || response.refreshToken;
                const apiUser = response.user || response;

                api.setAuthTokens(accessToken, refreshToken);

                set({
                    user: apiUser,
                    token: accessToken,
                    needsOnboarding: apiUser.needsOnboarding || false,
                    isInitialized: true,
                    isAuthLoading: false,
                });

                get().connectSocket?.();
                get().refreshAllData?.();
                get().fetchSettings?.();
                registerPushTokenSilently();
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
                registerPushTokenSilently();
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

                // ⭐️ התיקון: חולצים את הטוקנים בצורה בטוחה ללא תלות ב-casing
                const accessToken = response.access_token || response.accessToken;
                const refreshToken = response.refresh_token || response.refreshToken;
                const apiUser = response.user || response;

                if (!accessToken) {
                    set({ isAuthLoading: false });
                    return { requiresVerification: true };
                }

                api.setAuthTokens(accessToken, refreshToken);

                set({
                    user: apiUser,
                    token: accessToken,
                    needsOnboarding: true,
                    isInitialized: true,
                    isAuthLoading: false,
                });

                get().connectSocket?.();
                get().refreshAllData?.();
                registerPushTokenSilently();

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
                    redirectTo: 'https://kliqtap.com/reset-password'
                });

                if (error) throw error;
                return true;
            } catch (e) {
                throw new Error(e.message || 'Failed to send reset email.');
            }
        },

        logout: () => logoutCleanup(true),
        
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

            const { birthday, ...safeUpdates } = updates;
            if (birthday) safeUpdates.dateOfBirth = birthday;

            const previousUser = user;
            set({ user: { ...user, ...updates }, profileSaving: true });
            try {
                await api.fetchAPI('/users/me', {
                    method: 'PATCH',
                    body: JSON.stringify(safeUpdates),
                });
                set({ profileSaving: false });
                if (Platform.OS === 'android') {
                    ToastAndroid.show('✓ Saved', ToastAndroid.SHORT);
                }
                get().fetchUserDataAndMotivation?.();
                return true;
            } catch (e) {
                if (__DEV__) console.error('[AuthSlice] Failed to update profile:', e);
                set({ user: previousUser, profileSaving: false });
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