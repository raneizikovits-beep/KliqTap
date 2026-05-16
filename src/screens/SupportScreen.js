// client/src/screens/SupportScreen.js
// ⭐️ FULL DARK MODE COMPATIBLE - ALL ORIGINAL FUNCTIONS PRESERVED ⭐️

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  Animated, Easing, TextInput, Alert, Modal, Dimensions, 
  PanResponder, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { styles as globalStyles } from '../constants/styles';
import * as Data from '../constants/data'; 
import { useAppStore } from '../store/useAppStore'; 
import * as Haptics from 'expo-haptics'; 

const { width } = Dimensions.get('window');

const safeHaptic = async (style) => {
    try {
        if (Haptics) await Haptics.impactAsync(style);
    } catch (error) {
        console.warn('Haptics impact failed:', error);
    }
};

const safeHapticNotify = async (type) => {
    try {
        if (Haptics) await Haptics.notificationAsync(type);
    } catch (error) {
        console.warn('Haptics notification failed:', error);
    }
};

const MOODS = [
  { id: 'stress', icon: '😰', label: 'Stressed', color: '#FFD166' },
  { id: 'sad', icon: '😔', label: 'Down', color: '#118AB2' },
  { id: 'anxious', icon: '🌩️', label: 'Anxious', color: '#EF476F' },
  { id: 'angry', icon: '😤', label: 'Angry', color: '#E76F51' },
  { id: 'neutral', icon: '😐', label: 'Okay', color: '#06D6A0' },
];

const SOUND_TRACKS = [
  { id: 'rain', name: 'Rain', icon: '🌧️' },
  { id: 'forest', name: 'Nature', icon: '🌲' },
  { id: 'waves', name: 'Ocean', icon: '🌊' },
  { id: 'fire', name: 'Fire', icon: '🔥' },
  { id: 'off', name: 'Off', icon: '🔇' },
];

const AFFIRMATIONS = [
    "You are stronger than you know.",
    "This feeling is temporary.",
    "One breath at a time.",
    "You are safe here.",
    "Small steps are still progress.",
    "I trust the process of life.",
    "I am enough just as I am."
];

