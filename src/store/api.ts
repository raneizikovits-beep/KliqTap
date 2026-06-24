// client/src/store/api.ts
// ⭐️ KliqMind V4.5 PRODUCTION: Fixed Refresh Token Rotation & Session Drops ⭐️

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const API_BASE_URL = (process.env as any).EXPO_PUBLIC_API_URL || 'https://api.kliqtap.com';

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const DEFAULT_TIMEOUT_MS = 15_000;

// ⭐️ Proactive refresh: נרענן 5 דקות לפני שהטוקן פג, לא אחרי
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;
let onAuthFailureCallback: (() => void) | null = null;

let isRefreshing: boolean = false;

// ⭐️ Queue עם resolve/reject נפרד — תיקון Race Condition
type QueueEntry = { resolve: () => void; reject: (err: any) => void };
let failedQueue: QueueEntry[] = [];

// --- Type Definitions -------------------------------------------------------

export interface FetchAPIOptions extends Omit<RequestInit, 'body'> {
    auth?: boolean;
    body?: BodyInit | object | null;
    timeout?: number;
}

export class APIError extends Error {
    status: number;
    payload: unknown;
    constructor(message: string, status: number, payload: unknown = null) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.payload = payload;
    }
}

// --- 1. Context & Storage Helpers -------------------------------------------

const isWebSafe = typeof window !== 'undefined' && Platform.OS === 'web';

const getDeviceContext = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila';
    } catch (e) {
        return 'Asia/Manila';
    }
};

const saveTokensToStorage = async (access: string | null, refresh?: string | null): Promise<void> => {
    try {
        if (isWebSafe) {
            if (access !== null) window.localStorage.setItem(ACCESS_TOKEN_KEY, access);
            if (refresh) window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
        } else {
            if (access !== null) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, typeof access === 'string' ? access : JSON.stringify(access));
            if (refresh) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, typeof refresh === 'string' ? refresh : JSON.stringify(refresh));
        }
    } catch (e) {
        if (__DEV__) console.error('[API Storage] Failed to save tokens:', e);
    }
};

const deleteTokensFromStorage = async (): Promise<void> => {
    try {
        if (isWebSafe) {
            window.localStorage.removeItem(ACCESS_TOKEN_KEY);
            window.localStorage.removeItem(REFRESH_TOKEN_KEY);
        } else {
            await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
            await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        }
    } catch (e) {
        if (__DEV__) console.error('[API Storage] Failed to delete tokens:', e);
    }
};

const subscribeTokenRefresh = (): Promise<void> =>
    new Promise<void>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
    });

const processQueue = (error: any = null): void => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve();
    });
    failedQueue = [];
};

// --- 2. JWT Utilities (Proactive Refresh) -----------------------------------

const decodeJwtPayload = (token: string): { exp?: number } | null => {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonStr = typeof atob === 'function'
            ? atob(base64)
            : (typeof (globalThis as any).Buffer === 'function'
                ? (globalThis as any).Buffer.from(base64, 'base64').toString('utf8')
                : '');
        return JSON.parse(jsonStr);
    } catch {
        return null;
    }
};

export const isTokenExpiringSoon = (): boolean => {
    if (!currentAccessToken) return true;
    const payload = decodeJwtPayload(currentAccessToken);
    if (!payload?.exp) return false;
    return Date.now() >= payload.exp * 1000 - TOKEN_REFRESH_BUFFER_MS;
};

// --- 3. Exported Utilities --------------------------------------------------

export const setAuthFailureCallback = (callback: (() => void) | null): void => {
    onAuthFailureCallback = callback;
};

export const setAuthTokens = (access: string | null, refresh: string | null): void => {
    currentAccessToken = access;
    currentRefreshToken = refresh;
    saveTokensToStorage(access, refresh);
};

export const clearLocalTokens = (): void => {
    currentAccessToken = null;
    currentRefreshToken = null;
    deleteTokensFromStorage();
};

export const getAuthToken = (): string | null => currentAccessToken;

export const loadTokensFromStorage = async (): Promise<{
    currentAccessToken: string | null;
    currentRefreshToken: string | null;
}> => {
    try {
        if (isWebSafe) {
            currentAccessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
            currentRefreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
        } else {
            currentAccessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
            currentRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        }
    } catch (e) {
        if (__DEV__) console.error('[API Storage] Failed to load tokens:', e);
    }
    return { currentAccessToken, currentRefreshToken };
};

// --- 4. Token Refresh Logic -------------------------------------------------

const attemptTokenRefresh = async (): Promise<string> => {
    if (!currentRefreshToken) throw new APIError('No refresh token available.', 401);

    if (__DEV__) console.log('[API] Attempting session refresh...');
    const url = `${API_BASE_URL}/auth/refresh`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: currentRefreshToken }),
            signal: controller.signal,
        });

        if (!response.ok) {
            clearLocalTokens();
            if (onAuthFailureCallback) onAuthFailureCallback();
            throw new APIError('Session expired.', response.status);
        }
        
        const data = await response.json();
        
        // ⭐️ התיקון הגדול: קוראים את שני הטוקנים מהשרת בכל התצורות האפשריות
        // ושומרים את ה-refresh token החדש שהשרת הנפיק!
        const newAccessToken: string = data.access_token || data.accessToken;
        const newRefreshToken: string = data.refresh_token || data.refreshToken || currentRefreshToken;

        if (!newAccessToken) {
            throw new Error("No valid token received from server");
        }

        setAuthTokens(newAccessToken, newRefreshToken);
        return newAccessToken;
    } finally {
        clearTimeout(timeoutId);
    }
};

