// client/src/screens/AlertsScreen.js
// ⭐️ KLIQTAP V9.1 — Mark-as-read only, no broken navigation ⭐️
//
// Why this version exists:
//   V9.0 used navigate('ChatDetail', ...) from RootNavigation.js to deep-link
//   on tap. BUT RootNavigation.js explicitly states:
//     "Currently KliqTap uses a prop-based navigation system... React
//      Navigation is NOT wired up yet. Calls to navigateGlobal() will safely
//      no-op until NavigationContainer is added."
//   → That's why you saw:
//     "ERROR The action 'NAVIGATE' with payload {...} was not handled by any navigator"
//
//   This version reverts to the original ask: just mark as read, no navigation.
//   The unread highlight (unreadBg) disappears the instant you tap.
//   No empty bottom sheet, no broken nav, no warnings.
//
// When NavigationContainer is wired up later, we can re-enable smart deep-linking
// from inside handleItemPress (the code is preserved in the commented block).

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, StyleSheet, LayoutAnimation, Platform, UIManager, SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/react/shallow';

import * as Data from '../constants/data';
import { styles } from '../constants/styles';
import { useAppStore } from '../store/useAppStore';
import { fetchAPI } from '../store/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TABS = [
  { id: 'all',      label: 'All' },
  { id: 'invites',  label: 'Invites' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'messages', label: 'Messages' },
  { id: 'kliqmind', label: 'KliqMind' },
  { id: 'system',   label: 'System' },
];

// ─── Pure helpers ─────────────────────────────────────────────────────────

function matchesTab(notification, tab) {
  const type = notification.type || '';
  const lowerText = (notification.text || '').toLowerCase();

  switch (tab) {
    case 'all':
      return true;
    case 'invites':
      return type === 'INVITE' || type === 'FOLLOW' || type === 'GROUP_REQUEST' || lowerText.includes('invite');
    case 'mentions':
      return type === 'MENTION' || type === 'COMMENT' || lowerText.includes('@');
    case 'messages':
      return type === 'MESSAGE';
    case 'kliqmind':
      return type === 'AI_INSIGHT' || lowerText.includes('kliqmind') || lowerText.includes('ai');
    case 'system':
      return type === 'SYSTEM_ALERT' || type === 'SECURITY' || type === 'PRIVACY';
    default:
      return true;
  }
}

function resolveNotificationVisuals(item, isDark) {
  const type = item.type || '';
  const lowerText = (item.text || '').toLowerCase();

  if (type === 'SYSTEM_ALERT' || type === 'SECURITY' || type === 'PRIVACY' || lowerText.includes('security') || lowerText.includes('login')) {
    return { iconName: 'shield-checkmark', iconColor: '#FF9800', bgIcon: isDark ? '#402B15' : '#FFF3E0', isInvite: false };
  }
  if (type === 'AI_INSIGHT' || lowerText.includes('kliqmind') || lowerText.includes('ai')) {
    return { iconName: 'sparkles', iconColor: '#9C27B0', bgIcon: isDark ? '#311B3D' : '#F3E5F5', isInvite: false };
  }
  if (type === 'NEW_POST') {
    return { iconName: 'images', iconColor: '#4CAF50', bgIcon: isDark ? '#1B3320' : '#E8F5E9', isInvite: false };
  }
  if (type === 'MESSAGE') {
    return { iconName: 'chatbox-ellipses', iconColor: '#4A90E2', bgIcon: isDark ? '#16243A' : '#E3F2FD', isInvite: false };
  }
  if (type === 'INVITE' || type === 'FOLLOW' || type === 'GROUP_REQUEST' || lowerText.includes('invite') || lowerText.includes('join')) {
    return { iconName: 'people', iconColor: '#E91E63', bgIcon: isDark ? '#421424' : '#FCE4EC', isInvite: type === 'INVITE' || type === 'GROUP_REQUEST' || lowerText.includes('invite') };
  }
  if (type === 'COMMENT' || type === 'MENTION' || lowerText.includes('comment') || lowerText.includes('@')) {
    return { iconName: 'chatbubble', iconColor: '#009688', bgIcon: isDark ? '#14302E' : '#E0F2F1', isInvite: false };
  }
  if (type === 'LIKE' || lowerText.includes('like') || lowerText.includes('love')) {
    return { iconName: 'heart', iconColor: '#E91E63', bgIcon: isDark ? '#421424' : '#FCE4EC', isInvite: false };
  }
  return { iconName: 'notifications', iconColor: Data.brand.blue, bgIcon: isDark ? '#1A2634' : '#E3F2FD', isInvite: false };
}

