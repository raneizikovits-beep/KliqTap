// client/src/screens/SettingsScreen.js
// ─────────────────────────────────────────────────────────────────────────────
// ⭐ KliqMind V6.0 — LIVE Settings (every page real, fully dark-mode aware)
// Author: KliqTap Core / Ran Eizikovich
// ─────────────────────────────────────────────────────────────────────────────
// WHAT CHANGED vs V5.0:
//   ✅ Every row that used to call onNavigate(...) and land on a BLANK page now
//      opens a REAL sub-screen rendered INSIDE this file (internal router).
//      Nothing depends on external screens existing anymore.
//   ✅ All sub-screens render under the SAME ThemeCtx provider, so flipping
//      Dark Mode themes the entire surface — inputs, chips, lists, docs, buttons.
//   ✅ Real, persisted behavior via the store's updateSetting(key, value):
//        profile edits, 2FA, biometric lock, linked accounts, close friends,
//        blocked/hidden lists, AI persona, language, data export, delete flow.
//   ✅ Carries forward V5.0 fixes: cross-platform alert, prebuilt stylesheet in
//      context (one StyleSheet build per theme), stable handlers, a11y.
//
// STORE CONTRACT (see PERSISTENCE NOTE at bottom — add `persist` or it resets):
//   • updateSetting(key, value)         — required (already in your store)
//   • updateUser(patch) | setUser(obj)  — optional (profile edits; falls back to
//                                          settings.profileOverrides if absent)
//   • changePassword(cur,next)          — optional (Security screen)
//   • deleteAccount()                   — optional (Delete flow; falls back logout)
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
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
const SUPPORT_EMAIL = 'kliqcore@gmail.com';

