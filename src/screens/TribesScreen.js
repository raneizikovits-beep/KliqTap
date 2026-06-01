// client/src/screens/TribesScreen.js
// ✅ V2.0 PRODUCTION: Full architectural refactor — clean, modular, secure, scalable

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Data from '../constants/data';
import { useAppStore } from '../store/useAppStore';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const FLATLIST_CONTENT_STYLE = { paddingBottom: 120 };

/**
 * Builds a fallback avatar URL for groups without a cover image.
 * Uses ui-avatars.com — safe, deterministic, and dependency-free.
 */
const getFallbackGroupImage = (name = 'Tribe') =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`;

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/**
 * Activity bar showing the ratio of online members to total members.
 * Clamped to [0, 100] to prevent overflow from bad data.
 */
const ActivityBar = ({ onlineCount, totalMembers, isDark }) => {
  const onlinePercent = totalMembers > 0
    ? Math.min(100, Math.max(0, (onlineCount / totalMembers) * 100))
    : 0;

  return (
    <View style={styles.activityRow}>
      <View style={[styles.barTrack, { backgroundColor: isDark ? '#333' : '#eee' }]}>
        <View style={[styles.barFill, { width: `${onlinePercent}%` }]} />
      </View>
      <Text style={styles.activityText}>
        <Text style={styles.activityTextHighlight}>{onlineCount}</Text>
        /{totalMembers}
      </Text>
    </View>
  );
};

/**
 * Owner-only management actions (edit / delete).
 * Extracted to avoid re-rendering the full card when isOwner is false.
 */
const OwnerActions = ({ onEdit, onDelete, isDark }) => (
  <View style={styles.ownerActions}>
    <TouchableOpacity
      style={styles.miniActionBtn}
      onPress={onEdit}
      accessibilityLabel="Edit tribe"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="create-outline" size={16} color={isDark ? '#aaa' : '#666'} />
    </TouchableOpacity>
    <TouchableOpacity
      style={styles.miniActionBtn}
      onPress={onDelete}
      accessibilityLabel="Delete tribe"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="trash-outline" size={16} color="#ef4444" />
    </TouchableOpacity>
  </View>
);

/**
 * Compact tribe card rendered inside the FlatList.
 *
 * Wrapped in React.memo — only re-renders when its own props change.
 * All callbacks are expected to be stable (useCallback in parent).
 */
const CompactGroupCard = React.memo(({
  group,
  onJoin,
  onPress,
  onLeave,
  onEdit,
  onDelete,
  isDark,
  isOwner,
}) => {
  // Normalise field names — API may return either snake_case or camelCase
  const totalMembers = group.memberCount ?? group.member_count ?? 0;
  const onlineCount  = group.onlineCount ?? 0;
  const imageUri     = group.image || getFallbackGroupImage(group.name);

  const cardBg      = isDark ? '#1C1C1E' : '#fff';
  const textColor   = isDark ? '#fff'    : '#333';
  const subTextColor = isDark ? '#aaa'   : '#888';
  const btnBg       = isDark ? '#333'    : '#222';

  return (
    <TouchableOpacity
      style={[styles.compactCard, { backgroundColor: cardBg }]}
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityLabel={`Open tribe ${group.name}`}
      accessibilityRole="button"
    >
      {/* Tribe thumbnail */}
      <Image
        source={{ uri: imageUri }}
        style={styles.compactImage}
        accessibilityLabel={`${group.name} cover image`}
      />

      {/* Tribe info */}
      <View style={styles.compactContent}>
        <View style={styles.rowSpaceBetween}>
          <Text style={[styles.compactTitle, { color: textColor }]} numberOfLines={1}>
            {group.name}
          </Text>
          {isOwner && (
            <Ionicons
              name="shield-checkmark"
              size={14}
              color={Data.brand.blue}
              style={{ marginLeft: 4 }}
              accessibilityLabel="You own this tribe"
            />
          )}
        </View>

        <Text style={[styles.compactDesc, { color: subTextColor }]} numberOfLines={1}>
          {group.description || 'Community vibes only.'}
        </Text>

        <ActivityBar
          onlineCount={onlineCount}
          totalMembers={totalMembers}
          isDark={isDark}
        />
      </View>

      {/* Action column */}
      <View style={styles.actionColumn}>
        {group.isMember ? (
          <TouchableOpacity
            style={[styles.compactActionBtn, styles.leaveBtn]}
            onPress={onLeave}
            accessibilityLabel={`Leave ${group.name}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.compactActionBtn, { backgroundColor: btnBg }]}
            onPress={onJoin}
            accessibilityLabel={`Join ${group.name}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {isOwner && (
          <OwnerActions
            onEdit={onEdit}
            onDelete={onDelete}
            isDark={isDark}
          />
        )}
      </View>
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────

const EmptyState = ({ isDark }) => (
  <View style={styles.emptyContainer}>
    <Ionicons
      name="people-outline"
      size={56}
      color={isDark ? '#444' : '#ddd'}
      style={{ marginBottom: 12 }}
    />
    <Text style={[styles.emptyTitle, { color: isDark ? '#aaa' : '#888' }]}>
      No tribes found yet.
    </Text>
    <Text style={[styles.emptySubtitle, { color: isDark ? '#555' : '#bbb' }]}>
      Be the first to create one!
    </Text>
  </View>
);

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────

export default function TribesScreen({ setSecondSheet, setGroupModalTab }) {
  const {
    groups = [],
    isGroupsLoading,
    joinGroup,
    leaveGroup,
    deleteGroup,
    user,
    userLocation,
    fetchExploreData,
    refreshAllData,
    userSettings,
  } = useAppStore();

  const isDark = userSettings?.darkMode === true;
  const [refreshing, setRefreshing] = useState(false);

  // Abort-safe ref — prevents setState on unmounted component
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Initial data load ────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        await fetchExploreData();
        if (refreshAllData) await refreshAllData();
      } catch (e) {
        console.error('[Tribes] Initial load failed:', e);
      }
    };
    init();
    // Only run on mount; dependencies are stable store references
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Pull-to-refresh ──────────────────────
  const onRefresh = useCallback(async () => {
    if (mountedRef.current) setRefreshing(true);
    try {
      await fetchExploreData();
      if (refreshAllData) await refreshAllData();
    } catch (e) {
      console.error('[Tribes] Refresh failed:', e);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [fetchExploreData, refreshAllData]);

  // ─── Join ─────────────────────────────────
  const handleJoinGroup = useCallback(async (group) => {
    try {
      await joinGroup(String(group.id));
      Alert.alert('Joined! 🎉', `Welcome to ${group.name}`);
    } catch (error) {
      console.error('[Tribes] Join failed:', error);
      Alert.alert('Error', 'Could not join the tribe. Please try again.');
    }
  }, [joinGroup]);

  // ─── Leave ────────────────────────────────
  const handleLeaveGroup = useCallback(async (group) => {
    Alert.alert(
      'Leave Tribe',
      `Are you sure you want to leave ${group.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(String(group.id));
              Alert.alert('Left', `You have left ${group.name}.`);
            } catch (error) {
              console.error('[Tribes] Leave failed:', error);
              Alert.alert('Error', 'Could not leave the tribe. Please try again.');
            }
          },
        },
      ]
    );
  }, [leaveGroup]);

  // ─── Delete ───────────────────────────────
  const handleDeleteGroup = useCallback((group) => {
    Alert.alert(
      'Delete Tribe',
      `Are you sure you want to delete "${group.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (deleteGroup) await deleteGroup(String(group.id));
              Alert.alert('Deleted', 'The tribe has been removed.');
            } catch (e) {
              console.error('[Tribes] Delete failed:', e);
              Alert.alert('Error', 'Failed to delete the tribe. Please try again.');
            }
          },
        },
      ]
    );
  }, [deleteGroup]);

  // ─── Header component (stable — no anonymous fn) ────────────────────
  const ListHeader = useMemo(() => (
    <View style={styles.groupHeaderWrapper}>
      <Text style={[styles.groupSectionTitle, { color: isDark ? '#666' : '#999' }]}>
        EXPLORE TRIBES
      </Text>
      <TouchableOpacity
        onPress={() => setSecondSheet({ source: 'LocationPicker' })}
        style={[
          styles.locationChip,
          { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#eee' },
        ]}
        accessibilityLabel="Change location filter"
      >
        <Ionicons name="navigate" size={12} color={Data.brand.blue} />
        <Text style={styles.locationText}>{userLocation?.name || 'Global'}</Text>
      </TouchableOpacity>
    </View>
  // isDark and userLocation.name are the only reactive values here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [isDark, userLocation?.name, setSecondSheet]);

  // ─── Empty component (stable) ─────────────
  const ListEmpty = useMemo(
    () => !isGroupsLoading ? <EmptyState isDark={isDark} /> : null,
    [isGroupsLoading, isDark]
  );

  // ─── Loading overlay on first load ────────
  if (isGroupsLoading && groups.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDark ? '#000' : '#F9FAFB' }]}>
        <ActivityIndicator size="large" color={Data.brand.blue} />
      </View>
    );
  }

  // ─── renderItem (stable — all handlers are useCallback) ────────────
  const renderItem = useCallback(({ item }) => {
    const isOwner =
      item.ownerId === user?.id ||
      item.created_by === user?.id;

    return (
      <CompactGroupCard
        group={item}
        isOwner={isOwner}
        isDark={isDark}
        onJoin={() => handleJoinGroup(item)}
        onLeave={() => handleLeaveGroup(item)}
        onEdit={() => setSecondSheet({ source: 'EditGroup', group: item })}
        onDelete={() => handleDeleteGroup(item)}
        onPress={() => {
          setGroupModalTab('posts');
          setSecondSheet({ source: 'GroupDetails', group: item });
        }}
      />
    );
  // item-specific handlers are stable; isDark triggers re-memoisation on theme switch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark, user?.id, handleJoinGroup, handleLeaveGroup, handleDeleteGroup, setSecondSheet, setGroupModalTab]);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <View style={[styles.mainContainer, { backgroundColor: isDark ? '#000' : '#F9FAFB' }]}>
      <FlatList
        data={groups}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={FLATLIST_CONTENT_STYLE}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Data.brand.blue}
          />
        }
        // Performance tuning
        removeClippedSubviews
        windowSize={7}
        maxToRenderPerBatch={8}
        initialNumToRender={10}
        getItemLayout={(_, index) => ({
          length: 92,   // compactCard height: padding(12*2) + image(56) + margin(12)
          offset: 92 * index,
          index,
        })}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Screen ────────────────────────────────
  mainContainer: { flex: 1, paddingTop: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Header ────────────────────────────────
  groupHeaderWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  groupSectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  locationChip: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  locationText: {
    fontSize: 11,
    fontWeight: '700',
    color: Data.brand.blue,
    marginLeft: 4,
  },

  // ── Card ──────────────────────────────────
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    marginHorizontal: 20,
    elevation: 2,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  compactImage: { width: 56, height: 56, borderRadius: 14 },
  compactContent: { flex: 1, marginLeft: 14 },
  rowSpaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compactTitle: { fontSize: 15, fontWeight: 'bold', flexShrink: 1 },
  compactDesc: { fontSize: 12, marginTop: 2 },

  // ── Activity bar ──────────────────────────
  activityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  barTrack: { width: 60, height: 4, borderRadius: 2, marginRight: 8 },
  barFill: { height: '100%', backgroundColor: Data.brand.green, borderRadius: 2 },
  activityText: { fontSize: 10, color: '#999' },
  activityTextHighlight: { color: Data.brand.green, fontWeight: 'bold' },

  // ── Action column ─────────────────────────
  actionColumn: { alignItems: 'center', gap: 8 },
  compactActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtn: {
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
    borderWidth: 1,
  },
  ownerActions: { flexDirection: 'row', gap: 4 },
  miniActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },

  // ── Empty state ───────────────────────────
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});