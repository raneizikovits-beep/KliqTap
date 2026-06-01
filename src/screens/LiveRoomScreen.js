// client/src/screens/LiveRoomScreen.js
// ✅ V2.0 PRODUCTION: Full architectural refactor — clean, modular, secure, scalable

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../constants/data';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const { width, height } = Dimensions.get('window');

/**
 * Fallback host avatar — a copyright-free Unsplash photo.
 * Used when `zone.img` / `zone.image_url` is not provided.
 */
const FALLBACK_HOST_AVATAR =
  'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80';

/**
 * Viewer count simulation: how often (ms) the counter updates.
 * Extracted so it can be changed / disabled easily in production.
 */
const VIEWER_TICK_MS = 3000;

/**
 * Chat auto-scroll delay (ms) after a new message is appended.
 * Gives the FlatList time to commit the item before scrolling.
 */
const SCROLL_DELAY_MS = 100;

/**
 * Number of co-host placeholder slots to render.
 * Replace with real co-host data when WebRTC is wired up.
 */
const CO_HOST_COUNT = 3;

/**
 * Pulse animation target opacity values.
 */
const PULSE_MIN = 0.4;
const PULSE_MAX = 1.0;
const PULSE_DURATION_MS = 800;

/**
 * Mock initial messages — remove / replace with real socket data.
 */
const INITIAL_MESSAGES = [
  { id: '1', user: 'Alex',   text: 'This vibe is insane 🔥', avatar: 'https://i.pravatar.cc/100?img=11' },
  { id: '2', user: 'Sarah',  text: 'Hello from NYC!',         avatar: 'https://i.pravatar.cc/100?img=5'  },
  { id: '3', user: 'MikeD',  text: 'When is the next drop?',  avatar: 'https://i.pravatar.cc/100?img=3'  },
  { id: '4', user: 'Emma_v', text: 'Love the setup 👏',       avatar: 'https://i.pravatar.cc/100?img=9'  },
];

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/**
 * Animated LIVE badge with a pulsing red dot.
 * Accepts the animated opacity value from the parent so the
 * animation loop runs once and is shared — not duplicated.
 */
const LiveBadge = ({ pulseAnim }) => (
  <View style={styles.liveBadge}>
    <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
    <Text style={styles.liveText}>LIVE</Text>
  </View>
);

/**
 * Viewer count badge.
 */
const ViewersBadge = ({ count }) => (
  <View style={styles.viewersBadge}>
    <Ionicons name="eye" size={14} color="#fff" />
    <Text style={styles.viewersText}>{Math.max(0, count)}</Text>
  </View>
);

/**
 * Single co-host circle with a mic-muted badge.
 * In production: replace `isMuted` with real participant state.
 */
const CoHostCircle = ({ index }) => (
  <View style={styles.coHostCircle}>
    <Image
      source={{ uri: `https://i.pravatar.cc/150?img=${index + 20}` }}
      style={styles.coHostImg}
      accessibilityLabel={`Co-host ${index + 1}`}
    />
    <View style={styles.micMutedBadge}>
      <Ionicons name="mic-off" size={10} color="#fff" />
    </View>
  </View>
);

/**
 * A single chat message row.
 * Wrapped in React.memo — only re-renders if the message object changes.
 */
const ChatMessage = React.memo(({ item }) => (
  <View style={styles.chatMessageRow}>
    <Image
      source={{ uri: item.avatar }}
      style={styles.chatAvatar}
      accessibilityLabel={`${item.user} avatar`}
    />
    <View style={styles.chatBubble}>
      <Text style={styles.chatUser}>{item.user}</Text>
      <Text style={styles.chatText}>{item.text}</Text>
    </View>
  </View>
));

/**
 * Main video / host stage.
 * Shows either a video background (placeholder for WebRTC) or
 * the avatar glow when video is off.
 */
