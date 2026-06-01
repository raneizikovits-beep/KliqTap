// client/src/navigation/MainNavigator.js
// ⭐️ PRODUCTION GRADE v3: Hardened component resolution + dev-mode warnings ⭐️

import React, { memo } from 'react';
import { Text, View, StyleSheet } from 'react-native'; 

// --- Screen Imports ---
import HomeScreen from '../screens/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen';
import MessagesScreen from '../screens/MessagesScreen';
import AlertsScreen from '../screens/AlertsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import BotStudioScreen from '../screens/BotStudioScreen'; 
import TribesScreen from '../screens/TribesScreen';
import ArenaScreen from '../screens/ArenaScreen'; // ✅ נוסף

/**
 * Resolves a module to a valid React component.
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

// --- Component Map ---
const SCREEN_MAP = {
    Home:      resolveComponent(HomeScreen,        'Home'),
    Tribes:    resolveComponent(TribesScreen,      'Tribes'),
    Explore:   resolveComponent(ExploreScreen,     'Explore'),
    Arena:     resolveComponent(ArenaScreen,       'Arena'),     // ✅ נוסף
    Messages:  resolveComponent(MessagesScreen,    'Messages'),
    Alerts:    resolveComponent(AlertsScreen,      'Alerts'),
    Profile:   resolveComponent(ProfileScreen,     'Profile'),
    BotStudio: resolveComponent(BotStudioScreen,   'BotStudio'),
};

const warnedTabs = new Set();

function MainNavigator(props) {
  const { tab } = props;
  
  if (SCREEN_MAP.Home?.__failed) {
      console.error("[MainNavigator] CRITICAL: Home screen failed to load.");
      const Failed = SCREEN_MAP.Home;
      return <Failed />;
  }

  const CurrentScreen = SCREEN_MAP[tab] || SCREEN_MAP.Home;

  if (__DEV__ && tab && !SCREEN_MAP[tab] && !warnedTabs.has(tab)) {
      warnedTabs.add(tab);
      console.warn(
          `[MainNavigator] Unknown tab "${tab}". ` +
          `Falling back to Home. Valid tabs: ${Object.keys(SCREEN_MAP).join(', ')}`
      );
  }

  return <CurrentScreen {...props} />;
}

MainNavigator.displayName = 'MainNavigator';

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