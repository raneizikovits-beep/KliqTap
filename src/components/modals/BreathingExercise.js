// client/src/components/modals/BreathingExercise.js
// 🌬️ BREATHING EXERCISE V1 — 4-7-8 Method with Animated Circle
//
// The 4-7-8 technique:
//   • Inhale 4 seconds through nose
//   • Hold 7 seconds
//   • Exhale 8 seconds through mouth
// 
// Backed by Dr. Andrew Weil; non-clinical, safe for everyone.
// Used by therapists, athletes, meditators worldwide.

import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Animated, Vibration, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../../constants/data';

// Phase durations (in milliseconds)
const PHASES = [
    { name: 'Breathe In',  duration: 4000, scale: 1.5, color: '#22C55E', vibrate: 50 },
    { name: 'Hold',         duration: 7000, scale: 1.5, color: '#0EA5E9', vibrate: 0 },
    { name: 'Breathe Out', duration: 8000, scale: 0.6, color: '#8B5CF6', vibrate: 100 },
];

const TOTAL_CYCLES = 4; // 4 rounds = ~76 seconds = perfect quick session

const BreathingExercise = ({ onClose }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [phaseIndex, setPhaseIndex] = useState(0);
    const [cycleCount, setCycleCount] = useState(0);
    const [completed, setCompleted] = useState(false);

    const scaleAnim = useRef(new Animated.Value(0.6)).current;
    const opacityAnim = useRef(new Animated.Value(0.5)).current;
    const timerRef = useRef(null);

    const currentPhase = PHASES[phaseIndex];

    // ────────────────────────────────────────────────
    // Cleanup on unmount
    // ────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            scaleAnim.stopAnimation();
            opacityAnim.stopAnimation();
        };
    }, []);

    // ────────────────────────────────────────────────
    // Drive the breathing animation
    // ────────────────────────────────────────────────
    useEffect(() => {
        if (!isRunning) return;

        const phase = PHASES[phaseIndex];

        // Animate the circle
        Animated.parallel([
            Animated.timing(scaleAnim, {
                toValue: phase.scale,
                duration: phase.duration,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: phaseIndex === 2 ? 0.4 : 0.85, // exhale fades out
                duration: phase.duration,
                useNativeDriver: true,
            }),
        ]).start();

        // Haptic feedback at phase transition
        if (phase.vibrate > 0 && Platform.OS !== 'web') {
            try { Vibration.vibrate(phase.vibrate); } catch {}
        }

        // Schedule next phase
        timerRef.current = setTimeout(() => {
            const nextPhase = (phaseIndex + 1) % PHASES.length;
            
            if (nextPhase === 0) {
                // Completed a full cycle
                const nextCycle = cycleCount + 1;
                if (nextCycle >= TOTAL_CYCLES) {
                    // Session complete!
                    setIsRunning(false);
                    setCompleted(true);
                    return;
                }
                setCycleCount(nextCycle);
            }
            setPhaseIndex(nextPhase);
        }, phase.duration);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [isRunning, phaseIndex, cycleCount, scaleAnim, opacityAnim]);

    // ────────────────────────────────────────────────
    // Handlers
    // ────────────────────────────────────────────────
    const handleStart = useCallback(() => {
        setPhaseIndex(0);
        setCycleCount(0);
        setCompleted(false);
        setIsRunning(true);
    }, []);

    const handleStop = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        scaleAnim.stopAnimation();
        opacityAnim.stopAnimation();
        setIsRunning(false);
        setPhaseIndex(0);
        setCycleCount(0);
    }, [scaleAnim, opacityAnim]);

    // ────────────────────────────────────────────────
    // Render — Completion state
    // ────────────────────────────────────────────────
    if (completed) {
        return (
            <View style={styles.container}>
                <View style={styles.completedContent}>
                    <Text style={styles.completedEmoji}>✨</Text>
                    <Text style={styles.completedTitle}>Well done</Text>
                    <Text style={styles.completedSubtitle}>
                        You completed {TOTAL_CYCLES} full breathing cycles.{'\n'}
                        Take a moment to notice how you feel.
                    </Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleStart}>
                        <Text style={styles.primaryBtnText}>Do Another Round</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                        <Text style={styles.secondaryBtnText}>Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ────────────────────────────────────────────────
    // Render — Active or idle
    // ────────────────────────────────────────────────
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>4-7-8 Breathing</Text>
                <Text style={styles.subtitle}>
                    Inhale 4s · Hold 7s · Exhale 8s
                </Text>
            </View>

            {/* Animated breathing circle */}
            <View style={styles.circleContainer}>
                <Animated.View
                    style={[
                        styles.circle,
                        {
                            backgroundColor: currentPhase.color,
                            transform: [{ scale: scaleAnim }],
                            opacity: opacityAnim,
                        },
                    ]}
                />
                <View style={styles.circleLabel}>
                    <Text style={styles.phaseText}>
                        {isRunning ? currentPhase.name : 'Ready?'}
                    </Text>
                    {isRunning && (
                        <Text style={styles.cycleText}>
                            Cycle {cycleCount + 1} of {TOTAL_CYCLES}
                        </Text>
                    )}
                </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                {!isRunning ? (
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleStart}>
                        <Ionicons name="play" size={20} color="#fff" />
                        <Text style={styles.primaryBtnText}>Start</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity 
                        style={[styles.primaryBtn, styles.stopBtn]} 
                        onPress={handleStop}
                    >
                        <Ionicons name="stop" size={20} color="#fff" />
                        <Text style={styles.primaryBtnText}>Stop</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                    <Text style={styles.secondaryBtnText}>Close</Text>
                </TouchableOpacity>
            </View>

            {/* Tip */}
            <View style={styles.tip}>
                <Ionicons name="bulb-outline" size={14} color="#94A3B8" />
                <Text style={styles.tipText}>
                    Find a comfortable position. Inhale through your nose, exhale through your mouth.
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0F172A',
    },
    subtitle: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 6,
    },

    // Circle
    circleContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 280,
    },
    circle: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
    },
    circleLabel: {
        zIndex: 2,
        alignItems: 'center',
    },
    phaseText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    cycleText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 6,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },

    // Controls
    controls: {
        gap: 12,
        marginBottom: 16,
    },
    primaryBtn: {
        backgroundColor: brand.blue,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        borderRadius: 16,
    },
    stopBtn: { backgroundColor: '#EF4444' },
    primaryBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    secondaryBtn: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    secondaryBtnText: {
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600',
    },

    // Tip
    tip: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
        padding: 12,
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        marginBottom: 20,
    },
    tipText: {
        flex: 1,
        fontSize: 12,
        color: '#64748B',
        lineHeight: 16,
    },

    // Completed
    completedContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    completedEmoji: { fontSize: 60, marginBottom: 16 },
    completedTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 8,
    },
    completedSubtitle: {
        fontSize: 15,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
});

export default memo(BreathingExercise);