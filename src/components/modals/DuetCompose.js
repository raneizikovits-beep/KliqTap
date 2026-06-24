// DuetCompose.js — Production v4.0
// ✅ v3.0 base preserved (numeric layout heights, clean sync engine, layout modes)
// 🆕 v4.0 #1 — Audio FX: Echo / Reverb / Concert Hall / Harmony / Pitch on the take
// 🆕 v4.0 #2 — Co-Singer: invite a friend to a real-time WebRTC duet
// 🆕 v4.0 #3 — Publish to Feed (→ Profile) or Pulse, with a caption
// 🆕 v4.0 #4 — Web (Chrome) support: iframe fallback for the YouTube source
// 🐛 Fixes  — mode="video" recording, stable WebView source, square bottom corners,
//             translucent record button, full-bleed camera
//
// PROPS (all optional except onClose):
//   sheet        → { trend }
//   onClose      → close the sheet
//   supabase     → your Supabase client (required for live Co-Singer)
//   currentUser  → { id, name } (optional)

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TextInput,
  Animated, ActivityIndicator, Dimensions, Easing, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, Camera } from 'expo-camera';
import { WebView } from 'react-native-webview';
import { Video } from 'expo-av';

import { useAudioFX } from './useAudioFX';
import { useCoSinger } from './useCoSinger';
import * as api from '../../store/api';   // 👈 your existing API wrapper (auth + FormData)
import { trackEvent } from '../../utils/analytics'; // 👈 הייבוא החדש שלנו


const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────
// 🔧 v4.0 — stable source object (module-level) so FX/layout re-renders never reload it
const DUET_SOURCE = { uri: 'https://m.youtube.com/results?search_query=trending+shorts+duet+challenge' };
// 🔧 v4.0 — react-native-webview can't render on web; use a YouTube embed iframe there
// 🔧 v4.0.8 — YouTube killed listType=search embeds (404/410 since Nov 2020),
// which is why Chrome showed "WebView does not support this platform" / blank.
// A PLAYLIST embed still works. Swap the ID for any playlist you like.
const DUET_PLAYLIST_ID = 'PLirAqAtl_h2r5g8xGajEwdXd3x1sZh8hC';
const DUET_WEB_SRC = `https://www.youtube.com/embed/videoseries?list=${DUET_PLAYLIST_ID}&autoplay=1&rel=0`;

const formatTime = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const PANEL_H = SCREEN_HEIGHT * 0.87 - 160;

const LAYOUT_MODES = [
  // 🔧 v4.0.9 — camera (YOU) is now the dominant half, like a real duet app.
  { key: 'split',   sourceH: Math.floor(PANEL_H * 0.40), label: '40/60',    icon: 'git-compare-outline' },
  { key: 'compact', sourceH: Math.floor(PANEL_H * 0.24), label: 'Focus Me', icon: 'person-outline'      },
  { key: 'study',   sourceH: Math.floor(PANEL_H * 0.62), label: 'Study',    icon: 'eye-outline'         },
];

const INTENSITY_STOPS = [
  { label: 'LOW', value: 0.35 },
  { label: 'MED', value: 0.6  },
  { label: 'MAX', value: 0.9  },
];

const SYNC_EVENTS = [
  { text: 'PERFECT SYNC 🎯', color: '#FF006E' },
  { text: 'IN THE ZONE 🔥',  color: '#FF9F1C' },
  { text: 'VIBE LOCKED 💜',  color: '#B14EFF' },
  { text: 'MIRROR MODE ✨',   color: '#00F5D4' },
  { text: 'RHYTHM MATCH 🎵', color: '#3A86FF' },
];

const getRating = (peak) => {
  if (peak >= 85) return { text: 'PERFECT DUET 🏆', color: '#FFD700' };
  if (peak >= 65) return { text: 'GREAT SYNC 🔥',   color: '#00F5D4' };
  return               { text: 'NICE TRY! 💪',      color: '#FF006E' };
};