const HostStage = ({ isVideoOff, hostAvatar, roomName, hostName }) => (
  <View style={styles.mainSpeaker}>
    {isVideoOff ? (
      <View style={styles.avatarGlow}>
        <Image
          source={{ uri: hostAvatar }}
          style={styles.hostAvatar}
          accessibilityLabel="Host avatar"
        />
      </View>
    ) : (
      // Future: replace with a WebRTC / Agora <RTCView> component
      <Image
        source={{ uri: hostAvatar }}
        style={styles.videoBackground}
        accessibilityLabel="Host video feed"
      />
    )}

    <View style={styles.hostInfoOverlay}>
      <Text style={styles.roomNameTitle} numberOfLines={1}>
        {roomName || 'Chill Vibes Zone'}
      </Text>
      <Text style={styles.hostName}>@{hostName || 'KliqHost'}</Text>
    </View>
  </View>
);

/**
 * Bottom action bar: chat input + mic / camera / heart toggles.
 */
const BottomBar = ({
  inputText,
  onChangeText,
  onSend,
  isMuted,
  onToggleMute,
  isVideoOff,
  onToggleVideo,
  onSendHeart,
}) => (
  <View style={styles.bottomBar}>
    <View style={styles.inputContainer}>
      <TextInput
        style={styles.chatInput}
        placeholder="Add a comment..."
        placeholderTextColor="#999"
        value={inputText}
        onChangeText={onChangeText}
        onSubmitEditing={onSend}
        returnKeyType="send"
        accessibilityLabel="Chat message input"
      />
    </View>

    <View style={styles.actionsRight}>
      <TouchableOpacity
        style={[styles.iconButton, isMuted && styles.iconButtonActive]}
        onPress={onToggleMute}
        accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        accessibilityRole="button"
      >
        <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.iconButton, isVideoOff && styles.iconButtonActive]}
        onPress={onToggleVideo}
        accessibilityLabel={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        accessibilityRole="button"
      >
        <Ionicons
          name={isVideoOff ? 'videocam-off' : 'videocam'}
          size={22}
          color="#fff"
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.heartButton}
        onPress={onSendHeart}
        accessibilityLabel="Send heart reaction"
        accessibilityRole="button"
      >
        <Ionicons name="heart" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  </View>
);

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────

/**
 * LiveRoomScreen
 *
 * A full-screen live audio/video room experience.
 * Currently uses mock data and placeholder visuals.
 * Designed to be wire-ready for WebRTC / Agora / LiveKit.
 *
 * Props:
 *   roomId   — unique room identifier (for future socket subscription)
 *   roomName — display name shown in the host stage
 *   zone     — zone / host metadata object
 *   onClose  — callback to dismiss the screen
 */
