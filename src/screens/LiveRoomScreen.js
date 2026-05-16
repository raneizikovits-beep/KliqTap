// client/src/screens/LiveRoomScreen.js
// ⭐️ V1.0 PRODUCTION: Full-Featured Live Room Experience ⭐️

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  TextInput, Image, KeyboardAvoidingView, Platform, 
  Animated, SafeAreaView, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../constants/data'; // מניח שיש לך קובץ צבעים, אם לא זה ישתמש ב-Fallbacks

const { width, height } = Dimensions.get('window');

// --- נתוני דמה (Mock Data) לפיתוח ---
const MOCK_MESSAGES = [
  { id: '1', user: 'Alex', text: 'This vibe is insane 🔥', avatar: 'https://i.pravatar.cc/100?img=11' },
  { id: '2', user: 'Sarah', text: 'Hello from NYC!', avatar: 'https://i.pravatar.cc/100?img=5' },
  { id: '3', user: 'MikeD', text: 'When is the next drop?', avatar: 'https://i.pravatar.cc/100?img=3' },
  { id: '4', user: 'Emma_v', text: 'Love the setup 👏', avatar: 'https://i.pravatar.cc/100?img=9' },
];

export default function LiveRoomScreen({ roomId, roomName, zone, onClose }) {
  // --- States ---
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [viewersCount, setViewersCount] = useState(Math.floor(Math.random() * 500) + 100);

  // --- Animations ---
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef();

  // אנימציית הבהוב לכפתור הלייב (LIVE)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, [pulseAnim]);

  // סימולציה של הצטרפות צופים
  useEffect(() => {
    const interval = setInterval(() => {
      setViewersCount(prev => prev + Math.floor(Math.random() * 5) - 2);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // --- Handlers ---
  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const newMessage = {
      id: Date.now().toString(),
      user: 'You',
      text: inputText,
      avatar: 'https://i.pravatar.cc/100?img=12' // תמונת המשתמש שלך
    };
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleSendHeart = () => {
    // כאן תוכל להוסיף אנימציה של לבבות מרחפים בעתיד
    console.log("Heart sent!");
  };

  // תמונת המארח (Host) - לוקח מ-zone או שם תמונת דמה
  const hostAvatar = zone?.img || zone?.image_url || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* === 1. HEADER (Top Bar) === */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.liveBadge}>
              <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <View style={styles.viewersBadge}>
              <Ionicons name="eye" size={14} color="#fff" />
              <Text style={styles.viewersText}>{viewersCount}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* === 2. MAIN STAGE (Video/Audio Area) === */}
        <View style={styles.stageContainer}>
          {/* הדובר המרכזי / וידאו ראשי */}
          <View style={styles.mainSpeaker}>
            {isVideoOff ? (
              <View style={styles.avatarGlow}>
                <Image source={{ uri: hostAvatar }} style={styles.hostAvatar} />
              </View>
            ) : (
              // כאן בעתיד תשב קומפוננטת הוידאו האמיתית (למשל של WebRTC / Agora)
              <Image source={{ uri: hostAvatar }} style={styles.videoBackground} blurRadius={isVideoOff ? 20 : 0} />
            )}
            
            <View style={styles.hostInfoOverlay}>
              <Text style={styles.roomNameTitle} numberOfLines={1}>{roomName || 'Chill Vibes Zone'}</Text>
              <Text style={styles.hostName}>@{zone?.hostName || 'KliqHost'}</Text>
            </View>
          </View>

          {/* שורת קוהוסטים (Co-hosts) / מאזינים על הבמה */}
          <View style={styles.coHostRow}>
             {[1, 2, 3].map((_, idx) => (
                <View key={idx} style={styles.coHostCircle}>
                    <Image source={{ uri: `https://i.pravatar.cc/150?img=${idx + 20}` }} style={styles.coHostImg} />
                    <View style={styles.micMutedBadge}>
                        <Ionicons name="mic-off" size={10} color="#fff" />
                    </View>
                </View>
             ))}
          </View>
        </View>

        {/* === 3. CHAT SECTION === */}
        <View style={styles.chatContainer}>
          <ScrollView 
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 10 }}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg) => (
              <View key={msg.id} style={styles.chatMessageRow}>
                <Image source={{ uri: msg.avatar }} style={styles.chatAvatar} />
                <View style={styles.chatBubble}>
                  <Text style={styles.chatUser}>{msg.user}</Text>
                  <Text style={styles.chatText}>{msg.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* === 4. BOTTOM ACTION BAR === */}
        <View style={styles.bottomBar}>
          <View style={styles.inputContainer}>
            <TextInput 
              style={styles.chatInput}
              placeholder="Add a comment..."
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSendMessage}
              returnKeyType="send"
            />
          </View>

          <View style={styles.actionsRight}>
            {/* מיקרופון */}
            <TouchableOpacity 
              style={[styles.iconButton, isMuted && styles.iconButtonActive]} 
              onPress={() => setIsMuted(!isMuted)}
            >
              <Ionicons name={isMuted ? "mic-off" : "mic"} size={22} color="#fff" />
            </TouchableOpacity>

            {/* וידאו מצלמה */}
            <TouchableOpacity 
              style={[styles.iconButton, isVideoOff && styles.iconButtonActive]} 
              onPress={() => setIsVideoOff(!isVideoOff)}
            >
              <Ionicons name={isVideoOff ? "videocam-off" : "videocam"} size={22} color="#fff" />
            </TouchableOpacity>

            {/* שליחת לב (לייק) */}
            <TouchableOpacity style={styles.heartButton} onPress={handleSendHeart}>
              <Ionicons name="heart" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A', // שחור עמוק ללייב
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 10,
    zIndex: 10,
    position: 'absolute',
    top: 0,
    width: '100%'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 45, 85, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FF2D55'
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF2D55',
    marginRight: 6
  },
  liveText: {
    color: '#FF2D55',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1
  },
  viewersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  viewersText: {
    color: '#fff',
    marginLeft: 6,
    fontWeight: 'bold',
    fontSize: 12
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stage (Video / Host)
  stageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 20,
  },
  mainSpeaker: {
    width: width * 0.9,
    height: height * 0.45,
    borderRadius: 24,
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    position: 'relative'
  },
  videoBackground: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover'
  },
  avatarGlow: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 3,
    borderColor: brand?.blue || '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: brand?.blue || '#6200EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10
  },
  hostAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  hostInfoOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 16,
  },
  roomNameTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 5
  },
  hostName: {
    color: '#ddd',
    fontSize: 13,
    marginTop: 2,
  },
  
  // Co-Hosts
  coHostRow: {
    flexDirection: 'row',
    gap: 15,
    marginTop: -25,
    zIndex: 5
  },
  coHostCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#222',
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  coHostImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  micMutedBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0A0A0A'
  },

  // Chat Section
  chatContainer: {
    height: height * 0.25,
    paddingHorizontal: 15,
    maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 100%)', // Effect for web/iOS
  },
  chatMessageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
    paddingRight: 50
  },
  chatAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  chatBubble: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderTopLeftRadius: 4,
  },
  chatUser: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2
  },
  chatText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18
  },

  // Bottom Actions
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 25,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 15,
    marginRight: 10,
  },
  chatInput: {
    color: '#fff',
    fontSize: 14,
    height: '100%',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonActive: {
    backgroundColor: '#FF3B30', // אדום כשזה כבוי
  },
  heartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: brand?.blue || '#6200EE', // צבע מרכזי
    justifyContent: 'center',
    alignItems: 'center',
  }
});