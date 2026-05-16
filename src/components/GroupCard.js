// client/src/components/GroupCard.js
// ⭐️ V2.0 — Removed Math.random fake data, added division-by-zero guard, helper extracted ⭐️
//
// CHANGES from V1:
//   [FIX-C]  Removed Math.random fallbacks for memberCount/onlineCount.
//            UI now shows real data only; if absent, shows '0' or 'New'.
//   [FIX-S11] Division by zero guard for onlinePercent.
//   [DRY]    Extracted isUserMemberOfGroup logic (shared with GroupDetailsSheet).

import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand, imageFor } from '../constants/data';

// Helper — should ideally live in constants/helpers.js and be shared with GroupDetailsSheet.
// Pure function: easy to test, no React deps.
export const isUserMemberOfGroup = (group, userId) => {
  if (!group || !userId) return false;
  if (group.isMember) return true;
  if (Array.isArray(group.members)) {
    return group.members.some(m => String(m.userId) === String(userId));
  }
  return false;
};

const GroupCard = ({
  group,
  user,
  onJoin,
  onLeave,
  openGroupDetails,
}) => {
  const { name, imageUrl, memberCount, description, id } = group || {};
  const currentUserId = String(user?.id || '');

  const isMember = useMemo(
    () => isUserMemberOfGroup(group, currentUserId),
    [group, currentUserId]
  );

  // ⭐️ [FIX-C] Real data only. No Math.random hallucinations.
  // ⭐️ [FIX-S11] Guard against div-by-zero.
  const { totalMembers, onlineCount, onlinePercent, hasActivityData } = useMemo(() => {
    const total = Number.isFinite(memberCount) ? memberCount : 0;
    const online = Number.isFinite(group?.onlineCount) ? group.onlineCount : 0;
    const percent = total > 0 ? Math.min(100, (online / total) * 100) : 0;
    return {
      totalMembers: total,
      onlineCount: online,
      onlinePercent: percent,
      hasActivityData: total > 0,
    };
  }, [memberCount, group?.onlineCount]);

  const uri = imageUrl || imageFor(name || 'Group');

  if (!group) return null;

  return (
    <TouchableOpacity
      style={localStyles.cardContainer}
      activeOpacity={0.7}
      onPress={openGroupDetails}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name} group details`}
    >
      <Image source={{ uri }} style={localStyles.cardImage} />

      <View style={localStyles.cardContent}>
        <View style={localStyles.titleRow}>
          <Text style={localStyles.cardTitle} numberOfLines={1}>{name}</Text>
          {isMember && (
            <Ionicons
              name="star"
              size={12}
              color="#FFD700"
              style={localStyles.starIcon}
              accessibilityLabel="Member"
            />
          )}
        </View>

        <Text style={localStyles.cardDesc} numberOfLines={1}>
          {description || 'Community vibes only.'}
        </Text>

        <View style={localStyles.activityRow}>
          {hasActivityData ? (
            <>
              <View style={localStyles.barTrack}>
                <View
                  style={[localStyles.barFill, { width: `${onlinePercent}%` }]}
                />
              </View>
              <Text style={localStyles.activityText}>
                <Text style={localStyles.onlineCountText}>{onlineCount}</Text>
                {`/${totalMembers} Online`}
              </Text>
            </>
          ) : (
            <Text style={localStyles.newBadge}>New Community</Text>
          )}
        </View>
      </View>

      <TouchableOpacity
        style={[
          localStyles.actionBtn,
          isMember && localStyles.leaveBtnContainer,
        ]}
        onPress={isMember ? onLeave : onJoin}
        accessibilityRole="button"
        accessibilityLabel={isMember ? `Leave ${name}` : `Join ${name}`}
      >
        {isMember ? (
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        ) : (
          <Ionicons name="add" size={22} color="#fff" />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default memo(GroupCard);

const localStyles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f9f9f9',
  },
  cardImage: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#eee' },
  cardContent: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  starIcon: { marginLeft: 4 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  cardDesc: { fontSize: 12, color: '#888', marginTop: 2, marginBottom: 6 },
  activityRow: { flexDirection: 'row', alignItems: 'center' },
  barTrack: {
    width: 80, height: 4, backgroundColor: '#F0F0F0',
    borderRadius: 2, marginRight: 8,
  },
  barFill: { height: '100%', backgroundColor: brand.green, borderRadius: 2 },
  activityText: { fontSize: 10, color: '#999', fontWeight: '600' },
  onlineCountText: { color: brand.green, fontWeight: 'bold' },
  newBadge: { fontSize: 10, color: brand.blue, fontWeight: '700' },
  actionBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#222',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 10,
  },
  leaveBtnContainer: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
});