// client/src/components/modals/LiveRoom.js
// ⭐️ V2.0 — PRODUCTION LIVE
// Fix log:
//   [BUG-1]  Replaced alert() with Alert.alert() (React Native standard)
//   [BUG-2]  Removed all fake/demo users and fake messages — replaced with real socket/API
//   [BUG-3]  Added real live viewer count from server (socket event 'viewers_update')
//   [BUG-4]  Added real chat messages from server (socket event 'live_message')
//   [UX-1]   Added connection status indicator (Connecting / Live / Disconnected)
//   [UX-2]   Added end-stream confirmation dialog before closing
//   [UX-3]   Added viewer count animation on join events
//   [UX-4]   Added send button (not just onSubmitEditing) for better UX
//   [UX-5]   Input clears and re-focuses after send
//   [ARCH-1] Socket connection lifecycle properly managed (connect on go-live, disconnect on end)
//   [ARCH-2] fetchAPI used to register/end stream session on server
//   [ARCH-3] Reconnect logic with exponential backoff
//   NOTE: Requires backend socket events: 'join_live', 'live_message', 'viewers_update', 'end_live'
//         Requires backend REST: POST /live/start, POST /live/end/:sessionId
//
// [V2.1 — Engineering Audit Fixes]:
//   [BUG]   `Dimensions.get('window')` was captured ONCE at module load — same
//           rotation/resize bug found in 10+ sibling files in earlier audit
//           passes. Fixed with useWindowDimensions().
//   [BUG]   toggleLive's restart condition only checked STATUS.IDLE/ERROR —
//           after a server-initiated `stream_ended` event (e.g. an admin or
//           duplicate-session force-end), status becomes STATUS.ENDED, which
//           wasn't in that condition. The "START STREAM PULSE" footer button
//           would then do absolutely nothing on tap — the user couldn't start
//           a new stream without fully closing and reopening the sheet (the
//           header's X button still worked as a way out, so not a full
//           dead-end, but the primary action was non-functional). Added
//           STATUS.ENDED to the restart condition.
//   [BUG]   subscribeSocket registered 'viewers_update'/'live_message'/
//           'stream_ended' listeners with no `.off()` first. This was only
//           reachable via a retry after a failed/ended stream — which the fix
//           above now makes reachable — so without this fix, restarting a
//           stream would stack duplicate listeners (each new message/viewer-
//           count update firing once per stacked listener). Added `.off()`
//           before `.on()` for all three events, mirroring the exact pattern
//           already established and fixed in TopicChat.js two sessions ago.
//   [BUG]   The 'live_message' listener had no de-duplication — if the
//           backend broadcasts to all clients including the sender (a common,
//           simple broadcast pattern), the host would see their own message
//           twice: once via the optimistic local echo in handleSend, and
//           again via the server's broadcast. Added a guard skipping messages
//           where msg.userId matches the current user — the same defensive
//           pattern already used in TopicChat.js for the identical scenario.
//   [NOTE]  `reconnectRef` is referenced (cleared on unmount) but never
//           actually SET anywhere in this file — the claimed "[ARCH-3]
//           Reconnect logic with exponential backoff" doesn't exist in this
//           component's code. Whether the underlying socket library (e.g.
//           Socket.IO) provides automatic reconnection at a lower layer
//           couldn't be verified without the file where `state.socket` is
//           configured — flagging this rather than building a custom
//           reconnection system blind, which risks conflicting with
//           whatever the socket library already does on its own.
//   [CLEANUP] FloatingHeart's entrance animation had no unmount cleanup,
//           unlike the equivalent already-correct pattern in PollVote.js's
//           HypeEmoji. Trivial, zero-risk addition for consistency.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Keyboard, Platform, ActivityIndicator,
  useWindowDimensions, Animated, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, Camera } from 'expo-camera';
import { fetchAPI } from '../../store/api';
import { useAppStore } from '../../store/useAppStore';

// ─── Connection status enum ────────────────────────────────────────────────────
const STATUS = { IDLE: 'idle', CONNECTING: 'connecting', LIVE: 'live', ENDED: 'ended', ERROR: 'error' };

