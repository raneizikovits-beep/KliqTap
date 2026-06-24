// client/src/components/KliqCameraFilters.js
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, PermissionsAndroid, Platform, Alert, useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library'; 
import * as ImageManipulator from 'expo-image-manipulator';

import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore'; 
import { brand } from '../constants/data';

// ⭐️ ייבוא נכון ובטוח של הפילטרים למניעת קריסות
const rawFilters = require('./filters.json');
const filtersArray = Array.isArray(rawFilters) ? rawFilters : (rawFilters.default || rawFilters.filters || []);

// המפתח שלך ל-Web
const DEEPAR_API_KEY = 'a103cc0834883df8761d40338796a91de73a80eda4cd962bf5089f94a0250e7c42523f49b0393378';

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

// ✂️ חיתוך התמונה ליחס 4:5
const TARGET_RATIO = 4 / 5; 
const cropTo4x5 = async (uri) => {
  try {
    const probe = await ImageManipulator.manipulateAsync(uri, [], {});
    const { width, height } = probe;
    if (!width || !height) return uri;

    let cropW = width;
    let cropH = Math.round(width / TARGET_RATIO);

    if (cropH > height) {
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
    return uri; 
  }
};

// ⭐️ קוד HTML שכולל את תיקון הזום (וידאו לאורך) ותיקון הפילטרים
const DEEPAR_HTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
      body { margin: 0; background: #000; overflow: hidden; display: flex; justify-content: center; align-items: center; }
      canvas { width: 100vw; height: 100vh; object-fit: contain; transform: scale(1.5) scaleX(-1); }
      #loader { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-family: sans-serif; font-weight: bold; font-size: 14px; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/deepar/js/deepar.js"></script>
  </head>
  <body>
    <canvas id="deepar-canvas"></canvas>
    <div id="loader">WAKING UP KLIQ AI...</div>
    <script>
      let deepAR = null;
      let isFront = true;
      let videoElement = null;

      async function init() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 720 },
              height: { ideal: 1280 },
              aspectRatio: { ideal: 9/16 }
            },
            audio: false
          });

          videoElement = document.createElement('video');
          videoElement.playsInline = true;
          videoElement.autoplay = true;
          videoElement.muted = true;
          videoElement.srcObject = stream;

          await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => { videoElement.play(); resolve(); };
          });

          deepAR = await deepar.initialize({
            licenseKey: '${DEEPAR_API_KEY}',
            canvas: document.getElementById('deepar-canvas'),
            deeparWasmPath: 'https://cdn.jsdelivr.net/npm/deepar/wasm/deepar.wasm',
            effect: '',
            additionalOptions: { cameraConfig: { disableDefaultCamera: true } }
          });

          deepAR.setVideoElement(videoElement, true);
          document.getElementById('loader').style.display = 'none';
          
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'initialized' }));
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: errMsg }));
        }
      }
      init();

      window.loadFilterFromBase64 = async function(base64String) {
        try {
            const res = await fetch('data:application/octet-stream;base64,' + base64String);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            if (deepAR) await deepAR.switchEffect(url);
        } catch(e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'Filter Blob failed: ' + e.message }));
        }
      };

      window.switchEffect = function(url) {
        if (deepAR) deepAR.switchEffect(url);
      };

      window.takeSnapshot = async function() {
        if (deepAR) {
          const dataUrl = await deepAR.takeScreenshot();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'screenshot', data: dataUrl }));
        }
      };

      window.flipCamera = async function() {
        if (deepAR && videoElement) {
          isFront = !isFront;
          const canvas = document.getElementById('deepar-canvas');
          canvas.style.transform = isFront ? 'scaleX(-1)' : 'scaleX(1)';
          
          const newStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: isFront ? 'user' : 'environment',
              width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9/16 }
            },
            audio: false
          });
          videoElement.srcObject = newStream;
          await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => { videoElement.play(); resolve(); };
          });
          deepAR.setVideoElement(videoElement, isFront);
        }
      };
    </script>
  </body>
  </html>
