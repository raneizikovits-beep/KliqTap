// client/src/components/modals/CallModals.js
// ⭐️ V20.3 PRODUCTION: useRingtone race condition fix + audio cleanup
//
// CRITICAL FIXES IN THIS VERSION:
// [FIX-1] useRingtone race condition: if `shouldPlay` toggled fast
//         (true → false → true), multiple async start() calls could run
//         concurrently. The cancel-flag was checked only ONCE at the
//         midpoint. Result: two audio instances playing in parallel + leak.
//         Now: a generation counter invalidates ALL stale work after
//         every shouldPlay change.
//
// [FIX-2] Web `audio.pause()` did not reset `currentTime`. A fast restart
//         resumed mid-track. Now: currentTime = 0 on stop.
//
// [FIX-3] Cancellation checks now happen after EVERY await boundary in
//         start(), not only once.
//
// All other functionality is preserved 100%:
//   - VoiceCallModal, VideoCallModal, IncomingCallModal
//   - RTCView fallback, ExpoAudio fallback
//   - All animations, status text logic, peer streams, controls.

import React, { useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView,
    StyleSheet, useWindowDimensions, Platform, Animated, ActivityIndicator, Modal
} from 'react-native';
import { useAppStore } from '../../store/useAppStore';
import * as Data from '../../constants/data';
import { Ionicons } from '@expo/vector-icons';

// ────────────────────────────────────────────────────────────────
let RTCView = null;
if (Platform.OS !== 'web') {
    try {
        RTCView = require('react-native-webrtc').RTCView;
    } catch (error) {
        console.warn("react-native-webrtc not available, falling back to empty view");
    }
}

let ExpoAudio = null;
if (Platform.OS !== 'web') {
    try {
        ExpoAudio = require('expo-av').Audio;
    } catch (error) {
        console.warn("expo-av not installed — ringtone disabled on native");
    }
}

// ────────────────────────────────────────────────────────────────
// [FIX-1, FIX-2, FIX-3] Ringtone hook — race-condition-safe with generation tokens
// ────────────────────────────────────────────────────────────────
const useRingtone = (shouldPlay, soundType = 'incoming') => {
    const handleRef = useRef(null);
    const generationRef = useRef(0); // [FIX-1] increments on every effect run

    useEffect(() => {
        // [FIX-1] Bump generation immediately. Any previous start() will see
        // its own captured generation < current and bail out gracefully.
        const myGeneration = ++generationRef.current;
        const isCurrent = () => myGeneration === generationRef.current;

        const webSource = soundType === 'incoming' 
            ? '/assets/mixkit-calling-ringtone.mp3' 
            : '/assets/mixkit-waiting-ringtone.wav';

        const stopExisting = async () => {
            if (handleRef.current) {
                try { await handleRef.current.stop(); } catch (e) {}
                handleRef.current = null;
            }
        };

        const start = async () => {
            // Stop any previous instance first
            await stopExisting();
            if (!isCurrent()) return;

            try {
                if (Platform.OS === 'web') {
                    const audio = new window.Audio(webSource);
                    audio.loop = true;
                    audio.volume = 0.7;

                    // [FIX-3] Check before kicking off play()
                    if (!isCurrent()) { try { audio.pause(); } catch (e) {} return; }

                    const playPromise = audio.play();
                    if (playPromise && typeof playPromise.catch === 'function') {
                        playPromise.catch(err => console.log('[Ringtone] autoplay blocked:', err?.message));
                    }

                    // [FIX-3] Check after play() initialization
                    if (!isCurrent()) {
                        try { audio.pause(); audio.currentTime = 0; } catch (e) {}
                        return;
                    }

                    handleRef.current = {
                        stop: () => {
                            try { 
                                audio.pause(); 
                                audio.currentTime = 0; // [FIX-2] reset position
                            } catch (e) {}
                        }
                    };
                } else if (ExpoAudio) {
                    await ExpoAudio.setAudioModeAsync({
                        playsInSilentModeIOS: true,
                        staysActiveInBackground: false,
                        shouldDuckAndroid: true,
                    });
                    if (!isCurrent()) return;

                    const nativeSource = soundType === 'incoming' 
                        ? require('../../assets/mixkit-calling-ringtone.mp3') 
                        : require('../../assets/mixkit-waiting-ringtone.wav');

                    const { sound } = await ExpoAudio.Sound.createAsync(
                        nativeSource,
                        { isLooping: true, shouldPlay: true, volume: 0.85 }
                    );

                    // [FIX-3] Critical re-check after the async createAsync
                    if (!isCurrent()) {
                        try { await sound.stopAsync(); } catch (e) {}
                        try { await sound.unloadAsync(); } catch (e) {}
                        return;
                    }

                    handleRef.current = {
                        stop: async () => {
                            try { await sound.stopAsync(); } catch (e) {}
                            try { await sound.unloadAsync(); } catch (e) {}
                        }
                    };
                }
            } catch (e) {
                console.warn('[Ringtone] error:', e?.message);
            }
        };

        if (shouldPlay) {
            start();
        } else {
            stopExisting();
        }

        return () => {
            // [FIX-1] Bumping generation here invalidates any pending start()
            generationRef.current++;
            stopExisting();
        };
    }, [shouldPlay, soundType]);
};

