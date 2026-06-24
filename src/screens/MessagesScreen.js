// client/src/screens/MessagesScreen.js
// ⭐️ V11.0 PRODUCTION — Premium Organized Layout (Direct, Groups, Calls) ⭐️

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory, getOtherUserIdInDM]);

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
   * בניית 2 רשימות נפרדות לחלוטין במקביל:
   * 1. conversationList: רשימת השיחות הכללית (לפי הודעה אחרונה מכל שיחה)
   * 2. callList: היסטוריית שיחות מלאה ששולפת כל שיחה קולית/וידאו ממעמקי ההיסטוריה
   */
  const { conversationList, callList } = useMemo(() => {
    if (!chatHistory) return { conversationList: [], callList: [] };

    const convos = [];
    const calls = [];

    Object.keys(chatHistory).forEach(chatId => {
      const messages = chatHistory[chatId];
      if (!messages || messages.length === 0) return;

      const safeChatId = String(chatId);
      const metadata = chatMetadata?.[safeChatId];

      let displayTitle = null;
      let displayAvatar = null;
      let isGroup;
      let targetUserId = null; 

      // זיהוי מדויק של DM מול קבוצה
      if (metadata && typeof metadata.isDM === 'boolean') {
        isGroup = !metadata.isDM;
      } else if (safeChatId.startsWith('dm_')) {
        isGroup = false; 
      } else {
        isGroup = !(safeChatId.length === 36 && safeChatId.split('-').length === 5);
      }

      if (safeChatId.startsWith('post:')) {
        displayTitle = 'Post Comments';
        isGroup = false;
      } else if (!isGroup) {
        // חילוץ המשתמש השני בשיחה פרטית
        let otherId = metadata?.otherUserId || getOtherUserIdInDM?.(chatId);
        
        if (!otherId && safeChatId.startsWith('dm_')) {
            const parts = safeChatId.split('_');
            if (parts.length >= 3) {
                otherId = parts[1] === myId ? parts[2] : parts[1];
            }
        }

        targetUserId = otherId;

        if (otherId && userCache[otherId]) {
            displayTitle = userCache[otherId].name || userCache[otherId].username || null;
            displayAvatar = userCache[otherId].avatarUrl || null;
        }

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
      const lastMsg = messages[messages.length - 1];

      // 1. דחיפה לרשימת השיחות הכללית
      convos.push({
        id: String(lastMsg.id || Date.now()),
        chatId: safeChatId,
        targetUserId: targetUserId, 
        isGroup: isGroup,           
        sender: displayTitle,
        text: lastMsg.body || lastMsg.text || '',
        body: lastMsg.body || lastMsg.text || '',
        time: formatTime(lastMsg.time || lastMsg.createdAt),
        rawTime: lastMsg.time || lastMsg.createdAt || new Date().toISOString(), 
        type: lastMsg.type || 'text',
        unread: unreadCount,        
        hasUnread: unreadCount > 0, 
        avatar: displayAvatar || lastMsg.sender?.avatar || lastMsg.sender?.avatarUrl,
      });

      // 2. דחיפה לרשימת שיחות הטלפון והוידאו (סריקה של כל הודעות השיחה מהעבר)
      messages.forEach(msg => {
        const t = msg.type?.toLowerCase() || '';
        if (t.includes('call') || t === 'voice' || t === 'video') {
            const isVideo = t.includes('video') || (msg.body || msg.text || '').toLowerCase().includes('video');
            calls.push({
                id: String(msg.id || Date.now() + Math.random()),
                chatId: safeChatId,
                targetUserId: targetUserId,
                isGroup: isGroup,
                sender: displayTitle,
                text: msg.body || msg.text || (isVideo ? 'Video Call' : 'Voice Call'),
                body: msg.body || msg.text || (isVideo ? 'Video Call' : 'Voice Call'),
                time: formatTime(msg.time || msg.createdAt),
                rawTime: msg.time || msg.createdAt || new Date().toISOString(),
                type: isVideo ? 'video_call' : 'voice_call',
                unread: 0, 
                hasUnread: false,
                avatar: displayAvatar || msg.sender?.avatar || msg.sender?.avatarUrl,
            });
        }
      });
    });

    return {
        conversationList: convos.sort((a, b) => new Date(b.rawTime) - new Date(a.rawTime)),
        callList: calls.sort((a, b) => new Date(b.rawTime) - new Date(a.rawTime))
    };
  }, [chatHistory, userCache, groups, getOtherUserIdInDM, chatMetadata, myId]);

  /**
   * ⭐️ סינון חדש ומאורגן לחלוטין לפי 3 קטגוריות ברורות ⭐️
   */
  const filteredMessages = useMemo(() => {
    let items = [];
    
    if (messageTab === 'calls') {
        // טאב שיחות: מציג את היסטוריית שיחות הוידאו והקול
        items = callList;
    } else if (messageTab === 'messages') {
        // טאב קבוצות: מציג אך ורק שיחות קבוצתיות
        items = conversationList.filter(i => i.isGroup);
    } else {
        // טאב Direct: מציג אך ורק שיחות פרטיות בין משתמשים (ללא קבוצות)
        items = conversationList.filter(i => !i.isGroup);
    }

    // סינון חיפוש
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      items = items.filter(i => i.sender?.toLowerCase().includes(lower) || i.body?.toLowerCase().includes(lower));
    }
    
    return items;
  }, [conversationList, callList, messageTab, searchText]);

  const handleItemPress = useCallback((item) => {
    // אם המשתמש נמצא בלשונית שיחות, לחיצה תחייג אליו מיד חזרה
    if (messageTab === 'calls' && item.targetUserId) {
        const isVideo = item.type === 'video_call';
        handleCallPress(item.targetUserId, isVideo);
    } else {
        // בכל לשונית אחרת, הלחיצה תפתח את הצאט הרגיל
        openChat(item.chatId);
    }
  }, [openChat, handleCallPress, messageTab]);

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

  // הגדרת כותרות הלשוניות החדשות והמסודרות של האפליקציה
  const TABS = [
    { key: 'all', label: 'Direct' },
    { key: 'messages', label: 'Groups' },
    { key: 'calls', label: 'Calls' }
  ];

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

      {/* Main Chat / Call List */}
      <FlatList
        data={filteredMessages}
        keyExtractor={(item, index) => item?.id ? String(item.id) : `chat-${index}`}
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

             {/* כפתורי חיוג מהיר מופיעים רק בלשוניות הטקסט הרגילות */}
             {!item.isGroup && item.targetUserId && messageTab !== 'calls' && (
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
            <Text style={localStyles.emptyStateIcon}>
              {messageTab === 'calls' ? '📞' : messageTab === 'messages' ? '👥' : '📭'}
            </Text>
            <Text style={[globalStyles.p, localStyles.textCenter, { color: isDark ? '#aaa' : '#333' }]}>
              {searchText
                ? `No results for "${searchText}"`
                : `No ${messageTab === 'calls' ? 'call history' : messageTab === 'messages' ? 'groups' : 'direct messages'} yet.`}
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
      width: 42, height: 42, borderRadius: 21, 
      backgroundColor: 'rgba(0, 122, 255, 0.1)',
      alignItems: 'center', justifyContent: 'center',
  },
});