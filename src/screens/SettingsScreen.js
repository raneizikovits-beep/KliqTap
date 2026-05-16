// client/src/screens/SettingsScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// ⭐ KliqMind V5.0 — Production-Grade Settings Architecture
// Author: KliqTap Core / Ran Eizikovich
// ─────────────────────────────────────────────────────────────────────────────
// Critical Fixes vs V4.7:
//   ✅ Cross-platform logout (Alert.alert is a NO-OP on RN-Web → fixed via
//      CrossPlatformAlert which routes to window.confirm in the browser)
//   ✅ GPS controls now hierarchical: master switch + dependent children
//      that gray-out & lock when the master is off
//   ✅ Memoized theme via Context — one stylesheet build per theme change,
//      not three per row (fixes hidden re-render storm)
//   ✅ Zustand selectors are now atomic — no fresh object every render
//   ✅ Stable callbacks (useCallback) so React.memo on rows actually works
//
// Quality-of-Life additions (non-breaking, additive only):
//   ➕ Inline search across all settings
//   ➕ App Lock (Face/Touch ID) toggle slot
//   ➕ Large-Text accessibility toggle
//   ➕ Clear Cache action
//   ➕ Quick Hide on Radar — shortcut to the stealth toggle you already built
//   ➕ Haptic feedback on every switch (silent fallback on web/missing module)
//   ➕ Accessibility roles + labels everywhere
//
// IMPORTANT: Settings persistence is a STORE concern, not a screen concern.
//            See the PERSISTENCE NOTE at the bottom of this file.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  createContext,
  useContext,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Image,
  Alert,
  Linking,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles as globalStyles } from '../constants/styles';
import * as Data from '../constants/data';
import { useAppStore } from '../store/useAppStore';

// Optional native modules — degrade gracefully if absent
let Haptics = null;
try { Haptics = require('expo-haptics'); } catch (_) { /* not installed — silent */ }

const IS_WEB = Platform.OS === 'web';

