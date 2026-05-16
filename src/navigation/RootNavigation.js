// client/src/navigation/RootNavigation.js
// ⭐️ PRODUCTION GRADE v2: Safer global navigation with explicit dev warnings ⭐️
//
// IMPORTANT NOTE FOR FUTURE DEVELOPERS:
// This file is part of React Navigation's API. For it to work, the app must
// wrap its root in a <NavigationContainer ref={navigationRef}> component.
//
// Currently, KliqTap uses a prop-based navigation system (see MainNavigator.js
// + AppRoot.js's `tab` state). React Navigation is NOT wired up yet.
//
// Calls to navigateGlobal() will safely no-op until NavigationContainer is added.
// In dev mode, the first failed call logs a clear warning so the silent
// failure is visible during development.
//
// To enable: wrap AppRoot's root view with:
//   import { NavigationContainer } from '@react-navigation/native';
//   import { navigationRef } from './navigation/RootNavigation';
//   <NavigationContainer ref={navigationRef}> ... </NavigationContainer>

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

// Dedupe warnings so dev console doesn't get spammed.
let hasWarnedAboutMissingContainer = false;

/**
 * Navigates from anywhere in the app — including modals, services, and stores.
 * Safely no-ops (with a dev warning) if NavigationContainer is not mounted.
 *
 * @param {string} name - Route name to navigate to
 * @param {object} [params] - Optional route params
 * @returns {boolean} true if navigation succeeded, false otherwise
 */
  export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
    return true;
  }

  // Surface the silent failure in dev mode only.
  if (__DEV__ && !hasWarnedAboutMissingContainer) {
    hasWarnedAboutMissingContainer = true;
    console.warn(
      '[RootNavigation] navigateGlobal() called but NavigationContainer is not mounted. ' +
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
  return false;
}