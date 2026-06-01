// client/src/components/modals/RadarModal.js
// ⭐️ ULTIMATE RADAR VISUAL VERSION — Animated Sweep + Avatar Dots by Distance ⭐️

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Dimensions,
  Switch, Platform, Animated, Easing, ScrollView, Modal
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { brand } from '../../constants/data';

const { width: SCREEN_W } = Dimensions.get('window');
const RADAR_SIZE = Math.min(SCREEN_W - 40, 320);
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = RADAR_CENTER - 10;

// ─── Helpers ────────────────────────────────────────────────────────────────

const getFuzzyDistance = (distanceKm) => {
  if (distanceKm < 0.2) return 'Right nearby 📍';
  if (distanceKm < 1.0) return 'A few streets away 🚶';
  if (distanceKm < 3.0) return 'In your neighborhood 🏘️';
  return 'A short drive away 🚗';
};

// Map a real distance (km) to a radar pixel radius (capped at max)
// Minimum visual radius: 12% of RADAR_RADIUS so items never sit exactly on center
const distanceToRadius = (distanceKm, maxRadiusKm) => {
  const capped = Math.min(distanceKm, maxRadiusKm);
  const pct = capped / maxRadiusKm;
  const MIN_PCT = 0.12;
  return (MIN_PCT + pct * (1 - MIN_PCT)) * RADAR_RADIUS;
};

// Stable base-angle per item id (hash-based, reproducible)
const getBaseAngle = (id) => {
  let hash = 0;
  const str = String(id || Math.random());
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return ((Math.abs(hash) % 360) * Math.PI) / 180;
};

const DOT_SIZE = 30;   // px diameter of each dot
const MIN_DIST = DOT_SIZE + 3; // minimum pixel distance between dot centres

/**
 * Given a flat list of items with distance_km, compute {x, y} positions
 * on the radar such that no two dots overlap.
 * Strategy:
 *  1. Assign initial angle from hash (stable).
 *  2. Convert to cartesian.
 *  3. Iteratively push overlapping pairs apart (simple repulsion, max 8 passes).
 */
