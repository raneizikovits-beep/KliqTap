// client/src/components/KliqPulseBoard.js
// ⭐️ V8.1 KLIQMIND OMEGA: SUPREME NEON BOARD ⭐️
// ─────────────────────────────────────────────────────────────────────────────
// AUDIT FIXES vs V8.0 (behavior + visuals preserved 100%):
//   ✅ [CRITICAL] Animation-loop leak fixed. V8.0 re-ran ALL loops every time
//      `activeAdminPulse` changed AND never stopped them → overlapping loops,
//      jank & battery drain over a session, plus loops left running on unmount.
//      Loops now start ONCE on mount and are stopped in cleanup. The entrance
//      fade/slide still re-fires when the displayed pulse changes (intent kept).
//   ✅ Removed unused `Ionicons` import.
//   ✅ STANDARD_VIBES is now a Set (O(1) lookup instead of O(n) every render).
//   ✅ Derived values memoized; accessibility label added.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const STANDARD_VIBES = new Set([
  'Happy', 'Sad', 'Neutral', 'Tired', 'Broken', 'Excited', 'Angry', 'Relaxed', 'Bored', 'Sick',
  'Focused', 'Party', 'Work', 'Study', 'Gym', 'Gaming', 'Travel', 'Foodie', 'Driving', 'Coding',
  'Love', 'Cool', 'Normal', 'Chill', 'Lit', 'Vibing', 'Music', 'Nature', 'Art', 'Fashion',
]);

const KliqPulseBoard = () => {

  const { userSettings, pulses = [] } = useAppStore();
  const isDark = userSettings?.darkMode === true;

  // An "admin pulse" is any pulse whose vibe is not one of the standard ones.
  const activeAdminPulse = useMemo(
    () => pulses.find((p) => !STANDARD_VIBES.has(p.vibe)),
    [pulses]
  );

  // A stable identity for the displayed pulse so effects don't re-run on every
  // unrelated store update (object identity churn).
  const pulseKey = activeAdminPulse?.id ?? activeAdminPulse?.vibe ?? 'system';

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(20)).current;
  const breathAnim = useRef(new Animated.Value(1)).current;
  const barAnim    = useRef(new Animated.Value(0)).current;
  const ringAnim   = useRef(new Animated.Value(0)).current;

  // ── Effect A: looping ambient animations — start ONCE, stop on unmount ──────
  useEffect(() => {
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.08, duration: 2500, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
      ])
    );
    const barLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(barAnim, { toValue: 1, duration: 3000, useNativeDriver: false }),
        Animated.timing(barAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    const ringLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );

    breathLoop.start();
    barLoop.start();
    ringLoop.start();

    return () => {
      breathLoop.stop();
      barLoop.stop();
      ringLoop.stop();
    };
  }, [breathAnim, barAnim, ringAnim]);

  // ── Effect B: entrance fade/slide — re-fires when the displayed pulse changes
  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    const entrance = Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [pulseKey, fadeAnim, slideAnim]);

  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });

  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  const displayTitle = activeAdminPulse?.vibe || `SYSTEM: ONLINE`;
  const displayMessage = activeAdminPulse?.text || `Neural link synchronized.\nMonitoring KliqTap network...`;
  const imageSource = useMemo(
    () => (activeAdminPulse?.imageUrl ? { uri: activeAdminPulse.imageUrl } : null),
    [activeAdminPulse?.imageUrl]
  );

  return (
    <View
      style={localStyles.outerWrapper}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${displayTitle}. ${displayMessage}`}
    >
      <LinearGradient
        colors={isDark ? ['#0B0914', '#1A1635', '#2A2359'] : ['#111', '#222', '#333']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={localStyles.container}
      >
        <View style={localStyles.content}>

          <Animated.View style={[localStyles.visualContainer, { transform: [{ scale: breathAnim }] }]}>

            {/* גלי רדאר רק כשאין תמונת פרופיל */}
            {!imageSource && (
              <Animated.View style={[localStyles.radarRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
            )}

            {imageSource ? (
              <Image source={imageSource} style={localStyles.leadImage} />
            ) : (
              <View style={localStyles.glowCircle}>
                <MaterialCommunityIcons name="shield-check" size={48} color="#00E5FF" />
              </View>
            )}
            <View style={localStyles.activeDot} />
          </Animated.View>

          <Animated.View style={[
            localStyles.textContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}>
            <Text style={localStyles.title} numberOfLines={1} adjustsFontSizeToFit>
              {displayTitle}
            </Text>
            <Text style={localStyles.message}>{displayMessage}</Text>
          </Animated.View>
        </View>

        <View style={localStyles.powerBar}>
          <Animated.View style={[localStyles.powerFill, { width: barWidth }]} />
        </View>
      </LinearGradient>
    </View>
  );
};

const localStyles = StyleSheet.create({
  outerWrapper: {
    marginHorizontal: 15,
    marginBottom: 25,
    borderRadius: 28,
    elevation: 20,
    shadowColor: "#00E5FF",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 }
  },
  container: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(0, 229, 255, 0.35)'
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  visualContainer: {
    position: 'relative',
    marginRight: 16,
  },
  radarRing: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#00E5FF',
    top: 0,
    left: 0,
  },
  glowCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 229, 255, 0.5)'
  },
  leadImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2.5,
    borderColor: '#00E5FF',
  },
  activeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00E5FF',
    borderWidth: 2,
    borderColor: '#0B0914',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center'
  },
  title: {
    color: '#00E5FF',
    fontWeight: '900',
    fontSize: 21,
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 229, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8
  },
  message: {
    color: '#E0E7FF',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22
  },
  powerBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 18,
    borderRadius: 2,
    overflow: 'hidden'
  },
  powerFill: {
    height: '100%',
    backgroundColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOpacity: 1,
    shadowRadius: 8
  }
});
export default KliqPulseBoard;