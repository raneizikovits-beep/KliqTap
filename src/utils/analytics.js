// client/src/utils/analytics.js
// v2.0 — Production-grade Firebase Analytics wrapper
//
// [V2.0 CHANGES — Engineering Audit Fixes]:
//   • [FIX HIGH]   console.log removed from production: fired on EVERY event in
//                  v1, leaking params (userId, contentId, etc.) to device logs and
//                  any connected log aggregator. Gated behind __DEV__ only.
//   • [FIX MEDIUM] validateEventName(): Firebase enforces ≤40 chars, alphanumeric +
//                  underscore only, cannot start with underscore, no reserved names.
//                  v1 swallowed all violations silently — invalid events were lost
//                  with no developer feedback. Now warns in DEV and skips the call.
//   • [FIX MEDIUM] validateParams(): Firebase limits — max 25 params per event,
//                  param names ≤40 chars, string values ≤100 chars. Violations are
//                  silently dropped by the SDK; now sanitized before the call.
//   • [FIX LOW]    analyticsInstance instantiated once at module level. v1 called
//                  analytics() on every event. Firebase memoizes internally, but
//                  this is cleaner and avoids the per-call overhead.
//   • [NEW]        EVENTS registry: single source of truth for all event name
//                  constants. Callers import from here instead of using string
//                  literals, preventing inconsistent naming across the codebase.
//   • [NEW]        trackScreen(): logs Firebase screen_view events. Essential for
//                  funnel analysis, retention tracking, and session replay.
//   • [NEW]        setUserProperties(): sets persistent user attributes for cohort
//                  segmentation and A/B test targeting.
//   • [NEW]        identify(): sets the Firebase Analytics userId for cross-device
//                  attribution. Must be called on login; cleared on logout.

// ─────────────────────────────────────────────────────────────
// Cross-platform __DEV__ guard
// ─────────────────────────────────────────────────────────────
if (typeof __DEV__ === 'undefined') {
    Object.defineProperty(
        typeof globalThis !== 'undefined' ? globalThis : global,
        '__DEV__',
        { value: process.env.NODE_ENV !== 'production', configurable: true }
    );
}

import analyticsLib from '@react-native-firebase/analytics';
import { Platform } from 'react-native';

// [FIX]: הגנה לסביבת Web - מונע קריסה של Firebase Native
let analyticsInstance;

if (Platform.OS !== 'web') {
    analyticsInstance = analyticsLib();
} else {
    // ב-Web אנחנו יוצרים אובייקט "דמה" (No-op) כדי לא לשבור את האפליקציה
    analyticsInstance = {
        logEvent: async () => {},
        logScreenView: async () => {},
        setUserId: async () => {},
        setUserProperties: async () => {}
    };
}

// ─────────────────────────────────────────────────────────────
// Firebase Analytics constraints
// ─────────────────────────────────────────────────────────────

const FIREBASE_MAX_EVENT_NAME_LEN  = 40;
const FIREBASE_MAX_PARAM_NAME_LEN  = 40;
const FIREBASE_MAX_PARAM_VALUE_LEN = 100;
const FIREBASE_MAX_PARAMS_PER_EVENT = 25;

/**
 * Firebase reserved event names that cannot be used as custom events.
 * Full list: https://firebase.google.com/docs/reference/android/com/google/firebase/analytics/FirebaseAnalytics.Event
 */
const FIREBASE_RESERVED_EVENTS = new Set([
    'ad_activeview', 'ad_click', 'ad_exposure', 'ad_impression', 'ad_query',
    'ad_reward', 'adunit_exposure', 'app_background', 'app_clear_data',
    'app_exception', 'app_remove', 'app_store_refund', 'app_store_subscription_cancel',
    'app_store_subscription_convert', 'app_store_subscription_renew', 'app_update',
    'app_upgrade', 'dynamic_link_app_open', 'dynamic_link_first_open',
    'dynamic_link_foreground', 'error', 'firebase_campaign', 'firebase_in_app_message_action',
    'firebase_in_app_message_dismiss', 'firebase_in_app_message_impression',
    'first_open', 'first_visit', 'in_app_purchase', 'notification_dismiss',
    'notification_foreground', 'notification_open', 'notification_receive',
    'os_update', 'screen_view', 'session_start', 'user_engagement',
]);