// ────────────────────────────────────────────────────────────────
const SafeRTCView = (props) => {
    if (!RTCView) {
        return (
            <View style={[props.style, { backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="videocam-off" size={40} color="#555" />
            </View>
        );
    }
    return <RTCView {...props} />;
};

const getStreamProps = (stream) => {
    if (!stream) return {};
    const props = { stream };
    if (typeof stream.toURL === 'function') {
        props.streamURL = stream.toURL();
    }
    return props;
};

const buildOverlayStyle = (windowWidth, windowHeight) => {
    if (Platform.OS === 'web') {
        return {
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100vw',
            height: '100dvh',
            zIndex: 999999,
            backgroundColor: '#000',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        };
    }
    return {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        width: windowWidth,
        height: windowHeight,
        zIndex: 999999,
        elevation: 999999,
        backgroundColor: '#000',
    };
};

const callStyles = StyleSheet.create({
    controlContainer: {
        position: 'absolute', bottom: 40,
        left: 15, right: 15,
        flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
        paddingVertical: 15, paddingHorizontal: 10, zIndex: 10, alignSelf: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 40
    },
    controlButton: {
        width: 55, height: 55, borderRadius: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.1)', justifyContent: 'center',
        alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    endCallButton: {
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: Data.brand.red, justifyContent: 'center',
        alignItems: 'center', shadowColor: Data.brand.red, shadowOpacity: 0.3, shadowRadius: 10
    },
    acceptCallButton: {
        width: 70, height: 70, borderRadius: 35,
        backgroundColor: '#22C55E', justifyContent: 'center',
        alignItems: 'center', shadowColor: '#22C55E', shadowOpacity: 0.5, shadowRadius: 12
    },
    declineCallButton: {
        width: 70, height: 70, borderRadius: 35,
        backgroundColor: Data.brand.red, justifyContent: 'center',
        alignItems: 'center', shadowColor: Data.brand.red, shadowOpacity: 0.5, shadowRadius: 12
    },
    icon: { fontSize: 26, color: '#fff' },
    voiceRoomContainer: { flex: 1, backgroundColor: '#121417', justifyContent: 'flex-start', alignItems: 'center', width: '100%' },
    voiceRoomHeader: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
    participantCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 12, borderRadius: 18, marginBottom: 10, width: '100%'
    }
});

const PeerAudio = ({ stream }) => {
    if (!stream || Platform.OS === 'web') return null;
    return <SafeRTCView {...getStreamProps(stream)} style={{ width: 0, height: 0 }} objectFit="cover" />;
};

// ─────────────────────────────────────────────────────────────────
// Helper: derives the call status label from store state
// ─────────────────────────────────────────────────────────────────
const computeStatusText = ({ peerCount, callStatus, isMuted, callError }) => {
    if (callError) return callError;
    if (peerCount > 0) {
        return isMuted ? 'Microphone Muted' : 'Speaking...';
    }
    if (callStatus === 'connecting') return 'Connecting...';
    if (callStatus === 'calling') return 'Ringing...';
    return 'Ringing...';
};

// ════════════════════════════════════════════════════════════════
// 0. INCOMING CALL MODAL (callee — loud ring)
// ════════════════════════════════════════════════════════════════
export const IncomingCallModal = ({ onAccept, onDecline }) => {
    const incomingCall = useAppStore(state => state.incomingCall || null);
    const acceptCall   = useAppStore(state => state.acceptCall);
    const declineCall  = useAppStore(state => state.declineCall);

    const isVisible = !!incomingCall;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useRingtone(isVisible, 'incoming');

    useEffect(() => {
        let animation;
        if (isVisible) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
                ])
            );
            animation.start();
        } else {
            pulseAnim.setValue(1);
        }

        return () => {
            if (animation) animation.stop();
        };
    }, [isVisible, pulseAnim]);

    // 30s auto-decline
    useEffect(() => {
        if (!isVisible) return;
        const t = setTimeout(() => {
            if (declineCall && incomingCall?.callId) {
                declineCall(incomingCall.callId);
            }
        }, 30000);
        return () => clearTimeout(t);
    }, [isVisible, incomingCall?.callId, declineCall]);

    const handleAccept = async () => {
        const snapshot = incomingCall;
        try {
            if (acceptCall && snapshot?.callId) {
                await acceptCall(snapshot.callId);
            }
        } catch (e) {
            console.warn('[IncomingCallModal] acceptCall failed:', e?.message);
        }
        if (onAccept) onAccept(snapshot);
    };

    const handleDecline = () => {
        const snapshot = incomingCall;
        if (declineCall && snapshot?.callId) declineCall(snapshot.callId);
        if (onDecline) onDecline(snapshot);
    };

    if (!isVisible) return null;

    const overlayStyle = Platform.OS === 'web'
        ? {
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100vw', height: '100dvh',
            zIndex: 9999999,
            backgroundColor: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center',
          }
        : {
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 9999999,
            elevation: 9999999,
            backgroundColor: 'rgba(0,0,0,0.92)',
            justifyContent: 'center', alignItems: 'center',
          };

    return (
        <View style={overlayStyle}>
            <View style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                paddingHorizontal: 16, paddingVertical: 6,
                borderRadius: 20, marginBottom: 28
            }}>
                <Text style={{ color: Data.brand.blue, fontWeight: '800', fontSize: 10, letterSpacing: 2 }}>
                    ENCRYPTED SESSION
                </Text>
            </View>

            <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 24 }}>
                <View style={{
                    width: 120, height: 120, borderRadius: 60,
                    backgroundColor: incomingCall?.isVideo ? Data.brand.blue : '#22C55E',
                    justifyContent: 'center', alignItems: 'center',
                    shadowColor: incomingCall?.isVideo ? Data.brand.blue : '#22C55E',
                    shadowOpacity: 0.5, shadowRadius: 24, elevation: 14
                }}>
                    <Ionicons
                        name={incomingCall?.isVideo ? 'videocam' : 'call'}
                        size={54} color="#fff"
                    />
                </View>
            </Animated.View>

            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 6 }}>
                {incomingCall?.callerName || 'Unknown Caller'}
            </Text>
            <Text style={{ color: '#888', fontSize: 14, marginBottom: 56 }}>
                {incomingCall?.isVideo ? 'Incoming Video Call' : 'Incoming Voice Call'}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 60 }}>
                <View style={{ alignItems: 'center' }}>
                    <TouchableOpacity
                        style={callStyles.declineCallButton}
                        onPress={handleDecline}
                        accessibilityLabel="Decline call"
                        accessibilityRole="button"
                    >
                        <Ionicons name="call" size={30} color="#fff"
                            style={{ transform: [{ rotate: '135deg' }] }} />
                    </TouchableOpacity>
                    <Text style={{ color: '#888', marginTop: 8, fontSize: 12 }}>Decline</Text>
                </View>

                <View style={{ alignItems: 'center' }}>
                    <TouchableOpacity
                        style={callStyles.acceptCallButton}
                        onPress={handleAccept}
                        accessibilityLabel="Answer call"
                        accessibilityRole="button"
                    >
                        <Ionicons name="call" size={30} color="#fff" />
                    </TouchableOpacity>
                    <Text style={{ color: '#22C55E', marginTop: 8, fontSize: 12, fontWeight: '700' }}>Answer</Text>
                </View>
            </View>
        </View>
    );
};

