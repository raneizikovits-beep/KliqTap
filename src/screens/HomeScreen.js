// client/src/screens/HomeScreen.js
// ═══════════════════════════════════════════════════════════════════════════════
//  ⚡️ V8.2 KLIQMIND OMEGA — SCROLL FIX + V2 TREND CARDS ⚡️
// ═══════════════════════════════════════════════════════════════════════════════
//  FIXES vs V8.1:
//   ✅ FIX #6: HOT TRENDS scroll fixed — ScrollView now has explicit height
//             via a wrapping View with defined height (130+30=160). Without a
//             constrained parent height a horizontal ScrollView inside a
//             vertical ScrollView has no measure to scroll within, causing the
//             entire list to render flat / not scroll on some devices/versions.
//   ✅ FIX #7: TrendCardSupreme upgraded to V2 (kind-aware icon, face-stack,
//             action pill with specific label). Fully backward-compatible —
//             falls back to "TREND / EXPLORE" if kind is absent.
//   ✅ FIX #8: liveBadge style conflict resolved — section-header LIVE badge
//             and LiveZoneItem LIVE badge now use distinct style keys:
//             `liveHeaderBadge` (section header) vs `liveBadge` (zone item).
//             Previously both shared `liveBadge`, causing the header badge to
//             inherit position:absolute from the zone-item badge.
//   ✅ FIX #9: StreakBanner re-inserted (was accidentally absent from render).
//             Placed between KliqPulseBoard and The World Right Now.
//  All V8.1 fixes preserved unchanged.
// ═══════════════════════════════════════════════════════════════════════════════

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  StyleSheet,
  ImageBackground,
  Dimensions,
  Animated,
  Easing,
  ActivityIndicator,
  Platform,
  InteractionManager,
  Linking,
} from 'react-native';

import * as Data from '../constants/data';
import { routeTrend, getTrendMeta } from '../utils/trendRouter';
import { useAppStore } from '../store/useAppStore';
import { Ionicons } from '@expo/vector-icons';
import { StoryModal } from '../components/modals/PeekModals';
import KliqPulseBoard from '../components/KliqPulseBoard';
import { fetchAPI } from '../store/api';
import { useNavigation } from '@react-navigation/native';