const computeRadarPositions = (items, maxRadiusKm) => {
  if (!items.length) return [];

  // Initial positions
  const pts = items.map(item => {
    const r = distanceToRadius(item.distance_km || 0, maxRadiusKm);
    const a = getBaseAngle(item.id);
    return {
      id: item.id,
      x: RADAR_CENTER + r * Math.cos(a),
      y: RADAR_CENTER + r * Math.sin(a),
      r,           // keep radius so we can push tangentially
    };
  });

  // Repulsion passes
  for (let pass = 0; pass < 10; pass++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MIN_DIST && dist > 0.01) {
          const overlap = (MIN_DIST - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          pts[i].x -= nx * overlap;
          pts[i].y -= ny * overlap;
          pts[j].x += nx * overlap;
          pts[j].y += ny * overlap;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  // Clamp inside radar circle (keep dots fully within boundary)
  const margin = DOT_SIZE / 2 + 4;
  pts.forEach(p => {
    const dx = p.x - RADAR_CENTER;
    const dy = p.y - RADAR_CENTER;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxR = RADAR_RADIUS - margin;
    if (dist > maxR) {
      const scale = maxR / dist;
      p.x = RADAR_CENTER + dx * scale;
      p.y = RADAR_CENTER + dy * scale;
    }
  });

  return pts; // [{id, x, y}, ...]
};

// ─── Radar Sweep Animation ───────────────────────────────────────────────────

const RadarSweep = ({ isDark }) => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',  // web doesn't support nativeDriver rotation
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const ACCENT = brand.blue || '#00FFB2';

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { transform: [{ rotate }], borderRadius: RADAR_RADIUS },
      ]}
    >
      {/* Sweep gradient wedge using layered Views */}
      {[...Array(20)].map((_, i) => {
        const angle = (i / 20) * 90; // 0..90 degrees (quarter circle sweep)
        const opacity = (1 - i / 20) * 0.35;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: RADAR_RADIUS,
              height: 2,
              left: RADAR_CENTER,
              top: RADAR_CENTER,
              backgroundColor: ACCENT,
              opacity,
              transformOrigin: 'left center',
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
      {/* Main sweep line */}
      <View
        style={{
          position: 'absolute',
          width: RADAR_RADIUS,
          height: 2,
          left: RADAR_CENTER,
          top: RADAR_CENTER - 1,
          backgroundColor: ACCENT,
          opacity: 0.9,
          shadowColor: ACCENT,
          shadowOpacity: 0.8,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
    </Animated.View>
  );
};

// ─── Avatar Dot on Radar ────────────────────────────────────────────────────

// posX / posY are pre-computed centres from computeRadarPositions (collision-safe)
const AvatarDot = ({ item, posX, posY, isDark, onPress, type }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const isWeb = Platform.OS === 'web';
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: !isWeb,
      delay: Math.random() * 400,
    }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 1000, useNativeDriver: !isWeb, easing: Easing.ease }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: !isWeb }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // posX/posY are dot centres → subtract half to get top-left corner
  const x = posX - DOT_SIZE / 2;
  const y = posY - DOT_SIZE / 2;

  const ACCENT = type === 'user' ? (brand.blue || '#007AFF') : '#FF9F0A';
  const initials = type === 'user'
    ? (item.username ? item.username.charAt(0).toUpperCase() : '?')
    : (item.name ? item.name.charAt(0).toUpperCase() : '?');

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: [{ scale: scaleAnim }],
        zIndex: 10,
      }}
    >
      {/* Pulse ring */}
      <Animated.View
        style={{
          position: 'absolute',
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          borderWidth: 1.5,
          borderColor: ACCENT,
          opacity: 0.4,
          transform: [{ scale: pulseAnim }],
        }}
      />
      <TouchableOpacity
        onPress={() => onPress(item)}
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: isDark ? '#0A0A0A' : '#fff',
          borderWidth: 2,
          borderColor: ACCENT,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          shadowColor: ACCENT,
          shadowOpacity: 0.6,
          shadowRadius: 6,
          elevation: 4,
        }}
      >
        {item.avatarUrl ? (
          <Image
            source={{ uri: item.avatarUrl }}
            style={{ width: DOT_SIZE - 4, height: DOT_SIZE - 4, borderRadius: (DOT_SIZE - 4) / 2 }}
            fadeDuration={100}
          />
        ) : (
          <Text style={{ color: ACCENT, fontWeight: '900', fontSize: 14 }}>{initials}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Info Popup ─────────────────────────────────────────────────────────────

const InfoPopup = ({ item, type, isDark, onClose, onAction, startDirectChat }) => {
  if (!item) return null;
  const ACCENT = type === 'user' ? (brand.blue || '#007AFF') : '#FF9F0A';
  const dist = item.distance_km;
  const distLabel = dist < 1
    ? `${(dist * 1000).toFixed(0)}m`
    : `${dist.toFixed(1)}km`;

  return (
    <View style={[popupStyles.overlay]}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <View style={[popupStyles.card, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
        {/* Avatar */}
        <View style={[popupStyles.avatarRing, { borderColor: ACCENT }]}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={popupStyles.avatarImg} />
          ) : (
            <View style={[popupStyles.avatarFallback, { backgroundColor: ACCENT + '22' }]}>
              <Text style={[popupStyles.avatarInitial, { color: ACCENT }]}>
                {type === 'user'
                  ? (item.username || '?').charAt(0).toUpperCase()
                  : (item.name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={[popupStyles.name, { color: isDark ? '#fff' : '#111' }]}>
          {type === 'user' ? `@${item.username}` : item.name}
        </Text>
        <View style={[popupStyles.distanceBadge, { backgroundColor: ACCENT + '22', borderColor: ACCENT + '55' }]}>
          <Text style={[popupStyles.distanceText, { color: ACCENT }]}>📍 {distLabel} away</Text>
        </View>
        {item.sharedInterest && (
          <Text style={[popupStyles.interest, { color: isDark ? '#aaa' : '#666' }]}>
            ✨ Both like {item.sharedInterest}
          </Text>
        )}
        <View style={popupStyles.btnRow}>
          <TouchableOpacity style={[popupStyles.actionBtn, { backgroundColor: ACCENT }]} onPress={() => onAction(item)}>
            <Text style={popupStyles.actionBtnText}>
              {type === 'user' ? 'Wave 👋' : 'Explore 🌍'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[popupStyles.closeBtn, { borderColor: isDark ? '#444' : '#eee' }]} onPress={onClose}>
            <Ionicons name="close" size={18} color={isDark ? '#888' : '#666'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const popupStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  card: {
    width: 260,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  avatarRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, overflow: 'hidden', marginBottom: 12 },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 28, fontWeight: '900' },
  name: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  distanceBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, marginBottom: 8 },
  distanceText: { fontSize: 13, fontWeight: '700' },
  interest: { fontSize: 12, marginBottom: 16 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 11, borderRadius: 14, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  closeBtn: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});

// ─── Main RadarModal ─────────────────────────────────────────────────────────

  export const RadarModal = ({ onClose, userLocation, setSecondSheet, setGroupModalTab }) => {
  const radarResults = useAppStore(state => state.radarResults);
  const isRadarLoading = useAppStore(state => state.isRadarLoading);
  const fetchRadarData = useAppStore(state => state.fetchRadarData);
  const userSettings = useAppStore(state => state.userSettings);
  const updateSetting = useAppStore(state => state.updateSetting);
  const startDirectChat = useAppStore(state => state.startDirectChat);

  const isDark = userSettings?.darkMode === true;
  const isGhostMode = userSettings?.ghostMode || false;

  const [activeTab, setActiveTab] = useState('vibes');
  const [radiusKm, setRadiusKm] = useState(10);
  const [sliderValue, setSliderValue] = useState(10);
  const [selectedItem, setSelectedItem] = useState(null);
  const [viewMode, setViewMode] = useState('radar'); // 'radar' | 'list'

  const ACCENT = brand.blue || '#007AFF';
  const BG = isDark ? '#000' : '#F0F4FF';
  const CARD_BG = isDark ? '#111' : '#fff';
  const RADAR_BG = isDark ? '#050E1A' : '#EBF0FB';
  const RING_COLOR = isDark ? 'rgba(0,120,255,0.15)' : 'rgba(0,100,255,0.1)';
  const RING_BORDER = isDark ? 'rgba(0,160,255,0.25)' : 'rgba(0,100,255,0.2)';
  const CROSSHAIR = isDark ? 'rgba(0,160,255,0.2)' : 'rgba(0,100,200,0.15)';

  useEffect(() => {
    fetchRadarData(userLocation?.latitude, userLocation?.longitude, radiusKm);
  }, [userLocation?.latitude, userLocation?.longitude, fetchRadarData]);

  const handleSliderChange = useCallback((v) => setSliderValue(Math.round(v)), []);
  const handleSliderComplete = useCallback((v) => {
    const r = Math.round(v);
    setSliderValue(r);
    setRadiusKm(r);
    fetchRadarData(userLocation?.latitude, userLocation?.longitude, r);
  }, [fetchRadarData, userLocation]);

  const handleTabSwitch = useCallback((tab) => {
    setActiveTab(tab);
    setSelectedItem(null);
  }, []);

  const toggleGhostMode = useCallback((val) => updateSetting('ghostMode', val), [updateSetting]);

  const handleWave = useCallback(async (item) => {
    if (!item?.id) return;
    try {
      await startDirectChat({ id: item.id, name: item.username, username: item.username, avatarUrl: item.avatarUrl });
      if (onClose) onClose();
    } catch {}
  }, [startDirectChat, onClose]);

  const handleDotPress = useCallback((item) => {
    setSelectedItem(item);
  }, []);

  const handleAction = useCallback((item) => {
    setSelectedItem(null);
    if (activeTab === 'vibes') {
      handleWave(item);
    } else {
  onClose?.();
  setGroupModalTab?.('posts');
  setSecondSheet?.({ source: 'GroupDetails', group: item });
    }
  }, [activeTab, handleWave, onClose, setSecondSheet, setGroupModalTab]);

  const { users, communities } = useMemo(() => {
    const all = radarResults;
    const grps = Array.isArray(all) ? all : (all?.groups || []);
    const usrs = !Array.isArray(all) && all?.users ? all.users : [];
    const sort = (arr) => [...arr].sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
    return { users: sort(usrs), communities: sort(grps) };
  }, [radarResults]);

  const activeList = activeTab === 'vibes' ? users : communities;

  // ─ Radar Rings labels
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <View style={[styles.container, { backgroundColor: BG }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.radarIcon, { backgroundColor: '#FF2D5522' }]}>
            <MaterialCommunityIcons name="radar" size={20} color="#FF2D55" />
          </View>
          <Text style={[styles.title, { color: isDark ? '#fff' : '#0A0A1A' }]}>Live Radar</Text>
          {isRadarLoading && (
            <ActivityIndicator size="small" color={ACCENT} style={{ marginLeft: 8 }} />
          )}
        </View>
        <View style={styles.headerRight}>
          {/* View mode toggle */}
          <TouchableOpacity
            style={[styles.viewToggle, { backgroundColor: isDark ? '#222' : '#E8EDF5' }]}
            onPress={() => setViewMode(v => v === 'radar' ? 'list' : 'radar')}
            activeOpacity={0.8}
          >
            <Ionicons
              name={viewMode === 'radar' ? 'list' : 'radio-outline'}
              size={16}
              color={isDark ? '#aaa' : '#555'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: isDark ? '#222' : '#E8EDF5' }]}
            onPress={() => {
            onClose?.();
            setGroupModalTab?.('posts');
            setSecondSheet?.({ source: 'GroupDetails', group: item });
            }}
            >
            <Ionicons name="close" size={20} color={isDark ? '#aaa' : '#555'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Ghost Mode ── */}
      <View style={[styles.ghostBar, { backgroundColor: CARD_BG, borderColor: isDark ? '#222' : '#E5E7EB' }]}>
        <Ionicons
          name={isGhostMode ? 'eye-off' : 'eye'}
          size={16}
          color={isGhostMode ? '#888' : ACCENT}
        />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.ghostTitle, { color: isDark ? '#fff' : '#111' }]}>
            {isGhostMode ? 'Ghost Mode ON' : 'Visible to others'}
          </Text>
          <Text style={[styles.ghostSub, { color: isDark ? '#666' : '#999' }]}>
            {isGhostMode ? 'You\'re hidden from radar' : 'Nearby people can see you'}
          </Text>
        </View>
        <Switch
          value={isGhostMode}
          onValueChange={toggleGhostMode}
          trackColor={{ false: isDark ? '#333' : '#D1D1D6', true: ACCENT }}
          thumbColor="#fff"
        />
      </View>

      {/* ── Tabs ── */}
      <View style={[styles.tabs, { backgroundColor: isDark ? '#1A1A1A' : '#E5E7EB' }]}>
        {['vibes', 'communities'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && [styles.activeTab, { backgroundColor: isDark ? '#2C2C2E' : '#fff' }]]}
            onPress={() => handleTabSwitch(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: isDark ? '#888' : '#777' }, activeTab === tab && { color: isDark ? '#fff' : '#111', fontWeight: '800' }]}>
              {tab === 'vibes' ? '🔥 Live Vibes' : '🌍 Communities'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Radius Slider ── */}
      <View style={[styles.sliderBox, { backgroundColor: CARD_BG, borderColor: isDark ? '#222' : '#E5E7EB' }]}>
        <View style={styles.sliderRow}>
          <Ionicons name="navigate-circle-outline" size={15} color={ACCENT} />
          <Text style={[styles.sliderLabel, { color: isDark ? '#ccc' : '#555' }]}>Search radius</Text>
          <View style={[styles.radiusBadge, { backgroundColor: ACCENT + '22' }]}>
            <Text style={[styles.radiusText, { color: ACCENT }]}>
              {sliderValue < 1 ? `${(sliderValue * 1000).toFixed(0)}m` : `${sliderValue} km`}
            </Text>
          </View>
        </View>
        <Slider
          style={{ width: '100%', height: 32 }}
          minimumValue={0.5}
          maximumValue={100}
          step={0.5}
          value={radiusKm}
          onValueChange={handleSliderChange}
          onSlidingComplete={handleSliderComplete}
          minimumTrackTintColor={ACCENT}
          maximumTrackTintColor={isDark ? '#333' : '#D1D1D6'}
          thumbTintColor={ACCENT}
        />
        <View style={styles.sliderTicks}>
          {['500m', '25km', '50km', '100km'].map(t => (
            <Text key={t} style={[styles.tick, { color: isDark ? '#555' : '#bbb' }]}>{t}</Text>
          ))}
        </View>
      </View>

      {/* ── Content: Radar View or List View ── */}
      {viewMode === 'radar' ? (
        <View style={styles.radarWrapper}>
          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={[styles.statChip, { backgroundColor: (brand.blue || '#007AFF') + '22' }]}>
              <Text style={[styles.statNum, { color: brand.blue || '#007AFF' }]}>{users.length}</Text>
              <Text style={[styles.statLbl, { color: isDark ? '#888' : '#666' }]}>people</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: '#FF9F0A22' }]}>
              <Text style={[styles.statNum, { color: '#FF9F0A' }]}>{communities.length}</Text>
              <Text style={[styles.statLbl, { color: isDark ? '#888' : '#666' }]}>communities</Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: '#30D15822' }]}>
              <Text style={[styles.statNum, { color: '#30D158' }]}>{radiusKm < 1 ? `${(radiusKm * 1000).toFixed(0)}m` : `${radiusKm}km`}</Text>
              <Text style={[styles.statLbl, { color: isDark ? '#888' : '#666' }]}>radius</Text>
            </View>
          </View>

          {/* Radar circle */}
          <View style={[styles.radarOuter, { backgroundColor: RADAR_BG }]}>
            {/* Crosshairs */}
            <View style={[styles.crossH, { backgroundColor: CROSSHAIR }]} />
            <View style={[styles.crossV, { backgroundColor: CROSSHAIR }]} />

            {/* Rings */}
            {rings.map((pct, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  width: RADAR_SIZE * pct,
                  height: RADAR_SIZE * pct,
                  borderRadius: (RADAR_SIZE * pct) / 2,
                  backgroundColor: RING_COLOR,
                  borderWidth: 1,
                  borderColor: RING_BORDER,
                  top: (RADAR_SIZE - RADAR_SIZE * pct) / 2,
                  left: (RADAR_SIZE - RADAR_SIZE * pct) / 2,
                }}
              />
            ))}

            {/* Center dot (you) */}
            <View style={[styles.centerDot, { backgroundColor: '#FF2D55', shadowColor: '#FF2D55' }]}>
              <View style={[styles.centerDotInner, { backgroundColor: '#fff' }]} />
            </View>

            {/* Sweep — always visible; ghost mode only hides YOU from others */}
            <RadarSweep isDark={isDark} />

            {/* User dots — always visible; ghost mode only hides YOU from others */}
            {(() => {
              const activeItems = activeTab === 'vibes' ? users : communities;
              const positions = computeRadarPositions(activeItems, radiusKm);
              return activeItems.map((item, idx) => {
                const pos = positions[idx];
                if (!pos) return null;
                return (
                  <AvatarDot
                    key={item.id}
                    item={item}
                    posX={pos.x}
                    posY={pos.y}
                    isDark={isDark}
                    onPress={handleDotPress}
                    type={activeTab === 'vibes' ? 'user' : 'group'}
                  />
                );
              });
            })()}

            {/* Empty overlay */}
            {!isRadarLoading && activeList.length === 0 && (
              <View style={styles.radarEmpty}>
                <MaterialCommunityIcons
                  name={activeTab === 'vibes' ? 'ghost-outline' : 'account-group-outline'}
                  size={32}
                  color={isDark ? '#333' : '#ccc'}
                />
                <Text style={[styles.radarEmptyText, { color: isDark ? '#555' : '#bbb' }]}>
                  {activeTab === 'vibes' ? 'No one nearby' : 'No communities nearby'}
                </Text>
              </View>
            )}

            {isRadarLoading && (
              <View style={styles.radarEmpty}>
                <ActivityIndicator size="large" color={ACCENT} />
                <Text style={[styles.radarEmptyText, { color: isDark ? '#666' : '#aaa' }]}>Scanning…</Text>
              </View>
            )}

            {/* Compass labels */}
            <Text style={[styles.compassN, { color: isDark ? '#446' : '#9ab' }]}>N</Text>
            <Text style={[styles.compassS, { color: isDark ? '#446' : '#9ab' }]}>S</Text>
            <Text style={[styles.compassE, { color: isDark ? '#446' : '#9ab' }]}>E</Text>
            <Text style={[styles.compassW, { color: isDark ? '#446' : '#9ab' }]}>W</Text>

            {/* Range labels on right side */}
            {rings.map((pct, i) => {
              const kmLabel = (radiusKm * pct).toFixed(pct < 0.3 && radiusKm < 10 ? 1 : 0);
              return (
                <Text
                  key={`rl-${i}`}
                  style={[styles.ringLabel, {
                    top: RADAR_SIZE / 2 - 8,
                    left: RADAR_SIZE / 2 + (RADAR_SIZE * pct) / 2 + 2,
                    color: isDark ? '#334' : '#9ab',
                  }]}
                >
                  {kmLabel < 1 ? `${(kmLabel * 1000).toFixed(0)}m` : `${kmLabel}km`}
                </Text>
              );
            })}

            {/* Info popup */}
            {selectedItem && (
              <InfoPopup
                item={selectedItem}
                type={activeTab === 'vibes' ? 'user' : 'group'}
                isDark={isDark}
                onClose={() => setSelectedItem(null)}
                onAction={handleAction}
              />
            )}
          </View>

          {/* Ghost mode notice — YOU are hidden from others, but you can still see them */}
          {isGhostMode && (
            <View style={[styles.ghostNotice, { backgroundColor: isDark ? '#1C1C1E' : '#F3F4F6' }]}>
              <MaterialCommunityIcons name="ghost-outline" size={16} color="#888" />
              <Text style={[styles.ghostNoticeText, { color: isDark ? '#666' : '#888' }]}>
                You're hidden — others can't see you
              </Text>
            </View>
          )}

          <Text style={[styles.hint, { color: isDark ? '#333' : '#bbb' }]}>
            Tap a dot to learn more
          </Text>
        </View>
      ) : (
        /* ── List View ── */
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {isRadarLoading ? (
            <View style={styles.listCenter}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={[styles.loadingText, { color: isDark ? '#888' : '#666' }]}>Scanning your surroundings…</Text>
            </View>
          ) : activeList.length === 0 ? (
            <View style={styles.listCenter}>
              <MaterialCommunityIcons name={activeTab === 'vibes' ? 'ghost-outline' : 'map-marker-off-outline'} size={52} color={isDark ? '#333' : '#ddd'} />
              <Text style={[styles.emptyText, { color: isDark ? '#666' : '#999' }]}>
                {activeTab === 'vibes' ? 'No one nearby right now' : 'No communities found nearby'}
              </Text>
            </View>
          ) : activeTab === 'vibes' ? (
            users.map(item => (
              <View key={item.id} style={[styles.userCard, { backgroundColor: CARD_BG, borderColor: isDark ? '#222' : '#F0F0F0' }]}>
                <View style={[styles.avatarBox, { borderColor: ACCENT + '66' }]}>
                  {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={styles.avatarImg} fadeDuration={200} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: ACCENT + '22' }]}>
                      <Text style={[styles.avatarInitial, { color: ACCENT }]}>
                        {(item.username || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: isDark ? '#fff' : '#111' }]}>@{item.username}</Text>
                  <Text style={[styles.cardDist, { color: isDark ? '#888' : '#888' }]}>{getFuzzyDistance(item.distance_km)}</Text>
                  {item.sharedInterest && (
                    <View style={[styles.interestBadge, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                      <Text style={styles.interestText}>✨ Both like {item.sharedInterest}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: ACCENT }]}
                  onPress={() => handleWave(item)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>Wave 👋</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            communities.map(item => (
              <View key={item.id} style={[styles.groupCard, { backgroundColor: CARD_BG, borderColor: isDark ? '#222' : '#eee' }]}>
                <View style={[styles.groupIcon, { backgroundColor: '#FF9F0A22', borderColor: '#FF9F0A66' }]}>
                  <Text style={{ fontSize: 20 }}>🌍</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: isDark ? '#fff' : '#111' }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.cardDist, { color: '#FF9F0A' }]}>
                    📍 {item.distance_km < 1
                      ? `${(item.distance_km * 1000).toFixed(0)}m away`
                      : `${item.distance_km.toFixed(1)}km away`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#FF9F0A' }]}
                  onPress={() => {
                  onClose?.();
                  setGroupModalTab?.('posts');
                  setSecondSheet?.({ source: 'GroupDetails', group: item });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>Explore</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', gap: 8 },
  radarIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  closeBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  viewToggle: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  ghostBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  ghostTitle: { fontSize: 13, fontWeight: '700' },
  ghostSub: { fontSize: 11, marginTop: 1 },

  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 3,
    marginBottom: 10,
  },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 11 },
  activeTab: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: '600' },

  sliderBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  sliderLabel: { flex: 1, fontSize: 12, fontWeight: '600' },
  radiusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  radiusText: { fontSize: 12, fontWeight: '800' },
  sliderTicks: { flexDirection: 'row', justifyContent: 'space-between' },
  tick: { fontSize: 10 },

  // ── Radar ──
  radarWrapper: {
    alignItems: 'center',
    flex: 1,
    paddingBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNum: { fontSize: 16, fontWeight: '900' },
  statLbl: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  radarOuter: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    overflow: 'hidden',
    position: 'relative',
  },
  crossH: {
    position: 'absolute',
    top: RADAR_CENTER - 0.5,
    left: 0,
    right: 0,
    height: 1,
  },
  crossV: {
    position: 'absolute',
    left: RADAR_CENTER - 0.5,
    top: 0,
    bottom: 0,
    width: 1,
  },
  centerDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    top: RADAR_CENTER - 7,
    left: RADAR_CENTER - 7,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },
  centerDotInner: { width: 6, height: 6, borderRadius: 3 },
  radarEmpty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  radarEmptyText: { fontSize: 13, fontWeight: '600' },
  compassN: { position: 'absolute', top: 4, left: RADAR_CENTER - 5, fontSize: 10, fontWeight: '700' },
  compassS: { position: 'absolute', bottom: 4, left: RADAR_CENTER - 5, fontSize: 10, fontWeight: '700' },
  compassE: { position: 'absolute', right: 6, top: RADAR_CENTER - 7, fontSize: 10, fontWeight: '700' },
  compassW: { position: 'absolute', left: 6, top: RADAR_CENTER - 7, fontSize: 10, fontWeight: '700' },
  ringLabel: { position: 'absolute', fontSize: 8, fontWeight: '600' },
  ghostNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  ghostNoticeText: { fontSize: 12, fontWeight: '600' },
  hint: { marginTop: 6, fontSize: 11, fontWeight: '500' },

  // ── List ──
  listScroll: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  listCenter: { alignItems: 'center', marginTop: 60, gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 8 },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    elevation: 1,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '900' },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { fontSize: 15, fontWeight: '700' },
  cardDist: { fontSize: 12, marginTop: 2 },
  interestBadge: {
    marginTop: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  interestText: { fontSize: 10, fontWeight: '700', color: '#D97706' },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});