// client/src/store/authSlice.js
// 🔐 V3.3 PRODUCTION: FCM registration + Radar shape fix 🔐
//
// שינויים מ-V3.2:
//   • [FIX]  radarResults: היה [] (array), תוקן ל-object שתואם למבנה
//            שהשרת מחזיר: { users, groups, searchContext }. בלעדי זה,
//            useAppStore.fetchRadarData היה מאפס את ה-state ל-array
//            ריק וה-Radar לא הציג כלום.
//
// שינויים מ-V3.1 (V3.2):
//   • [FIX]  קריאה ל-registerPushTokenAfterLogin() אחרי 3 זרימות auth
//            - initialize() (re-login from stored token)
//            - login() (email+password)
//            - loginWithGoogle() (Google OAuth)
//     בלי זה ה-FCM token לא נשמר בשרת, וכל ה-push notifications נכשלים
//     בשקט עם "No FCM token for user ... — skipping OS push".
//   • Fire-and-forget: לא ממתינים, לא חוסמים, .catch() תמיד.

import { Alert, Platform, ToastAndroid } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import * as api from './api';
import { supabase } from '../lib/supabase';
import { socialInitialState } from './socialSlice';
import { chatInitialState } from './chatSlice';
// ⭐️ NEW V3.2 — registers the device's FCM push token with the server.
// Safe to call multiple times. Has its own internal cache.
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
    radarResults: { users: [], groups: [], searchContext: null },
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
// ⭐️ NEW V3.2 — tiny helper used by every successful auth path
// ─────────────────────────────────────────────────────────────
const registerPushTokenSilently = () => {
    // Fire-and-forget via bridge — breaks the require cycle.
    notificationBridge.emit('auth:login', {});
};

// ─────────────────────────────────────────────────────────────
// Slice factory
// ─────────────────────────────────────────────────────────────
export const createAuthSlice = (set, get) => {

    // 🟢 1. הוספת משתנה "מנעול" מקומי
    let isCurrentlyLoggingOut = false;

    const logoutCleanup = async () => {
        // 🟢 2. אם המנעול סגור (אנחנו כבר מנקים), תתעלם מהקריאה הנוכחית ותצא
        if (isCurrentlyLoggingOut) return;
        
        // 🟢 3. נועלים את השער כדי שקריאות אחרות בשנייה הזו לא ייכנסו
        isCurrentlyLoggingOut = true;

        if (__DEV__) console.log('🧹 [AuthSlice] Performing full cleanup...');

        // Pull down active connections before wiping state
        try { get().disconnectSocket?.(); } catch (e) {}
        try { get().leaveVoiceRoom?.(); } catch (e) {}
        try { get().leaveVideoRoom?.(); } catch (e) {}

        api.clearLocalTokens();

        // Composed wipe — every slice's initial state is restored
        set({ ...initialGlobalState, isInitialized: true });

        // 🟢 4. משחררים את המנעול אחרי שנייה, כדי שאם המשתמש ירצה להתחבר מחדש המערכת תעבוד
        setTimeout(() => {
            isCurrentlyLoggingOut = false;
        }, 1000);
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

                        // ⭐️ NEW V3.2 — register the device's FCM token now that we're auth'd
                        registerPushTokenSilently();
                    } else {
                        throw new Error('Invalid user object received from API.');
                    }
                } catch (apiError) {
                    const errorStr = String(apiError || '');
                    // ⭐️ הגנה חכמה מפני חסימות עומס מוגזמות בזמן פיתוח ⭐️
                    if (errorStr.includes('ThrottlerException') || errorStr.includes('429')) {
                        if (__DEV__) console.warn('[AuthSlice] Server throttled (Too Many Requests). Keeping token/session.', apiError);
                        set({ isInitialized: true });
                    } else {
                        if (__DEV__) console.warn('[AuthSlice] Token invalid during init. Logging out...', apiError);
                        await logoutCleanup();
                    }
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

                // ⭐️ NEW V3.2 — register the device's FCM token after a successful login
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

                // ⭐️ NEW V3.2 — register the device's FCM token after Google sign-in
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

                // ⭐️ NEW V3.2 — register the device's FCM token after registration too
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
                
                // הוספת ה-Hash (/#/) כדי להגן על הניתוב של כרום מפני קריסות שרת (SPA Routing)
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: 'https://kliqtap.com/reset-password'
                });
                
                if (error) throw error;
                return true;
            } catch (e) {
                throw new Error(e.message || 'Failed to send reset email.');
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

            // ⭐️ השורה הזו מסננת את ה-birthday החוצה מהנתונים שנשלחים
            const { birthday, ...safeUpdates } = updates;
            if (birthday) safeUpdates.dateOfBirth = birthday; // ממיר birthday → dateOfBirth

            const previousUser = user;
            // מעדכנים את ה-State המקומי עם העדכון המלא (כדי שהמשתמש יראה את זה)
            set({ user: { ...user, ...updates }, profileSaving: true }); 
            try {
                await api.fetchAPI('/users/me', {
                    method: 'PATCH',
                    body: JSON.stringify(safeUpdates), // כאן שולחים רק את מה ש"בטוח"
                });
                set({ profileSaving: false });
                if (Platform.OS === 'android') {
                    ToastAndroid.show('✓ Saved', ToastAndroid.SHORT);
                }
                get().fetchUserDataAndMotivation?.();
                return true;
            } catch (e) {
                if (__DEV__) console.error('[AuthSlice] Failed to update profile:', e);
                set({ user: previousUser, profileSaving: false }); // rollback
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