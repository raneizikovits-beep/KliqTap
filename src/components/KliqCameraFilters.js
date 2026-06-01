// client/src/components/KliqCameraFilters.js
// AR Filters — temporarily unavailable (DeepAR SDK incompatible with AGP 8.6+)
// TODO: Replace with react-native-vision-camera + AR plugin
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const ACCENT = '#7C5CFF';
const ACCENT_2 = '#FF3D8B';

export const KliqCameraFilters = ({ navigation }) => {
  return (
    <View style={styles.container}>

      {/* Top bar — same layout as real screen */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation?.goBack?.()}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Center content */}
      <View style={styles.center}>
        <LinearGradient
          colors={[ACCENT, ACCENT_2]}
          style={styles.iconCircle}
        >
          <Ionicons name="sparkles" size={44} color="#fff" />
        </LinearGradient>

        <Text style={styles.title}>AR Filters</Text>
        <Text style={styles.subtitle}>
          We're upgrading the AR engine for a{'\n'}
          smoother, more powerful experience.
        </Text>

        <View style={styles.badge}>
          <Ionicons name="time-outline" size={14} color={ACCENT} />
          <Text style={styles.badgeText}>Coming in the next update</Text>
        </View>
      </View>

      {/* Bottom — same position as real capture button */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation?.goBack?.()}
        >
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
};

export default KliqCameraFilters;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 40,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(124,92,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.3)',
    marginTop: 8,
  },
  badgeText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },
  bottom: {
    paddingBottom: 44,
    alignItems: 'center',
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  backBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});