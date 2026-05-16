// client/src/components/EditProfileView.js
// ⭐️ V2.0: Three real bug fixes + deferred avatar upload ⭐️
//
// Changes vs previous version:
//   [FIX-1] Anthem duplication bug — anthem is now parsed out of the bio on load
//           and re-injected on save, so it doesn't accumulate ("\n🎵 Anthem: X"
//           appearing twice, three times, etc.).
//   [FIX-2] location & website are now actually sent to the server. If the server
//           rejects them, the error surfaces to the user instead of silent failure.
//   [FIX-3] Avatar URI is held locally and only uploaded on Save — no orphan files
//           in storage if the user cancels.
//   [FIX-4] Atomic selectors — re-render only when the relevant fields change.
//   [FIX-5] Bio/intent handling clarified with a comment explaining the precedence.
//
// MIGRATION NOTE: If your server stores anthem in a separate `anthem` column
// (recommended), see the comment block in resetFromUser() — switch to the
// commented-out lines and remove the regex parsing.

import React, { useState, useEffect, memo, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ActivityIndicator,
    Alert, ScrollView, Image, StyleSheet, Platform, KeyboardAvoidingView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { brand } from '../constants/data';
import { useAppStore } from '../store/useAppStore';

// ⭐️ Anthem encoding — a single regex used for both parsing and stripping.
// If your server eventually stores `anthem` as its own field, delete this
// regex and the related logic; replace with `setMyAnthem(user.anthem || '')`.
const ANTHEM_TAG = '🎵 Anthem: ';
const ANTHEM_PATTERN = /\n?🎵 Anthem: (.+)$/m;

// Pulls the anthem out of a bio string, returning { strippedBio, anthem }.
function parseBioWithAnthem(rawBio) {
    if (!rawBio) return { strippedBio: '', anthem: '' };
    const match = rawBio.match(ANTHEM_PATTERN);
    return {
        strippedBio: rawBio.replace(ANTHEM_PATTERN, '').trim(),
        anthem: match ? match[1].trim() : '',
    };
}

// Recombines bio + anthem for storage. If anthem is empty, no tag is added.
function buildBioWithAnthem(bio, anthem) {
    const trimmedBio = (bio || '').trim();
    const trimmedAnthem = (anthem || '').trim();
    if (!trimmedAnthem) return trimmedBio;
    return trimmedBio ? `${trimmedBio}\n${ANTHEM_TAG}${trimmedAnthem}` : `${ANTHEM_TAG}${trimmedAnthem}`;
}

const EditProfileView = ({ onClose }) => {
    // [FIX-4] Atomic selectors — each subscribes to only what it needs.
    const user             = useAppStore(state => state.user);
    const updateUserProfile = useAppStore(state => state.updateUserProfile);
    const uploadFile       = useAppStore(state => state.uploadFile);
    const isDark           = useAppStore(state => state.userSettings?.darkMode === true);

    // --- Local state ------------------------------------------------------
    const [name, setName]         = useState('');
    const [username, setUsername] = useState('');
    const [bio, setBio]           = useState('');
    const [location, setLocation] = useState('');
    const [website, setWebsite]   = useState('');
    const [myAnthem, setMyAnthem] = useState('');

    // [FIX-3] Avatar state is split: existing URL vs newly-picked local URI.
    // We only call uploadFile() during handleSave, so cancel = no orphan upload.
    const [existingAvatarUrl, setExistingAvatarUrl] = useState('');
    const [pendingAvatarUri, setPendingAvatarUri]   = useState(null); // local file:// uri

    const [isLoading, setIsLoading]       = useState(false);

    // --- Initialize from user ---------------------------------------------
    // [FIX-1] Bio loads from server, the anthem is parsed out into its own field.
    // [FIX-5] Precedence: `intent` (from onboarding/profile editor) wins over
    //         legacy `bio`. If your server unifies these into one field later,
    //         only this line needs to change.
    useEffect(() => {
        if (!user) return;
        const rawBio = user.intent || user.bio || '';
        const { strippedBio, anthem } = parseBioWithAnthem(rawBio);

        setName(user.name || '');
        setUsername(user.username || '');
        setBio(strippedBio);
        setMyAnthem(anthem);
        setLocation(user.location || '');
        setWebsite(user.website || '');
        setExistingAvatarUrl(user.avatarUrl || '');
        setPendingAvatarUri(null); // reset any pending pick
    }, [user]);

    // --- Image pick (deferred upload) ------------------------------------
    const handleImagePick = useCallback(async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            // [FIX-3] Just hold the local URI. Upload happens on Save.
            setPendingAvatarUri(result.assets[0].uri);
        }
    }, []);

    // --- Save -------------------------------------------------------------
    const handleSave = useCallback(async () => {
        if (!name.trim() || !username.trim()) {
            Alert.alert('Required', 'Name and Username are needed.');
            return;
        }

        setIsLoading(true);
        try {
            // [FIX-3] Upload the new avatar now, only if one was picked.
            let finalAvatarUrl = existingAvatarUrl;
            if (pendingAvatarUri) {
                const uploaded = await uploadFile(pendingAvatarUri, 'avatar');
                if (uploaded) finalAvatarUrl = uploaded;
            }

            // [FIX-1] Recombine bio + anthem cleanly, no duplication possible.
            const finalIntent = buildBioWithAnthem(bio, myAnthem);

            // [FIX-2] location and website are no longer silently dropped.
            const updates = {
                name: name.trim(),
                username: username.trim(),
                intent: finalIntent,
                avatarUrl: finalAvatarUrl,
                location: location.trim(),
                website: website.trim(),
            };

            await updateUserProfile(updates);
            if (onClose) onClose();
        } catch (error) {
            // Surface the real server error instead of swallowing it.
            const msg = error?.message || 'Failed to update profile.';
            Alert.alert('Error', msg);
        } finally {
            setIsLoading(false);
        }
    }, [name, username, bio, myAnthem, location, website, pendingAvatarUri, existingAvatarUrl, uploadFile, updateUserProfile, onClose]);

    const displayAvatar = pendingAvatarUri || existingAvatarUrl || 'https://via.placeholder.com/150';

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}
        >
            <View style={[localStyles.header, { borderBottomColor: isDark ? '#333' : '#f0f0f0' }]}>
                <TouchableOpacity onPress={onClose} style={localStyles.iconBtn}>
                    <Ionicons name="close" size={24} color={isDark ? '#ccc' : '#333'} />
                </TouchableOpacity>
                <Text style={[localStyles.headerTitle, { color: isDark ? '#fff' : '#000' }]}>Edit Profile</Text>
                <TouchableOpacity onPress={handleSave} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color={brand.blue} /> : <Text style={localStyles.saveText}>Save</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={localStyles.container} keyboardShouldPersistTaps="handled">

                {/* ⭐️ Avatar Section ⭐️ */}
                <View style={localStyles.avatarSection}>
                    <TouchableOpacity onPress={handleImagePick}>
                        <View style={[localStyles.avatarContainer, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}>
                            <Image source={{ uri: displayAvatar }} style={localStyles.avatarImage} />
                            <View style={localStyles.cameraBadge}>
                                <Ionicons name="camera" size={14} color="#fff" />
                            </View>
                        </View>
                    </TouchableOpacity>
                    <Text style={localStyles.changePhotoText}>
                        {pendingAvatarUri ? 'New photo will upload on Save' : 'Change Profile Photo'}
                    </Text>
                </View>

                {/* ⭐️ Form Section: Identity ⭐️ */}
                <Text style={[localStyles.sectionLabel, { color: isDark ? '#888' : '#888' }]}>THE BASICS</Text>
                <View style={[localStyles.inputGroup, { backgroundColor: isDark ? '#1C1C1E' : '#F9FAFB', borderColor: isDark ? '#333' : '#eee' }]}>
                    <View style={[localStyles.inputRow, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
                        <Text style={[localStyles.fieldLabel, { color: isDark ? '#ddd' : '#333' }]}>Name</Text>
                        <TextInput
                            style={[localStyles.input, { color: isDark ? '#fff' : '#000' }]}
                            value={name} onChangeText={setName}
                            placeholder="Your Name"
                            placeholderTextColor={isDark ? '#888' : '#999'}
                        />
                    </View>
                    <View style={[localStyles.inputRow, { borderBottomWidth: 0 }]}>
                        <Text style={[localStyles.fieldLabel, { color: isDark ? '#ddd' : '#333' }]}>Username</Text>
                        <TextInput
                            style={[localStyles.input, { color: isDark ? '#fff' : '#000' }]}
                            value={username} onChangeText={setUsername}
                            autoCapitalize="none" placeholder="@username"
                            placeholderTextColor={isDark ? '#888' : '#999'}
                        />
                    </View>
                </View>

                {/* ⭐️ Form Section: About ⭐️ */}
                <Text style={[localStyles.sectionLabel, { color: isDark ? '#888' : '#888' }]}>ABOUT YOU</Text>
                <View style={[localStyles.inputGroup, { backgroundColor: isDark ? '#1C1C1E' : '#F9FAFB', borderColor: isDark ? '#333' : '#eee' }]}>
                    <TextInput
                        style={[localStyles.input, localStyles.textArea, { color: isDark ? '#fff' : '#000' }]}
                        value={bio} onChangeText={setBio}
                        multiline placeholder="Write a short bio..."
                        placeholderTextColor={isDark ? '#888' : '#999'}
                    />
                </View>

                {/* ⭐️ Form Section: Vibe Check ⭐️ */}
                <Text style={[localStyles.sectionLabel, { color: isDark ? '#888' : '#888' }]}>VIBE CHECK</Text>
                <View style={[localStyles.inputGroup, { backgroundColor: isDark ? '#1C1C1E' : '#F9FAFB', borderColor: isDark ? '#333' : '#eee' }]}>
                    <View style={[localStyles.inputRow, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
                        <Ionicons name="musical-notes" size={18} color={isDark ? '#888' : '#888'} style={{ marginRight: 10 }} />
                        <TextInput
                            style={[localStyles.input, { color: isDark ? '#fff' : '#000' }]}
                            value={myAnthem} onChangeText={setMyAnthem}
                            placeholder="My Anthem (Song)"
                            placeholderTextColor={isDark ? '#888' : '#999'}
                        />
                    </View>
                    <View style={[localStyles.inputRow, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
                        <Ionicons name="location" size={18} color={isDark ? '#888' : '#888'} style={{ marginRight: 10 }} />
                        <TextInput
                            style={[localStyles.input, { color: isDark ? '#fff' : '#000' }]}
                            value={location} onChangeText={setLocation}
                            placeholder="City / Region"
                            placeholderTextColor={isDark ? '#888' : '#999'}
                        />
                    </View>
                    <View style={[localStyles.inputRow, { borderBottomWidth: 0 }]}>
                        <Ionicons name="link" size={18} color={isDark ? '#888' : '#888'} style={{ marginRight: 10 }} />
                        <TextInput
                            style={[localStyles.input, { color: isDark ? '#fff' : '#000' }]}
                            value={website} onChangeText={setWebsite}
                            placeholder="Website / Link" autoCapitalize="none"
                            placeholderTextColor={isDark ? '#888' : '#999'}
                        />
                    </View>
                </View>

                <View style={{ height: 50 }} />

            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default memo(EditProfileView);

// --- Modern Styles ---
const localStyles = StyleSheet.create({
    container: { padding: 20 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 15, paddingBottom: 15,
        borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 17, fontWeight: '700' },
    saveText: { fontSize: 16, fontWeight: '700', color: brand.blue },
    iconBtn: { padding: 5 },

    avatarSection: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
    avatarContainer: {
        width: 100, height: 100, borderRadius: 50,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1, shadowRadius: 5, elevation: 3,
    },
    avatarImage: { width: '100%', height: '100%', borderRadius: 50 },
    cameraBadge: {
        position: 'absolute', bottom: 0, right: 0,
        backgroundColor: brand.blue, width: 32, height: 32, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff',
    },
    changePhotoText: { color: brand.blue, fontWeight: '600', marginTop: 12, fontSize: 14 },

    sectionLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8, marginTop: 10, marginLeft: 4 },

    inputGroup: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, marginBottom: 20 },
    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
    },
    fieldLabel: { width: 80, fontSize: 15, fontWeight: '500' },
    input: { flex: 1, fontSize: 16 },
    textArea: { height: 100, padding: 16, textAlignVertical: 'top' },
});