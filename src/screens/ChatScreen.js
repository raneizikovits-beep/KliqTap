// client/src/screens/ChatScreen.js
// ⭐️ PRODUCTION GRADE v3: Telegram-style edit/delete + correct DM title resolution ⭐️
//
// Fixes:
//   [FIX-1] Header title now properly resolves DM users (was showing "Group Chat" 
//           even for private chats due to chatMetadata lookup with non-string ID)
//   [FIX-2] Subtitle ("Direct Message" vs "Group Chat") now uses String(currentChatId)
//   [FIX-3] Long-press on own message → Edit / Delete for me / Delete for everyone
//   [FIX-4] Long-press on others' message → Delete for me only (like Telegram)
//   [FIX-5] Edit mode UI with cancel option

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, TextInput, 
  KeyboardAvoidingView, Platform, SafeAreaView, 
  StyleSheet, FlatList, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore'; 
import { brand } from '../constants/data'; 
import { supabase } from '../lib/supabase'; 

// --- MessageBubble Component ---
const MessageBubble = React.memo(({ message, currentUserId, onUserPress, onLongPress }) => {
  const isMine = String(message.sender?.id) === String(currentUserId);
  const time = message.time ? new Date(message.time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
  const isDeleted = message.deleted || message.isDeleted;
  const isEdited = message.edited || message.isEdited;

  return (
    <TouchableOpacity 
      onLongPress={() => !isDeleted && onLongPress(message, isMine)}
      delayLongPress={350}
      activeOpacity={0.85}
      style={[
        localStyles.messageContainer,
        isMine ? localStyles.messageContainerMine : localStyles.messageContainerTheirs
      ]}>
      <View style={[
        localStyles.bubble,
        isMine ? localStyles.bubbleMine : localStyles.bubbleTheirs,
        isDeleted && localStyles.bubbleDeleted
      ]}>
        {!isMine && !isDeleted && (
          <TouchableOpacity onPress={() => onUserPress(message.sender)}>
            <Text style={localStyles.senderName}>
              {message.sender?.name || message.sender?.username || 'User'}
            </Text>
          </TouchableOpacity>
        )}
        {isDeleted ? (
          <Text style={localStyles.deletedText}>🚫 Message deleted</Text>
        ) : (
          <Text style={[localStyles.messageText, isMine && { color: '#fff' }]}>
            {message.text || message.body}
          </Text>
        )}
        <Text style={[localStyles.timeText, isMine && { color: 'rgba(255,255,255,0.7)' }]}>
          {time} {isEdited && !isDeleted && '· edited'} {message.pending && '...'}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// --- Main Screen Component ---
export default function ChatScreen({ navigation }) {
  const { 
    currentChatId, chatHistory, user, groups, chatMetadata, 
    sendChatMessage, closeChat, getOtherUserIdInDM,
    setProfilePeekUser, editChatMessage, deleteChatMessage,
    fetchConversations
  } = useAppStore(state => ({
    currentChatId: state.currentChatId,
    chatHistory: state.chatHistory,
    user: state.user,
    groups: state.groups,
    sendChatMessage: state.sendChatMessage,
    closeChat: state.closeChat,
    chatMetadata: state.chatMetadata,
    getOtherUserIdInDM: state.getOtherUserIdInDM,
    setProfilePeekUser: state.setProfilePeekUser,
    editChatMessage: state.editChatMessage,
    deleteChatMessage: state.deleteChatMessage,
    fetchConversations: state.fetchConversations
  }));

  const [messageText, setMessageText] = useState('');
  const [chatTitle, setChatTitle] = useState('Loading...'); 
  const [editingMessage, setEditingMessage] = useState(null);
  const flatListRef = useRef(null);
  
  // [FIX-1] Always normalize currentChatId before any lookup or comparison
  const safeChatId = useMemo(() => String(currentChatId || ''), [currentChatId]);
  const metadata = chatMetadata?.[safeChatId];
  const isDMChat = !!metadata?.isDM;
  
  const otherUserId = useMemo(() => {
    return getOtherUserIdInDM ? getOtherUserIdInDM(currentChatId) : null;
  }, [currentChatId, getOtherUserIdInDM]);

  // [FIX-2] Trigger fetchConversations on first load if metadata missing
  useEffect(() => {
    if (fetchConversations && !metadata) {
      fetchConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentChatId) {
      navigation.goBack();
      return;
    }

    let isMounted = true;

    const resolveChatName = async () => {
      if (safeChatId.startsWith('post:')) {
          if (isMounted) setChatTitle('Post Comments');
          return;
      }

      // 1. Check chatMetadata FIRST (most reliable source from server)
      if (metadata?.isDM) {
          const otherId = metadata.otherUserId || otherUserId;
          if (metadata.fallbackName) {
              if (isMounted) setChatTitle(metadata.fallbackName);
              return;
          }
          if (otherId) {
              try {
                  const { data, error } = await supabase
                      .from('profiles')
                      .select('full_name, username')
                      .eq('id', otherId)
                      .single();
                  if (error) throw error;
                  if (isMounted) setChatTitle(data?.full_name || data?.username || 'Private Chat');
              } catch (e) {
                  const messages = chatHistory[safeChatId] || [];
                  const otherUserMsg = messages.find(m => String(m.sender?.id) !== String(user?.id));
                  if (isMounted) setChatTitle(otherUserMsg?.sender?.name || otherUserMsg?.sender?.username || 'Private Chat');
              }
              return;
          }
      }

      // 2. Check if it's a known group
      const cachedGroup = groups.find(g => String(g.id) === safeChatId);
      if (cachedGroup) {
          if (isMounted) setChatTitle(cachedGroup.name);
          return;
      }

      // 3. Last resort — try to extract from messages
      const messages = chatHistory[safeChatId] || [];
      const otherUserMsg = messages.find(m => String(m.sender?.id) !== String(user?.id));
      if (otherUserMsg?.sender) {
          if (isMounted) setChatTitle(otherUserMsg.sender.name || otherUserMsg.sender.username || 'Chat');
          return;
      }

      if (otherUserId) {
          try {
              const { data, error } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('id', otherUserId)
                  .single();
              if (error) throw error;
              if (isMounted) setChatTitle(data?.full_name || 'Chat');
          } catch (e) {
              if (isMounted) setChatTitle('User'); 
          }
          return;
      }

      if (isMounted) setChatTitle('Chat');
    };

    resolveChatName();

    const scrollTimeout = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(scrollTimeout);
      if (currentChatId) closeChat(); 
    };
  }, [currentChatId, navigation, closeChat, otherUserId, groups, metadata, chatHistory, user?.id, safeChatId]);

  const messages = useMemo(() => chatHistory[safeChatId] || [], [chatHistory, safeChatId]);
  
  const handleSend = useCallback(() => {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    if (editingMessage) {
      if (editChatMessage) {
        editChatMessage(editingMessage.id, trimmed);
      }
      setEditingMessage(null);
      setMessageText('');
    } else {
      sendChatMessage(trimmed);
      setMessageText('');
    }
  }, [messageText, sendChatMessage, editingMessage, editChatMessage]);

  // [FIX-3][FIX-4] Long-press handler — Telegram-style menu
  const handleLongPressMessage = useCallback((message, isMine) => {
    const buttons = [];

    if (isMine) {
      buttons.push({ 
        text: "Edit", 
        onPress: () => {
          setEditingMessage(message);
          setMessageText(message.text || message.body || '');
        }
      });
      buttons.push({ 
        text: "Delete for me", 
        onPress: () => {
          if (deleteChatMessage) deleteChatMessage(message.id, false);
        }
      });
      buttons.push({ 
        text: "Delete for everyone", 
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            "Delete for everyone?",
            "This message will be deleted for all participants. This cannot be undone.",
            [
              { text: "Cancel", style: "cancel" },
              { 
                text: "Delete", 
                style: 'destructive',
                onPress: () => {
                  if (deleteChatMessage) deleteChatMessage(message.id, true);
                }
              }
            ]
          );
        }
      });
    } else {
      buttons.push({ 
        text: "Delete for me", 
        style: 'destructive',
        onPress: () => {
          if (deleteChatMessage) deleteChatMessage(message.id, false);
        }
      });
    }

    buttons.push({ text: "Cancel", style: "cancel" });

    Alert.alert("Message Actions", "What would you like to do?", buttons);
  }, [deleteChatMessage]);

  const cancelEdit = useCallback(() => {
    setEditingMessage(null);
    setMessageText('');
  }, []);

  const renderItem = useCallback(({ item }) => (
    <MessageBubble 
      message={item} 
      currentUserId={user?.id} 
      onUserPress={(sender) => setProfilePeekUser(sender)}
      onLongPress={handleLongPressMessage}
    />
  ), [user?.id, setProfilePeekUser, handleLongPressMessage]);
  
  // [NEW] Hook up actual call actions
  const { startCall, setVideoModalOpen, setVoiceModalOpen } = useAppStore(state => ({
      startCall: state.startCall,
      setVideoModalOpen: state.setVideoModalOpen,
      setVoiceModalOpen: state.setVoiceModalOpen
  }));

  const handleStartVoiceCall = useCallback(async () => {
      const otherId = otherUserId || metadata?.otherUserId;
      if (!otherId) {
          Alert.alert("Cannot Call", "Could not identify the other user in this chat.");
          return;
      }
      try {
          if (startCall) await startCall(String(otherId), false);
          if (setVoiceModalOpen) setVoiceModalOpen(true);
      } catch (e) {
          Alert.alert("Call Error", e.message || "Could not start voice call.");
      }
  }, [otherUserId, metadata, startCall, setVoiceModalOpen]);

  const handleStartVideoCall = useCallback(async () => {
      const otherId = otherUserId || metadata?.otherUserId;
      if (!otherId) {
          Alert.alert("Cannot Call", "Could not identify the other user in this chat.");
          return;
      }
      try {
          if (startCall) await startCall(String(otherId), true);
          if (setVideoModalOpen) setVideoModalOpen(true);
      } catch (e) {
          Alert.alert("Call Error", e.message || "Could not start video call.");
      }
  }, [otherUserId, metadata, startCall, setVideoModalOpen]);

  const renderHeader = () => (
    <View style={localStyles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={localStyles.backButton}>
        <Ionicons name="chevron-back" size={24} color={brand.ink} />
      </TouchableOpacity>
      <View style={localStyles.headerTitleContainer}>
        <Text style={localStyles.headerTitle} numberOfLines={1}>{chatTitle}</Text>
        <Text style={localStyles.headerSubtitle}>
          {isDMChat ? 'Direct Message · Long-press messages for options' : 'Group Chat'}
        </Text>
      </View>
      {/* [NEW] Two separate call buttons — voice + video */}
      {isDMChat && (
        <>
          <TouchableOpacity onPress={handleStartVoiceCall} style={localStyles.callBtn}>
             <Ionicons name="call" size={22} color={brand.green} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleStartVideoCall} style={localStyles.callBtn}>
             <Ionicons name="videocam" size={24} color={brand.blue} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={localStyles.container}>
      {renderHeader()}
      <KeyboardAvoidingView
        style={localStyles.flexOne}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} 
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item, index) => item?.id ? String(item.id) : `msg-${index}`}
          contentContainerStyle={localStyles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        />

        {editingMessage && (
          <View style={localStyles.editBanner}>
            <Ionicons name="pencil" size={16} color={brand.blue} />
            <Text style={localStyles.editBannerText} numberOfLines={1}>
              Editing: {editingMessage.text || editingMessage.body}
            </Text>
            <TouchableOpacity onPress={cancelEdit} style={localStyles.editCancel}>
              <Ionicons name="close-circle" size={20} color={brand.red} />
            </TouchableOpacity>
          </View>
        )}

        <View style={localStyles.inputArea}>
          <TextInput
            style={localStyles.input}
            placeholder={editingMessage ? "Edit message..." : "Type a message..."}
            placeholderTextColor={brand.soft}
            value={messageText}
            onChangeText={setMessageText}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity 
            onPress={handleSend} 
            disabled={!messageText.trim()}
            style={[localStyles.sendButton, !messageText.trim() && localStyles.sendButtonDisabled]}
          >
            <Ionicons name={editingMessage ? "checkmark" : "send"} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brand.bg },
  flexOne: { flex: 1 },
  listContent: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, 
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff',
  },
  backButton: { padding: 5, marginRight: 10 },
  callBtn: { 
    padding: 8, marginLeft: 6, 
    width: 38, height: 38, borderRadius: 19, 
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F7FA',
  },
  headerTitleContainer: { flex: 1, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: brand.ink },
  headerSubtitle: { fontSize: 12, color: brand.soft },
  messageContainer: { marginVertical: 4, maxWidth: '80%' },
  messageContainerMine: { alignSelf: 'flex-end' },
  messageContainerTheirs: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, elevation: 1 },
  bubbleMine: { backgroundColor: brand.blue, borderBottomRightRadius: 2 },
  bubbleTheirs: { backgroundColor: '#fff', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#eee' },
  bubbleDeleted: { opacity: 0.6, backgroundColor: '#F0F0F0' },
  deletedText: { fontStyle: 'italic', color: '#999', fontSize: 14 },
  senderName: { fontSize: 12, fontWeight: 'bold', marginBottom: 2, color: brand.soft },
  messageText: { fontSize: 16, color: brand.ink },
  timeText: { fontSize: 10, textAlign: 'right', marginTop: 3, color: brand.soft },
  editBanner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#E3F2FD', borderTopWidth: 1, borderTopColor: '#bbdefb',
  },
  editBannerText: { flex: 1, marginLeft: 8, color: brand.blue, fontSize: 13, fontStyle: 'italic' },
  editCancel: { padding: 4 },
  inputArea: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, 
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#eee', backgroundColor: '#fff',
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 100, paddingHorizontal: 15, paddingVertical: 10, 
    borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 8, fontSize: 16,
  },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: brand.blue, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
});