// ════════════════════════════════════════════════════════════════
// 1. VIDEO CALL MODAL
// ════════════════════════════════════════════════════════════════
export const VideoCallModal = ({ isOpen, onClose, callId }) => {
    const { width: winWidth, height: winHeight } = useWindowDimensions();

    const {
        currentVideoRoomId, localStream, peerStreams, isCameraEnabled, isMuted, isSpeakerOn,
        joinVoiceRoom, endCall, toggleCamera, toggleMute, toggleSpeaker, currentCallId,
        incomingCall, remoteParty, callStatus, callError
    } = useAppStore(state => ({
        currentVideoRoomId: state.currentVideoRoomId, localStream: state.localStream, peerStreams: state.peerStreams,
        isCameraEnabled: state.isCameraEnabled, isMuted: state.isMuted, isSpeakerOn: state.isSpeakerOn,
        joinVoiceRoom: state.joinVoiceRoom, endCall: state.endCall, toggleCamera: state.toggleCamera,
        toggleMute: state.toggleMute, toggleSpeaker: state.toggleSpeaker, currentCallId: state.currentCallId,
        incomingCall: state.incomingCall || null,
        remoteParty: state.remoteParty || null,
        callStatus: state.callStatus,
        callError: state.callError,
    }));

    const hasJoinedRef = useRef(null);
    const activeCallId = callId || currentCallId;
    const isActuallyOpen = isOpen || !!(activeCallId && currentVideoRoomId);
    const peerCount = peerStreams ? Object.keys(peerStreams).length : 0;

    useRingtone(isActuallyOpen && peerCount === 0 && callStatus === 'calling', 'waiting');

    useEffect(() => {
        const isThisAnIncomingCall = incomingCall && incomingCall.callId === activeCallId;
        if (isThisAnIncomingCall) return;

        if (isOpen && activeCallId && currentVideoRoomId !== activeCallId) {
            if (hasJoinedRef.current !== activeCallId && joinVoiceRoom) {
                hasJoinedRef.current = activeCallId;
                console.log("Joining Video Room (Locked): ", activeCallId);
                joinVoiceRoom(activeCallId, true);
            }
        }
    }, [isOpen, activeCallId, currentVideoRoomId, joinVoiceRoom, incomingCall]);

    const handleLeave = () => {
        hasJoinedRef.current = null;
        if (endCall && activeCallId) endCall(activeCallId);
        if (onClose) onClose();
    };

    const peerStreamList = peerStreams ? Object.entries(peerStreams) : [];
    const mainStream = peerStreamList.length > 0 ? peerStreamList[0][1] : localStream;
    const smallStream = peerStreamList.length > 0 ? localStream : null;

    if (!isActuallyOpen) return null;

    const statusText = computeStatusText({ peerCount, callStatus, isMuted, callError });

    // WEB: video not supported message
    if (Platform.OS === 'web') {
        const overlayStyle = buildOverlayStyle(winWidth, winHeight);
        return (
            <View style={overlayStyle}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Ionicons name="videocam-off-outline" size={60} color="#fff" style={{ marginBottom: 20 }} />
                    <Text style={{ color: '#fff', fontSize: 18, textAlign: 'center', maxWidth: 400 }}>
                        Video calls are currently supported only on the mobile app.
                    </Text>
                    <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
                        Voice calls work on web — try switching to voice.
                    </Text>
                </View>
            </View>
        );
    }

    // NATIVE: full Modal to cover TabBar
    return (
        <Modal visible={isActuallyOpen} transparent={false} animationType="fade" statusBarTranslucent={true}>
            <View style={{ flex: 1, backgroundColor: '#000' }}>

                {/* Main stream — full screen */}
                {mainStream ? (
                    <SafeRTCView
                        {...getStreamProps(mainStream)}
                        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
                        objectFit="cover"
                    />
                ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={Data.brand.blue} />
                        <Text style={{ color: '#fff', marginTop: 10 }}>{statusText}</Text>
                    </View>
                )}

                {/* Self stream — small */}
                {smallStream && (
                    <View style={{
                        position: 'absolute', top: 60, right: 20, width: 110, height: 160,
                        zIndex: 20, borderRadius: 15, overflow: 'hidden',
                        borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: '#111'
                    }}>
                        <SafeRTCView {...getStreamProps(smallStream)} style={{ flex: 1 }} objectFit="cover" mirror={true} />
                    </View>
                )}

                {/* Participant name — top-left */}
                <View style={{ position: 'absolute', top: 60, left: 20, zIndex: 20 }}>
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 }}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                            {remoteParty?.name || 'Video Room'}
                        </Text>
                    </View>
                </View>

                {/* Controls */}
                <View style={[callStyles.controlContainer, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <TouchableOpacity
                        style={[callStyles.controlButton, isSpeakerOn && { backgroundColor: 'rgba(255,255,255,0.3)' }]}
                        onPress={toggleSpeaker}
                    >
                        <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-mute-outline'} style={callStyles.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[callStyles.controlButton, isMuted && { backgroundColor: Data.brand.red }]}
                        onPress={toggleMute}
                    >
                        <Ionicons name={isMuted ? 'mic-off' : 'mic-outline'} style={callStyles.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[callStyles.controlButton, !isCameraEnabled && { backgroundColor: '#444' }]}
                        onPress={toggleCamera}
                    >
                        <Ionicons name={isCameraEnabled ? 'videocam' : 'videocam-off-outline'} style={callStyles.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity style={callStyles.endCallButton} onPress={handleLeave}>
                        <Ionicons name="close" size={30} color="#fff" />
                    </TouchableOpacity>
                </View>

            </View>
        </Modal>
    );
};

// ════════════════════════════════════════════════════════════════
// 2. VOICE CALL MODAL
// ════════════════════════════════════════════════════════════════
export const VoiceCallModal = ({ isOpen, onClose, onSwitchToVideo, callId }) => {
    const { width: winWidth, height: winHeight } = useWindowDimensions();

    const {
        currentVoiceRoomId, localStream, peerStreams, isMuted, isSpeakerOn, isCameraEnabled,
        joinVoiceRoom, endCall, toggleMute, toggleSpeaker, toggleCamera, user, currentCallId,
        incomingCall, remoteParty, callStatus, callError
    } = useAppStore(state => ({
        currentVoiceRoomId: state.currentVoiceRoomId, localStream: state.localStream, peerStreams: state.peerStreams,
        isMuted: state.isMuted, isSpeakerOn: state.isSpeakerOn, isCameraEnabled: state.isCameraEnabled,
        joinVoiceRoom: state.joinVoiceRoom, endCall: state.endCall, toggleMute: state.toggleMute,
        toggleSpeaker: state.toggleSpeaker, toggleCamera: state.toggleCamera, user: state.user, currentCallId: state.currentCallId,
        incomingCall: state.incomingCall || null,
        remoteParty: state.remoteParty || null,
        callStatus: state.callStatus,
        callError: state.callError,
    }));

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const hasJoinedRef = useRef(null);

    const activeCallId = callId || currentCallId;
    const isActuallyOpen = isOpen || !!(activeCallId && currentVoiceRoomId);
    const peerCount = peerStreams ? Object.keys(peerStreams).length : 0;
    
    useRingtone(isActuallyOpen && peerCount === 0 && callStatus === 'calling', 'waiting');

    const handleSwitchToVideo = () => {
        if (!isCameraEnabled && toggleCamera) toggleCamera();
        if (onSwitchToVideo) onSwitchToVideo();
    };

    useEffect(() => {
        let animation;
        if (isActuallyOpen && !isMuted) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
                ])
            );
            animation.start();
        } else {
            pulseAnim.setValue(1);
        }

        return () => {
            if (animation) animation.stop();
        };
    }, [isActuallyOpen, isMuted, pulseAnim]);

    useEffect(() => {
        const isThisAnIncomingCall = incomingCall && incomingCall.callId === activeCallId;
        if (isThisAnIncomingCall) return;

        if (isOpen && activeCallId && currentVoiceRoomId !== activeCallId) {
            if (hasJoinedRef.current !== activeCallId && joinVoiceRoom) {
                hasJoinedRef.current = activeCallId;
                console.log("Joining Voice Room (Locked): ", activeCallId);
                joinVoiceRoom(activeCallId, false);
            }
        }
    }, [isOpen, activeCallId, currentVoiceRoomId, joinVoiceRoom, incomingCall]);

    const handleLeave = () => {
        hasJoinedRef.current = null;
        if (endCall && activeCallId) endCall(activeCallId);
        if (onClose) onClose();
    };

    const peerStreamList = peerStreams ? Object.entries(peerStreams) : [];

    if (!isActuallyOpen) return null;

    const displayName = remoteParty?.name || user?.name || 'Connecting...';
    const statusText = computeStatusText({ peerCount, callStatus, isMuted, callError });
    const statusColor = callError ? Data.brand.red
        : (peerCount > 0
            ? (isMuted ? Data.brand.red : Data.brand.green)
            : (callStatus === 'connecting' ? Data.brand.blue : Data.brand.green));

    return (
        <Modal visible={isActuallyOpen} transparent={true} animationType="fade" statusBarTranslucent={true}>
            <View style={{ flex: 1, backgroundColor: '#121417' }}>
                <View style={callStyles.voiceRoomContainer}>
                    {peerStreamList.map(([userId, stream]) => <PeerAudio key={userId} stream={stream} />)}
                    {localStream && <PeerAudio stream={localStream} />}

                    <View style={{ marginTop: 60, alignItems: 'center' }}>
                        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}>
                            <Text style={{ color: Data.brand.blue, fontWeight: '800', fontSize: 10, letterSpacing: 2 }}>ENCRYPTED SESSION</Text>
                        </View>
                        <Text style={[callStyles.voiceRoomHeader, { marginTop: 15 }]}>Voice Vibe</Text>
                        <Text style={{ color: '#555', fontSize: 12 }}>ID: {activeCallId?.substring(0, 15) || 'Connecting...'}</Text>
                    </View>

                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <View style={{
                                width: 140, height: 140, borderRadius: 70,
                                backgroundColor: isMuted ? '#2A2D30' : Data.brand.blue,
                                justifyContent: 'center', alignItems: 'center',
                                elevation: 15, shadowColor: Data.brand.blue, shadowOpacity: 0.4, shadowRadius: 20
                            }}>
                                <Ionicons name={isMuted ? "mic-off" : "person"} size={60} color="#fff" />
                            </View>
                        </Animated.View>
                        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 25 }}>{displayName}</Text>
                        <Text style={{ color: statusColor, fontSize: 14, fontWeight: '600', marginTop: 6 }}>
                            {statusText}
                        </Text>
                    </View>

                    <View style={{ width: '100%', paddingHorizontal: 30, paddingBottom: 140 }}>
                        <Text style={{ color: '#444', fontWeight: '800', fontSize: 11, marginBottom: 12, letterSpacing: 1 }}>PARTICIPANTS ({1 + peerStreamList.length})</Text>
                        <ScrollView
                            style={[
                                { maxHeight: 120 },
                                Platform.OS === 'web' && { overflowY: 'auto' }
                            ]}
                            onStartShouldSetResponder={() => true}
                        >
                            {peerStreamList.map(([userId]) => (
                                <View key={userId} style={callStyles.participantCard}>
                                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="person" size={16} color="#777" />
                                    </View>
                                    <Text style={{ color: '#fff', marginLeft: 12, fontWeight: '600' }}>
                                        {remoteParty?.id === userId ? remoteParty.name : `User ${userId.substring(0, 6)}`}
                                    </Text>
                                    <View style={{ flex: 1 }} />
                                    <Ionicons name="stats-chart" size={14} color={Data.brand.green} />
                                </View>
                            ))}
                            {peerStreamList.length === 0 && (
                                <Text style={{ color: '#333', fontStyle: 'italic', textAlign: 'center', marginTop: 10 }}>Waiting for others to join...</Text>
                            )}
                        </ScrollView>
                    </View>

                    <View style={callStyles.controlContainer}>
                        <TouchableOpacity style={callStyles.controlButton} onPress={toggleSpeaker}>
                            <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-mute-outline'} style={callStyles.icon} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[callStyles.controlButton, isMuted && { backgroundColor: Data.brand.red }]} onPress={toggleMute}>
                            <Ionicons name={isMuted ? 'mic-off' : 'mic-outline'} style={callStyles.icon} />
                        </TouchableOpacity>

                        {onSwitchToVideo && (
                            <TouchableOpacity style={callStyles.controlButton} onPress={handleSwitchToVideo}>
                                <Ionicons name="videocam-outline" style={callStyles.icon} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={callStyles.endCallButton} onPress={handleLeave}>
                            <Ionicons name="close" size={30} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};