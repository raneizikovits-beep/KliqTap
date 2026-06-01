// client/src/components/SoundPicker.js
// 🎵 KliqTap SoundPicker — בורר מוזיקה עם preview (expo-av) 🎵
//
// שימוש: מציגים אותו כ-bottom sheet מתוך מסך המצלמה.
//   <SoundPicker visible={x} onClose={...} onSelect={(sound) => ...} />
//
// ⚖️ חוקי: רק מוזיקה מורשית — שירי TayTop (owned) או royalty-free עם sub-license ל-UGC.
//          אסור שירים מסחריים, בשום אורך.
// 📌 expo-av כבר מותקן אצלך (SDK 52). כשתשדרג ל-SDK 55 — עוברים ל-expo-audio.

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

import localSounds from './sounds.json';

const ACCENT = '#7C5CFF';
const ACCENT_2 = '#FF3D8B';

const CAT_LABELS = {
  all: 'All', taytop: 'TayTop ⭐', upbeat: 'Upbeat',
  chill: 'Chill', dance: 'Dance',
};

export const SoundPicker = ({ visible, onClose, onSelect }) => {
  const soundRef = useRef(null);
  const allSounds = useMemo(() => localSounds.sounds || [], []);
  const categories = useMemo(
    () => ['all', ...Array.from(new Set(allSounds.map((s) => s.category)))],
    [allSounds]
  );

  const [activeCat, setActiveCat] = useState('all');
  const [playingId, setPlayingId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  const visibleSounds = useMemo(
    () => (activeCat === 'all' ? allSounds : allSounds.filter((s) => s.category === activeCat)),
    [activeCat, allSounds]
  );

  // ניקוי האודיו כשנסגר / יוצאים
  const stopPreview = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (_) {}
    setPlayingId(null);
  }, []);

  useEffect(() => {
    if (!visible) stopPreview();
  }, [visible, stopPreview]);

  useEffect(() => () => { stopPreview(); }, [stopPreview]);

  const togglePreview = useCallback(async (sound) => {
    Haptics.selectionAsync().catch(() => {});
    // אם כבר מתנגן הזה — עצור
    if (playingId === sound.id) {
      await stopPreview();
      return;
    }
    await stopPreview();
    setLoadingId(sound.id);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: snd } = await Audio.Sound.createAsync(
        { uri: sound.file_url },
        { shouldPlay: true, isLooping: true }
      );
      soundRef.current = snd;
      setPlayingId(sound.id);
    } catch (e) {
      console.error('Preview failed:', e);
    } finally {
      setLoadingId(null);
    }
  }, [playingId, stopPreview]);

  const choose = useCallback(async (sound) => {
    await stopPreview();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSelect?.(sound);
    onClose?.();
  }, [stopPreview, onSelect, onClose]);

  const renderRow = useCallback(({ item }) => {
    const isPlaying = playingId === item.id;
    const isLoading = loadingId === item.id;
    return (
      <View style={styles.row}>
        <TouchableOpacity style={styles.coverWrap} onPress={() => togglePreview(item)} activeOpacity={0.8}>
          <LinearGradient colors={[ACCENT, ACCENT_2]} style={styles.cover}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : isPlaying ? (
              <Ionicons name="pause" size={22} color="#fff" />
            ) : (
              <Text style={styles.coverEmoji}>{item.cover_emoji || '🎵'}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>
            {item.artist}{item.is_owned ? '  •  ⭐ Original' : ''}
          </Text>
        </View>

        <TouchableOpacity onPress={() => choose(item)} activeOpacity={0.85}>
          <LinearGradient colors={[ACCENT, ACCENT_2]} style={styles.useBtn}>
            <Text style={styles.useText}>Use</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }, [playingId, loadingId, togglePreview, choose]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.heading}>Add Sound 🎵</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => c}
          contentContainerStyle={styles.pillRow}
          renderItem={({ item }) => {
            const active = item === activeCat;
            return (
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setActiveCat(item); }}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {CAT_LABELS[item] || item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        <FlatList
          data={visibleSounds}
          keyExtractor={(s) => s.id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingBottom: 30 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '72%',
    backgroundColor: '#15131F', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 10, paddingHorizontal: 16,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '800' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },

  pillRow: { gap: 8, paddingBottom: 14 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)' },
  pillActive: { backgroundColor: '#fff' },
  pillText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: '#000' },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  coverWrap: { marginRight: 14 },
  cover: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  coverEmoji: { fontSize: 26 },
  meta: { flex: 1 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  artist: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 },
  useBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 22 },
  useText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  sep: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
});