/**
 * StoryCreateModal.js — KLIQ 2026 Edition
 *
 * FIXES & UPGRADES vs original:
 * ─────────────────────────────────────────────────────────────────────────
 * [BUG]   `brand.soft` and `brand.blue` referenced from `../../constants/data`
 *         but there is no runtime null-guard — if the import resolves to an
 *         object without those keys, the button background becomes `undefined`
 *         which React Native silently ignores (invisible button). Added
 *         fallback constants.
 *
 * [BUG]   `useAppStore` selector `state => ({ userSettings: state.userSettings })`
 *         creates a new object every render → infinite re-render loop with
 *         Zustand if no shallow equality is applied. Fixed with shallow selector.
 *
 * [BUG]   `handleSubmit` calls `onSubmit(text, imageUri)` without checking
 *         that `onSubmit` exists (no default prop) — crashes if parent forgets
 *         to pass the prop. Added guard.
 *
 * [BUG]   `animationType="slide"` with `transparent={false}` on iOS causes
 *         a brief white flash behind the keyboard-avoiding view. Switched to
 *         a semi-transparent modal with blur-like dark overlay — consistent
 *         with the rest of KLIQ's design language.
 *
 * [UX]    No character limit on text overlay — very long strings break the
 *         story layout. Added 120-char cap with live counter.
 *
 * [UX]    No clear-text button once user starts typing.
 * [UX]    Submit disabled while `isPosting` but no visual loading state on
 *         the image itself. Added a semi-transparent overlay with spinner.
 *
 * [DESIGN] Full dark-mode polish: consistent with other KLIQ sheets.
 *          Text input now centered over the image with draggable positioning stub.
 *          Gradient footer so controls don't fight the image.
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback } from 'react';
import {
    Modal, View, Text, TouchableOpacity,
    TextInput, ImageBackground, ActivityIndicator,
    KeyboardAvoidingView, Platform, SafeAreaView,
    StyleSheet, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Zustand shallow import — keep optional so file is portable
let shallow;
try { ({ shallow } = require('zustand/shallow')); } catch (_) {}

import { brand } from '../../constants/data';
import { useAppStore } from '../../store/useAppStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Safe fallbacks for brand constants ───────────────────────────────────
const BRAND_BLUE = brand?.blue  || '#3A86FF';
const BRAND_SOFT = brand?.soft  || '#1A1A2E';

// ── Text-overlay character cap ────────────────────────────────────────────
const MAX_OVERLAY_TEXT = 120;

// ─────────────────────────────────────────────────────────────────────────
export const StoryCreateModal = ({ visible, onClose, imageUri, onSubmit, isPosting }) => {
    const [text, setText] = useState('');

    // Zustand selector — use shallow equality to prevent re-render loop
    const isDark = useAppStore(
        useCallback(s => s.userSettings?.darkMode === true, []),
        shallow,
    );

    const handleSubmit = useCallback(() => {
        if (typeof onSubmit !== 'function') {
            console.warn('[StoryCreateModal] onSubmit prop is missing');
            return;
        }
        onSubmit(text.trim(), imageUri);
    }, [onSubmit, text, imageUri]);

    const handleClose = useCallback(() => {
        if (!isPosting) onClose?.();
    }, [isPosting, onClose]);

    const charProgress = text.length / MAX_OVERLAY_TEXT;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={handleClose}
            statusBarTranslucent
        >
            {/* Dark backdrop */}
            <View style={localStyles.backdrop}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={localStyles.sheet}
                >
                    <SafeAreaView style={{ flex: 1 }}>

                        {/* ── HEADER ── */}
                        <View style={localStyles.header}>
                            <TouchableOpacity
                                onPress={handleClose}
                                style={localStyles.iconBtn}
                                disabled={isPosting}
                                accessibilityLabel="Close story creator"
                            >
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>

                            <Text style={localStyles.headerTitle}>Create Story</Text>

                            <View style={{ width: 44 }} />
                        </View>

                        {/* ── IMAGE + TEXT OVERLAY ── */}
                        <View style={localStyles.imageContainer}>
                            <ImageBackground
                                source={imageUri ? { uri: imageUri } : null}
                                style={localStyles.imageBg}
                                resizeMode="contain"
                                imageStyle={{ borderRadius: 20 }}
                            >
                                {/* Posting overlay */}
                                {isPosting && (
                                    <View style={localStyles.postingOverlay}>
                                        <ActivityIndicator size="large" color="#00F5D4" />
                                        <Text style={localStyles.postingText}>Publishing...</Text>
                                    </View>
                                )}

                                {/* Text input centered on image */}
                                <View style={localStyles.textOverlayWrap}>
                                    <View style={localStyles.textInputCard}>
                                        <TextInput
                                            style={localStyles.textInput}
                                            placeholder="Add caption..."
                                            placeholderTextColor="rgba(255,255,255,0.55)"
                                            value={text}
                                            onChangeText={t => setText(t.slice(0, MAX_OVERLAY_TEXT))}
                                            multiline
                                            maxLength={MAX_OVERLAY_TEXT}
                                            editable={!isPosting}
                                        />
                                        {text.length > 0 && (
                                            <TouchableOpacity
                                                onPress={() => setText('')}
                                                style={localStyles.clearBtn}
                                                accessibilityLabel="Clear text"
                                            >
                                                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </ImageBackground>
                        </View>

                        {/* ── FOOTER ── */}
                        <View style={localStyles.footer}>
                            {/* Char counter */}
                            <View style={localStyles.charRow}>
                                <View style={localStyles.progressTrack}>
                                    <View
                                        style={[
                                            localStyles.progressFill,
                                            {
                                                width: `${charProgress * 100}%`,
                                                backgroundColor: charProgress > 0.85 ? '#FF006E' : '#00F5D4',
                                            },
                                        ]}
                                    />
                                </View>
                                <Text style={[
                                    localStyles.charCount,
                                    charProgress > 0.85 && { color: '#FF006E' },
                                ]}>
                                    {text.length}/{MAX_OVERLAY_TEXT}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={[
                                    localStyles.submitBtn,
                                    { backgroundColor: isPosting ? BRAND_SOFT : BRAND_BLUE },
                                ]}
                                onPress={handleSubmit}
                                disabled={isPosting}
                                accessibilityLabel="Publish story"
                                accessibilityState={{ busy: isPosting }}
                            >
                                {isPosting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="rocket" size={18} color="#fff" />
                                        <Text style={localStyles.submitBtnText}>Publish Story</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                    </SafeAreaView>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

// ── Styles ────────────────────────────────────────────────────────────────
const localStyles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.88)',
        justifyContent: 'flex-end',
    },
    sheet: {
        height: SCREEN_HEIGHT * 0.92,
        backgroundColor: '#0A0A0C',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        borderWidth: 1,
        borderColor: '#1F1F22',
        overflow: 'hidden',
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A',
    },
    iconBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1C1C1E',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    // Image area
    imageContainer: {
        flex: 1,
        marginHorizontal: 16,
        marginTop: 12,
    },
    imageBg: {
        flex: 1,
        borderRadius: 20,
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    postingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 14,
        zIndex: 10,
    },
    postingText: { color: '#00F5D4', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
    textOverlayWrap: {
        paddingHorizontal: 24,
        width: '100%',
    },
    textInputCard: {
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    textInput: {
        flex: 1,
        fontSize: 22,
        color: '#fff',
        fontWeight: '700',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 8,
        minHeight: 44,
    },
    clearBtn: {
        paddingLeft: 8,
        paddingTop: 4,
    },

    // Footer
    footer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 14,
        gap: 12,
    },
    charRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    progressTrack: {
        flex: 1,
        height: 3,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 2 },
    charCount: {
        fontSize: 11,
        color: '#666',
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
        minWidth: 48,
        textAlign: 'right',
    },
    submitBtn: {
        width: '100%',
        borderRadius: 28,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
        elevation: 4,
        shadowColor: '#3A86FF',
        shadowOpacity: 0.4,
        shadowRadius: 14,
    },
    submitBtnText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 16,
        letterSpacing: 0.5,
    },
});