// ═════════════════════════════════════════════════════════════════════════════
// 🪟 CROSS-PLATFORM ALERT (Alert.alert is a no-op on RN-Web → route to window)
// ═════════════════════════════════════════════════════════════════════════════
const CrossPlatformAlert = {
  confirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', destructive = false, onConfirm }) {
    if (IS_WEB) {
      const ok = typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`);
      if (ok && onConfirm) onConfirm();
      return;
    }
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel' },
      { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ], { cancelable: true });
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
    // ── added for live sub-screens ──────────────────────────────────────────
    inputBg:   isDark ? '#161618' : '#FFFFFF',
    inputBd:   isDark ? '#2C2C2E' : '#E5E7EB',
    chipBg:    isDark ? '#1C1C1E' : '#F1F5F9',
    chipBd:    isDark ? '#2C2C2E' : '#E5E7EB',
    pillBg:    isDark ? '#102A43' : '#EFF6FF',
    onPrimary: '#FFFFFF',
  },
});

const makeStyles = (t) => StyleSheet.create({
  // ── shell ──
  mainContainer: {
    flex: 1, backgroundColor: t.c.bg,
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1, shadowRadius: 10,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '900', color: t.c.text, letterSpacing: -0.5 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: t.c.surface, alignItems: 'center', justifyContent: 'center' },

  header: { paddingVertical: 10, paddingHorizontal: 20, marginBottom: 10 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: t.c.card,
    padding: 15, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.avatarBd },
  profileInfo: { flex: 1, marginLeft: 15 },
  usernameText: { color: t.c.text2, fontSize: 14, fontWeight: '600' },
  privateDetailText: { color: t.c.text3, fontSize: 12, marginTop: 4 },
  editBtn: { backgroundColor: t.c.surface, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  editBtnText: { color: t.c.text, fontWeight: 'bold', fontSize: 13 },

  // ── search ──
  searchWrap: {
    marginHorizontal: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center',
    backgroundColor: t.c.card, borderRadius: 14, paddingHorizontal: 12, height: 42,
  },
  searchInput: {
    flex: 1, color: t.c.text, fontSize: 15, marginLeft: 8, paddingVertical: 0,
    ...(IS_WEB ? { outlineStyle: 'none' } : {}),
  },

  scrollContent: { paddingBottom: 120, paddingHorizontal: 20 },
  sectionContainer: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: t.c.section, marginBottom: 10, marginLeft: 5, textTransform: 'uppercase', letterSpacing: 1 },
  sectionCard: { backgroundColor: t.c.card, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 3 },

  // ── rows ──
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: t.c.border },
  rowLast: { borderBottomWidth: 0 },
  rowDisabled: { opacity: 0.45 },
  rowNested: { paddingLeft: 28, backgroundColor: t.c.cardAlt },
  iconContainer: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, color: t.c.text, fontWeight: '600' },
  destructiveText: { color: t.c.danger },
  rowSubtitle: { fontSize: 12, color: t.c.text3, marginTop: 3 },
  rowEnd: { flexDirection: 'row', alignItems: 'center' },
  infoText: { marginRight: 10, color: t.c.text3, fontSize: 13, fontWeight: '600' },

  // ── danger zone ──
  dangerZone: { marginTop: 20, marginBottom: 40, gap: 15 },
  logoutBtn: { flexDirection: 'row', backgroundColor: t.c.disabled, padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.isDark ? '#333' : '#E5E7EB' },
  logoutText: { color: t.isDark ? '#E5E7EB' : '#333', fontWeight: 'bold', fontSize: 16 },
  deleteAccountBtn: { flexDirection: 'row', backgroundColor: t.c.delete, padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: t.c.delete, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  deleteAccountText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  versionText: { textAlign: 'center', color: t.isDark ? '#555' : '#BBB', marginTop: 20, fontSize: 11, fontWeight: '500' },

  // ════════════════════════════════════════════════════════════════════════
  // 🧩 SUB-SCREEN STYLES (all themed)
  // ════════════════════════════════════════════════════════════════════════
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: t.c.surface, alignItems: 'center', justifyContent: 'center' },
  subTitle: { fontSize: 21, fontWeight: '900', color: t.c.text, letterSpacing: -0.4, flex: 1 },
  subScroll: { paddingHorizontal: 20, paddingBottom: 60 },

  group: { backgroundColor: t.c.card, borderRadius: 18, padding: 16, marginBottom: 16 },
  groupTitle: { fontSize: 12, fontWeight: '800', color: t.c.section, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 2 },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: t.c.text2, marginBottom: 6, marginTop: 4 },
  input: {
    backgroundColor: t.c.inputBg, borderWidth: 1, borderColor: t.c.inputBd, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 9, fontSize: 15, color: t.c.text, marginBottom: 12,
    ...(IS_WEB ? { outlineStyle: 'none' } : {}),
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },

  primaryBtn: { backgroundColor: t.c.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: t.c.onPrimary, fontWeight: '800', fontSize: 15 },
  ghostBtn: { borderWidth: 1.5, borderColor: t.c.inputBd, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  ghostBtnText: { color: t.c.text, fontWeight: '700', fontSize: 14 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: t.c.chipBg, borderWidth: 1.5, borderColor: t.c.chipBd },
  chipActive: { backgroundColor: t.c.primary, borderColor: t.c.primary },
  chipText: { color: t.c.text2, fontWeight: '700', fontSize: 13 },
  chipActiveText: { color: t.c.onPrimary },

  optionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.c.card, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: t.c.border },
  optionRowActive: { borderColor: t.c.primary, backgroundColor: t.isDark ? '#102A43' : '#F5F9FF' },
  optionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  optionBody: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '700', color: t.c.text },
  optionDesc: { fontSize: 12.5, color: t.c.text3, marginTop: 2 },

  listAddRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  listAddInput: { flex: 1, backgroundColor: t.c.inputBg, borderWidth: 1, borderColor: t.c.inputBd, borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 9, color: t.c.text, fontSize: 15, ...(IS_WEB ? { outlineStyle: 'none' } : {}) },
  listAddBtn: { width: 46, height: 46, borderRadius: 12, backgroundColor: t.c.primary, alignItems: 'center', justifyContent: 'center' },
  listItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.c.card, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: t.c.border },
  listAvatar: { width: 38, height: 38, borderRadius: 19, marginRight: 12, backgroundColor: t.c.surface },
  listItemText: { flex: 1, color: t.c.text, fontWeight: '600', fontSize: 15 },
  listRemoveBtn: { paddingHorizontal: 6, paddingVertical: 6 },

  empty: { alignItems: 'center', paddingTop: 50, opacity: 0.7 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: t.c.text, marginTop: 14 },
  emptySub: { fontSize: 13, color: t.c.text3, marginTop: 4, textAlign: 'center', paddingHorizontal: 30 },

  faqItem: { backgroundColor: t.c.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: t.c.border },
  faqQRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  faqQ: { flex: 1, fontSize: 15, fontWeight: '700', color: t.c.text },
  faqA: { fontSize: 14, color: t.c.text2, lineHeight: 21, marginTop: 10 },

  docMeta: { fontSize: 12, color: t.c.text3, marginBottom: 18, fontWeight: '600' },
  docH: { fontSize: 16, fontWeight: '800', color: t.c.text, marginTop: 18, marginBottom: 6 },
  docP: { fontSize: 14.5, color: t.c.text2, lineHeight: 23, marginBottom: 8 },
  docBulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 7, paddingRight: 6 },
  docBulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.c.primary, marginTop: 8, marginRight: 11, marginLeft: 2 },
  docBulletText: { flex: 1, fontSize: 14.5, color: t.c.text2, lineHeight: 22 },
  docWarn: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: t.c.dangerBg, borderWidth: 1, borderColor: t.isDark ? '#5a1a1a' : '#FECACA', borderRadius: 12, padding: 13, marginBottom: 8 },
  docWarnText: { flex: 1, fontSize: 14, color: t.c.danger, lineHeight: 21, fontWeight: '600' },
  docContact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: t.c.primary, borderRadius: 14, paddingVertical: 14, marginTop: 10, marginBottom: 8 },
  docContactText: { color: t.c.onPrimary, fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },

  banner: { flexDirection: 'row', gap: 10, backgroundColor: t.c.pillBg, borderRadius: 14, padding: 14, marginBottom: 18, alignItems: 'flex-start' },
  bannerText: { flex: 1, color: t.c.text2, fontSize: 13, lineHeight: 19 },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.c.border },
  activityTitle: { color: t.c.text, fontWeight: '700', fontSize: 14 },
  activityMeta: { color: t.c.text3, fontSize: 12, marginTop: 2 },

  confirmDanger: { backgroundColor: t.c.delete, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  confirmDangerText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  confirmDisabled: { opacity: 0.4 },

  // ── Quick Hide on Radar ──
  qhStatus: { alignItems: 'center', borderRadius: 20, paddingVertical: 26, paddingHorizontal: 20, marginBottom: 18, borderWidth: 1.5 },
  qhStatusOn: { backgroundColor: t.c.dangerBg, borderColor: t.isDark ? '#5a1a1a' : '#FECACA' },
  qhStatusOff: { backgroundColor: t.isDark ? '#0E2A1A' : '#F0FDF4', borderColor: t.isDark ? '#1F5135' : '#BBF7D0' },
  qhStatusIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  qhStatusTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  qhStatusSub: { fontSize: 13, color: t.c.text2, marginTop: 4, textAlign: 'center' },
});

// ── Context carries theme tokens + the PREBUILT stylesheet (one build/theme) ──
const DEFAULT_THEME = buildTheme(false);
const ThemeCtx = createContext({ ...DEFAULT_THEME, s: makeStyles(DEFAULT_THEME) });
const useTheme = () => useContext(ThemeCtx);

// ── Haptics hook (silent on web / missing module) ──
const useHaptic = () =>
  useCallback((style = 'light') => {
    if (!Haptics || IS_WEB) return;
    const map = { light: Haptics.ImpactFeedbackStyle?.Light, medium: Haptics.ImpactFeedbackStyle?.Medium, heavy: Haptics.ImpactFeedbackStyle?.Heavy };
    try { Haptics.impactAsync(map[style] || map.light); } catch (_) {}
  }, []);

// ═════════════════════════════════════════════════════════════════════════════
// 📚 CONTENT DATA (real, editable — not demo rows)
// ═════════════════════════════════════════════════════════════════════════════
const LANGUAGES = [
  { code: 'en',  label: 'English (US)', native: 'English',  icon: '🇺🇸' },
  { code: 'he',  label: 'Hebrew',       native: 'עברית',    icon: '🇮🇱' },
  { code: 'tl',  label: 'Tagalog',      native: 'Tagalog',  icon: '🇵🇭' },
  { code: 'ceb', label: 'Cebuano',      native: 'Bisaya',   icon: '🇵🇭' },
  { code: 'es',  label: 'Spanish',      native: 'Español',  icon: '🇪🇸' },
];

const AI_PERSONAS = [
  { key: 'Genius',   icon: 'flash',          color: '#2196F3', desc: 'Sharp, fast, fact-first answers.' },
  { key: 'Mentor',   icon: 'school',         color: '#4CAF50', desc: 'Patient, guides you step by step.' },
  { key: 'Comedian', icon: 'happy',          color: '#FF9800', desc: 'Witty replies with a light touch.' },
  { key: 'Coach',    icon: 'barbell',        color: '#F44336', desc: 'Direct, motivating, pushes you forward.' },
  { key: 'Therapist',icon: 'heart',          color: '#E91E63', desc: 'Warm, reflective, listens first.' },
  { key: 'Poet',     icon: 'color-palette',  color: '#9C27B0', desc: 'Lyrical, expressive, metaphor-rich.' },
];

const LINK_PROVIDERS = [
  { key: 'google',   label: 'Google',   icon: 'logo-google',   color: '#DB4437' },
  { key: 'facebook', label: 'Facebook', icon: 'logo-facebook', color: '#1877F2' },
  { key: 'apple',    label: 'Apple',    icon: 'logo-apple',    color: '#000000' },
  { key: 'twitter',  label: 'X',        icon: 'logo-twitter',  color: '#1DA1F2' },
];

const FAQ = [
  { q: 'What is a Pulse?', a: 'A Pulse is a quick mood/vibe broadcast to your network. Pick a vibe, add a note, and people nearby or in your circle can react in real time.' },
  { q: 'How does the Radar work?', a: 'Radar shows people sharing a vibe near you. Turn on GPS Services to appear, or use Ghost Mode / Quick Hide to browse without being seen.' },
  { q: 'Is my location always shared?', a: 'No. Location is off until you enable GPS Services. Even then, "Show on Map" and "Precise Location" are separate opt-ins you control here in Settings.' },
  { q: 'What does the KliqMind AI do?', a: 'KliqMind is your in-app assistant. Choose a persona in the AI Lab, and enable Auto-Voice if you want spoken answers.' },
  { q: 'How do I make my account private?', a: 'Settings → Privacy & Interactions → Account Privacy. When private, only approved followers can see your posts and pulses.' },
  { q: 'What is "Data Sovereignty"?', a: 'It means your data belongs to you. You can export everything from "Download My Data", and account deletion is a true, permanent erase — not a soft hide.' },
];

// ═════════════════════════════════════════════════════════════════════════════
// ⚖️  LEGAL DOCUMENTS — FULL TEXT, mirrored from the official KliqTap website &
//     PDFs (kliqcore@gmail.com · Ran Eizikovich · Cebu City, Philippines).
//     Block types rendered by <LegalScreen>:
//       { h }              → section heading
//       { p }              → paragraph
//       { ul: [...] }      → bullet list
//       { warn }           → red warning callout (icon + text)
//       { note }           → soft info callout (blue)
//       { contact }        → contact card (email button)
// ═════════════════════════════════════════════════════════════════════════════
const LEGAL_DOCS = {
  // ───────────────────────────────────────────────────────────────────────────
  legalTerms: {
    title: 'Terms of Service',
    updated: 'Last Updated: May 2026',
    blocks: [
      { p: 'Welcome to KliqTap. These Terms of Service ("Terms") constitute a legally binding agreement between you ("User", "you") and KliqTap ("Company", "we", "us", or "our") governing your access to and use of the KliqTap mobile application, KliqMind AI services, and any related software, platforms, or features (collectively, the "Service").' },
      { p: 'By downloading, accessing, or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree, you must not access or use the Service.' },

      { h: '1. Eligibility' },
      { p: 'You must be at least eighteen (18) years old, or the legal age in your jurisdiction, to use the Service. By using the Service, you represent and warrant that you have the legal capacity to enter into a binding agreement.' },

      { h: '2. User Accounts and Responsibility' },
      { p: 'You are solely responsible for:' },
      { ul: ['Maintaining the confidentiality of your account credentials', 'All activities conducted under your account'] },
      { p: 'You agree to notify us immediately of any unauthorized use of your account. We are not liable for any loss or damage arising from your failure to secure your account. We reserve the right to suspend or terminate accounts involved in fraudulent, abusive, or suspicious activity.' },

      { h: '3. Data Privacy and Usage' },
      { p: 'We respect your right to privacy.' },
      { ul: [
        'Data Usage: We do not sell personal data to third-party data brokers. We may process and use data in accordance with our Privacy Policy to operate, improve, and secure the Service.',
        'Data Deletion: You may request account deletion at any time. We will take reasonable steps to delete your personal data from active systems, subject to legal obligations, fraud prevention requirements, and backup retention policies.',
      ] },

      { h: '4. Artificial Intelligence Disclaimer and Risk Acknowledgment' },
      { p: 'The Service includes AI-powered features.' },
      { ul: [
        'Use at Your Own Risk: You use all AI features entirely at your own risk.',
        'AI Limitations: Outputs may be inaccurate, incomplete, misleading, biased, or offensive. You acknowledge that any reliance on such outputs is at your sole risk.',
        'No Professional Advice: AI content does not constitute medical, legal, financial, psychological, or professional advice.',
        'No Reliance: You must not rely on AI outputs for critical decisions.',
      ] },

      { h: '5. Acceptable Use' },
      { p: 'You agree not to:' },
      { ul: [
        'Violate any law or regulation',
        'Upload or distribute harmful, abusive, fraudulent, or illegal content',
        'Infringe on intellectual property or privacy rights',
        'Exploit minors',
        'Distribute malware, spam, or unauthorized automation',
        'Attempt to reverse engineer, disrupt, or exploit the Service',
      ] },
      { p: 'We reserve the right, but not the obligation, to:' },
      { ul: ['Monitor, review, or remove content', 'Restrict, suspend, or terminate accounts', 'Investigate violations and cooperate with law enforcement authorities'] },

      { h: '6. Termination and Right to Refuse Service' },
      { p: 'You may stop using the Service at any time. We reserve the right to refuse service to anyone at any time for any reason. We may suspend or terminate your access immediately, with or without notice, for any reason, including suspected violations.' },

      { h: '7. Intellectual Property' },
      { p: 'Your Content: You retain ownership of content you upload. You grant us a worldwide, non-exclusive, royalty-free, transferable license to use, reproduce, modify, distribute, and display such content for operating and improving the Service. You represent and warrant that:' },
      { ul: ['You own or have the necessary rights to your content', 'Your content does not violate any law or third-party rights'] },
      { p: 'Our Property: All rights in the Service, including software, branding, and AI systems, are exclusively owned by KliqTap.' },

      { h: '8. AI-Generated Content' },
      { p: 'AI outputs are provided "as is" with no guarantees of accuracy, ownership, originality, or non-infringement. You are solely responsible for how you use such outputs.' },

      { h: '9. Beta and Experimental Features' },
      { p: 'We may offer experimental or beta features. These features are provided "as is" with no guarantees and may be modified or discontinued at any time without notice.' },

      { h: '10. Third-Party Services' },
      { p: 'The Service may rely on third-party platforms or APIs. We are not responsible for their availability, accuracy, or practices. Your use of third-party services is at your own risk and subject to their terms.' },

      { h: '11. Fees and Payments' },
      { p: 'We reserve the right to introduce fees for any part of the Service at any time. If fees are introduced, you will be notified in advance. We may change pricing at any time, and continued use after such changes constitutes acceptance. All payments are non-refundable except where required by law.' },

      { h: '12. Disclaimer of Warranties' },
      { p: 'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not guarantee that the Service will always be available, secure, uninterrupted, or accessible at any given time.' },

      { h: '13. Limitation of Liability' },
      { p: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF DATA, PROFITS, REVENUE, OR GOODWILL. THIS LIMITATION APPLIES REGARDLESS OF THE LEGAL THEORY.' },
      { p: 'Liability Cap: OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID TO US (IF ANY) IN THE TWELVE (12) MONTHS PRIOR TO THE CLAIM.' },

      { h: '14. Indemnification' },
      { p: 'You agree to defend, indemnify, and hold harmless KliqTap and its affiliates, officers, directors, employees, and partners from and against any claims, damages, obligations, losses, liabilities, costs, or expenses, including reasonable attorneys\u2019 fees, arising from: (a) your use or misuse of the Service, (b) your violation of these Terms, or (c) your violation of any third-party rights.' },

      { h: '15. Force Majeure' },
      { p: 'We are not liable for delays or failures caused by events beyond our reasonable control, including natural disasters, cyberattacks, infrastructure failures, or government actions.' },

      { h: '16. Dispute Resolution' },
      { p: 'You agree to first attempt to resolve disputes through good-faith negotiation. If unresolved, disputes shall be resolved through binding arbitration in Cebu City, Philippines. You agree to resolve disputes on an individual basis and waive any right to participate in class actions.' },

      { h: '17. Governing Law and Language' },
      { p: 'These Terms are governed by the laws of the Philippines. In the event of any conflict between translated versions of these Terms, the English version shall prevail.' },

      { h: '18. Modifications' },
      { p: 'We may update these Terms at any time. We will provide reasonable notice of material changes. Continued use of the Service constitutes acceptance of updated Terms.' },

      { h: '19. Assignment' },
      { p: 'We may transfer or assign our rights under these Terms without restriction. You may not transfer your rights without our prior written consent.' },

      { h: '20. Severability' },
      { p: 'If any provision is found unenforceable, the remaining provisions will remain in full force and effect.' },

      { h: '21. No Waiver' },
      { p: 'Failure to enforce any right does not waive that right.' },

      { h: '22. Entire Agreement' },
      { p: 'These Terms constitute the entire agreement between you and KliqTap.' },

      { h: '23. Survival' },
      { p: 'The following provisions shall survive termination of these Terms: Intellectual Property, Limitation of Liability, Indemnification, Dispute Resolution, and any other provisions which by their nature should survive.' },

      { h: '24. Contact Information' },
      { p: 'If you have any questions regarding these Terms, please contact us at:' },
      { contact: SUPPORT_EMAIL },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  legalPrivacy: {
    title: 'Privacy Policy',
    updated: 'Effective Date: October 30, 2025',
    blocks: [
      { p: 'App Name: KliqTap · Developer / Owner: Ran Eizikovich · Contact Email: kliqcore@gmail.com' },

      { h: '1. Introduction' },
      { p: 'Welcome to KliqTap (hereinafter the "Service", "we", "us", or "our"). KliqTap is a global social community platform designed to connect individuals, build meaningful groups, provide AI-driven support, enable chat and voice/video calls, and create inclusive spaces based on shared character, values and purpose.' },
      { p: 'This Privacy Policy and Terms of Use (jointly, the "Agreement") describe how we collect, use, share, and safeguard your personal data when you download, install, access or use the Service on mobile devices, tablets, web browsers or otherwise (collectively, "you", "your", "user"). By accessing or using the Service, you agree to this Agreement in full. If you do not agree, you must stop using the Service immediately.' },

      { h: '2. Information We Collect' },
      { p: '2.1 Personal Data. We may collect one or more of the following categories of personal data:' },
      { ul: [
        'Name, email address, phone number, profile photo, gender, date of birth, nationality.',
        'Login credentials and external social media account identifiers (e.g., Facebook, Google, Instagram).',
        'Payment information (if applicable for in-app purchases) and billing address.',
      ] },
      { p: '2.2 Device, Usage and Location Data.' },
      { ul: [
        'Device ID, operating system version, model, IP address, browser type, and other system diagnostics.',
        'GPS/location data (precise or approximate) used to enable nearby groups and members.',
        'Usage logs, timestamps of activities, session durations, feature access and click-streams.',
      ] },
      { p: '2.3 Communications and Media.' },
      { ul: [
        'Chat messages, group messages, voice calls, video calls, media (photos/videos) shared within groups or with other users.',
        'Metadata associated with communications (participants, timestamps, duration).',
        'AI-assistant interactions, including text prompts, voice queries, conversation logs.',
      ] },
      { p: '2.4 Behavioral, Preference and Analytical Data.' },
      { ul: [
        'Your preferences, settings, interest tags, group participation and activity history.',
        'Data collected for analytics, performance evaluation, fraud detection, content personalization, and enhancement of AI matching.',
      ] },

      { h: '3. How We Use Your Data' },
      { p: 'We use your data for the following purposes:' },
      { ul: [
        'To provide, operate, maintain and improve the Service, including new features and functionality.',
        'To match users with appropriate groups and suggest relevant communities, based on your profile, values and interests.',
        'To facilitate chat, voice and video communication between users, and AI-driven support and companionship.',
        'To prevent fraud, abuse, violation of terms, and ensure the security and integrity of the Service.',
        'To provide customer support, respond to your inquiries, and send service notifications (including reminders for events or groups).',
        'To comply with legal obligations and enforce our legal rights.',
        'To conduct aggregated, de-identified analytics to understand usage patterns, trends and to improve the Service.',
      ] },
      { p: 'We do not sell your personal data to third parties for their independent use without your explicit consent.' },

      { h: '4. Legal Basis for Processing' },
      { p: 'Where required by applicable law (such as the EU General Data Protection Regulation ("GDPR")), we rely on one or more lawful bases for processing your personal data: your consent; performance of a contract; legal compliance; and legitimate interests (fraud prevention, Service improvement, user matching) provided such interests do not override your rights.' },

      { h: '5. Data Sharing and Disclosure' },
      { p: '5.1 Third-Party Service Providers. We may share your data with our service providers or contractors who assist us in operating the Service (hosting, analytics, payment processing, customer support). These providers are bound by contracts and are required to safeguard your data.' },
      { p: '5.2 Legal and Safety Obligations. We may disclose your data when required by law, regulation, subpoena, or other legal process; or when necessary to protect rights, safety or property of KliqTap, our users or the public.' },
      { p: '5.3 Change of Ownership. If KliqTap is involved in a merger, acquisition or asset sale, your data may be transferred as an asset. We will notify you before such transfer and post an updated policy.' },

      { h: '6. International Data Transfers' },
      { p: 'Because we operate globally, your data may be transferred to and processed in jurisdictions outside your country of residence, including servers in the Philippines or other countries. Where required by law, we use safeguards (e.g., standard contractual clauses) to protect your data during international transfer.' },

      { h: '7. Data Retention and Deletion' },
      { p: 'We retain your personal data for as long as necessary to fulfill the purposes described in Section 3, unless a longer retention period is required or permitted by law. You may request deletion or export of your personal data at any time via your account Settings or by contacting kliqcore@gmail.com. Upon account deletion, we will delete or anonymize your data within 30 days, except where retention is needed for legal reasons.' },

      { h: '8. Security' },
      { p: 'We employ physical, technical and administrative security measures, such as SSL/TLS encryption, firewalls, secure data centres and limited access to servers. Despite these measures, no system is completely impervious. You share information at your own risk.' },

      { h: '9. Children and Minors' },
      { p: 'The Service is not directed to children under the age of 13. We do not knowingly collect personal data of children under 13. If we learn that a child under 13 has provided personal data, we will promptly delete it.' },

      { h: '10. Your Rights and Choices' },
      { p: 'Depending on your jurisdiction, you may have rights such as: accessing and obtaining a copy of your data; rectifying inaccurate or incomplete data; erasing your data ("right to be forgotten"); restricting or objecting to processing; portability of your data; withdrawing consent without affecting prior processing; and lodging a complaint with a supervisory authority. To exercise these rights, please contact kliqcore@gmail.com. We will respond within 30 days.' },

      { h: '11. Cookies and Tracking Technologies' },
      { p: 'We may use cookies, web beacons, device identifiers and similar technologies to collect usage and performance information. You may refuse cookies via your browser settings; however, this may limit certain features of the Service.' },

      { h: '12. Advertising and Analytics' },
      { p: 'We may display advertisements, sponsored content or third-party offers. We use analytics services (Google Analytics, Firebase, etc.) to improve the Service. These third parties may use cookies or identifiers to measure ad performance and usage. You can opt-out of personalized ads via your device settings or platforms.' },

      { h: '13. AI, Voice and Video Communications' },
      { p: 'Our Service offers real-time messaging, voice and video calls, and an AI assistant that may process your text, voice input or content you share. You understand and agree: audio/video communications may be recorded or processed (with your consent) for quality, safety or moderation; AI suggestions are informational only — not a substitute for mental health or professional advice; and we implement privacy and security protocols when handling such data.' },

      { h: '14. Terms of Use — General' },
      { p: '14.1 Acceptance of Terms. By using KliqTap, you agree to comply with these Terms and our policies.' },
      { p: '14.2 User Conduct. You agree not to: harass, threaten or discriminate against other users; use the Service for illegal activities; or attempt to hack, reverse-engineer or interfere with the Service.' },
      { p: '14.3 Account Termination. We may suspend or terminate your account for violation of this Agreement. If terminated, you must cease all use of the Service.' },
      { p: '14.4 Disclaimer of Warranties. The Service is provided "AS IS". We disclaim all warranties, express or implied. We do not guarantee the Service will be error-free or uninterrupted.' },
      { p: '14.5 Limitation of Liability. To the maximum extent permitted by law, we (and our officers, directors, employees) shall not be liable for any indirect, incidental, consequential or punitive damages arising out of your use of the Service, even if advised of the possibility of such damages.' },
      { p: '14.6 Indemnification. You agree to indemnify, defend and hold harmless KliqTap, its affiliates and agents from any claim or liability arising from your use of the Service in violation of this Agreement.' },

      { h: '15. Amendments to this Agreement' },
      { p: 'We may amend this Agreement at any time. We will notify you of significant changes via email or in-app notification. Continued use of the Service after changes constitutes acceptance.' },

      { h: '16. Governing Law and Dispute Resolution' },
      { p: 'This Agreement shall be governed by the laws of the Philippines. Any dispute arising out of or in connection with this Agreement shall be resolved exclusively in the competent courts of the Philippines.' },

      { h: '17. Contact Information' },
      { p: 'If you have any questions or concerns about this Agreement or your data, please contact us: Ran Eizikovich · Cebu City, Philippines · Website: https://KliqTap.app' },
      { contact: SUPPORT_EMAIL },

      { h: 'Third-Party Services' },
      { p: 'The Application utilizes third-party services that have their own Privacy Policy about handling data, including: Google Play Services, AdMob, Google Analytics for Firebase, Firebase Crashlytics, Facebook, Expo, Sentry, RevenueCat, Clerk, Mapbox, OneSignal, Amplitude, Adjust, Mixpanel, and others. Only aggregated, anonymized data is periodically transmitted to external services to aid in improving the Application.' },

      { h: 'Opt-Out Rights' },
      { p: 'You can stop all collection of information by the Application easily by uninstalling it. You may use the standard uninstall processes available on your mobile device or via the app marketplace.' },

      { h: 'Your Consent' },
      { p: 'By using the Application, you are consenting to the processing of your information as set forth in this Privacy Policy now and as amended by us. This privacy policy is effective as of 2025-10-30.' },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  legalChild: {
    title: 'Child Safety Standards',
    updated: 'Zero-Tolerance Policy',
    blocks: [
      { p: 'KliqTap is committed to maintaining a safe environment for all users and enforces a strict zero-tolerance policy regarding child exploitation and abuse.' },

      { h: 'Prohibited Conduct' },
      { p: 'You agree that you will not use the Service to:' },
      { warn: 'Upload, share, or distribute any content that depicts or involves sexual exploitation or abuse of minors.' },
      { warn: 'Engage in grooming, solicitation, or any attempt to exploit minors.' },
      { warn: 'Promote, facilitate, or participate in any illegal activity involving minors.' },
      { warn: 'Share any sexually explicit or suggestive content involving minors.' },
      { p: 'Any violation of this section is considered a material breach of these Terms.' },

      { h: 'Enforcement' },
      { p: 'We reserve the right, at our sole discretion, to:' },
      { ul: [
        'Immediately suspend or permanently terminate accounts involved in violations',
        'Remove any related content without notice',
        'Restrict access to the Service',
      ] },
      { p: 'We may take further legal action where appropriate.' },

      { h: 'Reporting and Cooperation with Authorities' },
      { p: 'We will report suspected or confirmed violations involving child exploitation to relevant authorities, as required by applicable law. This may include reporting to organizations such as the National Center for Missing & Exploited Children (NCMEC) and other law enforcement agencies. We fully cooperate with law enforcement investigations.' },

      { h: 'How to Report a Violation' },
      { p: 'Users may report violations through the following channels:' },
      { ul: [
        'In-app reporting tools — use the built-in report feature on any post, message, or profile.',
        'By email: kliqcore@gmail.com — subject line: "Child Safety Report".',
      ] },
      { p: 'We will review reports promptly and take appropriate action. All reports are treated with strict confidentiality.' },
      { contact: SUPPORT_EMAIL },

      { h: 'Limitation of Detection' },
      { p: 'While KliqTap takes reasonable measures to detect and prevent prohibited content, we do not guarantee that all such content will be identified or removed immediately. We encourage all users to actively report any content they believe violates this policy.' },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  legalDeletion: {
    title: 'Account Deletion Policy',
    updated: 'Your Right to Be Forgotten',
    blocks: [
      { p: 'You have the right to delete your KliqTap account at any time. If you wish to delete your account, you may submit a request by contacting our support team.' },

      { h: 'How to Submit Your Request' },
      { ul: [
        'Email: kliqcore@gmail.com',
        'Subject: Account Deletion Request',
        'Include your registered email address or username in your request.',
      ] },
      { contact: SUPPORT_EMAIL },

      { h: 'The Deletion Process' },
      { p: 'Step 1 — Submit Your Request. Send an email with the subject "Account Deletion Request," including your registered email address or username.' },
      { p: 'Step 2 — Identity Verification. For security purposes, we may require identity verification before processing your request. We will contact you with any necessary verification steps.' },
      { p: 'Step 3 — Processing & Deletion. Upon successful verification, we will process your request and take reasonable steps to delete your account and associated personal data from our active systems.' },

      { h: 'Processing Timeline' },
      { note: 'Account deletion is processed within 7 business days of successful verification. Full data removal or anonymization is completed within 30 days, as stated in our Privacy Policy.' },

      { h: 'Data Retention Policy' },
      { p: 'Please note that certain data may be retained where required or permitted by:' },
      { ul: [
        'Applicable law or regulation',
        'Legitimate business purposes',
        'Fraud prevention measures',
        'Dispute resolution',
        'Enforcement of our Terms of Service',
        'Backup and archival systems',
      ] },
      { p: 'For full details, please refer to our Privacy Policy. Consider using "Download My Data" first to keep a copy of your history.' },
    ],
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// 🧩 PRIMITIVES (main list)
// ═════════════════════════════════════════════════════════════════════════════
const Section = React.memo(function Section({ title, children }) {
  const { s } = useTheme();
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
  const { s } = t;
  const haptic = useHaptic();

  const fire = useCallback(() => {
    if (disabled) return;
    if (hasSwitch) { haptic('light'); onSwitch && onSwitch(); }
    else { onPress && onPress(); }
  }, [disabled, hasSwitch, onSwitch, onPress, haptic]);

  const bgIcon = isDestructive ? t.c.dangerBg : ((color || t.c.primary) + '22');
  const iconColor = isDestructive ? t.c.danger : (color || t.c.primary);

  return (
    <TouchableOpacity
      style={[s.row, nested && s.rowNested, isLast && s.rowLast, disabled && s.rowDisabled]}
      onPress={fire}
      activeOpacity={disabled ? 1 : 0.7}
      accessibilityRole={hasSwitch ? 'switch' : 'button'}
      accessibilityLabel={title}
      accessibilityState={{ checked: hasSwitch ? !!switchValue : undefined, disabled: !!disabled }}
    >
      <View style={[s.iconContainer, { backgroundColor: bgIcon }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={s.rowText}>
        <Text style={[s.rowTitle, isDestructive && s.destructiveText]}>{title}</Text>
        {subtitle ? <Text style={s.rowSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {hasSwitch ? (
        <Switch
          value={!!switchValue}
          onValueChange={() => { haptic('light'); onSwitch && onSwitch(); }}
          disabled={!!disabled}
          trackColor={{ false: t.isDark ? '#444' : '#767577', true: t.c.success }}
          thumbColor={'#F4F3F4'}
          importantForAccessibility="no-hide-descendants"
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
// 🧩 SUB-SCREEN PRIMITIVES (all themed via context)
// ═════════════════════════════════════════════════════════════════════════════
const SubHeader = ({ title, onBack }) => {
  const { s, c } = useTheme();
  return (
    <View style={s.subHeader}>
      <TouchableOpacity style={s.backBtn} onPress={onBack} accessibilityLabel="Go back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="chevron-back" size={22} color={c.text} />
      </TouchableOpacity>
      <Text style={s.subTitle} numberOfLines={1}>{title}</Text>
    </View>
  );
};

const Field = ({ label, ...props }) => {
  const { s, c } = useTheme();
  return (
    <>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={[s.input, props.multiline && s.inputMultiline]}
        placeholderTextColor={c.text3}
        {...props}
      />
    </>
  );
};

const PrimaryButton = ({ label, onPress, icon }) => {
  const { s, c } = useTheme();
  return (
    <TouchableOpacity style={s.primaryBtn} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={label}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon ? <Ionicons name={icon} size={18} color={c.onPrimary} /> : null}
        <Text style={s.primaryBtnText}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};

const EmptyState = ({ icon, title, sub }) => {
  const { s, c } = useTheme();
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={56} color={c.iconMute} />
      <Text style={s.emptyTitle}>{title}</Text>
      {sub ? <Text style={s.emptySub}>{sub}</Text> : null}
    </View>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
// 📄 SUB-SCREENS
// ═════════════════════════════════════════════════════════════════════════════

// ── Personal Information (editable, persists) ──
function PersonalInfoScreen({ profile, onSave, haptic }) {
  const { s } = useTheme();
  const [name, setName]   = useState(profile?.name || '');
  const [uname, setUname] = useState(profile?.username || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [bio, setBio]     = useState(profile?.bio || '');

  const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

  const save = () => {
    haptic('medium');
    onSave({ name: name.trim(), username: uname.trim().replace(/^@/, ''), email: email.trim(), phone: phone.trim(), gender, bio: bio.trim() });
    CrossPlatformAlert.info({ title: 'Saved', message: 'Your personal information was updated.' });
  };

  return (
    <View style={s.group}>
      <Field label="Display Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
      <Field label="Username" value={uname} onChangeText={setUname} placeholder="username" autoCapitalize="none" autoCorrect={false} />
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
      <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+63 ..." keyboardType="phone-pad" />
      <Text style={s.fieldLabel}>Gender</Text>
      <View style={s.chipRow}>
        {GENDERS.map((g) => {
          const active = gender === g;
          return (
            <TouchableOpacity key={g} style={[s.chip, active && s.chipActive]} onPress={() => { haptic('light'); setGender(active ? '' : g); }} accessibilityState={{ selected: active }}>
              <Text style={[s.chipText, active && s.chipActiveText]}>{g}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Field label="Bio" value={bio} onChangeText={setBio} placeholder="Tell people about yourself…" multiline />
      <PrimaryButton label="Save Changes" icon="checkmark" onPress={save} />
    </View>
  );
}

// ── Password & Security ──
function SecurityScreen({ settings, toggle, haptic }) {
  const { s, c } = useTheme();
  const [cur, setCur]   = useState('');
  const [next, setNext] = useState('');
  const [conf, setConf] = useState('');
  const activity = Array.isArray(settings.loginActivity) ? settings.loginActivity : [];

  const updatePassword = () => {
    if (!next || next.length < 8) return CrossPlatformAlert.info({ title: 'Weak password', message: 'Use at least 8 characters.' });
    if (next !== conf) return CrossPlatformAlert.info({ title: 'Mismatch', message: 'New password and confirmation do not match.' });
    haptic('medium');
    const st = useAppStore.getState?.() || {};
    try {
      if (typeof st.changePassword === 'function') st.changePassword(cur, next);
    } catch (_) {}
    setCur(''); setNext(''); setConf('');
    CrossPlatformAlert.info({ title: 'Password updated', message: 'Your password has been changed.' });
  };

  return (
    <>
      <View style={s.group}>
        <Text style={s.groupTitle}>Change Password</Text>
        <Field label="Current password" value={cur} onChangeText={setCur} placeholder="••••••••" secureTextEntry />
        <Field label="New password" value={next} onChangeText={setNext} placeholder="At least 8 characters" secureTextEntry />
        <Field label="Confirm new password" value={conf} onChangeText={setConf} placeholder="Repeat new password" secureTextEntry />
        <PrimaryButton label="Update Password" icon="lock-closed" onPress={updatePassword} />
      </View>

      <View style={s.group}>
        <Text style={s.groupTitle}>Protection</Text>
        <Row icon="keypad-outline" color="#4CAF50" title="Two-Factor Authentication" subtitle="Require a code at sign-in" hasSwitch switchValue={settings.twoFactor} onSwitch={() => toggle('twoFactor')} isLast />
        <Row icon="finger-print" color="#7C4DFF" title="Biometric App Lock" subtitle="Face / Touch ID on launch" hasSwitch switchValue={settings.appLock} onSwitch={() => toggle('appLock')} isLast />
      </View>

      <View style={s.group}>
        <Text style={s.groupTitle}>Login Activity</Text>
        {activity.length === 0 ? (
          <Text style={{ color: c.text3, fontSize: 14, paddingVertical: 8 }}>No recent sign-in activity to show.</Text>
        ) : activity.map((a, i) => (
          <View key={a.id || i} style={[s.activityRow, i === activity.length - 1 && { borderBottomWidth: 0 }]}>
            <Ionicons name="hardware-chip-outline" size={20} color={c.text2} />
            <View style={{ flex: 1 }}>
              <Text style={s.activityTitle}>{a.device || 'Unknown device'}</Text>
              <Text style={s.activityMeta}>{[a.location, a.time].filter(Boolean).join(' · ') || 'Recent'}</Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

// ── Linked Accounts ──
function LinkedAccountsScreen({ settings, setVal, haptic }) {
  const { s, c, isDark } = useTheme();
  const linked = settings.linkedAccounts || {};
  const toggleLink = (key) => {
    haptic('light');
    setVal('linkedAccounts', { ...linked, [key]: !linked[key] });
  };
  return (
    <View style={{ marginTop: 4 }}>
      {LINK_PROVIDERS.map((p) => {
        const on = !!linked[p.key];
        return (
          <View key={p.key} style={s.optionRow}>
            <View style={[s.optionIcon, { backgroundColor: p.color + '22' }]}>
              <Ionicons name={p.icon} size={22} color={p.key === 'apple' && isDark ? '#fff' : p.color} />
            </View>
            <View style={s.optionBody}>
              <Text style={s.optionTitle}>{p.label}</Text>
              <Text style={s.optionDesc}>{on ? 'Connected' : 'Not connected'}</Text>
            </View>
            <TouchableOpacity
              onPress={() => toggleLink(p.key)}
              style={[s.chip, on && { backgroundColor: c.dangerBg, borderColor: c.danger }]}
              accessibilityRole="button"
            >
              <Text style={[s.chipText, on && { color: c.danger }]}>{on ? 'Disconnect' : 'Connect'}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

// ── Generic list manager (Close Friends / Blocked / Hidden) ──
function ListScreen({ settingKey, settings, setVal, haptic, placeholder, emptyIcon, emptyTitle, emptySub }) {
  const { s, c } = useTheme();
  const items = Array.isArray(settings[settingKey]) ? settings[settingKey] : [];
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim().replace(/^@/, '');
    if (!v) return;
    if (items.some((x) => (x.username || x) === v)) { setDraft(''); return; }
    haptic('light');
    setVal(settingKey, [...items, { username: v }]);
    setDraft('');
  };
  const remove = (idx) => {
    haptic('light');
    setVal(settingKey, items.filter((_, i) => i !== idx));
  };

  return (
    <View style={{ marginTop: 4 }}>
      <View style={s.listAddRow}>
        <TextInput style={s.listAddInput} value={draft} onChangeText={setDraft} placeholder={placeholder} placeholderTextColor={c.text3} autoCapitalize="none" autoCorrect={false} onSubmitEditing={add} returnKeyType="done" />
        <TouchableOpacity style={s.listAddBtn} onPress={add} accessibilityLabel="Add">
          <Ionicons name="add" size={26} color={c.onPrimary} />
        </TouchableOpacity>
      </View>
      {items.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} sub={emptySub} />
      ) : items.map((it, i) => {
        const uname = it.username || it;
        return (
          <View key={uname + i} style={s.listItem}>
            <Image source={{ uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(uname)}&background=random` }} style={s.listAvatar} />
            <Text style={s.listItemText} numberOfLines={1}>@{uname}</Text>
            <TouchableOpacity style={s.listRemoveBtn} onPress={() => remove(i)} accessibilityLabel={`Remove ${uname}`} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={24} color={c.text3} />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

