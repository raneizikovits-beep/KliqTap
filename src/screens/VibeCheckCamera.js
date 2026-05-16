// client/src/screens/VibeCheckCamera.js
// 🚀 VibeCheckCamera V3.4: Fixed Navigation Crash, Hardware Safe & Permissions Handled 🚀

import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, ActivityIndicator, Dimensions, 
  StyleSheet, SafeAreaView, Alert, TextInput, KeyboardAvoidingView, 
  Platform, ImageBackground, Animated, Keyboard, PanResponder, ScrollView 
} from 'react-native'; 
import { CameraView, useCameraPermissions } from 'expo-camera'; 
import { Video, ResizeMode } from 'expo-av'; 
import ViewShot from 'react-native-view-shot'; 
import { Ionicons } from '@expo/vector-icons'; 
import { LinearGradient } from 'expo-linear-gradient';

import { brand } from '../constants/data';
import { useAppStore } from '../store/useAppStore';
import * as PulseService from '../store/pulse.service'; 

const { width, height } = Dimensions.get('window');

const COLORS = ['#ffffff', '#000000', '#FFD700', '#FF4500', '#00FFFF', '#FF69B4', '#32CD32', '#8A2BE2'];
const FONTS = [Platform.OS === 'ios' ? 'System' : 'Roboto', 'serif', 'monospace', 'cursive'];

