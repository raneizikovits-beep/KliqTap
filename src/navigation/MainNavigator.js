// client/src/navigation/MainNavigator.js
// ⭐️ PRODUCTION GRADE v3: Hardened component resolution + dev-mode warnings ⭐️
//
// Improvements over previous version:
//   [FIX-1] Proper "module failed to load" detection (was always passing)
//   [FIX-2] Dev-mode console warning when an unknown tab is requested
//   [FIX-3] Removed unused 'Support' entry from SCREEN_MAP (dead code —
//           Support is opened as a modal sheet, not as a tab)
//   [FIX-4] More descriptive error UI for failed screen loads
//   [FIX-5] displayName for better React DevTools experience

import React, { memo } from 'react';
import { Text, View, StyleSheet } from 'react-native'; 

// --- Screen Imports ---
import HomeScreen from '../screens/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen';
import MessagesScreen from '../screens/MessagesScreen';
import AlertsScreen from '../screens/AlertsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BotStudioScreen from '../screens/BotStudioScreen'; 
import TribesScreen from '../screens/TribesScreen'; // ⭐️ הייבוא הנכון של השבטים

/**
 * Resolves a module to a valid React component.
 * Handles CommonJS / ES Modules / default-export discrepancies.
 * Marks the returned function with __failed = true if resolution fails,
 * so callers can detect failures (instead of silently passing a truthy check).
 */
const resolveComponent = (Comp, screenName) => {
    if (typeof Comp === 'function') return Comp;
    if (Comp && typeof Comp.default === 'function') return Comp.default;
    
    // [FIX-1][FIX-4] Return a clearly-marked failure component
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

// --- Component Map ---
// [FIX-3] Removed 'Support' — it's opened as a modal sheet from AppModals,
// not as a top-level tab. Including it here was dead code.
const SCREEN_MAP = {
    Home:     resolveComponent(HomeScreen,     'Home'),
    Tribes:   resolveComponent(TribesScreen,   'Tribes'), // ⭐️ הותאם ל-TabBar ⭐️
    Explore:  resolveComponent(ExploreScreen,  'Explore'),
    Messages: resolveComponent(MessagesScreen, 'Messages'),
    Alerts:   resolveComponent(AlertsScreen,   'Alerts'),
    Profile:  resolveComponent(ProfileScreen,  'Profile'),
    BotStudio: resolveComponent(BotStudioScreen, 'BotStudio'),
};

// [FIX-2] Track which unknown tabs have already been warned about,
// so dev-mode logs don't spam on every re-render.
const warnedTabs = new Set();

function MainNavigator(props) {
  const { tab } = props;
  
  // [FIX-1] Real critical-failure check: detect if Home itself failed to load.
  // Previously this branch was effectively unreachable because the old fallback
  // was always a valid function and passed truthy checks.
  if (SCREEN_MAP.Home?.__failed) {
      console.error("[MainNavigator] CRITICAL: Home screen failed to load. App cannot recover.");
      const Failed = SCREEN_MAP.Home;
      return <Failed />;
  }

  // Resolve the requested tab, with Home as the default fallback.
  const CurrentScreen = SCREEN_MAP[tab] || SCREEN_MAP.Home;

  // [FIX-2] Dev-mode warning when an unrecognized tab is passed in.
  // Helps catch typos early. Production builds skip this entirely.
  if (__DEV__ && tab && !SCREEN_MAP[tab] && !warnedTabs.has(tab)) {
      warnedTabs.add(tab);
      console.warn(
          `[MainNavigator] Unknown tab "${tab}". ` +
          `Falling back to Home. Valid tabs: ${Object.keys(SCREEN_MAP).join(', ')}`
      );
  }

  return <CurrentScreen {...props} />;
}

// [FIX-5] Better DevTools display name
MainNavigator.displayName = 'MainNavigator';

// React.memo prevents the entire screen stack from re-rendering
// when the parent's state changes without altering the tab or essential props.
export default memo(MainNavigator);

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