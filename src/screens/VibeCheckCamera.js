// client/src/screens/VibeCheckCamera.js
// ✅ V4.0 PRODUCTION: Full architectural refactor — clean, modular, secure, scalable

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  SafeAreaView,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Animated,
  Keyboard,
  PanResponder,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import ViewShot from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { brand } from '../constants/data';
import { useAppStore } from '../store/useAppStore';
import * as PulseService from '../store/pulse.service';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const { width, height } = Dimensions.get('window');

/**
 * Available text overlay colours.
 * Defined outside the component so the array reference is stable.
 */
const COLORS = [
  '#ffffff', '#000000', '#FFD700',
  '#FF4500', '#00FFFF', '#FF69B4',
  '#32CD32', '#8A2BE2',
];

/**
 * Available font families for overlay text.
 * System font is resolved per-platform at module load time.
 */
const FONTS = [
  Platform.OS === 'ios' ? 'System' : 'Roboto',
  'serif',
  'monospace',
  'cursive',
];

/** Recording safety delay (ms) — allows Android hardware to init video pipeline */
const RECORD_INIT_DELAY_MS = 400;

/** Text size constraints */
const TEXT_SIZE_MIN = 16;
const TEXT_SIZE_MAX = 80;
const TEXT_SIZE_STEP = 4;

/**
 * Destination identifiers for the publish target selector.
 */
const DESTINATIONS = {
  PULSE:   'pulse',
  EXPLORE: 'explore',
  BOTH:    'both',
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/**
 * Full-screen loading spinner — shown while permission status is resolving.
 */
const LoadingScreen = () => (
  <View style={[styles.container, { justifyContent: 'center' }]}>
    <ActivityIndicator size="large" color="#fff" />
  </View>
);

/**
 * Permission request screen — shown when camera access has not been granted.
 */
const PermissionScreen = ({ onGrant, onCancel }) => (
  <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
    <Ionicons name="camera-outline" size={80} color="#fff" style={{ marginBottom: 20 }} />
    <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>
      Camera Access
    </Text>
    <Text style={{ color: '#aaa', textAlign: 'center', marginBottom: 30 }}>
      We need your permission to show the camera and capture your vibe!
    </Text>
    <TouchableOpacity
      onPress={onGrant}
      style={[styles.doneBtn, { paddingHorizontal: 30, paddingVertical: 15 }]}
      accessibilityLabel="Grant camera permission"
    >
      <Text style={styles.doneText}>Grant Permission</Text>
    </TouchableOpacity>
    <TouchableOpacity
      onPress={onCancel}
      style={{ marginTop: 20 }}
      accessibilityLabel="Cancel and close camera"
    >
      <Text style={{ color: '#888', fontWeight: 'bold' }}>Cancel</Text>
    </TouchableOpacity>
  </View>
);

/**
 * Shutter button — handles both tap (photo) and long-press (video).
 * Visual state changes during recording.
 */
const ShutterButton = ({ isProcessing, isRecording, onPress, onLongPress, onPressOut }) => (
  <TouchableOpacity
    style={[styles.shutterOuter, isRecording && styles.shutterOuterRecording]}
    onPress={onPress}
    onLongPress={onLongPress}
    onPressOut={onPressOut}
    delayLongPress={300}
    activeOpacity={0.8}
    accessibilityLabel={isRecording ? 'Stop recording' : 'Take photo or hold for video'}
    accessibilityRole="button"
  >
    <View style={[styles.shutterInner, isRecording && styles.shutterInnerRecording]}>
      {isProcessing && !isRecording
        ? <ActivityIndicator color={brand.blue} />
        : <View style={styles.shutterPoint} />
      }
    </View>
  </TouchableOpacity>
);

/**
 * Destination selector — three tap targets: Pulse / Feed / Magic (both).
 */
const DestinationSelector = ({ destination, onSelect }) => (
  <View style={styles.destSelectorRow}>
    <TouchableOpacity
      style={[styles.destCard, destination === DESTINATIONS.PULSE && styles.destCardActive]}
      onPress={() => onSelect(DESTINATIONS.PULSE)}
      accessibilityLabel="Publish to Pulse"
      accessibilityState={{ selected: destination === DESTINATIONS.PULSE }}
    >
      <Text style={styles.destLabel}>Pulse</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.destCard, destination === DESTINATIONS.EXPLORE && styles.destCardActive]}
      onPress={() => onSelect(DESTINATIONS.EXPLORE)}
      accessibilityLabel="Publish to Feed"
      accessibilityState={{ selected: destination === DESTINATIONS.EXPLORE }}
    >
      <Text style={styles.destLabel}>Feed</Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.destCardMagic, destination === DESTINATIONS.BOTH && styles.destCardMagicActive]}
      onPress={() => onSelect(DESTINATIONS.BOTH)}
      accessibilityLabel="Publish to both Pulse and Feed"
      accessibilityState={{ selected: destination === DESTINATIONS.BOTH }}
    >
      <Text style={styles.destLabel}>Magic</Text>
    </TouchableOpacity>
  </View>
);