// 🆕 v4.0 — memoized YouTube stage; renders ONCE so FX/layout taps never reload it.
// Accepts a height so the layout modes (50/50, Focus, Study) still work.
const DuetStage = React.memo(function DuetStage({ height }) {
  return (
    <View style={[styles.sourceSegment, { height }]}>
      {Platform.OS === 'web'
        ? React.createElement('iframe', {
            src: DUET_WEB_SRC,
            style: { width: '100%', height: '100%', border: 0 },
            allow: 'autoplay; encrypted-media; fullscreen',
            allowFullScreen: true,
            title: 'Duet source',
          })
        : (
          <WebView
            source={DUET_SOURCE}
            style={{ flex: 1 }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
          />
        )}
      <View style={styles.segLabel}><Text style={styles.segLabelText}>ORIGINAL</Text></View>
    </View>
  );
});

// 🆕 lazy RTCView wrappers so SOLO mode never touches react-native-webrtc native.
const RemoteVideo = ({ stream, style }) => {
  const { RTCView } = require('react-native-webrtc');
  return <RTCView streamURL={stream.toURL()} style={style} objectFit="cover" />;
};
const LocalVideo = ({ stream, style }) => {
  const { RTCView } = require('react-native-webrtc');
  return <RTCView streamURL={stream.toURL()} style={style} objectFit="cover" mirror />;
};

// 🆕 FX preset chips + intensity (shared visual language with KaraokeRoom)
const FXPanel = ({ presets, selected, onSelect, intensity, onIntensity }) => (
  <View style={styles.fxPanel}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fxRow}>
      {presets.map((p) => {
        const active = p.key === selected;
        return (
          <TouchableOpacity
            key={p.key}
            onPress={() => onSelect(p.key)}
            activeOpacity={0.8}
            style={[styles.fxChip, active && { borderColor: p.color, backgroundColor: `${p.color}22` }]}
          >
            <Ionicons name={p.icon} size={14} color={active ? p.color : '#9A9AA8'} />
            <Text style={[styles.fxChipText, active && { color: p.color }]}>{p.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
    {selected !== 'dry' && (
      <View style={styles.intensityRow}>
        {INTENSITY_STOPS.map((s) => {
          const on = Math.abs(s.value - intensity) < 0.02;
          return (
            <TouchableOpacity key={s.label} onPress={() => onIntensity(s.value)} style={[styles.intChip, on && styles.intChipOn]}>
              <Text style={[styles.intText, on && styles.intTextOn]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    )}
  </View>
);

// ─── Component ────────────────────────────────────────────────────────────────
export const DuetCompose = ({ sheet, onClose, isDark, supabase, currentUser }) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [hasAudio,      setHasAudio]      = useState(null);
  const [isRecording,   setIsRecording]   = useState(false);
  const [recordedDuet,  setRecordedDuet]  = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [layoutIdx,     setLayoutIdx]     = useState(0);
  const [syncScore,     setSyncScore]     = useState(0);
  const [syncPeak,      setSyncPeak]      = useState(0);
  const [syncEvent,     setSyncEvent]     = useState(null);

  // 🆕 v4.0 state
  const [selectedFX,  setSelectedFX]  = useState('dry');
  const [fxIntensity, setFxIntensity] = useState(0.6);
  const [mode,        setMode]        = useState('solo'); // 'solo' | 'duet'
  const [joinCode,    setJoinCode]    = useState('');
  const [caption,     setCaption]     = useState('');
  const [publishTo,   setPublishTo]   = useState('feed'); // 'feed' | 'pulse'
  const [posting,     setPosting]     = useState(false);

  const { FX_PRESETS, processRecording, processing } = useAudioFX();
  const co = useCoSinger(supabase);

  const cameraRef   = useRef(null);
  const timerRef    = useRef(null);
  const syncPeakRef = useRef(0);
  const rawDuetRef  = useRef(null); // raw recording before FX (so we can re-apply)

  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const scoreAnim   = useRef(new Animated.Value(1)).current;
  const eventAnim   = useRef(new Animated.Value(0)).current;
  const headerAnim  = useRef(new Animated.Value(0)).current;
  const layoutAnim  = useRef(new Animated.Value(1)).current;
  const syncBarAnim = useRef(new Animated.Value(0)).current;

  const trend     = sheet?.trend || '#DuetChallenge';
  const layout    = LAYOUT_MODES[layoutIdx];
  const duetLive  = mode === 'duet' && co.status === 'live';
  const duetSetup = mode === 'duet' && co.status !== 'live';

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    (async () => {
      const cam   = await Camera.requestCameraPermissionsAsync();
      const audio = await Camera.requestMicrophonePermissionsAsync();
      setHasPermission(cam.status === 'granted');
      setHasAudio(audio.status === 'granted');
    })();
  }, []);

  // ── Recording engine ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) {
      pulseAnim.setValue(1);
      clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.22, duration: 550, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 550, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    const scoreInterval = setInterval(() => {
      const delta = Math.floor(Math.random() * 18) - 3;
      const next  = Math.min(100, Math.max(30, (syncPeakRef.current || 50) + delta));
      if (next > syncPeakRef.current) syncPeakRef.current = next;
      setSyncPeak(syncPeakRef.current);
      setSyncScore(next);
      Animated.timing(syncBarAnim, { toValue: next / 100, duration: 400, useNativeDriver: false }).start();
      Animated.sequence([
        Animated.timing(scoreAnim, { toValue: 1.25, duration: 100, useNativeDriver: true }),
        Animated.timing(scoreAnim, { toValue: 1,    duration: 150, useNativeDriver: true }),
      ]).start();
    }, 900);

    const eventInterval = setInterval(() => {
      const ev = SYNC_EVENTS[Math.floor(Math.random() * SYNC_EVENTS.length)];
      setSyncEvent(ev);
      eventAnim.setValue(0);
      Animated.sequence([
        Animated.spring(eventAnim, { toValue: 1, useNativeDriver: true, tension: 180, friction: 6 }),
        Animated.delay(1000),
        Animated.timing(eventAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setSyncEvent(null));
    }, 3200);

    return () => {
      pulseLoop.stop();
      clearInterval(timerRef.current);
      clearInterval(scoreInterval);
      clearInterval(eventInterval);
    };
  }, [isRecording]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;
    syncPeakRef.current = 50;
    setIsRecording(true);
    setRecordingTime(0);
    setSyncScore(50);
    setSyncPeak(50);
    try {
      const data = await cameraRef.current.recordAsync({ maxDuration: 60 });
      if (data?.uri) {
        rawDuetRef.current = data.uri;                                       // keep raw
        const fxUri = await processRecording(data.uri, selectedFX, fxIntensity); // bake FX
        setRecordedDuet(fxUri);
      }
    } catch (e) { console.error('[DuetCompose] record error:', e); }
    setIsRecording(false);
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording && recordingTime >= 1) cameraRef.current.stopRecording();
  };

  const handleRetake = () => {
    setRecordedDuet(null);
    rawDuetRef.current = null;
    setRecordingTime(0);
    setSyncScore(0);
    setSyncPeak(0);
    syncPeakRef.current = 0;
  };

  // 🆕 re-apply a different FX on the results screen, from the raw take
  const reapplyFX = async (key, intensity = fxIntensity) => {
    setSelectedFX(key);
    if (!rawDuetRef.current) return;
    const fxUri = await processRecording(rawDuetRef.current, key, intensity);
    setRecordedDuet(fxUri);
  };

  const cycleLayout = () => {
    Animated.sequence([
      Animated.timing(layoutAnim, { toValue: 0.92, duration: 100, useNativeDriver: true }),
      Animated.spring(layoutAnim,  { toValue: 1,    useNativeDriver: true, tension: 300 }),
    ]).start();
    setLayoutIdx((layoutIdx + 1) % LAYOUT_MODES.length);
  };

  // 🆕 duet mode toggles
  const enterDuet = () => setMode('duet');
  const exitDuet  = () => { co.leave(); setMode('solo'); };

  // 🆕 publish: FEED → POST /posts ; PULSE → POST /pulse (both field "image")
  const publishDuet = async () => {
    if (!recordedDuet || posting) return;
    const isPulse  = publishTo === 'pulse';
    const endpoint = isPulse ? '/pulse' : '/posts';
    const text     = caption?.trim() || `🎬 Duet — ${syncPeak}% sync`;

    setPosting(true);
    try {
      const form = new FormData();
      form.append('image', { uri: recordedDuet, name: 'duet.mp4', type: 'video/mp4' });
      form.append('text', text);
      if (isPulse) form.append('vibe', 'Happy');

      await api.fetchAPI(endpoint, { method: 'POST', body: form });
      trackEvent('duet_published', { target: publishTo, syncScore: syncPeak }); // 👈 הדיווח

      Alert.alert(
        'Posted! 🎉',
        isPulse ? 'Your duet is live as a Pulse for 24 hours.' : 'Your duet is live on your Feed and Profile.',
      );
      onClose?.();
    } catch (e) {
      console.error('[DuetCompose] publish error:', e?.message || e);
      Alert.alert('Upload failed', 'Could not post your duet. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const syncBarWidth = syncBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const syncBarColor = syncScore >= 80 ? '#00F5D4' : syncScore >= 55 ? '#FF9F1C' : '#FF006E';

  // ── Permission states ──────────────────────────────────────────────────────
  if (hasPermission === null || hasAudio === null) return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator size="large" color="#FF006E" />
      <Text style={styles.loadingText}>Setting up duet studio...</Text>
    </View>
  );
  if (!hasPermission || !hasAudio) return (
    <View style={styles.loadingScreen}>
      <Ionicons name="mic-off-outline" size={48} color="#444" />
      <Text style={styles.permText}>Camera & microphone required</Text>
    </View>
  );

  // ── Preview / Results Screen ────────────────────────────────────────────────
  if (recordedDuet) {
    const rating = getRating(syncPeak);
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1 }}>
          <Animated.View style={[styles.header, { opacity: headerAnim }]}>
            <TouchableOpacity onPress={handleRetake} style={styles.iconBtn}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.gradeBadge, { color: rating.color }]}>{rating.text}</Text>
            <View style={{ width: 44 }} />
          </Animated.View>

          <View style={styles.previewVideoWrap}>
            <Video source={{ uri: recordedDuet }} style={StyleSheet.absoluteFill} resizeMode="cover" shouldPlay isLooping />
            <View style={[styles.syncOverlay, { borderColor: `${rating.color}44` }]}>
              <Text style={styles.syncOverlayLabel}>PEAK SYNC</Text>
              <Text style={[styles.syncOverlayValue, { color: rating.color }]}>{syncPeak}%</Text>
            </View>
            {processing && (
              <View style={styles.fxProcessing}>
                <ActivityIndicator color="#FF006E" />
                <Text style={styles.fxProcessingText}>APPLYING FX…</Text>
              </View>
            )}
          </View>

          {/* 🆕 swap the effect on your take without re-recording */}
          <FXPanel
            presets={FX_PRESETS}
            selected={selectedFX}
            onSelect={(k) => reapplyFX(k)}
            intensity={fxIntensity}
            onIntensity={(v) => { setFxIntensity(v); reapplyFX(selectedFX, v); }}
          />

          {/* 🆕 caption */}
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Say something about your duet…"
            placeholderTextColor="#666"
            style={styles.captionInput}
            maxLength={200}
            multiline
          />

          {/* 🆕 publish target */}
          <View style={styles.targetRow}>
            <TouchableOpacity style={[styles.targetChip, publishTo === 'feed' && styles.targetChipOn]} onPress={() => setPublishTo('feed')}>
              <Ionicons name="newspaper-outline" size={15} color={publishTo === 'feed' ? '#fff' : '#9A9AA8'} />
              <Text style={[styles.targetText, publishTo === 'feed' && styles.targetTextOn]}>Feed</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.targetChip, publishTo === 'pulse' && styles.targetChipOn]} onPress={() => setPublishTo('pulse')}>
              <Ionicons name="flash-outline" size={15} color={publishTo === 'pulse' ? '#fff' : '#9A9AA8'} />
              <Text style={[styles.targetText, publishTo === 'pulse' && styles.targetTextOn]}>Pulse</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.previewFooter}>
            <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} disabled={posting}>
              <Ionicons name="refresh" size={22} color="#fff" />
              <Text style={styles.btnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.postBtn, { backgroundColor: rating.color }, posting && { opacity: 0.7 }]}
              onPress={publishDuet}
              disabled={posting}
            >
              {posting ? (
                <ActivityIndicator color={rating.color === '#FFD700' ? '#000' : '#fff'} />
              ) : (
                <>
                  <Text style={[styles.postBtnText, { color: rating.color === '#FFD700' ? '#000' : '#fff' }]}>Post Duet</Text>
                  <Ionicons name="rocket" size={18} color={rating.color === '#FFD700' ? '#000' : '#fff'} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Recording Screen ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerAnim }]}>
          <TouchableOpacity onPress={mode === 'duet' ? exitDuet : onClose} style={styles.iconBtn}>
            <Ionicons name={mode === 'duet' ? 'arrow-back' : 'close'} size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.trendPill}>
            <Ionicons name="film-outline" size={14} color="#FF006E" style={{ marginRight: 5 }} />
            <Text style={styles.trendText}>{trend}</Text>
          </View>
          {isRecording
            ? <View style={styles.recBadge}><View style={styles.recDot} /><Text style={styles.recTime}>{formatTime(recordingTime)}</Text></View>
            : (mode === 'solo'
                ? <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={enterDuet} style={styles.headerDuetBtn}>
                      <Ionicons name="people" size={18} color="#FF006E" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={cycleLayout} style={styles.layoutBtn}>
                      <Ionicons name={layout.icon} size={15} color="#fff" />
                      <Text style={styles.layoutBtnText}>{layout.label}</Text>
                    </TouchableOpacity>
                  </View>
                : <View style={{ width: 44 }} />)
          }
        </Animated.View>

        {/* Split screen */}
        <Animated.View style={[styles.splitWrap, { transform: [{ scale: layoutAnim }] }]}>
          {/* Source (YouTube) — memoized + stable, web-safe */}
          <DuetStage height={layout.sourceH} />

          {/* Divider */}
          <View style={styles.splitDivider}>
            <View style={styles.divLine} />
            <View style={styles.divPill}><Text style={styles.divText}>DUET</Text></View>
            <View style={styles.divLine} />
          </View>

          {/* Bottom segment: SOLO camera OR live duet split */}
          <View style={styles.cameraSegment}>
            {mode === 'solo' && (
              <CameraView style={StyleSheet.absoluteFill} facing="front" mode="video" ref={cameraRef} />
            )}

            {duetLive && (
              <View style={styles.duetSplit}>
                {co.remoteStream
                  ? <RemoteVideo stream={co.remoteStream} style={styles.duetHalf} />
                  : <View style={[styles.duetHalf, styles.duetWaiting]}><ActivityIndicator color="#FF006E" /></View>}
                {co.localStream && <LocalVideo stream={co.localStream} style={styles.duetHalf} />}
                <View style={styles.liveBadge}><View style={styles.recDot} /><Text style={styles.recTime}>LIVE DUET</Text></View>
              </View>
            )}

            {duetSetup && (
              <View style={styles.lobby}>
                <Ionicons name="people-circle-outline" size={40} color="#FF006E" />
                <Text style={styles.lobbyTitle}>Duet with a friend, live</Text>

                {!supabase && <Text style={styles.lobbyHint}>Pass a `supabase` prop to enable Co-Singer.</Text>}

                {co.status === 'idle' && supabase && (
                  <>
                    <TouchableOpacity style={styles.lobbyBtnPrimary} onPress={co.createRoom}>
                      <Ionicons name="add" size={18} color="#fff" />
                      <Text style={styles.lobbyBtnText}>Host a room</Text>
                    </TouchableOpacity>
                    <View style={styles.joinRow}>
                      <TextInput
                        value={joinCode}
                        onChangeText={(t) => setJoinCode(t.toUpperCase())}
                        placeholder="CODE"
                        placeholderTextColor="#555"
                        autoCapitalize="characters"
                        maxLength={5}
                        style={styles.joinInput}
                      />
                      <TouchableOpacity
                        style={[styles.lobbyBtnGhost, !joinCode && { opacity: 0.4 }]}
                        disabled={!joinCode}
                        onPress={() => co.joinRoom(joinCode)}
                      >
                        <Text style={styles.lobbyBtnText}>Join</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.lobbyHint}>Share the code with anyone — inside or outside the app.</Text>
                  </>
                )}

                {co.status === 'hosting' && (
                  <View style={styles.codeBox}>
                    <Text style={styles.codeLabel}>SHARE THIS CODE</Text>
                    <Text style={styles.codeValue}>{co.roomCode}</Text>
                    <View style={styles.waitRow}>
                      <ActivityIndicator color="#FF006E" size="small" />
                      <Text style={styles.lobbyHint}>Waiting for your partner…</Text>
                    </View>
                  </View>
                )}

                {(co.status === 'joining' || co.status === 'connecting') && (
                  <View style={styles.waitRow}>
                    <ActivityIndicator color="#FF006E" size="small" />
                    <Text style={styles.lobbyHint}>{co.status === 'joining' ? 'Joining room…' : 'Connecting…'}</Text>
                  </View>
                )}

                {co.status === 'error' && (
                  <Text style={[styles.lobbyHint, { color: '#FF006E' }]}>{co.error || 'Connection error'}</Text>
                )}
              </View>
            )}

            {mode === 'solo' && <View style={styles.segLabel}><Text style={styles.segLabelText}>YOU</Text></View>}

            {/* Sync HUD — compact transparent pill, top-right, clear of the face */}
            {isRecording && mode === 'solo' && (
              <View style={styles.syncPill} pointerEvents="none">
                <Text style={styles.syncPillLabel}>SYNC</Text>
                <View style={styles.syncPillBarBg}>
                  <Animated.View style={[styles.syncBarFill, { width: syncBarWidth, backgroundColor: syncBarColor }]} />
                </View>
                <Animated.Text style={[styles.syncPillValue, { color: syncBarColor, transform: [{ scale: scoreAnim }] }]}>
                  {syncScore}%
                </Animated.Text>
              </View>
            )}

            {/* Sync-event toast floats separately near the top */}
            {isRecording && mode === 'solo' && syncEvent && (
              <Animated.Text
                pointerEvents="none"
                style={[styles.syncEventFloat, {
                  color: syncEvent.color,
                  opacity: eventAnim,
                  transform: [{ scale: eventAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
                }]}
              >
                {syncEvent.text}
              </Animated.Text>
            )}

            {/* 🆕 v4.0.9 — controls overlay ON the camera (UI only — NOT recorded).
                recordAsync captures the camera feed, not the RN view tree, so these
                buttons never appear in the saved duet even while on top of you. */}
            {mode === 'solo' && (
              <>
                <View style={styles.bottomScrim} pointerEvents="none" />

                {!isRecording && (
                  <View style={styles.fxOverlay}>
                    <FXPanel
                      presets={FX_PRESETS}
                      selected={selectedFX}
                      onSelect={setSelectedFX}
                      intensity={fxIntensity}
                      onIntensity={setFxIntensity}
                    />
                  </View>
                )}

                <View style={styles.recordDock}>
                  <Animated.View style={[
                    styles.recordRing,
                    { borderColor: isRecording ? '#FF006E' : 'rgba(255,255,255,0.85)', transform: [{ scale: pulseAnim }] },
                  ]}>
                    <TouchableOpacity
                      style={[styles.recordBtn, isRecording && styles.recordingActive]}
                      onPress={isRecording ? stopRecording : startRecording}
                      activeOpacity={0.85}
                    >
                      {isRecording ? <View style={styles.stopSquare} /> : <View style={styles.recordCore} />}
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </>
            )}
          </View>
        </Animated.View>

        {/* Footer — only the live-duet "End" control needs flow layout now */}
        {duetLive && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.leaveBtn} onPress={exitDuet} activeOpacity={0.85}>
              <Ionicons name="exit-outline" size={20} color="#fff" />
              <Text style={styles.btnText}>End Duet</Text>
            </TouchableOpacity>
          </View>
        )}

      </SafeAreaView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // 🔧 v4.0 — flex height + square bottom corners (full-bleed friendly)
  container: { flex: 1, minHeight: SCREEN_HEIGHT * 0.7, width: '100%', backgroundColor: '#050507', overflow: 'hidden', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderWidth: 1, borderColor: '#181A22' },
  loadingScreen: { flex: 1, minHeight: SCREEN_HEIGHT * 0.7, width: '100%', backgroundColor: '#050507', justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadingText: { color: '#FF006E', fontSize: 13, fontWeight: '600', letterSpacing: 0.8 },
  permText: { color: '#444', fontSize: 15, marginTop: 12, textAlign: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  trendPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,0,110,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,0,110,0.4)' },
  trendText: { color: '#FF006E', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  recBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,0,80,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#FF0050', gap: 5 },
  recDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF0050' },
  recTime: { color: '#fff', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  layoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, gap: 5 },
  layoutBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  headerDuetBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,0,110,0.12)', borderWidth: 1, borderColor: 'rgba(255,0,110,0.35)' },

  splitWrap: { flex: 1, marginHorizontal: 0, borderRadius: 0, overflow: 'hidden', backgroundColor: '#0C0C0F' },
  sourceSegment: { width: '100%', backgroundColor: '#000', position: 'relative' },
  cameraSegment: { flex: 1, position: 'relative', backgroundColor: '#0A0A0E', minHeight: 80 },
  splitDivider: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0C0C0F' },
  divLine: { flex: 1, height: 2, backgroundColor: '#FF006E', opacity: 0.7 },
  divPill: { backgroundColor: '#FF006E', paddingHorizontal: 10, paddingVertical: 3, marginHorizontal: 8, borderRadius: 8 },
  divText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 2 },

  segLabel: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, zIndex: 5 },
  segLabelText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },

  // 🆕 duet split + lobby
  duetSplit: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  duetHalf: { flex: 1, height: '100%', backgroundColor: '#000' },
  duetWaiting: { justifyContent: 'center', alignItems: 'center' },
  liveBadge: { position: 'absolute', top: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#FF006E' },
  lobby: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 22 },
  lobbyTitle: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  lobbyHint: { color: '#777', fontSize: 12, textAlign: 'center' },
  lobbyBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF006E', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 22 },
  lobbyBtnGhost: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#252730' },
  lobbyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  joinInput: { width: 110, color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 4, textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#252730' },
  codeBox: { alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,0,110,0.08)', paddingHorizontal: 30, paddingVertical: 18, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,0,110,0.3)' },
  codeLabel: { color: '#FF006E', fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  codeValue: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: 8 },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },

  syncHUD: { position: 'absolute', bottom: 12, alignSelf: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.42)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,0,110,0.3)', minWidth: 140 },
  syncHUDLabel: { color: '#FF006E', fontSize: 8, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
  syncHUDValue: { fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'], lineHeight: 34 },
  syncBarBg: { width: 120, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  syncBarFill: { height: '100%', borderRadius: 2 },
  syncEvent: { fontSize: 12, fontWeight: '900', marginTop: 6, letterSpacing: 0.5 },
  // 🆕 v4.0.9 — compact transparent sync pill (top-right) + floating event toast
  syncPill: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.32)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  syncPillLabel: { color: 'rgba(255,0,110,0.95)', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  syncPillBarBg: { width: 54, height: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 3, overflow: 'hidden' },
  syncPillValue: { fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'], minWidth: 40, textAlign: 'right' },
  syncEventFloat: { position: 'absolute', top: 46, right: 12, fontSize: 13, fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  // 🆕 v4.0.9 — bottom wash + docked controls over the camera
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 200, backgroundColor: 'rgba(5,5,7,0.45)' },
  fxOverlay: { position: 'absolute', left: 0, right: 0, bottom: 108 },
  recordDock: { position: 'absolute', left: 0, right: 0, bottom: 20, alignItems: 'center' },

  // 🆕 FX panel
  fxPanel: { paddingTop: 8, paddingBottom: 2 },
  fxRow: { paddingHorizontal: 12, gap: 8 },
  fxChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#252730', backgroundColor: 'rgba(255,255,255,0.04)' },
  fxChipText: { color: '#9A9AA8', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  intensityRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  intChip: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  intChipOn: { backgroundColor: 'rgba(255,0,110,0.2)', borderWidth: 1, borderColor: '#FF006E' },
  intText: { color: '#777', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  intTextOn: { color: '#FF006E' },
  fxProcessing: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.55)' },
  fxProcessingText: { color: '#FF006E', fontSize: 11, fontWeight: '900', letterSpacing: 2 },

  footer: { paddingVertical: 16, alignItems: 'center', gap: 8 },
  recordRing: { width: 86, height: 86, borderRadius: 43, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  // 🔧 v4.0.9 — barely-there fill; white ring marks the button, you stay visible
  recordBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,0,110,0.12)', borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center' },
  recordCore: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.85)' },
  recordingActive: { borderRadius: 18, backgroundColor: 'rgba(255,0,80,0.15)', borderColor: '#FF0050' },
  stopSquare: { width: 22, height: 22, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 4 },
  recordHint: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  leaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FF0050', paddingHorizontal: 26, paddingVertical: 13, borderRadius: 22 },

  previewVideoWrap: { flex: 1, marginHorizontal: 12, borderRadius: 22, overflow: 'hidden', backgroundColor: '#111', position: 'relative' },
  syncOverlay: { position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.78)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  syncOverlayLabel: { color: '#888', fontSize: 8, fontWeight: '900', letterSpacing: 2 },
  syncOverlayValue: { fontSize: 26, fontWeight: '900' },
  gradeBadge: { fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },

  // 🆕 caption + target
  captionInput: { color: '#fff', fontSize: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, marginHorizontal: 18, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10, minHeight: 44, maxHeight: 90, borderWidth: 1, borderColor: '#252730' },
  targetRow: { flexDirection: 'row', gap: 10, marginHorizontal: 18, marginTop: 10 },
  targetChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#252730' },
  targetChipOn: { backgroundColor: 'rgba(255,0,110,0.22)', borderColor: '#FF006E' },
  targetText: { color: '#9A9AA8', fontSize: 13, fontWeight: '800' },
  targetTextOn: { color: '#fff' },

  previewFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, gap: 10 },
  retakeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 14, borderRadius: 22, gap: 8, borderWidth: 1, borderColor: '#252730' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  postBtn: { flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 22, gap: 8 },
  postBtnText: { fontSize: 15, fontWeight: '900' },
});