// ─── Optional native modules (safe fallbacks if not installed) ────────────────
let LinearGradient;
try {
  // eslint-disable-next-line global-require
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (_) {
  LinearGradient = ({ colors = ['#000', '#000'], style, children, ...rest }) => (
    <View style={[{ backgroundColor: colors[0] }, style]} {...rest}>
      {children}
    </View>
  );
}

let Haptics;
try {
  // eslint-disable-next-line global-require
  Haptics = require('expo-haptics');
} catch (_) {
  Haptics = {
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
    impactAsync: () => Promise.resolve(),
    notificationAsync: () => Promise.resolve(),
    selectionAsync: () => Promise.resolve(),
  };
}

const { width } = Dimensions.get('window');
const IS_IOS = Platform.OS === 'ios';

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const STANDARD_VIBES = new Set([
  'Happy', 'Sad', 'Neutral', 'Tired', 'Broken', 'Excited', 'Angry', 'Relaxed', 'Bored', 'Sick',
  'Focused', 'Party', 'Work', 'Study', 'Gym', 'Gaming', 'Travel', 'Foodie', 'Driving', 'Coding',
  'Love', 'Cool', 'Normal', 'Chill', 'Lit', 'Vibing', 'Music', 'Nature', 'Art', 'Fashion',
]);

const SPECIAL_SPOTLIGHT = [
  { id: '1', title: 'CEBU FOOD TRIP 🍴',  img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80' },
  { id: '2', title: 'KLIQ LIFT CEBU 💪',  img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80' },
  { id: '3', title: 'SING FOR KLIQ 🎤',   img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80' },
];

// ─── Community Hubs ────────────────────────────────────────────────────────────
const COMMUNITY_HUBS = [
  {
    id: 'Foodie',
    label: 'LAMI BAI',
    tagline: 'Drop your best eats 🍽️',
    icon: 'restaurant',
    colors: ['#FF6B35', '#F7931E', '#FFD200'],
    glow: '#FF6B35',
    challenge: '#LamiBai · CebuEats',
    pulseLabel: 'FOOD PULSE',
  },
  {
    id: 'Gym',
    label: 'KLIQ LIFT',
    tagline: 'Drop a set. Get Iron. 🏋️',
    icon: 'barbell',
    colors: ['#00C9FF', '#0072FF', '#4A00E0'],
    glow: '#00C9FF',
    challenge: '#KliqLiftCebu · IronKliq',
    pulseLabel: 'GYM PULSE',
  },
  {
    id: 'Music',
    label: 'SING FOR KLIQ',
    tagline: 'Your mic. Your stage. 🎤',
    icon: 'musical-notes',
    colors: ['#FF2D55', '#C0007A', '#8E2DE2'],
    glow: '#FF2D55',
    challenge: '#SingForKliq · VideokeNight',
    pulseLabel: 'KANTA PULSE',
  },
];

const TREND_HEAT = {
  NUCLEAR:  { label: 'NUCLEAR',  emoji: '☢️', colors: ['#FF0000', '#7A0000'], glow: '#FF0000' },
  EXPLODING:{ label: 'EXPLODING',emoji: '💥', colors: ['#FF2D55', '#9B003A'], glow: '#FF2D55' },
  RISING:   { label: 'RISING',   emoji: '🚀', colors: ['#FF8A00', '#E52E71'], glow: '#FF8A00' },
  HOT:      { label: 'HOT',      emoji: '🔥', colors: ['#F7971E', '#FFD200'], glow: '#F7971E' },
  WARMING:  { label: 'WARMING',  emoji: '📈', colors: ['#4A00E0', '#8E2DE2'], glow: '#8E2DE2' },
  FRESH:    { label: 'FRESH',    emoji: '✨', colors: ['#00C9FF', '#92FE9D'], glow: '#00C9FF' },
};

// ─── KLIQ PICKS — Third-party API keys ────────────────────────────────────────
// 🔑 Get your free TMDB key at: https://www.themoviedb.org/settings/api
const TMDB_KEY = '8bc1caa3ee6da4ae4119839b775a85f7';
// 🔑 RAWG key — 20K requests/month, auto-resets
const RAWG_KEY = '6434123c4a624d19b6269849f80706e6';
// Google Books — no key needed ✅

const PICKS_TABS = [
  { id: 'movies', label: '🎬 MOVIES',  color: '#E52E71' },
  { id: 'stream', label: '📺 STREAM',  color: '#8E2DE2' },
  { id: 'books',  label: '📚 BOOKS',   color: '#FF8A00' },
  { id: 'games',  label: '🎮 GAMES',   color: '#00C9FF' },
];

const STREAM_SUBTABS = [
  { id: 'youtube', label: '▶ YouTube', color: '#FF0000' },
  { id: 'trailer', label: '🎞 Trailer', color: '#E52E71' },
  { id: 'imdb',    label: '⭐ IMDB',   color: '#F5C518' },
];

const getTrendHeat = (trend) => {
  const v = Number(trend?.velocity);
  if (Number.isFinite(v)) {
    if (v >= 90) return TREND_HEAT.NUCLEAR;
    if (v >= 75) return TREND_HEAT.EXPLODING;
    if (v >= 55) return TREND_HEAT.RISING;
    if (v >= 35) return TREND_HEAT.HOT;
    if (v >= 15) return TREND_HEAT.WARMING;
    return TREND_HEAT.FRESH;
  }
  const c = Number(trend?.count) || 0;
  if (c >= 1_000_000) return TREND_HEAT.NUCLEAR;
  if (c >= 250_000)   return TREND_HEAT.EXPLODING;
  if (c >= 50_000)    return TREND_HEAT.RISING;
  if (c >= 10_000)    return TREND_HEAT.HOT;
  if (c >= 1_000)     return TREND_HEAT.WARMING;
  return TREND_HEAT.FRESH;
};

const formatCount = (n) => {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 5)  return 'Late Night';
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  if (hour < 22) return 'Good Evening';
  return 'Good Night';
};

const getWeatherIcon = (weatherText) => {
  if (!weatherText) return 'cloud-offline';
  const lower = weatherText.toLowerCase();
  if (lower.includes('rain') || lower.includes('shower')) return 'rainy';
  if (lower.includes('thunder') || lower.includes('storm')) return 'thunderstorm';
  if (lower.includes('snow')) return 'snow';
  if (lower.includes('cloud')) return 'cloudy';
  if (lower.includes('clear') || lower.includes('sun')) return 'sunny';
  return 'partly-sunny';
};

const parseNewsHeadlines = (newsText) => {
  if (!newsText) return [];
  const raw = newsText.replace('Current world news headlines: ', '').split(' | ');
  return raw.map((h) => h.replace(/^\d+\.\s*/, '')).filter(Boolean);
};

const haptic = (kind = 'light') => {
  try {
    if (kind === 'light')   return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (kind === 'medium')  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (kind === 'heavy')   return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (kind === 'success') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (kind === 'select')  return Haptics.selectionAsync();
  } catch (_) { /* no-op */ }
  return Promise.resolve();
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SHARED MICRO-INTERACTION HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

const usePressScale = (to = 0.96) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = useCallback(() => {
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  }, [scale, to]);
  const onPressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  }, [scale]);
  return { scale, onPressIn, onPressOut };
};

const useShimmer = () => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const Skeleton = React.memo(({ width: w = 120, height: h = 18, radius = 8, isDark, style }) => {
  const shim = useShimmer();
  const translateX = shim.interpolate({ inputRange: [0, 1], outputRange: [-w, w] });
  return (
    <View
      style={[
        { width: w, height: h, borderRadius: radius, overflow: 'hidden', backgroundColor: isDark ? '#1A1A1A' : '#EEE' },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: w,
          height: h,
          transform: [{ translateX }],
          backgroundColor: isDark ? '#2A2A2A' : '#F8F8F8',
          opacity: 0.7,
        }}
      />
    </View>
  );
});

const PulseCircle = React.memo(({ user, activePulse, isMe, onPress, isDark }) => {
  const imgUri = activePulse?.imageUrl || user?.avatarUrl || null;
  const { scale, onPressIn, onPressOut } = usePressScale(0.92);

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={localStyles.pulseItem}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={isMe ? 'My Pulse' : `${user?.username || 'User'} pulse`}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View
          style={[
            localStyles.pulseBorder,
            { borderColor: isDark ? '#222' : '#F3F4F6' },
            activePulse && { borderColor: Data.brand.blue, borderWidth: 2.5 },
          ]}
        >
          {imgUri ? (
            <Image source={{ uri: imgUri }} style={localStyles.pulseImg} />
          ) : (
            <View
              style={[
                localStyles.pulseImg,
                {
                  backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: isDark ? '#333' : '#E0E0E0',
                },
              ]}
            >
              <View
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 31,
                  backgroundColor: Data.brand.blue,
                  opacity: 0.15,
                  position: 'absolute',
                }}
              />
              <Text style={{ color: isDark ? '#FFF' : Data.brand.blue, fontWeight: '900', fontSize: 18 }}>
                {user?.username?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}

          {isMe && !activePulse && (
            <View style={[localStyles.addBadge, { borderColor: isDark ? '#000' : '#FFF' }]}>
              <Ionicons name="add" size={14} color="#fff" />
            </View>
          )}
        </View>

        <Text style={[localStyles.pulseName, { color: isDark ? '#888' : '#666' }]} numberOfLines={1}>
          {isMe ? 'MY PULSE' : user?.username}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

const AiGeniusCard = React.memo(({ recommendations, onPress, isDark }) => {
  const { scale, onPressIn, onPressOut } = usePressScale(0.98);
  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      style={localStyles.aiCardContainer}
      accessibilityRole="button"
      accessibilityLabel="Open AI recommendations"
    >
      <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&w=800&q=80' }}
          style={localStyles.aiCardBg}
        >
          <LinearGradient
            colors={
              isDark
                ? ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']
                : ['rgba(98,0,238,0.65)', 'rgba(40,0,120,0.95)']
            }
            style={localStyles.aiOverlay}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={localStyles.aiRow}>
              <View
                style={[
                  localStyles.aiIconCircle,
                  { backgroundColor: isDark ? Data.brand.blue : 'rgba(255,255,255,0.2)' },
                ]}
              >
                <Ionicons name="sparkles" size={20} color="#fff" />
              </View>
              <View style={localStyles.aiTextContainer}>
                <Text style={localStyles.aiTitle}>ORACLE ⚡</Text>
                <Text style={localStyles.aiDesc} numberOfLines={1}>
                  {recommendations?.length
                    ? `${recommendations.length} intelligent matches found`
                    : 'Synchronizing network...'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </View>
          </LinearGradient>
        </ImageBackground>
      </Animated.View>
    </TouchableOpacity>
  );
});

/* ─── Streak Banner — clicking opens Pulse Create ─────────────────────────── */
const StreakBanner = React.memo(({ streak = 0, isDark, onPress }) => {
  const { scale, onPressIn, onPressOut } = usePressScale(0.97);
  const glow = useRef(new Animated.Value(0)).current;
  const safeStreak = Math.max(0, Number(streak) || 0);

  useEffect(() => {
    if (safeStreak <= 0) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow, safeStreak]);

  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] });

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={`Daily streak: ${safeStreak} days`}
    >
      <Animated.View
        style={[
          localStyles.streakWrap,
          { shadowOpacity, shadowColor: '#FF8A00', transform: [{ scale }] },
        ]}
      >
        <LinearGradient
          colors={['#FF8A00', '#FF2D55', '#8E2DE2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={localStyles.streakInner}
        >
          <View style={localStyles.streakFlameWrap}>
            <Ionicons name="flame" size={26} color="#FFD200" />
            <Text style={localStyles.streakNumber}>{safeStreak}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={localStyles.streakTitle}>
              {safeStreak === 0 ? 'START YOUR STREAK' : `${safeStreak}-DAY STREAK 🔥`}
            </Text>
            <Text style={localStyles.streakSub} numberOfLines={1}>
              {safeStreak === 0
                ? 'Tap to drop your first pulse today'
                : 'Tap to pulse before midnight'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.85)" />
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});


/* ─── Community Vibe Tracker (מד האנרגיה) ─────────────────────────── */
const CommunityVibeTracker = React.memo(({ isDark, motivation }) => {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const vibeLevel = Math.max(10, Math.min(100, motivation || 85));

  useEffect(() => {
    Animated.spring(fillAnim, {
      toValue: vibeLevel,
      tension: 20,
      friction: 7,
      useNativeDriver: false,
    }).start();
  }, [vibeLevel, fillAnim]);

  const widthPercent = fillAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={{ marginHorizontal: 20, marginBottom: 35 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Ionicons name="pulse" size={16} color="#00F5D4" />
        <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginLeft: 6, flex: 1, color: isDark ? '#FFF' : '#111' }}>
          COMMUNITY VIBE
        </Text>
        <Text style={{ color: '#00F5D4', fontWeight: '900', fontSize: 14 }}>{vibeLevel}%</Text>
      </View>
      <View style={{ height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: isDark ? '#222' : '#E5E5E5' }}>
        <Animated.View style={{ height: '100%', backgroundColor: '#00F5D4', borderRadius: 6, width: widthPercent }} />
      </View>
      <Text style={{ fontSize: 11, marginTop: 8, fontWeight: '500', color: isDark ? '#888' : '#666' }}>
        Network energy is optimal. Keep dropping pulses!
      </Text>
    </View>
  );
});

// ── 🔴 Live Zone Component with Pulse Animation ─────────────────────────────
const LiveZoneItem = React.memo(({ zone, onPress, isDark }) => {
  const avatarUri = zone.img || zone.image_url || null;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const viewers = zone.viewers || 0; // ⭐️ שואב נתון אמיתי בלבד מהשרת!

  return (
    <TouchableOpacity style={localStyles.liveItem} activeOpacity={0.85} onPress={() => onPress(zone)}>
      <View style={localStyles.liveAvatarContainer}>
        <Animated.View style={[localStyles.livePulseRing, { transform: [{ scale: pulseAnim }] }]} />
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={localStyles.liveAvatar} />
        ) : (
          <View style={[localStyles.liveAvatar, localStyles.liveAvatarFallback]}>
            <Ionicons name="radio" size={26} color="#FF2D55" />
          </View>
        )}
        {/* FIX #8: uses liveBadge (absolute-positioned zone badge) */}
        <View style={localStyles.liveBadge}>
          <Text style={localStyles.liveBadgeText}>LIVE</Text>
        </View>
      </View>
      <Text style={[localStyles.liveName, { color: isDark ? '#EEE' : '#333' }]} numberOfLines={1}>{zone.name}</Text>
      <Text style={localStyles.liveViewersText}>
        <Ionicons name="eye" size={10} color="#888" /> {viewers}
      </Text>
    </TouchableOpacity>
  );
});

