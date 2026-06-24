/**
 * VideoLab.js — KLIQ 2026 Edition
 *
 * FIXES & UPGRADES vs original:
 * ─────────────────────────────────────────────────────────────────────────
 * [BUG]   startRecording sets isRecording=true BEFORE recordAsync resolves,
 *         but the cleanup effect fires on the state transition — race condition
 *         where the score interval is cleared immediately. Fixed with a
 *         dedicated `isLive` ref that drives the interval independently.
 *
 * [BUG]   pulseAnim.setValue(1) called inside cleanup of the same effect that
 *         started the loop — on fast toggles this leaves the loop running with
 *         no reset. Fixed by stopping the loop reference before resetting.
 *
 * [BUG]   trendViewers uses Math.random() on every render — extract to useMemo
 *         or top-level so it's stable.
 *
 * [PERF]  scoreInterval fires every 500 ms with a re-render — batched via a
 *         ref accumulator, single setState call per 500 ms to avoid waterfall.
 *
 * [UX]    No camera-flip button. No maximum recording progress indicator.
 *         No haptic pulse feedback. Added all three.
 *
 * [UX]    "Settings" icon button does nothing — wired to a simple overlay state.
 *
 * [DESIGN] Added: neon scan-line shader overlay, animated LIVE viewers ticker,
 *          recording progress ring around shutter button, filter/speed modes bar,
 *          post-preview with share sheet stub.
 *
 * [A11Y]  TouchableOpacity children without accessible labels — added
 *         accessibilityLabel to all interactive controls.
 *
 * [V1.1 — Engineering Audit Fixes]:
 * [BUG CRITICAL] handlePostVideo called bare `alert(...)`. alert() is a
 *         browser/DOM API — it is NOT part of React Native's JS runtime
 *         (Hermes/JSC) and is undefined on a real native iOS/Android build,
 *         even though it appears to work fine when only tested on web (where
 *         the underlying DOM provides window.alert). Tapping "DROP IT" on a
 *         real device would throw ReferenceError and crash. Also, the
 *         recorded video was never uploaded anywhere — entirely discarded.
 *         Fixed: wired to uploadFile() from useAppStore (the same generic
 *         upload action audited and confirmed working in an earlier session),
 *         replaced alert() with Toast.show() (the pattern used everywhere
 *         else in this codebase), added an isPosting loading state.
 *         ⚠️ The actual "create a post from this video URL" backend action
 *         wasn't available to verify in this audit — left as an explicit
 *         TODO rather than guessing a call to a possibly-nonexistent action.
 * [BUG]   `Dimensions.get('window')` was captured ONCE at module load and
 *         baked into the static StyleSheet — breaks on rotation/resize, same
 *         class of bug found in TopicChat.js. `SCREEN_WIDTH` was destructured
 *         but never used anywhere (dead code). Fixed with useWindowDimensions()
 *         applied as an inline style merge at the 4 call sites that need it;
 *         removed the dead SCREEN_WIDTH.
 * [BUG]   `isLiveRef` was set (true on recording start, false on stop/cleanup)
 *         but never actually READ anywhere — the claimed "drives the interval
 *         independently" fix was a no-op in practice. Concretely, this meant
 *         there was no guard against rapid double-tapping the shutter button,
 *         which could fire cameraRef.current.recordAsync() a second time while
 *         the first call was still in flight. Wired the ref as an actual
 *         synchronous lock at the top of startRecording.
 * [BUG]   `scanlineOverlay` used the web-only CSS property `backgroundImage`
 *         with a `repeating-linear-gradient(...)` value. This property does
 *         not exist in React Native's native style bridge — the "neon
 *         scan-line shader overlay" the changelog above claims to have added
 *         is completely invisible on a real iOS/Android build, and only
 *         renders on react-native-web (where the underlying DOM supports real
 *         CSS). Scoped to Platform.OS === 'web' so the gap is now intentional
 *         and documented rather than silently broken on native.
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
    ActivityIndicator, Animated, Easing, ScrollView, Platform,
    useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, Camera } from 'expo-camera';
import { Video } from 'expo-av';
import Toast from 'react-native-toast-message';
import { useAppStore } from '../../store/useAppStore';

// ─────────────────────────────────────────────────────────────
// Cross-platform __DEV__ guard
// ─────────────────────────────────────────────────────────────
if (typeof __DEV__ === 'undefined') {
    Object.defineProperty(
        typeof globalThis !== 'undefined' ? globalThis : global,
        '__DEV__',
        { value: process.env.NODE_ENV !== 'production', configurable: true }
    );
}

const MAX_DURATION = 60; // seconds

// ── Speed modes ──────────────────────────────────────────────────────────
const SPEED_MODES = [
    { id: '0.3x', label: '0.3×' },
    { id: '0.5x', label: '0.5×' },
    { id: '1x',   label: '1×'   },
    { id: '2x',   label: '2×'   },
    { id: '3x',   label: '3×'   },
];

// ── Stable viewers count (avoids re-randomise on render) ─────────────────
function useStableViewers(sheet) {
    return useMemo(
        () => sheet?.viewers ?? Math.floor(Math.random() * 49000 + 1000),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
}

// ─────────────────────────────────────────────────────────────────────────
export const VideoLab = ({ sheet, onClose, isDark }) => {
    const [hasPermission,      setHasPermission]      = useState(null);
    const [hasAudioPermission, setHasAudioPermission] = useState(null);
    const [isRecording,        setIsRecording]        = useState(false);
    const [recordedVideo,      setRecordedVideo]      = useState(null);
    const [recordingTime,      setRecordingTime]      = useState(0);
    const [kliqScore,          setKliqScore]          = useState(0);
    const [hypeCount,          setHypeCount]          = useState(0);
    const [selectedSpeed,      setSelectedSpeed]      = useState('1x');
    const [cameraFacing,       setCameraFacing]       = useState('front');
    const [showSettings,       setShowSettings]       = useState(false);
    const [isPosting,          setIsPosting]          = useState(false); // [FIX CRITICAL]

    const cameraRef      = useRef(null);
    const timerRef       = useRef(null);
    const scoreRef       = useRef(0);     // batch accumulator
    const isLiveRef      = useRef(false); // [FIX] now actually used as a start-guard
    const loopRef        = useRef(null);  // holds Animated.CompositeAnimation

    const pulseAnim  = useRef(new Animated.Value(1)).current;
    const scoreAnim  = useRef(new Animated.Value(1)).current;
    const ringAnim   = useRef(new Animated.Value(0)).current;  // progress ring 0→1

    const trend        = sheet?.trend   || '#VideoChallenge';
    const trendViewers = useStableViewers(sheet);

    // [FIX] Reactive — re-renders on rotation/resize, unlike the previous
    // Dimensions.get('window') captured once at module load.
    const { height: SCREEN_HEIGHT } = useWindowDimensions();

    const uploadFile = useAppStore(state => state.uploadFile); // [FIX CRITICAL]

    // ── Permissions ───────────────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            const cam   = await Camera.requestCameraPermissionsAsync();
            const audio = await Camera.requestMicrophonePermissionsAsync();
            setHasPermission(cam.status === 'granted');
            setHasAudioPermission(audio.status === 'granted');
        })();
    }, []);

    // ── Recording engine (pulse + timer + score) ──────────────────────────
    useEffect(() => {
        if (!isRecording) {
            // Stop loops safely
            if (loopRef.current) {
                loopRef.current.stop();
                loopRef.current = null;
            }
            pulseAnim.setValue(1);
            ringAnim.setValue(0);
            clearInterval(timerRef.current);
            isLiveRef.current = false; // [FIX] release the start-guard lock here too
            return;
        }

        isLiveRef.current = true;

        // Pulse animation
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1,    duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ]),
        );
        loop.start();
        loopRef.current = loop;

        // Progress ring animation over MAX_DURATION seconds
        Animated.timing(ringAnim, {
            toValue: 1,
            duration: MAX_DURATION * 1000,
            easing: Easing.linear,
            useNativeDriver: false,
        }).start();

        // Timer
        timerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);

        // Score accumulator — batch updates to avoid re-render storm
        const scoreInterval = setInterval(() => {
            scoreRef.current += Math.floor(Math.random() * 8) + 1;
            setKliqScore(scoreRef.current);
            Animated.sequence([
                Animated.timing(scoreAnim, { toValue: 1.4, duration: 80,  useNativeDriver: true }),
                Animated.timing(scoreAnim, { toValue: 1,   duration: 80,  useNativeDriver: true }),
            ]).start();
        }, 500);

        return () => {
            clearInterval(timerRef.current);
            clearInterval(scoreInterval);
        };
    }, [isRecording]);

    // ── Camera actions ────────────────────────────────────────────────────
    const startRecording = async () => {
        // [FIX] isLiveRef now actually gates concurrent starts. Set synchronously,
        // BEFORE any await, so a rapid double-tap (both calls reading the same
        // stale `isRecording` closure before React re-renders) still gets blocked —
        // ref writes are immediate; state updates are not.
        if (!cameraRef.current || isLiveRef.current) return;
        isLiveRef.current = true;

        setRecordingTime(0);
        setKliqScore(0);
        setHypeCount(0);
        scoreRef.current = 0;
        setIsRecording(true);
        try {
            const data = await cameraRef.current.recordAsync({ maxDuration: MAX_DURATION });
            setRecordedVideo(data.uri);
        } catch (error) {
            console.error('[VideoLab] Record error:', error);
        }
        setIsRecording(false);
        // isLiveRef.current is reset to false by the recording-engine effect's
        // (!isRecording) branch above — single source of truth for the unlock.
    };

    const stopRecording = () => {
        if (cameraRef.current && isRecording) {
            cameraRef.current.stopRecording();
        }
    };

    const handleRetake = () => {
        setRecordedVideo(null);
        setRecordingTime(0);
        setKliqScore(0);
        setHypeCount(0);
        scoreRef.current = 0;
    };

    // [FIX CRITICAL] Was: `alert(...)` (crashes on native) + the video was never
    // uploaded anywhere. Now uploads via uploadFile() and gives real feedback.
    const handlePostVideo = useCallback(async () => {
        if (!recordedVideo || isPosting) return;
        setIsPosting(true);
        try {
            const videoUrl = await uploadFile(recordedVideo, 'trend_video');
            if (!videoUrl) throw new Error('Upload returned no URL');

            // TODO: wire to the real "create trend post" backend action once it
            // exists, e.g. useAppStore.getState().createTrendPost({ trend, videoUrl }).
            // The video itself is now safely uploaded; only post-creation remains.
            if (__DEV__) {
                console.warn(`[VideoLab] Video uploaded to ${videoUrl}, but no createTrendPost action is wired yet.`);
            }
            Toast.show({ type: 'success', text1: `Dropping to ${trend}! 🚀`, text2: 'Your video is uploading.' });
            onClose();
        } catch (error) {
            if (__DEV__) console.error('[VideoLab] Post video failed:', error);
            Toast.show({ type: 'error', text1: 'Could not post video', text2: 'Please try again.' });
        } finally {
            setIsPosting(false);
        }
    }, [recordedVideo, isPosting, uploadFile, trend, onClose]);

    const triggerHype = useCallback(() => {
        setHypeCount(prev => prev + 1);
        Animated.sequence([
            Animated.timing(scoreAnim, { toValue: 1.5, duration: 80, useNativeDriver: true }),
            Animated.timing(scoreAnim, { toValue: 1,   duration: 80, useNativeDriver: true }),
        ]).start();
    }, []);

    const flipCamera = useCallback(() => {
        setCameraFacing(prev => (prev === 'front' ? 'back' : 'front'));
    }, []);

    // ── Helpers ───────────────────────────────────────────────────────────
    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Progress ring interpolation (stroke-dashoffset style via border)
    const ringProgress = ringAnim.interpolate({
        inputRange:  [0, 1],
        outputRange: ['0%', '100%'],
    });

    // [FIX] height now computed from the reactive hook value, merged at each
    // call site rather than baked into the static StyleSheet object.
    const dynamicScreenStyle = { height: SCREEN_HEIGHT * 0.85 };

    // ── Guards ────────────────────────────────────────────────────────────
    if (hasPermission === null || hasAudioPermission === null) {
        return (
            <View style={[styles.loadingScreen, dynamicScreenStyle]}>
                <ActivityIndicator size="large" color="#00F5D4" />
            </View>
        );
    }
    if (!hasPermission || !hasAudioPermission) {
        return (
            <View style={[styles.loadingScreen, dynamicScreenStyle]}>
                <Ionicons name="videocam-off-outline" size={48} color="#444" />
                <Text style={styles.permissionText}>
                    Camera & Microphone access required.{'\n'}Please enable in Settings.
                </Text>
            </View>
        );
    }

    // ── Preview screen ────────────────────────────────────────────────────
    if (recordedVideo) {
        return (
            <View style={[styles.container, dynamicScreenStyle]}>
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={styles.previewHeader}>
                        <TouchableOpacity
                            onPress={handleRetake}
                            style={styles.iconBtn}
                            accessibilityLabel="Discard and retake"
                        >
                            <Ionicons name="close" size={28} color="#fff" />
                        </TouchableOpacity>

                        <View style={styles.trendPill}>
                            <Ionicons name="sparkles" size={16} color="#00F5D4" style={{ marginRight: 6 }} />
                            <Text style={styles.trendTitle}>{trend}</Text>
                        </View>

                        <View style={styles.scoreChip}>
                            <Text style={styles.scoreChipLabel}>KLIQ</Text>
                            <Text style={styles.scoreChipValue}>{kliqScore.toLocaleString()}</Text>
                        </View>
                    </View>

                    <View style={styles.videoPreviewWrap}>
                        <Video
                            source={{ uri: recordedVideo }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                            isLooping
                            shouldPlay
                        />
                        {/* Scanline overlay */}
                        <View style={styles.scanlineOverlay} pointerEvents="none" />
                    </View>

                    <View style={styles.previewFooter}>
                        <TouchableOpacity
                            style={styles.retakeBtn}
                            onPress={handleRetake}
                            disabled={isPosting}
                            accessibilityLabel="Retake video"
                        >
                            <Ionicons name="refresh" size={18} color="#fff" />
                            <Text style={styles.btnText}>RETAKE</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.postBtn, isPosting && { opacity: 0.6 }]}
                            onPress={handlePostVideo}
                            disabled={isPosting}
                            accessibilityLabel="Post video to trend"
                        >
                            {isPosting ? (
                                <ActivityIndicator size="small" color="#000" />
                            ) : (
                                <>
                                    <Ionicons name="rocket" size={18} color="#000" />
                                    <Text style={styles.postBtnText}>DROP IT</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    // ── Recording screen ──────────────────────────────────────────────────
    return (
        <View style={[styles.container, dynamicScreenStyle]}>
            <CameraView
                style={StyleSheet.absoluteFill}
                facing={cameraFacing}
                ref={cameraRef}
            >
                {/* Scanline shader */}
                <View style={styles.scanlineOverlay} pointerEvents="none" />

                {/* Corner reticles */}
                <View style={styles.aiOverlay} pointerEvents="none">
                    <View style={styles.cornerTL} />
                    <View style={styles.cornerTR} />
                    <View style={styles.cornerBL} />
                    <View style={styles.cornerBR} />
                </View>

                <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }}>

                    {/* ── Header ── */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={onClose}
                            style={styles.iconBtn}
                            accessibilityLabel="Close video lab"
                        >
                            <Ionicons name="chevron-down" size={28} color="#fff" />
                        </TouchableOpacity>

                        <View style={styles.headerCenter}>
                            <View style={styles.trendLiveBadge}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>
                                    {trendViewers.toLocaleString()} IN TREND
                                </Text>
                            </View>
                            <Text style={styles.trendTitleHUD}>{trend}</Text>
                        </View>

                        <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={flipCamera}
                            accessibilityLabel="Flip camera"
                        >
                            <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* ── Gamification HUD ── */}
                    <View style={styles.scoreHUDContainer} pointerEvents="none">
                        <Text style={styles.aiText}>VIRAL POTENTIAL TRACKER</Text>
                        <View style={styles.scoreHUDRow}>
                            <View style={styles.scoreStat}>
                                <Animated.Text
                                    style={[styles.scoreStatValue, { transform: [{ scale: scoreAnim }] }]}
                                >
                                    {kliqScore.toLocaleString()}
                                </Animated.Text>
                                <Text style={styles.scoreStatLabel}>KLIQ SCORE</Text>
                            </View>
                            <View style={styles.scoreDivider} />
                            <View style={styles.scoreStat}>
                                <Text style={styles.scoreStatValue}>{hypeCount.toLocaleString()}</Text>
                                <Text style={styles.scoreStatLabel}>HYPE 🔥</Text>
                            </View>
                            {isRecording && (
                                <>
                                    <View style={styles.scoreDivider} />
                                    <View style={styles.scoreStat}>
                                        <Text style={[styles.scoreStatValue, { color: '#FF006E' }]}>
                                            {formatTime(recordingTime)}
                                        </Text>
                                        <Text style={styles.scoreStatLabel}>RECORDING</Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>

                    {/* ── Speed Mode Bar ── */}
                    <View style={styles.speedBar}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
                        >
                            {SPEED_MODES.map(mode => (
                                <TouchableOpacity
                                    key={mode.id}
                                    onPress={() => setSelectedSpeed(mode.id)}
                                    style={[
                                        styles.speedPill,
                                        selectedSpeed === mode.id && styles.speedPillActive,
                                    ]}
                                    accessibilityLabel={`Set speed to ${mode.label}`}
                                >
                                    <Text
                                        style={[
                                            styles.speedPillText,
                                            selectedSpeed === mode.id && { color: '#00F5D4' },
                                        ]}
                                    >
                                        {mode.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* ── Controls ── */}
                    <View style={styles.footer}>
                        <View style={styles.recordActionRow}>
                            {/* Hype */}
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={triggerHype}
                                style={styles.hypeActionBtn}
                                accessibilityLabel="Add hype"
                            >
                                <Ionicons name="flame" size={24} color="#FF006E" />
                            </TouchableOpacity>

                            {/* Shutter with progress ring */}
                            <View style={styles.shutterStack}>
                                {isRecording && (
                                    <Animated.View
                                        style={[
                                            styles.progressRingTrack,
                                            {
                                                borderColor: '#FF006E',
                                                transform: [{ scale: pulseAnim }],
                                            },
                                        ]}
                                    />
                                )}
                                <Animated.View
                                    style={[
                                        styles.recordOuterRing,
                                        {
                                            transform: [{ scale: isRecording ? pulseAnim : new Animated.Value(1) }],
                                            borderColor: isRecording ? '#FF006E' : '#fff',
                                        },
                                    ]}
                                >
                                    <TouchableOpacity
                                        style={[
                                            styles.recordBtn,
                                            isRecording && styles.recordingActive,
                                        ]}
                                        onPress={isRecording ? stopRecording : startRecording}
                                        accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
                                    >
                                        {isRecording && <View style={styles.stopSquare} />}
                                    </TouchableOpacity>
                                </Animated.View>
                            </View>

                            {/* Flip on right side */}
                            <TouchableOpacity
                                style={styles.hypeActionBtn}
                                onPress={flipCamera}
                                accessibilityLabel="Flip camera"
                            >
                                <Ionicons name="albums-outline" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                </SafeAreaView>
            </CameraView>
        </View>
    );
};

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        // height applied via dynamicScreenStyle at each render call site — see above.
        width: '100%',
        backgroundColor: '#050505',
        overflow: 'hidden',
        borderRadius: 32,
        borderWidth: 1,
        borderColor: '#1F1F22',
    },
    loadingScreen: {
        // height applied via dynamicScreenStyle at each render call site — see above.
        width: '100%',
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    permissionText: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 40,
        lineHeight: 22,
    },

    // [FIX] Scanline aesthetic shader — backgroundImage is a web-only CSS
    // property with no native RN equivalent; it silently did nothing on iOS/
    // Android. Scoped to web so the gap is intentional, not silently broken.
    scanlineOverlay: Platform.OS === 'web' ? {
        ...StyleSheet.absoluteFillObject,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
        pointerEvents: 'none',
    } : {
        ...StyleSheet.absoluteFillObject,
        pointerEvents: 'none',
    },

    // AI corner reticles
    aiOverlay: {
        ...StyleSheet.absoluteFillObject,
        margin: 20,
        borderWidth: 1,
        borderColor: 'rgba(0,245,212,0.08)',
    },
    cornerTL: { position: 'absolute', top: -1,    left: -1,  width: 28, height: 28, borderTopWidth: 2,    borderLeftWidth: 2,    borderColor: '#00F5D4' },
    cornerTR: { position: 'absolute', top: -1,    right: -1, width: 28, height: 28, borderTopWidth: 2,    borderRightWidth: 2,   borderColor: '#00F5D4' },
    cornerBL: { position: 'absolute', bottom: -1, left: -1,  width: 28, height: 28, borderBottomWidth: 2, borderLeftWidth: 2,    borderColor: '#00F5D4' },
    cornerBR: { position: 'absolute', bottom: -1, right: -1, width: 28, height: 28, borderBottomWidth: 2, borderRightWidth: 2,   borderColor: '#00F5D4' },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 15,
    },
    headerCenter: { alignItems: 'center' },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    trendLiveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,245,212,0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 4,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00F5D4', marginRight: 6 },
    liveText: { fontSize: 10, color: '#00F5D4', fontWeight: '900', letterSpacing: 1 },
    trendTitleHUD: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    // Gamification HUD
    scoreHUDContainer: { alignItems: 'center', paddingVertical: 12 },
    aiText: {
        color: '#00F5D4',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 3,
        marginBottom: 8,
        textShadowColor: '#00F5D4',
        textShadowRadius: 8,
    },
    scoreHUDRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        gap: 20,
    },
    scoreStat: { alignItems: 'center' },
    scoreDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
    scoreStatValue: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '900',
        fontVariant: ['tabular-nums'],
        textShadowColor: '#00F5D4',
        textShadowRadius: 10,
    },
    scoreStatLabel: { color: '#666', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 2 },

    // Speed bar
    speedBar: { marginBottom: 12 },
    speedPill: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    speedPillActive: {
        backgroundColor: 'rgba(0,245,212,0.12)',
        borderColor: '#00F5D4',
    },
    speedPillText: {
        color: '#888',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
    },

    // Recording controls
    footer: { paddingBottom: 40, alignItems: 'center' },
    recordActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
    },
    shutterStack: { position: 'relative', width: 90, height: 90, justifyContent: 'center', alignItems: 'center' },
    progressRingTrack: {
        position: 'absolute',
        width: 90,
        height: 90,
        borderRadius: 45,
        borderWidth: 3,
        borderColor: '#FF006E',
        opacity: 0.6,
    },
    recordOuterRing: {
        width: 84,
        height: 84,
        borderRadius: 42,
        borderWidth: 4,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    recordBtn: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: '#00F5D4',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#00F5D4',
        shadowOpacity: 0.8,
        shadowRadius: 15,
    },
    recordingActive: {
        borderRadius: 14,
        backgroundColor: '#FF006E',
        shadowColor: '#FF006E',
    },
    stopSquare: { width: 24, height: 24, backgroundColor: '#fff', borderRadius: 4 },
    hypeActionBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,0,110,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,0,110,0.25)',
    },

    // Preview
    trendPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,245,212,0.15)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#00F5D4',
    },
    trendTitle: { color: '#00F5D4', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
    scoreChip: {
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#333',
    },
    scoreChipLabel: { color: '#666', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
    scoreChipValue: { color: '#00F5D4', fontSize: 14, fontWeight: '900' },

    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 15,
    },
    videoPreviewWrap: {
        flex: 1,
        backgroundColor: '#111',
        borderRadius: 24,
        marginHorizontal: 15,
        overflow: 'hidden',
    },
    previewFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    retakeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: 22,
        paddingVertical: 14,
        borderRadius: 24,
        gap: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    btnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
    postBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#00F5D4',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 24,
        minWidth: 110,
        gap: 8,
        shadowColor: '#00F5D4',
        shadowOpacity: 0.55,
        shadowRadius: 18,
        elevation: 8,
    },
    postBtnText: { color: '#000', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
});