/** Firebase event name validation regex. */
const VALID_EVENT_NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

// ─────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────

/**
 * Returns null if eventName is valid, or an error string describing the violation.
 * @param {string} eventName
 * @returns {string|null}
 */
const validateEventName = (eventName) => {
    if (typeof eventName !== 'string' || !eventName.trim()) {
        return 'Event name must be a non-empty string';
    }
    if (eventName.length > FIREBASE_MAX_EVENT_NAME_LEN) {
        return `Event name too long (${eventName.length} chars, max ${FIREBASE_MAX_EVENT_NAME_LEN})`;
    }
    if (!VALID_EVENT_NAME_RE.test(eventName)) {
        return `Event name "${eventName}" contains invalid characters (must start with a letter, only letters/digits/underscores allowed)`;
    }
    if (FIREBASE_RESERVED_EVENTS.has(eventName)) {
        return `Event name "${eventName}" is a Firebase reserved name and cannot be used as a custom event`;
    }
    return null;
};

/**
 * Sanitizes a params object to comply with Firebase limits.
 * - Strips params with invalid key names (silent in production, warns in DEV)
 * - Truncates string values to 100 chars
 * - Caps to 25 params total
 * @param {object} params
 * @param {string} eventName  - Used for dev warning context only
 * @returns {object}
 */
const sanitizeParams = (params, eventName) => {
    const VALID_KEY_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
    const entries = Object.entries(params);
    const sanitized = {};
    let skipped = 0;

    for (const [key, value] of entries) {
        if (Object.keys(sanitized).length >= FIREBASE_MAX_PARAMS_PER_EVENT) {
            skipped++;
            continue;
        }
        if (key.length > FIREBASE_MAX_PARAM_NAME_LEN || !VALID_KEY_RE.test(key)) {
            if (__DEV__) {
                console.warn(`[Analytics] Param key "${key}" on event "${eventName}" is invalid and will be dropped.`);
            }
            continue;
        }
        // Truncate over-length string values
        sanitized[key] = typeof value === 'string' && value.length > FIREBASE_MAX_PARAM_VALUE_LEN
            ? value.slice(0, FIREBASE_MAX_PARAM_VALUE_LEN)
            : value;
    }

    if (__DEV__ && skipped > 0) {
        console.warn(
            `[Analytics] Event "${eventName}" had ${entries.length} params but Firebase allows max ` +
            `${FIREBASE_MAX_PARAMS_PER_EVENT}. ${skipped} param(s) were dropped.`
        );
    }

    return sanitized;
};

// ─────────────────────────────────────────────────────────────
// Event name constants — single source of truth.
// Import EVENTS and use these instead of hardcoded string literals.
// ─────────────────────────────────────────────────────────────

export const EVENTS = Object.freeze({
    // Auth
    LOGIN:              'user_login',
    LOGOUT:             'user_logout',
    REGISTER:           'user_register',

    // Social
    FOLLOW_USER:        'follow_user',
    UNFOLLOW_USER:      'unfollow_user',
    LIKE_POST:          'like_post',
    UNLIKE_POST:        'unlike_post',
    COMMENT_POST:       'comment_post',
    CREATE_POST:        'create_post',
    CREATE_PULSE:       'create_pulse',

    // Navigation / Discovery
    VIEW_PROFILE:       'view_profile',
    VIEW_POST:          'view_post',
    OPEN_RADAR:         'open_radar',
    OPEN_EXPLORE:       'open_explore',
    SEARCH_PERFORMED:   'search_performed',
    SEARCH_RESULT_TAP:  'search_result_tap',

    // Trends
    TREND_TAPPED:       'trend_tapped',
    TREND_ROUTED:       'trend_routed',

    // Live / Streams
    JOIN_LIVE_ROOM:     'join_live_room',
    LEAVE_LIVE_ROOM:    'leave_live_room',
    ROULETTE_MATCH:     'roulette_match',

    // Wellness
    LOG_MOOD:           'log_mood',
    CREATE_JOURNAL:     'create_journal',
    LOG_ACTIVITY:       'log_activity',

    // Support
    CREATE_TICKET:      'create_support_ticket',
    REPLY_TICKET:       'reply_support_ticket',

    // Gamification
    AWARD_POINTS:       'award_points',
    STREAK_MILESTONE:   'streak_milestone',

    // Errors / Diagnostics
    SCREEN_ERROR:       'screen_error',
});