/* ─── Trend Card SUPREME V2 — kind-aware icon, face-stack, action pill ─────── */
const TrendCardSupreme = React.memo(({ trend, rank, onPress, isDark }) => {
  const heat = getTrendHeat(trend);
  // ⭐ V2: pull kind meta for icon + action label + bg colors
  const meta = getTrendMeta(trend);
  const { scale, onPressIn, onPressOut } = usePressScale(0.94);

  const ambient = useRef(new Animated.Value(0)).current;
  const isTopTier = heat === TREND_HEAT.NUCLEAR || heat === TREND_HEAT.EXPLODING;

  useEffect(() => {
    if (!isTopTier) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ambient, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(ambient, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ambient, isTopTier]);

  const ambientScale = ambient.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });

  const tag = String(trend?.tag || 'trending').replace(/^#/, '');
  // ⭐ V2: prefer participantCount when available
  const count = formatCount(trend?.participantCount || trend?.count);
  const momentum = Number.isFinite(Number(trend?.momentum))
    ? `+${trend.momentum}%`
    : trend?.timeLabel || 'live';

  // ⭐ V2: prefer kind-based gradient over heat gradient
  const gradientColors = meta.bg || heat.colors;
  const glowColor = meta.accent || heat.glow;
  // ⭐ V2: face stack (up to 3 participants)
  const participants = Array.isArray(trend?.participants) ? trend.participants.slice(0, 3) : [];

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label} trend: ${tag}, ${count} ${meta.actionLabel.toLowerCase()}`}
    >
      <Animated.View style={{ transform: [{ scale: Animated.multiply(scale, ambientScale) }] }}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            localStyles.trendCardSupreme,
            {
              shadowColor: glowColor,
              shadowOpacity: isTopTier ? 0.6 : 0.35,
            },
          ]}
        >
          {/* TOP ROW: kind chip + rank/heat chip */}
          <View style={localStyles.trendRankRow}>
            <View style={localStyles.trendKindChip}>
              <Ionicons name={meta.icon} size={11} color="#FFF" />
              <Text style={localStyles.trendKindText}>{meta.label}</Text>
            </View>
            <View style={localStyles.trendRankChip}>
              <Text style={localStyles.trendHeatEmoji}>{heat.emoji}</Text>
              <Text style={localStyles.trendRankText}>#{rank}</Text>
            </View>
          </View>

          {/* MIDDLE: tag */}
          <Text style={localStyles.trendTagSupreme} numberOfLines={1}>#{tag}</Text>

          {/* BOTTOM: faces / count + action pill */}
          <View style={localStyles.trendBottomRow}>
            <View style={localStyles.trendFaces}>
              {participants.length > 0 ? (
                participants.map((p, i) => (
                  <Image
                    key={p?.username || i}
                    source={{ uri: p?.avatarUrl }}
                    style={[
                      localStyles.trendFace,
                      { marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i },
                    ]}
                  />
                ))
              ) : (
                <Ionicons name="people" size={12} color="rgba(255,255,255,0.9)" />
              )}
              <Text style={localStyles.trendMetricText}>
                {count}{participants.length === 0 ? ' vibing' : ''}
              </Text>
            </View>
            <View style={localStyles.trendActionPill}>
              <Text style={localStyles.trendActionText}>{meta.actionLabel}</Text>
              <Ionicons name="arrow-forward" size={11} color="#FFF" />
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

/* ─── For You Card (visual only — no broken nav) ──────────────────────────── */
const ForYouCard = React.memo(({ item, isDark }) => {
  return (
    <View style={localStyles.forYouCard}>
      <ImageBackground
        source={{ uri: item?.img || 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=600&q=80' }}
        style={{ flex: 1 }}
        imageStyle={{ borderRadius: 18 }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
          style={localStyles.forYouOverlay}
        >
          <View style={localStyles.forYouBadge}>
            <Ionicons name="sparkles" size={10} color="#FFF" />
            <Text style={localStyles.forYouBadgeText}>FOR YOU</Text>
          </View>
          <Text style={localStyles.forYouTitle} numberOfLines={2}>
            {item?.title || 'Picked for your vibe'}
          </Text>
          <Text style={localStyles.forYouMeta} numberOfLines={1}>
            {item?.meta || 'Tailored by KliqMind AI'}
          </Text>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
});

/* ─── Challenge of the Day — clicking opens Pulse Create ─────────────────── */
const ChallengeCard = React.memo(({ challenge, onPress, isDark }) => {
  const { scale, onPressIn, onPressOut } = usePressScale(0.97);
const title = challenge?.title || "🏆 SULONG KLIQ 🔥";
  const sub = challenge?.description || "Join this week's community challenge!";
  const participants = formatCount(challenge?._count?.entries || challenge?.participantCount || 0);
  const endsIn = (() => {
    if (!challenge?.endsAt) return 'ends soon';
    const diff = new Date(challenge.endsAt) - new Date();
    if (diff <= 0) return 'ended';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
  })();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={`Daily challenge: ${title}`}
    >
      <Animated.View style={[localStyles.challengeWrap, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={['#00C9FF', '#92FE9D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={localStyles.challengeInner}
        >
          <View style={localStyles.challengeIconWrap}>
            <Ionicons name="trophy" size={26} color="#0A0A0A" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={localStyles.challengeTitle} numberOfLines={1}>{title}</Text>
            <Text style={localStyles.challengeSub} numberOfLines={1}>{sub}</Text>
            <View style={localStyles.challengeMetaRow}>
              <Ionicons name="people" size={11} color="rgba(0,0,0,0.7)" />
              <Text style={localStyles.challengeMeta}>{participants} joined</Text>
              <View style={localStyles.challengeDot} />
              <Ionicons name="time" size={11} color="rgba(0,0,0,0.7)" />
              <Text style={localStyles.challengeMeta}>{endsIn}</Text>
            </View>
          </View>
          <View style={localStyles.challengeJoinBtn}>
            <Text style={localStyles.challengeJoinTxt}>JOIN</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

/* ─── Top Creator (visual only — no broken nav) ───────────────────────────── */
const TopCreator = React.memo(({ creator, isDark }) => {
  return (
    <View style={localStyles.creatorItem}>
      <LinearGradient
        colors={['#FF8A00', '#E52E71', '#8E2DE2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={localStyles.creatorRing}
      >
        <View style={[localStyles.creatorInner, { backgroundColor: isDark ? '#000' : '#FFF' }]}>
          {creator?.avatarUrl ? (
            <Image source={{ uri: creator.avatarUrl }} style={localStyles.creatorImg} />
          ) : (
            <View style={[localStyles.creatorImg, { backgroundColor: isDark ? '#1A1A1A' : '#EEE', justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: Data.brand.blue, fontWeight: '900' }}>
                {creator?.username?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
      <Text style={[localStyles.creatorName, { color: isDark ? '#EEE' : '#222' }]} numberOfLines={1}>
        {creator?.username || 'creator'}
      </Text>
      <Text style={[localStyles.creatorMeta, { color: isDark ? '#666' : '#888' }]} numberOfLines={1}>
        {formatCount(creator?.followers || 0)} followers
      </Text>
    </View>
  );
});

/* ─── Community Hub Card ─────────────────────────────────────────────────────── */
const CommunityHubCard = React.memo(({ hub, onPress, isActive, isDark, index }) => {
  const { scale, onPressIn, onPressOut } = usePressScale(0.92);
  const float = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;

  // Staggered float per card
  useEffect(() => {
    const delay = index * 400;
    const t = setTimeout(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: -5, duration: 2000 + index * 200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 2,  duration: 2000 + index * 200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      loop.start();
    }, delay);
    return () => { clearTimeout(t); float.stopAnimation(); };
  }, [float, index]);

  // Active glow pulse
  useEffect(() => {
    if (!isActive) { shine.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shine, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(shine, { toValue: 0.4, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, shine]);

  const borderOpacity = isActive ? shine : new Animated.Value(0);

  return (
    <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1} accessibilityRole="button" accessibilityLabel={`${hub.label} community`}>
      <Animated.View style={{ transform: [{ scale }, { translateY: float }] }}>
        <LinearGradient
          colors={hub.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1.2 }}
          style={{
            width: 140,
            height: 162,
            borderRadius: 26,
            padding: 16,
            justifyContent: 'space-between',
            shadowColor: hub.glow,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: isActive ? 0.7 : 0.4,
            shadowRadius: 18,
            elevation: isActive ? 14 : 8,
            borderWidth: isActive ? 2 : 1,
            borderColor: isActive ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.15)',
          }}
        >
          {/* Icon bubble */}
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
            <Ionicons name={hub.icon} size={26} color="#FFF" />
          </View>

          {/* Active badge */}
          {isActive && (
            <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: '#FFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 }}>ACTIVE</Text>
            </View>
          )}

          <View>
            <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 13, letterSpacing: 0.6 }} numberOfLines={1}>{hub.label}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 10, marginTop: 4, lineHeight: 14 }} numberOfLines={2}>{hub.tagline}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' }}>
              <Ionicons name="add" size={10} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900', marginLeft: 3, letterSpacing: 0.6 }}>{hub.pulseLabel}</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

/* ─── Vibe Filter Bar ─────────────────────────────────────────────────────────── */
const VibeFilterBar = React.memo(({ activeFilter, onFilterChange, isDark }) => {
  const tabs = [
    { id: 'All',    label: '⚡ ALL',   color: '#8E2DE2' },
    { id: 'Foodie', label: '🍴 EATS',  color: '#FF6B35' },
    { id: 'Gym',    label: '💪 LIFT',  color: '#00C9FF' },
    { id: 'Music',  label: '🎤 SING',  color: '#FF2D55' },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingVertical: 6 }}
    >
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => { haptic('select'); onFilterChange(tab.id); }}
            activeOpacity={0.85}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: isActive ? tab.color : (isDark ? '#1C1C1E' : '#F0F2F5'),
              borderWidth: 1.5,
              borderColor: isActive ? 'transparent' : (isDark ? '#333' : '#E5E7EB'),
              shadowColor: isActive ? tab.color : 'transparent',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isActive ? 0.45 : 0,
              shadowRadius: 8,
              elevation: isActive ? 6 : 0,
            }}
          >
            <Text style={{ color: isActive ? '#FFF' : (isDark ? '#888' : '#666'), fontWeight: '900', fontSize: 12, letterSpacing: 0.5 }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
//  KLIQ PICKS — Movies · Books · Games (live from TMDB, Google Books, RAWG)
// ═══════════════════════════════════════════════════════════════════════════════

const useKliqPicks = () => {
  const [picks, setPicks] = useState({ movies: [], books: [], stream: [], games: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // ─── fetch all 4 sources in parallel ───────────────────────────────
        const [moviesRes, googleBooksRes, openLibRes, gamesRes, streamRes] = await Promise.allSettled([
          fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${TMDB_KEY}&language=en-US`)
            .then((r) => r.json()),
          // Google Books — primary
          fetch('https://www.googleapis.com/books/v1/volumes?q=dune+OR+sapiens+OR+atomic+habits+OR+the+alchemist&orderBy=relevance&maxResults=12&printType=books')
            .then((r) => r.json()),
          // Open Library — fallback (no key needed, global CDN)
          fetch('https://openlibrary.org/search.json?q=bestseller&limit=12&fields=key,title,author_name,first_publish_year,cover_i,ratings_average')
            .then((r) => r.json()),
          fetch(`https://api.rawg.io/api/games?key=${RAWG_KEY}&ordering=-rating&page_size=10&metacritic=80,100`)
            .then((r) => r.json()),
          // Stream tab: popular movies with multi-link
          fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=en-US&page=1`)
            .then((r) => r.json()),
        ]);

        if (cancelled) return;

        // ─── Movies ────────────────────────────────────────────────────────
        const movies = moviesRes.status === 'fulfilled' && Array.isArray(moviesRes.value?.results)
          ? moviesRes.value.results.slice(0, 10).map((m) => ({
              id: String(m.id),
              title: m.title,
              poster: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
              rating: m.vote_average?.toFixed(1),
              year: m.release_date?.slice(0, 4),
              link: `https://www.youtube.com/results?search_query=${encodeURIComponent(m.title + ' official trailer')}`,
            }))
          : [];

        // ─── Books: try Google Books first, fall back to Open Library ──────
        let books = [];

        const gItems = googleBooksRes.status === 'fulfilled' ? googleBooksRes.value?.items : null;
        if (Array.isArray(gItems) && gItems.length > 0) {
          books = gItems.slice(0, 10).map((b) => {
            const info = b.volumeInfo || {};
            const thumb = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
            return {
              id: b.id,
              title: info.title || 'Unknown',
              poster: thumb ? thumb.replace('http:', 'https:').replace('&edge=curl', '') : null,
              rating: info.averageRating ? String(info.averageRating.toFixed(1)) : null,
              year: info.publishedDate?.slice(0, 4) || null,
              // ✅ direct book page — always opens correctly
              link: `https://books.google.com/books?id=${b.id}`,
            };
          }).filter((b) => b.title && b.title !== 'Unknown');
        }

        // If Google Books returned nothing → use Open Library
        if (books.length === 0) {
          const olDocs = openLibRes.status === 'fulfilled' ? openLibRes.value?.docs : null;
          if (Array.isArray(olDocs) && olDocs.length > 0) {
            books = olDocs.slice(0, 10).map((b, i) => {
              const coverId = b.cover_i;
              return {
                id: `ol-${b.key || i}`,
                title: b.title || 'Unknown',
                poster: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null,
                rating: b.ratings_average ? String(Number(b.ratings_average).toFixed(1)) : null,
                year: b.first_publish_year ? String(b.first_publish_year) : null,
                link: `https://openlibrary.org${b.key}`,
              };
            }).filter((b) => b.title && b.title !== 'Unknown');
          }
        }

        // ─── Games ─────────────────────────────────────────────────────────
        const games = gamesRes.status === 'fulfilled' && Array.isArray(gamesRes.value?.results)
          ? gamesRes.value.results.slice(0, 10).map((g) => ({
              id: String(g.id),
              title: g.name,
              poster: g.background_image || null,
              rating: g.rating?.toFixed(1),
              year: g.released?.slice(0, 4),
              link: `https://rawg.io/games/${g.slug || g.id}`,
            }))
          : [];

        // ─── Stream: popular movies with 3 sub-links ───────────────────────
        const stream = streamRes.status === 'fulfilled' && Array.isArray(streamRes.value?.results)
          ? streamRes.value.results.slice(0, 10).map((m) => ({
              id: `stream-${m.id}`,
              title: m.title,
              poster: m.poster_path ? `https://image.tmdb.org/t/p/w300${m.poster_path}` : null,
              rating: m.vote_average?.toFixed(1),
              year: m.release_date?.slice(0, 4),
              streamLinks: {
                youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(m.title + ' full movie free')}`,
                trailer: `https://www.youtube.com/results?search_query=${encodeURIComponent(m.title + ' official trailer')}`,
                imdb:    `https://www.imdb.com/find?q=${encodeURIComponent(m.title)}`,
              },
            }))
          : [];

        setPicks({ movies, books, stream, games });
      } catch (_) {}
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return { picks, loading };
};

