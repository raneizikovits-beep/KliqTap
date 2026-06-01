// client/src/screens/FeedScreen.js
// ═══════════════════════════════════════════════════════════════════════════════
//  ⚡ KLIQTAP — FEED SCREEN v4.0 (ULTIMATE: DELETE + EDIT + PERSIST + MODERN)
//  Full-bleed immersive vertical snap feed — Food · Gym · Music · Travel · Art
//  Global Follow State · Native Share API · Comments · Delete & Edit Posts
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
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  StatusBar,
  Platform,
  RefreshControl,
  Alert,
  Share,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../store/useAppStore';
import { fetchAPI } from '../store/api';
import * as Data from '../constants/data';

import { PostCommentsModal } from '../components/modals/PostCommentsModal';

// ─── Optional deps ─────────────────────────────────────────────────────────────
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
    NotificationFeedbackType: { Success: 'success', Error: 'error' },
    impactAsync: () => Promise.resolve(),
    notificationAsync: () => Promise.resolve(),
    selectionAsync: () => Promise.resolve(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const { width: W, height: H } = Dimensions.get('window');
const CARD_H = H;
const IS_IOS = Platform.OS === 'ios';

const VIBE_TABS = [
  { id: 'All',    label: 'ALL',   icon: 'flash',         accent: '#8E2DE2' },
  { id: 'Foodie', label: 'EATS',  icon: 'restaurant',    accent: '#FF6B35' },
  { id: 'Gym',    label: 'LIFT',  icon: 'barbell',       accent: '#00C9FF' },
  { id: 'Music',  label: 'SING',  icon: 'musical-notes', accent: '#FF2D55' },
  { id: 'Travel', label: 'ROAM',  icon: 'airplane',      accent: '#00E5A0' },
  { id: 'Art',    label: 'ART',   icon: 'color-palette', accent: '#FFD200' },
];

const VIBE_META = {
  Foodie: { label: 'LAMI BAI 🍴',      color: '#FF6B35', bg: ['#FF6B35','#C0392B'] },
  Gym:    { label: 'KLIQ LIFT 💪',     color: '#00C9FF', bg: ['#0072FF','#00C9FF'] },
  Music:  { label: 'SING FOR KLIQ 🎤', color: '#FF2D55', bg: ['#8E2DE2','#FF2D55'] },
  Travel: { label: 'ROAM 🌍',          color: '#00E5A0', bg: ['#00E5A0','#0072FF'] },
  Art:    { label: 'ART DROP 🎨',      color: '#FFD200', bg: ['#FF8A00','#FFD200'] },
};

const PLACEHOLDER_POSTS = [
  { id: 'ph1', vibe: 'Foodie', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80', caption: 'Lechon night 🐷🔥 #LamiBai', author: { id: 'u1', username: '@kliqofficial', avatarUrl: null }, likes: 284, comments: 41 },
  { id: 'ph2', vibe: 'Gym',    imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80', caption: 'Morning grind. 5 sets done 💪 #KliqLiftCebu', author: { id: 'u2', username: '@ironkliq', avatarUrl: null }, likes: 192, comments: 17 },
  { id: 'ph3', vibe: 'Music',  imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80', caption: 'Videoke night was unreal 🎤 #SingForKliq', author: { id: 'u3', username: '@taytop', avatarUrl: null }, likes: 517, comments: 88 },
  { id: 'ph4', vibe: 'Foodie', imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80', caption: 'Ngohiong from Carbon Market 🤌 #CebuEats', author: { id: 'u4', username: '@sugbofoodie', avatarUrl: null }, likes: 340, comments: 52 },
  { id: 'ph5', vibe: 'Gym',    imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80', caption: 'PR day. Back at it tomorrow 🏋️ #IronKliq', author: { id: 'u5', username: '@kliqlift_bai', avatarUrl: null }, likes: 128, comments: 9 },
  { id: 'ph6', vibe: 'Travel', imageUrl: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?auto=format&fit=crop&w=800&q=80', caption: 'Moalboal sunrise. Nothing beats Cebu 🌅', author: { id: 'u6', username: '@cebulife', avatarUrl: null }, likes: 621, comments: 73 },
];

const haptic = (k = 'light') => {
  try {
    if (k === 'light')    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (k === 'medium')   return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (k === 'heavy')    return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (k === 'select')   return Haptics.selectionAsync();
    if (k === 'success')  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (k === 'error')    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (_) {}
  return Promise.resolve();
};

const fmtNum = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000)      return `${(v / 1000).toFixed(1)}K`;
  return String(v);
};

// ═══════════════════════════════════════════════════════════════════════════════
//  HOOKS
// ═══════════════════════════════════════════════════════════════════════════════
const usePressScale = (to = 0.94) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn  = useCallback(() => Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 50, bounciness: 0 }).start(), [scale, to]);
  const onPressOut = useCallback(() => Animated.spring(scale, { toValue: 1,  useNativeDriver: true, speed: 30, bounciness: 10 }).start(), [scale]);
  return { scale, onPressIn, onPressOut };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  LIKE BURST — particle burst on double-tap
// ═══════════════════════════════════════════════════════════════════════════════
const LikeBurst = React.memo(({ visible }) => {
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0);
    opacity.setValue(1);
    Animated.parallel([
      Animated.spring(scale,  { toValue: 1.4, useNativeDriver: true, speed: 18, bounciness: 14 }),
      Animated.sequence([
        Animated.delay(350),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, [visible, scale, opacity]);

  if (!visible) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        alignSelf: 'center',
        top: '35%',
        transform: [{ scale }],
        opacity,
        zIndex: 99,
      }}
    >
      <Ionicons name="heart" size={96} color="#FF2D55" style={{ opacity: 0.92 }} />
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  VIBE CHIP
// ═══════════════════════════════════════════════════════════════════════════════
const VibeChip = React.memo(({ vibe }) => {
  const meta = VIBE_META[vibe];
  if (!meta) return null;
  return (
    <LinearGradient
      colors={meta.bg}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 10 }}
    >
      <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{meta.label}</Text>
    </LinearGradient>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  OPTIONS MENU — floating sheet for edit/delete
// ═══════════════════════════════════════════════════════════════════════════════
const OptionsMenu = React.memo(({ visible, onClose, onDelete, onEdit, accentColor = '#8E2DE2' }) => {
  const translateY = useRef(new Animated.Value(200)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 8 }),
        Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 200, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,   duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={{ position: 'absolute', inset: 0, zIndex: 200, opacity }}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
        activeOpacity={1}
        onPress={onClose}
      />
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          backgroundColor: '#1A1A1A',
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingBottom: IS_IOS ? 40 : 24,
          paddingTop: 8,
          transform: [{ translateY }],
        }}
      >
        {/* Drag handle */}
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#444', alignSelf: 'center', marginBottom: 20 }} />

        <Text style={{ color: '#666', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center', marginBottom: 16 }}>
          POST OPTIONS
        </Text>

        {/* Edit option */}
        <TouchableOpacity
          onPress={() => { haptic('light'); onEdit(); onClose(); }}
          activeOpacity={0.75}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, paddingVertical: 18, gap: 16 }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(142,45,226,0.2)', borderWidth: 1, borderColor: 'rgba(142,45,226,0.4)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="create-outline" size={22} color={accentColor} />
          </View>
          <View>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 16 }}>Edit Caption</Text>
            <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>Update your post caption</Text>
          </View>
        </TouchableOpacity>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: '#2A2A2A', marginHorizontal: 28 }} />

        {/* Delete option */}
        <TouchableOpacity
          onPress={() => { haptic('heavy'); onDelete(); onClose(); }}
          activeOpacity={0.75}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, paddingVertical: 18, gap: 16 }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,59,48,0.15)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.35)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
          </View>
          <View>
            <Text style={{ color: '#FF3B30', fontWeight: '800', fontSize: 16 }}>Delete Pulse</Text>
            <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>This cannot be undone</Text>
          </View>
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.75}
          style={{ marginHorizontal: 28, marginTop: 8, backgroundColor: '#2A2A2A', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FEED POST CARD — full-bleed, snap
// ═══════════════════════════════════════════════════════════════════════════════
const FeedCard = React.memo(({
  post, isActive, currentUser,
  onLike, onComment, onShare, onFollow, onDelete, onEditRequest,
  userLiked, isFollowing,
}) => {
  const [burstVisible, setBurstVisible] = useState(false);
  const [menuVisible,  setMenuVisible]  = useState(false);
  const lastTap = useRef(0);
  const { scale: shareScale, onPressIn: sharePressIn, onPressOut: sharePressOut } = usePressScale(0.88);
  const likeScale = useRef(new Animated.Value(1)).current;

  // Entrance slide-up when card becomes active
  const entranceY = useRef(new Animated.Value(30)).current;
  const entranceO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      entranceY.setValue(30);
      entranceO.setValue(0);
      Animated.parallel([
        Animated.spring(entranceY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
        Animated.timing(entranceO, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]).start();
    }
  }, [isActive, entranceY, entranceO]);

  // ── Is this post owned by the current logged-in user? ──
  const isMyPost = Boolean(
    currentUser &&
    ((currentUser.id       && String(currentUser.id)       === String(post.author?.id)) ||
     (currentUser.username && currentUser.username         === post.author?.username))
  );

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      haptic('medium');
      onLike(post.id);
      setBurstVisible(true);
      setTimeout(() => setBurstVisible(false), 800);
      Animated.sequence([
        Animated.spring(likeScale, { toValue: 1.5, useNativeDriver: true, speed: 30, bounciness: 20 }),
        Animated.spring(likeScale, { toValue: 1,   useNativeDriver: true, speed: 20, bounciness: 8 }),
      ]).start();
    }
    lastTap.current = now;
  }, [onLike, post.id, likeScale]);

  const handleLikeBtn = useCallback(() => {
    haptic('light');
    onLike(post.id);
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.4, useNativeDriver: true, speed: 40, bounciness: 16 }),
      Animated.spring(likeScale, { toValue: 1,   useNativeDriver: true, speed: 25, bounciness: 8 }),
    ]).start();
  }, [onLike, post.id, likeScale]);

  const handleFollowBtn = useCallback(() => {
    haptic('medium');
    onFollow(post.author?.id || post.author?.username);
  }, [onFollow, post.author]);

  const handleDuet = useCallback(() => {
    haptic('light');
    Alert.alert('Duet Mode', 'Duet feature is cooking! 🍳 Coming in the next update.');
  }, []);

  const handleMoreOptions = useCallback(() => {
    haptic('select');
    setMenuVisible(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    Alert.alert(
      'Delete Pulse',
      'Are you sure you want to delete this pulse? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            haptic('error');
            onDelete(post.id);
          },
        },
      ]
    );
  }, [onDelete, post.id]);

  const avatarLetter = post.author?.username?.replace('@','')?.charAt(0)?.toUpperCase() || '?';
  const likesDisplay = fmtNum((post.likes || 0) + (userLiked ? 1 : 0));
  const commentsCount = fmtNum(
    post.comments_count ??
    (Array.isArray(post.comments) ? post.comments.length : (post.comments ?? 0))
  );

  // Accent from vibe
  const vibeAccent = VIBE_META[post.vibe]?.color || '#8E2DE2';

  return (
    <View style={{ width: W, height: CARD_H }}>
      <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Image
            source={{ uri: post.imageUrl }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="contain"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 160 }}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.98)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 320 }}
          />
          {/* Vibe color accent streak */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: vibeAccent, opacity: 0.85 }} />

          <LikeBurst visible={burstVisible} />

          {/* ── "More options" button (only for MY posts) ── */}
          {isMyPost && (
            <TouchableOpacity
              onPress={handleMoreOptions}
              activeOpacity={0.8}
              style={{
                position: 'absolute',
                top: IS_IOS ? 54 : 36,
                right: 18,
                width: 36, height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(0,0,0,0.5)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center', justifyContent: 'center',
                zIndex: 10,
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color="#FFF" />
            </TouchableOpacity>
          )}

          {/* ── Bottom-left: author + caption ── */}
          <Animated.View
            style={{
              position: 'absolute',
              bottom: 28, left: 18, right: 80,
              opacity: entranceO,
              transform: [{ translateY: entranceY }],
            }}
          >
            <VibeChip vibe={post.vibe} />

            {/* Author row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={[fStyles.avatar, { backgroundColor: (Data.brand?.blue || '#0A84FF') + '55' }]}>
                {post.author?.avatarUrl ? (
                  <Image source={{ uri: post.author.avatarUrl }} style={fStyles.avatarImg} />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15 }}>{avatarLetter}</Text>
                )}
              </View>
              <Text style={fStyles.username}>{post.author?.username || 'kliquser'}</Text>

              {/* Don't show follow button for own posts */}
              {!isMyPost && (
                <TouchableOpacity
                  onPress={handleFollowBtn}
                  activeOpacity={0.8}
                  style={[
                    fStyles.followPill,
                    isFollowing && { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'transparent' },
                  ]}
                >
                  <Text style={fStyles.followText}>
                    {isFollowing ? '✓ FOLLOWING' : '+ FOLLOW'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* "MY POST" badge for own posts */}
              {isMyPost && (
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(142,45,226,0.35)', borderWidth: 1, borderColor: 'rgba(142,45,226,0.6)' }}>
                  <Text style={{ color: '#C57BFF', fontWeight: '800', fontSize: 10, letterSpacing: 0.5 }}>MY POST</Text>
                </View>
              )}
            </View>

            <Text style={fStyles.caption} numberOfLines={3}>{post.caption}</Text>
          </Animated.View>

          {/* ── Right sidebar: actions ── */}
          <Animated.View
            style={{
              position: 'absolute',
              bottom: 36, right: 16,
              alignItems: 'center',
              gap: 14,
              opacity: entranceO,
            }}
          >
            {/* Like */}
            <TouchableOpacity onPress={handleLikeBtn} activeOpacity={0.8}>
              <Animated.View style={{ transform: [{ scale: likeScale }], alignItems: 'center' }}>
                <View style={[fStyles.actionBtn, userLiked && { backgroundColor: 'rgba(255,45,85,0.35)', borderColor: '#FF2D55' }]}>
                  <Ionicons
                    name={userLiked ? 'heart' : 'heart-outline'}
                    size={22}
                    color={userLiked ? '#FF2D55' : '#FFF'}
                  />
                </View>
                <Text style={[fStyles.actionCount, userLiked && { color: '#FF2D55' }]}>{likesDisplay}</Text>
              </Animated.View>
            </TouchableOpacity>

            {/* Comment */}
            <TouchableOpacity onPress={() => onComment(post)} activeOpacity={0.8}>
              <View style={{ alignItems: 'center' }}>
                <View style={fStyles.actionBtn}>
                  <Ionicons name="chatbubble-outline" size={20} color="#FFF" />
                </View>
                <Text style={fStyles.actionCount}>{commentsCount}</Text>
              </View>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity
              onPress={() => onShare(post)}
              onPressIn={sharePressIn}
              onPressOut={sharePressOut}
              activeOpacity={0.8}
            >
              <Animated.View style={{ alignItems: 'center', transform: [{ scale: shareScale }] }}>
                <View style={fStyles.actionBtn}>
                  <Ionicons name="arrow-redo-outline" size={20} color="#FFF" />
                </View>
                <Text style={fStyles.actionCount}>SHARE</Text>
              </Animated.View>
            </TouchableOpacity>

            {/* Duet */}
            <TouchableOpacity onPress={handleDuet} activeOpacity={0.8}>
              <View style={{ alignItems: 'center' }}>
                <View style={[fStyles.actionBtn, { backgroundColor: 'rgba(142,45,226,0.3)', borderColor: '#8E2DE2' }]}>
                  <Ionicons name="git-branch-outline" size={18} color="#FFF" />
                </View>
                <Text style={fStyles.actionCount}>DUET</Text>
              </View>
            </TouchableOpacity>

            {/* Delete shortcut (only for MY posts, quick red trash) */}
            {isMyPost && (
              <TouchableOpacity onPress={handleDeleteConfirm} activeOpacity={0.8}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[fStyles.actionBtn, { backgroundColor: 'rgba(255,59,48,0.25)', borderColor: '#FF3B30' }]}>
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  </View>
                  <Text style={[fStyles.actionCount, { color: '#FF3B30' }]}>DELETE</Text>
                </View>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Options menu (slide-up sheet) */}
      <OptionsMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onDelete={handleDeleteConfirm}
        onEdit={() => onEditRequest(post)}
        accentColor={vibeAccent}
      />
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  VIBE TAB BAR
// ═══════════════════════════════════════════════════════════════════════════════
const VibeTabBar = React.memo(({ active, onChange }) => {
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  const tabWidth = Math.floor((W - 32) / VIBE_TABS.length);

  const activeIdx = VIBE_TABS.findIndex((t) => t.id === active);
  useEffect(() => {
    Animated.spring(indicatorAnim, { toValue: activeIdx * tabWidth, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
  }, [activeIdx, indicatorAnim, tabWidth]);

  const activeAccent = VIBE_TABS[activeIdx]?.accent || '#8E2DE2';

  return (
    <View style={fStyles.tabBarWrapper}>
      <View style={fStyles.tabBarInner}>
        <Animated.View
          style={[
            fStyles.tabIndicator,
            { width: tabWidth, backgroundColor: activeAccent + '28', borderColor: activeAccent, transform: [{ translateX: indicatorAnim }] },
          ]}
        />
        {VIBE_TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => { haptic('select'); onChange(tab.id); }}
              activeOpacity={0.75}
              style={[fStyles.tabBtn, { width: tabWidth }]}
            >
              <Ionicons name={tab.icon} size={isActive ? 15 : 13} color={isActive ? tab.accent : 'rgba(255,255,255,0.35)'} />
              <Text style={[fStyles.tabLabel, { color: isActive ? tab.accent : 'rgba(255,255,255,0.35)', fontWeight: isActive ? '900' : '600' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════
const EmptyVibe = React.memo(({ vibe, onDrop }) => {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -12, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0,  duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  const meta = VIBE_META[vibe] || { label: 'ALL VIBES', bg: ['#333','#555'] };
  const icon = VIBE_TABS.find((t) => t.id === vibe)?.icon || 'flash';

  return (
    <View style={{ height: CARD_H, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
      <Animated.View style={{ transform: [{ translateY: bounce }], marginBottom: 28 }}>
        <LinearGradient colors={meta.bg} style={{ width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={44} color="#FFF" />
        </LinearGradient>
      </Animated.View>
      <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 22, letterSpacing: -0.5, textAlign: 'center', marginBottom: 10 }}>
        Hilom pa diri...
      </Text>
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 21 }}>
        Be the first to drop a {meta.label} post. The community is waiting for you.
      </Text>
      <TouchableOpacity onPress={onDrop} activeOpacity={0.88} style={{ overflow: 'hidden', borderRadius: 22 }}>
        <LinearGradient colors={meta.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingHorizontal: 32, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="add-circle" size={20} color="#FFF" />
          <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 15, letterSpacing: 0.8 }}>DROP FIRST POST</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function FeedScreen() {
  const navigation = useNavigation();
  const {
    user,
    pulses = [],
    refreshAllData,
    setPulseCreateOpen,
    userSettings,
    deletePulse, // ← מוחק pulse מהשרת ומה-state
    deletePost,  // ← fallback למחיקת post רגיל
    editPost,    // ← עריכת post
  } = useAppStore();

  const isDark = userSettings?.darkMode !== false;
  const [activeVibe, setActiveVibe]         = useState('All');
  const [likedPosts, setLikedPosts]         = useState(new Set());
  const [followedUsers, setFollowedUsers]   = useState(new Set());
  const [activeCommentPost, setActiveCommentPost]     = useState(null); // { pulseId, postId }
  const [refreshing, setRefreshing]         = useState(false);
  const [activeIndex, setActiveIndex]       = useState(0);
  const [feedPosts, setFeedPosts]           = useState(PLACEHOLDER_POSTS);
  const flatRef = useRef(null);

  // ─── Header fade-in ──────────────────────────────────────────────────────────
  const headerOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  // ─── Load real feed posts ────────────────────────────────────────────────────
  useEffect(() => {
    const loadFeed = async () => {
      try {
        const data = await fetchAPI('/pulse/feed?limit=30');
        if (Array.isArray(data) && data.length > 0) setFeedPosts(data);
      } catch (_) {}
    };
    loadFeed();
  }, []);

  const mergedPosts = useMemo(() => {
    const storePosts = pulses.filter((p) => p.imageUrl);
    if (storePosts.length === 0) return feedPosts;
    const ids = new Set(feedPosts.map((p) => p.id));
    const newOnes = storePosts.filter((p) => !ids.has(p.id));
    return [...newOnes, ...feedPosts];
  }, [pulses, feedPosts]);

  const displayPosts = useMemo(() => {
    if (activeVibe === 'All') return mergedPosts;
    return mergedPosts.filter((p) => p.vibe === activeVibe);
  }, [mergedPosts, activeVibe]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleLike = useCallback(async (id) => {
    setLikedPosts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    try {
      await fetchAPI('/pulse/like', { method: 'POST', body: { postId: id } });
    } catch (_) {}
  }, []);

  const handleFollow = useCallback(async (userId) => {
    if (!userId) return;
    setFollowedUsers((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
    try {
      await fetchAPI('/users/follow', { method: 'POST', body: { followId: userId } });
    } catch (_) {}
  }, []);

  const handleComment = useCallback((post) => {
    haptic('light');
    // התגובות נשמרות על ה-PULSE עצמו — השרת מזהה pulseId אוטומטית.
    // שולחים תמיד את pulse.id כדי שהתגובה תישמר על הפולס ותחזור ברענון.
    setActiveCommentPost({ pulseId: post.id, postId: post.id });
  }, []);

  const handleShare = useCallback(async (post) => {
    haptic('medium');
    try {
      await Share.share({
        message: `Check out this vibe by ${post.author?.username || 'someone'} on KliqTap! ⚡️\n\n"${post.caption}"`,
        url: post.imageUrl || 'https://kliqtap.com',
        title: 'KliqTap Vibe',
      });
    } catch (_) {}
  }, []);

  // ── DELETE POST — removes from server + local state immediately ──────────────
  const handleDeletePost = useCallback(async (postId) => {
    const sid = String(postId);

    // Optimistically remove from local UI immediately
    setFeedPosts((prev) => prev.filter((p) => String(p.id) !== sid));

    try {
      // deletePulse = הפונקציה הנכונה לפוסטים מסוג Pulse (Feed/Stories)
      // deletePost  = fallback לפוסטים רגילים (Community Feed)
      if (deletePulse) {
        await deletePulse(sid);
      } else if (deletePost) {
        await deletePost(sid);
      } else {
        await fetchAPI(`/pulse/${sid}`, { method: 'DELETE' });
      }
      haptic('success');
    } catch (err) {
      // Rollback: reload feed from server
      const data = await fetchAPI('/pulse/feed?limit=30').catch(() => null);
      if (Array.isArray(data) && data.length > 0) setFeedPosts(data);
      haptic('error');
      Alert.alert('Error', 'Could not delete pulse. Please try again.');
    }
  }, [deletePulse, deletePost]);

  // ── EDIT POST — prompt for new caption, persist to server ───────────────────
  const handleEditRequest = useCallback((post) => {
    Alert.prompt(
      'Edit Caption',
      'Update your pulse caption:',
      async (newCaption) => {
        if (!newCaption || newCaption.trim() === '') return;
        if (newCaption.trim() === post.caption) return;

        const trimmed = newCaption.trim();

        // Optimistic update
        setFeedPosts((prev) =>
          prev.map((p) => String(p.id) === String(post.id) ? { ...p, caption: trimmed } : p)
        );

        try {
          if (editPost) {
            await editPost(String(post.id), trimmed, null, false);
          } else {
            await fetchAPI(`/pulse/${post.id}`, { method: 'PATCH', body: { caption: trimmed } });
          }
          haptic('success');
        } catch (err) {
          // Rollback
          setFeedPosts((prev) =>
            prev.map((p) => String(p.id) === String(post.id) ? { ...p, caption: post.caption } : p)
          );
          haptic('error');
          Alert.alert('Error', 'Could not update caption. Please try again.');
        }
      },
      'plain-text',
      post.caption || '',
    );
  }, [editPost]);

  const handleDrop = useCallback(() => {
    haptic('heavy');
    setPulseCreateOpen?.(true);
  }, [setPulseCreateOpen]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptic('select');
    try {
      await refreshAllData?.();
      const data = await fetchAPI('/pulse/feed?limit=30');
      if (Array.isArray(data) && data.length > 0) setFeedPosts(data);
    } catch (_) {}
    setRefreshing(false);
  }, [refreshAllData]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 60 });

  const handleVibeChange = useCallback((vibe) => {
    setActiveVibe(vibe);
    setTimeout(() => flatRef.current?.scrollToOffset({ offset: 0, animated: false }), 50);
  }, []);

  const dots = displayPosts.slice(0, Math.min(displayPosts.length, 6));

  return (
    <View style={fStyles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Header ── */}
      <Animated.View style={[fStyles.header, { opacity: headerOpacity }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={fStyles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color="#FFF" />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={fStyles.headerTitle}>FEED</Text>
          <Text style={fStyles.headerSub}>
            {`${displayPosts.length} ${activeVibe === 'All' ? 'posts' : (VIBE_TABS.find((t) => t.id === activeVibe)?.label || '') + ' posts'}`}
          </Text>
        </View>

        <TouchableOpacity onPress={handleDrop} activeOpacity={0.85} style={fStyles.dropBtn}>
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Vibe Tab Bar ── */}
      <Animated.View style={{ opacity: headerOpacity }}>
        <VibeTabBar active={activeVibe} onChange={handleVibeChange} />
      </Animated.View>

      {/* ── Feed ── */}
      {displayPosts.length === 0 ? (
        <EmptyVibe vibe={activeVibe} onDrop={handleDrop} />
      ) : (
        <FlatList
          ref={flatRef}
          data={displayPosts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <FeedCard
              post={item}
              isActive={index === activeIndex}
              currentUser={user}
              userLiked={likedPosts.has(item.id)}
              isFollowing={followedUsers.has(item.author?.id || item.author?.username)}
              onLike={handleLike}
              onComment={handleComment}
              onShare={handleShare}
              onFollow={handleFollow}
              onDelete={handleDeletePost}
              onEditRequest={handleEditRequest}
            />
          )}
          pagingEnabled={false}
          snapToInterval={CARD_H}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewConfigRef.current}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />
          }
          getItemLayout={(_, index) => ({ length: CARD_H, offset: CARD_H * index, index })}
          initialNumToRender={3}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={IS_IOS}
        />
      )}

      {/* ── Progress indicator dots ── */}
      {displayPosts.length > 1 && (
        <View style={fStyles.dotsRow} pointerEvents="none">
          {dots.map((_, i) => (
            <View key={i} style={[fStyles.dot, i === activeIndex % dots.length && fStyles.dotActive]} />
          ))}
          {displayPosts.length > 6 && (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '700', marginLeft: 4 }}>
              +{displayPosts.length - 6}
            </Text>
          )}
        </View>
      )}

      {/* ── Comments Modal ── */}
      <PostCommentsModal
        postId={activeCommentPost?.pulseId}
        apiPostId={activeCommentPost?.postId}
        visible={!!activeCommentPost}
        onClose={() => setActiveCommentPost(null)}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const fStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  header: {
    position: 'absolute',
    top: IS_IOS ? 54 : 36,
    left: 0, right: 0, zIndex: 50,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingBottom: 10,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#FFF', fontSize: 15, fontWeight: '900', letterSpacing: 2.5 },
  headerSub:   { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600', letterSpacing: 1, marginTop: 2 },
  dropBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Data.brand?.blue || '#0A84FF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Data.brand?.blue || '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6, shadowRadius: 8, elevation: 8,
  },

  tabBarWrapper: {
    position: 'absolute',
    top: IS_IOS ? 100 : 82,
    left: 0, right: 0, zIndex: 40,
    alignItems: 'center', paddingVertical: 6,
  },
  tabBarInner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 30, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden', position: 'relative', paddingVertical: 4,
  },
  tabIndicator: {
    position: 'absolute', top: 4, bottom: 4,
    borderRadius: 26, borderWidth: 1,
  },
  tabBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 3 },
  tabLabel: { fontSize: 9, letterSpacing: 0.8 },

  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden', marginRight: 10,
  },
  avatarImg: { width: '100%', height: '100%' },
  username:  { color: '#FFF', fontWeight: '800', fontSize: 14, letterSpacing: 0.2, flex: 1 },
  followPill: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)',
  },
  followText:  { color: '#FFF', fontWeight: '900', fontSize: 10, letterSpacing: 0.8 },
  caption: { color: 'rgba(255,255,255,0.95)', fontSize: 14, lineHeight: 21, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },

  actionBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 3,
  },
  actionCount: { color: 'rgba(255,255,255,0.85)', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  dotsRow: {
    position: 'absolute', bottom: 80, right: 6,
    flexDirection: 'column', alignItems: 'center', gap: 4,
  },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotActive: { backgroundColor: '#FFF', height: 14, borderRadius: 3 },
});