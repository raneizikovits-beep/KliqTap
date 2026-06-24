// client/src/navigation/RootNavigation.js
// ⭐️ PRODUCTION GRADE v3: Symmetrical warnings + getCurrentRoute utility ⭐️
//
// [V3 CHANGES — Engineering Audit Fixes]:
//   • [FIX LOW]    navigate() / goBack() function indentation corrected (was 2 leading
//                  spaces on export keyword — cosmetic but violated code quality).
//   • [FIX LOW]    navigate() warning message fixed: said "navigateGlobal()" but the
//                  function is named "navigate()". Stale copy from a prior rename.
//   • [FIX LOW]    goBack() now emits a symmetrical dev warning when NavigationContainer
//                  is not mounted. navigate() warned; goBack() was silently failing.
//   • [NEW]        getCurrentRoute() added — standard utility needed for analytics,
//                  conditional back-navigation, and deep-link guards.
//
// IMPORTANT NOTE FOR FUTURE DEVELOPERS:
// This file is part of React Navigation's API. For it to work, the app must
// wrap its root in a <NavigationContainer ref={navigationRef}> component.
//
// Currently, KliqTap uses a prop-based navigation system (see MainNavigator.js
// + AppRoot.js's `tab` state). React Navigation is NOT wired up yet.
//
// Calls to navigate() / goBack() will safely no-op until NavigationContainer
// is added. In dev mode, the first failed call logs a clear warning so the
// silent failure is visible during development.
//
// To enable: wrap AppRoot's root view with:
//   import { NavigationContainer } from '@react-navigation/native';
//   import { navigationRef } from './navigation/RootNavigation';
//   <NavigationContainer ref={navigationRef}> ... </NavigationContainer>

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

// Dedupe warnings so the dev console doesn't get spammed.
// One warning per function per session is enough to surface the missing container.
let hasWarnedNavigate = false;
let hasWarnedGoBack   = false;

/**
 * Navigates from anywhere in the app — including modals, services, and stores.
 * Safely no-ops (with a one-time dev warning) if NavigationContainer is not mounted.
 *
 * @param {string} name     - Route name to navigate to
 * @param {object} [params] - Optional route params
 * @returns {boolean} true if navigation succeeded, false otherwise
 */
export function navigate(name, params) {
    if (navigationRef.isReady()) {
        navigationRef.navigate(name, params);
        return true;
    }

    // Surface the silent failure in dev mode only — once per session.
    if (__DEV__ && !hasWarnedNavigate) {
        hasWarnedNavigate = true;
        console.warn(
            '[RootNavigation] navigate() called but NavigationContainer is not mounted. ' +
            'Currently KliqTap uses prop-based navigation via MainNavigator. ' +
            'To enable global navigation, wrap AppRoot with <NavigationContainer ref={navigationRef}>.'
        );
    }
    return false;
}

/**
 * Goes back one screen, if possible.
 * Safely no-ops if NavigationContainer is not mounted or there's no back history.
 *
 * @returns {boolean} true if went back, false otherwise
 */
export function goBack() {
    if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
        return true;
    }

    // [FIX LOW] Symmetrical dev warning: navigate() warned on missing container;
    // goBack() was silently returning false with no feedback to the developer.
    if (__DEV__ && !navigationRef.isReady() && !hasWarnedGoBack) {
        hasWarnedGoBack = true;
        console.warn(
            '[RootNavigation] goBack() called but NavigationContainer is not mounted. ' +
            'To enable global navigation, wrap AppRoot with <NavigationContainer ref={navigationRef}>.'
        );
    }
    return false;
}

/**
 * Returns the currently active route name, or null if the container is not ready.
 * Useful for analytics events, conditional back-navigation logic, and deep-link guards.
 *
 * @returns {string|null} Current route name, or null
 */
export function getCurrentRoute() {
    if (navigationRef.isReady()) {
        return navigationRef.getCurrentRoute()?.name ?? null;
    }
    return null;
}