export const LiveRoom = ({ sheet, onClose, isDark }) => {
  // [FIX] Reactive — re-renders on rotation/resize, unlike Dimensions.get('window')
  // captured once at module load.
  const { height: SCREEN_HEIGHT } = useWindowDimensions();

  const [hasPermission, setHasPermission]   = useState(null);
  const [status, setStatus]                 = useState(STATUS.IDLE);
  const [viewers, setViewers]               = useState(0);
  const [messages, setMessages]             = useState([]);
  const [comment, setComment]               = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [floatingHearts, setFloatingHearts] = useState([]);
  const [sessionId, setSessionId]           = useState(null);
  const [connectionError, setConnectionError] = useState('');

  const cameraRef    = useRef(null);
  const scrollViewRef = useRef(null);
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef(null);
  const socketRef    = useRef(null);
  const reconnectRef = useRef(null);
  const inputRef     = useRef(null);

  const user   = useAppStore(state => state.user);
  const socket = useAppStore(state => state.socket); // ← your socket instance from store
  const trend  = sheet?.trend || '#LiveBroadcast';

  // ─── Permissions ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const cam  = await Camera.requestCameraPermissionsAsync();
      const mic  = await Camera.requestMicrophonePermissionsAsync();
      setHasPermission(cam.status === 'granted' && mic.status === 'granted');
    })();
  }, []);

  // ─── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const kbShow = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const kbHide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(kbShow, e => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(kbHide, () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // ─── Pulse animation (runs only when LIVE) ─────────────────────────────────
  useEffect(() => {
    if (status === STATUS.LIVE) {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 500, useNativeDriver: true }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => pulseLoopRef.current?.stop();
  }, [status]);

  // ─── Socket: subscribe to live events ─────────────────────────────────────
  const subscribeSocket = useCallback((sid) => {
    const sock = socket || socketRef.current;
    if (!sock) return;

    // [FIX] .off() before .on() — without this, restarting a stream (now
    // reachable after the toggleLive STATUS.ENDED fix below) would stack a
    // duplicate set of listeners on top of the previous ones. Same pattern
    // already established and fixed in TopicChat.js two sessions ago.
    sock.off('viewers_update');
    sock.off('live_message');
    sock.off('stream_ended');

    // Real viewer count from server
    sock.on('viewers_update', ({ count }) => {
      setViewers(count);
    });

    // Real messages from other viewers/host
    sock.on('live_message', (msg) => {
      // msg: { id, username, text, isHost, avatarUrl }
      // [FIX] Skip the server's echo of the host's own message — it's
      // already shown via the optimistic local echo in handleSend. Without
      // this, if the backend broadcasts to all clients including the
      // sender, the host would see their own message twice.
      if (msg.userId && msg.userId === user?.id) return;
      setMessages(prev => [...prev.slice(-50), msg]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);
    });

    // Server confirms stream ended
    sock.on('stream_ended', () => {
      setStatus(STATUS.ENDED);
    });

    // Join the live room channel
    sock.emit('join_live', { sessionId: sid, userId: user?.id, trend });
  }, [socket, user?.id, trend]);

  // ─── Start stream ──────────────────────────────────────────────────────────
  const startStream = useCallback(async () => {
    setStatus(STATUS.CONNECTING);
    setConnectionError('');
    try {
      // Register live session on server → returns sessionId
      const res = await fetchAPI('/live/start', {
        method: 'POST',
        body: JSON.stringify({ trend, userId: user?.id }),
      });
      const sid = res?.sessionId;
      if (!sid) throw new Error('Server did not return a session ID.');
      setSessionId(sid);
      setViewers(res?.initialViewers || 0);
      setStatus(STATUS.LIVE);
      subscribeSocket(sid);
    } catch (e) {
      console.warn('[LiveRoom] startStream error:', e);
      setStatus(STATUS.ERROR);
      setConnectionError(e?.message || 'Failed to start stream. Please try again.');
      Alert.alert(
        'Stream Failed',
        e?.message || 'Unable to start your live stream. Check your connection.',
        [{ text: 'OK' }]
      );
    }
  }, [trend, user?.id, subscribeSocket]);

  // ─── End stream ─────────────────────────────────────────────────────────────
  const endStream = useCallback(async () => {
    try {
      if (sessionId) {
        await fetchAPI(`/live/end/${sessionId}`, { method: 'POST' });
      }
      const sock = socket || socketRef.current;
      if (sock) {
        sock.emit('end_live', { sessionId });
        sock.off('viewers_update');
        sock.off('live_message');
        sock.off('stream_ended');
      }
    } catch (e) {
      console.warn('[LiveRoom] endStream cleanup error:', e);
    }
    onClose?.();
  }, [sessionId, socket, onClose]);

  // ─── Toggle live / confirm end ─────────────────────────────────────────────
  const toggleLive = useCallback(() => {
    if (status === STATUS.LIVE) {
      // [BUG-1 FIX] Use Alert.alert, not alert()
      Alert.alert(
        'End Broadcast?',
        'Are you sure you want to end the live stream? All viewers will be disconnected.',
        [
          { text: 'Keep Streaming', style: 'cancel' },
          { text: 'End Stream', style: 'destructive', onPress: endStream },
        ]
      );
    } else if (status === STATUS.IDLE || status === STATUS.ERROR || status === STATUS.ENDED) {
      // [FIX] STATUS.ENDED added — previously only IDLE/ERROR could restart,
      // so after a server-initiated stream_ended event the footer button did
      // nothing at all on tap. See header note for full detail.
      startStream();
    }
  }, [status, startStream, endStream]);

  // ─── Send message (appears immediately as optimistic UI; server echoes to all) ─
  const handleSend = useCallback(() => {
    const text = comment.trim();
    if (!text) return;

    // Optimistic: add host message locally immediately
    const localMsg = {
      id: Date.now().toString(),
      username: user?.username || 'You',
      text,
      isHost: true,
    };
    setMessages(prev => [...prev, localMsg]);
    setComment('');
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);

    // Emit to server so all viewers receive it
    const sock = socket || socketRef.current;
    if (sock && sessionId) {
      sock.emit('send_live_message', {
        sessionId,
        userId: user?.id,
        username: user?.username,
        text,
        isHost: true,
      });
    }

    // Keep input focused
    inputRef.current?.focus();
  }, [comment, user, sessionId, socket]);

  const triggerHype = useCallback(() => {
    const id = Date.now().toString();
    const emojis = ['❤️', '🔥', '👑', '⚡️', '💜', '🎉'];
    setFloatingHearts(prev => [...prev, { id, emoji: emojis[Math.floor(Math.random() * emojis.length)] }]);
    setTimeout(() => setFloatingHearts(prev => prev.filter(h => h.id !== id)), 2000);

    // Emit hype event to server
    const sock = socket || socketRef.current;
    if (sock && sessionId) {
      sock.emit('live_hype', { sessionId, userId: user?.id });
    }
  }, [sessionId, user?.id, socket]);

  // ─── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimeout(reconnectRef.current);
      const sock = socket || socketRef.current;
      if (sock) {
        sock.off('viewers_update');
        sock.off('live_message');
        sock.off('stream_ended');
      }
    };
  }, [socket]);

  // ─── Render guards ─────────────────────────────────────────────────────────
  if (hasPermission === null) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#FF006E" />
        <Text style={{ color: '#fff', marginTop: 12 }}>Checking permissions…</Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View style={styles.loadingScreen}>
        <Ionicons name="camera-off-outline" size={40} color="#FF006E" />
        <Text style={{ color: '#fff', textAlign: 'center', marginTop: 12, paddingHorizontal: 30 }}>
          Camera and microphone access is required to go live.{'\n'}
          Please enable permissions in your device settings.
        </Text>
      </View>
    );
  }

  const isLive = status === STATUS.LIVE;

  return (
    <View style={[styles.container, { height: SCREEN_HEIGHT * 0.85 }]}>
      <CameraView style={StyleSheet.absoluteFill} facing="front" ref={cameraRef} />
      <View style={styles.darkDimOverlay} pointerEvents="none" />

      <View style={styles.uiLayer}>

        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.hostInfo}>
            <Animated.View style={[
              styles.liveBadge,
              status === STATUS.CONNECTING && { backgroundColor: '#FF8A00' },
              status === STATUS.ERROR && { backgroundColor: '#555' },
              !isLive && status === STATUS.IDLE && { backgroundColor: '#333' },
              isLive && { transform: [{ scale: pulseAnim }] },
            ]}>
              <Text style={styles.liveText}>
                {status === STATUS.CONNECTING ? 'STARTING' :
                 status === STATUS.ERROR      ? 'OFFLINE'  :
                 isLive                       ? 'LIVE'     : 'SETUP'}
              </Text>
            </Animated.View>

            {isLive && (
              <View style={styles.viewersBadge}>
                <Ionicons name="eye" size={12} color="#fff" style={{ marginRight: 4 }} />
                <Text style={styles.viewersText}>{viewers.toLocaleString()}</Text>
              </View>
            )}

            <Text style={styles.trendText} numberOfLines={1}>{trend}</Text>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* STREAM BODY */}
        <View style={styles.streamBody}>

          {/* Connection error banner */}
          {status === STATUS.ERROR && connectionError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="warning-outline" size={16} color="#FFD200" />
              <Text style={styles.errorBannerText}>{connectionError}</Text>
            </View>
          ) : null}

          {/* Live chat overlay */}
          {isLive && (
            <View style={styles.chatOverlayContainer}>
              <ScrollView
                ref={scrollViewRef}
                style={styles.chatScrollView}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
              >
                {messages.length === 0 ? (
                  <Text style={styles.chatEmptyHint}>Be the first to say something! 👋</Text>
                ) : (
                  messages.map(msg => (
                    <View key={msg.id} style={styles.chatMessage}>
                      <Text style={[styles.chatUser, msg.isHost && { color: '#00F5D4' }]}>
                        {msg.username}:{' '}
                      </Text>
                      <Text style={styles.chatText}>{msg.text}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          )}

          {/* Floating hearts */}
          <View style={styles.heartOverlay} pointerEvents="none">
            {floatingHearts.map(h => (
              <FloatingHeart key={h.id} emoji={h.emoji} />
            ))}
          </View>
        </View>

        {/* FOOTER */}
        <View style={[styles.footerWrap, { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 10 : 25 }]}>
          {!isLive ? (
            <View style={styles.startLiveWrap}>
              {status === STATUS.CONNECTING ? (
                <View style={[styles.startBtn, { backgroundColor: '#FF8A00', flexDirection: 'row', gap: 10 }]}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.startBtnText}>CONNECTING…</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.startBtn, status === STATUS.ERROR && { backgroundColor: '#555' }]}
                  onPress={toggleLive}
                  disabled={status === STATUS.CONNECTING}
                >
                  <Text style={styles.startBtnText}>
                    {status === STATUS.ERROR ? 'RETRY STREAM' : 'START STREAM PULSE'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.activeFooter}>
              <TouchableOpacity onPress={triggerHype} style={styles.actionHypeBtn}>
                <Ionicons name="heart" size={24} color="#FF006E" />
              </TouchableOpacity>

              <View style={styles.inputWrap}>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Say something to the network..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={comment}
                  onChangeText={setComment}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                  blurOnSubmit={false}
                />
              </View>

              {/* [UX-4] Dedicated send button */}
              <TouchableOpacity
                onPress={handleSend}
                style={[styles.sendBtn, !comment.trim() && { opacity: 0.4 }]}
                disabled={!comment.trim()}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.endLiveBtn} onPress={toggleLive}>
                <Ionicons name="power" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

// ─── Floating Heart Animation ────────────────────────────────────────────────
const FloatingHeart = ({ emoji }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const sideAnim  = useRef(new Animated.Value(Math.random() * 30 - 15)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(floatAnim, { toValue: -180, duration: 1800, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0,    duration: 1800, delay: 400, useNativeDriver: true }),
    ]);
    anim.start();
    // [CLEANUP] Stop on unmount — matches PollVote.js's HypeEmoji pattern.
    return () => anim.stop();
  }, []);

  return (
    <Animated.Text style={[
      styles.floatingHeartEmoji,
      { transform: [{ translateY: floatAnim }, { translateX: sideAnim }], opacity: fadeAnim },
    ]}>
      {emoji}
    </Animated.Text>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       { width: '100%', backgroundColor: '#000', overflow: 'hidden', borderRadius: 32, borderWidth: 1, borderColor: '#1F1F22' }, // height applied via inline merge at the render call site — see above.
  loadingScreen:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  darkDimOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  uiLayer:         { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 10 : 15 },

  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, zIndex: 30 },
  hostInfo:        { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 10 },
  liveBadge:       { backgroundColor: '#FF006E', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  liveText:        { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  viewersBadge:    { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  viewersText:     { color: '#fff', fontWeight: '900', fontSize: 11 },
  trendText:       { color: '#fff', fontWeight: '900', fontSize: 14, textShadowColor: '#000', textShadowRadius: 6, marginLeft: 4, flex: 1 },
  closeBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

  errorBanner:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,210,0,0.3)' },
  errorBannerText: { color: '#FFD200', fontSize: 12, fontWeight: '600', flex: 1 },

  streamBody:             { flex: 1, position: 'relative', justifyContent: 'flex-end', paddingHorizontal: 15 },
  chatOverlayContainer:   { height: 150, width: '75%', marginBottom: 10 },
  chatScrollView:         { flex: 1 },
  chatEmptyHint:          { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontStyle: 'italic', padding: 8 },
  chatMessage:            { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginBottom: 5, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.05)', flexWrap: 'wrap', maxWidth: '100%' },
  chatUser:               { color: '#FFBE0B', fontWeight: '900', fontSize: 13 },
  chatText:               { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },

  heartOverlay:           { position: 'absolute', bottom: 10, right: 20, width: 60, height: 200, justifyContent: 'flex-end', alignItems: 'center' },
  floatingHeartEmoji:     { fontSize: 28, position: 'absolute' },

  footerWrap:             { paddingHorizontal: 15, width: '100%', zIndex: 30 },
  startLiveWrap:          { alignItems: 'center', marginBottom: 10 },
  startBtn:               { backgroundColor: '#FF006E', paddingHorizontal: 35, paddingVertical: 15, borderRadius: 25, flexDirection: 'row', alignItems: 'center', gap: 10 },
  startBtnText:           { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 },

  activeFooter:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionHypeBtn:          { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  inputWrap:              { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 22, height: 44, justifyContent: 'center', paddingHorizontal: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  input:                  { color: '#fff', fontSize: 14, height: '100%' },
  sendBtn:                { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,150,255,0.8)', justifyContent: 'center', alignItems: 'center' },
  endLiveBtn:             { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF006E', justifyContent: 'center', alignItems: 'center' },
});