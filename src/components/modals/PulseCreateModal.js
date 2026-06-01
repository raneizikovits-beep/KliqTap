// client/src/components/modals/PulseCreateModal.js
// ⭐️ V6.0 KLIQMIND PRODUCTION: Web Publishing Fix + Silent-Fail Guards
//
// CRITICAL FIXES IN THIS VERSION:
// [FIX-1] Web (Chrome) couldn't publish text-only canvas pulses/posts:
//         - ViewShot doesn't run on web → finalUri stayed null
//         - 'magic' & 'feed' branches required finalUri → silently did nothing
//         - 'pulse' branch sent text only, which worked, but Magic/Feed didn't.
//         New behavior: on web, text is sent directly without media; if user
//         picked Magic/Feed without uploading media on web, they get a clear
//         warning instead of a fake success toast.
//
// [FIX-2] Defensive guards: if store actions are missing (createPulseAction,
//         createPost, PulseService.magicUpload), user gets a real error instead
//         of a fake success toast.
//
// [FIX-3] setIsInternalPosting(false) is now in finally{} so it always releases.
//         Before, an error in mid-flight could leave the button frozen.
//
// All existing functionality and styles are preserved 100%.

import React, { useState, useEffect, useRef } from 'react';
import { 
    Modal, View, Text, TouchableOpacity, 
    TextInput, Image, ActivityIndicator, 
    KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Alert, ScrollView,
    Animated, PanResponder, Keyboard, Dimensions
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; 
import Toast from 'react-native-toast-message'; 
import { Video } from 'expo-av'; 
import { brand } from '../../constants/data';
import * as PulseService from '../../store/pulse.service';
import { useAppStore } from '../../store/useAppStore'; 

const { width, height } = Dimensions.get('window');

const COLORS = [
    '#ffffff', '#000000', '#FFD700', '#FF4500', '#00FFFF', 
    '#FF69B4', '#32CD32', '#8A2BE2', '#1E90FF', '#FF0000'
];

const TEXT_ONLY_BACKGROUNDS = [
    '#18181b', '#FF3B30', '#FF9500', '#32CD32', '#007AFF', 
    '#5856D6', '#FF2D55', '#008080', '#8B4513', '#2E8B57', 
];

const FONTS = [
    Platform.OS === 'ios' ? 'System' : 'Roboto',
    'serif', 'monospace', 'sans-serif', 'cursive'
];

const VIBE_OPTIONS = [
    { icon: '✨', label: 'Chill', vibe: 'Neutral' },
    { icon: '🔥', label: 'Hype', vibe: 'Party' },
    { icon: '💪', label: 'Flex', vibe: 'Focused' },
    { icon: '🙏', label: 'Grateful', vibe: 'Happy' },
    { icon: '🍔', label: 'Foodie', vibe: 'Happy' },
    { icon: '😴', label: 'Tired', vibe: 'Tired' },
    { icon: '💔', label: 'Mood', vibe: 'Broken' },
    { icon: '✈️', label: 'Travel', vibe: 'Happy' },
];

const TREND_TAGS = [
    "#MondayMotivation", "#LateNightVibes", "#GymRat", 
    "#FoodPorn", "#SunsetLover", "#CodingLife", 
    "#WeekendMood", "#FreshFit", "#MusicHeals"
];

export function PulseCreateModal({ visible, onClose, imageUri, isPosting, user }) {
  
  const [text, setText] = useState('');
  const [localImageUri, setLocalImageUri] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState(VIBE_OPTIONS[0]);
  const [isEditingText, setIsEditingText] = useState(false); 
  const [isDragging, setIsDragging] = useState(false);
  const [activeTrend, setActiveTrend] = useState(null);
  const [showTrends, setShowTrends] = useState(false);
  const [hasMusic, setHasMusic] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);

  const [postType, setPostType] = useState('pulse'); 
  const [isInternalPosting, setIsInternalPosting] = useState(false);
  
  const refreshAllData = useAppStore(state => state.refreshAllData);
  const createPost = useAppStore(state => state.createPost); 
  const createPulseAction = useAppStore(state => state.createPulse); 

  const [textColor, setTextColor] = useState(COLORS[0]);
  const [textSize, setTextSize] = useState(36);
  const [textBgStyle, setTextBgStyle] = useState(0); 
  const [fontIndex, setFontIndex] = useState(0);
  const [canvasBgIndex, setCanvasBgIndex] = useState(0); 
  
  const viewShotRef = useRef(null); 
  const pan = useRef(new Animated.ValueXY()).current; 
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
        pan.extractOffset();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (evt, gestureState) => {
        setIsDragging(false);
        pan.flattenOffset();
        if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
            setIsEditingText(true);
        }
      }
    })
  ).current;

  useEffect(() => {
      if (visible) {
          setLocalImageUri(imageUri || null);
          setText('');
          setActiveTrend(null);
          setShowTrends(false);
          setHasMusic(false);
          setHasLocation(false);
          setTextColor(COLORS[0]);
          setTextSize(36);
          setCanvasBgIndex(0); 
          
          const isInitialVideo = imageUri && (imageUri.endsWith('.mp4') || imageUri.endsWith('.mov'));
          setIsVideo(!!isInitialVideo);
          
          setPostType('pulse'); 
          pan.setValue({ x: 0, y: 0 });
      }
  }, [visible, imageUri, pan]);

  // ════════════════════════════════════════════════════════════════
  // [FIX-1, FIX-2, FIX-3] Web Publishing + Silent-Fail Guards
  // ════════════════════════════════════════════════════════════════
