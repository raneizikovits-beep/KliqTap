// client/src/screens/ChatScreen.js
// ⭐️ PRODUCTION GRADE V10 — Infinite Scroll, Attachments, Image Viewer & Save to Gallery ⭐️

import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, SafeAreaView,
  StyleSheet, FlatList, Alert, ActivityIndicator, Image, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system'; // 👈 נוסף לשמירת קבצים
import * as MediaLibrary from 'expo-media-library'; // 👈 נוסף לשמירת קבצים לגלריה
import { useAppStore } from '../store/useAppStore';
import { chatService } from '../store/chatService';
import { brand } from '../constants/data';
import { trackEvent } from '../utils/analytics'; 

// ─── Security Report Helper ───────────────────────────────────────────────────
async function _submitSecurityReport(reportedId, reason, token) {
    if (!reportedId || !token) return false;
    try {
        const resp = await fetch('https://api.kliqtap.com/security/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ reportedId: String(reportedId), reason }),
        });
        return resp.ok;
    } catch { return false; }
}
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────
// MessageBubble
// ─────────────────────────────────────────────
const MessageBubble = memo(({ message, currentUserId, onUserPress, onLongPress, onImagePress }) => {
  const isMine    = String(message.sender?.id) === String(currentUserId);
  const isDeleted = message.deleted  || message.isDeleted;
  const isEdited  = message.edited   || message.isEdited;
  const isPending = !!message.pending;

  // מזהה אם יש תמונה בהודעה מהשרת
  const attachmentUrl = message.attachmentUrl || message.imageUrl || message.image || message.fileUrl;

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
          <>
            {message.replyTo && (
              <View style={[
                localStyles.replyQuote,
                isMine ? localStyles.replyQuoteMine : localStyles.replyQuoteTheirs,
              ]}>
                <Text style={[localStyles.replyQuoteAuthor, { color: isMine ? 'rgba(255,255,255,0.85)' : brand.blue }]} numberOfLines={1}>
                  {message.replyTo.sender?.name || message.replyTo.sender?.username || 'Message'}
                </Text>
                <Text style={[localStyles.replyQuoteText, { color: isMine ? 'rgba(255,255,255,0.7)' : brand.soft }]} numberOfLines={2}>
                  {message.replyTo.text || message.replyTo.body || '↩ Original message'}
                </Text>
              </View>
            )}
            
            {/* ⭐️ תמונה לחיצה שפותחת את ה-Viewer */}
            {attachmentUrl && typeof attachmentUrl === 'string' && (
              <TouchableOpacity onPress={() => onImagePress(attachmentUrl)} activeOpacity={0.9}>
                <Image 
                  source={{ uri: attachmentUrl }} 
                  style={[localStyles.bubbleImage, { marginBottom: (message.text || message.body) ? 8 : 0 }]} 
                />
              </TouchableOpacity>
            )}

            {(message.text || message.body) ? (
                <Text style={[localStyles.messageText, isMine && { color: '#fff' }]}>
                  {message.text || message.body}
                </Text>
            ) : null}
          </>
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
  const {
    currentChatId, chatHistory, user, groups, chatMetadata, token,
    sendChatMessage, closeChat, getOtherUserIdInDM,
    setProfilePeekUser, editChatMessage, deleteChatMessage,
    fetchConversations, resolveUser, userCache,
    startCall, setVideoModalOpen, setVoiceModalOpen,
  } = useAppStore(state => ({
    currentChatId:      state.currentChatId,
    chatHistory:        state.chatHistory,
    user:               state.user,
    token:              state.token,
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
  const [replyingTo,     setReplyingTo]     = useState(null); 
  const [attachmentUri,  setAttachmentUri]  = useState(null); 
  const [isCalling,      setIsCalling]      = useState(false);
  const [viewingImage,   setViewingImage]   = useState(null); // ⭐️ סטייט לתמונה במסך מלא
  const [isSavingImage,  setIsSavingImage]  = useState(false);
  
  const [isLoadingMore,  setIsLoadingMore]  = useState(false);
  const isPaginatingRef                     = useRef(false);

  const flatListRef = useRef(null);

  const safeChatId  = useMemo(() => String(currentChatId || ''), [currentChatId]);
  const metadata    = chatMetadata?.[safeChatId];
  const isDMChat    = !!metadata?.isDM;
  const messages    = useMemo(() => chatHistory[safeChatId] || [], [chatHistory, safeChatId]);

  const otherUserId = useMemo(
    () => (getOtherUserIdInDM ? getOtherUserIdInDM(currentChatId) : null),
    [currentChatId, getOtherUserIdInDM],
  );

  useEffect(() => {
    if (fetchConversations && !metadata) {
      fetchConversations();
    }
  }, []);

  useEffect(() => {
    if (!currentChatId) return;
    const chatIdStr = String(currentChatId);
    chatService.joinChat(chatIdStr);
    chatService.loadHistory(chatIdStr);
    chatService.markChatAsRead(chatIdStr);
  }, [currentChatId]);

  const closeChatRef = useRef(closeChat);
  const currentChatIdRef = useRef(currentChatId);
  useEffect(() => { closeChatRef.current = closeChat; }, [closeChat]);
  useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);

  useEffect(() => {
    return () => {
      if (currentChatIdRef.current) closeChatRef.current?.();
    };
  }, []); 

  useEffect(() => {
    if (!currentChatId) navigation.goBack();
  }, [currentChatId, navigation]);

  useEffect(() => {
    if (!currentChatId) return;
    let cancelled = false;

    const resolve = async () => {
      if (safeChatId.startsWith('post:')) {
        if (!cancelled) setChatTitle('Post Comments');
        return;
      }

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
            const other = messages.find(m => String(m.sender?.id) !== String(user?.id));
            if (!cancelled) setChatTitle(other?.sender?.name || other?.sender?.username || 'Private Chat');
          }
          return;
        }
      }

      const group = groups?.find(g => String(g.id) === safeChatId);
      if (group) {
        if (!cancelled) setChatTitle(group.name);
        return;
      }

      const other = messages.find(m => String(m.sender?.id) !== String(user?.id));
      if (other?.sender) {
        if (!cancelled) setChatTitle(other.sender.name || other.sender.username || 'Chat');
        return;
      }

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

    const t = setTimeout(() => {
        if (!isPaginatingRef.current) flatListRef.current?.scrollToEnd({ animated: true });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [currentChatId, safeChatId, metadata, otherUserId, groups, messages, user?.id, userCache, resolveUser]);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || messages.length < 50) return; 
    const oldestMsg = messages[0]; 
    
    if (oldestMsg && oldestMsg.id) {
        isPaginatingRef.current = true; 
        setIsLoadingMore(true);
        chatService.loadHistory(safeChatId, oldestMsg.id); 
        
        setTimeout(() => { setIsLoadingMore(false); }, 1500);
    }
  }, [isLoadingMore, messages, safeChatId]);

  const handleScroll = useCallback((event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY < 50 && !isLoadingMore) {
        handleLoadMore();
    }
  }, [handleLoadMore, isLoadingMore]);

  const handlePickAttachment = useCallback(async () => {
    try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'We need camera roll permissions to attach files.');
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
        console.warn('[Chat] Attachment error:', error);
        Alert.alert('Error', 'Could not pick the file.');
    }
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = messageText.trim();
    if (!trimmed && !attachmentUri) return;

    if (editingMessage) {
      trackEvent('chat_message_edited', { isDM: isDMChat });
      editChatMessage?.(editingMessage.id, trimmed);
      setEditingMessage(null);
    } else {
      trackEvent('chat_message_sent', { isDMChat, hasReply: !!replyingTo, hasAttachment: !!attachmentUri });
      isPaginatingRef.current = false; 
      
      sendChatMessage?.(trimmed, { 
          replyToId: replyingTo?.id,
          attachmentUri: attachmentUri 
      });
      
      setReplyingTo(null);
      setAttachmentUri(null); 
    }
    setMessageText('');
  }, [messageText, attachmentUri, editingMessage, replyingTo, sendChatMessage, editChatMessage, isDMChat]);

  const cancelEdit = useCallback(() => {
    setEditingMessage(null);
    setMessageText('');
  }, []);

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
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
          // אם זה URL מהשרת, חייבים להוריד אותו לזיכרון המקומי קודם
          if (url.startsWith('http')) {
              const filename = url.split('/').pop().split('?')[0] || `kliq_img_${Date.now()}.jpg`;
              const localPath = `${FileSystem.documentDirectory}${filename}`;
              const downloaded = await FileSystem.downloadAsync(url, localPath);
              fileUri = downloaded.uri;
          }

          await MediaLibrary.saveToLibraryAsync(fileUri);
          Alert.alert('Success ✅', 'Image saved to your gallery!');
      } catch (err) {
          console.warn('[ChatScreen] Save image error:', err);
          Alert.alert('Error', 'Could not save the image. Try again.');
      } finally {
          setIsSavingImage(false);
      }
  }, []);

  const handleLongPressMessage = useCallback((message, isMine) => {
    if (!message?.id) return;
    const buttons = [];

    buttons.push({
      text: '↩ Reply',
      onPress: () => setReplyingTo(message),
    });

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
      if (message.sender?.id) {
        buttons.push({
          text: '🚩 Report User',
          onPress: () => {
            Alert.alert(
              'Report User',
              'Why are you reporting this person?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Spam or scam',           onPress: async () => { const ok = await _submitSecurityReport(message.sender.id, 'spam', token); Alert.alert(ok ? '✅ Reported' : 'Error', ok ? 'Thank you. Our team will review this.' : 'Could not submit. Try again.'); } },
                { text: 'Harassment or threats',  onPress: async () => { const ok = await _submitSecurityReport(message.sender.id, 'harassment', token); Alert.alert(ok ? '✅ Reported' : 'Error', ok ? 'Thank you. Our team will review this.' : 'Could not submit. Try again.'); } },
                { text: 'Inappropriate content',  onPress: async () => { const ok = await _submitSecurityReport(message.sender.id, 'inappropriate_content', token); Alert.alert(ok ? '✅ Reported' : 'Error', ok ? 'Thank you. Our team will review this.' : 'Could not submit. Try again.'); } },
              ],
            );
          },
        });
      }
    }

    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Message Options', '', buttons);
  }, [deleteChatMessage, token]);

  const resolveCallTarget = useCallback(async () => {
    let id = otherUserId || metadata?.otherUserId;
    if (!id && resolveUser && safeChatId) {
      try {
        const resolved = await resolveUser(safeChatId);
        id = resolved?.id;
      } catch { /* ignore */ }
    }
    return id ? String(id) : null;
  }, [otherUserId, metadata, resolveUser, safeChatId]);

  const handleStartVoiceCall = useCallback(async () => {
    setIsCalling(true);
    try {
      const otherId = await resolveCallTarget();
      if (!otherId) {
        Alert.alert('Cannot Call', 'Could not identify the other user.');
        return;
      }
      await startCall?.(otherId, false);
      setVoiceModalOpen?.(true);
    } catch (e) {
      Alert.alert('Call Error', e.message);
    } finally {
      setIsCalling(false);
    }
  }, [resolveCallTarget, startCall, setVoiceModalOpen]);

  const handleStartVideoCall = useCallback(async () => {
    setIsCalling(true);
    try {
      const otherId = await resolveCallTarget();
      if (!otherId) {
        Alert.alert('Cannot Call', 'Could not identify the other user.');
        return;
      }
      await startCall?.(otherId, true);
      setVideoModalOpen?.(true);
    } catch (e) {
      Alert.alert('Call Error', e.message);
    } finally {
      setIsCalling(false);
    }
  }, [resolveCallTarget, startCall, setVideoModalOpen]);

  const renderItem = useCallback(({ item }) => (
    <MessageBubble
      message={item}
      currentUserId={user?.id}
      onUserPress={setProfilePeekUser}
      onLongPress={handleLongPressMessage}
      onImagePress={setViewingImage} // 👈 חיבור לתצוגה המלאה
    />
  ), [user?.id, setProfilePeekUser, handleLongPressMessage]);

  const canSend = messageText.trim().length > 0 || attachmentUri;

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
          onContentSizeChange={() => {
              if (!isPaginatingRef.current) {
                  flatListRef.current?.scrollToEnd({ animated: true });
              } else {
                  isPaginatingRef.current = false;
              }
          }}
          onLayout={() => {
              if (!isPaginatingRef.current) flatListRef.current?.scrollToEnd({ animated: false });
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={isLoadingMore ? <ActivityIndicator size="small" color={brand.blue} style={{ marginVertical: 10 }} /> : null}
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

        {replyingTo && (
          <View style={[localStyles.editBanner, localStyles.replyBanner]}>
            <Ionicons name="return-up-back" size={16} color={brand.green} />
            <Text style={[localStyles.editBannerText, { color: brand.green }]} numberOfLines={1}>
              ↩ {replyingTo.sender?.name || replyingTo.sender?.username || 'Message'}: {replyingTo.text || replyingTo.body || '…'}
            </Text>
            <TouchableOpacity onPress={cancelReply} style={localStyles.editCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={20} color={brand.red} />
            </TouchableOpacity>
          </View>
        )}

        {attachmentUri && (
          <View style={localStyles.attachmentPreviewBanner}>
             <Image source={{ uri: attachmentUri }} style={localStyles.previewImage} />
             <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: brand.ink }}>Attached Media</Text>
             </View>
             <TouchableOpacity onPress={() => setAttachmentUri(null)} style={localStyles.removePreviewBtn}>
                <Ionicons name="close-circle" size={24} color={brand.red} />
             </TouchableOpacity>
          </View>
        )}

        <View style={localStyles.inputArea}>
          <TouchableOpacity onPress={handlePickAttachment} style={localStyles.attachBtn}>
             <Ionicons name="attach" size={28} color={brand.soft} />
          </TouchableOpacity>

          <TextInput
            style={localStyles.input}
            placeholder={editingMessage ? 'Edit message...' : replyingTo ? 'Write a reply...' : 'Type a message...'}
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
            disabled={!canSend}
            style={[localStyles.sendButton, !canSend && localStyles.sendButtonDisabled]}
            activeOpacity={0.75}
          >
            <Ionicons name={editingMessage ? 'checkmark' : 'send'} size={20} color="#fff" />
          </TouchableOpacity>
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
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const localStyles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: brand.bg },
  flexOne:      { flex: 1 },
  listContent:  { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 24 },

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
  bubbleImage:   { width: 220, height: 220, borderRadius: 12, resizeMode: 'cover', backgroundColor: 'rgba(0,0,0,0.05)' },
  deletedText:   { fontStyle: 'italic', color: '#999', fontSize: 14 },
  senderName:    { fontSize: 12, fontWeight: '700', marginBottom: 3, color: brand.soft },
  messageText:   { fontSize: 15.5, lineHeight: 22, color: brand.ink },
  metaRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  timeText:      { fontSize: 10, color: brand.soft },

  editBanner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#E8F4FD',
    borderTopWidth: 1, borderTopColor: '#C5E0F5',
  },
  editBannerText: { flex: 1, marginLeft: 8, color: brand.blue, fontSize: 13, fontStyle: 'italic' },
  editCancel:     { padding: 4 },

  replyBanner: { backgroundColor: '#E8F5E9', borderTopColor: '#A5D6A7' },

  replyQuote: {
    borderLeftWidth: 3, paddingLeft: 8, paddingVertical: 4,
    borderRadius: 4, marginBottom: 6,
  },
  replyQuoteMine:   { borderLeftColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(0,0,0,0.12)' },
  replyQuoteTheirs: { borderLeftColor: brand.blue,              backgroundColor: '#F0F4FF' },
  replyQuoteAuthor: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  replyQuoteText:   { fontSize: 13, lineHeight: 18 },

  attachmentPreviewBanner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E0E0E0',
  },
  previewImage:     { width: 44, height: 44, borderRadius: 8, marginRight: 10 },
  removePreviewBtn: { padding: 5 },

  inputArea: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  attachBtn: { padding: 6, marginRight: 2 },
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

  // ⭐️ Full Screen Viewer Styles ⭐️
  fullScreenViewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerHeader: {
    position: 'absolute',
    top: 0, width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 20 : 40,
    zIndex: 10,
  },
  viewerIconBtn: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 30,
  },
  fullScreenImage: {
    width: '100%', height: '80%',
    resizeMode: 'contain',
  },
});