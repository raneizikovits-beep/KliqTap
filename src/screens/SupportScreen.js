// client/src/screens/SupportScreen.js
// ⭐️ V5.2 PREMIUM FOCUS MODE: Powerful Animations, Auras, Pull-to-Refresh, & Glass UI

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  Animated, Easing, TextInput, Alert, Modal, Dimensions, 
  PanResponder, KeyboardAvoidingView, Platform, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { Audio } from 'expo-av';
import { styles as globalStyles } from '../constants/styles';
import * as Data from '../constants/data'; 
import { useAppStore } from '../store/useAppStore'; 
import * as Haptics from 'expo-haptics'; 
import { trackEvent } from '../utils/analytics';

const { width } = Dimensions.get('window');

const safeHaptic = async (style) => {
    try { if (Haptics) await Haptics.impactAsync(style); } catch (e) {}
};

const safeHapticNotify = async (type) => {
    try { if (Haptics) await Haptics.notificationAsync(type); } catch (e) {}
};

const MOODS = [
  { id: 'great',    icon: '😄', label: 'Great', color: '#10B981' },
  { id: 'good',     icon: '🙂', label: 'Good',  color: '#3B82F6' },
  { id: 'okay',     icon: '😐', label: 'Okay',  color: '#F59E0B' },
  { id: 'down',     icon: '😔', label: 'Down',  color: '#8B5CF6' }, 
  { id: 'rough',    icon: '😞', label: 'Rough', color: '#EF4444' }, 
];

const SOUND_TRACKS = [
  { id: 'rain', name: 'Rain', icon: '🌧️' },
  { id: 'forest', name: 'Nature', icon: '🌲' },
  { id: 'waves', name: 'Ocean', icon: '🌊' },
  { id: 'fire', name: 'Fire', icon: '🔥' },
  { id: 'off', name: 'Off', icon: '🔇' },
];

const SOUND_FILES = {
  rain:   require('../assets/sounds/rain.mp3'),
  forest: require('../assets/sounds/forest.mp3'),
  waves:  require('../assets/sounds/waves.mp3'),
  fire:   require('../assets/sounds/fire.mp3'),
};

const AFFIRMATIONS = [
    "You are stronger than you know.",
    "This feeling is temporary.",
    "One breath at a time.",
    "You are safe here.",
    "Small steps are still progress.",
    "I trust the process of life.",
    "I am enough just as I am.",
    "Your potential to succeed is infinite.",
    "Breathe in courage, exhale doubt."
];

const getScreenTitle = (tool) => {
    switch (tool) {
        case 'breathe': return 'Breathing Exercise';
        case 'sounds': return 'Soundscape';
        case 'affirmation': return 'Daily Affirmation';
        default: return 'Mental Space';
    }
};

