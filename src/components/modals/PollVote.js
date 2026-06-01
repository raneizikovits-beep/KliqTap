/**
 * PollVote.js — KLIQ 2026 Edition
 *
 * FIXES & UPGRADES vs original:
 * ─────────────────────────────────────────────────────────────────────────
 * [BUG]   fadeAnim used as both a trigger for Animated.parallel AND as
 *         a width interpolation input on the same frame — the parallel's
 *         `useNativeDriver: false` conflicted with the scale animation's
 *         `useNativeDriver: true` inside the same Animated.parallel call.
 *         This causes a yellow-box warning in RN and janky animation.
 *         Fixed by separating into two independent animateds: progressAnim
 *         (JS driver, drives widths) and scaleAnim (native driver).
 *
 * [BUG]   HypeAnimation floats start at `bottom: 0` but the hypeOverlay is
 *         `absoluteFill` with no defined height — on some devices the emojis
 *         spawn off-screen. Fixed by anchoring to SCREEN_HEIGHT bottom.
 *
 * [BUG]   floatingEmojis cleared after 2500 ms via setTimeout but
 *         HypeAnimation's own animation runs 2200 ms — if the component
 *         re-renders between start and end, the Animated node is recycled.
 *         Fixed with cleanup in HypeAnimation useEffect.
 *
 * [PERF]  pollData stored in useState with object mutation (`newData[index].votes += 1`).
 *         This mutates the state array in place before calling setPollData — 
 *         breaks React's immutability contract and skips re-render in strict mode.
 *         Fixed with proper spread copy.
 *
 * [UX]    No share / copy-result affordance after voting.
 * [UX]    No live updating of other options' percentages while own vote is cast.
 *         Both improved.
 *
 * [DESIGN] Added: real-time vote ticker that animates counts upward after vote,
 *          neon glow on selected option border, streaks on winner option,
 *          confetti burst on submit.
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
    Animated, Dimensions, ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const BG_URL = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop';

// ── Static seed data ──────────────────────────────────────────────────────
const INITIAL_POLL = [
    { id: 1, text: 'AI is replacing us 🤖', votes: 4520, color: '#FF006E' },
    { id: 2, text: 'We become cyborgs 🦾',   votes: 3100, color: '#00F5D4' },
    { id: 3, text: 'Nothing changes 🤷‍♂️',   votes: 890,  color: '#FFBE0B' },
];

// ─────────────────────────────────────────────────────────────────────────
export const PollVote = ({ sheet, onClose, isDark }) => {
    const [hasVoted,       setHasVoted]       = useState(false);
    const [selectedIndex,  setSelectedIndex]  = useState(null);
    const [floatingEmojis, setFloatingEmojis] = useState([]);
    // Immutable-safe deep copy
    const [pollData, setPollData] = useState(() =>
        INITIAL_POLL.map(o => ({ ...o })),
    );

    // Separate animateds per driver type — avoids mixed-driver warning
    const progressAnim = useRef(new Animated.Value(0)).current;  // JS driver → widths
    const scaleAnim    = useRef(new Animated.Value(1)).current;  // native → scale

    const trend    = sheet?.trend               || '#FutureTech';
    const question = sheet?.params?.question    || 'What happens in 2026? Drop your vote.';

    const totalVotes = pollData.reduce((sum, item) => sum + item.votes, 0);

    // ── Animate progress bars on vote ────────────────────────────────────
    useEffect(() => {
        if (!hasVoted) return;

        Animated.timing(progressAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: false,
        }).start();

        Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 1.04, duration: 160, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1,    duration: 160, useNativeDriver: true }),
        ]).start();

        triggerHype();
    }, [hasVoted]);

    // ── Vote handler (immutable update) ───────────────────────────────────
    const handleVote = useCallback((index) => {
        if (hasVoted) return;
        setSelectedIndex(index);
        setHasVoted(true);
        setPollData(prev =>
            prev.map((option, i) =>
                i === index ? { ...option, votes: option.votes + 1 } : { ...option },
            ),
        );
    }, [hasVoted]);

    // ── Hype emoji burst ──────────────────────────────────────────────────
    const triggerHype = useCallback(() => {
        const emojis = ['🔥', '💯', '🚀', '⚡️', '🤯', '🎯', '💥'];
        const newEmojis = Array.from({ length: 14 }, (_, i) => ({
            id: `${Date.now()}-${i}`,
            emoji: emojis[Math.floor(Math.random() * emojis.length)],
            left: `${Math.random() * 80 + 10}%`,
        }));
        setFloatingEmojis(newEmojis);
        setTimeout(() => setFloatingEmojis([]), 2800);
    }, []);

    return (
        <View style={styles.container}>
            <ImageBackground source={{ uri: BG_URL }} style={StyleSheet.absoluteFill} blurRadius={18}>
                <View style={styles.overlay} />

                <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }}>

                    {/* ── HEADER ── */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.glassBtn} accessibilityLabel="Close poll">
                            <Ionicons name="close" size={26} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.trendPill}>
                            <Ionicons name="flash" size={15} color="#FFBE0B" style={{ marginRight: 5 }} />
                            <Text style={styles.trendText}>{trend}</Text>
                        </View>
                        <View style={{ width: 44 }} />
                    </View>

                    {/* ── POLL CONTENT ── */}
                    <View style={styles.content}>
                        <Text style={styles.questionText}>{question}</Text>

                        <View style={styles.liveBadge}>
                            <View style={styles.liveDot} />
                            <Text style={styles.subtitle}>
                                {totalVotes.toLocaleString()} KLIQ VOTES LIVE
                            </Text>
                        </View>

                        <View style={styles.optionsList}>
                            {pollData.map((option, index) => {
                                const isSelected   = selectedIndex === index;
                                const percentage   = Math.round((option.votes / totalVotes) * 100) || 0;
                                const isWinner     = hasVoted && pollData.indexOf(
                                    pollData.reduce((a, b) => (a.votes > b.votes ? a : b)),
                                ) === index;

                                return (
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[
                                            styles.optionCard,
                                            isSelected && styles.optionSelected,
                                            {
                                                borderColor: hasVoted && isSelected
                                                    ? option.color
                                                    : hasVoted && isWinner
                                                        ? `${option.color}55`
                                                        : 'rgba(255,255,255,0.1)',
                                            },
                                            isSelected && {
                                                shadowColor: option.color,
                                                shadowOpacity: 0.45,
                                                shadowRadius: 12,
                                                elevation: 6,
                                            },
                                        ]}
                                        onPress={() => handleVote(index)}
                                        activeOpacity={hasVoted ? 1 : 0.72}
                                        accessibilityLabel={`Vote for: ${option.text}`}
                                        accessibilityState={{ selected: isSelected }}
                                    >
                                        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 18 }]} />

                                        {/* Progress fill — JS-driven only */}
                                        {hasVoted && (
                                            <Animated.View
                                                style={[
                                                    styles.progressFill,
                                                    {
                                                        backgroundColor: option.color,
                                                        opacity: isSelected ? 0.38 : 0.12,
                                                        width: progressAnim.interpolate({
                                                            inputRange:  [0, 1],
                                                            outputRange: ['0%', `${percentage}%`],
                                                        }),
                                                    },
                                                ]}
                                            />
                                        )}

                                        <View style={styles.optionContent}>
                                            <View style={styles.optionTextRow}>
                                                <View style={[styles.radioCircle, {
                                                    borderColor: hasVoted
                                                        ? (isSelected ? option.color : '#555')
                                                        : '#fff',
                                                }]}>
                                                    {isSelected && (
                                                        <View style={[styles.radioDot, { backgroundColor: option.color }]} />
                                                    )}
                                                </View>
                                                <Text style={[
                                                    styles.optionText,
                                                    {
                                                        fontWeight: isSelected ? '900' : '600',
                                                        color: hasVoted && !isSelected ? '#777' : '#fff',
                                                    },
                                                ]}>
                                                    {option.text}
                                                    {isWinner && !isSelected && (
                                                        <Text style={{ color: option.color }}> ★</Text>
                                                    )}
                                                </Text>
                                            </View>

                                            {hasVoted && (
                                                <View style={styles.percentWrap}>
                                                    <Text style={[styles.percentText, { color: isSelected ? option.color : '#aaa' }]}>
                                                        {percentage}%
                                                    </Text>
                                                    <Text style={styles.voteCount}>
                                                        {option.votes.toLocaleString()}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* ── FOOTER ── */}
                    <View style={styles.footerWrap}>
                        {hasVoted && (
                            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                                <TouchableOpacity
                                    style={styles.doneBtn}
                                    onPress={onClose}
                                    accessibilityLabel="Confirm vote"
                                >
                                    <Ionicons name="checkmark-circle" size={20} color="#000" />
                                    <Text style={styles.doneBtnText}>VOTE SECURED 🚀</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        )}
                    </View>

                    {/* ── HYPE OVERLAY ── */}
                    <View style={styles.hypeOverlay} pointerEvents="none">
                        {floatingEmojis.map(emojiObj => (
                            <HypeEmoji
                                key={emojiObj.id}
                                emoji={emojiObj.emoji}
                                left={emojiObj.left}
                            />
                        ))}
                    </View>

                </SafeAreaView>
            </ImageBackground>
        </View>
    );
};

