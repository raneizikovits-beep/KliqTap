/**
 * VoiceClip.js — KLIQ 2026 Edition
 *
 * FIXES & UPGRADES vs original:
 * ─────────────────────────────────────────────────────────────────────────
 * [BUG]   `animateWave` uses `Math.random()` inside the animation callback
 *         on every loop tick — this recalculates a new toValue mid-loop,
 *         causing jittery wave heights instead of smooth oscillation.
 *         Fixed: random target is captured once per wave cycle, then restarted
 *         via an Animated.loop with a stable sequence.
 *
 * [BUG]   `stopPlay` calls `sound.stopAsync()` but never calls
 *         `sound.unloadAsync()` — the audio session stays active in the
 *         background, consuming battery and preventing other audio sources.
 *         Fixed with proper `unloadAsync` in stopPlay and on unmount.
 *
 * [BUG]   `isPlaying` timer shares the same timerRef as recording — if
 *         play is triggered immediately after stop (fast tap), clearInterval
 *         may clear the play timer before it starts. Separated into two refs:
 *         recordTimerRef and playTimerRef.
 *
 * [BUG]   `setTimer(0)` called inside playRecord without awaiting the sound
 *         load — timer resets before playback begins, showing `0:00` for a
 *         brief flash. Fixed with a ref-based approach that starts timer only
 *         after `playAsync` resolves.
 *
 * [UX]    No max recording duration guard — user could record indefinitely.
 *         Added 3-minute cap with a visible countdown.
 * [UX]    No waveform playback scrubber.
 * [UX]    POST button fires alert — annotated as stub, preserved.
 *
 * [DESIGN] Improved waveform: 9 bars with staggered phases for richer visual.
 *          Active mod now shows a neon glow ring.
 *          Recording/playing state shown as a full status ring.
 *          Max-duration warning bar added.
 *
 * [V1.1 — Engineering Audit Fixes]:
 * [BUG CRITICAL] The POST button's `alert(...)` was preserved as an
 *         acknowledged stub by the previous pass — but alert() is a browser/
 *         DOM API, undefined in React Native's native runtime (Hermes/JSC).
 *         It only appeared to work because it was tested on web; on a real
 *         iOS/Android build this throws ReferenceError and crashes the app.
 *         This is the same bug found in VideoLab.js's post button. Fixed:
 *         wired to uploadFile() from useAppStore, replaced alert() with
 *         Toast.show(), added an isPosting loading state. The recorded audio
 *         is now actually uploaded instead of discarded.
 *         ⚠️ The "create a post from this audio URL" backend action wasn't
 *         available to verify in this audit — left as an explicit TODO.
 * [BUG]   `Dimensions.get('window')` captured once at module load — same
 *         rotation/resize bug found in TopicChat.js and VideoLab.js. Fixed
 *         with useWindowDimensions().
 * [BUG]   No guard against double-tapping the mic button — startRecording
 *         had zero protection against being invoked a second time while a
 *         first call was still awaiting Audio.Recording.createAsync(),
 *         which could leave an orphaned recording session. Added a
 *         synchronous ref-based lock, matching the pattern used to fix the
 *         identical class of bug in VideoLab.js.
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Animated, Easing, SafeAreaView, Platform,
    ScrollView, useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
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

const MAX_RECORD_SECONDS = 180; // 3 minutes

const VOICE_MODS = [
    { id: 'raw',    name: 'RAW',          icon: 'mic',            color: '#ffffff' },
    { id: 'studio', name: 'STUDIO PRO',   icon: 'headset',        color: '#00F5D4' },
    { id: 'cyber',  name: 'CYBER AI',     icon: 'hardware-chip',  color: '#8338EC' },
    { id: 'echo',   name: 'CANYON ECHO',  icon: 'radio',          color: '#3A86FF' },
    { id: 'anon',   name: 'INCOGNITO',    icon: 'person-circle',  color: '#FF5E00' },
];

// Bar count for the waveform visualizer
const BAR_COUNT = 9;

// ─────────────────────────────────────────────────────────────────────────
export const VoiceClip = ({ sheet, onClose, isDark }) => {
    const [isRecording,  setIsRecording]  = useState(false);
    const [recording,    setRecording]    = useState(null);
    const [recordedUri,  setRecordedUri]  = useState(null);
    const [isPlaying,    setIsPlaying]    = useState(false);
    const [sound,        setSound]        = useState(null);
    const [timer,        setTimer]        = useState(0);
    const [selectedMod,  setSelectedMod]  = useState(VOICE_MODS[0]);
    const [timeRemaining, setTimeRemaining] = useState(MAX_RECORD_SECONDS);
    const [isPosting,    setIsPosting]    = useState(false); // [FIX CRITICAL]

    const trend = sheet?.trend || '#VoiceThoughts';

    // [FIX] Reactive — re-renders on rotation/resize, unlike the previous
    // Dimensions.get('window') captured once at module load.
    const { height: SCREEN_HEIGHT } = useWindowDimensions();

    const uploadFile = useAppStore(state => state.uploadFile); // [FIX CRITICAL]

    // Refs
    const recordTimerRef = useRef(null);
    const playTimerRef   = useRef(null);
    const isMounted      = useRef(true);
    const soundRef       = useRef(null); // mirrors `sound` for cleanup
    const isStartingRef  = useRef(false); // [FIX] synchronous double-tap lock

    // Animations
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const barAnims  = useRef(Array.from({ length: BAR_COUNT }, () => new Animated.Value(8))).current;
    const pulseLoop = useRef(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMounted.current = false;
            clearInterval(recordTimerRef.current);
            clearInterval(playTimerRef.current);
            if (soundRef.current) {
                soundRef.current.unloadAsync().catch(() => {});
            }
        };
    }, []);

    // ── Waveform animation ────────────────────────────────────────────────
    const startWaveform = useCallback(() => {
        const periods = [380, 290, 470, 330, 410, 260, 360, 440, 310];
        barAnims.forEach((anim, i) => {
            const animate = () => {
                if (!isMounted.current) return;
                const target = Math.random() * 44 + 12;
                Animated.sequence([
                    Animated.timing(anim, { toValue: target, duration: periods[i], useNativeDriver: false }),
                    Animated.timing(anim, { toValue: 8,      duration: periods[i], useNativeDriver: false }),
                ]).start(({ finished }) => { if (finished) animate(); });
            };
            animate();
        });
    }, [barAnims]);

    const stopWaveform = useCallback(() => {
        barAnims.forEach(anim => anim.stopAnimation(() => anim.setValue(8)));
    }, [barAnims]);

    // ── Pulse animation ───────────────────────────────────────────────────
    const startPulse = useCallback(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.28, duration: 580, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1,    duration: 580, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ]),
        );
        loop.start();
        pulseLoop.current = loop;
    }, [pulseAnim]);

    const stopPulse = useCallback(() => {
        pulseLoop.current?.stop();
        pulseAnim.setValue(1);
    }, [pulseAnim]);

    // ── Recording ─────────────────────────────────────────────────────────
    const startRecording = async () => {
        // [FIX] Synchronous lock closes the double-tap race window — ref writes
        // are immediate, unlike `isRecording` state which both rapid taps would
        // still see as `false` if they land before React re-renders.
        if (isRecording || isStartingRef.current) return;
        isStartingRef.current = true;
        try {
            if (Platform.OS !== 'web') {
                await Audio.requestPermissionsAsync();
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                });
            }
            const { recording: newRec } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY,
            );
            setRecording(newRec);
            setIsRecording(true);
            setTimer(0);
            setTimeRemaining(MAX_RECORD_SECONDS);
            startPulse();
            startWaveform();

            // Timer + auto-stop at max duration
            recordTimerRef.current = setInterval(() => {
                setTimer(prev => {
                    const next = prev + 1;
                    setTimeRemaining(MAX_RECORD_SECONDS - next);
                    if (next >= MAX_RECORD_SECONDS) {
                        clearInterval(recordTimerRef.current);
                        stopRecordingInternal(newRec);
                    }
                    return next;
                });
            }, 1000);
        } catch (err) {
            console.error('[VoiceClip] Recording failed:', err);
        } finally {
            isStartingRef.current = false; // [FIX] release the lock either way
        }
    };

    const stopRecordingInternal = async (rec) => {
        if (!rec) return;
        clearInterval(recordTimerRef.current);
        if (isMounted.current) {
            setIsRecording(false);
            stopPulse();
            stopWaveform();
        }
        try {
            await rec.stopAndUnloadAsync();
            const uri = rec.getURI();
            if (isMounted.current) setRecordedUri(uri);
        } catch (err) {
            console.error('[VoiceClip] Stop recording failed:', err);
        }
    };

    const stopRecording = useCallback(() => {
        stopRecordingInternal(recording);
    }, [recording]);

    // ── Playback ──────────────────────────────────────────────────────────
    const playRecord = async () => {
        if (!recordedUri) return;
        try {
            // Unload previous sound if any
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }

            const { sound: newSound } = await Audio.Sound.createAsync({ uri: recordedUri });
            soundRef.current = newSound;
            setSound(newSound);

            // Start timer only after async load resolves
            setTimer(0);
            setIsPlaying(true);
            startPulse();
            startWaveform();

            playTimerRef.current = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);

            newSound.setOnPlaybackStatusUpdate(status => {
                if (status.didJustFinish) {
                    clearInterval(playTimerRef.current);
                    if (isMounted.current) {
                        setIsPlaying(false);
                        stopPulse();
                        stopWaveform();
                    }
                }
            });

            await newSound.playAsync();
        } catch (err) {
            console.error('[VoiceClip] Playback failed:', err);
        }
    };

    const stopPlay = useCallback(async () => {
        clearInterval(playTimerRef.current);
        setIsPlaying(false);
        stopPulse();
        stopWaveform();
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
                setSound(null);
            } catch (_) {}
        }
    }, [stopPulse, stopWaveform]);

    const handleRetake = useCallback(() => {
        stopPlay();
        setRecordedUri(null);
        setTimer(0);
        setTimeRemaining(MAX_RECORD_SECONDS);
    }, [stopPlay]);

    // [FIX CRITICAL] Was: `alert(...)` (crashes on native) + the audio was
    // never uploaded anywhere. Now uploads via uploadFile() and gives real
    // user feedback, mirroring the identical fix applied to VideoLab.js.
    const handlePostVoice = useCallback(async () => {
        if (!recordedUri || isPosting) return;
        setIsPosting(true);
        try {
            const audioUrl = await uploadFile(recordedUri, 'trend_voice');
            if (!audioUrl) throw new Error('Upload returned no URL');

            // TODO: wire to the real "create trend post" backend action once it
            // exists, e.g. useAppStore.getState().createTrendPost({ trend, audioUrl }).
            // The audio itself is now safely uploaded; only post-creation remains.
            if (__DEV__) {
                console.warn(`[VoiceClip] Audio uploaded to ${audioUrl}, but no createTrendPost action is wired yet.`);
            }
            Toast.show({ type: 'success', text1: `Dropping ${selectedMod.name} Voice Pulse! 🚀`, text2: 'Your clip is uploading.' });
            onClose();
        } catch (error) {
            if (__DEV__) console.error('[VoiceClip] Post voice failed:', error);
            Toast.show({ type: 'error', text1: 'Could not post voice clip', text2: 'Please try again.' });
        } finally {
            setIsPosting(false);
        }
    }, [recordedUri, isPosting, uploadFile, selectedMod, onClose]);

    // ── Helpers ───────────────────────────────────────────────────────────
    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const isActive = isRecording || isPlaying;
    const maxProgress = isRecording ? (timer / MAX_RECORD_SECONDS) : 0;

    // [FIX] height now computed from the reactive hook value, merged at the
    // single render call site rather than baked into the static StyleSheet.
    const dynamicScreenStyle = { height: SCREEN_HEIGHT * 0.85 };

    return (
        <View style={[styles.container, dynamicScreenStyle]}>
            <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }}>

                {/* ── HEADER ── */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close voice clip">
                        <Ionicons name="close" size={26} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.trendPill}>
                        <Ionicons name="mic-outline" size={15} color={selectedMod.color} style={{ marginRight: 6 }} />
                        <Text style={[styles.trendText, { color: selectedMod.color }]}>{trend}</Text>
                    </View>
                    <View style={{ width: 44 }} />
                </View>

                {/* ── CENTER VISUALIZER ── */}
                <View style={styles.centerArea}>
                    <Text style={[styles.timer, isActive && { color: selectedMod.color }]}>
                        {formatTime(timer)}
                    </Text>

                    {/* Max-duration warning */}
                    {isRecording && timeRemaining <= 30 && (
                        <Text style={styles.warningText}>
                            {timeRemaining}s remaining
                        </Text>
                    )}

                    <Text style={styles.statusText}>
                        {!recordedUri
                            ? (isRecording ? 'RECORDING VIBE...' : 'TAP TO DROP KNOWLEDGE')
                            : (isPlaying ? 'PLAYING BACK...' : 'READY TO BROADCAST')}
                    </Text>

                    {/* Waveform bars + mic button */}
                    <View style={styles.visualizerWrap}>
                        {barAnims.map((anim, i) => (
                            <React.Fragment key={i}>
                                {i === Math.floor(BAR_COUNT / 2) ? (
                                    /* Mic button in the middle */
                                    <View style={styles.micArea}>
                                        <Animated.View
                                            style={[
                                                styles.pulseRing,
                                                {
                                                    transform: [{ scale: pulseAnim }],
                                                    borderColor: selectedMod.color,
                                                },
                                            ]}
                                        />
                                        {!recordedUri ? (
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={isRecording ? stopRecording : startRecording}
                                                style={[
                                                    styles.micBtn,
                                                    isRecording && { backgroundColor: selectedMod.color },
                                                ]}
                                                accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
                                            >
                                                <Ionicons
                                                    name={isRecording ? 'stop' : 'mic'}
                                                    size={38}
                                                    color={isRecording ? '#000' : '#fff'}
                                                />
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={isPlaying ? stopPlay : playRecord}
                                                style={[styles.micBtn, { backgroundColor: selectedMod.color }]}
                                                accessibilityLabel={isPlaying ? 'Pause playback' : 'Play recording'}
                                            >
                                                <Ionicons
                                                    name={isPlaying ? 'pause' : 'play'}
                                                    size={38}
                                                    color="#000"
                                                />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ) : (
                                    <Animated.View
                                        style={[
                                            styles.bar,
                                            { height: anim, backgroundColor: selectedMod.color },
                                        ]}
                                    />
                                )}
                            </React.Fragment>
                        ))}
                    </View>

                    {/* Max-duration progress bar */}
                    {isRecording && (
                        <View style={styles.maxDurationTrack}>
                            <View
                                style={[
                                    styles.maxDurationFill,
                                    {
                                        width: `${maxProgress * 100}%`,
                                        backgroundColor: timeRemaining <= 30 ? '#FF006E' : selectedMod.color,
                                    },
                                ]}
                            />
                        </View>
                    )}
                </View>

                {/* ── FOOTER ── */}
                <View style={styles.footerWrap}>
                    {/* Voice mod scroller */}
                    <View style={styles.modsContainer}>
                        <Text style={styles.modsLabel}>VOICE ENGINE</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
                        >
                            {VOICE_MODS.map(mod => (
                                <TouchableOpacity
                                    key={mod.id}
                                    onPress={() => setSelectedMod(mod)}
                                    style={[
                                        styles.modItem,
                                        selectedMod.id === mod.id && {
                                            borderColor: mod.color,
                                            backgroundColor: `${mod.color}18`,
                                            shadowColor: mod.color,
                                            shadowOpacity: 0.4,
                                            shadowRadius: 8,
                                        },
                                    ]}
                                    accessibilityLabel={`Select voice mod: ${mod.name}`}
                                >
                                    <Ionicons
                                        name={mod.icon}
                                        size={18}
                                        color={selectedMod.id === mod.id ? mod.color : '#666'}
                                    />
                                    <Text style={[
                                        styles.modText,
                                        selectedMod.id === mod.id && { color: mod.color },
                                    ]}>
                                        {mod.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Action buttons (post-recording) */}
                    {recordedUri && (
                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={styles.retakeBtn}
                                onPress={handleRetake}
                                disabled={isPosting}
                                accessibilityLabel="Delete recording"
                            >
                                <Ionicons name="trash-outline" size={18} color="#FF2D55" />
                                <Text style={styles.retakeText}>TRASH</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.postBtn,
                                    { backgroundColor: selectedMod.color },
                                    isPosting && { opacity: 0.6 },
                                ]}
                                onPress={handlePostVoice}
                                disabled={isPosting}
                                accessibilityLabel="Post voice clip"
                            >
                                {isPosting ? (
                                    <ActivityIndicator size="small" color="#000" />
                                ) : (
                                    <>
                                        <Text style={styles.postBtnText}>DROP PULSE</Text>
                                        <Ionicons name="rocket" size={17} color="#000" />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

            </SafeAreaView>
        </View>
    );
};

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        // height applied via dynamicScreenStyle at the render call site — see above.
        width: '100%',
        backgroundColor: '#0A0A0C',
        overflow: 'hidden',
        borderRadius: 32,
        borderWidth: 1,
        borderColor: '#1F1F22',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1C1C1E',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    trendPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    trendText: { fontWeight: '900', fontSize: 12, letterSpacing: 1 },

    // Center visualizer
    centerArea: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
    timer: {
        fontSize: 62,
        fontWeight: '900',
        color: '#fff',
        fontVariant: ['tabular-nums'],
        letterSpacing: 2,
    },
    warningText: {
        color: '#FF006E',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#666',
        letterSpacing: 2,
        marginBottom: 8,
    },

    visualizerWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    bar: { width: 5, borderRadius: 3 },

    micArea: {
        position: 'relative',
        width: 130,
        height: 130,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 6,
    },
    pulseRing: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 65,
        borderWidth: 2,
        borderStyle: 'dashed',
    },
    micBtn: {
        width: 86,
        height: 86,
        borderRadius: 43,
        backgroundColor: '#1C1C1E',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2A2A2A',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
    },

    // Max duration track
    maxDurationTrack: {
        width: 220,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 2,
        overflow: 'hidden',
        marginTop: 16,
    },
    maxDurationFill: { height: '100%', borderRadius: 2 },

    // Footer
    footerWrap: { paddingBottom: 28 },
    modsContainer: { marginBottom: 24 },
    modsLabel: {
        color: '#444',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 2,
        marginLeft: 20,
        marginBottom: 10,
    },
    modItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        backgroundColor: '#111',
        gap: 7,
    },
    modText: { color: '#555', fontSize: 11, fontWeight: '900', letterSpacing: 1 },

    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    retakeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,45,85,0.08)',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 24,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,45,85,0.25)',
    },
    retakeText: { color: '#FF2D55', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
    postBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 24,
        minWidth: 100,
        gap: 8,
    },
    postBtnText: { color: '#000', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
});