`;

export const KliqCameraFilters = ({ navigation }) => {
  const webViewRef = useRef(null);

  const { width: SCREEN_W } = useWindowDimensions();
  const TILE_W = Math.floor((SCREEN_W - 28) / 5); 
  const TILE_LABEL_W = TILE_W + 4;
  const insets = useSafeAreaInsets();

  const allFilters = useMemo(() => filtersArray, []);
  const categories = useMemo(
    () => ['all', ...Array.from(new Set(allFilters.map((f) => f.category)))],
    [allFilters]
  );

  const [activeCategory, setActiveCategory] = useState('all');
  const [activeFilterId, setActiveFilterId] = useState(null);
  const [loadingFilterId, setLoadingFilterId] = useState(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [toast, setToast] = useState(null);

  const [capturedUri, setCapturedUri] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);

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
          granted[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted' && mediaStatus.granted
        );
      } else {
        const mediaStatus = await MediaLibrary.requestPermissionsAsync();
        setHasPermissions(mediaStatus.granted);
      }
    })();
  }, []);

  const handleMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'initialized') {
        console.log('✅ Web DeepAR initialized');
        setIsReady(true);
      } else if (data.type === 'screenshot') {
        const base64Data = data.data.replace(/^data:image\/\w+;base64,/, '');
        const tempUri = FileSystem.cacheDirectory + 'ar_snap_' + Date.now() + '.png';
        await FileSystem.writeAsStringAsync(tempUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
        
        showToast('Captured 📸');
        setIsCapturing(false); 
        
        const croppedUri = await cropTo4x5(tempUri);
        setCapturedUri(tempUri);
      } else if (data.type === 'error') {
        console.error('🛑 DeepAR Web error:', data.message);
      }
    } catch (e) {
      console.warn('Error parsing WebView message', e);
    }
  };

  const handleFilterSelect = useCallback(async (filter) => {
    if (!webViewRef.current || !isReady) {
      showToast('Camera still loading…');
      return;
    }
    if (activeFilterId === filter.id || loadingFilterId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setLoadingFilterId(filter.id);

    try {
      if (!filter.file_url || !filter.file_url.startsWith('http')) {
        throw new Error('file_url must be http(s)');
      }

      const localUri = FileSystem.cacheDirectory + 'filter_' + filter.id + '.deepar';
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      
      if (!fileInfo.exists) {
        await FileSystem.downloadAsync(filter.file_url, localUri);
      }

      const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
      webViewRef.current.injectJavaScript(`window.loadFilterFromBase64('${base64}'); true;`);
      
      setActiveFilterId(filter.id);
    } catch (e) {
      showToast('Couldn’t load that one 😕');
    } finally {
      setTimeout(() => setLoadingFilterId(null), 500);
    }
  }, [activeFilterId, loadingFilterId, isReady, showToast]);

  const clearFilter = useCallback(() => {
    if (!webViewRef.current || !isReady) return;
    Haptics.selectionAsync().catch(() => {});
    webViewRef.current.injectJavaScript(`window.switchEffect(''); true;`);
    setActiveFilterId(null);
  }, [isReady]);

  const flipCamera = useCallback(() => {
    if (!webViewRef.current || !isReady) return;
    Haptics.selectionAsync().catch(() => {});
    webViewRef.current.injectJavaScript(`window.flipCamera(); true;`);
  }, [isReady]);

  const capture = useCallback(() => {
    if (!isReady || isCapturing) return;
    setIsCapturing(true); 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    webViewRef.current.injectJavaScript(`window.takeSnapshot(); true;`);
  }, [isReady, isCapturing]);

  const handleDownloadToPhone = useCallback(async () => {
    if (!capturedUri) return;
    try {
      await MediaLibrary.saveToLibraryAsync(capturedUri);
      Alert.alert('Saved!', 'Photo saved to your gallery.');
    } catch (e) {
      Alert.alert('Error', 'Could not save photo.');
    }
  }, [capturedUri]);

  const handleShareToPulse = useCallback(() => {
    if (!capturedUri) return;
    if (typeof setPulseImageUri === 'function' && typeof setPulseCreateOpen === 'function') {
      setPulseImageUri(capturedUri);
      setPulseCreateOpen(true);
      navigation?.goBack?.(); 
    }
  }, [capturedUri, setPulseImageUri, setPulseCreateOpen, navigation]);

  const handleShareToFeed = useCallback(() => {
    if (!capturedUri) return;
    if (typeof setPostImageUri === 'function' && typeof setPostCreateOpen === 'function') {
      setPostImageUri(capturedUri);
      setPostCreateOpen(true);
      navigation?.goBack?.(); 
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
          style={[styles.tileWrap, { width: TILE_LABEL_W }]}
          onPress={() => handleFilterSelect(item)}
        >
          <View style={[
            styles.tileRing,
            { width: TILE_W, height: TILE_W, borderRadius: TILE_W / 2 },
            isActive && styles.tileRingActive,
          ]}>
            <LinearGradient colors={grad} style={[styles.tile, { borderRadius: (TILE_W - 6) / 2 }]}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.tileEmoji, { fontSize: TILE_W * 0.38 }]}>
                  {getEmoji(item.display_name)}
                </Text>
              )}
            </LinearGradient>
          </View>
          <Text numberOfLines={1} style={[styles.tileLabel, { width: TILE_LABEL_W }]}>
            {getLabel(item.display_name)}
          </Text>
        </TouchableOpacity>
      );
    },
    [activeFilterId, loadingFilterId, handleFilterSelect, TILE_LABEL_W, TILE_W]
  );

  if (!hasPermissions) {
    return (
      <View style={styles.permissionWrap}>
        <Ionicons name="camera-outline" size={48} color="#fff" />
        <Text style={styles.permissionText}>KliqTap needs camera and gallery access to use filters.</Text>
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
      <WebView
        ref={webViewRef}
        source={{ html: DEEPAR_HTML, baseUrl: 'https://kliqtap.com' }}
        style={styles.cameraView}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        originWhitelist={['*']}
        onMessage={handleMessage}
        scrollEnabled={false}
        bounces={false}
      />

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation?.goBack?.()}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topRight}>
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

      <View style={[styles.bottom, { paddingBottom: Math.max(28, insets.bottom + 12) }]}>
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
                style={[styles.tileWrap, { width: TILE_LABEL_W }]}
                activeOpacity={0.8}
                onPress={clearFilter}
              >
                <View style={[
                  styles.tileRing,
                  { width: TILE_W, height: TILE_W, borderRadius: TILE_W / 2 },
                  activeFilterId === null && styles.tileRingActive,
                ]}>
                  <View style={[styles.tile, styles.tileNone, { borderRadius: (TILE_W - 6) / 2 }]}>
                    <Ionicons name="ban-outline" size={TILE_W * 0.32} color="#fff" />
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
  cameraView: { flex: 1, backgroundColor: '#000', ...StyleSheet.absoluteFillObject },
  
  previewImage: { flex: 1, width: '100%', height: '100%' },
  previewCloseButton: { position: 'absolute', top: 50, left: 20, zIndex: 999, backgroundColor: 'rgba(0,0,0,0.6)', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  previewActionBar: { position: 'absolute', bottom: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingHorizontal: 10 },
  actionRoundButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, elevation: 6 },
  actionButtonText: { color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 4 },

  permissionWrap: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 32 },
  permissionText: { color: '#fff', textAlign: 'center', marginTop: 16, fontSize: 16, lineHeight: 22 },

  topBar: { position: 'absolute', top: 80, left: 16, right: 16, zIndex: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topRight: { flexDirection: 'row', gap: 10 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: BG_DIM, alignItems: 'center', justifyContent: 'center' },

  toast: { position: 'absolute', top: 110, alignSelf: 'center', zIndex: 30, backgroundColor: 'rgba(0,0,0,0.82)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10 },

  captureRow: { alignItems: 'center', marginBottom: 14 },
  captureOuter: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  captureInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff', borderWidth: 4, borderColor: 'rgba(0,0,0,0.15)' },

  pillRow: { paddingHorizontal: 14, gap: 8, marginBottom: 10 },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: BG_DIM },
  pillActive: { backgroundColor: '#fff' },
  pillText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  pillTextActive: { color: '#000' },

  trayRow: { paddingHorizontal: 12, gap: 10, alignItems: 'flex-start' },
  tileWrap: { width: 84, alignItems: 'center', marginHorizontal: 2 },
  tileRing: { width: 76, height: 76, borderRadius: 38, padding: 3, borderWidth: 2.5, borderColor: 'transparent' },
  tileRingActive: { borderColor: '#fff' },
  tile: { flex: 1, borderRadius: 34, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tileNone: { backgroundColor: 'rgba(255,255,255,0.15)' },
  tileEmoji: { fontSize: 32 },
  tileLabel: { color: '#fff', fontSize: 11, marginTop: 5, textAlign: 'center', width: 82 },
});