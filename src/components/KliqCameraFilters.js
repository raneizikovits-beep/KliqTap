// client/src/components/KliqCameraFilters.js
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, PermissionsAndroid, Platform, AppState, Alert
} from 'react-native';
import DeepARView, { CameraPositions } from 'react-native-deepar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library'; 
import * as ImageManipulator from 'expo-image-manipulator'; // ✂️ חיתוך 4:5 במקור

import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore'; 
import { brand } from '../constants/data';

import localFilters from './filters.json';

const DEEPAR_API_KEY = '0f1815ebb53fb4c3d28b9c5df15566c9b9cbc6184e93d26311b5b1cfca50d7a82a5186babf28d215';

const ACCENT = '#7C5CFF';
const ACCENT_2 = '#FF3D8B';
const BG_DIM = 'rgba(0,0,0,0.45)';

const CATEGORY_LABELS = {
  all: 'All', base_beauty: 'Beauty', vibes_neon: 'Vibes',
  local_fun: 'Local', brand_pop: 'Pop', color_luts: 'Color',
};

const CATEGORY_GRADIENTS = {
  base_beauty: ['#FF9A9E', '#FAD0C4'],
  vibes_neon: ['#7C5CFF', '#00E0FF'],
  local_fun: ['#FFD200', '#F7971E'],
  brand_pop: ['#FF3D8B', '#FF8A00'],
  color_luts: ['#00F5A0', '#00D9F5'],
  default: ['#7C5CFF', '#FF3D8B'],
};

const EMOJI_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2190-\u21FF\u2300-\u27BF\u2B00-\u2BFF\uFE0F\u200D]/g;
const getEmoji = (name = '') => {
  const m = name.match(EMOJI_RE);
  return m ? m.join('') : '✨';
};
const getLabel = (name = '') => name.replace(EMOJI_RE, '').trim();

// ✂️ חותך את תמונת ה-DeepAR (portrait צר) ליחס 4:5 — ממלא יפה את הפיד בלי מתיחה.
// חיתוך מהמרכז: שומר על הפרופורציות והאיכות, רק מוריד עודף מלמעלה/למטה.
const TARGET_RATIO = 4 / 5; // רוחב/גובה
const cropTo4x5 = async (uri) => {
  try {
    // קודם מודדים את גודל התמונה המקורית
    const probe = await ImageManipulator.manipulateAsync(uri, [], {});
    const { width, height } = probe;
    if (!width || !height) return uri;

    let cropW = width;
    let cropH = Math.round(width / TARGET_RATIO);

    if (cropH > height) {
      // התמונה כבר לא מספיק גבוהה — חותכים לפי הגובה במקום
      cropH = height;
      cropW = Math.round(height * TARGET_RATIO);
    }

    const originX = Math.round((width - cropW) / 2);
    const originY = Math.round((height - cropH) / 2);

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: { originX, originY, width: cropW, height: cropH } }],
      { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (e) {
    console.warn('Crop failed, using original:', e);
    return uri; // אם החיתוך נכשל — לא מפילים, פשוט משתמשים במקור
  }
};