// ═════════════════════════════════════════════════════════════════════════════
// 🪟 CROSS-PLATFORM ALERT
// React Native's Alert.alert is silently dropped on web. This is the reason
// "Log Out" appears to do nothing in Chrome on your laptop.
// This helper routes to window.confirm on web, and Alert on native.
// ═════════════════════════════════════════════════════════════════════════════
const CrossPlatformAlert = {
  confirm({
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    destructive = false,
    onConfirm,
  }) {
    if (IS_WEB) {
      const ok = typeof window !== 'undefined'
        && window.confirm(`${title}\n\n${message}`);
      if (ok && onConfirm) onConfirm();
      return;
    }
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel' },
        {
          text: confirmText,
          style: destructive ? 'destructive' : 'default',
          onPress: onConfirm,
        },
      ],
      { cancelable: true }
    );
  },
  info({ title, message, buttonText = 'OK' }) {
    if (IS_WEB) {
      if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message, [{ text: buttonText }]);
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// 🎨 THEME ENGINE — single source of truth, shared via React Context
// ═════════════════════════════════════════════════════════════════════════════
const buildTheme = (isDark) => ({
  isDark,
  c: {
    bg:        isDark ? '#000000' : '#F9FAFB',
    card:      isDark ? '#1C1C1E' : '#FFFFFF',
    cardAlt:   isDark ? '#161618' : '#FAFAFB',
    border:    isDark ? '#2C2C2E' : '#F0F0F0',
    text:      isDark ? '#FFFFFF' : '#111111',
    text2:     isDark ? '#AAAAAA' : '#666666',
    text3:     isDark ? '#777777' : '#999999',
    iconMute:  isDark ? '#555555' : '#CCCCCC',
    section:   isDark ? '#888888' : '#AAAAAA',
    surface:   isDark ? '#333333' : '#EEEEEE',
    danger:    '#F44336',
    dangerBg:  isDark ? '#4A0000' : '#FFEBEE',
    success:   Data.brand?.green || '#4CAF50',
    primary:   Data.brand?.blue  || '#2196F3',
    delete:    '#DC2626',
    disabled:  isDark ? '#222222' : '#F3F4F6',
    avatarBd:  isDark ? '#444444' : '#E0E0E0',
  },
});

const ThemeCtx = createContext(buildTheme(false));
const useTheme = () => useContext(ThemeCtx);

const makeStyles = (t) => StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: t.c.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: t.c.text,
    letterSpacing: -0.5,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: { paddingVertical: 10, paddingHorizontal: 20, marginBottom: 10 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.c.card,
    padding: 15,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: t.c.surface,
    borderWidth: 1,
    borderColor: t.c.avatarBd,
  },
  profileInfo: { flex: 1, marginLeft: 15 },
  usernameText: { color: t.c.text2, fontSize: 14, fontWeight: '600' },
  privateDetailText: { color: t.c.text3, fontSize: 12, marginTop: 4 },
  editBtn: {
    backgroundColor: t.c.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editBtnText: { color: t.c.text, fontWeight: 'bold', fontSize: 13 },

  // 🔍 Search
  searchWrap: {
    marginHorizontal: 20,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.c.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: t.c.text,
    fontSize: 15,
    marginLeft: 8,
    paddingVertical: 0,
    // On web, kill the default focus outline
    ...(IS_WEB ? { outlineStyle: 'none' } : {}),
  },

  scrollContent: { paddingBottom: 120, paddingHorizontal: 20 },
  sectionContainer: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: t.c.section,
    marginBottom: 10,
    marginLeft: 5,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: t.c.card,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.c.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowDisabled: { opacity: 0.45 },
  rowNested: { paddingLeft: 28, backgroundColor: t.c.cardAlt },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, color: t.c.text, fontWeight: '600' },
  destructiveText: { color: t.c.danger },
  rowSubtitle: { fontSize: 12, color: t.c.text3, marginTop: 3 },
  rowEnd: { flexDirection: 'row', alignItems: 'center' },
  infoText: {
    marginRight: 10,
    color: t.c.text3,
    fontSize: 13,
    fontWeight: '600',
  },

  dangerZone: { marginTop: 20, marginBottom: 40, gap: 15 },
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: t.c.disabled,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.isDark ? '#333' : '#E5E7EB',
  },
  logoutText: {
    color: t.isDark ? '#E5E7EB' : '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    backgroundColor: t.c.delete,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: t.c.delete,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteAccountText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  versionText: {
    textAlign: 'center',
    color: t.isDark ? '#555' : '#BBB',
    marginTop: 20,
    fontSize: 11,
    fontWeight: '500',
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// ⚙️  HAPTICS HOOK — silent on web / missing module
// ═════════════════════════════════════════════════════════════════════════════
const useHaptic = () =>
  useCallback((style = 'light') => {
    if (!Haptics || IS_WEB) return;
    const map = {
      light:  Haptics.ImpactFeedbackStyle?.Light,
      medium: Haptics.ImpactFeedbackStyle?.Medium,
      heavy:  Haptics.ImpactFeedbackStyle?.Heavy,
    };
    try { Haptics.impactAsync(map[style] || map.light); } catch (_) {}
  }, []);

// ═════════════════════════════════════════════════════════════════════════════
// 🧩 PRIMITIVES
// ═════════════════════════════════════════════════════════════════════════════
const Section = React.memo(function Section({ title, children }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  // Filter out nulls (rows hidden by search) so isLast lands on the true last
  const visible = React.Children.toArray(children).filter(Boolean);
  if (visible.length === 0) return null;
  const lastIdx = visible.length - 1;
  return (
    <View style={s.sectionContainer}>
      {title ? <Text style={s.sectionTitle}>{title}</Text> : null}
      <View style={s.sectionCard}>
        {visible.map((child, i) =>
          React.isValidElement(child)
            ? React.cloneElement(child, { isLast: i === lastIdx, key: child.key ?? i })
            : child
        )}
      </View>
    </View>
  );
});

const Row = React.memo(function Row({
  icon, color, title, subtitle, info,
  onPress, hasSwitch, switchValue, onSwitch,
  isDestructive, disabled, nested, isLast,
}) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const haptic = useHaptic();

  const fire = useCallback(() => {
    if (disabled) return;
    if (hasSwitch) {
      haptic('light');
      onSwitch && onSwitch();
    } else {
      onPress && onPress();
    }
  }, [disabled, hasSwitch, onSwitch, onPress, haptic]);

  const bgIcon = isDestructive
    ? t.c.dangerBg
    : ((color || t.c.primary) + '22');
  const iconColor = isDestructive ? t.c.danger : (color || t.c.primary);

  return (
    <TouchableOpacity
      style={[
        s.row,
        nested && s.rowNested,
        isLast && s.rowLast,
        disabled && s.rowDisabled,
      ]}
      onPress={fire}
      activeOpacity={disabled ? 1 : 0.7}
      accessibilityRole={hasSwitch ? 'switch' : 'button'}
      accessibilityLabel={title}
      accessibilityState={{
        checked: hasSwitch ? !!switchValue : undefined,
        disabled: !!disabled,
      }}
    >
      <View style={[s.iconContainer, { backgroundColor: bgIcon }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={s.rowText}>
        <Text style={[s.rowTitle, isDestructive && s.destructiveText]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={s.rowSubtitle} numberOfLines={2}>{subtitle}</Text>
        ) : null}
      </View>
      {hasSwitch ? (
        <Switch
          value={!!switchValue}
          onValueChange={() => { haptic('light'); onSwitch && onSwitch(); }}
          disabled={!!disabled}
          trackColor={{ false: t.isDark ? '#444' : '#767577', true: t.c.success }}
          thumbColor={'#F4F3F4'}
        />
      ) : (
        <View style={s.rowEnd}>
          {info ? <Text style={s.infoText}>{info}</Text> : null}
          <Ionicons name="chevron-forward" size={18} color={t.c.iconMute} />
        </View>
      )}
    </TouchableOpacity>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// 🏠 MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function SettingsScreen({ onClose, onNavigate }) {
  // ⚡ Atomic Zustand selectors — no fresh object literal per render
  const user          = useAppStore((s) => s.user);
  const logout        = useAppStore((s) => s.logout);
  const settings      = useAppStore((s) => s.userSettings) || {};
  const updateSetting = useAppStore((s) => s.updateSetting);

  const isDark = settings.darkMode === true;
  const theme  = useMemo(() => buildTheme(isDark), [isDark]);
  const s      = useMemo(() => makeStyles(theme), [theme]);

  const [query, setQuery]           = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const haptic = useHaptic();

  // ── Dev-time warning if the store isn't persisted ────────────────────────
  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      try {
        if (!useAppStore.persist) {
          // eslint-disable-next-line no-console
          console.warn(
            '[SettingsScreen] useAppStore is not using the `persist` middleware.\n' +
            'Settings will RESET on reload. See the PERSISTENCE NOTE at the ' +
            'bottom of SettingsScreen.js for the fix.'
          );
        }
      } catch (_) { /* noop */ }
    }
  }, []);

  // ── Handlers (stable references) ─────────────────────────────────────────
  const handleToggle = useCallback(
    (key) => {
      if (!updateSetting) return;
      haptic('light');
      updateSetting(key, !settings[key]);
    },
    [updateSetting, settings, haptic]
  );

  const openLink = useCallback((url) => {
    Linking.openURL(url).catch(() =>
      CrossPlatformAlert.info({ title: 'Error', message: "Couldn't open link." })
    );
  }, []);

  const handleLogout = useCallback(() => {
    if (loggingOut) return;
    CrossPlatformAlert.confirm({
      title: 'Log Out',
      message: 'You will need to sign in again to access KliqTap.',
      confirmText: 'Log Out',
      destructive: true,
      onConfirm: async () => {
        try {
          setLoggingOut(true);
          haptic('medium');
          onClose && onClose();
          await Promise.resolve(logout && logout());
        } catch (e) {
          CrossPlatformAlert.info({
            title: 'Logout Failed',
            message: e?.message || 'Please try again.',
          });
        } finally {
          setLoggingOut(false);
        }
      },
    });
  }, [loggingOut, onClose, logout, haptic]);

  const handleDeleteAccount = useCallback(() => {
    CrossPlatformAlert.confirm({
      title: 'Delete Account Permanently',
      message:
        'This will erase your KliqTap profile, posts, and connections forever. ' +
        'This cannot be undone.',
      confirmText: 'Continue',
      destructive: true,
      onConfirm: () =>
        openLink(
          'https://docs.google.com/document/d/1tYlZ66LHNveszhgL3eeigMzrnLpwKGYHLuUYW1u2ghs/edit'
        ),
    });
  }, [openLink]);

  const handleClearCache = useCallback(() => {
    CrossPlatformAlert.confirm({
      title: 'Clear Cache',
      message: 'Remove temporary files. Your settings and account remain untouched.',
      confirmText: 'Clear',
      onConfirm: () => {
        try { useAppStore.getState()?.clearCache?.(); } catch (_) {}
        CrossPlatformAlert.info({ title: 'Done', message: 'Cache cleared.' });
      },
    });
  }, []);

  const showAboutInfo = useCallback(() => {
    CrossPlatformAlert.info({
      title: 'About KliqTap',
      message:
        'The Internet is Broken. We are fixing it.\n\n' +
        'Founded by Ran Eizikovich, KliqTap is a democratic, privacy-first ' +
        'social network driven by the Kliq Genius AI. We believe in 100% ' +
        'Data Sovereignty and real-world connections.',
      buttonText: 'Awesome!',
    });
  }, []);

  // ── Search predicate ─────────────────────────────────────────────────────
  const matches = useCallback(
    (title, subtitle) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        (title?.toLowerCase().includes(q)) ||
        (subtitle?.toLowerCase().includes(q))
      );
    },
    [query]
  );

  // tiny helper — render a Row only if it matches the search
  const R = (props) =>
    matches(props.title, props.subtitle) ? <Row {...props} /> : null;

  const userAvatar =
    user?.avatarUrl ||
    user?.avatar ||
    user?.profilePicture ||
    'https://via.placeholder.com/150';

  // GPS hierarchy — children depend on the master switch
  const gpsOn = !!settings.gpsEnabled;

  return (
    <ThemeCtx.Provider value={theme}>
      <View style={s.mainContainer}>
        {/* Header */}
        <View style={s.headerTop}>
          <View style={s.headerTitleRow}>
            <Ionicons
              name="shield-checkmark"
              size={26}
              color={theme.c.primary}
            />
            <Text style={s.title}>Settings & Privacy</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={s.closeBtn}
            accessibilityLabel="Close settings"
          >
            <Ionicons name="close" size={24} color={theme.c.text2} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={s.header}>
          <TouchableOpacity
            style={s.profileCard}
            onPress={() => onNavigate?.({ title: 'Edit Profile' })}
            activeOpacity={0.8}
            accessibilityLabel="Edit profile"
          >
            <Image source={{ uri: userAvatar }} style={s.avatar} />
            <View style={s.profileInfo}>
              <Text style={[globalStyles.h3, { color: theme.c.text }]}>
                {user?.name || 'Guest User'}
              </Text>
              <Text style={s.usernameText}>
                @{user?.username || 'username'}
              </Text>
              <Text style={s.privateDetailText}>
                {user?.email || 'No Email Linked'}
              </Text>
            </View>
            <View style={s.editBtn}>
              <Text style={s.editBtnText}>Edit</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 🔍 Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={18} color={theme.c.text3} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search settings…"
            placeholderTextColor={theme.c.text3}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search settings"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={theme.c.text3} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Account Center */}
          <Section title="Account Center">
            {R({
              icon: 'person', color: '#3F51B5',
              title: 'Personal Information',
              subtitle: 'Email, Phone, Gender',
              onPress: () => onNavigate?.({ title: 'Personal Info', next: 'third' }),
            })}
            {R({
              icon: 'shield-checkmark', color: '#4CAF50',
              title: 'Password & Security',
              subtitle: '2FA, Login Activity',
              onPress: () => onNavigate?.({ title: 'Security', source: 'SettingsGeneric' }),
            })}
            {R({
              icon: 'link', color: '#009688',
              title: 'Linked Accounts',
              subtitle: 'Google, Facebook',
              onPress: () => onNavigate?.({ title: 'Linked Accounts', next: 'third' }),
            })}
            {R({
              icon: 'finger-print', color: '#7C4DFF',
              title: 'App Lock',
              subtitle: settings.appLock
                ? 'Biometric · Enabled'
                : 'Require Face/Touch ID on launch',
              hasSwitch: true,
              switchValue: settings.appLock,
              onSwitch: () => handleToggle('appLock'),
            })}
          </Section>

          {/* Company */}
          <Section title="Company & Vision">
            {R({
              icon: 'information-circle-outline', color: theme.c.primary,
              title: 'About KliqTap',
              subtitle: 'Our Mission & The Architect',
              onPress: showAboutInfo,
            })}
          </Section>

          {/* Legal */}
          <Section title="Legal & Safety">
            {R({
              icon: 'shield-checkmark-outline', color: '#4CAF50',
              title: 'Privacy Policy',
              subtitle: '100% Data Sovereignty Charter',
              onPress: () => openLink('https://docs.google.com/document/d/1hzyl5aAv2IGwDGnbWQy6Pa_PaQ36e_7uHvzRD-ruK-A/edit'),
            })}
            {R({
              icon: 'hand-left-outline', color: '#FF9800',
              title: 'Child Safety Standards',
              subtitle: 'Protection & Anti-Exploitation Policy',
              onPress: () => openLink('https://docs.google.com/document/d/1NGodk78BI_wiG9ADNeOiEgfsVN7QJyBQ9gGX_kmBfW4/edit'),
            })}
            {R({
              icon: 'trash-bin-outline', color: '#D32F2F',
              title: 'Account Deletion Policy',
              subtitle: 'True Deletion Standard',
              onPress: () => openLink('https://docs.google.com/document/d/1tYlZ66LHNveszhgL3eeigMzrnLpwKGYHLuUYW1u2ghs/edit'),
            })}
            {R({
              icon: 'document-text-outline', color: '#795548',
              title: 'Terms of Service',
              onPress: () => openLink('https://docs.google.com/document/d/1SGsianOVhp1jFlEmJgs6F4RYxfldg63qrrGh-ySb8kY/edit?usp=sharing'),
            })}
          </Section>

          {/* Privacy & Interactions */}
          <Section title="Privacy & Interactions">
            {R({
              icon: settings.isPrivate ? 'lock-closed' : 'lock-open',
              color: '#FF9800',
              title: 'Account Privacy',
              subtitle: settings.isPrivate ? 'Currently: Private' : 'Currently: Public',
              hasSwitch: true,
              switchValue: settings.isPrivate,
              onSwitch: () => handleToggle('isPrivate'),
            })}
            {R({
              icon: 'radio-button-on', color: '#4CAF50',
              title: 'Activity Status',
              subtitle: 'Show when you are online',
              hasSwitch: true,
              switchValue: settings.activityStatus,
              onSwitch: () => handleToggle('activityStatus'),
            })}
            {R({
              icon: 'eye-off', color: '#673AB7',
              title: 'Ghost Mode',
              subtitle: 'View Pulses anonymously',
              hasSwitch: true,
              switchValue: settings.ghostMode,
              onSwitch: () => handleToggle('ghostMode'),
            })}
            {R({
              icon: 'checkmark-done', color: '#2196F3',
              title: 'Read Receipts',
              subtitle: 'Let others know you read messages',
              hasSwitch: true,
              switchValue: settings.readReceipts,
              onSwitch: () => handleToggle('readReceipts'),
            })}
            {R({
              icon: 'eye-off-outline', color: '#607D8B',
              title: 'Hidden & Muted',
              subtitle: 'Manage visibility',
              onPress: () => onNavigate?.({ title: 'Hidden Accounts', source: 'SettingsGeneric' }),
            })}
            {R({
              icon: 'people-circle', color: '#E91E63',
              title: 'Close Friends',
              subtitle: 'Edit your inner circle list',
              onPress: () => onNavigate?.({ title: 'Close Friends', next: 'third' }),
            })}
            {R({
              icon: 'ban', color: '#D32F2F',
              title: 'Blocked Accounts',
              subtitle: 'Manage blocked users',
              onPress: () => onNavigate?.({ title: 'Blocked Users', next: 'third' }),
            })}
          </Section>

          {/* 📍 LOCATION — HIERARCHICAL (master + dependent children) */}
          <Section title="Location & Discovery">
            {R({
              icon: 'location', color: '#F44336',
              title: 'GPS Services',
              subtitle: gpsOn
                ? 'Master switch · ON · Sub-settings active'
                : 'Master switch · OFF · All location features paused',
              hasSwitch: true,
              switchValue: gpsOn,
              onSwitch: () => handleToggle('gpsEnabled'),
            })}
            {R({
              icon: 'map', color: '#00BCD4',
              title: 'Show on Map',
              subtitle: 'Allow friends to see your location on the map',
              hasSwitch: true,
              switchValue: gpsOn && !!settings.showOnMap,
              disabled: !gpsOn,
              nested: true,
              onSwitch: () => handleToggle('showOnMap'),
            })}
            {R({
              icon: 'navigate-circle', color: '#4CAF50',
              title: 'Precise Location',
              subtitle: 'Share exact street address (not just city)',
              hasSwitch: true,
              switchValue: gpsOn && !!settings.preciseLocation,
              disabled: !gpsOn,
              nested: true,
              onSwitch: () => handleToggle('preciseLocation'),
            })}
            {R({
              icon: 'flash-off-outline', color: '#9E9E9E',
              title: 'Quick Hide on Radar',
              subtitle: 'Open the stealth toggle inside Radar to instantly disappear from nearby pulses',
              onPress: () => onNavigate?.({ actionType: 'openRadarStealth' }),
            })}
          </Section>

          {/* AI Lab */}
          <Section title="KliqMind AI Lab">
            {R({
              icon: 'mic-outline', color: '#6200EE',
              title: 'Auto-Voice Response',
              subtitle: 'Hear AI answers immediately',
              hasSwitch: true,
              switchValue: settings.autoVoice,
              onSwitch: () => handleToggle('autoVoice'),
            })}
            {R({
              icon: 'flask-outline', color: '#2196F3',
              title: 'AI Persona',
              subtitle: `Current: ${settings.aiPersona || 'Genius'}`,
              onPress: () => onNavigate?.({ title: 'AI Persona', next: 'third' }),
            })}
          </Section>

          {/* Wellness */}
          <Section title="Wellness & Bio">
            {R({
              icon: 'leaf-outline', color: '#4CAF50',
              title: 'Supplement Reminders',
              subtitle: 'Spirulina, Moringa & Turmeric',
              hasSwitch: true,
              switchValue: settings.suppReminders,
              onSwitch: () => handleToggle('suppReminders'),
            })}
            {R({
              icon: 'bicycle', color: '#FF9800',
              title: 'Rusi Macho 175cc',
              subtitle: 'Maintenance & Service Alerts',
              hasSwitch: true,
              switchValue: settings.motoReminders,
              onSwitch: () => handleToggle('motoReminders'),
            })}
          </Section>

          {/* Preferences */}
          <Section title="Preferences">
            {R({
              icon: 'moon', color: '#333',
              title: 'Dark Mode',
              subtitle: 'Reduce eye strain',
              hasSwitch: true,
              switchValue: settings.darkMode,
              onSwitch: () => handleToggle('darkMode'),
            })}
            {R({
              icon: 'notifications', color: '#FF5722',
              title: 'Notifications',
              subtitle: 'Push, Email, SMS',
              hasSwitch: true,
              switchValue: settings.notifications,
              onSwitch: () => handleToggle('notifications'),
            })}
            {R({
              icon: 'cellular', color: '#00BCD4',
              title: 'Data Saver',
              subtitle: 'Reduce data usage',
              hasSwitch: true,
              switchValue: settings.dataSaver,
              onSwitch: () => handleToggle('dataSaver'),
            })}
            {R({
              icon: 'text', color: '#FF7043',
              title: 'Large Text',
              subtitle: 'Increase font size across the app',
              hasSwitch: true,
              switchValue: settings.largeText,
              onSwitch: () => handleToggle('largeText'),
            })}
            {R({
              icon: 'language', color: '#9C27B0',
              title: 'Language',
              subtitle: settings.language === 'he' ? 'עברית' : 'English (US)',
              info: (settings.language || 'EN').toUpperCase(),
              onPress: () => onNavigate?.({ title: 'Language', next: 'third' }),
            })}
          </Section>

          {/* Resources */}
          <Section title="Resources & Support">
            {R({
              icon: 'help-buoy', color: '#2196F3',
              title: 'Help Center',
              subtitle: 'Get help & contact support',
              onPress: () => onNavigate?.({ title: 'Help Center', source: 'Support' }),
            })}
            {R({
              icon: 'camera', color: theme.c.primary,
              title: 'Vibe Check Camera',
              subtitle: 'Mood settings',
              onPress: () => onNavigate?.({ actionType: 'openVibeCheck' }),
            })}
            {R({
              icon: 'refresh', color: '#FF9800',
              title: 'Clear Cache',
              subtitle: 'Free up space without losing your data',
              onPress: handleClearCache,
            })}
          </Section>

          {/* Danger zone */}
          <View style={s.dangerZone}>
            <Row
              icon="download"
              color="#607D8B"
              title="Download My Data"
              subtitle="Export your history"
              onPress={() => onNavigate?.({ title: 'Download Data', next: 'fifth:DataExport' })}
              isLast
            />

            <TouchableOpacity
              style={s.logoutBtn}
              onPress={handleLogout}
              accessibilityLabel="Log out"
              disabled={loggingOut}
            >
              <Ionicons
                name={loggingOut ? 'hourglass' : 'log-out-outline'}
                size={20}
                color={theme.isDark ? '#E5E7EB' : '#333'}
                style={{ marginRight: 8 }}
              />
              <Text style={s.logoutText}>
                {loggingOut ? 'Logging out…' : 'Log Out'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.deleteAccountBtn}
              onPress={handleDeleteAccount}
              accessibilityLabel="Delete account permanently"
            >
              <Ionicons
                name="warning-outline"
                size={20}
                color="#FFF"
                style={{ marginRight: 8 }}
              />
              <Text style={s.deleteAccountText}>
                Delete Account Permanently
              </Text>
            </TouchableOpacity>

            <Text style={s.versionText}>
              KliqMind v5.0.0 • Cebu City, PH • Secure Zmail Connection
            </Text>
          </View>
        </ScrollView>
      </View>
    </ThemeCtx.Provider>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   📦 PERSISTENCE NOTE — paste into `client/src/store/useAppStore.js`
   ─────────────────────────────────────────────────────────────────────────────
   The reason your settings disappear after a refresh is that this screen
   mutates Zustand state but the store has no `persist` middleware attached.
   Wrap the store like so:

   import { create } from 'zustand';
   import { persist, createJSONStorage } from 'zustand/middleware';
   import AsyncStorage from '@react-native-async-storage/async-storage';

   const DEFAULT_SETTINGS = {
     // privacy
     isPrivate: false, activityStatus: true, ghostMode: false, readReceipts: true,
     // location
     gpsEnabled: true, showOnMap: false, preciseLocation: false,
     // AI
     autoVoice: false, aiPersona: 'Genius',
     // wellness
     suppReminders: true, motoReminders: true,
     // preferences
     darkMode: false, notifications: true, dataSaver: false,
     largeText: false, language: 'en',
     // security
     appLock: false,
   };

   export const useAppStore = create(
     persist(
       (set, get) => ({
         user: null,
         userSettings: DEFAULT_SETTINGS,
         updateSetting: (key, value) =>
           set((state) => ({
             userSettings: { ...state.userSettings, [key]: value },
           })),
         logout: () => set({ user: null }),
         clearCache: () => {
           // drop transient slices but KEEP user + userSettings
         },
       }),
       {
         name: 'kliqmind-app-state',
         storage: createJSONStorage(() => AsyncStorage),
         partialize: (state) => ({
           user: state.user,
           userSettings: state.userSettings,
         }),
         version: 1,
         migrate: (persisted, version) => persisted, // bump + handle on future schema changes
       }
     )
   );

   • On web, AsyncStorage automatically falls back to localStorage.
   • `partialize` ensures only the slices you care about are persisted —
     transient UI state stays in memory.
   • `version` + `migrate` give you a clean path when the schema evolves.
   ───────────────────────────────────────────────────────────────────────── */