/* ─── Single pick card (Movies / Books / Games) ──────────────────────────────── */
const PickCard = React.memo(({ item, accent, isDark }) => {
  const { scale, onPressIn, onPressOut } = usePressScale(0.94);

  const handleOpen = useCallback(() => {
    if (!item.link) return;
    Linking.openURL(item.link).catch(() => {});
  }, [item.link]);

  return (
    <TouchableOpacity
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={handleOpen}
      activeOpacity={1}
      style={{ width: 120, marginRight: 12 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={{ width: 120, height: 170, borderRadius: 14, overflow: 'hidden', backgroundColor: isDark ? '#1C1C1E' : '#EEE', marginBottom: 8 }}>
          {item.poster ? (
            <Image source={{ uri: item.poster }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="image-outline" size={32} color={isDark ? '#444' : '#CCC'} />
            </View>
          )}
          {item.rating && (
            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="star" size={9} color="#FFD200" />
              <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>{item.rating}</Text>
            </View>
          )}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: accent + 'DD', borderRadius: 8, paddingVertical: 5 }}>
              <Ionicons name="open-outline" size={10} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>OPEN</Text>
            </View>
          </View>
        </View>
        <Text style={{ color: isDark ? '#EEE' : '#222', fontSize: 11, fontWeight: '800', lineHeight: 15 }} numberOfLines={2}>{item.title}</Text>
        {item.year && <Text style={{ color: isDark ? '#555' : '#AAA', fontSize: 10, fontWeight: '600', marginTop: 2 }}>{item.year}</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
});

/* ─── Stream card — 3 sub-tabs: YouTube full / Trailer / IMDB ────────────────── */
const StreamCard = React.memo(({ item, isDark }) => {
  const [activeSub, setActiveSub] = useState('youtube');
  const { scale, onPressIn, onPressOut } = usePressScale(0.94);

  const handleOpen = useCallback(() => {
    const url = item.streamLinks?.[activeSub];
    if (url) Linking.openURL(url).catch(() => {});
  }, [item.streamLinks, activeSub]);

  return (
    <TouchableOpacity
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={handleOpen}
      activeOpacity={1}
      style={{ width: 140, marginRight: 12 }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={{ width: 140, height: 195, borderRadius: 14, overflow: 'hidden', backgroundColor: isDark ? '#1C1C1E' : '#EEE', marginBottom: 8 }}>
          {item.poster ? (
            <Image source={{ uri: item.poster }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="film-outline" size={32} color={isDark ? '#444' : '#CCC'} />
            </View>
          )}
          {item.rating && (
            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="star" size={9} color="#FFD200" />
              <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>{item.rating}</Text>
            </View>
          )}
          {/* Sub-tab row at bottom of poster */}
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 5, paddingVertical: 6 }}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {STREAM_SUBTABS.map((sub) => {
                const isActive = activeSub === sub.id;
                return (
                  <TouchableOpacity
                    key={sub.id}
                    onPress={() => setActiveSub(sub.id)}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      paddingVertical: 4,
                      borderRadius: 7,
                      backgroundColor: isActive ? sub.color : 'rgba(255,255,255,0.1)',
                      borderWidth: isActive ? 0 : 1,
                      borderColor: 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <Text style={{ color: '#FFF', fontSize: 7, fontWeight: '900' }} numberOfLines={1}>
                      {sub.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
        <Text style={{ color: isDark ? '#EEE' : '#222', fontSize: 11, fontWeight: '800', lineHeight: 15 }} numberOfLines={2}>{item.title}</Text>
        {item.year && <Text style={{ color: isDark ? '#555' : '#AAA', fontSize: 10, fontWeight: '600', marginTop: 2 }}>{item.year}</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
});

/* ─── Kliq Picks Section ─────────────────────────────────────────────────────── */
const KliqPicksSection = React.memo(({ isDark, onDropPulse }) => {
  const { picks, loading } = useKliqPicks();
  const [activeTab, setActiveTab] = useState('movies');

  const activeTabMeta = PICKS_TABS.find((t) => t.id === activeTab);
  const activeItems = picks[activeTab] || [];
  const isStream = activeTab === 'stream';

  return (
    <View style={[localStyles.section, { marginBottom: 10 }]}>
      {/* Header */}
      <View style={localStyles.sectionHeaderRow}>
        <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB', paddingHorizontal: 0 }]}>
          KLIQ PICKS 🍿
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(229,46,113,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
          <Ionicons name="sparkles" size={9} color="#E52E71" style={{ marginRight: 4 }} />
          <Text style={{ color: '#E52E71', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>TRENDING</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 14 }}>
        {PICKS_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => { haptic('select'); setActiveTab(tab.id); }}
              activeOpacity={0.85}
              style={{
                paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
                backgroundColor: isActive ? tab.color : (isDark ? '#1C1C1E' : '#F0F2F5'),
                borderWidth: 1.5,
                borderColor: isActive ? 'transparent' : (isDark ? '#333' : '#E5E7EB'),
              }}
            >
              <Text style={{ color: isActive ? '#FFF' : (isDark ? '#888' : '#666'), fontWeight: '900', fontSize: 12 }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Stream hint */}
      {isStream && !loading && activeItems.length > 0 && (
        <Text style={{ paddingHorizontal: 20, fontSize: 10, color: isDark ? '#666' : '#AAA', fontWeight: '600', marginBottom: 10 }}>
          Pick a tab · tap the card to open
        </Text>
      )}

      {/* Cards */}
      {loading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: 120, marginRight: 12 }}>
              <Skeleton width={120} height={170} radius={14} isDark={isDark} style={{ marginBottom: 8 }} />
              <Skeleton width={100} height={11} isDark={isDark} style={{ marginBottom: 4 }} />
              <Skeleton width={60} height={10} isDark={isDark} />
            </View>
          ))}
        </ScrollView>
      ) : activeItems.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          snapToInterval={isStream ? 152 : 132}
          decelerationRate="fast"
        >
          {activeItems.map((item) =>
            isStream ? (
              <StreamCard key={item.id} item={item} isDark={isDark} />
            ) : (
              <PickCard
                key={item.id}
                item={item}
                accent={activeTabMeta?.color || '#E52E71'}
                isDark={isDark}
              />
            )
          )}
        </ScrollView>
      ) : (
        <View style={{ paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center' }}>
          <Text style={{ color: isDark ? '#444' : '#CCC', fontSize: 12, fontWeight: '700' }}>
            {isStream ? 'No movies loaded right now 🎬' : 'Nothing to show here yet'}
          </Text>
        </View>
      )}
    </View>
  );
});

export default function HomeScreen({ setSecondSheet }) {
  const navigation = useNavigation(); // 👈 הנה מנוע הניווט שלנו!
  const {
    user,
    pulses = [],
    aiRecommendations,
    refreshAllData,
    setPulseCreateOpen,
    trendingTopics = [], // 👈 נשתמש בזה לחישוב הוייב
    liveZones = [],
    fetchExploreData,
    userSettings,
    findStreamRouletteMatch,
    isRouletteSearching,
    // Optional fields — backend can ship these incrementally; UI degrades safely.
    userStreak = 0,
    forYouFeed = [],
    topCreators = [],
    weeklyChallenge = null,
    fetchWeeklyChallenge,
  } = useAppStore();

  // 👇 הקוד החדש - מדומה, דינמי ומרגיש אמיתי לגמרי
  const dynamicCommunityVibe = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const hour = now.getHours();

    // קובעים בסיס יציב של 82%
    const baseVibe = 82;
    
    // Math.sin ו-Math.cos מייצרים תנודתיות עדינה דמוית-גל:
    // תנודה שמשתנה מיום ליום (בין מינוס 10 לפלוס 10)
    const dailyFluctuation = Math.sin(day) * 10;
    
    // תנודה שמשתנה משעה לשעה (בין מינוס 6 לפלוס 6)
    const hourlyFluctuation = Math.cos(hour) * 6;

    // מחברים הכל יחד למספר שלם
    let simulatedVibe = Math.floor(baseVibe + dailyFluctuation + hourlyFluctuation);

    // חיתוך סופי כדי לוודא שזה לעולם לא מתחת ל-65% (מת) ולעולם לא 100% (מזויף)
    return Math.min(98, Math.max(65, simulatedVibe));
  }, [trendingTopics]);

  const [refreshing, setRefreshing] = useState(false);
  const [activeVibeFilter, setActiveVibeFilter] = useState('All');
  const [viewingStory, setViewingStory] = useState(null);
  const [realityData, setRealityData] = useState({ weather: null, news: null, loading: true });

  const isHandlingPress = useRef(false);
  const isDark = userSettings?.darkMode === true;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseBtnAnim = useRef(new Animated.Value(1)).current;

  // ─── Data: reality context ─────────────────────────────────────────────────
  const fetchRealityContext = useCallback(async () => {
    try {
      const data = await fetchAPI('/ai/context');
      setRealityData({ weather: data?.weather ?? null, news: data?.news ?? null, loading: false });
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.warn('[HomeScreen] Failed to fetch reality context:', err);
      setRealityData((prev) => ({ ...prev, loading: false }));
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }
  }, [fadeAnim]);

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchExploreData?.();
    fetchWeeklyChallenge?.();
    const t = setTimeout(() => fetchRealityContext(), 300);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseBtnAnim, { toValue: 1.03, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseBtnAnim, { toValue: 1,    duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseBtnAnim]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptic('select');
    try {
      if (refreshAllData) await refreshAllData();
      await Promise.all([fetchExploreData?.(), fetchRealityContext()]);
      haptic('success');
    } catch (err) {
      console.warn('[HomeScreen] onRefresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshAllData, fetchExploreData, fetchRealityContext]);

  // ─── Derived data ──────────────────────────────────────────────────────────
  const myPulse = useMemo(
    () => pulses.find((p) => p.author?.id === user?.id && STANDARD_VIBES.has(p.vibe)),
    [pulses, user?.id]
  );

  const otherPulses = useMemo(
    () => pulses.filter((p) => p.author?.id !== user?.id && STANDARD_VIBES.has(p.vibe)),
    [pulses, user?.id]
  );

  // Community vibe filter — applies to the pulse strip
  const filteredOtherPulses = useMemo(() => {
    if (activeVibeFilter === 'All') return otherPulses;
    return pulses.filter(
      (p) => p.author?.id !== user?.id && p.vibe === activeVibeFilter
    );
  }, [otherPulses, pulses, activeVibeFilter, user?.id]);

  // NO slice — show ALL trends, sorted by velocity/count
  const rankedTrends = useMemo(() => {
    if (!Array.isArray(trendingTopics)) return [];
    return [...trendingTopics].sort((a, b) => {
      const av = Number(a?.velocity);
      const bv = Number(b?.velocity);
      if (Number.isFinite(av) && Number.isFinite(bv)) return bv - av;
      return (Number(b?.count) || 0) - (Number(a?.count) || 0);
    });
  }, [trendingTopics]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const withDebounce = useCallback((fn) => {
    if (isHandlingPress.current) return;
    isHandlingPress.current = true;
    try { fn?.(); } finally {
      setTimeout(() => { isHandlingPress.current = false; }, 500);
    }
  }, []);

  const handlePulsePress = useCallback((pulse, isMe) => {
    withDebounce(() => {
      haptic('light');
      if (isMe && !pulse) {
        setPulseCreateOpen(true);
      } else {
        setViewingStory(pulse);
      }
    });
  }, [setPulseCreateOpen, withDebounce]);

  // ✅ Smart routing via trendRouter — each kind navigates to its real sheet
  const handleTrendPress = useCallback((trend) => {
    withDebounce(() => {
      const heat = getTrendHeat(trend);
      haptic(heat === TREND_HEAT.NUCLEAR ? 'heavy' : 'medium');

      const route = routeTrend(trend);
      setSecondSheet?.({ ...route, isDark, trend: trend.tag });
    });
  }, [setSecondSheet, isDark, withDebounce]);

  // ✅ Existing sheet — works
  const handleAiPress = useCallback(() => {
    withDebounce(() => {
      haptic('light');
      setSecondSheet?.({ source: 'AI_RECOMMENDATIONS_FULL', isDark });
    });
  }, [setSecondSheet, isDark, withDebounce]);

  // ✅ Existing sheet — works
  const handleLivePress = useCallback((zone) => {
    withDebounce(() => {
      haptic('medium');
      setSecondSheet?.({ source: 'LiveRoom', roomId: zone.id, roomName: zone.name, zone, isDark });
    });
  }, [setSecondSheet, isDark, withDebounce]);

  const handleRoulette = useCallback(() => {
    withDebounce(() => {
      haptic('heavy');
      findStreamRouletteMatch?.();
    });
  }, [findStreamRouletteMatch, withDebounce]);

  // Streak & Challenge → open Pulse Create (real, existing sheet)
  const handleStreakPress = useCallback(() => {
    withDebounce(() => {
      haptic('light');
      setPulseCreateOpen?.(true);
    });
  }, [setPulseCreateOpen, withDebounce]);

  const handleChallengePress = useCallback(() => {
    withDebounce(() => {
      haptic('medium');
      setPulseCreateOpen?.(true);
    });
  }, [setPulseCreateOpen, withDebounce]);

  const handlePickDropPulse = useCallback((item) => {
    withDebounce(() => {
      haptic('medium');
      // Opens pulse create — user drops a pulse about this movie/book/game
      setPulseCreateOpen?.(true);
    });
  }, [setPulseCreateOpen, withDebounce]);

  // Community Hub — filters the pulse strip and opens create with vibe context
  const handleCommunityHubPress = useCallback((hub) => {
    withDebounce(() => {
      haptic('medium');
      // Toggle: pressing the already-active hub resets to All
      setActiveVibeFilter((prev) => (prev === hub.id ? 'All' : hub.id));
      // Trigger pulse create so users can drop a pulse for this community
      setTimeout(() => setPulseCreateOpen?.(true), 150);
    });
  }, [withDebounce, setPulseCreateOpen]);

  // ═════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════════════════════════
  const greeting = getGreeting();
  const displayName = user?.fullName?.split(' ')[0] || user?.name || user?.username || 'Friend';
  const headlines = parseNewsHeadlines(realityData.news);
  const weatherIcon = getWeatherIcon(realityData.weather);
  const weatherShort = realityData.weather ? (String(realityData.weather).match(/\d+°C/)?.[0] || String(realityData.weather).split(',')[0] || '—') : 'N/A';

  return (
    <View style={[localStyles.container, { backgroundColor: isDark ? '#000' : '#FFF' }]}>
     <ScrollView
        contentContainerStyle={localStyles.flatListContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Data.brand.blue}
            colors={[Data.brand.blue]}
          />
        }
      >
        <View style={localStyles.headerWrapper}>
          {/* ── 1. PERSONAL TOP HEADER ─────────────────────────────────────── */}
          <Animated.View
            style={[
              localStyles.topHeaderContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-15, 0] }) }],
              },
            ]}
          >
            <View style={{ flex: 1, paddingRight: 15 }}>
              <Text
                style={[localStyles.greetingText, { color: isDark ? '#FFF' : Data.brand.ink }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {greeting}, <Text style={{ color: Data.brand.blue }}>{displayName}</Text>
              </Text>
              <Text style={[localStyles.dateText, { color: isDark ? '#888' : '#666' }]} numberOfLines={1}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>
            <View
              style={[
                localStyles.weatherPill,
                { backgroundColor: isDark ? '#1C1C1E' : '#F0F2F5', borderColor: isDark ? '#333' : '#E5E7EB' },
              ]}
            >
              {realityData.loading ? (
                <ActivityIndicator size="small" color={Data.brand.blue} />
              ) : (
                <>
                  <Ionicons name={weatherIcon} size={18} color={Data.brand.blue} />
                  <Text style={[localStyles.weatherText, { color: isDark ? '#FFF' : '#333' }]}>{weatherShort}</Text>
                </>
              )}
            </View>
          </Animated.View>

          {/* ── 2. PULSES ──────────────────────────────────────────────────── */}
          <View style={[localStyles.section, { marginTop: 10, marginBottom: 8 }]}>
            <View style={localStyles.sectionHeaderRow}>
              <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB', paddingHorizontal: 0 }]}>
                KLIQ PULSES ⚡
              </Text>
              {activeVibeFilter !== 'All' && (
                <TouchableOpacity
                  onPress={() => { haptic('select'); setActiveVibeFilter('All'); }}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#222' : '#EEE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, gap: 4 }}
                >
                  <Ionicons name="close-circle" size={12} color={isDark ? '#888' : '#666'} />
                  <Text style={{ color: isDark ? '#888' : '#666', fontSize: 10, fontWeight: '800' }}>CLEAR</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── 3 Vibe Filter Tabs */}
            <VibeFilterBar activeFilter={activeVibeFilter} onFilterChange={setActiveVibeFilter} isDark={isDark} />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[localStyles.pulseScroll, { marginTop: 8 }]}>
              <PulseCircle
                user={user}
                activePulse={myPulse}
                isMe
                onPress={() => handlePulsePress(myPulse, true)}
                isDark={isDark}
              />
              {filteredOtherPulses.map((pulse) => (
                <PulseCircle
                  key={pulse.id}
                  user={pulse.author}
                  activePulse={pulse}
                  isMe={false}
                  onPress={() => handlePulsePress(pulse, false)}
                  isDark={isDark}
                />
              ))}
              {filteredOtherPulses.length === 0 && activeVibeFilter !== 'All' && (
                <View style={{ justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 10 }}>
                  <Text style={{ color: isDark ? '#555' : '#BBB', fontSize: 12, fontWeight: '700' }}>
                    Be the first to drop a {activeVibeFilter} pulse! 🔥
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>

          {/* ── 4. KLIQ PULSE BOARD — PRESERVED (reads dark mode from store) ─ */}
          <KliqPulseBoard isDark={isDark} />

          {/* ── 5 COMMUNITY VIBE TRACKER ── */}
          <CommunityVibeTracker isDark={isDark} motivation={dynamicCommunityVibe} />

          {/* ── 6. THE WORLD RIGHT NOW (News — visual only) ────────────────── */}
          {realityData.loading ? (
            <View style={[localStyles.section, { marginTop: 0 }]}>
              <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB' }]}>WORLD VIBE 🌍</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.newsScroll}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      localStyles.newsCard,
                      { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? '#333' : '#E5E7EB' },
                    ]}
                  >
                    <Skeleton width={28} height={28} radius={14} isDark={isDark} style={{ marginBottom: 12 }} />
                    <Skeleton width={180} height={14} isDark={isDark} style={{ marginBottom: 6 }} />
                    <Skeleton width={140} height={14} isDark={isDark} />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : headlines.length > 0 ? (
            <Animated.View style={[localStyles.section, { opacity: fadeAnim }]}>
              <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB' }]}>WORLD VIBE 🌍</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={localStyles.newsScroll}
                snapToInterval={235}
                decelerationRate="fast"
              >
                {headlines.map((headline, index) => (
                  <View
                    key={`${index}-${headline.slice(0, 12)}`}
                    style={[
                      localStyles.newsCard,
                      { backgroundColor: isDark ? '#1C1C1E' : '#FFF', borderColor: isDark ? '#333' : '#E5E7EB' },
                    ]}
                  >
                    <View style={localStyles.newsIconBadge}>
                      <Ionicons name="flash" size={14} color="#FFF" />
                    </View>
                    <Text style={[localStyles.newsHeadline, { color: isDark ? '#DDD' : '#333' }]} numberOfLines={3}>
                      {headline}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}

          {/* ── 7. KLIQMIND LABS ────────────────────────────────────────────── */}
          <View style={[localStyles.section, { marginBottom: 40 }]}>
            <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB' }]}>AI HUBS 🔮</Text>
            <View style={{ paddingHorizontal: 20 }}>
              <Animated.View style={{ transform: [{ scale: pulseBtnAnim }] }}>
                <TouchableOpacity
                  onPress={() => {
                    haptic('heavy');
                    if (navigation) {
                     navigation.navigate('KliqCameraFilters');
                    } else {
                      alert('שגיאת ניווט! ודא ששם המסך "Camera" תקין בראוטר.');
                    }
                  }}
                  activeOpacity={0.85}
                  style={{
                    borderRadius: 24,
                    elevation: 12,
                    shadowColor: '#FF2D55',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.5,
                    shadowRadius: 16,
                  }}
                >
                  <LinearGradient
                    colors={['#FF2D55', '#8E2DE2', '#4A00E0']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 18,
                      borderRadius: 24,
                    }}
                  >
                    <View style={{
                      backgroundColor: 'rgba(255,255,255,0.25)',
                      width: 54,
                      height: 54,
                      borderRadius: 27,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.5)'
                    }}>
                      <Ionicons name="color-wand" size={28} color="#FFF" />
                    </View>
                    <View style={{ marginLeft: 16, flex: 1 }}>
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.5, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 4 }}>
                        MAGIC KLIQ FILTERS
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 3, fontWeight: '600' }}>
                        Transform your reality ✨
                      </Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 16 }}>
                      <Ionicons name="arrow-forward" size={20} color="#FFF" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          {/* ── 8. AI CARD ─────────────────────────────────────────────────── */}
          <AiGeniusCard recommendations={aiRecommendations} isDark={isDark} onPress={handleAiPress} />

          
          {/* ── 9. QUICK ACCESS — Vibe Roulette ───────────────────────────── */}
          <View style={localStyles.section}>
            <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB' }]}>KLIQ ROULETTE ⚡</Text>
            <View style={localStyles.quickAccessContainer}>
              <Animated.View style={{ transform: [{ scale: pulseBtnAnim }] }}>
                <TouchableOpacity
                  onPress={handleRoulette}
                  disabled={isRouletteSearching}
                  style={[
                    localStyles.rouletteBtn,
                    { backgroundColor: isRouletteSearching ? Data.brand.soft : (isDark ? '#0A0A0A' : '#000') },
                  ]}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Start Vibe Roulette"
                >
                  <View style={localStyles.rouletteGlow}>
                    <Ionicons name={isRouletteSearching ? 'hourglass-outline' : 'shuffle'} size={28} color="#FFF" />
                  </View>
                  <View style={{ marginLeft: 15, flex: 1 }}>
                    <Text style={localStyles.rouletteTitle}>
                      {isRouletteSearching ? 'SEARCHING VIBES...' : 'VIBE ROULETTE'}
                    </Text>
                    <Text style={localStyles.rouletteSub}>{isRouletteSearching ? 'Scanning the network for a match…' : 'Tap to get matched with a live vibe'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>

          {/* ── 10. FOR YOU (visual only) ───────────────────────────────────── */}
          {forYouFeed.length > 0 && (
            <View style={localStyles.section}>
              <View style={localStyles.sectionHeaderRow}>
                <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB', paddingHorizontal: 0 }]}>
                  FOR YOU ✨
                </Text>
                <Ionicons name="sparkles" size={12} color={Data.brand.blue} style={{ marginLeft: 6 }} />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={localStyles.featuredScroll}
                snapToInterval={width * 0.7}
                decelerationRate="fast"
              >
                {forYouFeed.map((item, i) => (
                  <ForYouCard key={item?.id || i} item={item} isDark={isDark} />
                ))}
              </ScrollView>
            </View>
          )}

         {/* ── 11. COMMUNITY HUBS — Food · Gym · Music ─────────────────────── */}
          <View style={[localStyles.section, { marginBottom: 10 }]}>
            <View style={localStyles.sectionHeaderRow}>
              <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB', paddingHorizontal: 0 }]}>
                KLIQ HUBS 🔥
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(142,45,226,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#8E2DE2', marginRight: 5 }} />
                <Text style={{ color: '#8E2DE2', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>CEBU</Text>
              </View>
            </View>

           {/* ── 12 Hub description */}
            <Text style={{ paddingHorizontal: 20, fontSize: 11, color: isDark ? '#666' : '#999', fontWeight: '600', marginBottom: 14, letterSpacing: 0.2 }}>
            PULSES  → DROP YOUR PULSE FOR THAT COMMUNITY
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 10, paddingTop: 4 }}
            >
              {COMMUNITY_HUBS.map((hub, index) => (
                <CommunityHubCard
                  key={hub.id}
                  hub={hub}
                  index={index}
                  isDark={isDark}
                  isActive={activeVibeFilter === hub.id}
                  onPress={() => handleCommunityHubPress(hub)}
                />
              ))}
            </ScrollView>
          </View>

           {/* ── 13. CHALLENGE OF THE DAY ───────────────────────────────────── */}
          {weeklyChallenge && (
            <View style={[localStyles.section, { marginBottom: 30 }]}>
              <ChallengeCard challenge={weeklyChallenge} isDark={isDark} onPress={handleChallengePress} />
            </View>
          )}

          {/* ── 14. COMMUNITY PULSE SHORTCUT ────────────────────────────────── */}
          {/* Arena הוסר — יש לו טאב משלו בסרגל התחתון */}
          <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
            <TouchableOpacity
              onPress={() => { haptic('medium'); navigation.navigate('Feed'); }}
              activeOpacity={0.88}
              style={{ borderRadius: 22, overflow: 'hidden', elevation: 10, shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14 }}
            >
              <LinearGradient
                colors={isDark ? ['#1A0A00', '#2A1200'] : ['#FFF5EF', '#FFE8D6']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderWidth: 1, borderColor: isDark ? 'rgba(255,107,53,0.3)' : 'rgba(255,107,53,0.2)', borderRadius: 22 }}
              >
                <LinearGradient colors={['#FF6B35', '#C0392B']} style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="grid" size={24} color="#FFF" />
                </LinearGradient>
                <View style={{ marginLeft: 16, flex: 1 }}>
                  <Text style={{ color: isDark ? '#FFF' : '#1A0A00', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }}>COMMUNITY PULSE</Text>
                  <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontSize: 12, marginTop: 3, fontWeight: '600' }}>Food · Gym · Music — swipe to explore</Text>
                </View>
                <View style={{ backgroundColor: '#FF6B35', padding: 8, borderRadius: 16 }}>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* ── 15. HOT TRENDS ──────────────────────────────────────────────── */}
          {rankedTrends.length > 0 && (
            <View style={[localStyles.section, { paddingHorizontal: 0 }]}>
              <View style={[localStyles.sectionHeaderRow, { paddingHorizontal: 20 }]}>
                <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB', paddingHorizontal: 0 }]}>
                  HOT TRENDS 🔥
                </Text>
                <View style={localStyles.liveHeaderBadge}>
                  <View style={localStyles.liveDot} />
                  <Text style={localStyles.liveHeaderBadgeText}>LIVE</Text>
                </View>
              </View>

              {/* 👇 העטיפה הקריטית לאנדרואיד נוספה כאן */}
              <View style={localStyles.trendsScrollWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={localStyles.trendsScrollSupreme}
                >
                  {rankedTrends.map((trend, idx) => (
                    <TrendCardSupreme
                      key={trend.id || trend.tag || idx}
                      trend={trend}
                      rank={idx + 1}
                      isDark={isDark}
                      onPress={() => handleTrendPress(trend)}
                    />
                  ))}
                </ScrollView>
              </View>
              
            </View>
          )}

          {/* ── 15b. KLIQ PICKS — Movies · Books · Games ──────────────────── */}
          <KliqPicksSection isDark={isDark} onDropPulse={handlePickDropPulse} />

          {/* ── 16. KLIQ SPOTLIGHT — Cebu community edition ─────────────────── */}
          <View style={localStyles.section}>
            <View style={localStyles.sectionHeaderRow}>
              <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB', paddingHorizontal: 0 }]}>
                KLIQ SPOTLIGHT 📍
              </Text>
              <Text style={{ color: isDark ? '#555' : '#BBB', fontSize: 10, fontWeight: '700' }}>CEBU</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.featuredScroll}>
              {SPECIAL_SPOTLIGHT.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  activeOpacity={0.88}
                  onPress={() => haptic('light')}
                  style={localStyles.featuredCard}
                >
                  <ImageBackground source={{ uri: card.img }} style={localStyles.featuredImg} imageStyle={{ borderRadius: 12 }}>
                    <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.80)']} style={localStyles.featuredOverlay}>
                      <Text style={localStyles.featuredTitle}>{card.title}</Text>
                    </LinearGradient>
                  </ImageBackground>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── 17. LIVE NOW — shows real liveZones from store; loading skeleton while empty ── */}
          <View style={localStyles.section}>
            <View style={localStyles.rowBetween}>
              <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB' }]}>LIVE NOW 🔴</Text>
              {liveZones.length > 0 && (
                <View style={localStyles.liveHeaderBadge}>
                  <View style={localStyles.liveDot} />
                  <Text style={localStyles.liveHeaderBadgeText}>{liveZones.length} LIVE</Text>
                </View>
              )}
            </View>
            {liveZones.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.liveScroll}>
                {liveZones.map((zone) => (
                  <LiveZoneItem
                    key={zone.id}
                    zone={zone}
                    onPress={handleLivePress}
                    isDark={isDark}
                  />
                ))}
              </ScrollView>
            ) : (
              // * ── 18. Loading skeleton while waiting for real data from store
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.liveScroll}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={localStyles.liveItem}>
                    <View style={[localStyles.liveAvatarContainer]}>
                      <View style={[localStyles.liveAvatar, { backgroundColor: isDark ? '#1C1C1E' : '#EEE', borderColor: 'transparent' }]} />
                    </View>
                    <Skeleton width={50} height={10} radius={5} isDark={isDark} style={{ marginTop: 10 }} />
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* ── 19. TOP CREATORS (visual only) ─────────────────────────────── */}
          {topCreators.length > 0 && (
            <View style={localStyles.section}>
              <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB' }]}>TOP CREATORS 👑</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.creatorScroll}>
                {topCreators.map((c, i) => (
                  <TopCreator key={c?.id || i} creator={c} isDark={isDark} />
                ))}
              </ScrollView>
            </View>
          )}

        </View>
      </ScrollView>

      {viewingStory && <StoryModal item={viewingStory} onClose={() => setViewingStory(null)} />}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const TREND_CARD_H = 130;        // trendCardSupreme height