/**
 * Text-overlay toolbar — colour picker, font toggle, size controls, and Done.
 */
const TextToolbar = ({
  textColor,
  setTextColor,
  fontIndex,
  setFontIndex,
  textSize,
  setTextSize,
  onDone,
  isDark,
}) => (
  <View style={[styles.fixedToolbar, { backgroundColor: isDark ? '#0A0A0C' : '#111' }]}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.colorPickerInline}
    >
      {COLORS.map((c) => (
        <TouchableOpacity
          key={c}
          onPress={() => setTextColor(c)}
          style={[
            styles.colorDot,
            { backgroundColor: c, borderColor: textColor === c ? brand.blue : 'rgba(255,255,255,0.6)' },
          ]}
          accessibilityLabel={`Select colour ${c}`}
        />
      ))}
    </ScrollView>

    <View style={styles.toolActionRow}>
      <TouchableOpacity
        onPress={() => setFontIndex(f => (f + 1) % FONTS.length)}
        style={styles.toolIcon}
        accessibilityLabel="Change font"
      >
        <Ionicons name="text" size={24} color="#fff" />
      </TouchableOpacity>

      <View style={styles.sizeControlRow}>
        <TouchableOpacity
          onPress={() => setTextSize(s => Math.max(TEXT_SIZE_MIN, s - TEXT_SIZE_STEP))}
          accessibilityLabel="Decrease text size"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="remove-circle-outline" size={30} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTextSize(s => Math.min(TEXT_SIZE_MAX, s + TEXT_SIZE_STEP))}
          accessibilityLabel="Increase text size"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="add-circle-outline" size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={onDone}
        style={styles.doneBtn}
        accessibilityLabel="Done editing text"
      >
        <Text style={styles.doneText}>Done</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

/**
 * VibeCheckCamera
 *
 * A full-screen camera experience that allows users to:
 *   - Take a photo (tap) or record a video (long-press)
 *   - Add a draggable text overlay to photos
 *   - Choose a publish destination: Pulse / Feed / Magic (both)
 *
 * Props:
 *   onClose — callback invoked after publishing or cancelling
 */
