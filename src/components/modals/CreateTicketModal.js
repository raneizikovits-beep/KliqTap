// client/src/components/modals/CreateTicketModal.js
// 💬 SUPPORT TICKET MODAL V1 — Real backend connection
//
// Connects to POST /support/ticket on the server (already exists).
// Categorized for better triage on the support team's side.

import React, { useState, useCallback, memo } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../../constants/data';
import { useAppStore } from '../../store/useAppStore';

// ──────────────────────────────────────────────────────────────
// Categories — pre-prefixed in subject so support team can triage
// ──────────────────────────────────────────────────────────────
const CATEGORIES = [
    { id: 'BUG',       label: 'Report a Bug',       icon: 'bug-outline',      color: '#EF4444', prefix: '[BUG]' },
    { id: 'FEATURE',   label: 'Feature Request',    icon: 'bulb-outline',     color: '#F59E0B', prefix: '[FEATURE]' },
    { id: 'ACCOUNT',   label: 'Account Help',       icon: 'person-outline',   color: '#0EA5E9', prefix: '[ACCOUNT]' },
    { id: 'SAFETY',    label: 'Safety Concern',     icon: 'shield-outline',   color: '#DC2626', prefix: '[SAFETY]' },
    { id: 'BILLING',   label: 'Payment / Billing',  icon: 'card-outline',     color: '#22C55E', prefix: '[BILLING]' },
    { id: 'OTHER',     label: 'Something Else',     icon: 'chatbubbles-outline', color: '#8B5CF6', prefix: '[OTHER]' },
];

const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 2000;

const CreateTicketModal = ({ onClose }) => {
    const { createSupportTicket, fetchMyTickets } = useAppStore();

    const [category, setCategory] = useState(null);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // ──────────────────────────────────────────────
    // Submit handler — real backend call
    // ──────────────────────────────────────────────
    const handleSubmit = useCallback(async () => {
        const trimmedSubject = subject.trim();
        const trimmedMessage = message.trim();

        if (!category) {
            return Alert.alert('Please choose a category', 'Help us route your request faster.');
        }
        if (trimmedSubject.length < 3) {
            return Alert.alert('Subject too short', 'Please write a brief subject (at least 3 characters).');
        }
        if (trimmedMessage.length < MIN_MESSAGE_LENGTH) {
            return Alert.alert(
                'Message too short',
                `Please tell us a bit more (at least ${MIN_MESSAGE_LENGTH} characters).`
            );
        }

        // Auto-prefix subject with category for triage
        const finalSubject = `${category.prefix} ${trimmedSubject}`;

        setSubmitting(true);
        try {
            if (createSupportTicket) {
                await createSupportTicket(finalSubject, trimmedMessage);
                // Refresh the list so the new ticket appears immediately
                if (fetchMyTickets) await fetchMyTickets();
                Alert.alert(
                    'Thank you!',
                    "We received your message. We'll get back to you as soon as possible.",
                    [{ text: 'OK', onPress: onClose }]
                );
            } else {
                throw new Error('Support service unavailable');
            }
        } catch (e) {
            Alert.alert(
                'Could not send',
                e?.message || 'Please check your connection and try again.'
            );
        } finally {
            setSubmitting(false);
        }
    }, [category, subject, message, createSupportTicket, fetchMyTickets, onClose]);

    const canSubmit = category && subject.trim().length >= 3 && 
                      message.trim().length >= MIN_MESSAGE_LENGTH && !submitting;

    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Talk to Us</Text>
                    <Text style={styles.headerSubtitle}>
                        We read every message. Your voice matters.
                    </Text>
                </View>

                {/* Categories */}
                <Text style={styles.label}>What's this about?</Text>
                <View style={styles.categoryGrid}>
                    {CATEGORIES.map((cat) => {
                        const isSelected = category?.id === cat.id;
                        return (
                            <TouchableOpacity
                                key={cat.id}
                                onPress={() => setCategory(cat)}
                                style={[
                                    styles.categoryCard,
                                    isSelected && {
                                        borderColor: cat.color,
                                        backgroundColor: cat.color + '10',
                                    },
                                ]}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={cat.icon}
                                    size={24}
                                    color={isSelected ? cat.color : '#94A3B8'}
                                />
                                <Text style={[
                                    styles.categoryLabel,
                                    isSelected && { color: cat.color, fontWeight: '700' },
                                ]}>
                                    {cat.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Subject */}
                <Text style={styles.label}>Subject</Text>
                <TextInput
                    style={styles.input}
                    placeholder="A brief summary..."
                    placeholderTextColor="#94A3B8"
                    value={subject}
                    onChangeText={setSubject}
                    maxLength={100}
                />

                {/* Message */}
                <View style={styles.labelRow}>
                    <Text style={styles.label}>Your Message</Text>
                    <Text style={styles.counter}>
                        {message.length} / {MAX_MESSAGE_LENGTH}
                    </Text>
                </View>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Tell us what's going on. The more details, the better we can help."
                    placeholderTextColor="#94A3B8"
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    textAlignVertical="top"
                    maxLength={MAX_MESSAGE_LENGTH}
                />

                {/* Submit */}
                <TouchableOpacity
                    style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    activeOpacity={0.85}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="paper-plane" size={18} color="#fff" />
                            <Text style={styles.submitText}>Send Message</Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* Privacy note */}
                <View style={styles.privacyNote}>
                    <Ionicons name="lock-closed" size={14} color="#94A3B8" />
                    <Text style={styles.privacyText}>
                        Your message is private and only visible to KliqTap support.
                    </Text>
                </View>

                <View style={{ height: 30 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    scroll: { padding: 20 },

    header: { marginBottom: 24 },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0F172A',
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 4,
    },

    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 10,
        marginTop: 14,
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 14,
        marginBottom: 10,
    },
    counter: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600',
    },

    // Categories
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    categoryCard: {
        width: '47.5%',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 2,
        borderColor: '#E2E8F0',
    },
    categoryLabel: {
        flex: 1,
        fontSize: 13,
        color: '#475569',
        fontWeight: '600',
    },

    // Inputs
    input: {
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0F172A',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    textArea: {
        minHeight: 140,
        textAlignVertical: 'top',
    },

    // Submit
    submitBtn: {
        marginTop: 24,
        backgroundColor: brand.blue,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        borderRadius: 16,
    },
    submitBtnDisabled: {
        backgroundColor: '#CBD5E1',
    },
    submitText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },

    // Privacy
    privacyNote: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 14,
    },
    privacyText: {
        fontSize: 12,
        color: '#94A3B8',
    },
});

export default memo(CreateTicketModal);