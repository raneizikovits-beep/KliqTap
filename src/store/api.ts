// client/src/store/api.ts
// ⭐️ KliqMind V4.2 PRODUCTION: Robust Web/Native FormData Handling + Context Injection ⭐️

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const API_BASE_URL = (process.env as any).EXPO_PUBLIC_API_URL || 'https://api.kliqtap.com';

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const DEFAULT_TIMEOUT_MS = 15_000; 

let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;
let onAuthFailureCallback: (() => void) | null = null;

let isRefreshing: boolean = false;
let failedQueue: Array<(token: string | null) => void> = [];

// --- Type Definitions ------------------------------------------------------

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

// --- 1. Context & Storage Helpers -------------------------------

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
            if (access !== null) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access);
            if (refresh) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh);
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

const subscribeTokenRefresh = (cb: (token: string | null) => void): Promise<void> =>
    new Promise<void>(resolve => {
        failedQueue.push((token) => { cb(token); resolve(); });
    }); 

const processQueue = (token: string | null = null) => {
    failedQueue.forEach(prom => prom(token));
    failedQueue = [];
}; 

// --- 2. Exported Utilities -------------------------------------------------

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

// --- 3. Token Refresh Logic ------------------------------------------------

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
            if (onAuthFailureCallback) onAuthFailureCallback();
            throw new APIError('Session expired.', response.status);
        }
        const data = await response.json();
        const newAccessToken: string = data.access_token;
        setAuthTokens(newAccessToken, currentRefreshToken);
        return newAccessToken;
    } finally {
        clearTimeout(timeoutId);
    }
}; 

// --- 4. Header Construction (centralized) ----------------------------------

const buildHeaders = (
    optionsHeaders: HeadersInit | undefined,
    body: unknown,
    skipAuth: boolean,
): Headers => {
    const headers = new Headers(optionsHeaders);

    // ⭐️ KLIQMIND FIX: זיהוי עמיד של FormData שפותר את קריסת ההעלאות בווב ⭐️
    const isFormData = body && typeof body === 'object' && (
        body instanceof FormData || 
        body.constructor?.name === 'FormData' || 
        typeof (body as any).append === 'function'
    );

    if (!isFormData && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    } else if (isFormData) {
        // מוחק את ה-Header כדי שהדפדפן יחשב את ה-boundary בעצמו
        headers.delete('Content-Type');
    } 

    headers.set('x-user-timezone', getDeviceContext());
    headers.set('x-user-location', 'Cebu City');

    if (currentAccessToken && !skipAuth) {
        headers.set('Authorization', `Bearer ${currentAccessToken}`);
    }
    return headers;
}; 

// --- 5. Core Fetch Function ------------------------------------------------

export async function fetchAPI<T = any>(
    endpoint: string,
    options: FetchAPIOptions = {},
): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const skipAuth = options.auth === false;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS; 

    let normalizedBody: BodyInit | null | undefined = undefined;
    if (options.body !== undefined && options.body !== null) {
        
        // ⭐️ KLIQMIND FIX: הגנה מפני JSON.stringify לקבצי מדיה בווב ⭐️
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
        let response = await executeFetch();

        if (response.status === 401 && !skipAuth) {
            if (!currentRefreshToken) {
                if (onAuthFailureCallback) onAuthFailureCallback();
                throw new APIError('Unauthorized.', 401);
            }

            if (isRefreshing) {
                await subscribeTokenRefresh(() => {});
                return fetchAPI<T>(endpoint, options);
            }

            isRefreshing = true;
            try {
                await attemptTokenRefresh();
                processQueue(currentAccessToken);
                response = await executeFetch();
            } catch (refreshError) {
                processQueue(null);
                throw refreshError;
            } finally {
                isRefreshing = false;
            }
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