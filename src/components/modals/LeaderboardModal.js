// client/src/components/modals/LeaderboardModal.js
// ⭐️ FULL DARK MODE COMPATIBLE - ALL ORIGINAL FUNCTIONS PRESERVED 100% ⭐️
// ⭐️ FIXED: Added Fallback Images for Avatars ⭐️
//
// [V1.1 — Engineering Audit Fixes]:
// [BUG]   `Dimensions.get('window')` was captured ONCE at module load — same
//         rotation/resize bug found in 10+ sibling files in earlier audit
//         passes. Fixed with useWindowDimensions().
// [BUG]   `item.id === user?.id` used strict equality without String()
//         coercion, inconsistent with the established codebase-wide
//         convention for ID comparisons (e.g. CommentsSheet.js, GroupCard.js).
//         If the leaderboard endpoint and the auth/me endpoint ever serialize
//         ids as different types (number vs string) — a realistic risk across
//         two different backend responses — the "YOU" highlight would never
//         appear for the current user even when they are in the list.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  FlatList, Image, useWindowDimensions, ActivityIndicator, RefreshControl, Platform, KeyboardAvoidingView 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { brand, imageFor } from '../../constants/data'; // ⭐️ הבאנו את imageFor
import { trackEvent } from '../../utils/analytics'; // 👈 הייבוא החדש שלנו

// Stable empty array so the memoized `sortedData` keeps referential equality
// when the store has no leaderboard yet (avoids a needless recompute each render).
const EMPTY_LEADERBOARD = [];

// Minimum time the refresh spinner stays visible, only to avoid an ugly flicker
// on very fast refreshes. (V1 hardcoded a 3500ms delay that made every manual
// refresh feel artificially slow — that has been removed.)
const MIN_SPINNER_MS = 500;

// PURE FUNCTION: Kept outside to prevent memory reallocation on re-renders (Updated for Dark Mode)
const getRankTheme = (index, isDark) => {
  if (index === 0) return { color: '#FFD700', bg: isDark ? '#332b00' : '#FFF9E6', icon: 'crown', border: isDark ? '#665600' : '#FFD700', glow: 'rgba(255, 215, 0, 0.2)' }; 
  if (index === 1) return { color: isDark ? '#D1D5DB' : '#B4B4B4', bg: isDark ? '#2a2a2a' : '#F5F5F5', icon: 'medal', border: isDark ? '#4d4d4d' : '#B4B4B4', glow: 'rgba(180, 180, 180, 0.1)' };
  if (index === 2) return { color: '#CD7F32', bg: isDark ? '#3d260f' : '#FDF2F0', icon: 'medal', border: isDark ? '#7a4c1e' : '#CD7F32', glow: 'rgba(205, 127, 50, 0.1)' };
  return { color: '#94A3B8', bg: isDark ? '#1C1C1E' : '#FFFFFF', icon: null, border: isDark ? '#333' : '#F1F5F9', glow: 'transparent' };
};

