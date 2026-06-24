// KaraokeRoom.js — Production v4.0
// ✅ v3.0 base preserved (organic WaveBar, cross-platform mic glow, pitch HUD, results)
// 🆕 v4.0 #1 — Audio FX: pick Echo / Reverb / Concert Hall / Harmony / Pitch, baked
//             onto the recorded cover via useAudioFX (real ffmpeg DSP).
// 🆕 v4.0 #2 — Co-Singer: invite a friend to a real-time WebRTC karaoke duet,
//             signaled over Supabase Realtime via useCoSinger.
//
// NEW PROPS (both optional — solo + FX work without them):
//   supabase    → your initialized Supabase client (required for Co-Singer)
//   currentUser → { id, name } (used for the room display; optional)

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
import * as api from '../../store/api';   // 👈 your existing API wrapper (for publishing)
import { trackEvent } from '../../utils/analytics'; // ⭐️ FIX: was missing — DanceChallenge and DuetCompose both have this

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────
const NUM_BARS = 7;

// 🔧 v4.0.1 — STABLE source: defined once at module level so it is NEVER a "new"
// object on re-render. Tapping an FX chip no longer makes the WebView reload/stop.
const KARAOKE_SOURCE = { uri: 'https://m.youtube.com/results?search_query=karaoke+songs+with+lyrics+on+screen' };
// 🔧 v4.0.3 — react-native-webview does NOT run on the web build (you saw "WebView
// does not support this platform" in desktop Chrome). On web we fall back to a real
// YouTube embed iframe using the official search-list embed mode.
// 🔧 v4.0.8 — YouTube KILLED the search-embed (listType=search returns 404/410
// since Nov 2020), which is why Chrome showed "This video is unavailable".
// A PLAYLIST embed still works perfectly. This is a big public karaoke playlist
// that autoplays through song after song. Swap the ID for any playlist you like.
const KARAOKE_PLAYLIST_ID = 'PLirAqAtl_h2r5g8xGajEwdXd3x1sZh8hC'; // karaoke w/ lyrics
const KARAOKE_WEB_SRC = `https://www.youtube.com/embed/videoseries?list=${KARAOKE_PLAYLIST_ID}&autoplay=1&rel=0`;
// 🔧 v4.0.1 — fixed stage height so showing/hiding the FX panel never resizes the
// WebView (Android pauses HTML5 video whenever the WebView's bounds change).
const STAGE_H = Math.round(SCREEN_HEIGHT * 0.30);

const INTENSITY_STOPS = [
  { label: 'LOW',  value: 0.35 },
  { label: 'MED',  value: 0.6  },
  { label: 'MAX',  value: 0.9  },
];

const VOCAL_EVENTS = [
  { text: 'PERFECT PITCH 🎯', color: '#FF2D55' },
  { text: 'SLAY QUEEN 👑',    color: '#FFD700' },
  { text: 'HIGH NOTE 🚀',     color: '#00F5D4' },
  { text: 'VOCAL GOAT 🐐',    color: '#B14EFF' },
  { text: 'CHILLS 🥶',        color: '#3A86FF' },
  { text: 'MELISMA 🌊',       color: '#FF9F1C' },
];

const RATING_SCALE = [
  { min: 90, grade: 'S', label: 'VOCAL LEGEND',   color: '#FFD700' },
  { min: 75, grade: 'A', label: 'STAR PERFORMER', color: '#00F5D4' },
  { min: 55, grade: 'B', label: 'SOLID SINGER',   color: '#3A86FF' },
  { min: 35, grade: 'C', label: 'GETTING THERE',  color: '#FF9F1C' },
  { min: 0,  grade: 'D', label: 'KEEP SINGING!',  color: '#888'    },
];

const formatTime = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const getRating = (score) =>
  RATING_SCALE.find((r) => score >= r.min) ?? RATING_SCALE[RATING_SCALE.length - 1];

// ─── WaveBar (v3.0 — true organic motion) ──────────────────────────────────────
const waveStyles = StyleSheet.create({
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 44 },
  bar: { width: 4, borderRadius: 3 },
});

