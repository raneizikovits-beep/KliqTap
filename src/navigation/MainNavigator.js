// client/src/navigation/MainNavigator.js
// ⭐️ PRODUCTION GRADE v4: Error Boundary + prop isolation + __DEV__ guard ⭐️
//
// [V4 CHANGES — Engineering Audit Fixes]:
//   • [FIX HIGH]    ScreenErrorBoundary added: wraps every screen render so a runtime
//                   crash in one screen cannot white-screen the entire app.
//   • [FIX MEDIUM]  `tab` prop no longer leaked to child screens: destructured out
//                   before spread so screens receive only their own props.
//   • [FIX MEDIUM]  __DEV__ inline polyfill: prevents ReferenceError on web/Webpack
//                   builds where Metro does not inject the global.
//   • [NEW]         VALID_TABS exported: provides a single source of truth for tab
//                   names so callers don't hardcode magic strings.

// ─────────────────────────────────────────────────────────────
// Cross-platform __DEV__ guard
// Metro injects __DEV__; Webpack/web builds may not.
// ─────────────────────────────────────────────────────────────
if (typeof __DEV__ === 'undefined') {
    Object.defineProperty(
        typeof globalThis !== 'undefined' ? globalThis : global,
        '__DEV__',
        { value: process.env.NODE_ENV !== 'production', configurable: true }
    );
}

import React, { memo } from 'react';
import { Text, View, StyleSheet } from 'react-native';

// --- Screen Imports ---
import HomeScreen     from '../screens/HomeScreen';
import ExploreScreen  from '../screens/ExploreScreen';
import MessagesScreen from '../screens/MessagesScreen';
import AlertsScreen   from '../screens/AlertsScreen';
import ProfileScreen  from '../screens/ProfileScreen';
import BotStudioScreen from '../screens/BotStudioScreen';
import TribesScreen   from '../screens/TribesScreen';
import ArenaScreen    from '../screens/ArenaScreen';

// ─────────────────────────────────────────────────────────────
// Error Boundary — fault isolates screen runtime crashes.
// Without this, any uncaught throw in a screen white-screens
// the entire app with zero recovery path.
// ─────────────────────────────────────────────────────────────
class ScreenErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, errorMessage: error?.message || 'Unknown error' };
    }

    componentDidCatch(error, info) {
        // Replace with your crash reporter (Sentry, Bugsnag, etc.) when available.
        if (__DEV__) {
            console.error(
                `[MainNavigator] Screen "${this.props.screenName}" threw at runtime:`,
                error,
                info?.componentStack
            );
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorTitle}>⚠️ Something went wrong</Text>
                    <Text style={styles.errorBody}>
                        Screen <Text style={styles.errorBold}>{this.props.screenName}</Text> crashed.
                    </Text>
                    {__DEV__ && (
                        <Text style={styles.errorHint}>{this.state.errorMessage}</Text>
                    )}
                </View>
            );
        }
        return this.props.children;
    }
}

// ─────────────────────────────────────────────────────────────
// Component resolver — gracefully degrades unknown/broken imports
// ─────────────────────────────────────────────────────────────

/**
 * Resolves a module to a valid React component.
 * Returns a FailedScreen placeholder (with __failed marker) if resolution fails,
 * allowing the app to stay running while surfacing the load error.
 *
 * @param {any}    Comp       - The imported module (function, { default }, or broken)
 * @param {string} screenName - Human-readable name used in error UI and dev warnings
 * @returns {React.ComponentType}
 */
const resolveComponent = (Comp, screenName) => {
    if (typeof Comp === 'function') return Comp;
    if (Comp && typeof Comp.default === 'function') return Comp.default;

    const FailedScreen = () => (
        <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>⚠️ Screen Load Error</Text>
            <Text style={styles.errorBody}>
                Failed to load: <Text style={styles.errorBold}>{screenName}</Text>
            </Text>
            <Text style={styles.errorHint}>
                This usually means the screen file has a syntax error or a missing dependency.
            </Text>
        </View>
    );
    FailedScreen.__failed = true;
    FailedScreen.displayName = `FailedScreen(${screenName})`;
    return FailedScreen;
};

