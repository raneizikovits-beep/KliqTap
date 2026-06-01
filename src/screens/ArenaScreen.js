// client/src/screens/ArenaScreen.js
// ═══════════════════════════════════════════════════════════════════════════════
//  ⚔️ KLIQTAP — ARENA SCREEN v1.0
//  The competitive heart of KliqTap.
//  Weekly challenges · Live leaderboard · Submit & climb · Fire energy
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
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  StatusBar,
  Platform,
  RefreshControl,
  ImageBackground,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { fetchAPI } from '../store/api';
import * as Data from '../constants/data';

// ─── Optional deps ──────────────────────────────────────────────────────────────
let LinearGradient;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (_) {
  LinearGradient = ({ colors = ['#000'], style, children, ...rest }) => (
    <View style={[{ backgroundColor: colors[0] }, style]} {...rest}>{children}</View>
  );
}
let Haptics;
try {
  Haptics = require('expo-haptics');
} catch (_) {
  Haptics = {
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: { Success: 'success' },
    impactAsync: () => Promise.resolve(),
    notificationAsync: () => Promise.resolve(),
    selectionAsync: () => Promise.resolve(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const { width: W } = Dimensions.get('window');
const IS_IOS = Platform.OS === 'ios';

const ARENA_CHALLENGES = [
  {
    id: 'c1',
    title: '#LamiBai Food King',
    subtitle: 'Drop your most jaw-dropping Cebu dish',
    icon: 'restaurant',
    emoji: '🍖',
    colors: ['#FF6B35', '#C0392B', '#8B0000'],
    accentColor: '#FF6B35',
    endsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
    prize: '500 Kliq Points + KING badge',
    entries: 84,
    active: true,
  },
  {
    id: 'c2',
    title: '#KliqLift Streak',
    subtitle: '5-day gym consistency challenge',
    icon: 'barbell',
    emoji: '🏋️',
    colors: ['#0072FF', '#00C9FF', '#00E5A0'],
    accentColor: '#00C9FF',
    endsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    prize: 'Iron Kliq status + 750 Points',
    entries: 51,
    active: true,
  },
  {
    id: 'c3',
    title: '#SingForKliq Anthem',
    subtitle: 'Best videoke cover this week',
    icon: 'musical-notes',
    emoji: '🎤',
    colors: ['#8E2DE2', '#FF2D55', '#FF6B35'],
    accentColor: '#FF2D55',
    endsAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
    prize: 'Stage Crown + 1,000 Points',
    entries: 132,
    active: true,
  },
  {
    id: 'c4',
    title: '#VibeCheckCebu',
    subtitle: 'Best CYBER/NOIR filter photo',
    icon: 'camera',
    emoji: '📸',
    colors: ['#2C3E50', '#4A00E0', '#8E2DE2'],
    accentColor: '#8E2DE2',
    endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    prize: 'Lens Legend badge + 600 Points',
    entries: 29,
    active: true,
  },
];

const MOCK_LEADERBOARD = [
  { rank: 1,  username: '@lechon_queen',  points: 1840, avatar: null, streak: 12, badge: '👑' },
  { rank: 2,  username: '@ironkliq_bai',  points: 1625, avatar: null, streak: 9,  badge: '🥈' },
  { rank: 3,  username: '@taytop_cebu',   points: 1410, avatar: null, streak: 7,  badge: '🥉' },
  { rank: 4,  username: '@sugbo_grind',   points: 980,  avatar: null, streak: 5,  badge: null  },
  { rank: 5,  username: '@kliqlift_mnl',  points: 840,  avatar: null, streak: 4,  badge: null  },
  { rank: 6,  username: '@cebu_foodtrip', points: 720,  avatar: null, streak: 3,  badge: null  },
  { rank: 7,  username: '@budots_dancer', points: 610,  avatar: null, streak: 6,  badge: null  },
];

const haptic = (k = 'light') => {
  try {
    if (k === 'light')   return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (k === 'medium')  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (k === 'heavy')   return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (k === 'success') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (_) {}
  return Promise.resolve();
};

const fmtNum = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
};

// ═══════════════════════════════════════════════════════════════════════════════
//  HOOKS
// ═══════════════════════════════════════════════════════════════════════════════
const usePressScale = (to = 0.96) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn  = useCallback(() => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 0 }).start(), [scale, to]);
  const onPressOut = useCallback(() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 10 }).start(), [scale]);
  return { scale, onPressIn, onPressOut };
};

