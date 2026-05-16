// client/src/components/KliqPulseBoard.js
// ⭐️ V8.0 KLIQMIND OMEGA: SUPREME NEON BOARD (ENLARGED & POWERFUL) ⭐️

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useAppStore } from '../store/useAppStore'; 
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; 
import { LinearGradient } from 'expo-linear-gradient';

const STANDARD_VIBES = [
    'Happy', 'Sad', 'Neutral', 'Tired', 'Broken', 'Excited', 'Angry', 'Relaxed', 'Bored', 'Sick',
    'Focused', 'Party', 'Work', 'Study', 'Gym', 'Gaming', 'Travel', 'Foodie', 'Driving', 'Coding',
    'Love', 'Cool', 'Normal', 'Chill', 'Lit', 'Vibing', 'Music', 'Nature', 'Art', 'Fashion'
];

const KliqPulseBoard = () => { 

  const { user, userSettings, pulses = [] } = useAppStore(); 
  const isDark = userSettings?.darkMode === true;

  const activeAdminPulse = pulses.find(p => !STANDARD_VIBES.includes(p.vibe));
  
  const fadeAnim = useRef(new Animated.Value(0)).current; 
  const slideAnim = useRef(new Animated.Value(20)).current; 
  const breathAnim = useRef(new Animated.Value(1)).current; 
  const barAnim = useRef(new Animated.Value(0)).current; 
  const ringAnim = useRef(new Animated.Value(0)).current; // אנימציית רדאר חדשה

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true })
    ]).start();

    // נשימה של הלוגו עצמו
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1.08, duration: 2500, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 1, duration: 2500, useNativeDriver: true })
      ])
    ).start();

    // פס הטעינה
    Animated.loop(
      Animated.sequence([
        Animated.timing(barAnim, { toValue: 1, duration: 3000, useNativeDriver: false }),
        Animated.timing(barAnim, { toValue: 0, duration: 0, useNativeDriver: false }) 
      ])
    ).start();

    // גל הרדאר (מתרחב ונעלם)
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 0, duration: 0, useNativeDriver: true })
      ])
    ).start();
  }, [activeAdminPulse]);

  const barWidth = barAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8]
  });

  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0]
  });

  const displayTitle = activeAdminPulse?.vibe || `SYSTEM: ONLINE`;
  const displayMessage = activeAdminPulse?.text || `Neural link synchronized.\nMonitoring KliqTap network...`;
  const imageSource = activeAdminPulse?.imageUrl ? { uri: activeAdminPulse.imageUrl } : null;

  return (
    <View style={localStyles.outerWrapper}>
      <LinearGradient
        colors={isDark ? ['#0B0914', '#1A1635', '#2A2359'] : ['#111', '#222', '#333']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={localStyles.container}
      >
        <View style={localStyles.content}>
          
          <Animated.View style={[localStyles.visualContainer, { transform: [{ scale: breathAnim }] }]}>
            
            {/* גלי רדאר רק כשאין תמונת פרופיל */}
            {!imageSource && (
              <Animated.View style={[localStyles.radarRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
            )}

            {imageSource ? (
              <Image source={imageSource} style={localStyles.leadImage} />
            ) : (
              <View style={localStyles.glowCircle}>
                <MaterialCommunityIcons name="shield-check" size={48} color="#00E5FF" />
              </View>
            )}
            <View style={localStyles.activeDot} />
          </Animated.View>
          
          <Animated.View style={[
            localStyles.textContainer, 
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}>
            <Text style={localStyles.title} numberOfLines={1} adjustsFontSizeToFit>
              {displayTitle}
            </Text>
            <Text style={localStyles.message}>{displayMessage}</Text>
          </Animated.View>
        </View>

        <View style={localStyles.powerBar}>
          <Animated.View style={[localStyles.powerFill, { width: barWidth }]} />
        </View>
      </LinearGradient>
    </View>
  );
};

const localStyles = StyleSheet.create({
  outerWrapper: { 
    marginHorizontal: 15, 
    marginBottom: 25, // ⭐️ הוקטן מ-40 כדי לקרב אליו את התוכן שמתחתיו
    borderRadius: 28, 
    elevation: 20, 
    shadowColor: "#00E5FF", 
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 }
  },
  container: { 
    paddingVertical: 18, // ⭐️ הוקטן משמעותית מ-32 כדי להוריד גובה
    paddingHorizontal: 20, 
    borderRadius: 28, 
    borderWidth: 2,
    borderColor: 'rgba(0, 229, 255, 0.35)' 
  },
  content: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  visualContainer: {
    position: 'relative',
    marginRight: 16, // הוקטן מעט כדי לחסוך מקום
  },
  radarRing: {
    position: 'absolute',
    width: 76, // ⭐️ התכווץ מ-100 ל-76
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#00E5FF',
    top: 0,
    left: 0,
  },
  glowCircle: { 
    width: 76, // ⭐️ התכווץ
    height: 76, 
    borderRadius: 38, 
    backgroundColor: 'rgba(0, 229, 255, 0.15)', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 229, 255, 0.5)'
  },
  leadImage: {
    width: 76, // ⭐️ התכווץ
    height: 76, 
    borderRadius: 38,
    borderWidth: 2.5,
    borderColor: '#00E5FF',
  },
  activeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16, 
    height: 16, 
    borderRadius: 8,
    backgroundColor: '#00E5FF',
    borderWidth: 2,
    borderColor: '#0B0914',
  },
  textContainer: { 
    flex: 1,
    justifyContent: 'center'
  },
  title: { 
    color: '#00E5FF', 
    fontWeight: '900', 
    fontSize: 21, // ⭐️ הוקטן מ-26 כדי להשתלב בצורה חלקה יותר
    letterSpacing: 1.2, 
    marginBottom: 4, // רווח קטן יותר
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 229, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8
  },
  message: { 
    color: '#E0E7FF', 
    fontSize: 15, // ⭐️ הוקטן מ-17
    fontWeight: '600',
    lineHeight: 22 
  },
  powerBar: { 
    height: 4, 
    backgroundColor: 'rgba(255,255,255,0.08)', 
    marginTop: 18, // ⭐️ הוקטן מ-28 כדי לחסוך גובה מתחת לטקסט
    borderRadius: 2, 
    overflow: 'hidden' 
  },
  powerFill: { 
    height: '100%', 
    backgroundColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOpacity: 1,
    shadowRadius: 8
  }
});
export default KliqPulseBoard;