// ─────────────────────────────────────────────────────────────
// Tab registry — single source of truth for all valid tab names.
// Export VALID_TABS so callers can reference tab names without
// hardcoding magic strings (eliminates typo-prone duplication).
// ─────────────────────────────────────────────────────────────

/** All valid tab identifiers. Use these constants instead of string literals. */
export const VALID_TABS = Object.freeze({
    HOME:       'Home',
    TRIBES:     'Tribes',
    EXPLORE:    'Explore',
    ARENA:      'Arena',
    MESSAGES:   'Messages',
    ALERTS:     'Alerts',
    PROFILE:    'Profile',
    BOT_STUDIO: 'BotStudio',
});

// Built once at module init — resolveComponent handles broken imports gracefully.
const SCREEN_MAP = {
    [VALID_TABS.HOME]:       resolveComponent(HomeScreen,      VALID_TABS.HOME),
    [VALID_TABS.TRIBES]:     resolveComponent(TribesScreen,    VALID_TABS.TRIBES),
    [VALID_TABS.EXPLORE]:    resolveComponent(ExploreScreen,   VALID_TABS.EXPLORE),
    [VALID_TABS.ARENA]:      resolveComponent(ArenaScreen,     VALID_TABS.ARENA),
    [VALID_TABS.MESSAGES]:   resolveComponent(MessagesScreen,  VALID_TABS.MESSAGES),
    [VALID_TABS.ALERTS]:     resolveComponent(AlertsScreen,    VALID_TABS.ALERTS),
    [VALID_TABS.PROFILE]:    resolveComponent(ProfileScreen,   VALID_TABS.PROFILE),
    [VALID_TABS.BOT_STUDIO]: resolveComponent(BotStudioScreen, VALID_TABS.BOT_STUDIO),
};

// Deduplicate dev warnings per unknown tab name across the session.
const warnedTabs = new Set();

// ─────────────────────────────────────────────────────────────
// MainNavigator
// ─────────────────────────────────────────────────────────────

function MainNavigator(props) {
    // [FIX MEDIUM] Destructure `tab` out before spreading to child screens.
    // Passing `tab` (a MainNavigator-internal prop) into screens pollutes their
    // prop namespace and can cause React strict-mode warnings on unknown props.
    const { tab, ...screenProps } = props;

    if (SCREEN_MAP[VALID_TABS.HOME]?.__failed) {
        console.error('[MainNavigator] CRITICAL: Home screen failed to load.');
        const Failed = SCREEN_MAP[VALID_TABS.HOME];
        return <Failed />;
    }

    const screenName  = SCREEN_MAP[tab] ? tab : VALID_TABS.HOME;
    const CurrentScreen = SCREEN_MAP[tab] || SCREEN_MAP[VALID_TABS.HOME];

    if (__DEV__ && tab && !SCREEN_MAP[tab] && !warnedTabs.has(tab)) {
        warnedTabs.add(tab);
        console.warn(
            `[MainNavigator] Unknown tab "${tab}". ` +
            `Falling back to Home. Valid tabs: ${Object.values(VALID_TABS).join(', ')}`
        );
    }

    // [FIX HIGH] ScreenErrorBoundary isolates runtime screen crashes.
    // A thrown error inside CurrentScreen is caught here and shown as an
    // in-place error UI — the rest of the app (modals, nav bar, etc.) keeps running.
    return (
        <ScreenErrorBoundary screenName={screenName}>
            <CurrentScreen {...screenProps} />
        </ScreenErrorBoundary>
    );
}

MainNavigator.displayName = 'MainNavigator';

export default memo(MainNavigator);

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    errorContainer: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
        backgroundColor: '#FFF5F5', padding: 24,
    },
    errorTitle: {
        fontSize: 20, fontWeight: 'bold', color: '#C62828', marginBottom: 12,
    },
    errorBody: {
        fontSize: 16, color: '#721c24', textAlign: 'center', marginBottom: 8,
    },
    errorBold: { fontWeight: 'bold' },
    errorHint: {
        fontSize: 13, color: '#999', textAlign: 'center', marginTop: 12,
    },
});