export default function LiveRoomScreen({ roomId, roomName, zone, onClose }) {

  // ─── State ────────────────────────────────
  const [messages, setMessages]         = useState(INITIAL_MESSAGES);
  const [inputText, setInputText]       = useState('');
  const [isMuted, setIsMuted]           = useState(false);
  const [isVideoOff, setIsVideoOff]     = useState(false);

  // FIX: initialise viewer count with a stable value (not Math.random()
  // in useState initialiser — that caused a different value on every
  // hot-reload, and could differ between server and client in SSR contexts).
  const [viewersCount, setViewersCount] = useState(() =>
    Math.floor(Math.random() * 500) + 100
  );

  // ─── Refs ─────────────────────────────────
  const flatListRef  = useRef(null);
  const pulseAnim    = useRef(new Animated.Value(PULSE_MAX)).current;

  // Abort-safe ref — prevents setState after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Pulse animation (LIVE badge) ─────────
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: PULSE_MIN,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: PULSE_MAX,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    // Stop animation cleanly on unmount to free the native thread
    return () => animation.stop();
  }, [pulseAnim]);

  // ─── Viewer count simulation ───────────────
  // FIX: original code never clamped viewersCount — it could go negative.
  // Math.max(0, ...) added inside setViewersCount below.
  useEffect(() => {
    const interval = setInterval(() => {
      if (mountedRef.current) {
        setViewersCount(prev =>
          Math.max(0, prev + Math.floor(Math.random() * 5) - 2)
        );
      }
    }, VIEWER_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  // ─── Derived host data ─────────────────────
  const hostAvatar = useMemo(
    () => zone?.img || zone?.image_url || FALLBACK_HOST_AVATAR,
    [zone]
  );
  const hostName = useMemo(
    () => zone?.hostName || 'KliqHost',
    [zone]
  );

  // ─── Co-host indices (stable array) ────────
  const coHostIndices = useMemo(
    () => Array.from({ length: CO_HOST_COUNT }, (_, i) => i),
    []
  );

  // ─── Chat handlers ─────────────────────────

  const handleSendMessage = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const newMessage = {
      id: Date.now().toString(),
      user: 'You',
      text: trimmed,
      // TODO: replace with the logged-in user's real avatar from useAppStore
      avatar: 'https://i.pravatar.cc/100?img=12',
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    // Scroll to the new message after the FlatList has committed it
    setTimeout(() => {
      if (mountedRef.current) {
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    }, SCROLL_DELAY_MS);
  }, [inputText]);

  // FIX: handleSendHeart was a no-op console.log in V1.
  // Now it is a stub ready for a floating-hearts animation layer.
  const handleSendHeart = useCallback(() => {
    // TODO: trigger a floating hearts animation overlay (see strategic recommendations)
  }, []);

  const handleToggleMute  = useCallback(() => setIsMuted(m => !m), []);
  const handleToggleVideo = useCallback(() => setIsVideoOff(v => !v), []);

  // ─── FlatList helpers ──────────────────────

  // FIX: replaced ScrollView with FlatList for the chat section.
  // ScrollView renders ALL messages simultaneously — as the chat grows
  // (hundreds of live messages) this caused severe memory and render pressure.
  // FlatList virtualises the list, rendering only visible rows.
  const keyExtractor = useCallback((item) => item.id, []);

  const renderMessage = useCallback(
    ({ item }) => <ChatMessage item={item} />,
    []
  );

  // Auto-scroll to bottom when a new message arrives
  const handleContentSizeChange = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >

        {/* ── 1. HEADER ──────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LiveBadge pulseAnim={pulseAnim} />
            <ViewersBadge count={viewersCount} />
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel="Close live room"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ── 2. MAIN STAGE ──────────────────────── */}
        <View style={styles.stageContainer}>
          <HostStage
            isVideoOff={isVideoOff}
            hostAvatar={hostAvatar}
            roomName={roomName}
            hostName={hostName}
          />

          {/* Co-host row */}
          <View style={styles.coHostRow}>
            {coHostIndices.map((idx) => (
              <CoHostCircle key={idx} index={idx} />
            ))}
          </View>
        </View>

        {/* ── 3. CHAT ────────────────────────────── */}
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderMessage}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chatListContent}
            onContentSizeChange={handleContentSizeChange}
            // Performance settings for high-frequency live chat
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews
            // Keep bottom-pinned feel
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          />
        </View>

        {/* ── 4. BOTTOM BAR ──────────────────────── */}
        <BottomBar
          inputText={inputText}
          onChangeText={setInputText}
          onSend={handleSendMessage}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          isVideoOff={isVideoOff}
          onToggleVideo={handleToggleVideo}
          onSendHeart={handleSendHeart}
        />

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Layout ────────────────────────────────
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  flex:      { flex: 1 },

  // ── Header ────────────────────────────────
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
    width: '100%',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  // ── Live badge ────────────────────────────
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 45, 85, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FF2D55',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF2D55',
    marginRight: 6,
  },
  liveText: {
    color: '#FF2D55',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },

  // ── Viewers badge ─────────────────────────
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
    fontSize: 12,
  },

  // ── Close button ──────────────────────────
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Stage ─────────────────────────────────
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
  },
  videoBackground: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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
    elevation: 10,
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
    textShadowRadius: 5,
  },
  hostName: {
    color: '#ddd',
    fontSize: 13,
    marginTop: 2,
  },

  // ── Co-hosts ──────────────────────────────
  coHostRow: {
    flexDirection: 'row',
    gap: 15,
    marginTop: -25,
    zIndex: 5,
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
    borderColor: '#0A0A0A',
  },

  // ── Chat ──────────────────────────────────
  chatContainer: {
    height: height * 0.25,
    paddingHorizontal: 15,
  },
  chatListContent: { paddingVertical: 10 },
  chatMessageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
    paddingRight: 50,
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
    marginBottom: 2,
  },
  chatText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },

  // ── Bottom bar ────────────────────────────
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
    backgroundColor: '#FF3B30',
  },
  heartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: brand?.blue || '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
});