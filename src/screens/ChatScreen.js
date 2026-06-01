// client/src/screens/ChatScreen.js
// ⭐️ PRODUCTION GRADE v6 — Bug-free, robust, modern ⭐️
//
// ═══════════════════════════════════════════════════════════════
// FIXES IN v6 (vs v5):
//
//   [FIX-8] CRITICAL: closeChat() was firing on every re-render of the
//           main useEffect, not just on screen unmount. This caused the
//           WebSocket room to be abandoned mid-session, making messages
//           one-directional until a manual refresh. Fixed by isolating
//           closeChat() into a dedicated unmount-only effect with an
//           empty dependency array.
//
//   [FIX-9] Call buttons were silently failing when metadata/otherUserId
//           wasn't resolved yet (race condition on screen open). Now
//           resolves the peer ID dynamically via resolveUser() as a
//           fallback before giving up, and shows a loading indicator
//           on the call button while resolving.
//
//   [FIX-10] resolveUser dependency was missing from the call handlers'
//            useCallback dependency arrays, causing stale closure bugs.
//
//   [FIX-11] useAppStore was called TWICE (lines 90 and 313 in v5),
//            creating two separate subscriptions. Merged into one selector.
//
//   [FIX-12] renderHeader() was a plain function re-created on every
//            render. Converted to React.memo component so it only
//            re-renders when its own props change.
//
// ═══════════════════════════════════════════════════════════════
// FIXES PRESERVED FROM v5:
//   [FIX-7] No direct Supabase — all user lookups via resolveUser/backend
//   [FIX-6] chatService.joinChat() + loadHistory() on chat open
//   [FIX-1..5] Header DM title, subtitle, long-press edit/delete, edit UI
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, SafeAreaView,
  StyleSheet, FlatList, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { chatService } from '../store/chatService';
import { brand } from '../constants/data';

