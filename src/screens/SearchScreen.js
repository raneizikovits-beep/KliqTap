// client/src/screens/SearchScreen.js
// ⭐️ V6.3 FULL DARK MODE + SMART PROFILE PEEK INTEGRATION ⭐️
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  TextInput, Dimensions, ActivityIndicator, Image, Keyboard, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles as globalStyles } from '../constants/styles';
import * as Data from '../constants/data'; 
import { useAppStore } from '../store/useAppStore'; 

const { width } = Dimensions.get('window');

const TRENDING_TAGS = [
    { id: 't1', label: '#MentalHealth', color: '#E3F2FD', text: '#1565C0' },
    { id: 't2', label: '#GymMotivation', color: '#F3E5F5', text: '#7B1FA2' },
    { id: 't3', label: '#Photography', color: '#E0F2F1', text: '#00695C' },
    { id: 't4', label: '#Meditation', color: '#FFF3E0', text: '#E65100' },
    { id: 't5', label: '#TechTalk', color: '#ECEFF1', text: '#37474F' },
];

const CATEGORIES = [
    { id: 'people', label: 'People', icon: 'people', color: '#FF6B6B', bg: '#FFEBEE' },
    { id: 'groups', label: 'Groups', icon: 'globe', color: '#4ECDC4', bg: '#E0F2F1' },
    { id: 'posts', label: 'Posts', icon: 'images', color: '#45B7D1', bg: '#E1F5FE' },
    { id: 'events', label: 'Events', icon: 'calendar', color: '#96CEB4', bg: '#E8F5E9' },
];

// Data Normalizer: Extracts and standardizes API data
const normalizeResultItem = (rawItem) => {
    const data = rawItem?.data || rawItem || {};
    const isUser = !!(data.username || data.type === 'user');
    const isGroup = !!(data.memberCount !== undefined || data.type === 'group' || data.category);
    
    return {
        id: data.id || data._id || Math.random().toString(), 
        type: isUser ? 'user' : isGroup ? 'group' : 'unknown',
        title: data.name || data.username || data.title || 'Unknown',
        subTitle: data.username ? `@${data.username}` : (data.description || data.body || ''),
        image: data.avatarUrl || data.imageUrl || data.image || data.avatar || null,
        originalData: data,
        isUser,
        isGroup
    };
};

