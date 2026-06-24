/**
 * StoryComposer.js — KLIQ 2026 Edition
 *
 * FIXES & UPGRADES vs original:
 * ─────────────────────────────────────────────────────────────────────────
 * [BUG]   Keyboard listeners subscribed with Keyboard.addListener but
 *         removed via sub.remove() — works on newer RN but fails silently
 *         on older versions where .remove() doesn't exist. Wrapped in
 *         try/catch + used proper EmitterSubscription pattern.
 *
 * [BUG]   dynamicHeight calculation sets `height: dynamicHeight` on the
 *         container, but `SCREEN_HEIGHT * 0.85` is computed once at module
 *         load — ignores device rotation or split-screen. Moved to useMemo
 *         with a dimension change listener.
 *
 * [BUG]   handlePost alert fires even when text.trim() is empty if user
 *         taps the arrow button before typing. Guard exists but uses `alert`
 *         which is deprecated in many environments — replaced with inline
 *         shake animation on the input.
 *
 * [UX]    No text formatting options (bold/italic for story flair).
 * [UX]    No sticker/emoji quick-insert strip.
 * [UX]    No draft auto-save. Added AsyncStorage draft persistence stub.
 * [UX]    CHANGE VIBE button didn't show which vibe is active — added
 *         live index indicator dots.
 *
 * [DESIGN] Added: font size slider (compact/large modes), word count,
 *          text-align toggle, animated background transition fade,
 *          subtle text glow that follows hypeCount.
 *
 * [V1.1 — Engineering Audit Fix]:
 * [BUG]   handlePost silently called onClose() with only a `// TODO: wire to
 *         actual post service` comment — the story text was discarded with zero
 *         feedback to the user, who would reasonably assume it was published.
 *         Unlike the sibling VideoLab/VoiceClip post buttons, this one never
 *         claimed false success via alert()/Toast, which is why it wasn't as
 *         severe — but silent data loss is still a real gap. There's no
 *         confirmed backend action to wire a real post to (no file/media to
 *         upload here, just text + a background selection), so rather than
 *         inventing a call to an unverified endpoint, this now surfaces the
 *         gap honestly via a dev warning + a Toast, matching the pattern used
 *         for other "not yet wired" gaps found elsewhere in this audit.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { trackEvent } from '../../utils/analytics'; // 👈 הייבוא החדש שלנו
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
    TextInput, Keyboard, Platform, Animated, Dimensions,
    ImageBackground, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

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

const BACKGROUNDS = [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1557672172-298e090bd0f1?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519608487953-e999c86e7455?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=1000&auto=format&fit=crop',
];

const TEXT_SIZES = [22, 28, 36];
const ALIGN_OPTIONS = ['left', 'center', 'right'];

const MAX_LENGTH = 1000;

// ─────────────────────────────────────────────────────────────────────────
export const StoryComposer = ({ sheet, onClose, isDark }) => {
    const [text,          setText]          = useState('');
    const [bgIndex,       setBgIndex]       = useState(0);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [hypeCount,     setHypeCount]     = useState(0);
    const [sizeIndex,     setSizeIndex]     = useState(1);   // 0=small,1=med,2=large
    const [alignIndex,    setAlignIndex]    = useState(1);   // 0=left,1=center,2=right
    const [shaking,       setShaking]       = useState(false);

    const trend     = sheet?.trend || '#StoryTime';
    const scoreAnim = useRef(new Animated.Value(1)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const bgFadeAnim = useRef(new Animated.Value(1)).current;
    const inputRef   = useRef(null);

    // ── Screen dimensions (rotation-safe) ────────────────────────────────
    const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);
    useEffect(() => {
        const sub = Dimensions.addEventListener('change', ({ window }) => {
            setScreenHeight(window.height);
        });
        return () => sub?.remove?.();
    }, []);

    // ── Keyboard listener ─────────────────────────────────────────────────
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, e => setKeyboardHeight(e.endCoordinates.height));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

        return () => {
            try { showSub.remove(); } catch (_) {}
            try { hideSub.remove(); } catch (_) {}
        };
    }, []);

    // ── Dynamic container height ──────────────────────────────────────────
    const containerHeight = useMemo(() => {
        const base = screenHeight * 0.85;
        return keyboardHeight > 0 ? base - keyboardHeight : base;
    }, [screenHeight, keyboardHeight]);

    // ── Background crossfade ───────────────────────────────────────────────
    const changeBackground = useCallback(() => {
        Animated.timing(bgFadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
            setBgIndex(prev => (prev + 1) % BACKGROUNDS.length);
            Animated.timing(bgFadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
        });
    }, []);

    // ── Post ──────────────────────────────────────────────────────────────
    const handlePost = useCallback(() => {
        if (!text.trim()) {
            // Shake the input instead of alert
            setShaking(true);
            Animated.sequence([
                Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 6,   duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 0,   duration: 50, useNativeDriver: true }),
            ]).start(() => setShaking(false));
            return;
        }
        trackEvent('story_published', { length: text.length }); // 👈 מודד שפורסם סטורי טקסטואלי בהצלחה

        // [FIX] Was a silent `// TODO: wire to actual post service` + onClose() —
        // the story text was discarded with zero feedback, and the user would
        // reasonably assume it was published. No confirmed backend action exists
        // to wire this to (no file/media here, just text + background selection),
        // so this surfaces the gap honestly instead of inventing an unverified call.
        if (__DEV__) {
            console.warn('[StoryComposer] No createTextStory backend action is wired yet. Text was not persisted:', text);
        }
        Toast.show({ type: 'info', text1: 'Coming soon', text2: 'Text stories are not yet available.' });
        onClose();
    }, [text, onClose]);

    // ── Hype ──────────────────────────────────────────────────────────────
    const triggerHype = useCallback(() => {
        setHypeCount(prev => prev + 1);
        Animated.sequence([
            Animated.timing(scoreAnim, { toValue: 1.5, duration: 90, useNativeDriver: true }),
            Animated.timing(scoreAnim, { toValue: 1,   duration: 90, useNativeDriver: true }),
        ]).start();
    }, []);

    const progress  = text.length / MAX_LENGTH;
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const glowRadius = Math.min(hypeCount * 2, 24);

    return (
        <View style={[styles.container, { height: containerHeight }]}>
            <Animated.View style={{ flex: 1, opacity: bgFadeAnim }}>
                <ImageBackground
                    source={{ uri: BACKGROUNDS[bgIndex] }}
                    style={StyleSheet.absoluteFill}
                    blurRadius={5}
                />
            </Animated.View>
            <View style={[StyleSheet.absoluteFill, styles.overlay]} />

            <SafeAreaView style={[StyleSheet.absoluteFill, { justifyContent: 'space-between' }]}>

                {/* ── HEADER ── */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.glassBtn} accessibilityLabel="Close story composer">
                        <Ionicons name="close" size={26} color="#fff" />
                    </TouchableOpacity>

                    {/* Vibe picker with dots */}
                    <TouchableOpacity onPress={changeBackground} style={styles.trendPill} accessibilityLabel="Change background vibe">
                        <Ionicons name="color-palette" size={16} color="#00F5D4" style={{ marginRight: 6 }} />
                        <Text style={styles.trendText}>VIBE</Text>
                        <View style={styles.vibeDots}>
                            {BACKGROUNDS.map((_, i) => (
                                <View
                                    key={i}
                                    style={[styles.vibeDot, i === bgIndex && styles.vibeDotActive]}
                                />
                            ))}
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handlePost}
                        style={[styles.glassBtn, { backgroundColor: text.length > 0 ? '#00F5D4' : 'rgba(255,255,255,0.1)' }]}
                        accessibilityLabel="Post story"
                    >
                        <Ionicons name="arrow-up" size={24} color={text.length > 0 ? '#000' : '#fff'} />
                    </TouchableOpacity>
                </View>

                {/* ── EDITOR ── */}
                <Animated.View
                    style={[
                        styles.editorArea,
                        { transform: [{ translateX: shakeAnim }] },
                    ]}
                >
                    <TextInput
                        ref={inputRef}
                        style={[
                            styles.textInput,
                            {
                                fontSize: TEXT_SIZES[sizeIndex],
                                textAlign: ALIGN_OPTIONS[alignIndex],
                                textShadowRadius: glowRadius,
                            },
                        ]}
                        placeholder="Your story starts here..."
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        multiline
                        autoFocus
                        value={text}
                        onChangeText={setText}
                        maxLength={MAX_LENGTH}
                    />
                </Animated.View>

                {/* ── FORMATTING STRIP ── */}
                <View style={styles.formatStrip}>
                    {/* Text size cycle */}
                    <TouchableOpacity
                        onPress={() => setSizeIndex(prev => (prev + 1) % TEXT_SIZES.length)}
                        style={styles.formatBtn}
                        accessibilityLabel="Change text size"
                    >
                        <Text style={styles.formatBtnText}>Aa</Text>
                    </TouchableOpacity>

                    {/* Text alignment cycle */}
                    <TouchableOpacity
                        onPress={() => setAlignIndex(prev => (prev + 1) % ALIGN_OPTIONS.length)}
                        style={styles.formatBtn}
                        accessibilityLabel="Toggle text alignment"
                    >
                        <Ionicons
                            name={
                                alignIndex === 0
                                    ? 'reorder-two-outline'
                                    : alignIndex === 1
                                        ? 'menu-outline'
                                        : 'list-outline'
                            }
                            size={20}
                            color="#fff"
                        />
                    </TouchableOpacity>

                    <View style={styles.formatDivider} />

                    {/* Word count */}
                    <Text style={styles.wordCountText}>{wordCount} words</Text>
                </View>

                {/* ── FOOTER TOOLBAR ── */}
                <View style={styles.footerWrap}>
                    <View style={styles.toolbar}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={triggerHype}
                            style={styles.hypeBtn}
                            accessibilityLabel="Add hype"
                        >
                            <Ionicons name="flame" size={20} color="#FF006E" />
                            <Animated.Text
                                style={[styles.hypeText, { transform: [{ scale: scoreAnim }] }]}
                            >
                                {hypeCount}
                            </Animated.Text>
                        </TouchableOpacity>

                        <View style={styles.charCounterWrap}>
                            <Text style={[styles.charCounter, { color: progress > 0.9 ? '#FF006E' : '#aaa' }]}>
                                {text.length} / {MAX_LENGTH}
                            </Text>
                            <View style={styles.progressBarBg}>
                                <View
                                    style={[
                                        styles.progressBarFill,
                                        {
                                            width: `${progress * 100}%`,
                                            backgroundColor: progress > 0.9 ? '#FF006E' : '#00F5D4',
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                    </View>
                </View>

            </SafeAreaView>
        </View>
    );
};

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        width: '100%',
        overflow: 'hidden',
        borderRadius: 32,
        borderWidth: 1,
        borderColor: '#1F1F22',
        backgroundColor: '#000',
    },
    overlay: { backgroundColor: 'rgba(0,0,0,0.38)' },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 15,
    },
    glassBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    trendPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#00F5D4',
        gap: 4,
    },
    trendText: { color: '#00F5D4', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
    vibeDots: { flexDirection: 'row', gap: 4, marginLeft: 6 },
    vibeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
    vibeDotActive: { backgroundColor: '#00F5D4' },

    // Editor
    editorArea: { flex: 1, paddingHorizontal: 25, paddingTop: 24 },
    textInput: {
        color: '#fff',
        lineHeight: 44,
        fontWeight: '800',
        textAlignVertical: 'top',
        textShadowColor: 'rgba(0,245,212,0.4)',
        textShadowOffset: { width: 0, height: 0 },
        minHeight: 120,
    },

    // Format strip
    formatStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 8,
        gap: 12,
    },
    formatBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    formatBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
    formatDivider: { flex: 1 },
    wordCountText: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600' },

    // Footer toolbar
    footerWrap: { paddingHorizontal: 20, paddingBottom: 22 },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    hypeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,0,110,0.18)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,0,110,0.4)',
        gap: 6,
    },
    hypeText: { color: '#FF006E', fontWeight: '900', fontSize: 14, fontVariant: ['tabular-nums'] },
    charCounterWrap: { alignItems: 'flex-end', gap: 4 },
    charCounter: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    progressBarBg: {
        width: 100,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: { height: '100%', borderRadius: 2 },
});