export default function SupportScreen({ sheet, setSecondSheet, setThirdSheet }) {
  const { streak, award, userSettings, logMood, todayMood } = useAppStore(state => ({
    streak: state.streak || 0,
    award: state.award,
    userSettings: state.userSettings,
    logMood: state.logMood,
    todayMood: state.todayMood
  }));

  const isDark = userSettings?.darkMode === true;
  const focusTool = sheet?.tool; 
  
  const [selectedMood, setSelectedMood] = useState(null);
  const [affirmation, setAffirmation] = useState(AFFIRMATIONS[0]);
  const [isBreathing, setIsBreathing] = useState(false);
  const [breathePhase, setBreathePhase] = useState('Ready');
  const [sound, setSound] = useState(null);
  const [activeSoundId, setActiveSoundId] = useState('off');
  const [worryText, setWorryText] = useState("");
  const [worryModalVisible, setWorryModalVisible] = useState(false);
  const [energyLevel, setEnergyLevel] = useState(50);
  const [refreshing, setRefreshing] = useState(false);

  const breathScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const entranceAnim = useRef(new Animated.Value(40)).current; 
  const entranceOpacity = useRef(new Animated.Value(0)).current;
  const soundPulseAnim = useRef(new Animated.Value(1)).current;
  
  const activeSoundIdRef = useRef('off');
  const isMountedRef = useRef(true);

  useEffect(() => {
    if (todayMood) {
        setSelectedMood(todayMood);
    }
  }, [todayMood]);

  useEffect(() => {
    activeSoundIdRef.current = activeSoundId;
  }, [activeSoundId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const handleClose = useCallback(() => {
    if (setThirdSheet) setThirdSheet(null);
    if (setSecondSheet) setSecondSheet(null);
  }, [setThirdSheet, setSecondSheet]);

  const cycleAffirmation = useCallback(() => {
      let next;
      do { next = AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]; }
      while (next === affirmation && AFFIRMATIONS.length > 1);
      setAffirmation(next);
  }, [affirmation]);

  const onRefresh = useCallback(() => {
      setRefreshing(true);
      safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => {
          cycleAffirmation();
          setRefreshing(false);
          safeHapticNotify(Haptics.NotificationFeedbackType.Success);
      }, 1000);
  }, [cycleAffirmation]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (evt, gestureState) => { if (gestureState.dy > 0) pan.setValue({ x: 0, y: gestureState.dy }); },
      onPanResponderRelease: (evt, gestureState) => {
          if (gestureState.dy > 50) handleClose();
          else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      }
    })
  ).current;

  useEffect(() => {
      Animated.parallel([
          Animated.timing(entranceAnim, { toValue: 0, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true }),
          Animated.timing(entranceOpacity, { toValue: 1, duration: 500, useNativeDriver: true })
      ]).start();
      
      setAffirmation(AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);
      if (focusTool === 'breathe') setTimeout(() => setIsBreathing(true), 600);
  }, [focusTool]);

  useEffect(() => {
    let loop;
    let hapticInterval;

    if (isBreathing) {
      trackEvent('breathe_tool_started');
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathScale, { toValue: 1.5, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(breathScale, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      );
      loop.start();
      hapticInterval = setInterval(() => safeHaptic(Haptics.ImpactFeedbackStyle.Light), 4000);
    } else {
      Animated.timing(breathScale, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    }

    let prevValue = 1;
    const id = breathScale.addListener(({ value }) => {
        if (!isBreathing) { setBreathePhase('Ready'); return; }
        const isAscending = value > prevValue;
        prevValue = value;
        if (isAscending) {
            if (value > 1.4) setBreathePhase('Hold');
            else setBreathePhase('Inhale');
        } else {
            if (value < 1.1) setBreathePhase('Hold');
            else setBreathePhase('Exhale');
        }
    });

    return () => { 
        if (loop) loop.stop(); 
        if (hapticInterval) clearInterval(hapticInterval); 
        breathScale.removeListener(id);
    };
  }, [isBreathing, breathScale]);

  useEffect(() => {
      let pulseLoop;
      if (activeSoundId !== 'off') {
          pulseLoop = Animated.loop(
              Animated.sequence([
                  Animated.timing(soundPulseAnim, { toValue: 1.15, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                  Animated.timing(soundPulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
              ])
          );
          pulseLoop.start();
      } else {
          soundPulseAnim.setValue(1);
      }
      return () => { if (pulseLoop) pulseLoop.stop(); };
  }, [activeSoundId, soundPulseAnim]);

  useEffect(() => {
    return () => {
        if (sound) sound.unloadAsync().catch(e => console.warn('Error unloading sound:', e));
    };
  }, [sound]);

  const handlePlaySound = useCallback(async (trackId) => {
    safeHapticNotify(Haptics.NotificationFeedbackType.Success);
    setActiveSoundId(trackId);

    if (trackId === 'off') {
      setSound(null);
      trackEvent('soundscape_played', { track: 'off' });
      return;
    }

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        SOUND_FILES[trackId],
        { isLooping: true, volume: 0.6, shouldPlay: true }
      );

      if (!isMountedRef.current || activeSoundIdRef.current !== trackId) {
        newSound.unloadAsync().catch(() => {});
        return;
      }

      setSound(newSound);
      trackEvent('soundscape_played', { track: trackId });
    } catch (e) {
      console.warn('[SupportScreen] Soundscape playback failed:', e);
      if (isMountedRef.current) setActiveSoundId('off');
    }
  }, []);

  const handleShredWorry = useCallback(() => {
      if(!worryText.trim()) return;
      Animated.timing(fadeAnim, { toValue: 0, duration: 1000, useNativeDriver: true }).start(() => {
          safeHapticNotify(Haptics.NotificationFeedbackType.Success);
          award?.("Released Worry"); 
          trackEvent('worry_shredded');
          setWorryModalVisible(false);
          setWorryText("");
          fadeAnim.setValue(1); 
      });
  }, [worryText, fadeAnim, award]);

  const toggleBreathing = useCallback(() => {
      setIsBreathing(prev => !prev);
      safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleMoodSelect = async (moodId) => {
      setSelectedMood(moodId); // עדכון אופטימי - צובע מיד את האמוג'י
      safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
      trackEvent('mental_space_mood', { mood: moodId });
      if (logMood) {
          try {
              await logMood(moodId);
          } catch(e) {
              console.warn("[SupportScreen] Saved locally due to DB network error");
              // אין כאן Alert - שומר על חוויית משתמש חלקה
          }
      }
  };

  const handleEnergySelect = (level) => {
      setEnergyLevel(level);
      safeHaptic(Haptics.ImpactFeedbackStyle.Light);
      trackEvent('energy_level_set', { level });
  };

  return (
    <Animated.View style={[localStyles.mainContainer, { backgroundColor: isDark ? '#000' : '#F9FAFB', transform: [{ translateY: pan.y }] }]}>
        
        {/* HEADER */}
        <View style={localStyles.headerTop}>
            <View {...panResponder.panHandlers} style={localStyles.headerTitleRow}>
                <Ionicons name={focusTool ? "leaf" : "heart-circle"} size={28} color={focusTool ? "#10B981" : "#FF2D55"} />
                <Text style={[localStyles.title, { color: isDark ? '#fff' : '#111' }]}>{getScreenTitle(focusTool)}</Text>
            </View>
            <View style={localStyles.headerRightActions}>
                {!focusTool && (
                    <View style={[localStyles.streakPill, { backgroundColor: isDark ? '#1C1C1E' : '#E3F2FD' }]}>
                        <Text style={[localStyles.streakText, { color: isDark ? '#fff' : Data.brand.blue }]}>🔥 {streak}</Text>
                    </View>
                )}
                <TouchableOpacity onPress={handleClose} style={[localStyles.closeBtn, { backgroundColor: isDark ? '#2C2C2E' : '#E2E8F0' }]}>
                    <Ionicons name="close" size={24} color={isDark ? '#ccc' : "#475569"} />
                </TouchableOpacity>
            </View>
        </View>

        <Animated.ScrollView 
            contentContainerStyle={localStyles.scrollContent} 
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#fff' : Data.brand.blue} />}
            style={{ opacity: entranceOpacity, transform: [{ translateY: entranceAnim }] }}
        >
            
            {(!focusTool || focusTool === 'affirmation') && (
                focusTool === 'affirmation' ? (
                    <View style={[localStyles.section, { marginTop: 40, alignItems: 'center' }]}>
                        <View style={[localStyles.focusToolCard, { backgroundColor: isDark ? '#111' : '#fff', borderColor: isDark ? '#333' : '#E2E8F0', borderWidth: 1, shadowColor: isDark ? '#000' : '#CBD5E1', shadowOpacity: 0.3, shadowRadius: 20 }]}>
                            <Ionicons name="sparkles" size={50} color={Data.brand.blue} style={{ marginBottom: 20 }} />
                            <Text style={[localStyles.affirmationText, { color: isDark ? '#E2E8F0' : '#1E293B', fontSize: 24, lineHeight: 36 }]}>"{affirmation}"</Text>
                            <TouchableOpacity style={[globalStyles.primaryBtn, { marginTop: 50, backgroundColor: Data.brand.blue, width: '90%', height: 55, borderRadius: 28, elevation: 5, shadowColor: Data.brand.blue, shadowOpacity: 0.4, shadowRadius: 10 }]} onPress={() => { cycleAffirmation(); safeHaptic(Haptics.ImpactFeedbackStyle.Light); }}>
                                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1 }}>NEXT AFFIRMATION ✨</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={[localStyles.affirmationCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderLeftColor: Data.brand.blue, marginTop: 20 }]}>
                        <Text style={[localStyles.affirmationText, { color: isDark ? '#ddd' : '#555' }]}>"{affirmation}"</Text>
                    </View>
                )
            )}

            {!focusTool && (
                <View style={localStyles.section}>
                    <Text style={[globalStyles.h2, { color: isDark ? '#fff' : '#0F172A' }]}>How are you feeling?</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.moodScroll}>
                        {MOODS.map((m) => {
                            const isSelected = selectedMood === m.id;
                            return (
                                <TouchableOpacity 
                                    key={m.id} 
                                    style={[
                                        localStyles.moodBtn, 
                                        { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#F1F5F9' }, 
                                        isSelected && { backgroundColor: m.color, borderColor: m.color, transform: [{ scale: 1.05 }] }
                                    ]} 
                                    onPress={() => handleMoodSelect(m.id)}
                                >
                                    <Text style={{ fontSize: 28 }}>{m.icon}</Text>
                                    <Text style={[localStyles.moodLabel, { color: isDark ? '#94A3B8' : '#64748B' }, isSelected && { color: '#fff', fontWeight: '900' }]}>{m.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {!focusTool && (
                <View style={localStyles.section}>
                     <Text style={[globalStyles.h2, { color: isDark ? '#fff' : '#0F172A' }]}>Energy Level 🔋</Text>
                     <View style={[localStyles.energyContainer, { backgroundColor: isDark ? '#2C2C2E' : '#E2E8F0' }]}>
                         <Animated.View style={[localStyles.energyFill, { width: `${energyLevel}%`, backgroundColor: energyLevel > 30 ? Data.brand.green : Data.brand.red }]} />
                         <View style={localStyles.energyOverlay}>
                             {[20, 50, 80, 100].map(level => (
                                 <TouchableOpacity key={`energy-${level}`} onPress={() => handleEnergySelect(level)} style={{flex: 1}} />
                             ))}
                         </View>
                     </View>
                     <Text style={[localStyles.energyText, { color: isDark ? '#64748B' : '#94A3B8' }]}>{energyLevel}% Charged</Text>
                </View>
            )}

            {(!focusTool || focusTool === 'breathe' || focusTool === 'sounds') && (
                <View style={[localStyles.section, focusTool && { marginTop: 40, alignItems: 'center' }]}>
                    {!focusTool && <Text style={[globalStyles.h2, { color: isDark ? '#fff' : '#0F172A' }]}>Interactive Tools</Text>}
                    
                    <ScrollView horizontal={!focusTool} showsHorizontalScrollIndicator={false} contentContainerStyle={focusTool ? { width: '100%', alignItems: 'center' } : { paddingRight: 20 }}>
                        
                        {(!focusTool || focusTool === 'breathe') && (
                            <View style={[localStyles.toolCard, { backgroundColor: isDark ? '#001A17' : '#E0F2F1', borderWidth: isDark ? 1 : 0, borderColor: '#004D40' }, focusTool && localStyles.focusToolCard]}>
                                <View style={[localStyles.circleContainer, focusTool && { width: 220, height: 220, marginBottom: 40 }]}>
                                    <Animated.View style={[localStyles.breathAura, focusTool && localStyles.focusBreathAura, { transform: [{ scale: Animated.multiply(breathScale, 1.4) }], opacity: 0.15 }]} />
                                    <Animated.View style={[localStyles.breathAura, focusTool && localStyles.focusBreathAura, { transform: [{ scale: Animated.multiply(breathScale, 1.2) }], opacity: 0.3 }]} />
                                    
                                    <Animated.View style={[localStyles.breathCircle, focusTool && localStyles.focusBreathCircle, { transform: [{ scale: breathScale }] }]}>
                                         {focusTool && <Text style={localStyles.breathePhaseText}>{breathePhase}</Text>}
                                    </Animated.View>
                                </View>
                                <View style={[localStyles.toolTextContainer, focusTool && { alignItems: 'center', marginLeft: 0 }]}>
                                    <Text style={[localStyles.toolTitle, { color: isDark ? '#4DB6AC' : '#00695C' }, focusTool && { fontSize: 28, letterSpacing: 1 }]}>Breathe</Text>
                                    {focusTool && <Text style={{ color: isDark ? '#B2DFDB' : '#004D40', marginTop: 10, fontSize: 15, opacity: 0.8 }}>Sync your breath with the rings</Text>}
                                    <TouchableOpacity style={[localStyles.miniBtn, focusTool && { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 30, marginTop: 30, backgroundColor: '#004D40', elevation: 5, shadowColor: '#004D40', shadowOpacity: 0.5, shadowRadius: 10 }]} onPress={toggleBreathing}>
                                        <Text style={[localStyles.miniBtnText, focusTool && { fontSize: 16, letterSpacing: 1.5 }]}>{isBreathing ? "PAUSE" : "BEGIN"}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {(!focusTool || focusTool === 'sounds') && (
                            <View style={[localStyles.toolCard, { backgroundColor: isDark ? '#333300' : '#F9FBE7', borderWidth: isDark ? 1 : 0, borderColor: '#827717' }, focusTool && localStyles.focusToolCard]}>
                                <View style={[localStyles.circleContainer, focusTool && { width: 120, height: 120, marginBottom: 20 }]}>
                                    <Text style={{fontSize: focusTool ? 70 : 32}}>🎧</Text>
                                </View>
                                <View style={[localStyles.toolTextContainer, focusTool && { alignItems: 'center', marginLeft: 0, width: '100%' }]}>
                                    <Text style={[localStyles.toolTitle, { color: isDark ? '#DCE775' : '#827717' }, focusTool && { fontSize: 28, marginBottom: 25, letterSpacing: 1 }]}>Soundscape</Text>
                                    <View style={[localStyles.soundRow, focusTool && { gap: 20, flexWrap: 'wrap', justifyContent: 'center', width: '100%', paddingHorizontal: 10 }]}>
                                        {SOUND_TRACKS.map(t => {
                                            if (!focusTool && t.id === 'fire') return null;
                                            const isActive = activeSoundId === t.id;
                                            return (
                                                <TouchableOpacity key={t.id} onPress={() => handlePlaySound(t.id)} activeOpacity={0.8}>
                                                    <Animated.View style={[
                                                        localStyles.soundBtn, 
                                                        focusTool && { width: 70, height: 70, borderRadius: 35 }, 
                                                        isActive && { backgroundColor: isDark ? '#827717' : '#fff', borderWidth: 2, borderColor: '#827717', shadowColor: '#827717', shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },
                                                        isActive && focusTool && { transform: [{ scale: soundPulseAnim }] }
                                                    ]}>
                                                        <Text style={{fontSize: focusTool ? 32 : 14}}>{t.icon}</Text>
                                                    </Animated.View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>
            )}

            {!focusTool && (
                <View style={[localStyles.section, { marginTop: 30 }]}>
                    <TouchableOpacity 
                        style={[localStyles.promoCard, { backgroundColor: isDark ? '#311B3D' : Data.brand.purple, shadowColor: Data.brand.purple, shadowOpacity: 0.3, shadowRadius: 15 }]} 
                        activeOpacity={0.9} 
                        onPress={() => setWorryModalVisible(true)}
                    >
                        <View style={localStyles.promoTextContainer}>
                            <Text style={[globalStyles.h2, {color: '#fff', fontSize: 20, fontWeight: '900'}]}>Worry Box</Text>
                            <Text style={localStyles.promoSubText}>Type out your stress and destroy it instantly.</Text>
                            <View style={[localStyles.promoBtn, { backgroundColor: isDark ? '#4A148C' : '#fff' }]}>
                                 <Text style={[localStyles.promoBtnText, { color: isDark ? '#fff' : Data.brand.purple }]}>OPEN BOX</Text>
                            </View>
                        </View>
                        <View style={localStyles.promoIconContainer}>
                             <Text style={{fontSize: 50}}>🗑️</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            )}
        </Animated.ScrollView>

        {/* WORRY MODAL */}
        <Modal visible={worryModalVisible} animationType="fade" transparent={true} onRequestClose={() => setWorryModalVisible(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={localStyles.modalOverlay}>
                <View style={[localStyles.modalContent, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
                    <View style={localStyles.modalHeader}>
                        <Text style={[globalStyles.h2, { color: isDark ? '#fff' : '#0F172A', fontSize: 22 }]}>Release It</Text>
                        <TouchableOpacity onPress={() => setWorryModalVisible(false)} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                            <Ionicons name="close" size={26} color={isDark ? '#aaa' : "#64748B"} />
                        </TouchableOpacity>
                    </View>
                    <Text style={[globalStyles.p, { color: isDark ? '#94A3B8' : '#64748B', fontSize: 15 }]}>What is weighing on you right now?</Text>
                    <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
                        <TextInput 
                            style={[localStyles.worryInput, { backgroundColor: isDark ? '#111' : '#F1F5F9', color: isDark ? '#fff' : '#0F172A', borderColor: isDark ? '#333' : '#E2E8F0', borderWidth: 1 }]} 
                            multiline 
                            placeholder="I feel..." 
                            placeholderTextColor={isDark ? "#666" : "#94A3B8"}
                            value={worryText} 
                            onChangeText={setWorryText} 
                            autoFocus 
                        />
                    </Animated.View>
                    <TouchableOpacity style={[globalStyles.primaryBtn, {backgroundColor: Data.brand.red, marginTop: 24, width: '100%', height: 55, borderRadius: 16}]} onPress={handleShredWorry} disabled={!worryText.trim()}>
                        <Text style={{color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1}}>SHRED THOUGHT 💥</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  mainContainer: { flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 15, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 15 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  closeBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  streakPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  streakText: { fontSize: 13, fontWeight: '900' },
  scrollContent: { paddingBottom: 140 },
  affirmationCard: { marginHorizontal: 20, padding: 22, borderRadius: 20, alignItems: 'center', borderLeftWidth: 5, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  affirmationText: { fontSize: 18, fontStyle: 'italic', textAlign: 'center', lineHeight: 28, fontWeight: '500' },
  section: { marginTop: 28, paddingHorizontal: 20 },
  moodScroll: { paddingVertical: 10, gap: 14 },
  moodBtn: { paddingVertical: 16, paddingHorizontal: 16, minWidth: 75, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  moodLabel: { fontSize: 13, marginTop: 10, fontWeight: '700' },
  energyContainer: { height: 14, borderRadius: 7, marginTop: 12, overflow: 'hidden' },
  energyFill: { height: '100%', borderRadius: 7 },
  energyOverlay: { position: 'absolute', width: '100%', height: '100%', flexDirection: 'row' },
  energyText: { textAlign: 'right', marginTop: 8, fontSize: 13, fontWeight: '600' },
  toolCard: { width: width * 0.65, padding: 20, borderRadius: 24, flexDirection: 'row', alignItems: 'center', marginRight: 15, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 3 },
  focusToolCard: { width: width * 0.88, minHeight: 380, paddingVertical: 50, paddingHorizontal: 20, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRadius: 36 },
  circleContainer: { width: 60, height: 60, justifyContent: 'center', alignItems: 'center' },
  breathCircle: { width: 36, height: 36, borderRadius: 18, opacity: 0.85, backgroundColor: '#00695C', justifyContent: 'center', alignItems: 'center' },
  focusBreathCircle: { width: 140, height: 140, borderRadius: 70, shadowColor: '#004D40', shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  breathAura: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: '#4DB6AC' },
  focusBreathAura: { width: 140, height: 140, borderRadius: 70 },
  breathePhaseText: { color: '#fff', fontSize: 18, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 },
  toolTextContainer: { marginLeft: 16, flex: 1 },
  toolTitle: { fontWeight: '900', fontSize: 18 },
  toolDesc: { fontSize: 13, marginBottom: 8, marginTop: 2, fontWeight: '500' },
  miniBtn: { backgroundColor: '#00695C', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, alignSelf: 'flex-start' },
  miniBtnText: { color: '#fff', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  soundRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  soundBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center' },
  promoCard: { borderRadius: 24, padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 8 },
  promoTextContainer: { flex: 1, paddingRight: 15 },
  promoSubText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 22, marginTop: 6, fontWeight: '500' },
  promoBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, alignSelf: 'flex-start', marginTop: 14 },
  promoBtnText: { fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  promoIconContainer: { width: 70, alignItems: 'flex-end', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', borderRadius: 28, padding: 28, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 15 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  worryInput: { width: '100%', height: 130, borderRadius: 16, padding: 18, marginTop: 18, textAlignVertical: 'top', fontSize: 17 },
});