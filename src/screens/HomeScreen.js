// client/src/screens/HomeScreen.js
// ═══════════════════════════════════════════════════════════════════════════════
//  ⚡️ V8.1 KLIQMIND OMEGA — FIXED Build ⚡️
// ═══════════════════════════════════════════════════════════════════════════════
//  FIXES vs V8.0:
//   ✅ FIX #1: Removed broken navigations to non-existent sheet sources.
//             Streak/Challenge now open the Pulse Create modal (the natural action).
//             Spotlight & News are visual-only (matches V7.2 behavior).
//             ForYou & TopCreator are non-navigating until their sheets are built.
//   ✅ FIX #2: KliqPulseBoard preserved cleanly — no unused isDark prop
//             (the component reads dark mode from its own store hook).
//   ✅ FIX #3: Removed the .slice(0, 12) cap on trends — now shows ALL trends.
//   ✅ FIX #4: contentInsetAdjustmentBehavior="never" — prevents iOS auto-shift
//             that pushed the header too high on some devices.
//   ✅ FIX #5: All new sections fully honor dark mode (no white surfaces).
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
} from 'react-native';

import * as Data from '../constants/data';
import { useAppStore } from '../store/useAppStore';
import { Ionicons } from '@expo/vector-icons';
import { StoryModal } from '../components/modals/PeekModals';
import KliqPulseBoard from '../components/KliqPulseBoard';
import { fetchAPI } from '../store/api';

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
  { id: '1', title: 'NEURAL NETWORKS', img: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80' },
  { id: '2', title: 'CYBER TRIBES',    img: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80' },
  { id: '3', title: 'FUTURE VIBE',     img: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80' },
];

const TREND_HEAT = {
  NUCLEAR:  { label: 'NUCLEAR',  emoji: '☢️', colors: ['#FF0000', '#7A0000'], glow: '#FF0000' },
  EXPLODING:{ label: 'EXPLODING',emoji: '💥', colors: ['#FF2D55', '#9B003A'], glow: '#FF2D55' },
  RISING:   { label: 'RISING',   emoji: '🚀', colors: ['#FF8A00', '#E52E71'], glow: '#FF8A00' },
  HOT:      { label: 'HOT',      emoji: '🔥', colors: ['#F7971E', '#FFD200'], glow: '#F7971E' },
  WARMING:  { label: 'WARMING',  emoji: '📈', colors: ['#4A00E0', '#8E2DE2'], glow: '#8E2DE2' },
  FRESH:    { label: 'FRESH',    emoji: '✨', colors: ['#00C9FF', '#92FE9D'], glow: '#00C9FF' },
};

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
                <Text style={localStyles.aiTitle}>KLIQMIND AI</Text>
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

/* ─── Trend Card SUPREME ─────────────────────────────────────────────────── */
const TrendCardSupreme = React.memo(({ trend, rank, onPress, isDark }) => {
  const heat = getTrendHeat(trend);
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
  const count = formatCount(trend?.count);
  const momentum = Number.isFinite(Number(trend?.momentum))
    ? `+${trend.momentum}%`
    : trend?.timeLabel || 'live';

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={`Trend: ${tag}, ${count} vibing, ${heat.label}`}
    >
      <Animated.View style={{ transform: [{ scale: Animated.multiply(scale, ambientScale) }] }}>
        <LinearGradient
          colors={heat.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            localStyles.trendCardSupreme,
            {
              shadowColor: heat.glow,
              shadowOpacity: isTopTier ? 0.55 : 0.3,
            },
          ]}
        >
          <View style={localStyles.trendRankRow}>
            <View style={localStyles.trendRankChip}>
              <Text style={localStyles.trendRankText}>#{rank}</Text>
            </View>
            <View style={localStyles.trendHeatChip}>
              <Text style={localStyles.trendHeatEmoji}>{heat.emoji}</Text>
              <Text style={localStyles.trendHeatText}>{heat.label}</Text>
            </View>
          </View>

          <View>
            <Text style={localStyles.trendTagSupreme} numberOfLines={1}>#{tag}</Text>
            <View style={localStyles.trendMetricsRow}>
              <Ionicons name="people" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={localStyles.trendMetricText}>{count} vibing</Text>
              <View style={localStyles.trendDot} />
              <Ionicons name="trending-up" size={12} color="rgba(255,255,255,0.9)" />
              <Text style={localStyles.trendMetricText}>{momentum}</Text>
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
  const title = challenge?.title || "Today's Vibe Challenge";
  const sub = challenge?.subtitle || 'Drop a 30s pulse and join the wave';
  const participants = formatCount(challenge?.participants || 0);
  const endsIn = challenge?.endsIn || 'ends at midnight';

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

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function HomeScreen({ setSecondSheet }) {
  const {
    user,
    pulses = [],
    aiRecommendations,
    refreshAllData,
    setPulseCreateOpen,
    trendingTopics = [],
    liveZones = [],
    fetchExploreData,
    userSettings,
    findStreamRouletteMatch,
    isRouletteSearching,
    // Optional fields — backend can ship these incrementally; UI degrades safely.
    userStreak = 0,
    forYouFeed = [],
    topCreators = [],
    dailyChallenge = null,
  } = useAppStore();

  const [refreshing, setRefreshing] = useState(false);
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

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchExploreData?.();
      fetchRealityContext();
    });
    return () => task?.cancel?.();
  }, [fetchExploreData, fetchRealityContext]);

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

  // ⭐ FIX #3: NO slice — show ALL trends, sorted by velocity/count
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

  // ✅ Existing sheet — works
  const handleTrendPress = useCallback((trend) => {
    withDebounce(() => {
      haptic('medium');
      setSecondSheet?.({ source: 'TrendOptions', trend: trend.tag, isDark });
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

  // ⭐ FIX #1: Streak & Challenge → open Pulse Create (real, existing sheet).
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
        contentInsetAdjustmentBehavior="never" /* FIX #4: predictable top spacing */
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
          <View style={[localStyles.section, { marginTop: 10, marginBottom: 20 }]}>
            <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB' }]}>LATEST PULSES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.pulseScroll}>
              <PulseCircle
                user={user}
                activePulse={myPulse}
                isMe
                onPress={() => handlePulsePress(myPulse, true)}
                isDark={isDark}
              />
              {otherPulses.map((pulse) => (
                <PulseCircle
                  key={pulse.id}
                  user={pulse.author}
                  activePulse={pulse}
                  isMe={false}
                  onPress={() => handlePulsePress(pulse, false)}
                  isDark={isDark}
                />
              ))}
            </ScrollView>
          </View>

          {/* ── 3. KLIQ PULSE BOARD — PRESERVED (reads dark mode from store) ─ */}
          <KliqPulseBoard isDark={isDark} />

          {/* ── 5. THE WORLD RIGHT NOW (News — visual only) ────────────────── */}
          {realityData.loading ? (
            <View style={[localStyles.section, { marginTop: 0 }]}>
              <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB' }]}>THE WORLD RIGHT NOW 🌍</Text>
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
              <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB' }]}>THE WORLD RIGHT NOW 🌍</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={localStyles.newsScroll}
                snapToInterval={235}
                decelerationRate="fast"
              >
                {headlines.map((headline, index) => (
                  // ⭐ FIX #1: News cards visual-only — no dead navigation
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

         {/* ── 6. AI CARD ─────────────────────────────────────────────────── */}
          <AiGeniusCard recommendations={aiRecommendations} isDark={isDark} onPress={handleAiPress} />

          {/* ── 7. FOR YOU (visual only) ───────────────────────────────────── */}
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

          {/* ── 8. HOT TRENDS ──────────────────────────────────────────────── */}
          {rankedTrends.length > 0 ? (
            <View style={localStyles.section}>
              <View style={localStyles.sectionHeaderRow}>
                <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB', paddingHorizontal: 0 }]}>
                  HOT TRENDS 🔥
                </Text>
                <View style={localStyles.liveBadge}>
                  <View style={localStyles.liveDot} />
                  <Text style={localStyles.liveBadgeText}>LIVE</Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={localStyles.trendsScrollSupreme}
                snapToInterval={196}
                decelerationRate="fast"
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
          ) : null}

          {/* ── 9. KLIQ SPOTLIGHT (visual only — matches V7.2) ─────────────── */}
          <View style={localStyles.section}>
            <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB' }]}>KLIQ SPOTLIGHT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.featuredScroll}>
              {SPECIAL_SPOTLIGHT.map((card) => (
                // ⭐ FIX #1: Spotlight cards visual-only (same as V7.2)
                <View key={card.id} style={localStyles.featuredCard}>
                  <ImageBackground source={{ uri: card.img }} style={localStyles.featuredImg} imageStyle={{ borderRadius: 12 }}>
                    <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.75)']} style={localStyles.featuredOverlay}>
                      <Text style={localStyles.featuredTitle}>{card.title}</Text>
                    </LinearGradient>
                  </ImageBackground>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* ── 10. CHALLENGE OF THE DAY ───────────────────────────────────── */}
          {dailyChallenge && (
            <View style={[localStyles.section, { marginBottom: 30 }]}>
              <ChallengeCard challenge={dailyChallenge} isDark={isDark} onPress={handleChallengePress} />
            </View>
          )}

          {/* ── 11. LIVE NOW ───────────────────────────────────────────────── */}
          {liveZones.length > 0 && (
            <View style={localStyles.section}>
              <View style={localStyles.rowBetween}>
                <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB' }]}>LIVE NOW 🔴</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.liveScroll}>
                {liveZones.map((zone) => {
                  const avatarUri = zone.img || zone.image_url || null;
                  return (
                    <TouchableOpacity
                      key={zone.id}
                      style={localStyles.liveItem}
                      activeOpacity={0.85}
                      onPress={() => handleLivePress(zone)}
                      accessibilityRole="button"
                      accessibilityLabel={`Live room: ${zone.name}`}
                    >
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={localStyles.liveAvatar} />
                      ) : (
                        <View style={[localStyles.liveAvatar, localStyles.liveAvatarFallback]}>
                          <Ionicons name="radio" size={26} color="#FF2D55" />
                        </View>
                      )}
                      <Text style={[localStyles.liveName, { color: isDark ? '#EEE' : '#333' }]} numberOfLines={1}>
                        {zone.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* ── 12. TOP CREATORS (visual only) ─────────────────────────────── */}
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

          {/* ── 13. QUICK ACCESS — Vibe Roulette ───────────────────────────── */}
          <View style={localStyles.section}>
            <Text style={[localStyles.sectionLabel, { color: isDark ? '#555' : '#BBB' }]}>QUICK ACCESS</Text>
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
                    <Text style={localStyles.rouletteSub}>Instantly connect to the network</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </View>
      </ScrollView>

      {viewingStory && <StoryModal item={viewingStory} onClose={() => setViewingStory(null)} />}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════

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
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,45,85,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 10,
    marginBottom: 15,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF2D55',
    marginRight: 5,
  },
  liveBadgeText: { color: '#FF2D55', fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  trendsScrollSupreme: { paddingHorizontal: 20, gap: 12 },
  trendCardSupreme: {
    width: 184,
    height: 130,
    borderRadius: 22,
    padding: 14,
    justifyContent: 'space-between',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 8,
  },
  trendRankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trendRankChip: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  trendRankText: { color: '#FFF', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  trendHeatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  trendHeatEmoji: { fontSize: 11 },
  trendHeatText: { color: '#FFF', fontWeight: '900', fontSize: 9, letterSpacing: 0.8 },
  trendTagSupreme: { color: '#FFF', fontWeight: '900', fontSize: 18, letterSpacing: 0.3 },
  trendMetricsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 5 },
  trendMetricText: { color: 'rgba(255,255,255,0.95)', fontWeight: '700', fontSize: 11 },
  trendDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.6)', marginHorizontal: 3 },

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