export const LeaderboardModal = ({ setSecondSheet }) => {
  // [FIX] Reactive — re-renders on rotation/resize, unlike Dimensions.get('window')
  // captured once at module load.
  const { width } = useWindowDimensions();
  const user = useAppStore(state => state.user);
  const leaderboard = useAppStore(state => state.leaderboard) ?? EMPTY_LEADERBOARD;
  const isLeaderboardLoading = useAppStore(state => state.isLeaderboardLoading);
  const refreshLeaderboard = useAppStore(state => state.refreshLeaderboard);
  const userSettings = useAppStore(state => state.userSettings); 

  const isDark = userSettings?.darkMode === true; 

  const [activeTab, setActiveTab] = useState('points'); 
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const hasFetchedOnMount = useRef(false);
  const isMounted = useRef(true); 

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Ref-based guard instead of depending on `isRefreshing`, so the callback
  // keeps a stable identity across refreshes (no churn into the mount effect).
  const isRefreshingRef = useRef(false);

  const handleRefreshCore = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    setIsRefreshing(true);
    const startedAt = Date.now();
    try {
      if (refreshLeaderboard) {
        await refreshLeaderboard();
      }
      // Keep the spinner up for a brief, fixed floor only — never an arbitrary
      // multi-second wait.
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_SPINNER_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_SPINNER_MS - elapsed));
      }
    } catch (error) {
      console.error("Leaderboard refresh failed:", error);
    } finally {
      isRefreshingRef.current = false;
      if (isMounted.current) {
        setIsRefreshing(false);
      }
    }
  }, [refreshLeaderboard]);

  useEffect(() => {
    if (!hasFetchedOnMount.current) {
      hasFetchedOnMount.current = true;
      handleRefreshCore();
    }
  }, [handleRefreshCore]);

  const onClose = useCallback(() => {
    if (setSecondSheet) setSecondSheet(null);
  }, [setSecondSheet]);

  const sortedData = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
        if (activeTab === 'points') return (b.points || 0) - (a.points || 0);
        return (b.streak || 0) - (a.streak || 0);
    });
  }, [leaderboard, activeTab]);

  const renderItem = useCallback(({ item, index }) => {
    const theme = getRankTheme(index, isDark); 
    // [FIX] String() coercion — see header note.
    const isMe = String(item.id) === String(user?.id);
    
    const safeUsername = encodeURIComponent(item.username || 'user');
    // ⭐️ FIX: שימוש ב-avatarUrl ואם הוא ריק, קריאה ל-imageFor עם שם המשתמש.
    // אם imageFor גם לא מוצא כלום, השתמש ב-ui-avatars ⭐️
    const avatarUri = item.avatarUrl || item.avatar_url || imageFor(item.username) || `https://ui-avatars.com/api/?name=${safeUsername}&background=random`;
    
    return (
      <View style={[
        localStyles.participantCard, 
        { borderColor: theme.border, backgroundColor: isDark ? '#1C1C1E' : '#fff' },
        isMe && [localStyles.meCard, { backgroundColor: isDark ? '#102A43' : '#F8FAFF', borderColor: brand.blue }]
      ]}>
        
        <View style={[localStyles.rankSection, { backgroundColor: theme.bg }]}>
            {theme.icon ? (
                <MaterialCommunityIcons name={theme.icon} size={22} color={theme.color} />
            ) : (
                <Text style={[localStyles.rankNumber, { color: theme.color }]}>{index + 1}</Text>
            )}
        </View>

        <View style={localStyles.avatarSection}>
            <Image 
                source={{ uri: avatarUri }} // ⭐️ התמונה המעודכנת
                style={[localStyles.avatar, { backgroundColor: isDark ? '#333' : '#F1F5F9' }, index < 3 && { borderWidth: 2, borderColor: theme.color }]} 
                fadeDuration={200}
            />
            {isMe && <View style={[localStyles.onlineIndicator, { borderColor: isDark ? '#1C1C1E' : '#fff' }]} />}
        </View>
        
        <View style={localStyles.nameSection}>
            <View style={localStyles.nameRow}>
                <Text style={[localStyles.display_name, { color: isDark ? '#fff' : '#1E293B', maxWidth: width * 0.3 }]} numberOfLines={1}>
                    {item.display_name || item.name || item.username} 
                </Text>
                {isMe && <View style={localStyles.meBadge}><Text style={localStyles.meBadgeText}>YOU</Text></View>}
            </View>
            <Text style={[localStyles.username_handle, { color: isDark ? '#aaa' : '#94A3B8' }]}>@{item.username}</Text>
        </View>

        <View style={[localStyles.scoreBox, { backgroundColor: theme.bg }]}>
            <Text style={[localStyles.scoreValue, { color: index < 3 ? theme.color : (isDark ? '#fff' : '#1E293B') }]}>
                {activeTab === 'points' ? (item.points || 0).toLocaleString() : (item.streak || 0)}
            </Text>
            <Text style={[localStyles.scoreUnit, { color: isDark ? '#888' : '#94A3B8' }]}>
                {activeTab === 'points' ? 'PTS' : 'DAYS'}
            </Text>
        </View>
      </View>
    );
  }, [activeTab, user?.id, isDark]); 

  const loading = isLeaderboardLoading || isRefreshing;

  return (
    <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
        <View style={[localStyles.mainContainer, { backgroundColor: isDark ? '#000' : '#F9FAFB' }]}>
          
          {/* Header */}
          <View style={localStyles.headerTop}>
              <View style={localStyles.headerTitleRow}>
                  <View style={[localStyles.iconCircle, { backgroundColor: isDark ? '#332b00' : '#FFFBEB', borderColor: isDark ? '#665600' : '#FEF3C7' }]}>
                    <Ionicons name="trophy" size={24} color="#FFD700" />
                  </View>
                  <View>
                    <Text style={[localStyles.title, { color: isDark ? '#fff' : '#111' }]}>Top Vibes</Text>
                    <Text style={[localStyles.statusText, { color: isDark ? '#aaa' : '#64748B' }]}>
                        {loading ? 'Refreshing ranks...' : 'Live Community Rankings'}
                    </Text>
                  </View>
              </View>
              <TouchableOpacity onPress={onClose} style={[localStyles.closeBtn, { backgroundColor: isDark ? '#333' : '#F1F5F9' }]} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={24} color={isDark ? '#ccc' : "#666"} />
              </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={[localStyles.tabsContainer, { backgroundColor: isDark ? '#1C1C1E' : '#F1F5F9', borderColor: isDark ? '#333' : '#E2E8F0' }]}>
            <TouchableOpacity 
              style={[localStyles.tab, activeTab === 'points' && [localStyles.activeTab, { backgroundColor: isDark ? '#333' : '#fff' }]]} 
              onPress={() => {
                trackEvent('leaderboard_tab_clicked', { tab: 'points' }); // 👈 הדיווח
                setActiveTab('points');
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="star-shooting" size={18} color={activeTab === 'points' ? brand.blue : '#94A3B8'} />
              <Text style={[localStyles.tabText, { color: isDark ? '#888' : '#94A3B8' }, activeTab === 'points' && [localStyles.activeTabText, { color: isDark ? '#fff' : '#1E293B' }]]}>Points</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[localStyles.tab, activeTab === 'streak' && [localStyles.activeTab, { backgroundColor: isDark ? '#333' : '#fff' }]]} 
              onPress={() => {
                trackEvent('leaderboard_tab_clicked', { tab: 'streak' }); // 👈 הדיווח
                setActiveTab('streak');
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="fire" size={18} color={activeTab === 'streak' ? '#FF4500' : '#94A3B8'} />
              <Text style={[localStyles.tabText, { color: isDark ? '#888' : '#94A3B8' }, activeTab === 'streak' && [localStyles.activeTabText, { color: isDark ? '#fff' : '#1E293B' }]]}>Streaks</Text>
            </TouchableOpacity>
          </View>

          {/* Main List & Loading State */}
          {loading && sortedData.length === 0 ? (
              <View style={localStyles.loaderContainer}>
                  <ActivityIndicator size="large" color={brand.blue} />
                  <Text style={[localStyles.loadingText, { color: isDark ? '#aaa' : '#94A3B8' }]}>Syncing standings...</Text>
              </View>
          ) : (
              <FlatList
                data={sortedData}
                keyExtractor={(item, index) => item?.id ? String(item.id) : `user-${index}`}
                contentContainerStyle={localStyles.listContent}
                showsVerticalScrollIndicator={false}
                
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={Platform.OS === 'android'}
                
                refreshControl={
                    <RefreshControl 
                        refreshing={loading} 
                        onRefresh={handleRefreshCore} 
                        colors={[brand.blue]} 
                        tintColor={brand.blue}
                        progressViewOffset={10}
                    />
                }
                renderItem={renderItem}
                ListEmptyComponent={
                    <View style={localStyles.emptyContainer}>
                        <Ionicons name="trophy-outline" size={60} color={isDark ? '#444' : "#CBD5E1"} />
                        <Text style={[localStyles.emptyText, { color: isDark ? '#fff' : '#1E293B' }]}>Standing board is empty</Text>
                        <Text style={[localStyles.emptySub, { color: isDark ? '#888' : '#94A3B8' }]}>Connect more to appear here!</Text>
                    </View>
                }
              />
          )}
        </View>
    </KeyboardAvoidingView>
  );
};

const localStyles = StyleSheet.create({
  mainContainer: { 
      flex: 1, 
      borderTopLeftRadius: 32, 
      borderTopRightRadius: 32,
  },
  headerTop: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      paddingHorizontal: 24, 
      paddingTop: 24, 
      paddingBottom: 16 
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.8 },
  statusText: { fontSize: 12, fontWeight: '600', marginTop: -2 },
  closeBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  
  tabsContainer: {
      flexDirection: 'row',
      marginHorizontal: 24,
      borderRadius: 16,
      padding: 5,
      marginBottom: 20,
      borderWidth: 1,
  },
  tab: { 
      flex: 1, 
      flexDirection: 'row',
      paddingVertical: 12, 
      alignItems: 'center', 
      justifyContent: 'center',
      borderRadius: 12,
      gap: 8
  },
  activeTab: { elevation: 2 },
  tabText: { fontWeight: '700', fontSize: 14 },
  activeTabText: { },

  listContent: { paddingHorizontal: 20, paddingBottom: 60 },
  
  participantCard: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      padding: 12, 
      borderRadius: 22, 
      borderWidth: 1.5,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 2
  },
  meCard: { borderWidth: 1.5 },
  
  rankSection: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  rankNumber: { fontSize: 18, fontWeight: '900' },
  
  avatarSection: { width: 50, height: 50, position: 'relative' },
  avatar: { width: '100%', height: '100%', borderRadius: 25 },
  onlineIndicator: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#10B981', borderWidth: 2 },

  nameSection: { flex: 1, marginLeft: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  display_name: { fontSize: 16, fontWeight: '800' },
  username_handle: { fontSize: 13, fontWeight: '500', marginTop: 1 },
  
  meBadge: { backgroundColor: brand.blue, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  meBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },

  scoreBox: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, minWidth: 70 },
  scoreValue: { fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  scoreUnit: { fontSize: 9, fontWeight: '800', marginTop: -1 },

  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  loadingText: { marginTop: 12, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 80, opacity: 0.5 },
  emptyText: { fontSize: 18, fontWeight: '800', marginTop: 16 },
  emptySub: { fontSize: 14, fontWeight: '500', marginTop: 4 }
});