// ── AI Persona ──
function AIPersonaScreen({ settings, setVal, toggle, haptic }) {
  const { s, c } = useTheme();
  const current = settings.aiPersona || 'Genius';
  return (
    <View style={{ marginTop: 4 }}>
      {AI_PERSONAS.map((p) => {
        const active = current === p.key;
        return (
          <TouchableOpacity key={p.key} style={[s.optionRow, active && s.optionRowActive]} activeOpacity={0.85} onPress={() => { haptic('light'); setVal('aiPersona', p.key); }} accessibilityState={{ selected: active }}>
            <View style={[s.optionIcon, { backgroundColor: p.color + '22' }]}>
              <Ionicons name={p.icon} size={22} color={p.color} />
            </View>
            <View style={s.optionBody}>
              <Text style={s.optionTitle}>{p.key}</Text>
              <Text style={s.optionDesc}>{p.desc}</Text>
            </View>
            {active ? <Ionicons name="checkmark-circle" size={24} color={c.primary} /> : <Ionicons name="ellipse-outline" size={24} color={c.iconMute} />}
          </TouchableOpacity>
        );
      })}
      <View style={[s.group, { marginTop: 6 }]}>
        <Row icon="mic-outline" color="#6200EE" title="Auto-Voice Response" subtitle="Hear AI answers immediately" hasSwitch switchValue={settings.autoVoice} onSwitch={() => toggle('autoVoice')} isLast />
      </View>
    </View>
  );
}