export default function SupportScreen({ setSecondSheet, setThirdSheet }) {
  // ⭐️ Pulling dynamic settings for Dark Mode
  const { streak, award, userSettings } = useAppStore(state => ({
    streak: state.streak || 0,
    award: state.award,
    userSettings: state.userSettings
  }));

  const isDark = userSettings?.darkMode === true;
  
  const [selectedMood, setSelectedMood] = useState('neutral');
  const [affirmation, setAffirmation] = useState(AFFIRMATIONS[0]);
  const [isBreathing, setIsBreathing] = useState(false);
  const [sound, setSound] = useState(null);
  const [activeSoundId, setActiveSoundId] = useState('off');
  const [worryText, setWorryText] = useState("");
  const [worryModalVisible, setWorryModalVisible] = useState(false);
  const [energyLevel, setEnergyLevel] = useState(50);

  const breathScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY()).current;

  const handleClose = useCallback(() => {
    if (setThirdSheet) setThirdSheet(null);
    if (setSecondSheet) setSecondSheet(null);
  }, [setThirdSheet, setSecondSheet]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
          return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (evt, gestureState) => {
          if (gestureState.dy > 0) {
              pan.setValue({ x: 0, y: gestureState.dy });
          }
      },
      onPanResponderRelease: (evt, gestureState) => {
          if (gestureState.dy > 50) {
              handleClose();
          } else {
              Animated.spring(pan, {
                  toValue: { x: 0, y: 0 },
                  useNativeDriver: false 
              }).start();
          }
      }
    })
  ).current;

  useEffect(() => {
      setAffirmation(AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);
  }, []);

  useEffect(() => {
    let loop;
    let hapticInterval;

    if (isBreathing) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathScale, { toValue: 1.5, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(breathScale, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      );
      loop.start();

      hapticInterval = setInterval(() => {
         safeHaptic(Haptics.ImpactFeedbackStyle.Light);
      }, 4000);
    } else {
      Animated.timing(breathScale, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }).start();
    }
    
    return () => {
        if (loop) loop.stop();
        if (hapticInterval) clearInterval(hapticInterval);
    };
  }, [isBreathing, breathScale]);

  useEffect(() => {
    return () => {
        if (sound) {
            sound.unloadAsync().catch(e => console.warn('Error unloading sound:', e));
        }
    };
  }, [sound]);

  const handlePlaySound = useCallback(async (trackId) => {
    if (sound) {
      try { await sound.unloadAsync(); } catch(e) { console.warn('Failed to unload previous sound', e); }
    }
    setActiveSoundId(trackId);
    if (trackId === 'off') {
        setSound(null);
        return;
    }
    safeHapticNotify(Haptics.NotificationFeedbackType.Success);
  }, [sound]);

  const handleShredWorry = useCallback(() => {
      if(!worryText.trim()) return;
      
      Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true
      }).start(() => {
          safeHapticNotify(Haptics.NotificationFeedbackType.Success);
          award("Released Worry");
          setWorryModalVisible(false);
          setWorryText("");
          fadeAnim.setValue(1); 
          Alert.alert("Gone", "Your worry has been released.");
      });
  }, [worryText, fadeAnim, award]);

  const handleTaskPress = useCallback((action) => {
      if (setThirdSheet) {
        setThirdSheet({ source: action });
      } else if (setSecondSheet) {
        setSecondSheet({ source: action });
      }
  }, [setThirdSheet, setSecondSheet]);

  const toggleBreathing = useCallback(() => {
      setIsBreathing(prev => !prev);
      safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  return (
    <Animated.View style={[localStyles.mainContainer, { backgroundColor: isDark ? '#000' : '#F9FAFB', transform: [{ translateY: pan.y }] }]}>
        
        <View style={localStyles.headerTop}>
            <View {...panResponder.panHandlers} style={localStyles.headerTitleRow}>
                <Ionicons name="heart-circle" size={28} color="#FF2D55" />
                <Text style={[localStyles.title, { color: isDark ? '#fff' : '#111' }]}>Mental Space</Text>
            </View>
            <View style={localStyles.headerRightActions}>
                <View style={[localStyles.streakPill, { backgroundColor: isDark ? '#1C1C1E' : '#E3F2FD' }]}>
                    <Text style={[localStyles.streakText, { color: isDark ? '#fff' : Data.brand.blue }]}>🔥 {streak}</Text>
                </View>
                <TouchableOpacity 
                    onPress={handleClose} 
                    style={[localStyles.closeBtn, { backgroundColor: isDark ? '#333' : '#eee' }]}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    <Ionicons name="close" size={24} color={isDark ? '#ccc' : "#666"} />
                </TouchableOpacity>
            </View>
        </View>

        <ScrollView contentContainerStyle={localStyles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* DAILY AFFIRMATION */}
            <View style={[localStyles.affirmationCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderLeftColor: Data.brand.blue }]}>
                <Text style={[localStyles.affirmationText, { color: isDark ? '#ddd' : '#555' }]}>"{affirmation}"</Text>
            </View>

            {/* MOOD CHECK-IN */}
            <View style={localStyles.section}>
                <Text style={[globalStyles.h2, { color: isDark ? '#fff' : '#000' }]}>How are you feeling?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.moodScroll}>
                    {MOODS.map((m) => {
                        const isSelected = selectedMood === m.id;
                        return (
                            <TouchableOpacity 
                                key={m.id} 
                                style={[
                                    localStyles.moodBtn, 
                                    { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#eee' },
                                    isSelected && { backgroundColor: m.color, borderColor: m.color }
                                ]}
                                onPress={() => {
                                    setSelectedMood(m.id);
                                    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={{ fontSize: 28 }}>{m.icon}</Text>
                                <Text style={[localStyles.moodLabel, { color: isDark ? '#aaa' : '#555' }, isSelected && { color: '#fff', fontWeight: 'bold' }]}>
                                    {m.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* ENERGY LEVEL */}
            <View style={localStyles.section}>
                 <Text style={[globalStyles.h2, { color: isDark ? '#fff' : '#000' }]}>Energy Level</Text>
                 <View style={[localStyles.energyContainer, { backgroundColor: isDark ? '#333' : '#eee' }]}>
                     <View style={[
                         localStyles.energyFill, 
                         { width: `${energyLevel}%`, backgroundColor: energyLevel > 30 ? Data.brand.green : Data.brand.red }
                     ]} />
                     <View style={localStyles.energyOverlay}>
                         {[20, 50, 80, 100].map(level => (
                             <TouchableOpacity 
                                key={`energy-${level}`} 
                                onPress={() => {
                                    setEnergyLevel(level);
                                    safeHaptic(Haptics.ImpactFeedbackStyle.Light);
                                }} 
                                style={{flex: 1}} 
                             />
                         ))}
                     </View>
                 </View>
                 <Text style={[localStyles.energyText, { color: isDark ? '#888' : '#888' }]}>{energyLevel}% Charged</Text>
            </View>

            {/* INTERACTIVE TOOLS */}
            <View style={localStyles.section}>
                <Text style={[globalStyles.h2, { color: isDark ? '#fff' : '#000' }]}>Interactive Tools</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
                    
                    <View style={[localStyles.toolCard, { backgroundColor: isDark ? '#00332E' : '#E0F7FA' }]}>
                        <View style={localStyles.circleContainer}>
                            <Animated.View style={[localStyles.breathCircle, { transform: [{ scale: breathScale }] }]} />
                        </View>
                        <View style={localStyles.toolTextContainer}>
                            <Text style={[localStyles.toolTitle, { color: isDark ? '#4DB6AC' : '#00695C' }]}>Breathe</Text>
                            <Text style={[localStyles.toolDesc, { color: isDark ? '#B2DFDB' : '#004D40' }]}>Calm your mind</Text>
                            <TouchableOpacity style={localStyles.miniBtn} onPress={toggleBreathing}>
                                <Text style={localStyles.miniBtnText}>{isBreathing ? "STOP" : "START"}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={[localStyles.toolCard, { backgroundColor: isDark ? '#424213' : '#F0F4C3' }]}>
                        <View style={localStyles.circleContainer}>
                            <Text style={{fontSize: 32}}>🎧</Text>
                        </View>
                        <View style={localStyles.toolTextContainer}>
                            <Text style={[localStyles.toolTitle, { color: isDark ? '#DCE775' : '#827717' }]}>Soundscape</Text>
                            <View style={localStyles.soundRow}>
                                {SOUND_TRACKS.slice(0, 3).map(t => {
                                    const isActive = activeSoundId === t.id;
                                    return (
                                        <TouchableOpacity 
                                            key={t.id} 
                                            onPress={() => handlePlaySound(t.id)}
                                            style={[localStyles.soundBtn, isActive && { backgroundColor: isDark ? '#666' : '#fff', borderWidth: 1, borderColor: '#ccc' }]}
                                        >
                                            <Text style={{fontSize: 14}}>{t.icon}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>

            {/* WORRY BOX */}
            <View style={[localStyles.section, { marginTop: 25 }]}>
                <TouchableOpacity 
                    style={[localStyles.promoCard, { backgroundColor: isDark ? '#311B3D' : Data.brand.purple, shadowColor: isDark ? '#000' : Data.brand.purple }]} 
                    activeOpacity={0.9} 
                    onPress={() => setWorryModalVisible(true)}
                >
                    <View style={localStyles.promoTextContainer}>
                        <Text style={[globalStyles.h2, {color: '#fff'}]}>Worry Box</Text>
                        <Text style={localStyles.promoSubText}>Type out your stress and destroy it instantly.</Text>
                        <View style={[localStyles.promoBtn, { backgroundColor: isDark ? '#4A148C' : '#fff' }]}>
                             <Text style={[localStyles.promoBtnText, { color: isDark ? '#fff' : Data.brand.purple }]}>OPEN BOX</Text>
                        </View>
                    </View>
                    <View style={localStyles.promoIconContainer}>
                         <Text style={{fontSize: 45}}>🗑️</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* RESOURCES */}
            <View style={localStyles.section}>
                <Text style={[globalStyles.h2, { color: isDark ? '#fff' : '#000' }]}>Resources</Text>
                
                <TouchableOpacity style={[localStyles.resourceRow, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#f5f5f5' }]} onPress={() => handleTaskPress('SupportPro')}>
                    <View style={[localStyles.iconBox, {backgroundColor: isDark ? '#102A43' : '#E3F2FD'}]}>
                        <Ionicons name="medical" size={24} color="#1E88E5" />
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={[localStyles.cardTitle, { color: isDark ? '#fff' : '#333' }]}>Professional Help</Text>
                        <Text style={[localStyles.cardSub, { color: isDark ? '#888' : '#888' }]}>Find a therapist</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : "#ccc"} />
                </TouchableOpacity>

                <TouchableOpacity style={[localStyles.resourceRow, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#f5f5f5' }]} onPress={() => handleTaskPress('SupportPeers')}>
                    <View style={[localStyles.iconBox, {backgroundColor: isDark ? '#311B3D' : '#F3E5F5'}]}>
                        <Ionicons name="people" size={24} color="#8E24AA" />
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={[localStyles.cardTitle, { color: isDark ? '#fff' : '#333' }]}>Community Circle</Text>
                        <Text style={[localStyles.cardSub, { color: isDark ? '#888' : '#888' }]}>Peer support groups</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : "#ccc"} />
                </TouchableOpacity>

                <TouchableOpacity style={[localStyles.resourceRow, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#f5f5f5' }]} onPress={() => handleTaskPress('SupportCrisis')}>
                    <View style={[localStyles.iconBox, {backgroundColor: isDark ? '#4A1815' : '#FFEBEE'}]}>
                        <Ionicons name="alert" size={24} color="#E53935" />
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={[localStyles.cardTitle, { color: isDark ? '#fff' : '#333' }]}>Crisis Hotline</Text>
                        <Text style={[localStyles.cardSub, { color: isDark ? '#888' : '#888' }]}>Immediate assistance</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={isDark ? '#666' : "#ccc"} />
                </TouchableOpacity>
            </View>
        </ScrollView>

        {/* WORRY MODAL */}
        <Modal visible={worryModalVisible} animationType="fade" transparent={true} onRequestClose={() => setWorryModalVisible(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={localStyles.modalOverlay}>
                <View style={[localStyles.modalContent, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
                    <View style={localStyles.modalHeader}>
                        <Text style={[globalStyles.h2, { color: isDark ? '#fff' : '#000' }]}>Release It</Text>
                        <TouchableOpacity onPress={() => setWorryModalVisible(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                            <Ionicons name="close" size={24} color={isDark ? '#aaa' : "#999"} />
                        </TouchableOpacity>
                    </View>
                    
                    <Text style={[globalStyles.p, { color: isDark ? '#ccc' : '#333' }]}>What is weighing on you right now?</Text>
                    
                    <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
                        <TextInput 
                            style={[localStyles.worryInput, { backgroundColor: isDark ? '#333' : '#F5F5F5', color: isDark ? '#fff' : '#000' }]}
                            multiline
                            placeholder="I feel..."
                            placeholderTextColor={isDark ? "#888" : "#ccc"}
                            value={worryText}
                            onChangeText={setWorryText}
                            autoFocus
                        />
                    </Animated.View>

                    <TouchableOpacity 
                        style={[globalStyles.primaryBtn, {backgroundColor: Data.brand.red, marginTop: 20, width: '100%'}]}
                        onPress={handleShredWorry}
                        disabled={!worryText.trim()}
                    >
                        <Text style={{color: '#fff', fontWeight: 'bold', fontSize: 16}}>SHRED THOUGHT 💥</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  mainContainer: { 
      flex: 1, 
      borderTopLeftRadius: 30, 
      borderTopRightRadius: 30,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -5 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 10
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  streakPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  streakText: { fontSize: 12, fontWeight: 'bold' },

  scrollContent: { paddingBottom: 120 },
  affirmationCard: { margin: 20, padding: 20, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, borderLeftWidth: 4 },
  affirmationText: { fontSize: 18, fontStyle: 'italic', textAlign: 'center', lineHeight: 26 },
  section: { marginTop: 24, paddingHorizontal: 20 },
  moodScroll: { paddingVertical: 10, gap: 12 },
  moodBtn: { paddingVertical: 15, paddingHorizontal: 15, minWidth: 70, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5, elevation: 2 },
  moodLabel: { fontSize: 12, marginTop: 8, fontWeight: '500' },
  energyContainer: { height: 12, borderRadius: 6, marginTop: 10, overflow: 'hidden', position: 'relative' },
  energyFill: { height: '100%', borderRadius: 6 },
  energyOverlay: { position: 'absolute', width: '100%', height: '100%', flexDirection: 'row' },
  energyText: { textAlign: 'right', marginTop: 5, fontSize: 12 },
  toolCard: { width: width * 0.6, padding: 16, borderRadius: 20, flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  circleContainer: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  breathCircle: { width: 30, height: 30, borderRadius: 15, opacity: 0.7 },
  toolTextContainer: { marginLeft: 12, flex: 1 },
  toolTitle: { fontWeight: 'bold', fontSize: 16 },
  toolDesc: { fontSize: 12, marginBottom: 5 },
  miniBtn: { backgroundColor: '#00695C', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  miniBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  soundRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  soundBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center' },
  promoCard: { borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 5 },
  promoTextContainer: { flex: 1, paddingRight: 10 },
  promoSubText: { color: 'rgba(255,255,255,0.95)', fontSize: 14, lineHeight: 20, marginTop: 4 },
  promoBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, alignSelf: 'flex-start', marginTop: 10 },
  promoBtnText: { fontWeight: 'bold', fontSize: 12 },
  promoIconContainer: { width: 60, alignItems: 'center', justifyContent: 'center' },
  resourceRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginTop: 10, borderWidth: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  cardTitle: { fontWeight: 'bold', fontSize: 16 },
  cardSub: { fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', borderRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  worryInput: { width: '100%', height: 120, borderRadius: 12, padding: 15, marginTop: 15, textAlignVertical: 'top', fontSize: 16 },
});