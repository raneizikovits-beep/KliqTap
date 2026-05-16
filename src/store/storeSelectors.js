// client/src/store/storeSelectors.js
// ⭐️ Optimized atomic selectors — eliminates the re-render storm. ⭐️
//
// PROBLEM: 11 of 12 screens currently destructure the whole store, like:
//
//     const { user, posts, refreshAllData } = useAppStore();
//
// This subscribes the component to *every* state change. On a single chat-message
// arrival the entire screen re-renders, even if nothing visible changed.
//
// SOLUTION: This module exposes pre-built atomic hooks. Each subscribes to a single
// slice and uses strict equality (Zustand default), so re-renders only happen when
// that specific value changes.
//
// USAGE:
//
//     // Before (re-renders on any state change):
//     const { user, refreshAllData } = useAppStore();
//
//     // After (re-renders only when user changes; refreshAllData is stable):
//     const user = useUser();
//     const refreshAllData = useAction('refreshAllData');
//
//     // For multiple related fields, use useShallow directly:
//     import { useShallow } from 'zustand/react/shallow';
//     const { user, points, streak } = useAppStore(useShallow(s => ({
//         user: s.user, points: s.points, streak: s.streak
//     })));
//
// MIGRATION: Drop-in. Existing code keeps working; convert screen-by-screen.

import { useAppStore } from './useAppStore';

// --- Auth -----------------------------------------------------------------
export const useUser            = () => useAppStore(s => s.user);
export const useToken           = () => useAppStore(s => s.token);
export const useIsInitialized   = () => useAppStore(s => s.isInitialized);
export const useIsAuthLoading   = () => useAppStore(s => s.isAuthLoading);
export const useNeedsOnboarding = () => useAppStore(s => s.needsOnboarding);

// --- Settings & theme -----------------------------------------------------
export const useUserSettings    = () => useAppStore(s => s.userSettings);
export const useIsDarkMode      = () => useAppStore(s => s.userSettings?.darkMode === true);

// --- Gamification ---------------------------------------------------------
export const usePoints          = () => useAppStore(s => s.points);
export const useStreak          = () => useAppStore(s => s.streak);
export const useBadges          = () => useAppStore(s => s.badges);

// --- Social ---------------------------------------------------------------
export const usePosts           = () => useAppStore(s => s.posts);
export const useIsPostsLoading  = () => useAppStore(s => s.isPostsLoading);
export const useGroups          = () => useAppStore(s => s.groups);
export const useIsGroupsLoading = () => useAppStore(s => s.isGroupsLoading);
export const usePulses          = () => useAppStore(s => s.pulses);

// --- Chat -----------------------------------------------------------------
export const useChatHistory     = () => useAppStore(s => s.chatHistory);
export const useChatMetadata    = () => useAppStore(s => s.chatMetadata);
export const useCurrentChatId   = () => useAppStore(s => s.currentChatId);

// --- Notifications --------------------------------------------------------
export const useNotifications   = () => useAppStore(s => s.notifications);
export const useIsNotificationsLoading = () => useAppStore(s => s.isNotificationsLoading);

// --- Location -------------------------------------------------------------
export const useUserLocation    = () => useAppStore(s => s.userLocation);

// --- Action accessor ------------------------------------------------------
//
// Zustand actions are stable references (assigned once on store creation).
// We expose them through this single hook so screens don't accidentally
// destructure them from state and trigger needless renders.
//
// Usage: const refreshAllData = useAction('refreshAllData');
//
export const useAction = (name) => useAppStore(s => s[name]);

// --- Multi-field shortcut --------------------------------------------------
//
// For the common case of "I need user + a few actions", export a curated
// shallow selector so screens don't have to import useShallow everywhere.
//
// Usage:
//   const { user, logout, award } = useAuthBundle();
//
import { useShallow } from 'zustand/react/shallow';

export const useAuthBundle = () => useAppStore(useShallow(s => ({
  user: s.user,
  token: s.token,
  logout: s.logout,
  award: s.award,
  isAuthLoading: s.isAuthLoading,
})));

export const useThemeBundle = () => useAppStore(useShallow(s => ({
  isDark: s.userSettings?.darkMode === true,
  userSettings: s.userSettings,
  updateSetting: s.updateSetting,
})));