const WaveBar = ({ index, isRecording }) => {
  const anim      = useRef(new Animated.Value(0.15)).current;
  const activeRef = useRef(false);

  useEffect(() => {
    if (isRecording) {
      activeRef.current = true;
      const animate = () => {
        if (!activeRef.current) return;
        const targetHigh = Math.random() * 0.65 + 0.30;
        const targetLow  = Math.random() * 0.20 + 0.05;
        const durUp      = 150 + index * 30 + Math.random() * 80;
        const durDn      = 150 + index * 25 + Math.random() * 80;
        Animated.sequence([
          Animated.timing(anim, { toValue: targetHigh, duration: durUp, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(anim, { toValue: targetLow,  duration: durDn, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]).start(({ finished }) => { if (finished) animate(); });
      };
      animate();
    } else {
      activeRef.current = false;
      Animated.timing(anim, { toValue: 0.15, duration: 350, useNativeDriver: false }).start();
    }
    return () => { activeRef.current = false; };
  }, [isRecording]);

  const barH     = anim.interpolate({ inputRange: [0, 1], outputRange: [3, 38] });
  const barColor = anim.interpolate({
    inputRange:  [0, 0.45, 0.8, 1],
    outputRange: ['#FF2D5530', '#FF2D55', '#FF9F1C', '#FFD700'],
  });

  return (
    <View style={waveStyles.barWrap}>
      <Animated.View style={[waveStyles.bar, { height: barH, backgroundColor: barColor }]} />
    </View>
  );
};

// 🆕 RemoteVideo — lazy-requires RTCView so solo mode never touches WebRTC native.
const RemoteVideo = ({ stream, style }) => {
  const { RTCView } = require('react-native-webrtc');
  return <RTCView streamURL={stream.toURL()} style={style} objectFit="cover" mirror={false} />;
};
const LocalVideo = ({ stream, style }) => {
  const { RTCView } = require('react-native-webrtc');
  return <RTCView streamURL={stream.toURL()} style={style} objectFit="cover" mirror />;
};

// 🆕 FXPanel — horizontal preset chips + 3-stop intensity (no slider dep).
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

// 🔧 v4.0.1 — KaraokeStage is memoized with NO props, so it renders exactly once.
// No matter how many times the parent re-renders (FX taps, intensity, etc.) the
// WebView stays mounted and the karaoke video keeps playing uninterrupted.
const KaraokeStage = React.memo(function KaraokeStage() {
  return (
    <View style={styles.youtubePanel}>
      {Platform.OS === 'web'
        ? React.createElement('iframe', {
            src: KARAOKE_WEB_SRC,
            style: { width: '100%', height: '100%', border: 0 },
            allow: 'autoplay; encrypted-media; fullscreen',
            allowFullScreen: true,
            title: 'Karaoke',
          })
        : (
          <WebView
          source={KARAOKE_SOURCE}
          style={{ flex: 1, backgroundColor: '#000' }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          backgroundColor="#000"
          />
        )}
      <View style={styles.youtubeBadge}>
        <Ionicons name="musical-note" size={10} color="#FF2D55" />
        <Text style={styles.youtubeBadgeText}>KARAOKE SOURCE</Text>
      </View>
    </View>
  );
});

// ─── Component ────────────────────────────────────────────────────────────────
export const KaraokeRoom = ({ sheet, onClose, isDark, supabase, currentUser }) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [isRecording,   setIsRecording]   = useState(false);
  const [recordedVideo, setRecordedVideo] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  // Gamification (v3)
  const [pitchScore,   setPitchScore]   = useState(0);
  const [peakPitch,    setPeakPitch]    = useState(0);
  const [vocalEvent,   setVocalEvent]   = useState(null);
  const [totalNotes,   setTotalNotes]   = useState(0);
  const [perfectNotes, setPerfectNotes] = useState(0);

  // 🆕 v4.0 state
  const [selectedFX,  setSelectedFX]  = useState('dry');
  const [fxIntensity, setFxIntensity] = useState(0.6);
  const [mode,        setMode]        = useState('solo'); // 'solo' | 'duet'
  const [joinCode,    setJoinCode]    = useState('');

  // 🆕 v4.0.6 — publishing
  const [caption,   setCaption]   = useState('');
  const [publishTo, setPublishTo] = useState('feed'); // 'feed' | 'pulse'
  const [posting,   setPosting]   = useState(false);

  const { FX_PRESETS, processRecording, processing } = useAudioFX();
  const co = useCoSinger(supabase);

  const cameraRef   = useRef(null);
  const timerRef    = useRef(null);
  const peakRef     = useRef(0);
  const rawVideoRef = useRef(null); // raw recording before FX (so we can re-apply)

  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const scoreAnim   = useRef(new Animated.Value(1)).current;
  const eventAnim   = useRef(new Animated.Value(0)).current;
  const headerAnim  = useRef(new Animated.Value(0)).current;
  const pitchAnim   = useRef(new Animated.Value(0)).current;
  const micGlowAnim = useRef(new Animated.Value(0.4)).current;

  const trend     = sheet?.trend || '#KaraokeVibe';
  const duetLive  = mode === 'duet' && co.status === 'live';
  const duetSetup = mode === 'duet' && co.status !== 'live';

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(micGlowAnim, { toValue: 0.28, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(micGlowAnim, { toValue: 0.06, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    (async () => {
      const cam   = await Camera.requestCameraPermissionsAsync();
      const audio = await Camera.requestMicrophonePermissionsAsync();
      setHasPermission(cam.status === 'granted' && audio.status === 'granted');
    })();
  }, []);

  // ── Recording engine (v3, solo only) ────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) {
      pulseAnim.setValue(1);
      clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.28, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    const pitchInterval = setInterval(() => {
      const newPitch = Math.floor(Math.random() * 35) + 52;
      setPitchScore(newPitch);
      if (newPitch > peakRef.current) { peakRef.current = newPitch; setPeakPitch(newPitch); }
      setTotalNotes((n) => n + 1);
      if (newPitch >= 80) setPerfectNotes((n) => n + 1);

      Animated.timing(pitchAnim, { toValue: newPitch / 100, duration: 320, useNativeDriver: false }).start();
      Animated.sequence([
        Animated.timing(scoreAnim, { toValue: 1.2, duration: 80,  useNativeDriver: true }),
        Animated.timing(scoreAnim, { toValue: 1,   duration: 120, useNativeDriver: true }),
      ]).start();
    }, 800);

    const eventInterval = setInterval(() => {
      const ev = VOCAL_EVENTS[Math.floor(Math.random() * VOCAL_EVENTS.length)];
      setVocalEvent(ev);
      eventAnim.setValue(0);
      Animated.sequence([
        Animated.spring(eventAnim, { toValue: 1, useNativeDriver: true, tension: 180, friction: 5 }),
        Animated.delay(1100),
        Animated.timing(eventAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setVocalEvent(null));
    }, 3500);

    return () => {
      pulseLoop.stop();
      clearInterval(timerRef.current);
      clearInterval(pitchInterval);
      clearInterval(eventInterval);
    };
  }, [isRecording]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return; // ignore taps while already recording
    peakRef.current = 0;
    setIsRecording(true);
    setRecordingTime(0);
    setPitchScore(0);
    setPeakPitch(0);
    setTotalNotes(0);
    setPerfectNotes(0);
    try {
      // record video WITH audio (the user's vocal). mode="video" on CameraView
      // makes this succeed; without it Android returns the "no data" error.
      const data = await cameraRef.current.recordAsync({ maxDuration: 60 });
      if (data?.uri) {
        rawVideoRef.current = data.uri;                                   // 🆕 keep raw
        const fxUri = await processRecording(data.uri, selectedFX, fxIntensity); // 🆕 bake FX
        setRecordedVideo(fxUri);
      }
    } catch (e) {
      console.error('[KaraokeRoom] record error:', e);
    }
    setIsRecording(false);
  };

  const stopRecording = () => {
    // only stop if we've actually been rolling for a beat — stopping in the same
    // frame we started yields "stopped before any data could be produced".
    if (cameraRef.current && isRecording && recordingTime >= 1) {
      cameraRef.current.stopRecording();
    }
  };

  const handleRetake = () => {
    setRecordedVideo(null);
    rawVideoRef.current = null;
    setRecordingTime(0);
    setPitchScore(0);
    setPeakPitch(0);
    setTotalNotes(0);
    setPerfectNotes(0);
    peakRef.current = 0;
  };

  // 🆕 re-apply a different FX on the results screen, from the raw take
  const reapplyFX = async (key, intensity = fxIntensity) => {
    setSelectedFX(key);
    if (!rawVideoRef.current) return;
    const fxUri = await processRecording(rawVideoRef.current, key, intensity);
    setRecordedVideo(fxUri);
  };

  // 🆕 toggle duet mode
  const enterDuet = () => setMode('duet');
  const exitDuet  = () => { co.leave(); setMode('solo'); };

  // 🆕 v4.0.7 — publish the finished cover.
  //   FEED  → POST /posts        (field "image"; shows in Feed AND Profile, like FB)
  //   PULSE → POST /pulse        (field "image"; 24h story). Uses createPulse().
  // Both endpoints are JwtAuthGuard-protected and take the file in field "image".
  const publishCover = async () => {
    if (!recordedVideo || posting) return;

    const isPulse  = publishTo === 'pulse';
    const endpoint = isPulse ? '/pulse' : '/posts';
    const text     = caption?.trim() || `🎤 Karaoke cover — ${peakPitch}% peak pitch`;

    setPosting(true);
    try {
      const form = new FormData();
      // local file:// uri → RN FormData file shape. Both endpoints read "image".
      form.append('image', { uri: recordedVideo, name: 'karaoke.mp4', type: 'video/mp4' });
      form.append('text', text);
      if (isPulse) form.append('vibe', 'Happy'); // optional Pulse field; safe default

      // fetchAPI attaches the auth token + handles FormData automatically.
      await api.fetchAPI(endpoint, { method: 'POST', body: form });
      // ⭐️ FIX: was missing — DanceChallenge.js has trackEvent('dance_challenge_published'),
      // DuetCompose.js has trackEvent('duet_published'). KaraokeRoom publishes are now
      // tracked too, so all three creative recorders appear in analytics.
      trackEvent('karaoke_cover_published', { target: publishTo, peakPitch });

      Alert.alert(
        'Posted! 🎉',
        isPulse
          ? 'Your cover is live as a Pulse for the next 24 hours.'
          : 'Your cover is live on your Feed and Profile.',
      );
      onClose?.();
    } catch (e) {
      console.error('[KaraokeRoom] publish error:', e?.message || e);
      Alert.alert('Upload failed', 'Could not post your cover. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const pitchBarColor = pitchAnim.interpolate({
    inputRange:  [0, 0.5, 0.8, 1],
    outputRange: ['#888', '#FF9F1C', '#00F5D4', '#FFD700'],
  });
  const pitchBarWidth = pitchAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  // ── Permission states ──────────────────────────────────────────────────────
  if (hasPermission === null) return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator size="large" color="#FF2D55" />
      <Text style={styles.loadingText}>Tuning the stage...</Text>
    </View>
  );
  if (hasPermission === false) return (
    <View style={styles.loadingScreen}>
      <Ionicons name="mic-off-outline" size={48} color="#333" />
      <Text style={styles.permText}>Camera & mic needed for Karaoke</Text>
    </View>
  );

  // ── Results Screen (v3 + 🆕 FX re-apply row + processing overlay) ────────────
  if (recordedVideo) {
    const accuracy = totalNotes > 0 ? Math.round((perfectNotes / totalNotes) * 100) : 0;
    const rating   = getRating(peakPitch);
    return (
      <View style={styles.container}>
        <SafeAreaView style={{ flex: 1 }}>
          <Animated.View style={[styles.header, { opacity: headerAnim }]}>
            <TouchableOpacity onPress={handleRetake} style={styles.iconBtn}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            <View style={[styles.trendPill, { borderColor: `${rating.color}55`, backgroundColor: `${rating.color}18` }]}>
              <Ionicons name="trophy" size={14} color={rating.color} style={{ marginRight: 5 }} />
              <Text style={[styles.trendText, { color: rating.color }]}>{rating.label}</Text>
            </View>
            <View style={{ width: 44 }} />
          </Animated.View>

          <View style={styles.previewWrap}>
            <Video source={{ uri: recordedVideo }} style={StyleSheet.absoluteFill} resizeMode="cover" shouldPlay isLooping />
            <View style={styles.previewGradient} />
            {processing && (
              <View style={styles.fxProcessing}>
                <ActivityIndicator color="#FF2D55" />
                <Text style={styles.fxProcessingText}>APPLYING FX…</Text>
              </View>
            )}
          </View>

          {/* 🆕 swap the effect on your take without re-singing */}
          <FXPanel
            presets={FX_PRESETS}
            selected={selectedFX}
            onSelect={(k) => reapplyFX(k)}
            intensity={fxIntensity}
            onIntensity={(v) => { setFxIntensity(v); reapplyFX(selectedFX, v); }}
          />

          <View style={styles.resultsPanel}>
            <View style={styles.gradeRow}>
              <View style={[styles.gradeCircle, { borderColor: rating.color, backgroundColor: `${rating.color}18` }]}>
                <Text style={[styles.gradeLetter, { color: rating.color }]}>{rating.grade}</Text>
              </View>
              <View style={styles.statsCol}>
                <View style={styles.statItem}>
                  <Text style={styles.statVal}>{peakPitch}%</Text>
                  <Text style={styles.statLbl}>PEAK PITCH</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statVal}>{accuracy}%</Text>
                  <Text style={styles.statLbl}>ACCURACY</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statVal}>{formatTime(recordingTime)}</Text>
                  <Text style={styles.statLbl}>DURATION</Text>
                </View>
              </View>
            </View>

            {/* 🆕 caption */}
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Say something about your cover…"
              placeholderTextColor="#666"
              style={styles.captionInput}
              maxLength={200}
              multiline
            />

            {/* 🆕 where to publish: Feed (→ Profile too) or Pulse */}
            <View style={styles.targetRow}>
              <TouchableOpacity
                style={[styles.targetChip, publishTo === 'feed' && styles.targetChipOn]}
                onPress={() => setPublishTo('feed')}
              >
                <Ionicons name="newspaper-outline" size={15} color={publishTo === 'feed' ? '#fff' : '#9A9AA8'} />
                <Text style={[styles.targetText, publishTo === 'feed' && styles.targetTextOn]}>Feed</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.targetChip, publishTo === 'pulse' && styles.targetChipOn]}
                onPress={() => setPublishTo('pulse')}
              >
                <Ionicons name="flash-outline" size={15} color={publishTo === 'pulse' ? '#fff' : '#9A9AA8'} />
                <Text style={[styles.targetText, publishTo === 'pulse' && styles.targetTextOn]}>Pulse</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.resultsFooter}>
              <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake} disabled={posting}>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.btnText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.postBtn, { backgroundColor: rating.color }, posting && { opacity: 0.7 }]}
                onPress={publishCover}
                disabled={posting}
              >
                {posting ? (
                  <ActivityIndicator color={rating.color === '#FFD700' ? '#000' : '#fff'} />
                ) : (
                  <>
                    <Text style={[styles.postBtnText, { color: rating.color === '#FFD700' ? '#000' : '#fff' }]}>
                      Post Cover
                    </Text>
                    <Ionicons name="send" size={16} color={rating.color === '#FFD700' ? '#000' : '#fff'} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Recording Screen ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>

        <Animated.View style={[styles.header, { opacity: headerAnim }]}>
          <TouchableOpacity onPress={mode === 'duet' ? exitDuet : onClose} style={styles.iconBtn}>
            <Ionicons name={mode === 'duet' ? 'arrow-back' : 'close'} size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.trendPill}>
            <Ionicons name="mic" size={14} color="#FF2D55" style={{ marginRight: 5 }} />
            <Text style={styles.trendText}>{trend}</Text>
          </View>
          {isRecording
            ? <View style={styles.recBadge}><View style={styles.recDot} /><Text style={styles.recTime}>{formatTime(recordingTime)}</Text></View>
            : (mode === 'solo'
                ? <TouchableOpacity style={styles.headerDuetBtn} onPress={enterDuet}>
                    <Ionicons name="people" size={18} color="#FF2D55" />
                  </TouchableOpacity>
                : <View style={{ width: 42 }} />)}
        </Animated.View>

        {/* YouTube Karaoke — memoized + stable source so FX taps never reload it */}
        <KaraokeStage />

        {/* Waveform divider */}
        <View style={styles.waveRow}>
          <View style={styles.divLine} />
          <View style={styles.waveContainer}>
            {Array.from({ length: NUM_BARS }).map((_, i) => (
              <WaveBar key={i} index={i} isRecording={isRecording} />
            ))}
          </View>
          <View style={styles.divLine} />
        </View>

        {/* Stage: SOLO camera, or DUET split (you + co-singer) */}
        <View style={styles.cameraPanel}>
          {/* SOLO — expo-camera owns the mic/cam so we can record + FX it.
              🔧 v4.0.3 — mode="video" is REQUIRED: CameraView defaults to picture
              mode, and recordAsync() fails instantly with "Recording was stopped
              before any data could be produced" without it. */}
          {mode === 'solo' && (
            <CameraView style={StyleSheet.absoluteFill} facing="front" mode="video" ref={cameraRef} />
          )}

          {/* DUET LIVE — WebRTC owns the cam; show both streams side-by-side */}
          {duetLive && (
            <View style={styles.duetSplit}>
              {co.remoteStream
                ? <RemoteVideo stream={co.remoteStream} style={styles.duetHalf} />
                : <View style={[styles.duetHalf, styles.duetWaiting]}><ActivityIndicator color="#FF2D55" /></View>}
              {co.localStream && <LocalVideo stream={co.localStream} style={styles.duetHalf} />}
              <View style={styles.liveBadge}><View style={styles.recDot} /><Text style={styles.recTime}>LIVE DUET</Text></View>
            </View>
          )}

          {/* DUET SETUP — host / join lobby */}
          {duetSetup && (
            <View style={styles.lobby}>
              <Ionicons name="people-circle-outline" size={40} color="#FF2D55" />
              <Text style={styles.lobbyTitle}>Sing together, live</Text>

              {!supabase && (
                <Text style={styles.lobbyHint}>Pass a `supabase` prop to enable Co-Singer.</Text>
              )}

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
                </>
              )}

              {(co.status === 'hosting') && (
                <View style={styles.codeBox}>
                  <Text style={styles.codeLabel}>SHARE THIS CODE</Text>
                  <Text style={styles.codeValue}>{co.roomCode}</Text>
                  <View style={styles.waitRow}>
                    <ActivityIndicator color="#FF2D55" size="small" />
                    <Text style={styles.lobbyHint}>Waiting for your duet partner…</Text>
                  </View>
                </View>
              )}

              {(co.status === 'joining' || co.status === 'connecting') && (
                <View style={styles.waitRow}>
                  <ActivityIndicator color="#FF2D55" size="small" />
                  <Text style={styles.lobbyHint}>
                    {co.status === 'joining' ? 'Joining room…' : 'Connecting…'}
                  </Text>
                </View>
              )}

              {co.status === 'error' && (
                <Text style={[styles.lobbyHint, { color: '#FF2D55' }]}>{co.error || 'Connection error'}</Text>
              )}
            </View>
          )}

          {/* Pitch HUD — compact transparent pill, top-right, clear of the face */}
          {isRecording && mode === 'solo' && (
            <View style={styles.pitchPill} pointerEvents="none">
              <Text style={styles.pitchPillLabel}>PITCH</Text>
              <View style={styles.pitchPillBarBg}>
                <Animated.View style={[styles.pitchBarFill, { width: pitchBarWidth, backgroundColor: pitchBarColor }]} />
              </View>
              <Animated.Text style={[styles.pitchPillValue, { transform: [{ scale: scoreAnim }] }]}>
                {pitchScore}%
              </Animated.Text>
            </View>
          )}

          {/* Vocal-event toast floats on its own near the top — never resizes the HUD */}
          {isRecording && mode === 'solo' && vocalEvent && (
            <Animated.Text
              pointerEvents="none"
              style={[styles.vocalEventFloat, {
                color: vocalEvent.color,
                opacity: eventAnim,
                transform: [{ scale: eventAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
              }]}
            >
              {vocalEvent.text}
            </Animated.Text>
          )}

          {/* 🆕 v4.0.2 — SOLO floating controls layered ON the camera.
              IMPORTANT: these are UI overlays only. recordAsync captures the camera
              FEED, not the React Native view tree — so none of these buttons end up
              in the recorded video, even though they sit on top of you on screen. */}
          {mode === 'solo' && (
            <>
              <View style={styles.bottomScrim} pointerEvents="none" />

              {/* FX chips float just above the record button (pick before singing) */}
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

              {/* Record / stop button docked bottom-center over the camera */}
              <View style={styles.recordDock}>
                <View style={styles.micGlowWrap}>
                  <Animated.View style={[styles.micGlowRing, { opacity: micGlowAnim, transform: [{ scale: pulseAnim }] }]} />
                  <TouchableOpacity
                    style={[styles.recordBtn, isRecording && styles.recordingActive]}
                    onPress={isRecording ? stopRecording : startRecording}
                    activeOpacity={0.85}
                  >
                    {isRecording ? <View style={styles.stopSquare} /> : <Ionicons name="mic" size={28} color="#fff" />}
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Footer — only the duet "End" control still needs flow layout */}
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
  // 🔧 v4.0.6 — only the TOP corners are rounded (sheet look); the bottom is a
  // clean square edge so the full-bleed camera doesn't get clipped into a curve.
  container: { flex: 1, minHeight: SCREEN_HEIGHT * 0.7, width: '100%', backgroundColor: '#06060A', overflow: 'hidden', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderWidth: 1, borderColor: '#17171F' },
  loadingScreen: { flex: 1, minHeight: SCREEN_HEIGHT * 0.7, width: '100%', backgroundColor: '#06060A', justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadingText: { color: '#FF2D55', fontSize: 13, fontWeight: '600', letterSpacing: 0.8 },
  permText: { color: '#444', fontSize: 15, marginTop: 12, textAlign: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  trendPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,45,85,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,45,85,0.4)' },
  trendText: { color: '#FF2D55', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  recBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,45,85,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#FF2D55', gap: 5 },
  recDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF2D55' },
  recTime: { color: '#fff', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },

  youtubePanel: { height: STAGE_H, backgroundColor: '#0C0C12', position: 'relative', marginHorizontal: 12, borderRadius: 18, overflow: 'hidden', minHeight: 80 },
  youtubeBadge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  youtubeBadgeText: { color: '#FF2D55', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },

  waveRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5 },
  divLine: { flex: 1, height: 2, backgroundColor: '#FF2D55', opacity: 0.45 },
  waveContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 5, height: 44 },

  cameraPanel: { flex: 1, marginHorizontal: 0, borderRadius: 0, overflow: 'hidden', backgroundColor: '#0A0A10', position: 'relative', minHeight: 200 },

  // 🆕 duet
  duetSplit: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  duetHalf: { flex: 1, height: '100%', backgroundColor: '#000' },
  duetWaiting: { justifyContent: 'center', alignItems: 'center' },
  liveBadge: { position: 'absolute', top: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: '#FF2D55' },

  // 🆕 lobby
  lobby: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 22 },
  lobbyTitle: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  lobbyHint: { color: '#777', fontSize: 12, textAlign: 'center' },
  lobbyBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF2D55', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 22 },
  lobbyBtnGhost: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#22232E' },
  lobbyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  joinInput: { width: 110, color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 4, textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#22232E' },
  codeBox: { alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,45,85,0.08)', paddingHorizontal: 30, paddingVertical: 18, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,45,85,0.3)' },
  codeLabel: { color: '#FF2D55', fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  codeValue: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: 8 },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },

  pitchMeter: { position: 'absolute', bottom: 12, left: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.84)', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,45,85,0.25)' },
  // 🆕 v4.0.2 — same HUD, anchored to the TOP of the camera (clear of bottom controls)
  pitchMeterTop: { position: 'absolute', top: 12, left: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.84)', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,45,85,0.25)' },
  // 🔧 v4.0.5 — compact, transparent, top-right; sits in the corner not on the face
  pitchPill: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.32)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  pitchPillLabel: { color: 'rgba(255,45,85,0.95)', fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  pitchPillBarBg: { width: 54, height: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 3, overflow: 'hidden' },
  pitchPillValue: { color: '#fff', fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'], minWidth: 38, textAlign: 'right' },
  vocalEventFloat: { position: 'absolute', top: 46, right: 12, fontSize: 13, fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  // 🆕 v4.0.2 — dark wash at the camera's bottom so floating controls stay legible
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 220, backgroundColor: 'rgba(6,6,10,0.45)' },
  // 🆕 v4.0.2 — FX chips float above the record button
  fxOverlay: { position: 'absolute', left: 0, right: 0, bottom: 104 },
  // 🆕 v4.0.2 — record/stop button docked bottom-center on the camera
  recordDock: { position: 'absolute', left: 0, right: 0, bottom: 18, alignItems: 'center' },
  pitchMeterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pitchMeterLabel: { color: '#FF2D55', fontSize: 8, fontWeight: '900', letterSpacing: 2 },
  pitchMeterValue: { color: '#fff', fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pitchBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  pitchBarFill: { height: '100%', borderRadius: 3 },
  vocalEvent: { fontSize: 12, fontWeight: '900', marginTop: 8, textAlign: 'center', letterSpacing: 0.5 },

  // 🆕 FX panel
  fxPanel: { paddingTop: 8, paddingBottom: 2 },
  fxRow: { paddingHorizontal: 12, gap: 8 },
  fxChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#22232E', backgroundColor: 'rgba(255,255,255,0.04)' },
  fxChipText: { color: '#9A9AA8', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  intensityRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  intChip: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  intChipOn: { backgroundColor: 'rgba(255,45,85,0.2)', borderWidth: 1, borderColor: '#FF2D55' },
  intText: { color: '#777', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  intTextOn: { color: '#FF2D55' },
  fxProcessing: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.55)' },
  fxProcessingText: { color: '#FF2D55', fontSize: 11, fontWeight: '900', letterSpacing: 2 },

  footer: { paddingVertical: 14, alignItems: 'center', gap: 8 },
  modeSwitch: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(255,45,85,0.1)', borderWidth: 1, borderColor: 'rgba(255,45,85,0.3)' },
  modeSwitchText: { color: '#FF2D55', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  headerDuetBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,45,85,0.12)', borderWidth: 1, borderColor: 'rgba(255,45,85,0.35)' },
  micGlowWrap: { width: 86, height: 86, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  // 🔧 v4.0.4 — faint halo only; the old solid pink disc was what made the button
  // look opaque. Now it's a whisper of a glow that doesn't hide the singer.
  micGlowRing: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: '#FF2D55' },
  // 🔧 v4.0.5 — barely-there fill; the white ring marks the button, you stay visible
  recordBtn: { width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(255,45,85,0.12)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.92)', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  recordingActive: { borderRadius: 18, backgroundColor: 'rgba(204,31,64,0.15)', borderColor: '#FF2D55' },
  // 🔧 v4.0.5 — translucent stop square so it no longer blocks your face
  stopSquare: { width: 22, height: 22, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 5 },
  recordHint: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  leaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#CC1F40', paddingHorizontal: 26, paddingVertical: 13, borderRadius: 22 },

  previewWrap: { flex: 1, marginHorizontal: 12, borderRadius: 22, overflow: 'hidden', backgroundColor: '#111', position: 'relative' },
  previewGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: 'rgba(6,6,10,0.65)' },
  resultsPanel: { paddingHorizontal: 18, paddingVertical: 14 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  gradeCircle: { width: 78, height: 78, borderRadius: 39, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  gradeLetter: { fontSize: 40, fontWeight: '900', lineHeight: 46 },
  statsCol: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center' },
  statVal: { color: '#fff', fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLbl: { color: '#555', fontSize: 8, fontWeight: '700', letterSpacing: 1.5, marginTop: 2 },
  resultsFooter: { flexDirection: 'row', gap: 10 },
  retakeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 14, borderRadius: 22, gap: 8, borderWidth: 1, borderColor: '#22232E' },
  // 🆕 v4.0.6 — caption + publish target
  captionInput: { color: '#fff', fontSize: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, minHeight: 44, maxHeight: 90, borderWidth: 1, borderColor: '#22232E' },
  targetRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  targetChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: '#22232E' },
  targetChipOn: { backgroundColor: 'rgba(255,45,85,0.22)', borderColor: '#FF2D55' },
  targetText: { color: '#9A9AA8', fontSize: 13, fontWeight: '800' },
  targetTextOn: { color: '#fff' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  postBtn: { flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 22, gap: 8 },
  postBtnText: { fontSize: 15, fontWeight: '900' },
});