export const ensureFreshToken = async (): Promise<void> => {
    if (!currentAccessToken || !currentRefreshToken) return;
    if (!isTokenExpiringSoon()) return;

    if (isRefreshing) {
        // 🛡️ מנגנון נעילה חזק יותר
        return subscribeTokenRefresh();
    }

    isRefreshing = true;
    try {
        await attemptTokenRefresh();
        processQueue(); 
        if (__DEV__) console.log('[API] ✅ Proactive token refresh successful.');
    } catch (e) {
        processQueue(e);
        if (__DEV__) console.warn('[API] ⚠️ Proactive refresh failed:', e);
        throw e; // ⭐️ הוספה קריטית: תן ל-fetchAPI לדעת שהריענון נכשל באמת!
    } finally {
        isRefreshing = false;
    }
};

// --- 5. Header Construction (centralized) -----------------------------------

const buildHeaders = (
    optionsHeaders: HeadersInit | undefined,
    body: unknown,
    skipAuth: boolean,
): Headers => {
    const headers = new Headers(optionsHeaders);

    const isFormData = body && typeof body === 'object' && (
        body instanceof FormData ||
        body.constructor?.name === 'FormData' ||
        typeof (body as any).append === 'function'
    );

    if (!isFormData && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    headers.set('X-Device-Timezone', getDeviceContext());

    if (!skipAuth && currentAccessToken) {
        headers.set('Authorization', `Bearer ${currentAccessToken}`);
    }

    return headers;
};

// --- 6. Main Fetch Wrapper --------------------------------------------------

export async function fetchAPI<T = any>(
    endpoint: string,
    options: FetchAPIOptions = {},
): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const skipAuth = options.auth === false;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

    let normalizedBody: BodyInit | null | undefined = undefined;
    if (options.body !== undefined && options.body !== null) {
        const isFormData = options.body && typeof options.body === 'object' && (
            options.body instanceof FormData ||
            options.body.constructor?.name === 'FormData' ||
            typeof (options.body as any).append === 'function'
        );

        const isString = typeof options.body === 'string';

        if (isFormData || isString) {
            normalizedBody = options.body as BodyInit;
        } else {
            normalizedBody = JSON.stringify(options.body);
        }
    }

    const executeFetch = async (): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            return await fetch(url, {
                ...options,
                headers: buildHeaders(options.headers, normalizedBody, skipAuth),
                body: normalizedBody as BodyInit | null | undefined,
                signal: controller.signal,
            });
        } finally {
            clearTimeout(timeoutId);
        }
    };

    try {
        if (!skipAuth && currentAccessToken && currentRefreshToken) {
            await ensureFreshToken();
        }

        let response = await executeFetch();

        if (response.status === 401 && !skipAuth) {
            if (!currentRefreshToken) {
                if (onAuthFailureCallback) onAuthFailureCallback();
                throw new APIError('Unauthorized.', 401);
            }

            if (isRefreshing) {
                await subscribeTokenRefresh();
                return fetchAPI<T>(endpoint, options);
            }

            isRefreshing = true;
            try {
                await attemptTokenRefresh();
                processQueue(); 
                response = await executeFetch(); 

                if (response.status === 401) {
                    clearLocalTokens();
                    if (onAuthFailureCallback) onAuthFailureCallback();
                    throw new APIError('Unauthorized even after token refresh.', 401);
                }
            } catch (refreshError: any) {
                const isNetworkTimeout =
                    refreshError?.name === 'AbortError' || refreshError?.status === 0;
                if (!isNetworkTimeout) {
                    clearLocalTokens();
                    // ⭐️ התיקון: אנחנו דואגים לקרוא ל-Callback כדי שהמשתמש יתנתק באמת אם הטוקן מת
                    if (onAuthFailureCallback) onAuthFailureCallback();
                }
                processQueue(refreshError);
                throw refreshError;
            } finally {
                isRefreshing = false;
            }
        }

        if (response.status === 429) {
            // 🛡️ הגנה: במקום להפיל שגיאה, נמתין וננסה שוב פעם אחת בלבד
            if (__DEV__) console.warn('[API] 429 Detected - Throttling request...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // המתנה של 2 שניות
            return fetchAPI<T>(endpoint, options); // ניסיון נוסף
        }

        if (!response.ok) {
            const errorBody = await response.json().catch(() => null);
            const message =
                (errorBody && (errorBody.message || errorBody.error)) ||
                `Request failed with status ${response.status}`;
            throw new APIError(message, response.status, errorBody);
        }

        if (response.status === 204) return null as unknown as T;

        const text = await response.text();
        return (text ? JSON.parse(text) : ({} as T)) as T;

    } catch (error: any) {
        if (error?.name === 'AbortError') {
            throw new APIError('Request timed out. Check your connection.', 0);
        }
        throw error;
    }
}