// ─── Alert row ────────────────────────────────────────────────────────────
const AlertItem = React.memo(({ item, onPress, onAction, isDark }) => {
  const { iconName, iconColor, bgIcon, isInvite } = resolveNotificationVisuals(item, isDark);

  const cardBg = isDark ? '#1C1C1E' : '#fff';
  const unreadBg = isDark ? '#102A43' : '#F8FDFF';
  const textColor = isDark ? '#ddd' : '#333';
  const unreadTextColor = isDark ? '#fff' : '#000';
  const timeColor = isDark ? '#888' : '#999';

  const actorName = item.actor?.name || item.actor?.username;
  let displayText = item.text;

  if (actorName && item.type !== 'SYSTEM_ALERT') {
    if (item.type === 'MESSAGE') {
      displayText = `${actorName}: ${item.text}`;
    } else {
      displayText = `${actorName} ${item.text}`;
    }
  }

  return (
    <TouchableOpacity
      style={[localStyles.card, { backgroundColor: cardBg }, !item.isRead && [localStyles.unreadCard, { backgroundColor: unreadBg }]]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={localStyles.cardHeader}>
        <View style={[localStyles.iconContainer, { backgroundColor: bgIcon }]}>
          <Ionicons name={iconName} size={20} color={iconColor} />
          {!item.isRead && <View style={localStyles.redDot} />}
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[localStyles.cardText, { color: textColor }, !item.isRead && { fontWeight: '700', color: unreadTextColor }]}>
            {displayText}
          </Text>
          <Text style={[localStyles.timeText, { color: timeColor }]}>{item.time}</Text>
        </View>
      </View>

      {isInvite && (
        <View style={localStyles.actionRow}>
          <TouchableOpacity
            style={[localStyles.actionBtn, { backgroundColor: Data.brand.blue }]}
            onPress={() => onAction('accept', item)}
          >
            <Text style={localStyles.actionBtnText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[localStyles.actionBtn, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
            onPress={() => onAction('decline', item)}
          >
            <Text style={[localStyles.actionBtnText, { color: isDark ? '#ccc' : '#555' }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────
export default function AlertsScreen({ setSecondSheet, setThirdSheet }) {
  const {
    notifications,
    isNotificationsLoading,
    fetchNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    userSettings,
    socket,
  } = useAppStore(useShallow(state => ({
    notifications: state.notifications,
    isNotificationsLoading: state.isNotificationsLoading,
    fetchNotifications: state.fetchNotifications,
    markNotificationRead: state.markNotificationRead,
    markAllNotificationsRead: state.markAllNotificationsRead,
    userSettings: state.userSettings,
    socket: state.socket,
  })));

  const isDark = userSettings?.darkMode === true;
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const lastFetchRef = useRef(0);

  useEffect(() => {
    if (fetchNotifications) fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!socket || !socket.on) return;
    const handler = () => {
      const now = Date.now();
      if (now - lastFetchRef.current < 1000) return;
      lastFetchRef.current = now;
      if (fetchNotifications) fetchNotifications();
    };
    socket.on('notification:new', handler);
    return () => {
      if (socket.off) socket.off('notification:new', handler);
    };
  }, [socket, fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (fetchNotifications) await fetchNotifications();
    } finally {
      setRefreshing(false);
    }
  }, [fetchNotifications]);

  // ⭐️ FIX [DEMO→REAL]:
  //   - 'accept' used to show a "Joined!" toast with NO API call at all —
  //     the user was never actually added to anything. Now calls the real
  //     POST /communities/join for GROUP_REQUEST notifications, using
  //     item.entityId as the communityId (the same generic entity-pointer
  //     field already referenced in the commented-out deep-linking block
  //     below for other notification types).
  //     ⚠️ INVITE-type notifications are deliberately left unhandled here —
  //     there's no confirmed backend meaning/endpoint for what an INVITE
  //     accept should do (it may not be the same as joining a community),
  //     so faking it would risk silently doing the wrong thing.
  //   - 'decline' used to be a complete no-op (button did nothing at all).
  //     There's no "decline" endpoint anywhere on the backend for invites —
  //     and there doesn't need to be one: declining just means "don't join",
  //     so marking the notification read (same real action a normal tap
  //     does) is an honest, correct behavior, not a faked success message.
  const handleAction = useCallback(async (type, item) => {
    if (type === 'accept') {
      if (item.type === 'GROUP_REQUEST' && item.entityId) {
        try {
          await fetchAPI('/communities/join', {
            method: 'POST',
            body: JSON.stringify({ communityId: item.entityId }),
          });
          if (markNotificationRead) markNotificationRead(item.id);
          if (setThirdSheet) setThirdSheet({ title: 'Joined!', body: 'You have successfully joined the group.' });
        } catch (error) {
          if (__DEV__) console.warn('[AlertsScreen] Failed to accept group request:', error);
          if (setThirdSheet) setThirdSheet({ title: 'Error', body: 'Could not join the group. Please try again.' });
        }
        return;
      }
      if (__DEV__) console.warn(`[AlertsScreen] No accept handler wired yet for notification type "${item.type}".`);
      return;
    }

    if (type === 'decline' && markNotificationRead) {
      markNotificationRead(item.id);
    }
  }, [setThirdSheet, markNotificationRead]);

  // ─────────────────────────────────────────────────────────────────────
  // ⭐️ V9.1: Just mark as read. No navigation. No popup.
  // Highlight (unreadBg) disappears the instant you tap — exactly the UX
  // you asked for: "highlighted until I touch, then back to normal".
  //
  // 💡 When NavigationContainer is wired up in the future, uncomment the
  //    block below to re-enable smart deep-linking on tap.
  // ─────────────────────────────────────────────────────────────────────
  const handleItemPress = useCallback(async (item) => {
    // Optimistic mark-as-read — instant UI update, server sync in background
    if (item.isRead) return;

    if (markNotificationRead) {
      markNotificationRead(item.id);
      return;
    }

    // Fallback if the store doesn't expose the action
    try {
      await fetchAPI(`/notifications/${item.id}/read`, { method: 'PATCH' });
      if (fetchNotifications) fetchNotifications();
    } catch (error) {
      if (__DEV__) console.warn('Failed to mark notification as read:', error);
      // Soft revert: a refetch syncs us back to ground truth
      if (fetchNotifications) fetchNotifications();
    }

    // ─── Future: smart deep-linking (requires NavigationContainer in AppRoot) ───
    // import { navigate } from '../navigation/RootNavigation';
    // switch (item.type) {
    //   case 'MESSAGE':
    //     if (item.entityId) navigate('ChatDetail', { chatId: item.entityId });
    //     break;
    //   case 'LIKE':
    //   case 'COMMENT':
    //   case 'MENTION':
    //     if (item.entityId) navigate('PostDetail', { postId: item.entityId });
    //     break;
    //   case 'INCOMING_CALL':
    //     if (item.entityId) navigate('IncomingCall', { roomId: item.entityId, callerId: item.actorId });
    //     break;
    // }
  }, [markNotificationRead, fetchNotifications]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (markAllNotificationsRead) {
      markAllNotificationsRead();
      return;
    }
    try {
      await fetchAPI('/notifications/read/all', { method: 'PATCH' });
      if (fetchNotifications) fetchNotifications();
    } catch (error) {
      if (__DEV__) console.warn('Failed to mark all as read:', error);
    }
  }, [markAllNotificationsRead, fetchNotifications]);

  const sectionsData = useMemo(() => {
    const safeList = Array.isArray(notifications) ? notifications : [];
    const filtered = safeList.filter(n => matchesTab(n, activeTab));

    const mapped = filtered.map(item => ({
      ...item,
      rawDate: item.createdAt ? new Date(item.createdAt) : new Date(),
      time: item.createdAt
        ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Just now',
    })).sort((a, b) => b.rawDate - a.rawDate);

    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const grouped = { Today: [], Yesterday: [], Earlier: [] };
    mapped.forEach(item => {
      const itemDate = item.rawDate.toDateString();
      if (itemDate === today) grouped.Today.push(item);
      else if (itemDate === yesterdayStr) grouped.Yesterday.push(item);
      else grouped.Earlier.push(item);
    });

    return [
      { title: 'Today', data: grouped.Today },
      { title: 'Yesterday', data: grouped.Yesterday },
      { title: 'Earlier', data: grouped.Earlier },
    ].filter(section => section.data.length > 0);
  }, [notifications, activeTab]);

  const changeTab = useCallback((tabId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tabId);
  }, []);

  const ListEmptyComponent = useCallback(() => (
    isNotificationsLoading && !refreshing ? (
      <ActivityIndicator size="large" color={Data.brand.blue} style={{ marginTop: 50 }} />
    ) : (
      <View style={localStyles.emptyState}>
        <Ionicons name="notifications-off-outline" size={50} color={isDark ? '#444' : '#ccc'} />
        <Text style={{ color: isDark ? '#777' : '#999', marginTop: 10 }}>No alerts found.</Text>
      </View>
    )
  ), [isNotificationsLoading, refreshing, isDark]);

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#F8F9FA' }}>
      <View style={[localStyles.header, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
        <View>
          <Text style={[styles.h1, { color: isDark ? '#fff' : '#000' }]}>Alerts</Text>
          <Text style={[styles.sub, { color: isDark ? '#aaa' : '#666' }]}>System & Network Updates</Text>
        </View>
        <TouchableOpacity onPress={handleMarkAllAsRead} style={[localStyles.markReadBtn, isDark && { backgroundColor: '#102A43' }]}>
          <Ionicons name="checkmark-done-circle" size={20} color={Data.brand.blue} />
          <Text style={{ color: Data.brand.blue, fontWeight: '600', marginLeft: 4 }}>Read All</Text>
        </TouchableOpacity>
      </View>

      <View style={[localStyles.tabContainer, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderBottomColor: isDark ? '#333' : '#f0f0f0' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  localStyles.tabChip,
                  { backgroundColor: isDark ? '#333' : '#f5f5f5' },
                  isActive && { backgroundColor: isDark ? '#fff' : Data.brand.black },
                ]}
                onPress={() => changeTab(tab.id)}
              >
                <Text style={[
                  localStyles.tabText,
                  { color: isDark ? '#aaa' : '#666' },
                  isActive && { color: isDark ? '#000' : '#fff' },
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <SectionList
        sections={sectionsData}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Data.brand.blue} />}
        renderItem={({ item }) => (
          <AlertItem item={item} onPress={handleItemPress} onAction={handleAction} isDark={isDark} />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={localStyles.sectionHeader}>{title}</Text>
        )}
        ListEmptyComponent={ListEmptyComponent}
        stickySectionHeadersEnabled={false}
        initialNumToRender={10}
        windowSize={5}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10,
  },
  markReadBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  tabContainer: { paddingBottom: 12, borderBottomWidth: 1 },
  tabChip: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  tabText: { fontWeight: '600' },
  sectionHeader: {
    fontSize: 14, fontWeight: 'bold', color: '#888',
    marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  card: {
    padding: 16, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1,
  },
  unreadCard: { borderColor: Data.brand.blue + '40' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  iconContainer: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', position: 'relative',
  },
  redDot: {
    position: 'absolute', top: -2, right: -2, width: 10, height: 10,
    borderRadius: 5, backgroundColor: Data.brand.red, borderWidth: 2, borderColor: '#fff',
  },
  cardText: { fontSize: 15, lineHeight: 20 },
  timeText: { fontSize: 12, marginTop: 4 },
  actionRow: { flexDirection: 'row', marginTop: 12, paddingLeft: 52 },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, marginRight: 10 },
  actionBtnText: { fontSize: 13, fontWeight: 'bold', color: '#fff' },
  emptyState: { alignItems: 'center', marginTop: 50, opacity: 0.7 },
});