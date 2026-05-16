// client/src/components/modals/GroupSettingsModal.js
// ⭐️ V2 PRODUCTION: Full Dark Mode Support Added
//
// CRITICAL FIX IN THIS VERSION:
// [FIX-1] This was the only file in the modal suite without dark mode support.
//         In dark mode the modal appeared white inside a black app — broken UX.
//         Now: every surface, text color, border, and input adapts to userSettings.darkMode.
//
// [FIX-2] Delete failure handling: the catch block fired Alert but the modal
//         still ran finally{}. Now: explicit setIsLoading(false) in delete too.
//
// All existing functionality is preserved 100%:
//   - Group name / description / privacy editing
//   - Save with validation
//   - Delete with confirmation
//   - Save / Delete via onSave / onDelete callbacks

import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../../constants/data'; 
import { useAppStore } from '../../store/useAppStore';

const PRIVACY_OPTIONS = [
    { value: 'public', label: 'Public (Everyone can see)' },
    { value: 'private', label: 'Private (Approved members only)' },
];

export function GroupSettingsModal({ group, isVisible, onClose, onSave, onDelete }) {
    // [FIX-1] Dark mode wiring
    const userSettings = useAppStore(state => state.userSettings);
    const isDark = userSettings?.darkMode === true;

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [privacy, setPrivacy] = useState('public');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (group && isVisible) {
            setName(group.name || '');
            setDescription(group.description || '');
            setPrivacy(group.privacy || 'public');
        }
    }, [group, isVisible]);

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert("Validation Error", "Group name is required.");
            return;
        }
        setIsLoading(true);
        try {
            const updates = { 
                name: name.trim(), 
                description: description.trim(), 
                privacy, 
                category: group?.category 
            }; 
            await onSave(group.id, updates); 
            Alert.alert("Success", "Group settings saved successfully!");
            onClose();
        } catch (e) {
            Alert.alert("Save Error", e.message || "Failed to save group settings.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAttempt = () => {
        Alert.alert(
            "Delete Group",
            "Are you absolutely sure you want to delete this group? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete Forever", 
                    style: "destructive", 
                    onPress: async () => {
                        if (!onDelete) return;
                        // [FIX-2] Manage loading state for delete too
                        setIsLoading(true);
                        try {
                            await onDelete(group.id);
                            onClose();
                        } catch (e) {
                            Alert.alert("Error", e?.message || "Failed to delete group.");
                        } finally {
                            setIsLoading(false);
                        }
                    } 
                }
            ]
        );
    };

    // [FIX-1] Pre-computed dynamic colors
    const colors = {
        bg: isDark ? '#000' : '#f9f9f9',
        headerBg: isDark ? '#1C1C1E' : '#fff',
        headerBorder: isDark ? '#333' : '#eee',
        primaryText: isDark ? '#fff' : brand.ink,
        secondaryText: isDark ? '#aaa' : '#666',
        inputBg: isDark ? '#1C1C1E' : '#fff',
        inputBorder: isDark ? '#444' : '#ccc',
        placeholder: isDark ? '#666' : '#999',
        dangerBorder: isDark ? '#330000' : '#fcc',
    };

    return (
        <Modal visible={isVisible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
                <View style={[styles.container, { backgroundColor: colors.bg }]}>
                    {/* Header */}
                    <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.headerBorder }]}>
                        <Text style={[styles.title, { color: colors.primaryText }]}>Group Settings</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={30} color={colors.primaryText} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                        {/* Group Name */}
                        <Text style={[styles.label, { color: colors.primaryText }]}>Group Name</Text>
                        <TextInput
                            style={[styles.input, { 
                                backgroundColor: colors.inputBg, 
                                borderColor: colors.inputBorder,
                                color: colors.primaryText 
                            }]}
                            value={name}
                            onChangeText={setName}
                            placeholder="Enter group name"
                            placeholderTextColor={colors.placeholder}
                            maxLength={50}
                        />

                        {/* Group Description */}
                        <Text style={[styles.label, { color: colors.primaryText }]}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, { 
                                backgroundColor: colors.inputBg, 
                                borderColor: colors.inputBorder,
                                color: colors.primaryText 
                            }]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Short description of the group"
                            placeholderTextColor={colors.placeholder}
                            multiline
                            maxLength={300}
                        />
                        
                        {/* Privacy Setting */}
                        <Text style={[styles.label, { color: colors.primaryText }]}>Group Privacy</Text>
                        {PRIVACY_OPTIONS.map((option) => (
                            <TouchableOpacity 
                                key={option.value}
                                style={styles.radioOption}
                                onPress={() => setPrivacy(option.value)}
                                activeOpacity={0.7}
                            >
                                <Ionicons 
                                    name={privacy === option.value ? "radio-button-on" : "radio-button-off"} 
                                    size={24} 
                                    color={brand.blue} 
                                />
                                <Text style={[styles.radioLabel, { color: colors.primaryText }]}>{option.label}</Text>
                            </TouchableOpacity>
                        ))}

                        {/* Save Button */}
                        <TouchableOpacity 
                            onPress={handleSave} 
                            style={[styles.saveBtn, (!name.trim() || isLoading) && styles.saveBtnDisabled]}
                            disabled={isLoading || !name.trim()}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.saveBtnText}>Save Changes</Text>
                            )}
                        </TouchableOpacity>
                        
                        {/* Danger Zone */}
                        <Text style={[styles.dangerZoneTitle, { borderTopColor: colors.dangerBorder }]}>Danger Zone</Text>
                        <TouchableOpacity 
                            style={styles.dangerBtn} 
                            onPress={handleDeleteAttempt}
                            disabled={isLoading}
                        >
                            <Text style={styles.dangerBtnText}>Delete Group</Text>
                        </TouchableOpacity>

                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
    title: { fontSize: 20, fontWeight: 'bold' },
    closeBtn: { padding: 5 },
    content: { padding: 20 },
    label: { fontSize: 16, fontWeight: '600', marginTop: 15, marginBottom: 5 },
    input: { borderWidth: 1, padding: 12, borderRadius: 8 },
    textArea: { height: 80, textAlignVertical: 'top' },
    saveBtn: { backgroundColor: brand.blue, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 30 },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    radioOption: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
    radioLabel: { marginLeft: 10, fontSize: 16 },
    dangerZoneTitle: { fontSize: 18, fontWeight: '800', color: '#B30000', marginTop: 40, borderTopWidth: 1, paddingTop: 15 },
    dangerBtn: { borderWidth: 1, borderColor: '#B30000', padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center' },
    dangerBtnText: { color: '#B30000', fontWeight: 'bold' },
});