export default function VibeCheckCamera({ onClose }) {
  // ─── Permissions ────────────────────────────
  const [permission, requestPermission] = useCameraPermissions();

  // ─── Navigation / step ──────────────────────
  // FIX: 'step' is now the single source of truth for which stage the
  // camera is in. The old `isMounted` state was used both as a mount
  // guard AND as a navigation signal, causing the component to render
  // an empty <View> instead of closing when the user pressed Cancel.
  const [step, setStep] = useState('camera'); // 'camera' | 'preview'

  // ─── Camera hardware state ───────────────────
  const [facing, setFacing]           = useState('back');
  const [flash, setFlash]             = useState('off');
  const [cameraMode, setCameraMode]   = useState('picture'); // 'picture' | 'video'
  const [isCameraReady, setIsCameraReady] = useState(false);

  // ─── Capture / media state ───────────────────
  const [capturedMedia, setCapturedMedia] = useState(null);
  const [mediaType, setMediaType]         = useState('photo'); // 'photo' | 'video'

  // ─── Recording / processing flags ────────────
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording]   = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // ─── Text overlay state ──────────────────────
  const [textMode, setTextMode]     = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [textColor, setTextColor]   = useState(COLORS[0]);
  const [fontIndex, setFontIndex]   = useState(0);
  const [textSize, setTextSize]     = useState(36);

  // ─── Destination ─────────────────────────────
  const [destination, setDestination] = useState(DESTINATIONS.BOTH);

  // ─── Refs ─────────────────────────────────────
  const cameraRef    = useRef(null);
  const viewShotRef  = useRef(null);
  const recordingTimerRef = useRef(null); // FIX: track setTimeout so it can be cleared

  // Abort-safe ref — prevents setState after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Clear pending recording timer on unmount to prevent calling
      // cameraRef.recordAsync on an already-unmounted component
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    };
  }, []);

  // ─── Animated drag for text overlay ──────────
  const pan       = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panOffset = useRef({ x: 0, y: 0 }).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: panOffset.x, y: panOffset.y });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        panOffset.x += gestureState.dx;
        panOffset.y += gestureState.dy;
        pan.flattenOffset();
      },
    })
  ).current;

  // ─── Store ────────────────────────────────────
  const { createPost, createPulse, refreshAllData, userSettings } = useAppStore();
  const isDark = userSettings?.darkMode === true;

  // ─────────────────────────────────────────────
  // Camera controls
  // ─────────────────────────────────────────────

  const toggleCameraFacing = useCallback(
    () => setFacing(c => (c === 'back' ? 'front' : 'back')),
    []
  );

  const toggleFlash = useCallback(
    () => setFlash(c => (c === 'off' ? 'on' : 'off')),
    []
  );

  // ─────────────────────────────────────────────
  // Photo capture
  // ─────────────────────────────────────────────

  const handleTakePicture = useCallback(async () => {
    if (!cameraRef.current || !isCameraReady || isProcessing || isRecording) return;

    if (mountedRef.current) setIsProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });
      // Pause live preview to prevent flicker during the transition to preview step
      if (cameraRef.current?.pausePreview) {
        await cameraRef.current.pausePreview();
      }
      if (mountedRef.current) {
        setCapturedMedia(photo.uri);
        setMediaType('photo');
        setStep('preview');
      }
    } catch (error) {
      console.error('[VibeCheck] takePicture error:', error);
      Alert.alert('Camera Error', 'The device is busy. Please try again.');
    } finally {
      if (mountedRef.current) setIsProcessing(false);
    }
  }, [isCameraReady, isProcessing, isRecording]);

  // ─────────────────────────────────────────────
  // Video recording
  // ─────────────────────────────────────────────

  const handleStartRecording = useCallback(async () => {
    if (!cameraRef.current || !isCameraReady || isRecording) return;

    if (mountedRef.current) {
      setIsRecording(true);
      setCameraMode('video'); // Switch hardware pipeline to video
    }

    // Slight delay allows Android hardware to safely re-initialise
    recordingTimerRef.current = setTimeout(async () => {
      // Guard: component may have unmounted during the delay
      if (!mountedRef.current || !cameraRef.current) return;

      try {
        const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
        if (video && mountedRef.current) {
          setCapturedMedia(video.uri);
          setMediaType('video');
          setStep('preview');
        }
      } catch (error) {
        // "stopped before any data" is normal when shutter released too fast
        if (error?.message?.includes('stopped before any data could be produced')) {
          console.log('[VibeCheck] Recording cancelled: shutter released too fast.');
        } else {
          console.error('[VibeCheck] recordAsync error:', error);
        }
        if (mountedRef.current) {
          setIsRecording(false);
          setCameraMode('picture');
        }
      }
    }, RECORD_INIT_DELAY_MS);
  }, [isCameraReady, isRecording]);

  const handleStopRecording = useCallback(() => {
    if (isRecording && cameraRef.current) {
      cameraRef.current.stopRecording();
      if (mountedRef.current) {
        setIsRecording(false);
        setCameraMode('picture'); // Reset hardware pipeline
      }
    }
  }, [isRecording]);

  // ─────────────────────────────────────────────
  // Publish
  // ─────────────────────────────────────────────

  /**
   * handlePublish
   *
   * Flow:
   *   1. If photo + overlay text exists → capture the composite via ViewShot
   *   2. Upload to the selected destination(s)
   *   3. Refresh global data
   *   4. Close the camera
   *
   * FIX: setIsPublishing(false) was only called inside the catch block in V3.4.
   * If refreshAllData threw, the button would remain permanently disabled.
   * Now it is always reset in the finally block.
   */
  const handlePublish = useCallback(async () => {
    if (isPublishing || !capturedMedia) return;

    Keyboard.dismiss();
    if (mountedRef.current) setIsPublishing(true);

    try {
      let finalUri = capturedMedia;

      // Composite photo + text overlay into a single image via ViewShot
      if (
        mediaType === 'photo' &&
        overlayText.trim().length > 0 &&
        viewShotRef.current
      ) {
        finalUri = await viewShotRef.current.capture();
      }

      // Route to the correct upload path
      if (destination === DESTINATIONS.BOTH) {
        await PulseService.magicUpload(finalUri);
      } else if (destination === DESTINATIONS.PULSE) {
        await createPulse('', finalUri, 'Normal');
      } else if (destination === DESTINATIONS.EXPLORE) {
        await createPost('', null, finalUri);
      }

      if (refreshAllData) await refreshAllData();

      // Close — no need to set isMounted; just call the parent callback
      onClose();
    } catch (error) {
      console.error('[VibeCheck] Publish error:', error);
      Alert.alert('Failed', 'Upload error. Please try again.');
    } finally {
      // FIX: always reset the flag so the button is not permanently stuck
      if (mountedRef.current) setIsPublishing(false);
    }
  }, [
    isPublishing, capturedMedia, mediaType, overlayText,
    destination, createPulse, createPost, refreshAllData, onClose,
  ]);

  // ─────────────────────────────────────────────
  // Close / back
  // ─────────────────────────────────────────────

  // FIX: removed setIsMounted(false) — isMounted state has been replaced
  // by mountedRef. Calling setIsMounted(false) before onClose() was causing
  // the component to render an empty <View> for one frame, visible as a flash.
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // ─────────────────────────────────────────────
  // Stable toolbar callbacks (prevent TextToolbar re-renders)
  // ─────────────────────────────────────────────

  const handleDoneTextMode = useCallback(() => setTextMode(false), []);
  const handleEnterTextMode = useCallback(() => setTextMode(true), []);
  const handleBackToCamera = useCallback(() => setStep('camera'), []);

  // ─────────────────────────────────────────────
  // Preview content (photo or video + overlay)
  // ─────────────────────────────────────────────

  /**
   * Draggable text overlay + back/text-add controls.
   * Defined via useMemo so it is not re-created on every render;
   * only updates when the text-related state or textMode changes.
   */
  const OverlayContent = useMemo(() => (
    <>
      {!textMode && overlayText.length > 0 && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.draggableTextContainer,
            { transform: pan.getTranslateTransform() },
          ]}
        >
          <Text
            style={[
              styles.draggableText,
              { color: textColor, fontSize: textSize, fontFamily: FONTS[fontIndex] },
            ]}
          >
            {overlayText}
          </Text>
        </Animated.View>
      )}

      {!textMode && (
        <SafeAreaView style={styles.previewTopTools}>
          <TouchableOpacity
            onPress={handleBackToCamera}
            style={styles.iconCircleGlass}
            accessibilityLabel="Back to camera"
          >
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleEnterTextMode}
            style={styles.iconCircleGlass}
            accessibilityLabel="Add text overlay"
          >
            <Text style={styles.aaText}>Aa</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </>
  ), [
    textMode, overlayText, textColor, textSize, fontIndex,
    pan, panResponder, handleBackToCamera, handleEnterTextMode,
  ]);

  const renderPreviewContent = useCallback(() => {
    if (mediaType === 'video') {
      return (
        <View style={styles.previewBg}>
          <Video
            source={{ uri: capturedMedia }}
            style={StyleSheet.absoluteFillObject}
            resizeMode={ResizeMode.COVER}
            shouldPlay
            isLooping
          />
          {OverlayContent}
        </View>
      );
    }

    return (
      <ImageBackground source={{ uri: capturedMedia }} style={styles.previewBg}>
        {OverlayContent}
      </ImageBackground>
    );
  }, [mediaType, capturedMedia, OverlayContent]);

  // ─────────────────────────────────────────────
  // Permission guards (rendered before hardware is accessed)
  // ─────────────────────────────────────────────

  if (!permission) {
    return <LoadingScreen />;
  }

  if (!permission.granted) {
    return (
      <PermissionScreen
        onGrant={requestPermission}
        onCancel={handleClose}
      />
    );
  }

  // ─────────────────────────────────────────────
  // Camera stage
  // ─────────────────────────────────────────────

  if (step === 'camera') {
    return (
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mode={cameraMode}
          enableTorch={flash === 'on'}
          onCameraReady={() => setIsCameraReady(true)}
          responsiveOrientationWhenInactive
        >
          {/* Top bar: close + flash + flip */}
          <SafeAreaView style={styles.topBar}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.iconCircle}
              accessibilityLabel="Close camera"
            >
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <View style={styles.topBarRight}>
              <TouchableOpacity
                onPress={toggleFlash}
                style={styles.iconCircle}
                accessibilityLabel={flash === 'on' ? 'Flash on' : 'Flash off'}
              >
                <Ionicons
                  name={flash === 'on' ? 'flash' : 'flash-off'}
                  size={24}
                  color={flash === 'on' ? '#FFD700' : '#fff'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={toggleCameraFacing}
                style={styles.iconCircle}
                accessibilityLabel="Flip camera"
              >
                <Ionicons name="camera-reverse" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Shutter */}
          <View style={styles.bottomBar}>
            <ShutterButton
              isProcessing={isProcessing}
              isRecording={isRecording}
              onPress={handleTakePicture}
              onLongPress={handleStartRecording}
              onPressOut={handleStopRecording}
            />
          </View>
        </CameraView>
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // Preview & edit stage
  // ─────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Captured media + draggable text overlay, captured by ViewShot */}
      <ViewShot
        ref={viewShotRef}
        options={{ format: 'jpg', quality: 0.8 }}
        style={styles.previewBg}
      >
        {renderPreviewContent()}
      </ViewShot>

      {/* Text-edit mode overlay */}
      {textMode && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : null}
          style={styles.textEditOverlay}
        >
          <View style={styles.inputFlexCenter}>
            <TextInput
              style={[
                styles.textInputMain,
                { color: textColor, fontSize: textSize, fontFamily: FONTS[fontIndex] },
              ]}
              value={overlayText}
              onChangeText={setOverlayText}
              autoFocus
              multiline
              accessibilityLabel="Text overlay input"
            />
          </View>

          <TextToolbar
            textColor={textColor}
            setTextColor={setTextColor}
            fontIndex={fontIndex}
            setFontIndex={setFontIndex}
            textSize={textSize}
            setTextSize={setTextSize}
            onDone={handleDoneTextMode}
            isDark={isDark}
          />
        </KeyboardAvoidingView>
      )}

      {/* Publisher suite (hidden while in text-edit mode) */}
      {!textMode && (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)', '#000']}
          style={styles.publisherSuite}
        >
          <DestinationSelector destination={destination} onSelect={setDestination} />

          <TouchableOpacity
            style={styles.publishBtn}
            onPress={handlePublish}
            disabled={isPublishing}
            accessibilityLabel="Publish vibe"
          >
            {isPublishing
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.publishBtnText}>Publish 🚀</Text>
            }
          </TouchableOpacity>
        </LinearGradient>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Container / camera ────────────────────
  container: { flex: 1, backgroundColor: '#000' },
  camera:    { flex: 1, justifyContent: 'space-between' },

  // ── Top bar ───────────────────────────────
  topBar: {
    flexDirection: 'row',
    padding: 20,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topBarRight:  { flexDirection: 'column', gap: 15 },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },

  // ── Bottom bar / shutter ──────────────────
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  shutterOuter: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  shutterOuterRecording: { borderColor: '#FF3B30', transform: [{ scale: 1.1 }] },
  shutterInner: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  shutterInnerRecording: { backgroundColor: '#FF3B30', width: 36, height: 36, borderRadius: 8 },
  shutterPoint: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.1)' },

  // ── Preview ───────────────────────────────
  previewBg: { flex: 1 },
  previewTopTools: {
    flexDirection: 'row', justifyContent: 'space-between',
    padding: 20, position: 'absolute', top: 0, width: '100%', zIndex: 10,
  },
  iconCircleGlass: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  aaText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },

  // ── Draggable text ─────────────────────────
  draggableTextContainer: {
    position: 'absolute',
    top: height / 3,
    alignSelf: 'center',
    padding: 10,
  },
  draggableText: {
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowRadius: 10,
  },

  // ── Text-edit overlay ─────────────────────
  textEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 100,
  },
  inputFlexCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  textInputMain: {
    textAlign: 'center',
    fontWeight: '900',
    width: '90%',
  },

  // ── Text toolbar ──────────────────────────
  fixedToolbar: { paddingBottom: 40, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10 },
  colorPickerInline: { paddingVertical: 15, paddingHorizontal: 20 },
  colorDot: { width: 38, height: 38, borderRadius: 19, marginRight: 15, borderWidth: 2 },
  toolActionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 25,
  },
  toolIcon: {},
  sizeControlRow: { flexDirection: 'row', gap: 20 },
  doneBtn: { backgroundColor: '#fff', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 18 },
  doneText: { color: '#000', fontWeight: 'bold' },

  // ── Publisher suite ───────────────────────
  publisherSuite: {
    position: 'absolute', bottom: 0, width: '100%',
    padding: 20, paddingTop: 50,
  },
  destSelectorRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  destCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 14, borderRadius: 14, alignItems: 'center', marginHorizontal: 5,
  },
  destCardActive: { backgroundColor: '#6200EE' },
  destCardMagic: {
    flex: 1.2, backgroundColor: 'rgba(138,43,226,0.3)',
    padding: 14, borderRadius: 14, alignItems: 'center',
    borderWidth: 1.2, borderColor: '#8A2BE2',
  },
  destCardMagicActive: { backgroundColor: '#8A2BE2' },
  destLabel: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  publishBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center', backgroundColor: '#fff' },
  publishBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});