// client/src/store/authService.js
// ⭐️ V2.0 PRODUCTION: Thin facade for raw auth endpoints ⭐️
//
// NOTE: As of V3.0 of authSlice.js, login/register live entirely in the slice
// (because they need to update Zustand state immediately). These helpers are
// kept for completeness — useful for non-store contexts (e.g. tests, scripts,
// direct invocation from RSC).
//
// If you decide these are dead code, you can safely delete this file; nothing
// in the slices imports it. Documented here so future engineers don't add a
// third login implementation.

import { fetchAPI } from './api';

/**
 * Pure sign-up — does NOT touch the Zustand store. Caller is responsible for
 * setting tokens and rehydrating state.
 *
 * @returns {Promise<{ access_token: string, refresh_token: string, user: Object }>}
 */
export async function signUp(name, username, email, password) {
    return fetchAPI('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, username, email, password }),
        auth: false,
    });
}

/**
 * Pure sign-in — does NOT touch the Zustand store. Caller is responsible for
 * setting tokens and rehydrating state.
 *
 * @returns {Promise<{ access_token: string, refresh_token: string, user: Object }>}
 */
export async function signIn(email, password) {
    return fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        auth: false,
    });
}