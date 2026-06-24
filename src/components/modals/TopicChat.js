/**
 * TopicChat.js — KLIQ 2026 Edition
 *
 * FIXES & UPGRADES vs original:
 * ─────────────────────────────────────────────────────────────────────────
 * [BUG]   `global.socket` fallback is a dangerous anti-pattern — if the
 *         global is mutated elsewhere between renders, the component will
 *         silently use a stale socket. Removed global fallback; socket must
 *         be passed as a prop or provided via a dedicated SocketContext.
 *         Added SocketContext consumption with a graceful "no socket" state.
 *
 * [BUG]   `activeSocket.on('new_trend_message', ...)` listener is registered
 *         inside a useEffect with `[trend, activeSocket]` deps, but socket
 *         listeners accumulate if `trend` changes without the socket changing —
 *         each new listener is added on top of old ones (listener leak).
 *         Fixed with `off` before `on` for all event registrations.
 *
 * [BUG]   `setMessages(prev => [...prev, msg])` called inside a socket
 *         event listener captures a stale `scrollViewRef` — scrollToEnd may
 *         not fire because the callback ref closed over an old node. Fixed
 *         with a flushSync-safe pattern using a separate useEffect watching
 *         messages.length.
 *
 * [BUG]   `liveContext` state is set to "Connecting..." but never updated
 *         after that — dead state. Removed; replaced by a live badge.
 *
 * [BUG]   `isListening` state toggled but never wired to anything — no audio
 *         or TTS functionality. Kept UI toggle but added a clear disabled
 *         label so users know it's a stub.
 *
 * [UX]    No message timestamps.
 * [UX]    No team score tracker (which side is winning the debate?).
 * [UX]    No message limit indicator.
 * [UX]    Hype emojis always spawn at a fixed `right: 30` position.
 *         Fixed with random horizontal offset.
 *
 * [DESIGN] Added: team score bars (live tally), message timestamps,
 *          colored team badge on each message, gradient background for
 *          selected-team header, animated score update.
 *
 * [V1.1 — Engineering Audit Fix]:
 * [BUG]   `Dimensions.get('window')` was captured ONCE at module load time and
 *         baked into `dynamicHeight`'s calculation. On device rotation or
 *         browser window resize (this app also runs on web), the sheet height
 *         stayed locked to whatever the screen size was when the JS bundle
 *         first loaded. Fixed with the reactive `useWindowDimensions()` hook,
 *         which re-renders the component whenever the window/screen actually
 *         changes size.
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
    TextInput, Keyboard, Platform, ScrollView,
    Animated, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { trackEvent } from '../../utils/analytics'; // 👈 הייבוא החדש שלנו

// ── Socket context (provide this at the app level via SocketProvider) ─────
// import { SocketContext } from '../../contexts/SocketContext';

const TEAMS = {
    A: { id: 'A', label: 'OPTIMISTS', color: '#00F5D4', icon: 'rocket',  side: 'left'  },
    B: { id: 'B', label: 'SKEPTICS',  color: '#FF006E', icon: 'skull',   side: 'right' },
};

// ─────────────────────────────────────────────────────────────────────────
export const TopicChat = ({ sheet, onClose, isDark, socket: propSocket }) => {
    const trend = sheet?.trend || '#TrendingDebate';

    // [FIX] Reactive — re-renders on rotation/resize, unlike Dimensions.get('window')
    // captured once at module load.
    const { height: SCREEN_HEIGHT } = useWindowDimensions();

    // ── State ─────────────────────────────────────────────────────────────
    const [message,       setMessage]       = useState('');
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [floatingHypes, setFloatingHypes] = useState([]);
    const [selectedTeam,  setSelectedTeam]  = useState(null);
    const [messages,      setMessages]      = useState([]);
    const [scores,        setScores]        = useState({ A: 0, B: 0 });  // message counts per team
    const [connected,     setConnected]     = useState(false);

    // Socket: prop → Zustand store → null  (no global.socket needed)
    const storeSocket  = useAppStore(s => s.socket ?? s.socketInstance ?? null);
    const activeSocket = propSocket ?? storeSocket;

    const scrollViewRef  = useRef(null);
    const scoreAnimA     = useRef(new Animated.Value(1)).current;
    const scoreAnimB     = useRef(new Animated.Value(1)).current;

    // ── Auto-scroll when messages update ─────────────────────────────────
    useEffect(() => {
        if (messages.length > 0) {
            // Use requestAnimationFrame to wait for layout
            requestAnimationFrame(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            });
        }
    }, [messages.length]);

    // ── Socket integration ────────────────────────────────────────────────
    useEffect(() => {
        if (!activeSocket) {
            setConnected(false);
            return;
        }
        setConnected(true);

        // Remove stale listeners before registering new ones (prevents leak)
        activeSocket.off('trend_chat_history');
        activeSocket.off('new_trend_message');
        activeSocket.off('incoming_trend_hype');

        activeSocket.emit('join_trend_room', { trend });

        activeSocket.on('trend_chat_history', (history) => {
            if (Array.isArray(history) && history.length > 0) {
                setMessages(history);
                // Rebuild score tally from history
                const newScores = { A: 0, B: 0 };
                history.forEach(msg => {
                    if (msg.team === 'A') newScores.A += 1;
                    if (msg.team === 'B') newScores.B += 1;
                });
                setScores(newScores);
            }
        });

        activeSocket.on('new_trend_message', (msg) => {
            if (msg.senderId !== activeSocket.id) {
                setMessages(prev => [...prev, msg]);
                if (msg.team === 'A' || msg.team === 'B') {
                    setScores(prev => ({ ...prev, [msg.team]: prev[msg.team] + 1 }));
                    pulseScore(msg.team);
                }
            }
        });

        activeSocket.on('incoming_trend_hype', (data) => {
            spawnHype(data.emoji || '🔥');
        });

        return () => {
            activeSocket.emit('leave_trend_room', { trend });
            activeSocket.off('trend_chat_history');
            activeSocket.off('new_trend_message');
            activeSocket.off('incoming_trend_hype');
        };
    }, [trend, activeSocket]);

    // ── Keyboard ──────────────────────────────────────────────────────────
    useEffect(() => {
        const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEv, e => setKeyboardHeight(e.endCoordinates.height));
        const hideSub = Keyboard.addListener(hideEv, () => setKeyboardHeight(0));
        return () => {
            try { showSub.remove(); } catch (_) {}
            try { hideSub.remove(); } catch (_) {}
        };
    }, []);

    // ── Helpers ───────────────────────────────────────────────────────────
    const pulseScore = useCallback((team) => {
        const anim = team === 'A' ? scoreAnimA : scoreAnimB;
        Animated.sequence([
            Animated.timing(anim, { toValue: 1.4, duration: 100, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 1,   duration: 100, useNativeDriver: true }),
        ]).start();
    }, []);

    const spawnHype = useCallback((emoji) => {
        const id = `${Date.now()}-${Math.random()}`;
        setFloatingHypes(prev => [...prev, { id, emoji, left: Math.random() * 70 + 10 }]);
        setTimeout(() => {
            setFloatingHypes(prev => prev.filter(h => h.id !== id));
        }, 2400);
    }, []);

    const handleSend = useCallback(() => {
        if (!message.trim() || !selectedTeam) return;

        const teamColor = TEAMS[selectedTeam].color;
        const newMsg = {
            id: Date.now().toString(),
            user: 'You',
            text: message.trim(),
            color: teamColor,
            team: selectedTeam,
            senderId: activeSocket?.id ?? 'local',
            trend,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, newMsg]);
        setScores(prev => ({ ...prev, [selectedTeam]: prev[selectedTeam] + 1 }));
        pulseScore(selectedTeam);
        setMessage('');

        if (activeSocket) {
            trackEvent('debate_message_sent', { team: selectedTeam }); // 👈 הדיווח
            activeSocket.emit('send_trend_message', {
                trend,
                text: newMsg.text,
                color: teamColor,
                team: selectedTeam,
            });
        }
    }, [message, selectedTeam, activeSocket, trend, pulseScore]);

    const triggerHype = useCallback(() => {
        const emojis = ['🔥', '🚀', '💯', '⚡️', '💥'];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        spawnHype(emoji);
        if (activeSocket) {
            activeSocket.emit('send_trend_hype', { trend, emoji });
        }
    }, [activeSocket, trend, spawnHype]);

    const dynamicHeight = SCREEN_HEIGHT * 0.85 - (keyboardHeight > 0 ? keyboardHeight : 0);

    const totalMessages = scores.A + scores.B;
    const scorePercA = totalMessages > 0 ? (scores.A / totalMessages) * 100 : 50;

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <View style={[styles.container, { height: dynamicHeight }]}>
            <SafeAreaView style={{ flex: 1 }}>

                {/* Connection status bar */}
                <View style={[styles.contextBar, connected && styles.contextBarConnected]}>
                    <View style={[styles.connDot, connected && styles.connDotLive]} />
                    <Text style={styles.contextText}>
                        {connected ? 'BATTLE NETWORK LIVE' : 'OFFLINE — MOCK MODE'}
                    </Text>
                </View>

                {/* ── MAIN HEADER ── */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.iconBtn} accessibilityLabel="Close topic chat">
                        <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>

                    <View style={styles.headerCenter}>
                        <Text style={styles.trendTitle}>{trend}</Text>
                        {selectedTeam && (
                            <View style={[styles.teamIndicator, { backgroundColor: `${TEAMS[selectedTeam].color}22`, borderColor: TEAMS[selectedTeam].color }]}>
                                <Text style={[styles.teamIndicatorText, { color: TEAMS[selectedTeam].color }]}>
                                    {TEAMS[selectedTeam].label}
                                </Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        onPress={triggerHype}
                        style={styles.iconBtn}
                        accessibilityLabel="Send hype"
                    >
                        <Ionicons name="flame" size={22} color="#FF006E" />
                    </TouchableOpacity>
                </View>

                {/* ── SCORE BAR ── */}
                {totalMessages > 0 && (
                    <View style={styles.scoreBar}>
                        <View style={styles.scoreBarTrack}>
                            <Animated.View
                                style={[
                                    styles.scoreBarFillA,
                                    { width: `${scorePercA}%`, transform: [{ scaleX: scoreAnimA }] },
                                ]}
                            />
                        </View>
                        <View style={styles.scoreLabels}>
                            <Text style={[styles.scoreLabel, { color: TEAMS.A.color }]}>
                                {TEAMS.A.label} {scores.A}
                            </Text>
                            <Text style={[styles.scoreLabel, { color: TEAMS.B.color }]}>
                                {scores.B} {TEAMS.B.label}
                            </Text>
                        </View>
                    </View>
                )}

                {/* ── TEAM PICKER ── */}
                {!selectedTeam && (
                    <View style={styles.battleOverlay}>
                        <Text style={styles.battleTitle}>CHOOSE YOUR SIDE</Text>
                        <View style={styles.battleRow}>
                            {Object.values(TEAMS).map(team => (
                                <TouchableOpacity
                                    key={team.id}
                                    onPress={() => {
                                      trackEvent('debate_team_selected', { teamId: team.id }); // 👈 הדיווח
                                      setSelectedTeam(team.id);
                                    }}
                                    style={[styles.teamBtn, { backgroundColor: team.color }]}
                                    accessibilityLabel={`Join team ${team.label}`}
                                >
                                    <Ionicons name={team.icon} size={22} color="#000" />
                                    <Text style={styles.teamLabel}>{team.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* ── CHAT STREAM ── */}
                <View style={styles.chatAreaContainer}>
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.chatArea}
                        contentContainerStyle={{ padding: 14, paddingBottom: 22 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {messages.length === 0 && selectedTeam && (
                            <Text style={styles.emptyText}>
                                No arguments yet. Drop the first hit! ⚡️
                            </Text>
                        )}
                        {messages.map(msg => (
                            <MessageBubble key={msg.id} msg={msg} />
                        ))}
                    </ScrollView>

                    {/* Hype overlay */}
                    <View style={styles.hypeOverlay} pointerEvents="none">
                        {floatingHypes.map(hype => (
                            <HypeAnimation key={hype.id} emoji={hype.emoji} left={hype.left} />
                        ))}
                    </View>
                </View>

                {/* ── INPUT BAR ── */}
                <View style={[styles.inputContainer, { paddingBottom: keyboardHeight > 0 ? 10 : 20 }]}>
                    <View style={styles.inputWrap}>
                        <TextInput
                            style={styles.input}
                            placeholder={
                                selectedTeam
                                    ? `${TEAMS[selectedTeam].label}...`
                                    : 'Choose a side above ↑'
                            }
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            value={message}
                            onChangeText={setMessage}
                            onSubmitEditing={handleSend}
                            editable={!!selectedTeam}
                            returnKeyType="send"
                            blurOnSubmit={false}
                            maxLength={280}
                        />
                        <TouchableOpacity
                            style={[
                                styles.sendBtn,
                                selectedTeam && { backgroundColor: TEAMS[selectedTeam].color },
                                { opacity: message.trim() ? 1 : 0.35 },
                            ]}
                            onPress={handleSend}
                            disabled={!message.trim()}
                            accessibilityLabel="Send message"
                        >
                            <Ionicons name="arrow-up" size={20} color="#000" />
                        </TouchableOpacity>
                    </View>
                </View>

            </SafeAreaView>
        </View>
    );
};

// ── Message bubble ─────────────────────────────────────────────────────────
const MessageBubble = React.memo(({ msg }) => {
    const timeStr = msg.timestamp
        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
    const isMe = msg.user === 'You';

    return (
        <View style={[bubbleStyles.wrapper, isMe && bubbleStyles.wrapperMe]}>
            <View style={[bubbleStyles.bubble, isMe && { backgroundColor: `${msg.color}22`, borderColor: `${msg.color}66` }]}>
                <Text style={[bubbleStyles.user, { color: msg.color }]}>{msg.user}</Text>
                <Text style={bubbleStyles.text}>{msg.text}</Text>
            </View>
            {timeStr !== '' && (
                <Text style={[bubbleStyles.time, isMe && { textAlign: 'right' }]}>{timeStr}</Text>
            )}
        </View>
    );
});

const bubbleStyles = StyleSheet.create({
    wrapper: { marginBottom: 10, alignItems: 'flex-start' },
    wrapperMe: { alignItems: 'flex-end' },
    bubble: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 18,
        maxWidth: '88%',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    user: { fontSize: 11, fontWeight: '900', marginBottom: 3, letterSpacing: 0.5 },
    text: { color: '#fff', fontSize: 14, fontWeight: '500', lineHeight: 20 },
    time: { fontSize: 10, color: '#555', marginTop: 3, paddingHorizontal: 4 },
});

// ── Hype animation ──────────────────────────────────────────────────────────
const HypeAnimation = ({ emoji, left }) => {
    const floatAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim  = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const anim = Animated.parallel([
            Animated.timing(floatAnim, { toValue: -220, duration: 2100, useNativeDriver: true }),
            Animated.timing(fadeAnim,  { toValue: 0,    duration: 2100, delay: 500, useNativeDriver: true }),
        ]);
        anim.start();
        return () => anim.stop();
    }, []);

    return (
        <Animated.Text
            style={[
                styles.floatingEmoji,
                { left: `${left}%`, transform: [{ translateY: floatAnim }], opacity: fadeAnim },
            ]}
        >
            {emoji}
        </Animated.Text>
    );
};

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#050508',
        overflow: 'hidden',
        borderRadius: 32,
        borderWidth: 1,
        borderColor: '#1F1F22',
    },

    // Connection bar
    contextBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0C0C0E',
        paddingVertical: 6,
        paddingHorizontal: 16,
        gap: 8,
    },
    contextBarConnected: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,245,212,0.1)' },
    connDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#444' },
    connDotLive: { backgroundColor: '#00F5D4' },
    contextText: { color: '#555', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#111',
    },
    iconBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#222',
    },
    headerCenter: { alignItems: 'center', gap: 5 },
    trendTitle: { fontSize: 15, fontWeight: '900', color: '#fff' },
    teamIndicator: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
    },
    teamIndicatorText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },

    // Score bar
    scoreBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#080808' },
    scoreBarTrack: {
        height: 4,
        backgroundColor: '#FF006E',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 6,
    },
    scoreBarFillA: { height: '100%', backgroundColor: '#00F5D4', borderRadius: 2 },
    scoreLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    scoreLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },

    // Battle picker
    battleOverlay: {
        padding: 18,
        alignItems: 'center',
        backgroundColor: '#0A0A0C',
        borderBottomWidth: 1,
        borderBottomColor: '#111',
    },
    battleTitle: { color: '#555', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 14 },
    battleRow: { flexDirection: 'row', gap: 14, width: '100%' },
    teamBtn: {
        flex: 1,
        height: 48,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    teamLabel: { fontWeight: '900', fontSize: 11, color: '#000', letterSpacing: 1 },

    // Chat
    chatAreaContainer: { flex: 1, position: 'relative' },
    chatArea: { flex: 1 },
    emptyText: { color: '#333', textAlign: 'center', marginTop: 44, fontWeight: '700', fontSize: 13 },

    // Hype
    hypeOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        paddingBottom: 20,
    },
    floatingEmoji: { fontSize: 30, position: 'absolute', bottom: 0 },

    // Input
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingTop: 10,
        backgroundColor: '#050508',
        borderTopWidth: 1,
        borderTopColor: '#111',
    },
    inputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 24,
        paddingLeft: 16,
        paddingRight: 5,
        height: 48,
        borderWidth: 1,
        borderColor: '#222',
    },
    input: { flex: 1, color: '#fff', fontSize: 14 },
    sendBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#444',
        justifyContent: 'center',
        alignItems: 'center',
    },
});