const TREND_CARD_PADDING = 30;   // paddingBottom inside scroll content

const localStyles = StyleSheet.create({
  container: { flex: 1 },
  flatListContent: { paddingBottom: 100 },
  headerWrapper: { paddingTop: 10 },

  topHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
    marginTop: 10,
  },
  greetingText: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  dateText: { fontSize: 13, marginTop: 4, fontWeight: '500', textTransform: 'uppercase' },
  weatherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  weatherText: { fontSize: 14, fontWeight: '800' },

  section: { marginBottom: 35 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  newsScroll: { paddingHorizontal: 20, gap: 15 },
  newsCard: {
    width: 220,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  newsIconBadge: {
    backgroundColor: Data.brand.blue,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  newsHeadline: { fontSize: 14, fontWeight: '600', lineHeight: 20 },

  quickAccessContainer: { paddingHorizontal: 20 },
  rouletteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    elevation: 6,
    shadowColor: Data.brand.blue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  rouletteGlow: {
    backgroundColor: Data.brand.blue,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rouletteTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  rouletteSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },

  pulseScroll: { paddingHorizontal: 20 },
  pulseItem: { alignItems: 'center', marginRight: 18 },
  pulseBorder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseImg: { width: 62, height: 62, borderRadius: 31 },
  pulseName: {
    fontSize: 10,
    marginTop: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: Data.brand.blue,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },

  aiCardContainer: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    height: 110,
    marginBottom: 30,
    marginTop: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  aiCardBg: { width: '100%', height: '100%' },
  aiOverlay: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  aiRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  aiIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  aiTextContainer: { flex: 1, marginLeft: 15 },
  aiTitle: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  aiDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },

  streakWrap: {
    marginHorizontal: 20,
    borderRadius: 22,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 10,
  },
  streakInner: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  streakFlameWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakNumber: {
    position: 'absolute',
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
    marginTop: 14,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  streakTitle: { color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  streakSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 3 },

  featuredScroll: { paddingHorizontal: 20, gap: 15 },
  featuredCard: { width: width * 0.65, height: 145 },
  featuredImg: { width: '100%', height: '100%' },
  featuredOverlay: { flex: 1, padding: 15, justifyContent: 'flex-end', borderRadius: 12 },
  featuredTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  liveScroll: { paddingHorizontal: 20, gap: 20 },
  liveItem: { alignItems: 'center', width: 66 },
  liveAvatar: { width: 66, height: 66, borderRadius: 33, borderWidth: 2.5, borderColor: '#FF2D55' },
  liveAvatarFallback: { backgroundColor: '#1a0008', justifyContent: 'center', alignItems: 'center' },
  liveName: { fontSize: 11, marginTop: 10, fontWeight: '700' },
  liveAvatarContainer: { position: 'relative', width: 66, height: 66, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  livePulseRing: { position: 'absolute', width: 74, height: 74, borderRadius: 37, borderWidth: 2, borderColor: 'rgba(255, 45, 85, 0.4)' },

  // ─── FIX #8: liveBadge = zone item badge (absolute-positioned over avatar)
  liveBadge: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#FF2D55',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000',
    alignItems: 'center',
  },
  liveBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  liveViewersText: { fontSize: 10, color: '#888', marginTop: 2, fontWeight: '600' },

  // ─── FIX #8: liveHeaderBadge = section header "LIVE" pill (NOT absolute)
  liveHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,45,85,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 10,
    marginBottom: 15,
  },
  liveHeaderBadgeText: { color: '#FF2D55', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF2D55',
    marginRight: 5,
  },

  // ─── FIX #6: HOT TRENDS scroll wrapper with explicit height ───────────────
  // height = card height (130) + paddingBottom inside scroll content (30)
  trendsScrollWrapper: {
    height: TREND_CARD_H + TREND_CARD_PADDING,
  },
  trendsScrollSupreme: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: TREND_CARD_PADDING,
    alignItems: 'flex-start', // ensures cards don't stretch vertically
  },

  trendCardSupreme: {
    width: 184,
    height: TREND_CARD_H,
    borderRadius: 22,
    padding: 14,
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 8,
  },
  trendRankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trendRankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  trendRankText: { color: '#FFF', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  // ⭐ V2: kind chip replaces old heat chip (kept same style key for consistency)
  trendKindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  trendKindText: { color: '#FFF', fontWeight: '900', fontSize: 9, letterSpacing: 0.8 },
  trendHeatEmoji: { fontSize: 11 },
  trendHeatText: { color: '#FFF', fontWeight: '900', fontSize: 9, letterSpacing: 0.8 },
  trendTagSupreme: { color: '#FFF', fontWeight: '900', fontSize: 18, letterSpacing: 0.3 },
  trendMetricsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 5 },
  trendMetricText: { color: 'rgba(255,255,255,0.95)', fontWeight: '700', fontSize: 11 },
  trendDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.6)', marginHorizontal: 3 },

  // ⭐ V2 additions
  trendBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trendFaces: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendFace: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' },
  trendActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
  },
  trendActionText: { color: '#FFF', fontWeight: '900', fontSize: 10, letterSpacing: 0.8 },

  forYouCard: { width: width * 0.7, height: 200, marginRight: 15 },
  forYouOverlay: { flex: 1, padding: 16, justifyContent: 'flex-end', borderRadius: 18 },
  forYouBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(98,0,238,0.85)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
    marginBottom: 10,
  },
  forYouBadgeText: { color: '#FFF', fontWeight: '900', fontSize: 9, letterSpacing: 1 },
  forYouTitle: { color: '#FFF', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  forYouMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 4 },

  challengeWrap: {
    marginHorizontal: 20,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#00C9FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  challengeInner: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  challengeIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeTitle: { color: '#0A0A0A', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  challengeSub: { color: 'rgba(0,0,0,0.7)', fontSize: 12, marginTop: 3 },
  challengeMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  challengeMeta: { color: 'rgba(0,0,0,0.75)', fontSize: 10, fontWeight: '700' },
  challengeDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(0,0,0,0.4)', marginHorizontal: 3 },
  challengeJoinBtn: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
  },
  challengeJoinTxt: { color: '#FFF', fontWeight: '900', fontSize: 11, letterSpacing: 1 },

  creatorScroll: { paddingHorizontal: 20, gap: 16 },
  creatorItem: { alignItems: 'center', width: 76 },
  creatorRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorInner: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorImg: { width: '100%', height: '100%', borderRadius: 32 },
  creatorName: { fontSize: 11, marginTop: 8, fontWeight: '800', maxWidth: 72 },
  creatorMeta: { fontSize: 9, fontWeight: '600', marginTop: 2, maxWidth: 72 },
});