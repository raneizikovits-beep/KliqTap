// client/src/components/modals/ChatModal.js
// ⭐️ V2 PRODUCTION: DM Name Resolution Fix + Cleaner Heuristics
//
// CRITICAL FIXES IN THIS VERSION:
// [FIX-1] DM name resolution: if the chatId is a UUID and we can't find a
//         human name, fall back to 'Direct Message' instead of showing the
//         raw UUID. The previous behavior printed something like
//         "a7f3e2c1-8b4d-..." as the chat title.
//
// [FIX-2] isMikeChat: kept for backwards compatibility (was an intentional
//         block), but documented and made case-insensitive to be safer.
//
// All other functionality is preserved 100%: MessageBubble with long-press,
// edit/delete flow, group title resolution, dark mode, keyboard handling.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    Modal, View, Text, TextInput, FlatList,
    TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StyleSheet, SafeAreaView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { useAppStore } from '../../store/useAppStore';
import * as Data from '../../constants/data';

// --- Message bubble with long-press support ---
const MessageBubble = React.memo(({ message, isMyMessage, isDark, onLongPress }) => (
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
                <Text style={[
                    isMyMessage 
                        ? localStyles.chatBubbleTextUser 
                        : [localStyles.chatBubbleTextThem, { color: isDark ? '#ddd' : Data.brand.ink }]
                ]}>
                    {message.text || message.body}
                </Text>
                {message.edited && (
                    <Text style={[localStyles.editedText, { color: isMyMessage ? '#fffa' : (isDark ? '#888' : '#aaa') }]}>
                        (edited)
                    </Text>
                )}
            </View>
        </View>
    </TouchableOpacity>
));

// Simple UUID v4 detector used as a heuristic for DM chat IDs
const isUUIDv4 = (s) => 
    typeof s === 'string' && 
    s.length === 36 && 
    s.split('-').length === 5;

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

    const flatListRef = useRef();
    const textInputRef = useRef(null); 

    const safeChatId = useMemo(() => String(currentChatId || ''), [currentChatId]);

    // [FIX-2] Case-insensitive Mike block (intentional feature, preserved)
    const isMikeChat = useMemo(
        () => safeChatId.toLowerCase().includes('mike'), 
        [safeChatId]
    );

    useEffect(() => {
        setChatInput(""); 
        setEditingMessageId(null);
    }, [safeChatId]); 

    // Chat title resolution
    const chatTitle = useMemo(() => {
        const metadata = chatMetadata?.[safeChatId];

        // 1. Explicit name from metadata
        if (metadata?.name) return metadata.name;

        // 2. Determine group vs DM
        let isGroup;
        if (metadata && typeof metadata.isDM === 'boolean') {
            isGroup = !metadata.isDM;
        } else {
            // Heuristic: a UUID v4 is likely a DM chat ID
            isGroup = !isUUIDv4(safeChatId);
        }

        if (isGroup) {
            const group = groups?.find(g => String(g.id) === safeChatId);
            return group ? group.name : 'Group Chat';
        }
        
        // 3. DM: try fallbackName from metadata
        if (metadata?.fallbackName) return metadata.fallbackName;
        
        // 4. Try to parse "userId1_userId2" format
        const parts = safeChatId.split('_');
        if (parts.length === 2) {
            const otherPart = parts.find(id => 
                id !== String(user?.id) && 
                id !== user?.username
            );
            if (otherPart) return otherPart;
        }
        
        // [FIX-1] Last resort: return a friendly label, NOT the raw UUID
        return 'Direct Message';
    }, [safeChatId, chatMetadata, groups, user?.id, user?.username]);

    const handleSend = useCallback(() => {
      if (chatInput.trim() && !isMikeChat) { 
        if (editingMessageId) {
            editChatMessage(editingMessageId, chatInput);
            setEditingMessageId(null); 
        } else {
            sendChatMessage(chatInput); 
        }
        setChatInput(""); 
        setInputHeight(40); 
      }
    }, [chatInput, isMikeChat, editingMessageId, editChatMessage, sendChatMessage]);
    
    const handleLongPress = useCallback((message) => {
        // Only allow editing/deleting our own messages
        const messageSenderId = message?.sender?.id;
        const currentUserId = user?.id;
        if (!messageSenderId || !currentUserId) return;
        if (String(messageSenderId) !== String(currentUserId)) return;

        Alert.alert("Message Actions", "What would you like to do?", [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Edit', onPress: () => {
                setChatInput(message.text || message.body || '');
                setEditingMessageId(message.id);
                textInputRef.current?.focus();
            }},
            { text: 'Delete', style: 'destructive', onPress: () => {
                if (deleteChatMessage) deleteChatMessage(message.id, true);
            }}
        ]);
    }, [user?.id, deleteChatMessage]);

    if (!currentChatId) return null;

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
                                renderItem={({ item }) => (
                                    <MessageBubble 
                                        message={item} 
                                        isMyMessage={String(item.sender?.id) === String(user?.id)}
                                        isDark={isDark}
                                        onLongPress={handleLongPress}
                                    />
                                )}
                                contentContainerStyle={{ paddingVertical: 10 }}
                                keyboardShouldPersistTaps="handled"
                                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                            />
                        )}
                    </View>
                    
                    {/* Editing bar */}
                    {editingMessageId && (
                        <View style={[localStyles.editingBar, { backgroundColor: isDark ? '#2c2c10' : '#FFF9C4' }]}>
                            <Text style={[localStyles.editingText, { color: isDark ? '#fff' : '#000' }]}>Editing Message...</Text>
                            <TouchableOpacity onPress={() => { setEditingMessageId(null); setChatInput(""); }}>
                                <Ionicons name="close-circle" size={20} color={Data.brand.red} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Input area */}
                    <View style={[localStyles.inputAreaContainer, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderTopColor: isDark ? '#333' : '#eee' }]}>
                        <View style={[localStyles.inputWrapper, { height: Math.max(40, Math.min(100, inputHeight)), backgroundColor: isDark ? '#333' : '#f0f0f0' }]}>
                            <TextInput 
                                ref={textInputRef} 
                                editable={!isMikeChat} 
                                placeholder="Type a message..." 
                                placeholderTextColor="#888" 
                                style={[localStyles.textInput, { color: isDark ? '#fff' : '#000' }]} 
                                value={chatInput} 
                                onChangeText={setChatInput} 
                                multiline={true} 
                                onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height)} 
                            />
                        </View>
                        <TouchableOpacity 
                            style={[localStyles.sendButton, { backgroundColor: chatInput.trim() ? Data.brand.blue : '#ccc' }]} 
                            onPress={handleSend} 
                            disabled={!chatInput.trim()}
                        >
                            <Ionicons name={editingMessageId ? "checkmark" : "send"} size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
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
    systemMessage: { textAlign: 'center', marginVertical: 10, fontSize: 12, fontStyle: 'italic' },
    editingBar: { padding: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    editingText: { fontSize: 12, fontWeight: 'bold', marginRight: 10 },
    inputAreaContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1 },
    inputWrapper: { flex: 1, marginRight: 10, borderRadius: 25, paddingHorizontal: 15, justifyContent: 'center' },
    textInput: { fontSize: 15, lineHeight: 20 },
    sendButton: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' }
});