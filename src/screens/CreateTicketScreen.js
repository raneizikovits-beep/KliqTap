import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../constants/data';
import { useAppStore } from '../store/useAppStore';

export default function CreateTicketScreen({ onClose }) {
    const { createSupportTicket, userSettings } = useAppStore();
    const isDark = userSettings?.darkMode === true;

    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!subject.trim() || !message.trim()) {
            Alert.alert('Missing Info', 'Please provide a subject and message.');
            return;
        }
        setIsSubmitting(true);
        const success = await createSupportTicket(subject, message);
        setIsSubmitting(false);

        if (success) {
            Alert.alert('Sent', 'Your support request has been received.', [{ text: 'OK', onPress: onClose }]);
        } else {
            Alert.alert('Error', 'Failed to send ticket. Please try again.');
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: isDark ? '#000' : '#F9FAFB' }]}>
            <View style={[styles.header, { backgroundColor: isDark ? '#121212' : '#fff' }]}>
                <Text style={[styles.title, { color: isDark ? '#fff' : '#111' }]}>New Request</Text>
                <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: isDark ? '#333' : '#eee' }]}>
                    <Ionicons name="close" size={24} color={isDark ? '#ccc' : "#666"} />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <Text style={[styles.label, { color: isDark ? '#aaa' : '#555' }]}>Subject</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: isDark ? '#1C1C1E' : '#fff', color: isDark ? '#fff' : '#000', borderColor: isDark ? '#333' : '#E2E8F0' }]}
                    placeholder="What do you need help with?"
                    placeholderTextColor={isDark ? '#666' : '#94A3B8'}
                    value={subject}
                    onChangeText={setSubject}
                />

                <Text style={[styles.label, { color: isDark ? '#aaa' : '#555' }]}>Message</Text>
                <TextInput
                    style={[styles.textArea, { backgroundColor: isDark ? '#1C1C1E' : '#fff', color: isDark ? '#fff' : '#000', borderColor: isDark ? '#333' : '#E2E8F0' }]}
                    placeholder="Describe your issue..."
                    placeholderTextColor={isDark ? '#666' : '#94A3B8'}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    textAlignVertical="top"
                />

                <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: brand.blue, opacity: (!subject.trim() || !message.trim() || isSubmitting) ? 0.5 : 1 }]}
                    onPress={handleSubmit}
                    disabled={!subject.trim() || !message.trim() || isSubmitting}
                >
                    {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Request</Text>}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
    title: { fontSize: 22, fontWeight: 'bold' },
    closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 20 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
    input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
    textArea: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16, height: 150 },
    submitBtn: { padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
    submitText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});