export default function VibeCheckCamera({ onClose }) {
  // --- STATE LOGIC ---
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState('camera'); 
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false); 
  const [mediaType, setMediaType] = useState('photo');   
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState(null); 
  const [destination, setDestination] = useState('both'); 
  const [isPublishing, setIsPublishing] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [textColor, setTextColor] = useState(COLORS[0]);
  const [fontIndex, setFontIndex] = useState(0);
  const [textSize, setTextSize] = useState(36);
  
  // ⭐️ Added state to manage camera mode safely
  const [cameraMode, setCameraMode] = useState('picture');
  
  // ⭐️ Replaced useIsFocused with a local mounting state for hardware safety
  const [isMounted, setIsMounted] = useState(true);

  const cameraRef = useRef(null);
  const viewShotRef = useRef(null); 
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panOffset = useRef({ x: 0, y: 0 }).current;

  // --- DRAG LOGIC ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: panOffset.x, y: panOffset.y });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gestureState) => { 
        panOffset.x += gestureState.dx;
        panOffset.y += gestureState.dy;
        pan.flattenOffset(); 
      }
    })
  ).current;

  const { createPost, createPulse, refreshAllData, userSettings } = useAppStore();
  const isDark = userSettings?.darkMode === true;

  // ⭐️ Unmount logic: Ensure hardware releases when component unmounts
  useEffect(() => {
    setIsMounted(true);
    return () => { 
      setIsMounted(false);
      setIsProcessing(false); 
      setIsRecording(false); 
    };
  }, []);

  const toggleCameraFacing = () => setFacing(current => (current === 'back' ? 'front' : 'back'));
  const toggleFlash = () => setFlash(current => (current === 'off' ? 'on' : 'off'));

  // --- CAMERA ACTIONS ---
  const handleTakePicture = async () => {
    if (!cameraRef.current || !isCameraReady || isProcessing || isRecording) return;
    setIsProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (cameraRef.current.pausePreview) await cameraRef.current.pausePreview();
      setCapturedMedia(photo.uri);
      setMediaType('photo');
      setStep('preview');
    } catch (error) {
      Alert.alert('Camera Error', 'The device is busy. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartRecording = async () => {
    if (!cameraRef.current || !isCameraReady || isRecording) return;
    
    setIsRecording(true);
    setCameraMode('video'); // Switch hardware to video mode

    // Slight delay allows Android hardware to safely re-initialize the video pipeline
    setTimeout(async () => {
      try {
        const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
        if (video) {
            setCapturedMedia(video.uri);
            setMediaType('video');
            setStep('preview');
        }
      } catch (error) {
        // Safely catch the "too short" error without panicking
        if (error.message && error.message.includes("stopped before any data could be produced")) {
            console.log("Recording cancelled: Shutter released too fast.");
        } else {
            console.error("Video record error:", error);
        }
        setIsRecording(false);
        setCameraMode('picture'); // Reset hardware pipeline
      }
    }, 400); 
  };

  const handleStopRecording = () => {
    if (isRecording && cameraRef.current) {
        cameraRef.current.stopRecording();
        setIsRecording(false);
        setCameraMode('picture'); // Reset back to picture mode for the next action
    }
  };

  // --- PUBLISH LOGIC ---
  const handlePublish = async () => {
    if (isPublishing || !capturedMedia) return;
    Keyboard.dismiss();
    setIsPublishing(true);
    try {
      let finalUri = capturedMedia;
      if (mediaType === 'photo' && overlayText.trim().length > 0 && viewShotRef.current) {
         finalUri = await viewShotRef.current.capture();
      }

      if (destination === 'both') {
          await PulseService.magicUpload(finalUri);
      } else if (destination === 'pulse') {
          await createPulse('', finalUri, 'Normal');
      } else if (destination === 'explore') {
          await createPost('', null, finalUri);
      }
      if (refreshAllData) await refreshAllData();
      
      // Release camera hardware before closing
      setIsMounted(false);
      onClose();
    } catch (error) {
      Alert.alert("Failed", "Upload error.");
      setIsPublishing(false);
    }
  };

  const handleClose = () => {
      // Release camera hardware before closing
      setIsMounted(false);
      onClose();
  };

  // --- PREVIEW CONTENT ---
  const renderPreviewContent = () => {
      const OverlayContent = (
          <>
            {!textMode && overlayText.length > 0 && (
                <Animated.View {...panResponder.panHandlers} style={[styles.draggableTextContainer, { transform: pan.getTranslateTransform() }]}>
                    <Text style={[styles.draggableText, { color: textColor, fontSize: textSize, fontFamily: FONTS[fontIndex] }]}>{overlayText}</Text>
                </Animated.View>
            )}
            {!textMode && (
                <SafeAreaView style={styles.previewTopTools}>
                    <TouchableOpacity onPress={() => setStep('camera')} style={styles.iconCircleGlass}><Ionicons name="arrow-back" size={26} color="#fff" /></TouchableOpacity>
                    <TouchableOpacity onPress={() => setTextMode(true)} style={styles.iconCircleGlass}><Text style={styles.aaText}>Aa</Text></TouchableOpacity>
                </SafeAreaView>
            )}
          </>
      );

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
  };

  // ⭐️ Safe Unmount Check
  if (!isMounted) {
      return <View style={styles.container} />;
  }

  // ⭐️ 1. טיפול בהרשאות מצלמה במצב טעינה ⭐️
  if (!permission) {
      return (
          <View style={[styles.container, { justifyContent: 'center' }]}>
              <ActivityIndicator size="large" color="#fff" />
          </View>
      );
  }

  // ⭐️ 2. טיפול במצב שבו אין הרשאה (בקשת גישה) ⭐️
  if (!permission.granted) {
      return (
          <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
              <Ionicons name="camera-outline" size={80} color="#fff" style={{ marginBottom: 20 }} />
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>Camera Access</Text>
              <Text style={{ color: '#aaa', textAlign: 'center', marginBottom: 30 }}>
                  We need your permission to show the camera and capture your vibe!
              </Text>
              <TouchableOpacity onPress={requestPermission} style={[styles.doneBtn, { paddingHorizontal: 30, paddingVertical: 15 }]}>
                  <Text style={styles.doneText}>Grant Permission</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose} style={{ marginTop: 20 }}>
                  <Text style={{ color: '#888', fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
          </View>
      );
  }

  // --- CAMERA VIEW STAGE ---
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
            responsiveOrientationWhenInactive={true}
        >
          <SafeAreaView style={styles.topBar}>
            <TouchableOpacity onPress={handleClose} style={styles.iconCircle}>
                <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <View style={styles.topBarRight}>
                <TouchableOpacity onPress={toggleFlash} style={styles.iconCircle}>
                    <Ionicons name={flash === 'on' ? "flash" : "flash-off"} size={24} color={flash === 'on' ? "#FFD700" : "#fff"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleCameraFacing} style={styles.iconCircle}>
                    <Ionicons name="camera-reverse" size={24} color="#fff" />
                </TouchableOpacity>
            </View>
          </SafeAreaView>

          <View style={styles.bottomBar}>
            <TouchableOpacity 
                style={[styles.shutterOuter, isRecording && styles.shutterOuterRecording]} 
                onPress={handleTakePicture}
                onLongPress={handleStartRecording}
                onPressOut={handleStopRecording}
                delayLongPress={300} 
                activeOpacity={0.8}
            >
              <View style={[styles.shutterInner, isRecording && styles.shutterInnerRecording]}>
                  {(isProcessing && !isRecording) ? <ActivityIndicator color={brand.blue} /> : <View style={styles.shutterPoint} />}
              </View>
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  // --- PREVIEW & EDIT STAGE ---
  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000' : '#000' }]}>
      <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.8 }} style={styles.previewBg}>
          {renderPreviewContent()}
      </ViewShot>

      {textMode && (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : null} style={styles.textEditOverlay}>
              <View style={styles.inputFlexCenter}>
                <TextInput 
                    style={[styles.textInputMain, { color: textColor, fontSize: textSize, fontFamily: FONTS[fontIndex] }]}
                    value={overlayText} onChangeText={setOverlayText} autoFocus multiline
                />
              </View>
              
              <View style={[styles.fixedToolbar, { backgroundColor: isDark ? '#0A0A0C' : '#111' }]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPickerInline}>
                      {COLORS.map((c, i) => (
                          <TouchableOpacity 
                            key={i} 
                            onPress={() => setTextColor(c)} 
                            style={[
                                styles.colorDot, 
                                { backgroundColor: c, borderColor: textColor === c ? brand.blue : 'rgba(255,255,255,0.6)' } 
                            ]} 
                          />
                      ))}
                  </ScrollView>
                  <View style={styles.toolActionRow}>
                      <TouchableOpacity onPress={() => setFontIndex(f => (f + 1) % FONTS.length)} style={styles.toolIcon}><Ionicons name="text" size={24} color="#fff" /></TouchableOpacity>
                      <View style={styles.sizeControlRow}>
                          <TouchableOpacity onPress={() => setTextSize(s => Math.max(16, s-4))}><Ionicons name="remove-circle-outline" size={30} color="#fff" /></TouchableOpacity>
                          <TouchableOpacity onPress={() => setTextSize(s => Math.min(80, s+4))}><Ionicons name="add-circle-outline" size={30} color="#fff" /></TouchableOpacity>
                      </View>
                      <TouchableOpacity onPress={() => setTextMode(false)} style={styles.doneBtn}><Text style={styles.doneText}>Done</Text></TouchableOpacity>
                  </View>
              </View>
          </KeyboardAvoidingView>
      )}

      {!textMode && (
        <LinearGradient colors={['transparent', isDark ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.8)', '#000']} style={styles.publisherSuite}>
            <View style={styles.destSelectorRow}>
                <TouchableOpacity style={[styles.destCard, destination === 'pulse' && styles.destCardActive]} onPress={() => setDestination('pulse')}><Text style={styles.destLabel}>Pulse</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.destCard, destination === 'explore' && styles.destCardActive]} onPress={() => setDestination('explore')}><Text style={styles.destLabel}>Feed</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.destCardMagic, destination === 'both' && styles.destCardMagicActive]} onPress={() => setDestination('both')}><Text style={styles.destLabel}>Magic</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.publishBtn, { backgroundColor: isDark ? '#fff' : '#fff' }]} onPress={handlePublish} disabled={isPublishing}>
                {isPublishing ? <ActivityIndicator color="#000" /> : <Text style={styles.publishBtnText}>Publish 🚀</Text>}
            </TouchableOpacity>
        </LinearGradient>
      )}
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', padding: 20, justifyContent: 'space-between', alignItems: 'flex-start' },
  topBarRight: { flexDirection: 'column', gap: 15 }, 
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  bottomBar: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 60 },
  shutterOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  shutterOuterRecording: { borderColor: '#FF3B30', transform: [{ scale: 1.1 }] },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  shutterInnerRecording: { backgroundColor: '#FF3B30', width: 36, height: 36, borderRadius: 8 }, 
  shutterPoint: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.1)' },
  previewBg: { flex: 1 },
  previewTopTools: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, position: 'absolute', top: 0, width: '100%', zIndex: 10 },
  iconCircleGlass: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  aaText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  draggableTextContainer: { position: 'absolute', top: height/3, alignSelf: 'center', padding: 10 },
  draggableText: { fontWeight: '900', textShadowColor: '#000', textShadowRadius: 10 },
  textEditOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100 },
  inputFlexCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  textInputMain: { textAlign: 'center', fontWeight: '900', width: '90%' },
  fixedToolbar: { paddingBottom: 40, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 10 },
  colorPickerInline: { paddingVertical: 15, paddingHorizontal: 20 },
  colorDot: { width: 38, height: 38, borderRadius: 19, marginRight: 15, borderWidth: 2 },
  toolActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25 },
  sizeControlRow: { flexDirection: 'row', gap: 20 },
  doneBtn: { backgroundColor: '#fff', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 18 },
  doneText: { color: '#000', fontWeight: 'bold' },
  publisherSuite: { position: 'absolute', bottom: 0, width: '100%', padding: 20, paddingTop: 50 },
  destSelectorRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  destCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', padding: 14, borderRadius: 14, alignItems: 'center', marginHorizontal: 5 },
  destCardActive: { backgroundColor: '#6200EE' },
  destCardMagic: { flex: 1.2, backgroundColor: 'rgba(138,43,226,0.3)', padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1.2, borderColor: '#8A2BE2' },
  destCardMagicActive: { backgroundColor: '#8A2BE2' },
  destLabel: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  publishBtn: { paddingVertical: 16, borderRadius: 30, alignItems: 'center' },
  publishBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});