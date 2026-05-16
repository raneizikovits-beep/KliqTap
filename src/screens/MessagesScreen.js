// client/src/screens/MessagesScreen.js
// ⭐️ V10.1 ULTIMATE: Clean Layout + DM Name Resolution Fix ⭐️

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { MessageListItem } from '../components/ListItems';
import * as Data from '../constants/data';
import { styles as globalStyles } from '../constants/styles';
import { useAppStore } from '../store/useAppStore';

// --- פונקציות עזר ---

/**
 * פורמט זמן חכם להודעות
 */
const formatTime = (isoString) => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1)    return 'Just now';
    if (diffMins < 60)   return `${diffMins}m`;
    if (diffDays === 0)  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1)  return 'Yesterday';
    if (diffDays < 7)    return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

// --- הרכיב הראשי ---

export default function MessagesScreen({ messageTab, setMessageTab, setVideoModalOpen, openChat }) {
  const {
    user, refreshAllData, chatHistory, deleteChatConversation, groups,
    userCache = {}, resolveUser, getOtherUserIdInDM, chatMetadata,
    userSettings, startCall
  } = useAppStore();

  const isDark = userSettings?.darkMode === true;
  const displayName = user?.fullName || user?.name || user?.username || 'User';
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAllData?.();
    setTimeout(() => setRefreshing(false), 1000);
  }, [refreshAllData]);

  // רזולוציית משתמשים להיסטוריית הצ'אט
  useEffect(() => {
    if (!chatHistory) return;
    Object.keys(chatHistory).forEach(chatId => {
      const otherId = getOtherUserIdInDM?.(chatId);
      if (otherId && resolveUser && !userCache[otherId]) resolveUser(otherId);
    });
  }, [chatHistory, userCache, resolveUser, getOtherUserIdInDM]);

  const myId = useMemo(() => user?.id ? String(user.id) : null, [user?.id]);

  /**
   * טיפול בלחיצה על שיחה קולית/וידאו
   */
  const handleCallPress = useCallback(async (targetId, isVideo = false) => {
    if (!targetId) return;
    try {
        if (startCall) {
            await startCall(targetId, isVideo);
        } else {
            Alert.alert("Call Offline", "Call service is currently not connected.");
        }
    } catch (error) {
        console.error("[Messages] Call Error:", error);
        Alert.alert("Call Failed", "Could not establish a connection right now.");
    }
  }, [startCall]);

  /**
   * בניית רשימת השיחות מההיסטוריה והמטא-דאטה (כולל תיקון באג השמות dm_)
   */
  const conversationList = useMemo(() => {
    if (!chatHistory) return [];

    return Object.keys(chatHistory).map(chatId => {
      const messages = chatHistory[chatId];
      if (!messages || messages.length === 0) return null;

      const lastMsg = messages[messages.length - 1];
      const safeChatId = String(chatId);
      const metadata = chatMetadata?.[safeChatId];

      let displayTitle = null;
      let displayAvatar = lastMsg.sender?.avatar || lastMsg.sender?.avatarUrl || null;
      let isGroup;
      let targetUserId = null; 

      // 🌟 KLIQMIND FIX: זיהוי מדויק של DM מול קבוצה
      if (metadata && typeof metadata.isDM === 'boolean') {
        isGroup = !metadata.isDM;
      } else if (safeChatId.startsWith('dm_')) {
        isGroup = false; // אם מתחיל ב-dm_, זה בוודאות לא קבוצה
      } else {
        isGroup = !(safeChatId.length === 36 && safeChatId.split('-').length === 5);
      }

      if (safeChatId.startsWith('post:')) {
        displayTitle = 'Post Comments';
        isGroup = false;
      } else if (!isGroup) {
        
        // מנסים לחלץ את המשתמש השני
        let otherId = metadata?.otherUserId || getOtherUserIdInDM?.(chatId);
        
        // אם לא מצאנו, ננסה לחלץ מתוך המחרוזת של ה-dm_
        if (!otherId && safeChatId.startsWith('dm_')) {
            const parts = safeChatId.split('_');
            if (parts.length >= 3) {
                // המזהה של הצד השני הוא זה שאינו ה-ID שלי
                otherId = parts[1] === myId ? parts[2] : parts[1];
            }
        }

        targetUserId = otherId;

        if (otherId && userCache[otherId]) {
            displayTitle = userCache[otherId].name || userCache[otherId].username || null;
            displayAvatar = userCache[otherId].avatarUrl || null;
        }

        // מונע מסטרינגים מכוערים של dm_ להופיע כשם
        if (!displayTitle && metadata?.name && !metadata.name.startsWith('dm_')) {
            displayTitle = metadata.name;
        }

        if (!displayTitle) {
          const otherUserMsg = messages.find(m => myId && String(m.sender?.id) !== myId);
          if (otherUserMsg?.sender) {
            displayTitle = otherUserMsg.sender.name || otherUserMsg.sender.username || null;
            displayAvatar = otherUserMsg.sender.avatar || otherUserMsg.sender.avatarUrl || displayAvatar;
            targetUserId = otherUserMsg.sender.id;
          }
        }
        if (!displayTitle) displayTitle = 'Private Chat';

      } else {
        // לוגיקה של קבוצות
        const group = groups?.find(g => String(g.id) === safeChatId && g.category !== 'DM');
        if (group) {
          displayTitle = group.name;
          displayAvatar = group.imageUrl || group.image || displayAvatar;
        } else {
          displayTitle = metadata?.name && !metadata.name.startsWith('dm_') ? metadata.name : 'Group Chat';
        }
      }

      const unreadCount = metadata?.unreadCount || 0;

      return {
        id: String(lastMsg.id || Date.now()),
        chatId: safeChatId,
        targetUserId: targetUserId, 
        isGroup: isGroup,           
        sender: displayTitle,
        text: lastMsg.body || lastMsg.text,
        body: lastMsg.body || lastMsg.text,
        time: formatTime(lastMsg.time || lastMsg.createdAt),
        rawTime: lastMsg.time || lastMsg.createdAt, 
        type: lastMsg.type || 'text',
        unread: unreadCount,        
        hasUnread: unreadCount > 0, 
        avatar: displayAvatar,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.rawTime || 0) - new Date(a.rawTime || 0));
  }, [chatHistory, userCache, groups, getOtherUserIdInDM, chatMetadata, myId]);

  /**
   * סינון הרשימה לפי טאבים וחיפוש
   */
  const filteredMessages = useMemo(() => {
    let items = conversationList;
    if (messageTab === 'messages') items = items.filter(i => !i.type || i.type === 'text' || i.type === 'voice');
    else if (messageTab === 'calls') items = items.filter(i => i.type?.includes('call'));
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      items = items.filter(i => i.sender?.toLowerCase().includes(lower) || i.body?.toLowerCase().includes(lower));
    }
    return items;
  }, [conversationList, messageTab, searchText]);

  const handleItemPress = useCallback((item) => {
    if (item.type?.startsWith('call')) setVideoModalOpen(true);
    else openChat(item.chatId);
  }, [setVideoModalOpen, openChat]);

  const handleItemLongPress = useCallback((item) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete the chat with ${item.sender}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteChatConversation?.(item.chatId) },
      ]
    );
  }, [deleteChatConversation]);

  const TABS = [{ key: 'all', label: 'All' }, { key: 'messages', label: 'Messages' }, { key: 'calls', label: 'Calls' }];

  return (
    <View style={[localStyles.container, { backgroundColor: isDark ? '#000' : '#f8f9fa' }]}>
      {/* Header Area */}
      <View style={[localStyles.headerArea, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
        <View style={localStyles.headerTopRow}>
          <View>
            <Text style={[localStyles.headerWelcomeText, { color: isDark ? '#fff' : Data.brand.ink }]}>Hey, {displayName}</Text>
            <Text style={[localStyles.headerSubtitle, { color: isDark ? '#aaa' : Data.brand.soft }]}>Stay connected with your Kliq.</Text>
          </View>
          <TouchableOpacity style={[localStyles.newMessageButton, { backgroundColor: isDark ? '#333' : Data.brand.bg }]}>
            <Ionicons name="create-outline" size={24} color={Data.brand.blue} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[localStyles.searchInputContainer, { backgroundColor: isDark ? '#333' : '#f0f2f5' }]}>
          <Ionicons name="search" size={20} color={isDark ? '#ccc' : '#8E8E93'} />
          <TextInput
            style={[localStyles.searchInput, { color: isDark ? '#fff' : Data.brand.ink }]}
            placeholder="Search messages..."
            placeholderTextColor={isDark ? '#888' : '#8E8E93'}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={18} color={isDark ? '#aaa' : '#8E8E93'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={[globalStyles.tabSwitcherContainer, { marginTop: 12 }]}>
        {TABS.map(tabItem => (
          <TouchableOpacity
            key={tabItem.key}
            style={[
              globalStyles.tabSwitcherButton,
              messageTab === tabItem.key && globalStyles.tabSwitcherButtonActive,
              messageTab === tabItem.key && isDark && { backgroundColor: '#333' },
            ]}
            onPress={() => setMessageTab(tabItem.key)}
          >
            <Text style={[
              globalStyles.tabSwitcherText,
              { color: isDark ? '#aaa' : '#666' },
              messageTab === tabItem.key && { color: Data.brand.blue },
            ]}>
              {tabItem.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Chat List */}
      <FlatList
        data={filteredMessages}
        keyExtractor={(item, index) => item?.chatId ? String(item.chatId) : `chat-${index}`}
        renderItem={({ item }) => (
          <View style={[
              localStyles.rowContainer, 
              { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderBottomColor: isDark ? '#333' : '#f0f0f0' }
          ]}>
             <View style={{ flex: 1 }}>
                <MessageListItem
                  item={item}
                  onPress={() => handleItemPress(item)}
                  onLongPress={() => handleItemLongPress(item)}
                  isDark={isDark}
                  hasUnread={item.hasUnread}
                  unreadCount={item.unread}
                  avatar={item.avatar} 
                />
             </View>

             {!item.isGroup && item.targetUserId && (
               <View style={localStyles.quickActions}>
                  <TouchableOpacity style={localStyles.quickBtn} onPress={() => handleCallPress(item.targetUserId, false)}>
                      <Ionicons name="call" size={20} color={Data.brand.blue} />
                  </TouchableOpacity>
                  <TouchableOpacity style={localStyles.quickBtn} onPress={() => handleCallPress(item.targetUserId, true)}>
                      <Ionicons name="videocam" size={22} color={Data.brand.blue} />
                  </TouchableOpacity>
               </View>
             )}
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={localStyles.emptyState}>
            <Text style={localStyles.emptyStateIcon}>📭</Text>
            <Text style={[globalStyles.p, localStyles.textCenter, { color: isDark ? '#aaa' : '#333' }]}>
              {searchText
                ? `No results for "${searchText}"`
                : `No ${messageTab === 'calls' ? 'calls' : 'messages'} yet.`}
            </Text>
          </View>
        )}
        contentContainerStyle={localStyles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Data.brand.blue} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 120 },
  headerArea: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerWelcomeText: { fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 13 },
  newMessageButton: { padding: 8, borderRadius: 20 },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyStateIcon: { fontSize: 40, marginBottom: 10 },
  textCenter: { textAlign: 'center' },
  rowContainer: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      borderBottomWidth: 1,
  },
  quickActions: { 
      flexDirection: 'row', 
      gap: 12, 
      paddingRight: 16,
      paddingLeft: 4,
  },
  quickBtn: { 
      width: 42, 
      height: 42, 
      borderRadius: 21, 
      backgroundColor: 'rgba(0, 122, 255, 0.1)',
      alignItems: 'center', 
      justifyContent: 'center',
  },
});