// ─────────────────────────────────────────────────────────────
// Core tracker
// ─────────────────────────────────────────────────────────────

/**
 * Logs a custom analytics event to Firebase.
 * - Validates event name against Firebase rules (warns + skips on violation in DEV)
 * - Sanitizes params (drops invalid keys, truncates long values, caps at 25 params)
 * - console.log only in __DEV__ — never in production
 *
 * @param {string} eventName  - Use a constant from EVENTS
 * @param {object} [params]   - Up to 25 key-value pairs
 */
export const trackEvent = async (eventName, params = {}) => {
    // [FIX MEDIUM] Validate before touching Firebase
    const nameError = validateEventName(eventName);
    if (nameError) {
        if (__DEV__) {
            console.warn(`[Analytics] Invalid event name — skipped. Reason: ${nameError}`);
        }
        return;
    }

    // [FIX MEDIUM] Sanitize params before sending
    const safeParams = sanitizeParams(params, eventName);

    try {
        await analyticsInstance.logEvent(eventName, safeParams);
        // [FIX HIGH] console.log only in dev — never fires in production
        if (__DEV__) {
            console.log(`[Analytics] 📊 ${eventName}`, safeParams);
        }
    } catch (err) {
        if (__DEV__) {
            console.warn('[Analytics] ⚠️ Failed to log event:', err);
        }
    }
};

// ─────────────────────────────────────────────────────────────
// Screen tracking
// ─────────────────────────────────────────────────────────────

/**
 * Logs a screen view event. Call this in every screen's useEffect/componentDidMount.
 * Essential for funnel analysis, user flow tracking, and session replay.
 *
 * @param {string} screenName   - e.g. 'HomeScreen', 'ProfileScreen'
 * @param {string} [screenClass] - Optional iOS class name (defaults to screenName)
 */
export const trackScreen = async (screenName, screenClass) => {
    if (!screenName) {
        if (__DEV__) console.warn('[Analytics] trackScreen called without a screenName');
        return;
    }
    try {
        await analyticsInstance.logScreenView({
            screen_name:  screenName,
            screen_class: screenClass || screenName,
        });
        if (__DEV__) {
            console.log(`[Analytics] 📱 screen_view: ${screenName}`);
        }
    } catch (err) {
        if (__DEV__) console.warn('[Analytics] ⚠️ trackScreen failed:', err);
    }
};

// ─────────────────────────────────────────────────────────────
// User identity
// ─────────────────────────────────────────────────────────────

/**
 * Sets the Firebase Analytics user ID for cross-device attribution.
 * Call after login; call with null after logout.
 * Do NOT pass PII (email, phone) — use an opaque user ID only.
 *
 * @param {string|null} userId - Opaque user identifier, or null to clear
 */
export const identify = async (userId) => {
    try {
        await analyticsInstance.setUserId(userId ?? null);
        if (__DEV__) {
            console.log(`[Analytics] 🪪 userId set: ${userId ?? 'null (cleared)'}`);
        }
    } catch (err) {
        if (__DEV__) console.warn('[Analytics] ⚠️ identify failed:', err);
    }
};

/**
 * Sets persistent user properties for cohort segmentation and A/B targeting.
 * Properties persist across sessions until explicitly overwritten or cleared.
 * Values must be strings; set to null to clear a property.
 *
 * @param {Record<string, string|null>} properties - e.g. { plan: 'pro', locale: 'en-PH' }
 */
export const setUserProperties = async (properties) => {
    if (!properties || typeof properties !== 'object') return;
    try {
        await analyticsInstance.setUserProperties(properties);
        if (__DEV__) {
            console.log('[Analytics] 🏷️ userProperties set:', properties);
        }
    } catch (err) {
        if (__DEV__) console.warn('[Analytics] ⚠️ setUserProperties failed:', err);
    }
};