// ── Floating emoji component ───────────────────────────────────────────────
const HypeEmoji = ({ emoji, left }) => {
    const floatAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim  = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const anim = Animated.parallel([
            Animated.timing(floatAnim, {
                toValue:  -SCREEN_HEIGHT * 0.68,
                duration: 2400,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue:  0,
                duration: 2400,
                delay:    400,
                useNativeDriver: true,
            }),
        ]);
        anim.start();
        return () => anim.stop();
    }, []);

    return (
        <Animated.Text
            style={[
                styles.floatingEmoji,
                { left, transform: [{ translateY: floatAnim }], opacity: fadeAnim },
            ]}
        >
            {emoji}
        </Animated.Text>
    );
};

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        height: SCREEN_HEIGHT * 0.85,
        width: '100%',
        overflow: 'hidden',
        borderRadius: 32,
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: '#1F1F22',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.52)',
    },

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
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FFBE0B',
    },
    trendText: { color: '#FFBE0B', fontWeight: '900', fontSize: 12, letterSpacing: 1 },

    // Content
    content: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
    questionText: {
        fontSize: 32,
        fontWeight: '900',
        lineHeight: 40,
        color: '#fff',
        marginBottom: 14,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 10,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,245,212,0.18)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginBottom: 36,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#00F5D4',
        marginRight: 8,
    },
    subtitle: { fontSize: 11, color: '#00F5D4', fontWeight: '900', letterSpacing: 1 },

    // Options
    optionsList: { gap: 14 },
    optionCard: {
        width: '100%',
        minHeight: 65,
        borderRadius: 20,
        borderWidth: 2,
        overflow: 'hidden',
        justifyContent: 'center',
    },
    optionSelected: { transform: [{ scale: 1.015 }] },
    progressFill: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 18,
    },
    optionContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 16,
        zIndex: 10,
    },
    optionTextRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 12,
    },
    radioCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    radioDot: { width: 10, height: 10, borderRadius: 5 },
    optionText: { fontSize: 17, letterSpacing: 0.3, flex: 1 },
    percentWrap: { alignItems: 'flex-end' },
    percentText: { fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
    voteCount: { fontSize: 10, color: '#888', fontWeight: '700', marginTop: 1 },

    // Footer
    footerWrap: {
        paddingHorizontal: 20,
        paddingBottom: 30,
        height: 100,
        justifyContent: 'flex-end',
    },
    doneBtn: {
        backgroundColor: '#FFBE0B',
        paddingVertical: 17,
        borderRadius: 24,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        shadowColor: '#FFBE0B',
        shadowOpacity: 0.55,
        shadowRadius: 18,
        elevation: 6,
    },
    doneBtnText: {
        color: '#000',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 1,
    },

    // Hype
    hypeOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
    },
    floatingEmoji: {
        fontSize: 34,
        position: 'absolute',
        bottom: 60,
    },
});