export default function SearchScreen({ onClose, onNavigate }) {
  
  // ⭐️ משכנו את fetchProfilePreview במקום setProfilePeekUser כדי להביא נתונים אמיתיים
  const performSearch = useAppStore(state => state.performSearch);
  const searchItemsData = useAppStore(state => state.searchItemsData);
  const isSearchLoading = useAppStore(state => state.isSearchLoading);
  const fetchProfilePreview = useAppStore(state => state.fetchProfilePreview); 
  const userSettings = useAppStore(state => state.userSettings); 
  
  const isDark = userSettings?.darkMode === true; 

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  
  const [recentSearches, setRecentSearches] = useState([
    "Yoga groups nearby", "Photography tips", "John Doe", "Hiking trails"
  ]);

  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Robust Debounce Implementation
  useEffect(() => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      
      debounceTimerRef.current = setTimeout(() => {
          if (query.trim().length > 1 && performSearch) {
              performSearch(query.trim());
          }
      }, 400); 

      return () => clearTimeout(debounceTimerRef.current);
  }, [query, performSearch]);

  const handleTagPress = useCallback((tag) => {
      setQuery(tag.replace('#', '')); 
      setActiveCategory('all');
  }, []);

  const handleCategoryPress = useCallback((catId) => {
      setActiveCategory(catId);
      searchInputRef.current?.focus();
  }, []);

  const clearSearch = useCallback(() => {
      setQuery('');
      setActiveCategory('all');
      Keyboard.dismiss();
  }, []);

  const clearAllRecent = useCallback(() => setRecentSearches([]), []);

  const deleteRecentItem = useCallback((index) => {
    setRecentSearches(prev => prev.filter((_, i) => i !== index));
  }, []);

  // UseMemo for filtering to avoid recalculating on every render
  const filteredResults = useMemo(() => {
      const results = searchItemsData?.Search || searchItemsData || [];
      let dataArray = Array.isArray(results) ? results : [...(results.users || []), ...(results.groups || [])];

      return dataArray
          .map(normalizeResultItem)
          .filter(item => {
              if (activeCategory === 'all') return true;
              if (activeCategory === 'people') return item.isUser;
              if (activeCategory === 'groups') return item.isGroup;
              return true;
          });
  }, [searchItemsData, activeCategory]);

 const renderResultItem = useCallback(({ item }) => {
      const handlePress = () => {
          Keyboard.dismiss();
          if (item.isUser) { 
              fetchProfilePreview(item.id); 
          } else if (item.isGroup && onNavigate) {
              onNavigate({ source: "GroupDetails", group: item.originalData });
          } else if (onNavigate) {
              onNavigate(item.originalData);
          }
      };

      return (
          <TouchableOpacity 
            style={[localStyles.resultItem, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#f0f0f0' }]} 
            onPress={handlePress} 
            activeOpacity={0.7}
          >
              <View style={[localStyles.resultIcon, { backgroundColor: isDark ? '#333' : '#F5F5F5' }]}>
                  {item.image ? (
                      <Image source={{ uri: item.image }} style={localStyles.avatarImage} />
                  ) : (
                      /* 🎨 עיצוב האות הראשונה החדש - מחליף את ה-👤 */
                      <View style={{
                          width: '100%',
                          height: '100%',
                          justifyContent: 'center',
                          alignItems: 'center',
                          backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
                      }}>
                          <View style={{
                              width: '100%',
                              height: '100%',
                              backgroundColor: Data.brand.blue,
                              opacity: 0.1,
                              position: 'absolute'
                          }} />
                          <Text style={{ 
                              color: isDark ? '#FFF' : Data.brand.blue, 
                              fontWeight: '900', 
                              fontSize: 16 
                          }}>
                              {item.title ? item.title.charAt(0).toUpperCase() : (item.isGroup ? '🌍' : '?')}
                          </Text>
                      </View>
                  )}
              </View>
              <View style={localStyles.flex1}>
                  <Text style={[localStyles.resultTitle, { color: isDark ? '#fff' : '#333' }]} numberOfLines={1}>{item.title}</Text>
                  {item.subTitle ? <Text style={[localStyles.resultBody, { color: isDark ? '#aaa' : '#888' }]} numberOfLines={1}>{item.subTitle}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={isDark ? '#666' : '#ccc'} />
          </TouchableOpacity>
      );
  }, [onNavigate, fetchProfilePreview, isDark]);

  const renderResults = () => {
      if (isSearchLoading) {
          return (
              <View style={localStyles.centerState}>
                  <ActivityIndicator size="large" color={Data.brand.blue} />
                  <Text style={localStyles.loadingText}>Searching the universe...</Text>
              </View>
          );
      }

      if (filteredResults.length === 0 && query.length > 1) {
          return (
              <View style={localStyles.emptyState}>
                  <Ionicons name="search" size={50} color={isDark ? '#444' : "#ddd"} />
                  <Text style={[localStyles.emptyStateText, { color: isDark ? '#888' : '#999' }]}>No {activeCategory === 'all' ? 'results' : activeCategory} found.</Text>
              </View>
          );
      }

      return (
          <FlatList 
              data={filteredResults}
              keyExtractor={(item) => item.id}
              renderItem={renderResultItem}
              contentContainerStyle={localStyles.resultsContainer}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={<Text style={[globalStyles.h3, localStyles.resultsHeader, { color: isDark ? '#fff' : '#333' }]}>Results</Text>}
          />
      );
  };

  const renderDiscovery = () => (
      <ScrollView 
          contentContainerStyle={localStyles.discoveryScroll} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
      >
          <View style={localStyles.section}>
              <Text style={[globalStyles.h3, { color: isDark ? '#fff' : '#333' }]}>Trending Now 🔥</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={localStyles.marginTop12} keyboardShouldPersistTaps="handled">
                  {TRENDING_TAGS.map((tag) => (
                      <TouchableOpacity key={tag.id} style={[localStyles.chip, { backgroundColor: isDark ? '#1C1C1E' : tag.color, borderWidth: isDark ? 1 : 0, borderColor: '#333' }]} onPress={() => handleTagPress(tag.label)}>
                          <Text style={[localStyles.chipText, { color: isDark ? tag.color : tag.text }]}>{tag.label}</Text>
                      </TouchableOpacity>
                  ))}
              </ScrollView>
          </View>

          <View style={localStyles.section}>
              <Text style={[globalStyles.h3, { color: isDark ? '#fff' : '#333' }]}>Browse Categories</Text>
              <View style={localStyles.gridContainer}>
                  {CATEGORIES.map((cat) => (
                      <TouchableOpacity key={cat.id} style={[localStyles.catCard, { backgroundColor: isDark ? '#1C1C1E' : cat.bg, borderWidth: isDark ? 1 : 0, borderColor: '#333' }]} onPress={() => handleCategoryPress(cat.id)}>
                          <Ionicons name={cat.icon} size={28} color={cat.color} />
                          <Text style={[localStyles.catLabel, { color: cat.color }]}>{cat.label}</Text>
                      </TouchableOpacity>
                  ))}
              </View>
          </View>

          {recentSearches.length > 0 && (
            <View style={localStyles.section}>
                <View style={localStyles.recentHeader}>
                    <Text style={[globalStyles.h3, { color: isDark ? '#fff' : '#333' }]}>Recent</Text>
                    <TouchableOpacity onPress={clearAllRecent} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={localStyles.clearAllText}>Clear All</Text>
                    </TouchableOpacity>
                </View>
                {recentSearches.map((term, i) => (
                    <TouchableOpacity key={`recent-${i}`} style={[localStyles.recentItem, { borderBottomColor: isDark ? '#333' : '#f0f0f0' }]} onPress={() => setQuery(term)}>
                        <Ionicons name="time-outline" size={20} color={isDark ? '#888' : "#999"} />
                        <Text style={[localStyles.recentText, { color: isDark ? '#ddd' : '#555' }]}>{term}</Text>
                        <TouchableOpacity style={localStyles.padding5} onPress={() => deleteRecentItem(i)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={16} color={isDark ? '#666' : "#ccc"} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                ))}
            </View>
          )}
      </ScrollView>
  );

  let placeholderText = "Discover people, groups...";
  if (activeCategory === 'people') placeholderText = "Search for people...";
  if (activeCategory === 'groups') placeholderText = "Search for groups...";
  
  return (
    <View style={[localStyles.mainContainer, { backgroundColor: isDark ? '#000' : '#F9FAFB' }]}>
        <View style={localStyles.headerTop}>
            <View style={localStyles.headerTitleRow}>
                <Ionicons name="compass" size={26} color={Data.brand.blue} />
                <Text style={[localStyles.title, { color: isDark ? '#fff' : '#111' }]}>Discover</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[localStyles.closeBtn, { backgroundColor: isDark ? '#333' : '#eee' }]} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={isDark ? '#ccc' : "#666"} />
            </TouchableOpacity>
        </View>

        <View style={localStyles.header}>
            <View style={[localStyles.searchBox, { backgroundColor: isDark ? '#1C1C1E' : '#e9ecef' }]}>
                <Ionicons name="search" size={20} color={isDark ? '#888' : "#999"} />
                <TextInput 
                    ref={searchInputRef}
                    style={[localStyles.input, { color: isDark ? '#fff' : '#333' }]}
                    placeholder={placeholderText}
                    placeholderTextColor={isDark ? '#888' : "#999"}
                    value={query}
                    onChangeText={setQuery}
                    autoFocus={false}
                    returnKeyType="search"
                    autoCorrect={false}
                />
                {(query.length > 0 || activeCategory !== 'all') && (
                    <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close-circle" size={18} color={isDark ? '#666' : "#ccc"} />
                    </TouchableOpacity>
                )}
            </View>

            {(query.length > 0 || activeCategory !== 'all') && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={localStyles.filterBar} keyboardShouldPersistTaps="handled">
                    <TouchableOpacity 
                        style={[localStyles.filterPill, { backgroundColor: isDark ? '#1C1C1E' : '#F5F5F5', borderColor: isDark ? '#333' : '#eee' }, activeCategory === 'all' && [localStyles.filterPillActive, { backgroundColor: isDark ? '#fff' : Data.brand.ink }]]}
                        onPress={() => setActiveCategory('all')}
                    >
                        <Text style={[localStyles.filterText, { color: isDark ? '#aaa' : '#666' }, activeCategory === 'all' && [localStyles.filterTextActive, { color: isDark ? '#000' : '#fff' }]]}>All</Text>
                    </TouchableOpacity>
                    {CATEGORIES.map(cat => (
                        <TouchableOpacity 
                            key={cat.id} 
                            style={[localStyles.filterPill, { backgroundColor: isDark ? '#1C1C1E' : '#F5F5F5', borderColor: isDark ? '#333' : '#eee' }, activeCategory === cat.id && [localStyles.filterPillActive, { backgroundColor: isDark ? '#fff' : Data.brand.ink }]]}
                            onPress={() => setActiveCategory(cat.id)}
                        >
                            <Text style={[localStyles.filterText, { color: isDark ? '#aaa' : '#666' }, activeCategory === cat.id && [localStyles.filterTextActive, { color: isDark ? '#000' : '#fff' }]]}>{cat.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>

        {(query.trim().length > 1 || activeCategory !== 'all') ? renderResults() : renderDiscovery()}
    </View>
  );
}

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
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  
  header: { paddingBottom: 10, marginBottom: 5, paddingHorizontal: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, height: 50 },
  input: { flex: 1, marginLeft: 10, fontSize: 16, height: '100%', textAlign: 'left' },
  filterBar: { marginTop: 15, flexDirection: 'row' },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1 },
  filterPillActive: { },
  filterText: { fontWeight: '600', fontSize: 13 },
  filterTextActive: { },
  section: { marginTop: 24 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  chipText: { fontWeight: '600' },
  marginTop12: { marginTop: 12 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 },
  catCard: { width: (width - 60) / 2, height: 90, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  catLabel: { marginTop: 8, fontWeight: 'bold', fontSize: 14 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearAllText: { color: Data.brand?.blue || '#007BFF', fontSize: 12 },
  recentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  recentText: { flex: 1, marginLeft: 12, fontSize: 15, textAlign: 'left' },
  padding5: { padding: 5 },
  resultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, elevation: 1 },
  resultIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' }, 
  avatarImage: { width: '100%', height: '100%', borderRadius: 20 }, 
  resultIconText: { fontSize: 20 },
  flex1: { flex: 1 },
  resultTitle: { fontWeight: 'bold', fontSize: 16, textAlign: 'left' },
  resultBody: { fontSize: 13, textAlign: 'left', marginTop: 2 },
  centerState: { marginTop: 50, alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#999' },
  emptyState: { marginTop: 50, alignItems: 'center', opacity: 0.6 },
  emptyStateText: { marginTop: 10, fontSize: 16 },
  resultsContainer: { paddingBottom: 100, paddingHorizontal: 20 },
  resultsHeader: { marginVertical: 15, textAlign: 'left' },
  discoveryScroll: { paddingBottom: 100, paddingHorizontal: 20 }
});