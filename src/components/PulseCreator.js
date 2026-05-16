// client/src/components/PulseCreator.js
// ⭐️ FINAL FULL VERSION: Performance Optimized with Memoization & Safe Fallbacks ⭐️

import React, { useState, useCallback, useMemo, memo } from 'react';
import { 
  View, Text, TouchableOpacity, ImageBackground, 
  TextInput, StyleSheet, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../constants/data';

const PulseCreator = ({ user, activePulse, onOpenLive, onOpenCamera, onSendPulse, isPosting }) => {
  const [pulseText, setPulseText] = useState('');

  // ⭐️ PERF: Memoize background image calculation to prevent re-evaluation on every keystroke
  const bgImage = useMemo(() => {
      if (activePulse?.image) return { uri: activePulse.image };
      if (user?.avatarUrl) return { uri: user.avatarUrl };
      return { uri: 'https://source.unsplash.com/random/800x600/?abstract,blue' };
  }, [activePulse?.image, user?.avatarUrl]);

  // ⭐️ PERF: Memoize action handler
  const handleSend = useCallback(() => {
    if (pulseText.trim()) {
      onSendPulse(pulseText.trim());
      setPulseText('');
    }
  }, [pulseText, onSendPulse]);

  return (
    <View style={styles.container}>
      <ImageBackground 
        source={bgImage} 
        style={styles.bgImage} 
        imageStyle={{ borderRadius: 24, opacity: 0.95 }}
      >
        <View style={styles.overlay}>
          
          {/* Top Row: Go Live & Active Badges */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={onOpenLive} style={styles.liveBadge}>
                <View style={styles.redDot} />
                <Text style={styles.liveText}>GO LIVE</Text>
              </TouchableOpacity>

              {activePulse && (
                  <View style={styles.activeBadge}>
                      <Text style={styles.activeText}>YOUR VIBE</Text>
                  </View>
              )}
          </View>

          {/* Active Pulse Text (If exists) */}
          {activePulse && !pulseText && (
              <View style={styles.currentPulseContainer}>
                  <Text style={styles.currentPulseText}>"{activePulse.text}"</Text>
              </View>
          )}

          {/* Bottom Controls: Camera, Input, Send */}
          <View style={styles.bottomBar}>
            <TouchableOpacity onPress={onOpenCamera} style={styles.iconBtn}>
              <Ionicons name="camera" size={24} color="#fff" />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder={activePulse ? "Update your vibe..." : `What's up, ${user?.username || 'Friend'}?`}
              placeholderTextColor="rgba(255,255,255,0.8)"
              value={pulseText}
              onChangeText={setPulseText}
              multiline={false}
            />

            <TouchableOpacity 
              onPress={pulseText.trim() ? handleSend : onOpenCamera} 
              style={[styles.sendBtn, { backgroundColor: pulseText.trim() ? brand.blue : 'rgba(255,255,255,0.2)' }]}
              disabled={isPosting}
            >
              {isPosting ? (
                  <ActivityIndicator size="small" color="#fff" />
              ) : (
                  <Ionicons name={pulseText.trim() ? "send" : "add"} size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

        </View>
      </ImageBackground>
    </View>
  );
};

export default memo(PulseCreator);

const styles = StyleSheet.create({
  container: {
    height: 240, marginHorizontal: 16, marginTop: 16, borderRadius: 24,
    backgroundColor: '#222', elevation: 8, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6,
  },
  bgImage: { width: '100%', height: '100%', justifyContent: 'flex-end' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 24, justifyContent: 'space-between', padding: 16 },
  liveBadge: { backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  activeBadge: { backgroundColor: brand.blue, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  activeText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30', marginRight: 6 },
  liveText: { color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 1 },
  currentPulseContainer: { alignSelf: 'flex-start', marginBottom: 10, paddingHorizontal: 4 },
  currentPulseText: { color: '#fff', fontSize: 22, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 4, fontStyle: 'italic' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20, 20, 20, 0.75)', borderRadius: 30, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 16, paddingHorizontal: 8, fontWeight: '500' },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }
});