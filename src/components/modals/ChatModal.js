// client/src/components/modals/ChatModal.js
// ⭐️ V4 PRODUCTION: Full Screen Image Viewer + Save to Gallery + Attachments

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    Modal, View, Text, TextInput, FlatList, Image,
    TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StyleSheet, SafeAreaView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import * as ImagePicker from 'expo-image-picker'; 
import * as FileSystem from 'expo-file-system'; 
import * as MediaLibrary from 'expo-media-library'; 
import { useAppStore } from '../../store/useAppStore';
import * as Data from '../../constants/data';

// --- Message bubble with long-press support ---
const MessageBubble = React.memo(({ message, isMyMessage, isDark, onLongPress, onImagePress }) => {
    const attachmentUrl = message.attachmentUrl || message.imageUrl || message.image || message.fileUrl;

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onLongPress={() => onLongPress && onLongPress(message)}
            delayLongPress={350}
        >
            <View style={[
                localStyles.chatMessageRow, 
                isMyMessage ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }
            ]}>
                <View style={[
                    localStyles.chatBubble, 
                    isMyMessage 
                        ? localStyles.chatBubbleUser 
                        : [localStyles.chatBubbleThem, { backgroundColor: isDark ? '#333' : '#E5E5EA' }]
                ]}>
                    {message.replyTo && (
                        <View style={[
                            localStyles.replyQuote,
                            { borderLeftColor: isMyMessage ? 'rgba(255,255,255,0.6)' : Data.brand.blue },
                        ]}>
                            <Text style={[localStyles.replyQuoteAuthor, { color: isMyMessage ? 'rgba(255,255,255,0.85)' : Data.brand.blue }]} numberOfLines={1}>
                                {message.replyTo.sender?.name || message.replyTo.sender?.username || 'Message'}
                            </Text>
                            <Text style={[localStyles.replyQuoteText, { color: isMyMessage ? 'rgba(255,255,255,0.7)' : '#888' }]} numberOfLines={2}>
                                {message.replyTo.text || message.replyTo.body || '↩ Original message'}
                            </Text>
                        </View>
                    )}

                    {/* ⭐️ תמונה לחיצה שפותחת מסך מלא */}
                    {attachmentUrl && typeof attachmentUrl === 'string' && (
                        <TouchableOpacity onPress={() => onImagePress(attachmentUrl)} activeOpacity={0.9}>
                            <Image 
                                source={{ uri: attachmentUrl }} 
                                style={{ 
                                    width: 180, height: 180, borderRadius: 12, resizeMode: 'cover', 
                                    marginBottom: (message.text || message.body) ? 8 : 0 
                                }} 
                            />
                        </TouchableOpacity>
                    )}

                    {(message.text || message.body) ? (
                        <Text style={[
                            isMyMessage ? localStyles.chatBubbleTextUser : [localStyles.chatBubbleTextThem, { color: isDark ? '#ddd' : Data.brand.ink }]
                        ]}>
                            {message.text || message.body}
                        </Text>
                    ) : null}

                    {message.edited && (
                        <Text style={[localStyles.editedText, { color: isMyMessage ? '#fffa' : (isDark ? '#888' : '#aaa') }]}>
                            (edited)
                        </Text>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
});

const isUUIDv4 = (s) => typeof s === 'string' && s.length === 36 && s.split('-').length === 5;

export default function ChatModal() {
    const { 
      currentChatId, chatHistory, chatMetadata, closeChat, sendChatMessage, 
      deleteChatMessage, editChatMessage, clearChatHistory, user,
      groups, userSettings 
    } = useAppStore(state => ({
      currentChatId: state.currentChatId, 
      chatHistory: state.chatHistory[state.currentChatId] || [], 
      chatMetadata: state.chatMetadata,
      closeChat: state.closeChat, 
      sendChatMessage: state.sendChatMessage, 
      deleteChatMessage: state.deleteChatMessage, 
      editChatMessage: state.editChatMessage, 
      clearChatHistory: state.clearChatHistory, 
      user: state.user,
      groups: state.groups, 
      userSettings: state.userSettings 
    }));
    
    const isDark = userSettings?.darkMode === true; 
    const [chatInput, setChatInput] = useState("");
    const [inputHeight, setInputHeight] = useState(40); 
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null); 
    const [attachmentUri, setAttachmentUri] = useState(null); 
    const [viewingImage, setViewingImage] = useState(null); // ⭐️ סטייט לתמונה המוגדלת
    const [isSavingImage, setIsSavingImage] = useState(false);

    const flatListRef = useRef();
    const textInputRef = useRef(null); 

    const safeChatId = useMemo(() => String(currentChatId || ''), [currentChatId]);
    const isMikeChat = useMemo(() => safeChatId.toLowerCase().includes('mike'), [safeChatId]);

    useEffect(() => {
        setChatInput(""); 
        setEditingMessageId(null);
        setReplyingTo(null); 
        setAttachmentUri(null); 
    }, [safeChatId]); 

    const chatTitle = useMemo(() => {
        const metadata = chatMetadata?.[safeChatId];
        if (metadata?.name) return metadata.name;
        
        let isGroup;
        if (metadata && typeof metadata.isDM === 'boolean') {
            isGroup = !metadata.isDM;
        } else {
            isGroup = !isUUIDv4(safeChatId);
        }

        if (isGroup) {
            const group = groups?.find(g => String(g.id) === safeChatId);
            return group ? group.name : 'Group Chat';
        }
        
        if (metadata?.fallbackName) return metadata.fallbackName;
        
        const parts = safeChatId.split('_');
        if (parts.length === 2) {
            const otherPart = parts.find(id => id !== String(user?.id) && id !== user?.username);
            if (otherPart) return otherPart;
        }
        
        return 'Direct Message';
    }, [safeChatId, chatMetadata, groups, user?.id, user?.username]);

    const handlePickAttachment = useCallback(async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Camera roll permissions are required.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All, 
                quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                setAttachmentUri(result.assets[0].uri);
            }
        } catch (error) {
            console.warn('[ChatModal] Attachment error:', error);
            Alert.alert('Error', 'Could not pick the file.');
        }
    }, []);

    // ── ⭐️ פונקציית שמירת התמונה לגלריה ⭐️ ──
    const handleSaveImageToGallery = useCallback(async (url) => {
        if (!url) return;
        setIsSavingImage(true);
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Needed', 'We need access to your gallery to save images.');
                setIsSavingImage(false);
                return;
            }

            let fileUri = url;
            if (url.startsWith('http')) {
                const filename = url.split('/').pop().split('?')[0] || `kliq_img_${Date.now()}.jpg`;
                const localPath = `${FileSystem.documentDirectory}${filename}`;
                const downloaded = await FileSystem.downloadAsync(url, localPath);
                fileUri = downloaded.uri;
            }

            await MediaLibrary.saveToLibraryAsync(fileUri);
            Alert.alert('Success ✅', 'Image saved to your gallery!');
        } catch (err) {
            console.warn('[ChatModal] Save image error:', err);
            Alert.alert('Error', 'Could not save the image. Try again.');
        } finally {
            setIsSavingImage(false);
        }
    }, []);

    const handleSend = useCallback(() => {
      const canSend = chatInput.trim() || attachmentUri;
      
      if (canSend && !isMikeChat) { 
        if (editingMessageId) {
            editChatMessage(editingMessageId, chatInput.trim());
            setEditingMessageId(null); 
        } else {
            sendChatMessage(chatInput.trim(), { 
                replyToId: replyingTo?.id,
                attachmentUri: attachmentUri 
            });
            setReplyingTo(null);
            setAttachmentUri(null); 
        }
        setChatInput(""); 
        setInputHeight(40); 
      }
    }, [chatInput, attachmentUri, isMikeChat, editingMessageId, editChatMessage, sendChatMessage, replyingTo]);
    
    const handleLongPress = useCallback((message) => {
        const messageSenderId = message?.sender?.id;
        const currentUserId = user?.id;
        const isOwnMessage = !!messageSenderId && !!currentUserId && String(messageSenderId) === String(currentUserId);

        const buttons = [{ text: '↩ Reply', onPress: () => { setReplyingTo(message); setEditingMessageId(null); textInputRef.current?.focus(); }}];

        if (isOwnMessage) {
            buttons.push(
                { text: '✏️ Edit', onPress: () => { setChatInput(message.text || message.body || ''); setEditingMessageId(message.id); setReplyingTo(null); textInputRef.current?.focus(); }},
                { text: '🗑️ Delete', style: 'destructive', onPress: () => {
                    Alert.alert('Delete Message', 'Remove this message for everyone?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete for me', onPress: () => { if (deleteChatMessage) deleteChatMessage(message.id, false); }},
                            { text: 'Delete for everyone', style: 'destructive', onPress: () => { if (deleteChatMessage) deleteChatMessage(message.id, true); }},
                    ]);
                }},
            );
        }
        buttons.push({ text: 'Cancel', style: 'cancel' });
        Alert.alert('Message Actions', 'What would you like to do?', buttons, { cancelable: true });
    }, [user?.id, deleteChatMessage]);

    if (!currentChatId) return null;

    const isSendDisabled = !chatInput.trim() && !attachmentUri;

    return (
      <Modal visible={!!currentChatId} animationType="slide" onRequestClose={closeChat}>
        <SafeAreaView style={[localStyles.safeArea, { backgroundColor: isDark ? '#000' : '#f9f9f9' }]}>
            <KeyboardAvoidingView 
              style={localStyles.keyboardContainer} 
              behavior={Platform.OS === "ios" ? "padding" : undefined} 
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
            >
                <View style={localStyles.container}> 
                    {/* Header */}
                    <View style={[localStyles.modalHeader, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderBottomColor: isDark ? '#333' : '#eee' }]}>
                        <TouchableOpacity onPress={closeChat} style={localStyles.headerIcon}> 
                            <Ionicons name="chevron-back" size={28} color={Data.brand.blue} /> 
                        </TouchableOpacity>
                        <Text style={[localStyles.headerTitle, { color: isDark ? '#fff' : Data.brand.ink }]} numberOfLines={1}>
                            {chatTitle}
                        </Text>
                        <TouchableOpacity onPress={() => clearChatHistory(safeChatId)} style={localStyles.headerIcon}> 
                            <Ionicons name="trash-bin-outline" size={24} color={Data.brand.red} /> 
                        </TouchableOpacity>
                    </View>

                    {/* Chat content */}
                    <View style={localStyles.chatContentArea}> 
                        {isMikeChat ? (
                            <View style={localStyles.centered}>
                                <Text style={{ fontSize: 40 }}>🚫</Text>
                                <Text style={[localStyles.systemMessage, { color: Data.brand.red }]}>Chat Unavailable</Text>
                            </View>
                        ) : (
                            <FlatList
                                ref={flatListRef}
                                data={chatHistory}
                                keyExtractor={(item) => String(item.id)}
                                renderItem={({ item }) => {
                                    const enriched = (item.replyToId && !item.replyTo) ? { ...item, replyTo: chatHistory.find(m => String(m.id) === String(item.replyToId) || String(m.clientId) === String(item.replyToId)) || null } : item;
                                    return (
                                        <MessageBubble 
                                            message={enriched} 
                                            isMyMessage={String(enriched.sender?.id) === String(user?.id)} 
                                            isDark={isDark} 
                                            onLongPress={handleLongPress} 
                                            onImagePress={setViewingImage} // 👈 חיבור לפתיחת תמונה
                                        />
                                    );
                                }}
                                contentContainerStyle={{ paddingVertical: 10 }}
                                keyboardShouldPersistTaps="handled"
                                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                            />
                        )}
                    </View>
                    
                    {/* Banners */}
                    {replyingTo && (
                        <View style={[localStyles.editingBar, { backgroundColor: isDark ? '#102A43' : '#EAF2FF' }]}>
                            <Text style={[localStyles.editingText, { color: isDark ? '#fff' : '#000', flex: 1 }]} numberOfLines={1}>
                                ↩ Replying to {String(replyingTo.sender?.id) === String(user?.id) ? 'yourself' : (replyingTo.sender?.name || replyingTo.sender?.username || 'message')}: {replyingTo.text || replyingTo.body}
                            </Text>
                            <TouchableOpacity onPress={() => setReplyingTo(null)}><Ionicons name="close-circle" size={20} color={Data.brand.red} /></TouchableOpacity>
                        </View>
                    )}

                    {editingMessageId && (
                        <View style={[localStyles.editingBar, { backgroundColor: isDark ? '#2c2c10' : '#FFF9C4' }]}>
                            <Text style={[localStyles.editingText, { color: isDark ? '#fff' : '#000' }]}>Editing Message...</Text>
                            <TouchableOpacity onPress={() => { setEditingMessageId(null); setChatInput(""); }}><Ionicons name="close-circle" size={20} color={Data.brand.red} /></TouchableOpacity>
                        </View>
                    )}

                    {attachmentUri && (
                        <View style={[localStyles.attachmentPreviewBanner, { backgroundColor: isDark ? '#1C1C1E' : '#f8f9fa' }]}>
                            <Image source={{ uri: attachmentUri }} style={localStyles.previewImage} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: isDark ? '#fff' : Data.brand.ink }}>Attached Media</Text>
                            </View>
                            <TouchableOpacity onPress={() => setAttachmentUri(null)} style={{ padding: 5 }}>
                                <Ionicons name="close-circle" size={24} color={Data.brand.red} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Input area */}
                    <View style={[localStyles.inputAreaContainer, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderTopColor: isDark ? '#333' : '#eee' }]}>
                        <TouchableOpacity onPress={handlePickAttachment} style={{ padding: 8, marginRight: 2 }}>
                            <Ionicons name="attach" size={28} color={isDark ? '#888' : '#666'} />
                        </TouchableOpacity>

                        <View style={[localStyles.inputWrapper, { height: Math.max(40, Math.min(100, inputHeight)), backgroundColor: isDark ? '#333' : '#f0f0f0' }]}>
                            <TextInput 
                                ref={textInputRef} editable={!isMikeChat} placeholder="Type a message..." placeholderTextColor="#888" 
                                style={[localStyles.textInput, { color: isDark ? '#fff' : '#000' }]} 
                                value={chatInput} onChangeText={setChatInput} multiline={true} 
                                onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)} 
                            />
                        </View>
                        <TouchableOpacity 
                            style={[localStyles.sendButton, { backgroundColor: isSendDisabled ? '#ccc' : Data.brand.blue }]} 
                            onPress={handleSend} disabled={isSendDisabled}
                        >
                            <Ionicons name={editingMessageId ? "checkmark" : "send"} size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
            
            {/* ⭐️ מודל תצוגת התמונה המלאה (Full Screen Viewer) ⭐️ */}
            <Modal visible={!!viewingImage} transparent={true} animationType="fade" onRequestClose={() => setViewingImage(null)}>
                <View style={localStyles.fullScreenViewer}>
                    <SafeAreaView style={localStyles.viewerHeader}>
                        <TouchableOpacity onPress={() => setViewingImage(null)} style={localStyles.viewerIconBtn}>
                            <Ionicons name="close" size={30} color="#fff" />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={() => handleSaveImageToGallery(viewingImage)} 
                            style={localStyles.viewerIconBtn}
                            disabled={isSavingImage}
                        >
                            {isSavingImage ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="download-outline" size={30} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </SafeAreaView>
                    {viewingImage && (
                        <Image source={{ uri: viewingImage }} style={localStyles.fullScreenImage} />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
      </Modal>
    );
}

const localStyles = StyleSheet.create({
    safeArea: { flex: 1 },
    keyboardContainer: { flex: 1 },
    container: { flex: 1, justifyContent: 'flex-end' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1 },
    headerIcon: { padding: 5 },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', marginHorizontal: 8 },
    chatContentArea: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    chatMessageRow: { marginBottom: 10, paddingHorizontal: 15, maxWidth: '85%' },
    chatBubble: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 18 },
    chatBubbleUser: { backgroundColor: Data.brand.blue, borderBottomRightRadius: 4 },
    chatBubbleThem: { borderBottomLeftRadius: 4 },
    chatBubbleTextUser: { color: '#fff', fontSize: 15 },
    chatBubbleTextThem: { fontSize: 15 },
    editedText: { fontSize: 10, marginTop: 2 },
    replyQuote: { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 4 },
    replyQuoteAuthor: { fontSize: 12, fontWeight: 'bold', marginBottom: 1 },
    replyQuoteText: { fontSize: 12 },
    systemMessage: { textAlign: 'center', marginVertical: 10, fontSize: 12, fontStyle: 'italic' },
    editingBar: { padding: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    editingText: { fontSize: 12, fontWeight: 'bold', marginRight: 10 },
    attachmentPreviewBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E0E0E0' },
    previewImage: { width: 44, height: 44, borderRadius: 8, marginRight: 10 },
    inputAreaContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1 },
    inputWrapper: { flex: 1, marginRight: 10, borderRadius: 25, paddingHorizontal: 15, justifyContent: 'center' },
    textInput: { fontSize: 15, lineHeight: 20 },
    sendButton: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' },
    
    // ⭐️ Full Screen Viewer Styles ⭐️
    fullScreenViewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    viewerHeader: { position: 'absolute', top: 0, width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 20 : 40, zIndex: 10 },
    viewerIconBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 30 },
    fullScreenImage: { width: '100%', height: '80%', resizeMode: 'contain' },
});