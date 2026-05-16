// client/src/components/modals/RadarModal.js
// ⭐️ ULTIMATE PRODUCTION VERSION: Privacy Integrated, Enterprise Performance & DARK MODE COMPATIBLE ⭐️

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, Text, TouchableOpacity, 
  StyleSheet, ActivityIndicator, Image, Dimensions, RefreshControl, FlatList, Switch, Platform 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { brand } from '../../constants/data';

const { height } = Dimensions.get('window');

// Pure function extracted to prevent memory reallocation
const getFuzzyDistance = (distanceKm) => {
  if (distanceKm < 0.2) return "Right nearby 📍";
  if (distanceKm < 1.0) return "A few streets away 🚶";
  if (distanceKm < 3.0) return "In your neighborhood 🏘️";
  return "A short drive away 🚗";
};

export const RadarModal = ({ onClose, userLocation }) => {
  // 1. REFACTOR: Atomic Zustand Selectors to strictly prevent massive component re-renders
  const radarResults = useAppStore(state => state.radarResults);
  const isRadarLoading = useAppStore(state => state.isRadarLoading);
  const fetchRadarData = useAppStore(state => state.fetchRadarData);
  const userSettings = useAppStore(state => state.userSettings); // ⭐️ משיכת הגדרות
  const updateSetting = useAppStore(state => state.updateSetting); // ⭐️ הוספת פונקציית העדכון לפרטיות
  
  const isDark = userSettings?.darkMode === true; // בדיקת מצב לילה
  const isGhostMode = userSettings?.ghostMode || false; // ⭐️ סטטוס Ghost Mode נוכחי

  const [activeTab, setActiveTab] = useState('vibes'); 

  // ⭐️ הרענון האחד-פעמי נשאר בדיוק כמו שביקשת (ללא שינוי) ⭐️
  useEffect(() => {
    fetchRadarData(userLocation?.latitude, userLocation?.longitude);
  }, [userLocation?.latitude, userLocation?.longitude, fetchRadarData]);

  const handleRefresh = useCallback(() => {
    fetchRadarData(userLocation?.latitude, userLocation?.longitude);
  }, [userLocation?.latitude, userLocation?.longitude, fetchRadarData]);

  const handleTabSwitch = useCallback((tab) => {
    setActiveTab(tab);
  }, []);

  // ⭐️ פונקציה לשינוי מצב רוח רפאים ⭐️
  const toggleGhostMode = useCallback((value) => {
    updateSetting('ghostMode', value);
  }, [updateSetting]);

  // 2. REFACTOR & LOGIC FIT: Standardize data and apply Mathematical Sorting (closest first)
  const listData = useMemo(() => {
    const communities = Array.isArray(radarResults) ? radarResults : (radarResults?.groups || []);
    const liveUsers = !Array.isArray(radarResults) && radarResults?.users ? radarResults.users : [];

    const activeData = activeTab === 'vibes' ? liveUsers : communities;
    
    // Sort array mathematically ascending by distance
    return [...activeData].sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
  }, [radarResults, activeTab]);

  // 3. REFACTOR: Dedicated Renderers for Virtualized FlatList
  const renderItem = useCallback(({ item }) => {
    if (activeTab === 'vibes') {
      
      // 🌟 שלב 1: מבטלים את ה-Avatar הגנרי מהאינטרנט ומגדירים null אם אין תמונה אמיתית
      const avatarUrl = item.avatarUrl || null;
      
      return (
        <View style={[localStyles.userCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#f0f0f0' }]}>
          
          {/* 🌟 שלב 2: יישום עיצוב האות הראשונה החדש */}
          <View style={localStyles.userAvatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 25 }} fadeDuration={200} />
            ) : (
              <View style={{
                width: '100%',
                height: '100%',
                borderRadius: 25,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
                overflow: 'hidden'
              }}>
                <View style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: brand.blue,
                    opacity: 0.1,
                    position: 'absolute'
                }} />
                <Text style={{ 
                    color: isDark ? '#FFF' : brand.blue, 
                    fontWeight: '900', 
                    fontSize: 16 
                }}>
                    {item.username ? item.username.charAt(0).toUpperCase() : '?'}
                </Text>
              </View>
            )}
          </View>

          <View style={localStyles.userInfo}>
            <Text style={[localStyles.userName, { color: isDark ? '#fff' : '#222' }]}>@{item.username}</Text>
            <Text style={[localStyles.fuzzyDistance, { color: isDark ? '#aaa' : '#666' }]}>{getFuzzyDistance(item.distance_km)}</Text>
            {item.sharedInterest && (
              <View style={[localStyles.contextBadge, { backgroundColor: isDark ? '#3D2F1B' : '#FFFBEB', borderColor: isDark ? '#594420' : '#FEF3C7' }]}>
                <Text style={[localStyles.contextText, { color: isDark ? '#FDE68A' : '#D97706' }]}>✨ Both like {item.sharedInterest}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={[localStyles.waveBtn, isDark && { backgroundColor: '#102A43' }]} activeOpacity={0.8}>
            <Text style={localStyles.waveBtnText}>Wave 👋</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // ... שאר הפונקציה (communities) נשארת ללא שינוי
    if (activeTab === 'communities') {
      return (
        <View style={[localStyles.groupCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#eee' }]}>
          <View style={localStyles.groupInfo}>
            <Text style={[localStyles.groupName, { color: isDark ? '#fff' : '#222' }]} numberOfLines={1}>{item.name}</Text>
            <Text style={localStyles.distanceText}>
              📍 {item.distance_km < 1 ? 
                `${(item.distance_km * 1000).toFixed(0)}m away` : 
                `${(item.distance_km || 0).toFixed(1)}km away`}
            </Text>
          </View>
          <TouchableOpacity style={[localStyles.joinBtn, { backgroundColor: isDark ? '#333' : '#222' }]} onPress={onClose} activeOpacity={0.8}>
            <Text style={localStyles.joinBtnText}>Explore</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  }, [activeTab, onClose, isDark]);

  const renderEmptyState = useCallback(() => {
    if (isRadarLoading) {
        return (
            <View style={localStyles.center}>
              <View style={localStyles.radarPulse}>
                 <MaterialCommunityIcons name="radar" size={40} color={brand.blue || '#007AFF'} />
              </View>
              <ActivityIndicator size="large" color={brand.blue || '#007AFF'} style={{ marginTop: 20 }} />
              <Text style={[localStyles.loadingText, { color: isDark ? '#aaa' : '#666' }]}>Scanning your surroundings...</Text>
            </View>
        );
    }

    if (activeTab === 'vibes') {
        return (
            <View style={localStyles.emptyState}>
              <MaterialCommunityIcons name="ghost-outline" size={50} color={isDark ? '#444' : "#ddd"} />
              <Text style={[localStyles.emptyText, { color: isDark ? '#888' : '#666' }]}>It's quiet around here right now.</Text>
              <Text style={[localStyles.emptySubtext, { color: isDark ? '#666' : '#999' }]}>Pull down to scan again!</Text>
            </View>
        );
    }

    return (
        <View style={localStyles.emptyState}>
          <Ionicons name="location-outline" size={50} color={isDark ? '#444' : "#ddd"} />
          <Text style={[localStyles.emptyText, { color: isDark ? '#888' : '#666' }]}>No communities found nearby.</Text>
          <Text style={[localStyles.emptySubtext, { color: isDark ? '#666' : '#999' }]}>Pull down to search again.</Text>
        </View>
    );
  }, [isRadarLoading, activeTab, isDark]);

  return (
    <View style={[localStyles.mainContainer, { backgroundColor: isDark ? '#000' : '#F9FAFB' }]}>
      
      <View style={localStyles.headerTop}>
          <View style={localStyles.headerTitleRow}>
              <MaterialCommunityIcons name="radar" size={26} color="#FF2D55" />
              <Text style={[localStyles.title, { color: isDark ? '#fff' : '#111' }]}>Live Radar</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[localStyles.closeBtn, { backgroundColor: isDark ? '#333' : '#eee' }]} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={isDark ? '#ccc' : "#666"} />
          </TouchableOpacity>
      </View>

      {/* ⭐️ Privacy Control Panel (Ghost Mode) ⭐️ */}
      <View style={[
          localStyles.privacyPanel, 
          isDark ? { backgroundColor: isGhostMode ? '#2C2C2E' : '#1C1C1E', borderColor: '#333' } : (isGhostMode ? localStyles.ghostPanelActive : { backgroundColor: '#fff', borderColor: '#E5E7EB' })
      ]}>
          <View style={localStyles.privacyTextContainer}>
              <View style={localStyles.headerTitleRow}>
                <Ionicons 
                    name={isGhostMode ? "eye-off" : "eye"} 
                    size={18} 
                    color={isGhostMode ? "#888" : (brand.blue || '#007AFF')} 
                />
                <Text style={[
                    localStyles.privacyStatusText, 
                    { color: isDark ? '#fff' : '#111' },
                    isGhostMode && localStyles.ghostText
                ]}>
                    {isGhostMode ? "Ghost Mode is ON" : "You are visible to others"}
                </Text>
              </View>
              <Text style={[localStyles.privacySubtext, { color: isDark ? '#888' : '#666' }]}>
                  {isGhostMode ? "Others cannot see your live location." : "People nearby can see you on the radar."}
              </Text>
          </View>
          <Switch 
              value={isGhostMode} 
              onValueChange={toggleGhostMode}
              trackColor={{ false: isDark ? "#444" : "#D1D1D6", true: brand.blue || '#007AFF' }}
              thumbColor={Platform.OS === 'ios' ? "#fff" : (isGhostMode ? (brand.blue || '#007AFF') : "#f4f3f4")}
          />
      </View>

      <View style={[localStyles.tabsContainer, { backgroundColor: isDark ? '#1C1C1E' : '#E5E7EB' }]}>
        <TouchableOpacity 
          style={[localStyles.tab, activeTab === 'vibes' && [localStyles.activeTab, { backgroundColor: isDark ? '#333' : '#fff' }]]} 
          onPress={() => handleTabSwitch('vibes')}
          activeOpacity={0.8}
        >
          <Text style={[localStyles.tabText, { color: isDark ? '#888' : '#6B7280' }, activeTab === 'vibes' && [localStyles.activeTabText, { color: isDark ? '#fff' : '#111' }]]}>
            Live Vibes 🔥
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[localStyles.tab, activeTab === 'communities' && [localStyles.activeTab, { backgroundColor: isDark ? '#333' : '#fff' }]]} 
          onPress={() => handleTabSwitch('communities')}
          activeOpacity={0.8}
        >
          <Text style={[localStyles.tabText, { color: isDark ? '#888' : '#6B7280' }, activeTab === 'communities' && [localStyles.activeTabText, { color: isDark ? '#fff' : '#111' }]]}>
            Communities 🌍
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. REFACTOR: Enterprise FlatList implementation for seamless Geospatial scaling */}
      <FlatList 
        data={listData}
        keyExtractor={(item, index) => item?.id ? String(item.id) : `radar-item-${index}`}
        renderItem={renderItem}
        ListEmptyComponent={renderEmptyState}
        ListHeaderComponent={
          activeTab === 'vibes' && listData.length > 0 ? (
            <Text style={localStyles.privacyNotice}>
              <Ionicons name="shield-checkmark" size={12} color="#888" /> Distances are approximate for privacy.
            </Text>
          ) : null
        }
        contentContainerStyle={localStyles.scroll}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        refreshControl={
            <RefreshControl
                refreshing={isRadarLoading && listData.length > 0} 
                onRefresh={handleRefresh}
                colors={[brand.blue || '#007AFF']}
                tintColor={brand.blue || '#007AFF'}
            />
        }
      />

    </View>
  );
};

const localStyles = StyleSheet.create({
  mainContainer: { 
      flex: 1, 
      borderTopLeftRadius: 30, 
      borderTopRightRadius: 30,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -5 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 10
  },
  headerTop: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      paddingHorizontal: 20, 
      paddingTop: 20, 
      paddingBottom: 15 
  },
  headerTitleRow: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      gap: 8 
  },
  title: { 
      fontSize: 24, 
      fontWeight: '900', 
      letterSpacing: -0.5 
  },
  closeBtn: { 
      width: 36, 
      height: 36, 
      borderRadius: 18, 
      alignItems: 'center', 
      justifyContent: 'center' 
  },
  
  // ⭐️ תוספת העיצוב לפאנל הפרטיות ⭐️
  privacyPanel: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      marginHorizontal: 20, 
      padding: 15, 
      borderRadius: 20, 
      marginBottom: 15, 
      borderWidth: 1, 
      elevation: 2, 
      shadowColor: '#000', 
      shadowOpacity: 0.05, 
      shadowRadius: 10 
  },
  ghostPanelActive: { backgroundColor: '#F3F4F6', borderColor: '#D1D1D6' },
  privacyTextContainer: { flex: 1 },
  privacyStatusText: { fontSize: 15, fontWeight: '700' },
  ghostText: { color: '#666' },
  privacySubtext: { fontSize: 11, marginTop: 2 },

  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 4,
    marginBottom: 15
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeTab: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  tabText: { fontWeight: '600', fontSize: 14 },
  activeTabText: { fontWeight: '800' },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  radarPulse: {
    width: 80, height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(26, 86, 219, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26, 86, 219, 0.3)'
  },
  loadingText: { marginTop: 15, fontWeight: '600', fontSize: 15 },
  
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  privacyNotice: { fontSize: 11, color: '#888', textAlign: 'center', marginBottom: 15, fontWeight: '500' },
  
  userCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 12, borderWidth: 1, elevation: 1 },
  userAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee' },
  userInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  userName: { fontSize: 16, fontWeight: 'bold' },
  fuzzyDistance: { fontSize: 13, marginTop: 2 },
  contextBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginTop: 6, borderWidth: 1 },
  contextText: { fontSize: 10, fontWeight: '700' },
  
  waveBtn: { backgroundColor: brand.blue || '#007AFF', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  waveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  groupCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: 'bold' },
  distanceText: { color: brand.blue || '#007AFF', fontWeight: '700', fontSize: 13, marginTop: 4 },
  
  joinBtn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 10 },
  joinBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { marginTop: 15, fontSize: 16, fontWeight: 'bold' },
  emptySubtext: { marginTop: 5, fontSize: 13 }
});