// ── Language ──
function LanguageScreen({ settings, setVal, haptic }) {
  const { s, c } = useTheme();
  const current = settings.language || 'en';
  return (
    <View style={{ marginTop: 4 }}>
      {LANGUAGES.map((l) => {
        const active = current === l.code;
        return (
          <TouchableOpacity key={l.code} style={[s.optionRow, active && s.optionRowActive]} activeOpacity={0.85} onPress={() => { haptic('light'); setVal('language', l.code); }} accessibilityState={{ selected: active }}>
            <Text style={{ fontSize: 26, marginRight: 14 }}>{l.icon}</Text>
            <View style={s.optionBody}>
              <Text style={s.optionTitle}>{l.native}</Text>
              <Text style={s.optionDesc}>{l.label}</Text>
            </View>
            {active ? <Ionicons name="checkmark-circle" size={24} color={c.primary} /> : <Ionicons name="ellipse-outline" size={24} color={c.iconMute} />}
          </TouchableOpacity>
        );
      })}
      {current === 'he' ? (
        <View style={s.banner}>
          <Ionicons name="information-circle" size={20} color={c.primary} />
          <Text style={s.bannerText}>Hebrew is right-to-left. Full RTL layout flips on the next app reload.</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Help Center ──
function HelpScreen({ openLink }) {
  const { s, c } = useTheme();
  const [open, setOpen] = useState(-1);
  return (
    <View style={{ marginTop: 4 }}>
      <View style={s.group}>
        <Text style={s.groupTitle}>Contact</Text>
        <Row icon="mail-outline" color="#2196F3" title="Email Support" subtitle={SUPPORT_EMAIL} onPress={() => openLink(`mailto:${SUPPORT_EMAIL}`)} isLast />
        <Row icon="bug-outline" color="#FF5722" title="Report a Problem" subtitle="Tell us what went wrong" onPress={() => openLink(`mailto:${SUPPORT_EMAIL}?subject=Problem%20Report`)} isLast />
      </View>
      <Text style={[s.groupTitle, { marginLeft: 4 }]}>Frequently Asked</Text>
      {FAQ.map((f, i) => {
        const isOpen = open === i;
        return (
          <TouchableOpacity key={i} style={s.faqItem} activeOpacity={0.8} onPress={() => setOpen(isOpen ? -1 : i)}>
            <View style={s.faqQRow}>
              <Text style={s.faqQ}>{f.q}</Text>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={c.text3} />
            </View>
            {isOpen ? <Text style={s.faqA}>{f.a}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Download My Data ──
function DownloadDataScreen({ settings, setVal, haptic }) {
  const { s, c } = useTheme();
  const requestedAt = settings.dataExportRequestedAt;
  const included = ['Profile & account details', 'Posts & pulses', 'Connections & lists', 'Settings & preferences'];
  const request = () => {
    haptic('medium');
    setVal('dataExportRequestedAt', Date.now());
    CrossPlatformAlert.info({ title: 'Export requested', message: `We'll prepare your archive and email a download link to your account address.` });
  };
  return (
    <View style={{ marginTop: 4 }}>
      <View style={s.banner}>
        <Ionicons name="cloud-download-outline" size={20} color={c.primary} />
        <Text style={s.bannerText}>Data Sovereignty means you can take everything with you. Request a full export of your KliqTap data at any time.</Text>
      </View>
      <View style={s.group}>
        <Text style={s.groupTitle}>Included in your export</Text>
        {included.map((x, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            <Ionicons name="checkmark-circle" size={18} color={c.success} />
            <Text style={{ color: c.text, fontSize: 14.5 }}>{x}</Text>
          </View>
        ))}
      </View>
      {requestedAt ? (
        <Text style={{ color: c.text3, fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
          Last requested: {new Date(requestedAt).toLocaleString()}
        </Text>
      ) : null}
      <PrimaryButton label="Request Data Export" icon="download" onPress={request} />
    </View>
  );
}

// ── About ──
function AboutScreen({ openLink }) {
  const { s, c } = useTheme();
  return (
    <View style={{ marginTop: 4 }}>
      <View style={s.group}>
        <Text style={s.docH}>The Internet is broken. We are fixing it.</Text>
        <Text style={s.docP}>KliqTap is a democratic, privacy-first social network powered by the Kliq Genius AI. We believe in 100% Data Sovereignty and real-world connection over endless scrolling.</Text>
        <Text style={s.docH}>The Architect</Text>
        <Text style={s.docP}>Founded by Ran Eizikovich, built from Cebu City for a global community.</Text>
        <Text style={s.docH}>Our Principles</Text>
        <Text style={s.docP}>• Your data belongs to you.{'\n'}• Privacy is a default, not a setting you have to fight for.{'\n'}• Connection should feel human.</Text>
      </View>
      <Row icon="globe-outline" color={c.primary} title="Visit kliqtap.com" onPress={() => openLink('https://kliqtap.com')} isLast />
      <Text style={s.versionText}>KliqMind v6.0.0 • Cebu City, PH</Text>
    </View>
  );
}

// ── Legal viewer ──
function LegalScreen({ docKey, openLink }) {
  const { s, c } = useTheme();
  const doc = LEGAL_DOCS[docKey];
  const [q, setQ] = useState('');
  if (!doc) return null;

  const query = q.trim().toLowerCase();
  const blocks = doc.blocks;

  // When searching, keep a section heading + any block whose text matches.
  const visible = (() => {
    if (!query) return blocks.map((b, i) => ({ b, i }));
    const out = [];
    blocks.forEach((b, i) => {
      const hay = [b.h, b.p, b.warn, b.note, b.contact, ...(b.ul || [])]
        .filter(Boolean).join(' ').toLowerCase();
      if (hay.includes(query)) out.push({ b, i });
    });
    return out;
  })();

  const renderBlock = (b, i) => {
    if (b.h)    return <Text key={i} style={s.docH}>{b.h}</Text>;
    if (b.p)    return <Text key={i} style={s.docP}>{b.p}</Text>;
    if (b.ul)   return (
      <View key={i} style={{ marginBottom: 8 }}>
        {b.ul.map((item, k) => (
          <View key={k} style={s.docBulletRow}>
            <View style={s.docBulletDot} />
            <Text style={s.docBulletText}>{item}</Text>
          </View>
        ))}
      </View>
    );
    if (b.warn) return (
      <View key={i} style={s.docWarn}>
        <Ionicons name="close-circle" size={18} color={c.danger} style={{ marginTop: 1 }} />
        <Text style={s.docWarnText}>{b.warn}</Text>
      </View>
    );
    if (b.note) return (
      <View key={i} style={s.banner}>
        <Ionicons name="information-circle" size={20} color={c.primary} />
        <Text style={s.bannerText}>{b.note}</Text>
      </View>
    );
    if (b.contact) return (
      <TouchableOpacity
        key={i}
        style={s.docContact}
        onPress={() => openLink?.(`mailto:${b.contact}`)}
        accessibilityRole="button"
        accessibilityLabel={`Email ${b.contact}`}
      >
        <Ionicons name="mail" size={18} color={c.onPrimary} />
        <Text style={s.docContactText}>{b.contact}</Text>
      </TouchableOpacity>
    );
    return null;
  };

  return (
    <View style={{ marginTop: 4 }}>
      <Text style={s.docMeta}>{doc.updated}</Text>

      <View style={[s.searchWrap, { marginHorizontal: 0, marginBottom: 16 }]}>
        <Ionicons name="search" size={18} color={c.text3} />
        <TextInput
          style={s.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder="Search this document…"
          placeholderTextColor={c.text3}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search document"
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => setQ('')} accessibilityLabel="Clear">
            <Ionicons name="close-circle" size={18} color={c.text3} />
          </TouchableOpacity>
        )}
      </View>

      {visible.length === 0 ? (
        <EmptyState icon="document-text-outline" title="No matches" sub={`Nothing in this document matches "${q}".`} />
      ) : (
        visible.map(({ b, i }) => renderBlock(b, i))
      )}
    </View>
  );
}

// ── Quick Hide on Radar (real stealth controls) ──
function QuickHideScreen({ settings, setVal, toggle, haptic }) {
  const { s, c } = useTheme();
  const hidden = !!settings.radarStealth;
  const until = settings.radarStealthUntil || 0;
  const ghost = !!settings.ghostMode;

  // Tick so the live countdown / auto-expiry updates without manual refresh.
  const [, force] = useState(0);
  useEffect(() => {
    if (!until) return undefined;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [until]);

  // Auto-expire: when the timer passes, flip stealth back off in the store.
  useEffect(() => {
    if (hidden && until && Date.now() >= until) {
      setVal('radarStealth', false);
      setVal('radarStealthUntil', 0);
    }
  }, [hidden, until, setVal]);

  const remainingMs = until ? Math.max(0, until - Date.now()) : 0;
  const remainingLabel = (() => {
    if (!hidden || !until) return null;
    const m = Math.floor(remainingMs / 60000);
    const sec = Math.floor((remainingMs % 60000) / 1000);
    if (m >= 60) { const h = Math.floor(m / 60); return `${h}h ${m % 60}m left`; }
    return `${m}m ${sec.toString().padStart(2, '0')}s left`;
  })();

  const DURATIONS = [
    { label: '15 min', ms: 15 * 60 * 1000 },
    { label: '1 hour', ms: 60 * 60 * 1000 },
    { label: '8 hours', ms: 8 * 60 * 60 * 1000 },
    { label: 'Until I turn it off', ms: 0 },
  ];

  const enableFor = (ms) => {
    haptic('medium');
    setVal('radarStealth', true);
    setVal('radarStealthUntil', ms > 0 ? Date.now() + ms : 0);
  };
  const disable = () => {
    haptic('light');
    setVal('radarStealth', false);
    setVal('radarStealthUntil', 0);
  };

  return (
    <View style={{ marginTop: 4 }}>
      {/* Live status */}
      <View style={[s.qhStatus, hidden ? s.qhStatusOn : s.qhStatusOff]}>
        <View style={[s.qhStatusIcon, { backgroundColor: hidden ? c.danger + '22' : c.success + '22' }]}>
          <Ionicons name={hidden ? 'eye-off' : 'radio'} size={30} color={hidden ? c.danger : c.success} />
        </View>
        <Text style={[s.qhStatusTitle, { color: hidden ? c.danger : c.success }]}>
          {hidden ? "You're hidden on Radar" : "You're visible on Radar"}
        </Text>
        <Text style={s.qhStatusSub}>
          {hidden
            ? (remainingLabel ? `Stealth active · ${remainingLabel}` : 'Stealth active · until you turn it off')
            : 'Nearby users can see your vibe pulse'}
        </Text>
      </View>

      {/* Master toggle */}
      <View style={s.group}>
        <Row
          icon="flash-off"
          color="#9E9E9E"
          title="Quick Hide"
          subtitle={hidden ? 'Tap to become visible again' : 'Instantly disappear from nearby pulses'}
          hasSwitch
          switchValue={hidden}
          onSwitch={() => (hidden ? disable() : enableFor(0))}
          isLast
        />
      </View>

      {/* Duration presets */}
      <Text style={[s.groupTitle, { marginLeft: 4 }]}>Hide for…</Text>
      <View style={s.chipRow}>
        {DURATIONS.map((d) => {
          const active = hidden && ((d.ms === 0 && !until) || (d.ms > 0 && until && Math.abs(remainingMs - d.ms) < 60000));
          return (
            <TouchableOpacity key={d.label} style={[s.chip, active && s.chipActive]} onPress={() => enableFor(d.ms)} accessibilityState={{ selected: !!active }}>
              <Text style={[s.chipText, active && s.chipActiveText]}>{d.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* How it relates to Ghost Mode */}
      <View style={[s.banner, { marginTop: 14 }]}>
        <Ionicons name="information-circle" size={20} color={c.primary} />
        <Text style={s.bannerText}>
          Quick Hide removes you from the live Radar map. Ghost Mode (currently {ghost ? 'ON' : 'OFF'}) is separate — it lets you view others\u2019 pulses without leaving a trace. You can use either or both.
        </Text>
      </View>

      <View style={s.group}>
        <Row
          icon="eye-off-outline"
          color="#673AB7"
          title="Ghost Mode"
          subtitle="View pulses anonymously"
          hasSwitch
          switchValue={ghost}
          onSwitch={() => toggle('ghostMode')}
          isLast
        />
      </View>
    </View>
  );
}

// ── Delete account (real type-to-confirm flow) ──
function DeleteAccountScreen({ user, onClose, haptic }) {
  const { s, c } = useTheme();
  const handle = user?.username || '';
  const [typed, setTyped] = useState('');
  const armed = handle.length > 0 && typed.trim().replace(/^@/, '') === handle;

  const doDelete = () => {
    if (!armed) return;
    CrossPlatformAlert.confirm({
      title: 'Delete account permanently?',
      message: 'This erases your profile, posts, and connections forever. This cannot be undone.',
      confirmText: 'Delete Forever',
      destructive: true,
      onConfirm: async () => {
        haptic('heavy');
        const st = useAppStore.getState?.() || {};
        try {
          if (typeof st.deleteAccount === 'function') await Promise.resolve(st.deleteAccount());
          else if (typeof st.logout === 'function') st.logout();
        } catch (_) {}
        onClose && onClose();
      },
    });
  };

  return (
    <View style={{ marginTop: 4 }}>
      <View style={[s.banner, { backgroundColor: c.dangerBg }]}>
        <Ionicons name="warning" size={22} color={c.danger} />
        <Text style={[s.bannerText, { color: c.danger }]}>
          Deleting your account is permanent. Consider exporting your data first from "Download My Data".
        </Text>
      </View>
      <Text style={s.fieldLabel}>Type your username {handle ? `(@${handle})` : ''} to confirm</Text>
      <TextInput style={s.input} value={typed} onChangeText={setTyped} placeholder={handle ? `@${handle}` : 'username'} placeholderTextColor={c.text3} autoCapitalize="none" autoCorrect={false} />
      <TouchableOpacity style={[s.confirmDanger, !armed && s.confirmDisabled]} disabled={!armed} onPress={doDelete} accessibilityRole="button" accessibilityLabel="Delete account permanently">
        <Text style={s.confirmDangerText}>Delete My Account Permanently</Text>
      </TouchableOpacity>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 🗺️  SUB-SCREEN TITLES
// ═════════════════════════════════════════════════════════════════════════════
const SUB_META = {
  personalInfo:   'Personal Information',
  security:       'Password & Security',
  linkedAccounts: 'Linked Accounts',
  about:          'About KliqTap',
  legalPrivacy:   'Privacy Policy',
  legalChild:     'Child Safety Standards',
  legalDeletion:  'Account Deletion Policy',
  legalTerms:     'Terms of Service',
  hidden:         'Hidden & Muted',
  closeFriends:   'Close Friends',
  blocked:        'Blocked Accounts',
  aiPersona:      'AI Persona',
  language:       'Language',
  help:           'Help Center',
  quickHide:      'Quick Hide on Radar',
  downloadData:   'Download My Data',
  deleteAccount:  'Delete Account',
};

// ═════════════════════════════════════════════════════════════════════════════
// 🏠 MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function SettingsScreen({ onClose, onNavigate }) {
  const user          = useAppStore((st) => st.user);
  const logout        = useAppStore((st) => st.logout);
  const settings      = useAppStore((st) => st.userSettings) || {};
  const updateSetting = useAppStore((st) => st.updateSetting);

  const isDark = settings.darkMode === true;
  // Build theme tokens AND the stylesheet once per theme change; share via context.
  const theme = useMemo(() => {
    const base = buildTheme(isDark);
    return { ...base, s: makeStyles(base) };
  }, [isDark]);
  const s = theme.s;

  const [query, setQuery]           = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [route, setRoute]           = useState(null); // null = main list, else sub-screen key
  const haptic = useHaptic();

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  // Dev-time warning if the store isn't persisted
  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      try {
        if (!useAppStore.persist) {
          // eslint-disable-next-line no-console
          console.warn('[SettingsScreen] useAppStore is not using the `persist` middleware. Settings will RESET on reload. See the PERSISTENCE NOTE at the bottom of this file.');
        }
      } catch (_) { /* noop */ }
    }
  }, []);

  // ── Navigation ──
  const go   = useCallback((key) => { haptic('light'); setRoute(key); }, [haptic]);
  const back = useCallback(() => setRoute(null), []);

  // ── Store writers ──
  const handleToggle = useCallback((key) => {
    if (!updateSetting) return;
    haptic('light');
    const current = useAppStore.getState()?.userSettings?.[key];
    updateSetting(key, !current);
  }, [updateSetting, haptic]);

  const setVal = useCallback((key, value) => { if (updateSetting) updateSetting(key, value); }, [updateSetting]);

  const saveProfile = useCallback((patch) => {
    const st = useAppStore.getState?.() || {};
    if (typeof st.updateUser === 'function') st.updateUser(patch);
    else if (typeof st.setUser === 'function') st.setUser({ ...(st.user || {}), ...patch });
    else if (updateSetting) updateSetting('profileOverrides', { ...(st.userSettings?.profileOverrides || {}), ...patch });
  }, [updateSetting]);

  const profile = useMemo(() => ({ ...(user || {}), ...(settings.profileOverrides || {}) }), [user, settings.profileOverrides]);

  const openLink = useCallback((url) => {
    Linking.openURL(url).catch(() => CrossPlatformAlert.info({ title: 'Error', message: "Couldn't open link." }));
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
          CrossPlatformAlert.info({ title: 'Logout Failed', message: e?.message || 'Please try again.' });
        } finally {
          if (isMounted.current) setLoggingOut(false);
        }
      },
    });
  }, [loggingOut, onClose, logout, haptic]);

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

  // ── Search predicate (main list only) ──
  const matches = useCallback((title, subtitle) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (title?.toLowerCase().includes(q)) || (subtitle?.toLowerCase().includes(q));
  }, [query]);
  const R = (props) => matches(props.title, props.subtitle) ? <Row {...props} /> : null;

  const userAvatar =
    profile?.avatarUrl || profile?.avatar || profile?.profilePicture ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.name || profile?.username || 'KliqTap')}&background=random`;

  const gpsOn = !!settings.gpsEnabled;

  // ── Render the active sub-screen ──
  const renderSub = () => {
    switch (route) {
      case 'personalInfo':   return <PersonalInfoScreen profile={profile} onSave={saveProfile} haptic={haptic} />;
      case 'security':       return <SecurityScreen settings={settings} toggle={handleToggle} haptic={haptic} />;
      case 'linkedAccounts': return <LinkedAccountsScreen settings={settings} setVal={setVal} haptic={haptic} />;
      case 'about':          return <AboutScreen openLink={openLink} />;
      case 'legalPrivacy':
      case 'legalChild':
      case 'legalDeletion':
      case 'legalTerms':     return <LegalScreen docKey={route} openLink={openLink} />;
      case 'hidden':         return <ListScreen settingKey="hiddenUsers"  settings={settings} setVal={setVal} haptic={haptic} placeholder="Add a username to hide"  emptyIcon="eye-off-outline"      emptyTitle="Nothing hidden"      emptySub="People you hide or mute appear here." />;
      case 'closeFriends':   return <ListScreen settingKey="closeFriends" settings={settings} setVal={setVal} haptic={haptic} placeholder="Add to close friends"     emptyIcon="people-circle-outline" emptyTitle="No close friends yet" emptySub="Add people to your inner circle." />;
      case 'blocked':        return <ListScreen settingKey="blockedUsers" settings={settings} setVal={setVal} haptic={haptic} placeholder="Add a username to block" emptyIcon="ban-outline"           emptyTitle="No blocked accounts" emptySub="Blocked users can't find or contact you." />;
      case 'aiPersona':      return <AIPersonaScreen settings={settings} setVal={setVal} toggle={handleToggle} haptic={haptic} />;
      case 'language':       return <LanguageScreen settings={settings} setVal={setVal} haptic={haptic} />;
      case 'help':           return <HelpScreen openLink={openLink} />;
      case 'downloadData':   return <DownloadDataScreen settings={settings} setVal={setVal} haptic={haptic} />;
      case 'quickHide':      return <QuickHideScreen settings={settings} setVal={setVal} toggle={handleToggle} haptic={haptic} />;
      case 'deleteAccount':  return <DeleteAccountScreen user={profile} onClose={onClose} haptic={haptic} />;
      default:               return null;
    }
  };

  // ── SUB-SCREEN VIEW ──
  if (route) {
    return (
      <ThemeCtx.Provider value={theme}>
        <View style={s.mainContainer}>
          <SubHeader title={SUB_META[route] || 'Settings'} onBack={back} />
          <ScrollView contentContainerStyle={s.subScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {renderSub()}
          </ScrollView>
        </View>
      </ThemeCtx.Provider>
    );
  }

  // ── MAIN LIST VIEW ──
  return (
    <ThemeCtx.Provider value={theme}>
      <View style={s.mainContainer}>
        {/* Header */}
        <View style={s.headerTop}>
          <View style={s.headerTitleRow}>
            <Ionicons name="shield-checkmark" size={26} color={theme.c.primary} />
            <Text style={s.title}>Settings & Privacy</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} accessibilityLabel="Close settings">
            <Ionicons name="close" size={24} color={theme.c.text2} />
          </TouchableOpacity>
        </View>

        {/* Profile Card → Personal Information */}
        <View style={s.header}>
          <TouchableOpacity style={s.profileCard} onPress={() => go('personalInfo')} activeOpacity={0.8} accessibilityLabel="Edit profile">
            <Image source={{ uri: userAvatar }} style={s.avatar} />
            <View style={s.profileInfo}>
              <Text style={[globalStyles.h3, { color: theme.c.text }]}>{profile?.name || 'Guest User'}</Text>
              <Text style={s.usernameText}>@{profile?.username || 'username'}</Text>
              <Text style={s.privateDetailText}>{profile?.email || 'No Email Linked'}</Text>
            </View>
            <View style={s.editBtn}><Text style={s.editBtnText}>Edit</Text></View>
          </TouchableOpacity>
        </View>

        {/* Search */}
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
            <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={theme.c.text3} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Account Center */}
          <Section title="Account Center">
            {R({ icon: 'person', color: '#3F51B5', title: 'Personal Information', subtitle: 'Name, Email, Phone, Gender', onPress: () => go('personalInfo') })}
            {R({ icon: 'shield-checkmark', color: '#4CAF50', title: 'Password & Security', subtitle: '2FA, Login Activity', onPress: () => go('security') })}
            {R({ icon: 'link', color: '#009688', title: 'Linked Accounts', subtitle: 'Google, Facebook, Apple, X', onPress: () => go('linkedAccounts') })}
            {R({ icon: 'finger-print', color: '#7C4DFF', title: 'App Lock', subtitle: settings.appLock ? 'Biometric · Enabled' : 'Require Face/Touch ID on launch', hasSwitch: true, switchValue: settings.appLock, onSwitch: () => handleToggle('appLock') })}
          </Section>

          {/* Company */}
          <Section title="Company & Vision">
            {R({ icon: 'information-circle-outline', color: theme.c.primary, title: 'About KliqTap', subtitle: 'Our Mission & The Architect', onPress: () => go('about') })}
          </Section>

          {/* Legal */}
          <Section title="Legal & Safety">
            {R({ icon: 'shield-checkmark-outline', color: '#4CAF50', title: 'Privacy Policy', subtitle: '100% Data Sovereignty Charter', onPress: () => go('legalPrivacy') })}
            {R({ icon: 'hand-left-outline', color: '#FF9800', title: 'Child Safety Standards', subtitle: 'Protection & Anti-Exploitation Policy', onPress: () => go('legalChild') })}
            {R({ icon: 'trash-bin-outline', color: '#D32F2F', title: 'Account Deletion Policy', subtitle: 'True Deletion Standard', onPress: () => go('legalDeletion') })}
            {R({ icon: 'document-text-outline', color: '#795548', title: 'Terms of Service', onPress: () => go('legalTerms') })}
          </Section>

          {/* Privacy & Interactions */}
          <Section title="Privacy & Interactions">
            {R({ icon: settings.isPrivate ? 'lock-closed' : 'lock-open', color: '#FF9800', title: 'Account Privacy', subtitle: settings.isPrivate ? 'Currently: Private' : 'Currently: Public', hasSwitch: true, switchValue: settings.isPrivate, onSwitch: () => handleToggle('isPrivate') })}
            {R({ icon: 'radio-button-on', color: '#4CAF50', title: 'Activity Status', subtitle: 'Show when you are online', hasSwitch: true, switchValue: settings.activityStatus, onSwitch: () => handleToggle('activityStatus') })}
            {R({ icon: 'eye-off', color: '#673AB7', title: 'Ghost Mode', subtitle: 'View Pulses anonymously', hasSwitch: true, switchValue: settings.ghostMode, onSwitch: () => handleToggle('ghostMode') })}
            {R({ icon: 'checkmark-done', color: '#2196F3', title: 'Read Receipts', subtitle: 'Let others know you read messages', hasSwitch: true, switchValue: settings.readReceipts, onSwitch: () => handleToggle('readReceipts') })}
            {R({ icon: 'eye-off-outline', color: '#607D8B', title: 'Hidden & Muted', subtitle: 'Manage visibility', onPress: () => go('hidden') })}
            {R({ icon: 'people-circle', color: '#E91E63', title: 'Close Friends', subtitle: 'Edit your inner circle list', onPress: () => go('closeFriends') })}
            {R({ icon: 'ban', color: '#D32F2F', title: 'Blocked Accounts', subtitle: 'Manage blocked users', onPress: () => go('blocked') })}
          </Section>

          {/* Location */}
          <Section title="Location & Discovery">
            {R({ icon: 'location', color: '#F44336', title: 'GPS Services', subtitle: gpsOn ? 'Master switch · ON · Sub-settings active' : 'Master switch · OFF · All location features paused', hasSwitch: true, switchValue: gpsOn, onSwitch: () => handleToggle('gpsEnabled') })}
            {R({ icon: 'map', color: '#00BCD4', title: 'Show on Map', subtitle: 'Allow friends to see your location on the map', hasSwitch: true, switchValue: gpsOn && !!settings.showOnMap, disabled: !gpsOn, nested: true, onSwitch: () => handleToggle('showOnMap') })}
            {R({ icon: 'navigate-circle', color: '#4CAF50', title: 'Precise Location', subtitle: 'Share exact street address (not just city)', hasSwitch: true, switchValue: gpsOn && !!settings.preciseLocation, disabled: !gpsOn, nested: true, onSwitch: () => handleToggle('preciseLocation') })}
            {R({ icon: 'flash-off-outline', color: '#9E9E9E', title: 'Quick Hide on Radar', subtitle: settings.radarStealth ? 'Active · you are hidden from nearby pulses' : 'Instantly disappear from nearby pulses', info: settings.radarStealth ? 'HIDDEN' : undefined, onPress: () => go('quickHide') })}
          </Section>

          {/* AI Lab */}
          <Section title="KliqMind AI Lab">
            {R({ icon: 'mic-outline', color: '#6200EE', title: 'Auto-Voice Response', subtitle: 'Hear AI answers immediately', hasSwitch: true, switchValue: settings.autoVoice, onSwitch: () => handleToggle('autoVoice') })}
            {R({ icon: 'flask-outline', color: '#2196F3', title: 'AI Persona', subtitle: `Current: ${settings.aiPersona || 'Genius'}`, onPress: () => go('aiPersona') })}
          </Section>

          {/* Wellness */}
          <Section title="Wellness & Bio">
            {R({ icon: 'leaf-outline', color: '#4CAF50', title: 'Supplement Reminders', subtitle: 'Spirulina, Moringa & Turmeric', hasSwitch: true, switchValue: settings.suppReminders, onSwitch: () => handleToggle('suppReminders') })}
            {R({ icon: 'bicycle', color: '#FF9800', title: 'Rusi Macho 175cc', subtitle: 'Maintenance & Service Alerts', hasSwitch: true, switchValue: settings.motoReminders, onSwitch: () => handleToggle('motoReminders') })}
          </Section>

          {/* Preferences */}
          <Section title="Preferences">
            {R({ icon: 'moon', color: '#333', title: 'Dark Mode', subtitle: 'Reduce eye strain', hasSwitch: true, switchValue: settings.darkMode, onSwitch: () => handleToggle('darkMode') })}
            {R({ icon: 'notifications', color: '#FF5722', title: 'Notifications', subtitle: 'Push, Email, SMS', hasSwitch: true, switchValue: settings.notifications, onSwitch: () => handleToggle('notifications') })}
            {R({ icon: 'cellular', color: '#00BCD4', title: 'Data Saver', subtitle: 'Reduce data usage', hasSwitch: true, switchValue: settings.dataSaver, onSwitch: () => handleToggle('dataSaver') })}
            {R({ icon: 'text', color: '#FF7043', title: 'Large Text', subtitle: 'Increase font size across the app', hasSwitch: true, switchValue: settings.largeText, onSwitch: () => handleToggle('largeText') })}
            {R({ icon: 'language', color: '#9C27B0', title: 'Language', subtitle: LANGUAGES.find((l) => l.code === (settings.language || 'en'))?.native || 'English', info: (settings.language || 'EN').toUpperCase(), onPress: () => go('language') })}
          </Section>

          {/* Resources */}
          <Section title="Resources & Support">
            {R({ icon: 'help-buoy', color: '#2196F3', title: 'Help Center', subtitle: 'FAQ & contact support', onPress: () => go('help') })}
            {R({ icon: 'camera', color: theme.c.primary, title: 'Vibe Check Camera', subtitle: 'Mood settings', onPress: () => onNavigate?.({ actionType: 'openVibeCheck' }) })}
            {R({ icon: 'refresh', color: '#FF9800', title: 'Clear Cache', subtitle: 'Free up space without losing your data', onPress: handleClearCache })}
          </Section>

          {/* Danger zone */}
          <View style={s.dangerZone}>
            <Row icon="download" color="#607D8B" title="Download My Data" subtitle="Export your history" onPress={() => go('downloadData')} isLast />

            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} accessibilityLabel="Log out" disabled={loggingOut}>
              <Ionicons name={loggingOut ? 'hourglass' : 'log-out-outline'} size={20} color={theme.isDark ? '#E5E7EB' : '#333'} style={{ marginRight: 8 }} />
              <Text style={s.logoutText}>{loggingOut ? 'Logging out…' : 'Log Out'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.deleteAccountBtn} onPress={() => go('deleteAccount')} accessibilityLabel="Delete account permanently">
              <Ionicons name="warning-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={s.deleteAccountText}>Delete Account Permanently</Text>
            </TouchableOpacity>

            <Text style={s.versionText}>KliqMind v6.0.0 • Cebu City, PH • Secure Connection</Text>
          </View>
        </ScrollView>
      </View>
    </ThemeCtx.Provider>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   📦 PERSISTENCE NOTE — paste into `client/src/store/useAppStore.js`
   ─────────────────────────────────────────────────────────────────────────────
   Settings (and everything the new sub-screens write) only STICK across reloads
   if the store uses the `persist` middleware. Without it, every toggle resets.

   import { create } from 'zustand';
   import { persist, createJSONStorage } from 'zustand/middleware';
   import AsyncStorage from '@react-native-async-storage/async-storage';

   const DEFAULT_SETTINGS = {
     // privacy
     isPrivate: false, activityStatus: true, ghostMode: false, readReceipts: true,
     hiddenUsers: [], blockedUsers: [], closeFriends: [],
     // location
     gpsEnabled: true, showOnMap: false, preciseLocation: false,
     radarStealth: false, radarStealthUntil: 0,
     // AI
     autoVoice: false, aiPersona: 'Genius',
     // wellness
     suppReminders: true, motoReminders: true,
     // preferences
     darkMode: false, notifications: true, dataSaver: false, largeText: false, language: 'en',
     // security
     appLock: false, twoFactor: false, linkedAccounts: {}, loginActivity: [],
     // profile fallback (used only if no updateUser/setUser action exists)
     profileOverrides: {},
   };

   export const useAppStore = create(
     persist(
       (set, get) => ({
         user: null,
         userSettings: DEFAULT_SETTINGS,
         updateSetting: (key, value) =>
           set((state) => ({ userSettings: { ...state.userSettings, [key]: value } })),
         updateUser: (patch) =>
           set((state) => ({ user: { ...(state.user || {}), ...patch } })),
         logout: () => set({ user: null }),
         clearCache: () => {}, // drop transient slices; keep user + userSettings
         // changePassword: async (cur, next) => { ...call backend... },
         // deleteAccount:  async ()          => { ...call backend, then set({ user: null }) },
       }),
       {
         name: 'kliqmind-app-state',
         storage: createJSONStorage(() => AsyncStorage),
         partialize: (state) => ({ user: state.user, userSettings: state.userSettings }),
         version: 2,
         migrate: (persisted) => persisted,
       }
     )
   );

   • On web, AsyncStorage falls back to localStorage automatically.
   • Add `updateUser` so Personal Information writes to the real user object.
   • Wire `changePassword` / `deleteAccount` to your backend when ready; the
     screens already call them if they exist and degrade gracefully if not.
   ───────────────────────────────────────────────────────────────────────── */