const useCountdown = (endsAt) => {
  const [remaining, setRemaining] = useState({ days: 0, hours: 0, mins: 0, secs: 0, expired: false });

  useEffect(() => {
    const tick = () => {
      const diff = new Date(endsAt) - new Date();
      if (diff <= 0) { setRemaining({ days: 0, hours: 0, mins: 0, secs: 0, expired: true }); return; }
      const days  = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs  = Math.floor((diff % (1000 * 60)) / 1000);
      setRemaining({ days, hours, mins, secs, expired: false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return remaining;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  COUNTDOWN UNIT
// ═══════════════════════════════════════════════════════════════════════════════
const CountUnit = React.memo(({ value, label, accentColor }) => {
  const flipAnim = useRef(new Animated.Value(1)).current;
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      flipAnim.setValue(0.6);
      Animated.spring(flipAnim, { toValue: 1, useNativeDriver: true, speed: 35, bounciness: 12 }).start();
    }
  }, [value, flipAnim]);

  const padded = String(value).padStart(2, '0');

  return (
    <View style={{ alignItems: 'center', minWidth: 52 }}>
      <Animated.View
        style={{
          transform: [{ scale: flipAnim }],
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderRadius: 14,
          borderWidth: 1,
          borderColor: accentColor + '44',
          paddingVertical: 10,
          paddingHorizontal: 14,
          marginBottom: 6,
          minWidth: 52,
          alignItems: 'center',
          shadowColor: accentColor,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
          elevation: 4,
        }}
      >
        <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 26, letterSpacing: -1, fontVariant: ['tabular-nums'] }}>
          {padded}
        </Text>
      </Animated.View>
      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 }}>
        {label}
      </Text>
    </View>
  );
});

const TimeSeparator = () => (
  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 22, fontWeight: '900', marginBottom: 18, marginHorizontal: 2 }}>:</Text>
);