export const KliqCameraFilters = ({ navigation }) => {
  const deepARRef = useRef(null);
  const clearingRef = useRef(false);

  const allFilters = useMemo(() => localFilters.filters || [], []);
  const categories = useMemo(
    () => ['all', ...Array.from(new Set(allFilters.map((f) => f.category)))],
    [allFilters]
  );

  const [activeCategory, setActiveCategory] = useState('all');
  const [activeFilterId, setActiveFilterId] = useState(null);
  const [loadingFilterId, setLoadingFilterId] = useState(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [cameraPosition, setCameraPosition] = useState(CameraPositions.FRONT);
  const [flashOn, setFlashOn] = useState(false);
  const [toast, setToast] = useState(null);

  // ── מצבי תצוגה מקדימה (Preview) ──
  const [capturedUri, setCapturedUri] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // 🚀 מושכים מהסטור. אם משהו חסר, הוא יהיה undefined אבל לא יקריס את האפליקציה!
  const { setPulseCreateOpen, setPulseImageUri, setPostCreateOpen, setPostImageUri } = useAppStore(
    useShallow((state) => ({
      setPulseCreateOpen: state.setPulseCreateOpen,
      setPulseImageUri: state.setPulseImageUri,
      setPostCreateOpen: state.setPostCreateOpen,
      setPostImageUri: state.setPostImageUri,
    }))
  );

  const visibleFilters = useMemo(
    () =>
      activeCategory === 'all'
        ? allFilters
        : allFilters.filter((f) => f.category === activeCategory),
    [activeCategory, allFilters]
  );

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        const mediaStatus = await MediaLibrary.requestPermissionsAsync();
        
        setHasPermissions(
          granted[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted' &&
          mediaStatus.granted
        );
      } else {
        const mediaStatus = await MediaLibrary.requestPermissionsAsync();
        setHasPermissions(mediaStatus.granted);
      }
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!deepARRef.current) return;
      if (state === 'active') deepARRef.current.resume?.();
      else deepARRef.current.pause?.();
    });
    return () => sub.remove();
  }, []);

  const handleFilterSelect = useCallback(async (filter) => {
    if (!deepARRef.current || !isReady) {
      showToast('Camera still loading…');
      return;
    }
    if (activeFilterId === filter.id || loadingFilterId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setLoadingFilterId(filter.id);

    try {
      if (!filter.file_url || !filter.file_url.startsWith('http')) {
        throw new Error('file_url must be http(s): ' + filter.file_url);
      }

      const localUri = FileSystem.cacheDirectory + filter.file_name;
      const info = await FileSystem.getInfoAsync(localUri);
      if (!info.exists) {
        console.log('⬇️ Downloading filter:', filter.file_url);
        await FileSystem.downloadAsync(filter.file_url, localUri);
      }

      const nativePath = localUri.replace('file://', '');
      console.log('🎭 switchEffectWithPath ->', nativePath);

      deepARRef.current.switchEffectWithPath({
        path: nativePath,
        slot: 'effect',
      });
      setActiveFilterId(filter.id);

      setTimeout(
        () => setLoadingFilterId((cur) => (cur === filter.id ? null : cur)),
        6000
      );
    } catch (e) {
      console.error('❌ Filter load failed:', e);
      showToast('Couldn’t load that one 😕');
      setLoadingFilterId(null);
    }
  }, [activeFilterId, loadingFilterId, isReady, showToast]);

  const clearFilter = useCallback(() => {
    if (!deepARRef.current || !isReady) return;
    Haptics.selectionAsync().catch(() => {});
    clearingRef.current = true;
    try {
      deepARRef.current.switchEffect({ mask: '', slot: 'effect' });
    } catch (_) {}
    setActiveFilterId(null);
    setTimeout(() => { clearingRef.current = false; }, 800);
  }, [isReady]);

  const toggleFlash = useCallback(() => {
    const next = !flashOn;
    setFlashOn(next);
    deepARRef.current?.setFlashOn?.(next);
    Haptics.selectionAsync().catch(() => {});
  }, [flashOn]);

  const flipCamera = useCallback(() => {
    setCameraPosition((p) =>
      p === CameraPositions.FRONT ? CameraPositions.BACK : CameraPositions.FRONT
    );
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const capture = useCallback(() => {
    if (!isReady || isCapturing) return;
    setIsCapturing(true); 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    
    deepARRef.current?.takeScreenshot?.();
    setTimeout(() => setIsCapturing(false), 2000);
  }, [isReady, isCapturing]);

  // ── 💾 פעולות מסך ה-Preview ──
  const handleDownloadToPhone = useCallback(async () => {
    if (!capturedUri) return;
    try {
      await MediaLibrary.saveToLibraryAsync(capturedUri);
      Alert.alert('Saved!', 'Photo saved to your gallery.');
    } catch (e) {
      console.error('Save failed:', e);
      Alert.alert('Error', 'Could not save photo.');
    }
  }, [capturedUri]);

  const handleShareToPulse = useCallback(() => {
    if (!capturedUri) return;
    if (typeof setPulseImageUri === 'function' && typeof setPulseCreateOpen === 'function') {
      setPulseImageUri(capturedUri);
      setPulseCreateOpen(true);
      navigation?.goBack?.(); 
    } else {
      Alert.alert('Error', 'Pulse actions not found in store.');
    }
  }, [capturedUri, setPulseImageUri, setPulseCreateOpen, navigation]);

  // רשת ביטחון לכפתור הפיד!
  const handleShareToFeed = useCallback(() => {
    if (!capturedUri) return;
    
    // בודק אם הפונקציות קיימות בסטור לפני שהוא מפעיל אותן
    if (typeof setPostImageUri === 'function' && typeof setPostCreateOpen === 'function') {
      setPostImageUri(capturedUri);
      setPostCreateOpen(true);
      navigation?.goBack?.(); 
    } else {
      Alert.alert(
        'Almost there!',
        'To share to the Feed, we need to wire the Feed Modal to your global store (just like Pulse).'
      );
    }
  }, [capturedUri, setPostImageUri, setPostCreateOpen, navigation]);

  const renderTile = useCallback(
    ({ item }) => {
      const isActive = item.id === activeFilterId;
      const isLoading = item.id === loadingFilterId;
      const grad = CATEGORY_GRADIENTS[item.category] || CATEGORY_GRADIENTS.default;
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.tileWrap}
          onPress={() => handleFilterSelect(item)}
        >
          <View style={[styles.tileRing, isActive && styles.tileRingActive]}>
            <LinearGradient colors={grad} style={styles.tile}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.tileEmoji}>{getEmoji(item.display_name)}</Text>
              )}
            </LinearGradient>
          </View>
          <Text numberOfLines={1} style={styles.tileLabel}>
            {getLabel(item.display_name)}
          </Text>
        </TouchableOpacity>
      );
    },
    [activeFilterId, loadingFilterId, handleFilterSelect]
  );

  if (!hasPermissions) {
    return (
      <View style={styles.permissionWrap}>
        <Ionicons name="camera-outline" size={48} color="#fff" />
        <Text style={styles.permissionText}>
          KliqTap needs camera and gallery access to use filters.
        </Text>
      </View>
    );
  }

  if (capturedUri) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedUri }} style={styles.previewImage} resizeMode="contain" />

        <TouchableOpacity style={styles.previewCloseButton} onPress={() => setCapturedUri(null)}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.previewActionBar}>
          <TouchableOpacity style={styles.actionRoundButton} onPress={handleDownloadToPhone}>
            <Ionicons name="download-outline" size={28} color="#FFF" />
            <Text style={styles.actionButtonText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionRoundButton, { backgroundColor: '#E91E63' }]} onPress={handleShareToPulse}>
            <Ionicons name="flash" size={28} color="#FFF" />
            <Text style={styles.actionButtonText}>Pulse</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionRoundButton, { backgroundColor: brand?.blue || '#3b82f6' }]} onPress={handleShareToFeed}>
            <Ionicons name="paper-plane" size={28} color="#FFF" />
            <Text style={styles.actionButtonText}>Feed</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DeepARView
        ref={deepARRef}
        style={styles.cameraView}
        apiKey={DEEPAR_API_KEY}
        position={cameraPosition}
        onInitialized={() => {
          console.log('✅ DeepAR initialized');
          setIsReady(true);
          deepARRef.current?.setLiveMode?.(true);
        }}
        onEffectSwitched={() => setLoadingFilterId(null)}
        
        onScreenshotTaken={async (photoPath) => {
          console.log('🖼️ Screenshot taken:', photoPath);
          showToast('Captured 📸');
          setIsCapturing(false); 
          
          const validUri = photoPath.startsWith('file://') ? photoPath : `file://${photoPath}`;
          // ✂️ חותך ל-4:5 לפני התצוגה — כך הפיד/סטורי/הורדה כולם בפרופורציה הנכונה
          const croppedUri = await cropTo4x5(validUri);
          setCapturedUri(croppedUri);
        }}
        
        onError={(text, type) => {
          // 👈 כאן הוספתי פילטר שמעלים את ההתראה הלא-מזיקה של Rendering paused מהקונסול!
          if (/PARTICLE SYSTEM/i.test(text || '') || /Process frame called/i.test(text || '')) {
            return; 
          }
          console.error('🛑 DeepAR error:', type, text);
          if (!clearingRef.current) showToast('AR error');
          setLoadingFilterId(null);
        }}
      />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation?.goBack?.()}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleFlash}>
            <Ionicons name={flashOn ? 'flash' : 'flash-off'} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={flipCamera}>
            <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <View style={styles.bottom}>
        <View style={styles.captureRow}>
          <TouchableOpacity onPress={capture} activeOpacity={0.7} disabled={isCapturing}>
            <LinearGradient colors={[ACCENT, ACCENT_2]} style={styles.captureOuter}>
              <View style={styles.captureInner} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(c) => c}
          contentContainerStyle={styles.pillRow}
          renderItem={({ item }) => {
            const active = item === activeCategory;
            return (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setActiveCategory(item);
                }}
                style={[styles.pill, active && styles.pillActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {CATEGORY_LABELS[item] || item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        <FlatList
          data={[{ id: '__none__', __none: true }, ...visibleFilters]}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.trayRow}
          renderItem={({ item }) =>
            item.__none ? (
              <TouchableOpacity
                style={styles.tileWrap}
                activeOpacity={0.8}
                onPress={clearFilter}
              >
                <View style={[styles.tileRing, activeFilterId === null && styles.tileRingActive]}>
                  <View style={[styles.tile, styles.tileNone]}>
                    <Ionicons name="ban-outline" size={24} color="#fff" />
                  </View>
                </View>
                <Text style={styles.tileLabel}>None</Text>
              </TouchableOpacity>
            ) : (
              renderTile({ item })
            )
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraView: { ...StyleSheet.absoluteFillObject },
  
  previewImage: { flex: 1, width: '100%', height: '100%' },
  previewCloseButton: { position: 'absolute', top: 50, left: 20, zIndex: 999, backgroundColor: 'rgba(0,0,0,0.6)', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  previewActionBar: { position: 'absolute', bottom: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingHorizontal: 10 },
  actionRoundButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, elevation: 6 },
  actionButtonText: { color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 4 },

  permissionWrap: {
    flex: 1, backgroundColor: '#000', alignItems: 'center',
    justifyContent: 'center', padding: 32,
  },
  permissionText: { color: '#fff', textAlign: 'center', marginTop: 16, fontSize: 16, lineHeight: 22 },

  topBar: {
    position: 'absolute', top: 50, left: 16, right: 16, zIndex: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  topRight: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: BG_DIM,
    alignItems: 'center', justifyContent: 'center',
  },

  toast: {
    position: 'absolute', top: 110, alignSelf: 'center', zIndex: 30,
    backgroundColor: 'rgba(0,0,0,0.82)', paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: 20,
  },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 28, zIndex: 10,
  },

  captureRow: { alignItems: 'center', marginBottom: 14 },
  captureOuter: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
  },
  captureInner: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff',
    borderWidth: 4, borderColor: 'rgba(0,0,0,0.15)',
  },

  pillRow: { paddingHorizontal: 14, gap: 8, marginBottom: 10 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: BG_DIM },
  pillActive: { backgroundColor: '#fff' },
  pillText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: '#000' },

  trayRow: { paddingHorizontal: 12, gap: 10, alignItems: 'flex-start' },
  tileWrap: { width: 84, alignItems: 'center', marginHorizontal: 2 },
  tileRing: {
    width: 76, height: 76, borderRadius: 38, padding: 3,
    borderWidth: 2.5, borderColor: 'transparent',
  },
  tileRingActive: { borderColor: '#fff' },
  tile: {
    flex: 1, borderRadius: 34, alignItems: 'center',
    justifyContent: 'center', overflow: 'hidden',
  },
  tileNone: { backgroundColor: 'rgba(255,255,255,0.15)' },
  tileEmoji: { fontSize: 32 },
  tileLabel: { color: '#fff', fontSize: 11, marginTop: 5, textAlign: 'center', width: 82 },
});