// ─────────────────────────────────────────────
// MessageBubble
// ─────────────────────────────────────────────
const MessageBubble = memo(({ message, currentUserId, onUserPress, onLongPress }) => {
  const isMine    = String(message.sender?.id) === String(currentUserId);
  const isDeleted = message.deleted  || message.isDeleted;
  const isEdited  = message.edited   || message.isEdited;
  const isPending = !!message.pending;

  const time = useMemo(() => {
    if (!message.time) return '';
    return new Date(message.time).toLocaleTimeString('he-IL', {
      hour: '2-digit', minute: '2-digit',
    });
  }, [message.time]);

  return (
    <TouchableOpacity
      onLongPress={() => !isDeleted && onLongPress(message, isMine)}
      delayLongPress={350}
      activeOpacity={0.85}
      style={[
        localStyles.messageContainer,
        isMine ? localStyles.messageContainerMine : localStyles.messageContainerTheirs,
      ]}
    >
      <View style={[
        localStyles.bubble,
        isMine ? localStyles.bubbleMine : localStyles.bubbleTheirs,
        isDeleted && localStyles.bubbleDeleted,
        isPending && localStyles.bubblePending,
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

        <View style={localStyles.metaRow}>
          <Text style={[localStyles.timeText, isMine && { color: 'rgba(255,255,255,0.65)' }]}>
            {time}
            {isEdited && !isDeleted ? ' · edited' : ''}
          </Text>
          {isPending && (
            <ActivityIndicator
              size={10}
              color={isMine ? 'rgba(255,255,255,0.6)' : brand.soft}
              style={{ marginLeft: 4 }}
            />
          )}
          {isMine && !isPending && !isDeleted && (
            <Ionicons
              name="checkmark-done"
              size={13}
              color="rgba(255,255,255,0.7)"
              style={{ marginLeft: 3 }}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────
// ChatHeader
// ─────────────────────────────────────────────
const ChatHeader = memo(({
  chatTitle, isDMChat, isCalling,
  onBack, onVoiceCall, onVideoCall,
}) => (
  <View style={localStyles.header}>
    <TouchableOpacity onPress={onBack} style={localStyles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Ionicons name="chevron-back" size={24} color={brand.ink} />
    </TouchableOpacity>

    <View style={localStyles.headerTitleContainer}>
      <Text style={localStyles.headerTitle} numberOfLines={1}>{chatTitle}</Text>
      <Text style={localStyles.headerSubtitle}>
        {isDMChat ? 'Direct Message · Long-press to edit/delete' : 'Group Chat'}
      </Text>
    </View>

    {isDMChat && (
      <>
        <TouchableOpacity
          onPress={onVoiceCall}
          style={localStyles.callBtn}
          disabled={isCalling}
        >
          {isCalling
            ? <ActivityIndicator size={18} color={brand.green} />
            : <Ionicons name="call" size={22} color={brand.green} />
          }
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onVideoCall}
          style={localStyles.callBtn}
          disabled={isCalling}
        >
          {isCalling
            ? <ActivityIndicator size={18} color={brand.blue} />
            : <Ionicons name="videocam" size={24} color={brand.blue} />
          }
        </TouchableOpacity>
      </>
    )}
  </View>
));

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────
export default function ChatScreen({ navigation }) {
  // [FIX-11] Single unified store subscription — no double subscriptions
  const {
    currentChatId, chatHistory, user, groups, chatMetadata,
    sendChatMessage, closeChat, getOtherUserIdInDM,
    setProfilePeekUser, editChatMessage, deleteChatMessage,
    fetchConversations, resolveUser, userCache,
    startCall, setVideoModalOpen, setVoiceModalOpen,
  } = useAppStore(state => ({
    currentChatId:      state.currentChatId,
    chatHistory:        state.chatHistory,
    user:               state.user,
    groups:             state.groups,
    chatMetadata:       state.chatMetadata,
    sendChatMessage:    state.sendChatMessage,
    closeChat:          state.closeChat,
    getOtherUserIdInDM: state.getOtherUserIdInDM,
    setProfilePeekUser: state.setProfilePeekUser,
    editChatMessage:    state.editChatMessage,
    deleteChatMessage:  state.deleteChatMessage,
    fetchConversations: state.fetchConversations,
    resolveUser:        state.resolveUser,
    userCache:          state.userCache,
    startCall:          state.startCall,
    setVideoModalOpen:  state.setVideoModalOpen,
    setVoiceModalOpen:  state.setVoiceModalOpen,
  }));

  const [messageText,    setMessageText]    = useState('');
  const [chatTitle,      setChatTitle]      = useState('Loading...');
  const [editingMessage, setEditingMessage] = useState(null);
  const [isCalling,      setIsCalling]      = useState(false);

  const flatListRef = useRef(null);

  // Normalize chat ID once
  const safeChatId  = useMemo(() => String(currentChatId || ''), [currentChatId]);
  const metadata    = chatMetadata?.[safeChatId];
  const isDMChat    = !!metadata?.isDM;
  const messages    = useMemo(() => chatHistory[safeChatId] || [], [chatHistory, safeChatId]);

  const otherUserId = useMemo(
    () => (getOtherUserIdInDM ? getOtherUserIdInDM(currentChatId) : null),
    [currentChatId, getOtherUserIdInDM],
  );

  // ── Boot: fetch conversations if metadata missing ──────────────
  useEffect(() => {
    if (fetchConversations && !metadata) {
      fetchConversations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Join WebSocket room + load history on open ─────────────────
  // Intentionally not leaving room on unmount (stays live in background).
  useEffect(() => {
    if (!currentChatId) return;
    const chatIdStr = String(currentChatId);
    chatService.joinChat(chatIdStr);
    chatService.loadHistory(chatIdStr);
  }, [currentChatId]);

  // ── [FIX-8] closeChat ONLY on unmount — never on re-render ─────
  // This was the root cause of one-directional messages: closeChat()
  // was in the dependency array of the name-resolver effect, so every
  // time metadata/groups/chatHistory changed it abandoned the WS room.
  const closeChatRef = useRef(closeChat);
  const currentChatIdRef = useRef(currentChatId);
  useEffect(() => { closeChatRef.current = closeChat; }, [closeChat]);
  useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);

  useEffect(() => {
    return () => {
      // Capture latest values via refs so the closure is never stale
      if (currentChatIdRef.current) closeChatRef.current?.();
    };
  }, []); // ← Empty deps: fires ONLY on unmount

  // ── Navigate away if chat lost ─────────────────────────────────
  useEffect(() => {
    if (!currentChatId) navigation.goBack();
  }, [currentChatId, navigation]);

  // ── Resolve chat display name ──────────────────────────────────
  useEffect(() => {
    if (!currentChatId) return;
    let cancelled = false;

    const resolve = async () => {
      // Post thread
      if (safeChatId.startsWith('post:')) {
        if (!cancelled) setChatTitle('Post Comments');
        return;
      }

      // DM with known metadata
      if (metadata?.isDM) {
        const otherId = metadata.otherUserId || otherUserId;
        if (metadata.fallbackName) {
          if (!cancelled) setChatTitle(metadata.fallbackName);
          return;
        }
        if (otherId) {
          try {
            const cached   = userCache?.[otherId];
            const resolved = cached ?? (resolveUser ? await resolveUser(otherId) : null);
            if (!cancelled) setChatTitle(resolved?.name || resolved?.username || 'Private Chat');
          } catch {
            // Fall back to last known message sender
            const other = messages.find(m => String(m.sender?.id) !== String(user?.id));
            if (!cancelled) setChatTitle(other?.sender?.name || other?.sender?.username || 'Private Chat');
          }
          return;
        }
      }

      // Known group
      const group = groups.find(g => String(g.id) === safeChatId);
      if (group) {
        if (!cancelled) setChatTitle(group.name);
        return;
      }

      // Extract from existing messages
      const other = messages.find(m => String(m.sender?.id) !== String(user?.id));
      if (other?.sender) {
        if (!cancelled) setChatTitle(other.sender.name || other.sender.username || 'Chat');
        return;
      }

      // Last resort: resolve otherUserId
      if (otherUserId) {
        try {
          const cached   = userCache?.[otherUserId];
          const resolved = cached ?? (resolveUser ? await resolveUser(otherUserId) : null);
          if (!cancelled) setChatTitle(resolved?.name || resolved?.username || 'Chat');
        } catch {
          if (!cancelled) setChatTitle('User');
        }
        return;
      }

      if (!cancelled) setChatTitle('Chat');
    };

    resolve();

    // Scroll to bottom shortly after opening
    const t = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);

    return () => {
      cancelled = true;
      clearTimeout(t);
      // ⚠️  Do NOT call closeChat here — that's handled by the unmount effect above
    };
  }, [
    currentChatId, safeChatId, metadata, otherUserId,
    groups, messages, user?.id, userCache, resolveUser,
  ]);

  // ── Send / Edit ────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    if (editingMessage) {
      editChatMessage?.(editingMessage.id, trimmed);
      setEditingMessage(null);
    } else {
      sendChatMessage?.(trimmed);
    }
    setMessageText('');
  }, [messageText, editingMessage, sendChatMessage, editChatMessage]);

  const cancelEdit = useCallback(() => {
    setEditingMessage(null);
    setMessageText('');
  }, []);

  // ── Long-press actions ─────────────────────────────────────────
  const handleLongPressMessage = useCallback((message, isMine) => {
    if (!message?.id) return;
    const buttons = [];

    if (isMine) {
      buttons.push({
        text: 'Edit',
        onPress: () => {
          setEditingMessage(message);
          setMessageText(message.text || message.body || '');
        },
      });
      buttons.push({
        text: 'Delete for everyone',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Delete for everyone?',
            'This will remove the message for all participants.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteChatMessage?.(message.id, true) },
            ],
          ),
      });
      buttons.push({
        text: 'Delete for me',
        style: 'destructive',
        onPress: () => deleteChatMessage?.(message.id, false),
      });
    } else {
      buttons.push({
        text: 'Delete for me',
        style: 'destructive',
        onPress: () => deleteChatMessage?.(message.id, false),
      });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message Options', '', buttons);
  }, [deleteChatMessage]);

  // ── [FIX-9] Call handlers with race-safe peer resolution ───────
  const resolveCallTarget = useCallback(async () => {
    let id = otherUserId || metadata?.otherUserId;
    if (!id && resolveUser && safeChatId) {
      try {
        const resolved = await resolveUser(safeChatId);
        id = resolved?.id;
      } catch { /* ignore */ }
    }
    return id ? String(id) : null;
  // [FIX-10] resolveUser is now in deps — no more stale closure
  }, [otherUserId, metadata, resolveUser, safeChatId]);

  const handleStartVoiceCall = useCallback(async () => {
    setIsCalling(true);
    try {
      const otherId = await resolveCallTarget();
      if (!otherId) {
        Alert.alert('Cannot Call', 'Could not identify the other user. Try again in a moment.');
        return;
      }
      await startCall?.(otherId, false);
      setVoiceModalOpen?.(true);
    } catch (e) {
      Alert.alert('Call Error', e.message || 'Could not start voice call.');
    } finally {
      setIsCalling(false);
    }
  }, [resolveCallTarget, startCall, setVoiceModalOpen]);

  const handleStartVideoCall = useCallback(async () => {
    setIsCalling(true);
    try {
      const otherId = await resolveCallTarget();
      if (!otherId) {
        Alert.alert('Cannot Call', 'Could not identify the other user. Try again in a moment.');
        return;
      }
      await startCall?.(otherId, true);
      setVideoModalOpen?.(true);
    } catch (e) {
      Alert.alert('Call Error', e.message || 'Could not start video call.');
    } finally {
      setIsCalling(false);
    }
  }, [resolveCallTarget, startCall, setVideoModalOpen]);

  // ── Render ─────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }) => (
    <MessageBubble
      message={item}
      currentUserId={user?.id}
      onUserPress={setProfilePeekUser}
      onLongPress={handleLongPressMessage}
    />
  ), [user?.id, setProfilePeekUser, handleLongPressMessage]);

  return (
    <SafeAreaView style={localStyles.container}>
      <ChatHeader
        chatTitle={chatTitle}
        isDMChat={isDMChat}
        isCalling={isCalling}
        onBack={() => navigation.goBack()}
        onVoiceCall={handleStartVoiceCall}
        onVideoCall={handleStartVideoCall}
      />

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
          removeClippedSubviews
          windowSize={10}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
        />

        {editingMessage && (
          <View style={localStyles.editBanner}>
            <Ionicons name="pencil" size={16} color={brand.blue} />
            <Text style={localStyles.editBannerText} numberOfLines={1}>
              Editing: {editingMessage.text || editingMessage.body}
            </Text>
            <TouchableOpacity onPress={cancelEdit} style={localStyles.editCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={20} color={brand.red} />
            </TouchableOpacity>
          </View>
        )}

        <View style={localStyles.inputArea}>
          <TextInput
            style={localStyles.input}
            placeholder={editingMessage ? 'Edit message...' : 'Type a message...'}
            placeholderTextColor={brand.soft}
            value={messageText}
            onChangeText={setMessageText}
            multiline={false}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!messageText.trim()}
            style={[localStyles.sendButton, !messageText.trim() && localStyles.sendButtonDisabled]}
            activeOpacity={0.75}
          >
            <Ionicons name={editingMessage ? 'checkmark' : 'send'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const localStyles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: brand.bg },
  flexOne:      { flex: 1 },
  listContent:  { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  backButton:           { padding: 5, marginRight: 8 },
  headerTitleContainer: { flex: 1, marginRight: 8 },
  headerTitle:          { fontSize: 17, fontWeight: '700', color: brand.ink },
  headerSubtitle:       { fontSize: 11, color: brand.soft, marginTop: 1 },
  callBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F7FA', marginLeft: 6,
  },

  // Bubbles
  messageContainer:       { marginVertical: 3, maxWidth: '80%' },
  messageContainerMine:   { alignSelf: 'flex-end' },
  messageContainerTheirs: { alignSelf: 'flex-start' },
  bubble: {
    paddingHorizontal: 13, paddingVertical: 9,
    borderRadius: 18, elevation: 1,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  bubbleMine:    { backgroundColor: brand.blue, borderBottomRightRadius: 4 },
  bubbleTheirs:  { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E8E8E8' },
  bubbleDeleted: { opacity: 0.55, backgroundColor: '#EFEFEF' },
  bubblePending: { opacity: 0.7 },
  deletedText:   { fontStyle: 'italic', color: '#999', fontSize: 14 },
  senderName:    { fontSize: 12, fontWeight: '700', marginBottom: 3, color: brand.soft },
  messageText:   { fontSize: 15.5, lineHeight: 22, color: brand.ink },
  metaRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  timeText:      { fontSize: 10, color: brand.soft },

  // Edit banner
  editBanner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#E8F4FD',
    borderTopWidth: 1, borderTopColor: '#C5E0F5',
  },
  editBannerText: { flex: 1, marginLeft: 8, color: brand.blue, fontSize: 13, fontStyle: 'italic' },
  editCancel:     { padding: 4 },

  // Input area
  inputArea: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1, minHeight: 42, maxHeight: 100,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 21, backgroundColor: '#F2F3F5',
    marginRight: 8, fontSize: 15.5, color: brand.ink,
  },
  sendButton: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: brand.blue,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: brand.blue, shadowOpacity: 0.35,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sendButtonDisabled: { opacity: 0.45, shadowOpacity: 0 },
});