// ═══════════════════════════════════════════════════════════════════════════════
//  HERO CHALLENGE CARD
// ═══════════════════════════════════════════════════════════════════════════════
const HeroChallengeCard = React.memo(({ challenge, onSubmit, userEntered }) => {
  const cd = useCountdown(challenge.endsAt);
  const { scale, onPressIn, onPressOut } = usePressScale(0.97);

  // Pulsing glow ring
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ringScale,   { toValue: 1.08, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(ringScale,   { toValue: 1,    duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.2, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.6, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ringScale, ringOpacity]);

  // Floating emoji
  const floatY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -10, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 4,   duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatY]);

  const isUrgent = cd.days === 0 && cd.hours < 6;

  return (
    <TouchableOpacity onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1} style={{ marginHorizontal: 18, marginBottom: 28 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {/* Outer glow ring */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', inset: -6,
            borderRadius: 34,
            borderWidth: 2,
            borderColor: challenge.accentColor,
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          }}
        />

        <LinearGradient
          colors={challenge.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1.2 }}
          style={aStyles.heroCard}
        >
          {/* Top row: badge + entries */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <View style={aStyles.activePill}>
              <View style={[aStyles.activeDot, { backgroundColor: isUrgent ? '#FF2D55' : '#00E5A0' }]} />
              <Text style={aStyles.activePillText}>{isUrgent ? 'ENDS SOON' : 'ACTIVE'}</Text>
            </View>
            <View style={aStyles.entriesChip}>
              <Ionicons name="people" size={11} color="rgba(255,255,255,0.8)" />
              <Text style={aStyles.entriesText}>{fmtNum(challenge.entries)} in</Text>
            </View>
          </View>

          {/* Floating emoji */}
          <Animated.Text style={[aStyles.heroEmoji, { transform: [{ translateY: floatY }] }]}>
            {challenge.emoji}
          </Animated.Text>

          {/* Title */}
          <Text style={aStyles.heroTitle}>{challenge.title}</Text>
          <Text style={aStyles.heroSub}>{challenge.subtitle}</Text>

          {/* Prize row */}
          <View style={aStyles.prizeRow}>
            <Ionicons name="trophy" size={14} color="#FFD200" />
            <Text style={aStyles.prizeText}>{challenge.prize}</Text>
          </View>

          {/* Countdown */}
          <View style={aStyles.countdownRow}>
            <CountUnit value={cd.days}  label="DAYS"  accentColor={challenge.accentColor} />
            <TimeSeparator />
            <CountUnit value={cd.hours} label="HRS"   accentColor={challenge.accentColor} />
            <TimeSeparator />
            <CountUnit value={cd.mins}  label="MINS"  accentColor={challenge.accentColor} />
            <TimeSeparator />
            <CountUnit value={cd.secs}  label="SECS"  accentColor={challenge.accentColor} />
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={onSubmit}
            activeOpacity={0.88}
            style={[
              aStyles.heroCTA,
              userEntered && { backgroundColor: 'rgba(0,229,160,0.25)', borderColor: '#00E5A0' },
            ]}
          >
            <Ionicons
              name={userEntered ? 'checkmark-circle' : 'add-circle'}
              size={20}
              color={userEntered ? '#00E5A0' : '#FFF'}
            />
            <Text style={[aStyles.heroCTAText, userEntered && { color: '#00E5A0' }]}>
              {userEntered ? 'ENTRY SUBMITTED ✓' : 'SUBMIT YOUR ENTRY'}
            </Text>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MINI CHALLENGE CARD (scrollable row)
// ═══════════════════════════════════════════════════════════════════════════════
const MiniChallengeCard = React.memo(({ challenge, onPress, isSelected }) => {
  const { scale, onPressIn, onPressOut } = usePressScale(0.92);
  const cd = useCountdown(challenge.endsAt);
  const isUrgent = cd.days === 0 && cd.hours < 6;

  return (
    <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient
          colors={challenge.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1.5 }}
          style={[
            aStyles.miniCard,
            isSelected && { borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
          ]}
        >
          {isUrgent && (
            <View style={aStyles.urgentBadge}>
              <Text style={{ color: '#FFF', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 }}>⚡ URGENT</Text>
            </View>
          )}
          <Text style={aStyles.miniEmoji}>{challenge.emoji}</Text>
          <Text style={aStyles.miniTitle} numberOfLines={2}>{challenge.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
            <Ionicons name="people" size={10} color="rgba(255,255,255,0.7)" />
            <Text style={aStyles.miniMeta}>{challenge.entries}</Text>
          </View>
          {isSelected && (
            <View style={aStyles.selectedIndicator}>
              <Ionicons name="checkmark-circle" size={16} color="#FFF" />
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  LEADERBOARD ROW
// ═══════════════════════════════════════════════════════════════════════════════
const LeaderboardRow = React.memo(({ entry, isMe, delay = 0 }) => {
  const slideX  = useRef(new Animated.Value(-40)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const barW    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const maxPts = MOCK_LEADERBOARD[0]?.points || 1;
    const pct    = Math.min(1, (entry.points || 0) / maxPts);

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.spring(slideX,  { toValue: 0,   useNativeDriver: true, speed: 18, bounciness: 8, delay: 0 }),
        Animated.timing(opacity, { toValue: 1,   duration: 400,         useNativeDriver: true }),
        Animated.spring(barW,    { toValue: pct, useNativeDriver: false, speed: 12, bounciness: 4 }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, [slideX, opacity, barW, delay, entry.points]);

  const barColor = entry.rank === 1 ? '#FFD200' : entry.rank === 2 ? '#C0C0C0' : entry.rank === 3 ? '#CD7F32' : '#8E2DE2';
  const barWidth = barW.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const avatarLetter = entry.username?.replace('@', '')?.charAt(0)?.toUpperCase() || '?';

  return (
    <Animated.View
      style={[
        aStyles.lbRow,
        isMe && aStyles.lbRowMe,
        { opacity, transform: [{ translateX: slideX }] },
      ]}
    >
      {/* Rank */}
      <View style={aStyles.lbRankWrap}>
        {entry.rank <= 3 ? (
          <Text style={aStyles.lbRankEmoji}>{entry.badge}</Text>
        ) : (
          <Text style={[aStyles.lbRank, { color: isMe ? Data.brand?.blue || '#0A84FF' : 'rgba(255,255,255,0.4)' }]}>
            {entry.rank}
          </Text>
        )}
      </View>

      {/* Avatar */}
      <View style={[aStyles.lbAvatar, isMe && { borderColor: Data.brand?.blue || '#0A84FF' }]}>
        {entry.avatar ? (
          <Image source={{ uri: entry.avatar }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14 }}>{avatarLetter}</Text>
        )}
      </View>

      {/* Name + bar */}
      <View style={{ flex: 1, marginLeft: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
          <Text style={[aStyles.lbName, isMe && { color: Data.brand?.blue || '#0A84FF' }]} numberOfLines={1}>
            {entry.username}{isMe ? ' (you)' : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {entry.streak > 0 && (
              <Text style={aStyles.lbStreak}>🔥{entry.streak}</Text>
            )}
            <Text style={aStyles.lbPoints}>{fmtNum(entry.points)}</Text>
          </View>
        </View>
        <View style={aStyles.lbBarBg}>
          <Animated.View style={[aStyles.lbBarFill, { width: barWidth, backgroundColor: barColor }]} />
        </View>
      </View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ENERGY METER (community-wide participation)
// ═══════════════════════════════════════════════════════════════════════════════
const EnergyMeter = React.memo(({ totalEntries }) => {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const pct = Math.min(100, Math.round((totalEntries / 400) * 100));

  useEffect(() => {
    Animated.spring(fillAnim, { toValue: pct, tension: 18, friction: 7, useNativeDriver: false }).start();
  }, [pct, fillAnim]);

  const widthPct = fillAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  const label =
    pct < 25 ? { text: 'Warming up...', color: '#00C9FF' } :
    pct < 50 ? { text: 'Heating up 🔥', color: '#FF8A00' } :
    pct < 75 ? { text: 'On fire! 💥',   color: '#FF2D55' } :
               { text: 'NUCLEAR ☢️',    color: '#FF0000' };

  return (
    <View style={aStyles.energyWrap}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="flash" size={14} color="#FFD200" />
          <Text style={aStyles.energyLabel}>ARENA ENERGY</Text>
        </View>
        <Text style={[aStyles.energyState, { color: label.color }]}>{label.text}</Text>
      </View>
      <View style={aStyles.energyBarBg}>
        <Animated.View
          style={[aStyles.energyBarFill, { width: widthPct }]}
        >
          <LinearGradient
            colors={['#FFD200', '#FF8A00', '#FF2D55']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1, borderRadius: 6 }}
          />
        </Animated.View>
      </View>
      <Text style={aStyles.energySub}>{totalEntries} total entries across all challenges</Text>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function ArenaScreen({ setSecondSheet }) {
  const navigation = useNavigation();
  const {
    user,
    weeklyChallenge,
    fetchWeeklyChallenge,
    refreshAllData,
    setPulseCreateOpen,
    userSettings,
    userStreak = 0,
  } = useAppStore();

  const isDark = userSettings?.darkMode !== false;
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChallengeIdx, setSelectedChallengeIdx] = useState(0);
  const [enteredChallenges, setEnteredChallenges] = useState(new Set());
  const [leaderboard, setLeaderboard] = useState(MOCK_LEADERBOARD);
  const [lbLoading, setLbLoading] = useState(false);

  const challenges = ARENA_CHALLENGES; // Use real weeklyChallenge from store when available

  // Merge real weekly challenge at top
  const allChallenges = useMemo(() => {
    if (!weeklyChallenge) return challenges;
    const real = {
      id: weeklyChallenge.id || 'wc',
      title: weeklyChallenge.title || 'Weekly Challenge',
      subtitle: weeklyChallenge.description || '',
      icon: 'trophy',
      emoji: '🏆',
      colors: ['#FF2D55', '#8E2DE2', '#4A00E0'],
      accentColor: '#FF2D55',
      endsAt: weeklyChallenge.endsAt ? new Date(weeklyChallenge.endsAt) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      prize: `${weeklyChallenge._count?.entries || 0} entries — win the crown`,
      entries: weeklyChallenge._count?.entries || 0,
      active: true,
    };
    return [real, ...challenges];
  }, [weeklyChallenge, challenges]);

  const selectedChallenge = allChallenges[selectedChallengeIdx] || allChallenges[0];

  // ─── Mount ─────────────────────────────────────────────────────────────────
  const mountAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fetchWeeklyChallenge?.();
    Animated.timing(mountAnim, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    // Try loading real leaderboard
    const loadLb = async () => {
      try {
        setLbLoading(true);
        const data = await fetchAPI('/users/leaderboard?limit=10');
        if (Array.isArray(data) && data.length > 0) {
          setLeaderboard(data.map((u, i) => ({
            rank: i + 1,
            username: u.username ? `@${u.username}` : `@user${i + 1}`,
            points: u.points || 0,
            avatar: u.avatarUrl || null,
            streak: u.streak || 0,
            badge: i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : null,
          })));
        }
      } catch (_) {
        // Keep mock leaderboard
      } finally {
        setLbLoading(false);
      }
    };
    loadLb();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback((challengeId) => {
    haptic('heavy');
    setEnteredChallenges((prev) => {
      const next = new Set(prev);
      next.add(challengeId);
      return next;
    });
    setPulseCreateOpen?.(true);
  }, [setPulseCreateOpen]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptic('select');
    try { await refreshAllData?.(); } catch (_) {}
    setRefreshing(false);
  }, [refreshAllData]);

  const totalEntries = useMemo(
    () => allChallenges.reduce((s, c) => s + (c.entries || 0), 0),
    [allChallenges]
  );

  // User's position in leaderboard
  const myEntry = useMemo(() => {
    if (!user) return null;
    const mine = leaderboard.find((e) => e.username === `@${user.username}` || e.username === user.username);
    if (mine) return mine;
    // If not in top list, show them at the bottom
    return { rank: leaderboard.length + 1, username: `@${user.username || 'you'}`, points: user.points || 0, avatar: user.avatarUrl || null, streak: userStreak, badge: null };
  }, [leaderboard, user, userStreak]);

  return (
    <View style={aStyles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Animated background gradient ── */}
      <LinearGradient
        colors={['#0A0014', '#0D0020', '#080010']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── Header ── */}
      <Animated.View style={[aStyles.header, { opacity: mountAnim }]}>
        {/* ✅ Arena הוא עכשיו טאב — אין back. מציג אייקון trophy במקום */}
        <View style={aStyles.backBtn}>
          <Ionicons name="trophy" size={20} color="#FFD200" />
        </View>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <LinearGradient
            colors={['#FF2D55', '#8E2DE2', '#FFD200']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 4, paddingHorizontal: 14, paddingVertical: 4 }}
          >
            <Text style={aStyles.headerTitle}>⚔️  ARENA</Text>
          </LinearGradient>
          <Text style={aStyles.headerSub}>{allChallenges.length} active challenges</Text>
        </View>

        {/* My rank */}
        {myEntry && (
          <View style={aStyles.myRankChip}>
            <Text style={{ color: '#FFD200', fontWeight: '900', fontSize: 10 }}>#{myEntry.rank}</Text>
          </View>
        )}
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: IS_IOS ? 110 : 90, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8E2DE2" />}
      >
        {/* ── Energy meter ── */}
        <Animated.View style={{ opacity: mountAnim }}>
          <EnergyMeter totalEntries={totalEntries} />
        </Animated.View>

        {/* ── Challenge selector strip ── */}
        <Animated.View style={{ opacity: mountAnim }}>
          <Text style={aStyles.sectionLabel}>CHOOSE YOUR BATTLE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 6 }}
          >
            {allChallenges.map((ch, idx) => (
              <MiniChallengeCard
                key={ch.id}
                challenge={ch}
                isSelected={idx === selectedChallengeIdx}
                onPress={() => { haptic('light'); setSelectedChallengeIdx(idx); }}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {/* ── Hero challenge card ── */}
        <Animated.View
          style={{
            opacity: mountAnim,
            transform: [{ translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
            marginTop: 20,
          }}
        >
          <HeroChallengeCard
            challenge={selectedChallenge}
            onSubmit={() => handleSubmit(selectedChallenge.id)}
            userEntered={enteredChallenges.has(selectedChallenge.id)}
          />
        </Animated.View>

        {/* ── Leaderboard ── */}
        <View style={aStyles.lbSection}>
          <View style={aStyles.lbHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="trophy" size={16} color="#FFD200" />
              <Text style={aStyles.sectionLabel}>LEADERBOARD</Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '700' }}>ALL TIME</Text>
          </View>

          {/* Top 3 podium */}
          <View style={aStyles.podiumRow}>
            {/* 2nd */}
            {leaderboard[1] && (
              <View style={[aStyles.podiumItem, { marginTop: 22 }]}>
                <View style={[aStyles.podiumAvatar, { borderColor: '#C0C0C0', width: 54, height: 54, borderRadius: 27 }]}>
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 18 }}>
                    {leaderboard[1].username?.replace('@', '')?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
                <Text style={aStyles.podiumEmoji}>🥈</Text>
                <Text style={aStyles.podiumName} numberOfLines={1}>{leaderboard[1].username}</Text>
                <Text style={aStyles.podiumPts}>{fmtNum(leaderboard[1].points)}</Text>
                <LinearGradient colors={['#888', '#555']} style={[aStyles.podiumPillar, { height: 50 }]} />
              </View>
            )}
            {/* 1st */}
            {leaderboard[0] && (
              <View style={[aStyles.podiumItem, { marginBottom: 0 }]}>
                <View style={[aStyles.podiumCrown]}>
                  <Text style={{ fontSize: 22 }}>👑</Text>
                </View>
                <View style={[aStyles.podiumAvatar, { borderColor: '#FFD200', width: 68, height: 68, borderRadius: 34, shadowColor: '#FFD200', shadowOpacity: 0.7, shadowRadius: 12, elevation: 10 }]}>
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 24 }}>
                    {leaderboard[0].username?.replace('@', '')?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
                <Text style={aStyles.podiumName} numberOfLines={1}>{leaderboard[0].username}</Text>
                <Text style={[aStyles.podiumPts, { color: '#FFD200', fontSize: 14 }]}>{fmtNum(leaderboard[0].points)}</Text>
                <LinearGradient colors={['#FFD200', '#FF8A00']} style={[aStyles.podiumPillar, { height: 70 }]} />
              </View>
            )}
            {/* 3rd */}
            {leaderboard[2] && (
              <View style={[aStyles.podiumItem, { marginTop: 36 }]}>
                <View style={[aStyles.podiumAvatar, { borderColor: '#CD7F32', width: 48, height: 48, borderRadius: 24 }]}>
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16 }}>
                    {leaderboard[2].username?.replace('@', '')?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
                <Text style={aStyles.podiumEmoji}>🥉</Text>
                <Text style={aStyles.podiumName} numberOfLines={1}>{leaderboard[2].username}</Text>
                <Text style={aStyles.podiumPts}>{fmtNum(leaderboard[2].points)}</Text>
                <LinearGradient colors={['#CD7F32', '#8B4513']} style={[aStyles.podiumPillar, { height: 36 }]} />
              </View>
            )}
          </View>

          {/* Rows 4–7 */}
          <View style={aStyles.lbList}>
            {leaderboard.slice(3).map((entry, i) => (
              <LeaderboardRow
                key={entry.username}
                entry={entry}
                isMe={entry.username === `@${user?.username}`}
                delay={i * 80}
              />
            ))}
            {/* My row if not in top */}
            {myEntry && myEntry.rank > leaderboard.length && (
              <>
                <View style={aStyles.lbDivider} />
                <LeaderboardRow entry={myEntry} isMe delay={0} />
              </>
            )}
          </View>
        </View>

        {/* ── Bottom CTA strip ── */}
        <View style={{ paddingHorizontal: 18, marginTop: 8 }}>
          <TouchableOpacity
            onPress={() => { haptic('heavy'); setPulseCreateOpen?.(true); }}
            activeOpacity={0.88}
            style={{ borderRadius: 24, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={['#FF2D55', '#8E2DE2', '#4A00E0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 12 }}
            >
              <Ionicons name="add-circle" size={22} color="#FFF" />
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>
                DROP A PULSE & ENTER
              </Text>
              <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', marginTop: 10, fontWeight: '500' }}>
            Every pulse earns points · Every point climbs the board
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const aStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08001C' },

  header: {
    position: 'relative',
    top: 0,
    left: 0, right: 0, zIndex: 50,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingBottom: 10,
    paddingTop: IS_IOS ? 54 : 36,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#FFF', fontWeight: '900', fontSize: 15, letterSpacing: 2.5 },
  headerSub:   { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600', letterSpacing: 1, marginTop: 3 },
  myRankChip: {
    backgroundColor: 'rgba(255,210,0,0.15)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,210,0,0.4)',
  },

  sectionLabel: {
    color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '900',
    letterSpacing: 2, paddingHorizontal: 18, marginBottom: 14, marginTop: 8,
  },

  // Energy
  energyWrap: {
    marginHorizontal: 18, marginBottom: 24, padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  energyLabel: { color: 'rgba(255,255,255,0.6)', fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },
  energyState: { fontWeight: '900', fontSize: 12 },
  energyBarBg: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 8 },
  energyBarFill: { height: '100%', borderRadius: 5 },
  energySub: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '600' },

  // Hero card
  heroCard: {
    borderRadius: 28, padding: 22,
    shadowOffset: { width: 0, height: 14 }, shadowRadius: 24, elevation: 14,
  },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activePillText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  entriesChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  entriesText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '800' },
  heroEmoji: { fontSize: 52, marginBottom: 14, alignSelf: 'flex-start' },
  heroTitle: { color: '#FFF', fontWeight: '900', fontSize: 22, letterSpacing: -0.3, marginBottom: 6 },
  heroSub:   { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', lineHeight: 19, marginBottom: 14 },
  prizeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 20, alignSelf: 'flex-start',
  },
  prizeText: { color: '#FFD200', fontWeight: '800', fontSize: 12 },
  countdownRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-start',
    gap: 2, marginBottom: 22,
  },
  heroCTA: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, paddingVertical: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  heroCTAText: { color: '#FFF', fontWeight: '900', fontSize: 15, letterSpacing: 1 },

  // Mini cards
  miniCard: {
    width: 120, borderRadius: 20, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 10, elevation: 6,
  },
  miniEmoji:  { fontSize: 28, marginBottom: 8 },
  miniTitle:  { color: '#FFF', fontWeight: '900', fontSize: 11, letterSpacing: 0.3, lineHeight: 15 },
  miniMeta:   { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700' },
  urgentBadge:{
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#FF2D55', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  selectedIndicator: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 2,
  },

  // Leaderboard
  lbSection: {
    marginTop: 8, paddingBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 20,
  },
  lbHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, marginBottom: 20,
  },

  // Podium
  podiumRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
    paddingHorizontal: 18, marginBottom: 24, gap: 8,
  },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumCrown: { marginBottom: 4 },
  podiumAvatar: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6, overflow: 'hidden',
  },
  podiumEmoji: { fontSize: 18, marginBottom: 2 },
  podiumName:  { color: 'rgba(255,255,255,0.85)', fontWeight: '800', fontSize: 10, letterSpacing: 0.3, maxWidth: 80, textAlign: 'center' },
  podiumPts:   { color: 'rgba(255,255,255,0.55)', fontWeight: '800', fontSize: 11, marginBottom: 6 },
  podiumPillar:{ width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },

  lbList: { paddingHorizontal: 18 },
  lbRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  lbRowMe: { backgroundColor: 'rgba(10,132,255,0.08)', borderRadius: 14, paddingHorizontal: 10, marginHorizontal: -10 },
  lbRankWrap: { width: 32, alignItems: 'center' },
  lbRankEmoji:{ fontSize: 18 },
  lbRank:     { fontWeight: '900', fontSize: 14 },
  lbAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  lbName:   { color: '#FFF', fontWeight: '800', fontSize: 13, flex: 1 },
  lbStreak: { color: '#FF8A00', fontSize: 11, fontWeight: '800' },
  lbPoints: { color: 'rgba(255,255,255,0.6)', fontWeight: '800', fontSize: 12 },
  lbBarBg:  { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  lbBarFill:{ height: '100%', borderRadius: 2 },
  lbDivider:{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },
});