const handleSubmit = async () => {
    if (isPosting || isInternalPosting) return;
    Keyboard.dismiss();

    let textToSend = text.trim();

    if (!textToSend && !localImageUri) {
        Alert.alert("Empty Vibe", "Capture a moment or write something!");
        return;
    }

    setIsInternalPosting(true);

    try {
        let finalUri = localImageUri;
        
        if (Platform.OS !== 'web' && !isVideo) {
             if (textToSend.length > 0 && viewShotRef.current) {
                 try {
                    finalUri = await viewShotRef.current.capture();
                    // ⭐️ תיקון: הטקסט נצרב בתמונה, נשלח רווח ריק כדי למנוע כפילות למטה
                    textToSend = ' '; 
                 } catch (capErr) {
                    console.warn("[PulseCreateModal] ViewShot capture failed:", capErr?.message);
                 }
             }
        } else if (Platform.OS === 'web' && !finalUri && !isVideo) {
            // ⭐️ תיקון לדפדפן: יצירת תמונת רקע וירטואלית כדי שהשרת יקבל את הפוסט
            try {
                if (typeof document !== 'undefined') {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1080;
                    canvas.height = 1920;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = TEXT_ONLY_BACKGROUNDS[canvasBgIndex] || '#18181b';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    finalUri = canvas.toDataURL('image/jpeg', 0.8);
                }
            } catch (err) {
                console.warn("[PulseCreateModal] Failed to generate web canvas", err);
            }
        }
        
        if (Platform.OS === 'web' && !finalUri && (postType === 'magic' || postType === 'feed')) {
            Alert.alert(
                postType === 'magic' ? "Magic needs media" : "Feed posts need media",
                "On web, please upload an image or video from Gallery/Camera for this post type."
            );
            return; 
        }
        
        if (postType === 'magic') {
            if (!PulseService?.magicUpload) {
                Alert.alert("Magic unavailable", "The Magic upload service isn't ready.");
                return;
            }
            await PulseService.magicUpload(finalUri, textToSend, selectedVibe.vibe);
            if (refreshAllData) await refreshAllData();
            onClose();
            Toast.show({ type: 'success', text1: '✨ +4 PTS!', text2: 'Magic Pulse is live everywhere!' });
            return;
        }
        
        if (postType === 'feed') {
            if (!createPost) {
                Alert.alert("Feed unavailable", "Post creation isn't ready.");
                return;
            }
            await createPost(textToSend, null, finalUri);
            if (refreshAllData) await refreshAllData();
            onClose();
            Toast.show({ type: 'success', text1: '📝 +3 PTS!', text2: 'Your post is live on the Feed!' });
            return;
        }
        
        if (!createPulseAction) {
            Alert.alert("Pulse unavailable", "Pulse creation isn't ready.");
            return;
        }
        
        await createPulseAction(textToSend, finalUri, selectedVibe.vibe);
        onClose();
        Toast.show({ type: 'success', text1: '⚡️ +4 PTS!', text2: 'Pulse added to your story!' });
        
    } catch (e) {
        Alert.alert("Upload Error", "Failed to process the upload. Please try again.");
        console.error("[PulseCreateModal] Submit Error:", e);
    } finally {
        setIsInternalPosting(false);
    }
  };
  
  const handleCamera = async () => {
      try {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
              Alert.alert("Permission Denied", "Camera access is required.");
              return;
          }
          let result = await ImagePicker.launchCameraAsync({ 
              mediaTypes: ImagePicker.MediaTypeOptions.All, 
              allowsEditing: false, 
              quality: 0.8,
              videoMaxDuration: 60
          });
          if (!result.canceled && result.assets?.length > 0) {
              setLocalImageUri(result.assets[0].uri);
              setIsVideo(result.assets[0].type === 'video' || result.assets[0].uri.endsWith('.mp4'));
              setPostType('pulse'); 
          }
      } catch (error) { 
          console.error("[PulseCreateModal] Camera Error:", error); 
      }
  };

  const handlePickImage = async () => {
       try {
           let result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.All, 
              allowsEditing: false, 
              quality: 0.8,
           });
           if (!result.canceled && result.assets?.length > 0) {
               setLocalImageUri(result.assets[0].uri);
               setIsVideo(result.assets[0].type === 'video' || result.assets[0].uri.endsWith('.mp4'));
               setPostType('pulse'); 
           }
       } catch (error) { 
           console.error("[PulseCreateModal] Gallery Error:", error); 
       }
  };

  const getBgColor = () => {
    if (textBgStyle === 1) return 'rgba(0,0,0,0.6)';
    if (textBgStyle === 2) return 'rgba(255,255,255,0.8)';
    return 'transparent';
  };

  const cycleCanvasBackground = () => {
      setCanvasBgIndex((prev) => (prev + 1) % TEXT_ONLY_BACKGROUNDS.length);
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.darkContainer}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flexOne} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
              
              {!isEditingText && (
                  <View style={styles.header}>
                      <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                          <Ionicons name="close" size={28} color="#fff" />
                      </TouchableOpacity>
                      <View style={styles.vibeBadge}>
                          <Text style={styles.vibeBadgeText}>{selectedVibe.icon} {selectedVibe.label} Mode</Text>
                      </View>
                      <TouchableOpacity 
                          onPress={handleSubmit} 
                          disabled={isPosting || isInternalPosting} 
                          style={[
                              styles.postBtn, 
                              (!text && !localImageUri) && styles.postBtnDisabled, 
                              postType === 'magic' && { backgroundColor: '#8A2BE2' },
                              postType === 'feed' && { backgroundColor: '#2196F3' }
                          ]}
                      >
                          {isPosting || isInternalPosting ? (
                              <ActivityIndicator color="#fff" size="small" />
                          ) : (
                              <Text style={styles.postBtnText}>
                                  {postType === 'magic' ? "Magic ✨" : postType === 'feed' ? "Drop it 📝" : "Drop it ⚡"}
                              </Text>
                          )}
                      </TouchableOpacity>
                  </View>
              )}

              {!isEditingText && (
                  <View style={styles.postTypeContainer}>
                      <TouchableOpacity onPress={() => setPostType('pulse')} style={[styles.typeBtn, postType === 'pulse' && styles.typeBtnActivePulse]}>
                          <Ionicons name="time" size={14} color={postType === 'pulse' ? '#fff' : '#888'} />
                          <Text style={[styles.typeBtnText, postType === 'pulse' && styles.typeBtnTextActive]}>Pulse</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity onPress={() => setPostType('feed')} style={[styles.typeBtn, postType === 'feed' && styles.typeBtnActiveFeed]}>
                          <Ionicons name="grid" size={14} color={postType === 'feed' ? '#fff' : '#888'} />
                          <Text style={[styles.typeBtnText, postType === 'feed' && styles.typeBtnTextActive]}>Feed</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity onPress={() => setPostType('magic')} style={[styles.typeBtn, postType === 'magic' && styles.typeBtnActiveMagic]}>
                          <Ionicons name="sparkles" size={14} color={postType === 'magic' ? '#fff' : '#888'} />
                          <Text style={[styles.typeBtnText, postType === 'magic' && styles.typeBtnTextActive]}>Magic</Text>
                      </TouchableOpacity>
                  </View>
              )}

              <TouchableOpacity activeOpacity={1} style={styles.canvasArea} onPress={() => setIsEditingText(false)}>
                  <ViewShot 
                      ref={viewShotRef} 
                      options={{ format: "png", quality: 1.0 }} 
                      style={[styles.viewShotContainer, !localImageUri && { backgroundColor: TEXT_ONLY_BACKGROUNDS[canvasBgIndex] }]}
                  >
                      {localImageUri ? (
                          isVideo ? (
                             <Video 
                                 source={{ uri: localImageUri }}
                                 style={styles.fullMedia}
                                 resizeMode="cover"
                                 isLooping
                                 shouldPlay
                                 isMuted
                             />
                          ) : (
                             <Image source={{ uri: localImageUri }} style={styles.fullMedia} resizeMode="contain" />
                          )
                      ) : (
                         text.length === 0 && !isEditingText && (
                             <View style={styles.emptyMedia}>
                                <Text style={styles.emptyText}>Add Media or Tap 'Aa'</Text>
                             </View>
                         )
                      )}

                     {!isVideo && isEditingText && <View style={[styles.editingOverlay, { zIndex: 10 }]} />}
                      {!isVideo && (isEditingText || text.length > 0) && (
                          <Animated.View 
                              {...(isEditingText ? { onStartShouldSetResponder: () => true } : panResponder.panHandlers)} 
                              style={[
                                  styles.draggable, 
                                  { transform: pan.getTranslateTransform() },
                                  Platform.OS === 'web' && { touchAction: 'none' },
                                  isEditingText && { zIndex: 100, top: '40%' }
                              ]}
                          >
                              {isEditingText ? (
                                  <TextInput
                                      style={[styles.overlayInput, { color: textColor, fontSize: textSize, backgroundColor: getBgColor(), fontFamily: FONTS[fontIndex], minWidth: 150 }]}
                                      placeholder="Type your vibe..."
                                      placeholderTextColor="rgba(255,255,255,0.6)"
                                      multiline autoFocus
                                      value={text}
                                      onChangeText={setText}
                                  />
                              ) : (
                                  <Text style={[styles.overlayInput, { color: textColor, fontSize: textSize, backgroundColor: getBgColor(), fontFamily: FONTS[fontIndex] }]}>
                                      {text}
                                  </Text>
                              )}
                          </Animated.View>
                      )}
                      
                      {isVideo && text.length > 0 && !isEditingText && (
                         <View style={styles.videoTextOverlay}>
                             <Text style={[styles.overlayInput, { color: textColor, fontSize: Math.min(24, textSize), backgroundColor: getBgColor(), fontFamily: FONTS[fontIndex] }]}>
                                 {text}
                             </Text>
                         </View>
                      )}
                      {isVideo && isEditingText && (
                         <View 
                             style={[styles.editingOverlay, { zIndex: 100 }]}
                             onStartShouldSetResponder={() => true}
                         >
                             <TextInput
                                 style={[styles.overlayInput, { color: textColor, fontSize: Math.min(24, textSize), backgroundColor: getBgColor(), fontFamily: FONTS[fontIndex], minWidth: 150 }]}
                                 placeholder="Type on video..."
                                 placeholderTextColor="rgba(255,255,255,0.6)"
                                 multiline autoFocus
                                 value={text}
                                 onChangeText={setText}
                             />
                         </View>
                      )} 
                      
                      {isVideo && isEditingText && (
                         <View style={styles.editingOverlay}>
                             <TextInput
                                 style={[styles.overlayInput, { color: textColor, fontSize: Math.min(24, textSize), backgroundColor: getBgColor(), fontFamily: FONTS[fontIndex], minWidth: 150 }]}
                                 placeholder="Type on video..."
                                 placeholderTextColor="rgba(255,255,255,0.6)"
                                 multiline autoFocus
                                 value={text}
                                 onChangeText={setText}
                             />
                         </View>
                      )}
                      
                  </ViewShot>
                  
                  {!isEditingText && (
                      <View style={styles.tagWrapper}>
                          {activeTrend && (
                              <View style={[styles.tagPill, { backgroundColor: brand.orange }]}>
                                  <Text style={styles.tagText}>{activeTrend}</Text>
                                  <TouchableOpacity onPress={() => setActiveTrend(null)}>
                                      <Ionicons name="close" size={14} color="#fff" style={styles.tagCloseIcon}/>
                                  </TouchableOpacity>
                              </View>
                          )}
                          {hasMusic && (
                              <View style={[styles.tagPill, { backgroundColor: '#E91E63' }]}>
                                  <Ionicons name="musical-notes" size={12} color="#fff" style={styles.tagPreIcon}/>
                                  <Text style={styles.tagText}>Music On</Text>
                                  <TouchableOpacity onPress={() => setHasMusic(false)}>
                                      <Ionicons name="close" size={14} color="#fff" style={styles.tagCloseIcon}/>
                                  </TouchableOpacity>
                              </View>
                          )}
                          {hasLocation && (
                              <View style={[styles.tagPill, { backgroundColor: '#2196F3' }]}>
                                  <Ionicons name="location" size={12} color="#fff" style={styles.tagPreIcon}/>
                                  <Text style={styles.tagText}>Checking In</Text>
                                  <TouchableOpacity onPress={() => setHasLocation(false)}>
                                      <Ionicons name="close" size={14} color="#fff" style={styles.tagCloseIcon}/>
                                  </TouchableOpacity>
                              </View>
                          )}
                      </View>
                  )}
              </TouchableOpacity>

              <View style={styles.footer}>
                  {isEditingText ? (
                      <View style={styles.textTools}>
                          {!localImageUri && (
                              <TouchableOpacity onPress={cycleCanvasBackground} style={styles.toolIcon}>
                                  <Ionicons name="color-fill" size={24} color="#fff" />
                                  <Text style={styles.toolLabel}>Bg Color</Text>
                              </TouchableOpacity>
                          )}
                          <TouchableOpacity onPress={() => setFontIndex((prev) => (prev + 1) % FONTS.length)} style={styles.toolIcon}>
                              <Ionicons name="text-outline" size={24} color="#fff" />
                              <Text style={styles.toolLabel}>Font</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setTextBgStyle((prev) => (prev + 1) % 3)} style={styles.toolIcon}>
                              <Ionicons name="color-wand" size={24} color="#fff" />
                              <Text style={styles.toolLabel}>Style</Text>
                          </TouchableOpacity>
                          <View style={styles.sizeRow}>
                              <TouchableOpacity onPress={() => setTextSize(s => Math.max(12, s-4))}><Ionicons name="remove-circle" size={28} color="#fff" /></TouchableOpacity>
                              <Text style={styles.sizeVal}>{textSize}</Text>
                              <TouchableOpacity onPress={() => setTextSize(s => Math.min(100, s+4))}><Ionicons name="add-circle" size={28} color="#fff" /></TouchableOpacity>
                          </View>
                          
                          <TouchableOpacity style={styles.inlineDoneBtn} onPress={() => setIsEditingText(false)}>
                              <Text style={styles.inlineDoneBtnText}>Done</Text>
                          </TouchableOpacity>
                      </View>
                  ) : (
                      <View style={styles.mainTools}>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vibeScroll}>
                              {VIBE_OPTIONS.map((v, i) => (
                                  <TouchableOpacity key={i} style={[styles.vibeChip, selectedVibe.vibe === v.vibe && styles.vibeChipActive]} onPress={() => setSelectedVibe(v)}>
                                      <Text style={styles.vibeIcon}>{v.icon}</Text>
                                      <Text style={[styles.vibeLabel, selectedVibe.vibe === v.vibe && { color: brand.blue }]}>{v.label}</Text>
                                  </TouchableOpacity>
                              ))}
                          </ScrollView>
                          
                          {showTrends && (
                             <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendScroll} contentContainerStyle={styles.vibeScrollContent}>
                                {TREND_TAGS.map((tag, i) => (
                                    <TouchableOpacity key={i} style={styles.trendChip} onPress={() => { setActiveTrend(tag); setShowTrends(false); }}>
                                        <Text style={styles.trendChipText}>{tag}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                          )}

                          <View style={styles.actionRow}>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorPicker}>
                                  {COLORS.map((c, i) => (
                                      <TouchableOpacity 
                                        key={i} 
                                        onPress={() => { setTextColor(c); if(text === '') setIsEditingText(true); }}
                                        style={[styles.colorDot, { backgroundColor: c, borderColor: textColor === c ? '#fff' : '#444' }]} 
                                      />
                                  ))}
                              </ScrollView>
                          </View>

                          <View style={styles.dock}>
                              <TouchableOpacity style={styles.dockItem} onPress={() => setIsEditingText(true)}>
                                  <View style={[styles.dockIconCircle, styles.dockBorder, { backgroundColor: '#333' }]}><Text style={{color: '#fff', fontWeight: 'bold', fontSize: 18}}>Aa</Text></View>
                                  <Text style={styles.dockLabel}>Text</Text>
                              </TouchableOpacity>

                              {!localImageUri && (
                                  <TouchableOpacity style={styles.dockItem} onPress={cycleCanvasBackground}>
                                      <View style={[styles.dockIconCircle, styles.dockBorder]}><Ionicons name="color-fill" size={24} color="#fff" /></View>
                                      <Text style={styles.dockLabel}>Bg Color</Text>
                                  </TouchableOpacity>
                              )}

                              <TouchableOpacity style={styles.dockItem} onPress={handleCamera}>
                                  <View style={[styles.dockIconCircle, styles.dockBorder]}><Ionicons name="camera" size={24} color="#fff" /></View>
                                  <Text style={styles.dockLabel}>Camera</Text>
                              </TouchableOpacity>
                              
                              <TouchableOpacity style={styles.dockItem} onPress={handlePickImage}>
                                  <View style={[styles.dockIconCircle, styles.dockBorder]}>
                                      <Ionicons name="images" size={24} color="#fff" />
                                  </View>
                                  <Text style={styles.dockLabel}>Gallery</Text>
                              </TouchableOpacity>

                              <TouchableOpacity style={styles.dockItem} onPress={() => setHasMusic(!hasMusic)}>
                                  <View style={[styles.dockIconCircle, { backgroundColor: hasMusic ? '#E91E63' : '#222' }]}><Ionicons name="musical-notes" size={24} color="#fff" /></View>
                                  <Text style={styles.dockLabel}>Music</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.dockItem} onPress={() => setShowTrends(!showTrends)}>
                                  <View style={[styles.dockIconCircle, { backgroundColor: showTrends ? brand.orange : '#222' }]}><Ionicons name="flame" size={24} color="#fff" /></View>
                                  <Text style={styles.dockLabel}>Trend</Text>
                              </TouchableOpacity>
                          </View>
                      </View>
                  )}
              </View>

          </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
    flexOne: { flex: 1 },
    darkContainer: { flex: 1, backgroundColor: '#000' }, 
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 15, 
        paddingTop: Platform.OS === 'android' ? 5 : 5, 
        paddingBottom: 5, 
        zIndex: 50 
    },
    iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
    vibeBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    vibeBadgeText: { fontSize: 14, fontWeight: '600', color: '#fff' },
    postBtn: { backgroundColor: brand.blue, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, elevation: 5 },
    postBtnDisabled: { opacity: 0.6 },
    postBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    postTypeContainer: {
        position: 'absolute',
        top: Platform.OS === 'android' ? 60 : 50, 
        alignSelf: 'center',
        flexDirection: 'row',
        backgroundColor: 'rgba(20,20,20,0.85)',
        borderRadius: 25,
        padding: 4,
        zIndex: 100,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    typeBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    typeBtnActivePulse: { backgroundColor: '#E91E63' },
    typeBtnActiveFeed: { backgroundColor: '#2196F3' },
    typeBtnActiveMagic: { backgroundColor: '#8A2BE2' },
    typeBtnText: { color: '#888', fontWeight: 'bold', fontSize: 12, marginLeft: 6 },
    typeBtnTextActive: { color: '#fff' },
    canvasArea: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
    viewShotContainer: { width: width, height: height * 0.65, overflow: 'hidden', position: 'relative' },
    fullMedia: { width: '100%', height: '100%' },
    videoPlaceholder: { flex: 1, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
    videoInfo: { color: '#fff', marginTop: 15, fontWeight: '600' },
    videoTextOverlay: { position: 'absolute', bottom: 40, alignSelf: 'center', zIndex: 10 },
    emptyMedia: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: '#555', fontSize: 18, fontWeight: 'bold' },
    editingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    overlayInput: { textAlign: 'center', fontWeight: '900', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 10, alignSelf: 'center', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    draggable: { position: 'absolute', top: height / 3, alignSelf: 'center', zIndex: 100, elevation: 100, padding: 20 }, 
    tagWrapper: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, zIndex: 5 },
    tagPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, elevation: 3 },
    tagText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    tagCloseIcon: { marginLeft: 4 },
    tagPreIcon: { marginRight: 4 },
    footer: { paddingBottom: 25, paddingHorizontal: 15, backgroundColor: '#000' },
    textTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 15, paddingHorizontal: 5 },
    toolIcon: { alignItems: 'center' },
    toolLabel: { color: '#fff', fontSize: 10, marginTop: 4 },
    sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sizeVal: { color: '#fff', fontWeight: 'bold', fontSize: 18, minWidth: 30, textAlign: 'center' },
    inlineDoneBtn: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    inlineDoneBtnText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
    mainTools: { paddingTop: 10 },
    vibeScroll: { marginBottom: 10 },
    vibeScrollContent: { paddingHorizontal: 5, alignItems: 'center' },
    vibeChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 25, marginRight: 10, borderWidth: 1, borderColor: '#333' },
    vibeChipActive: { backgroundColor: brand.blue, borderColor: brand.blue },
    vibeIcon: { fontSize: 16 },
    vibeLabel: { color: '#fff', marginLeft: 6, fontWeight: '600', fontSize: 13 },
    trendScroll: { marginBottom: 15 },
    trendChip: { backgroundColor: 'rgba(255, 165, 0, 0.8)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
    trendChipText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    colorPicker: { flex: 1, paddingTop: 5 },
    colorDot: { width: 34, height: 34, borderRadius: 17, marginRight: 10, borderWidth: 2 },
    dock: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    dockItem: { alignItems: 'center' },
    dockIconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
    dockBorder: { backgroundColor: '#222', borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1 },
    dockLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '500' }
});