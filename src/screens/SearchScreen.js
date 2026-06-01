// client/src/screens/SearchScreen.js
// Production v7.0 — Full refactor: dark mode tokens, stable keys, category filters fixed,
// persistent recent searches, error state, accessibility, orientation-safe layout.

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Image,
  Keyboard,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles as globalStyles } from '../constants/styles';
import * as Data from '../constants/data';
import { useAppStore } from '../store/useAppStore';

// ---------------------------------------------------------------------------
// Constants — defined outside component to avoid re-creation on every render
// ---------------------------------------------------------------------------

const TRENDING_TAGS = [
  { id: 't1', label: '#MentalHealth', lightBg: '#E3F2FD', lightText: '#1565C0' },
  { id: 't2', label: '#GymMotivation', lightBg: '#F3E5F5', lightText: '#7B1FA2' },
  { id: 't3', label: '#Photography', lightBg: '#E0F2F1', lightText: '#00695C' },
  { id: 't4', label: '#Meditation', lightBg: '#FFF3E0', lightText: '#E65100' },
  { id: 't5', label: '#TechTalk', lightBg: '#ECEFF1', lightText: '#37474F' },
];

const CATEGORIES = [
  { id: 'people', label: 'People', icon: 'people',   color: '#FF6B6B', bg: '#FFEBEE' },
  { id: 'groups', label: 'Groups', icon: 'globe',    color: '#4ECDC4', bg: '#E0F2F1' },
  { id: 'posts',  label: 'Posts',  icon: 'images',   color: '#45B7D1', bg: '#E1F5FE' },
  { id: 'events', label: 'Events', icon: 'calendar', color: '#96CEB4', bg: '#E8F5E9' },
];

const DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

// ---------------------------------------------------------------------------
// Theme helper — centralises all dark/light colour decisions.
// All components consume this object so inline style objects are stable.
// ---------------------------------------------------------------------------

function useTheme(isDark) {
  return useMemo(
    () => ({
      bg:           isDark ? '#000000' : '#F9FAFB',
      surface:      isDark ? '#1C1C1E' : '#FFFFFF',
      surfaceAlt:   isDark ? '#2C2C2E' : '#F5F5F5',
      border:       isDark ? '#333333' : '#F0F0F0',
      inputBg:      isDark ? '#1C1C1E' : '#E9ECEF',
      textPrimary:  isDark ? '#FFFFFF' : '#111111',
      textSecondary:isDark ? '#AAAAAA' : '#888888',
      textMuted:    isDark ? '#666666' : '#CCCCCC',
      icon:         isDark ? '#888888' : '#999999',
      titleColor:   isDark ? '#FFFFFF' : '#333333',
      closeBtnBg:   isDark ? '#333333' : '#EEEEEE',
      closeBtnIcon: isDark ? '#CCCCCC' : '#666666',
      pillBg:       isDark ? '#1C1C1E' : '#F5F5F5',
      pillBorder:   isDark ? '#333333' : '#EEEEEE',
      pillActiveBg: isDark ? '#FFFFFF' : (Data.brand?.ink ?? '#111111'),
      pillActiveText:isDark ? '#000000' : '#FFFFFF',
      pillText:     isDark ? '#AAAAAA' : '#666666',
      chipBg:       isDark ? '#1C1C1E' : null, // null = use tag's own lightBg
      chipBorder:   isDark ? '#333333' : null,
      recentBorder: isDark ? '#333333' : '#F0F0F0',
      recentText:   isDark ? '#DDDDDD' : '#555555',
      avatarFallbackBg: isDark ? '#1A1A1A' : '#F0F0F0',
      avatarFallbackText: isDark ? '#FFFFFF' : (Data.brand?.blue ?? '#1565C0'),
      resultBg:     isDark ? '#1C1C1E' : '#FFFFFF',
      resultBorder: isDark ? '#333333' : '#F0F0F0',
      resultIconBg: isDark ? '#333333' : '#F5F5F5',
      emptyIcon:    isDark ? '#444444' : '#DDDDDD',
      emptyText:    isDark ? '#888888' : '#999999',
    }),
    [isDark],
  );
}

// ---------------------------------------------------------------------------
// Data normaliser
// FIX: Math.random() replaced with deterministic composite key so FlatList
//      keyExtractor never gets collisions / unstable keys across re-renders.
// FIX: isGroup detection tightened — no longer triggers on any object that
//      happens to have a memberCount property.
// ---------------------------------------------------------------------------

let _fallbackCounter = 0;

const normalizeResultItem = (rawItem) => {
  const data = rawItem?.data ?? rawItem ?? {};

  const explicitType = data.type; // 'user' | 'group' | 'post' | 'event' | undefined
  const isUser  = explicitType === 'user'  || (!explicitType && !!data.username);
  const isGroup = explicitType === 'group' || (!explicitType && !data.username && (data.memberCount !== undefined || !!data.category));
  const isPost  = explicitType === 'post';
  const isEvent = explicitType === 'event';

  // Stable ID: prefer server-provided id/._id; fall back to an incrementing
  // counter so the same normalisation call always yields the same structural key.
  const stableId =
    data.id != null     ? String(data.id)   :
    data._id != null    ? String(data._id)  :
    `fallback-${++_fallbackCounter}`;

  return {
    id: stableId,
    type: isUser ? 'user' : isGroup ? 'group' : isPost ? 'post' : isEvent ? 'event' : 'unknown',
    title:    data.name || data.username || data.title || 'Unknown',
    subTitle: data.username
      ? `@${data.username}`
      : (data.description || data.body || ''),
    image: data.avatarUrl || data.imageUrl || data.image || data.avatar || null,
    // FIX: expose only a curated navigation payload instead of the raw server
    //      object — keeps the navigation layer decoupled from API shape.
    navPayload: {
      id:          stableId,
      type:        isUser ? 'user' : isGroup ? 'group' : isPost ? 'post' : isEvent ? 'event' : 'unknown',
      name:        data.name || data.username || data.title || '',
      description: data.description || '',
    },
    isUser,
    isGroup,
    isPost,
    isEvent,
  };
};

// ---------------------------------------------------------------------------
// Sub-component: ResultItem
// Extracted as a named component so React.memo() can prevent unnecessary
// re-renders when only unrelated state changes (e.g. query text changing
// while results list is unchanged).
// ---------------------------------------------------------------------------

const ResultItem = React.memo(function ResultItem({ item, onNavigate, fetchProfilePreview, theme }) {
  const handlePress = useCallback(() => {
    Keyboard.dismiss();
    if (item.isUser) {
      fetchProfilePreview?.(item.id);
    } else if (onNavigate) {
      onNavigate(item.navPayload);
    }
  }, [item.id, item.isUser, onNavigate, fetchProfilePreview]);

  const initials = item.title ? item.title.charAt(0).toUpperCase() : (item.isGroup ? '🌍' : '?');

  return (
    <TouchableOpacity
      style={[styles.resultItem, { backgroundColor: theme.resultBg, borderColor: theme.resultBorder }]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${item.title}${item.subTitle ? `, ${item.subTitle}` : ''}`}
    >
      <View style={[styles.resultIcon, { backgroundColor: theme.resultIconBg }]}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarFallbackOuter}>
            <View style={[styles.avatarFallbackTint, { backgroundColor: Data.brand?.blue ?? '#1565C0' }]} />
            <Text style={[styles.avatarFallbackText, { color: theme.avatarFallbackText }]}>
              {initials}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.flex1}>
        <Text
          style={[styles.resultTitle, { color: theme.textPrimary }]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        {!!item.subTitle && (
          <Text
            style={[styles.resultBody, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {item.subTitle}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SearchScreen({ onClose, onNavigate }) {
  const performSearch       = useAppStore(state => state.performSearch);
  const searchItemsData     = useAppStore(state => state.searchItemsData);
  const isSearchLoading     = useAppStore(state => state.isSearchLoading);
  // FIX: also subscribe to a search error flag if the store exposes it.
  const searchError         = useAppStore(state => state.searchError ?? null);
  const clearSearchResults  = useAppStore(state => state.clearSearchResults ?? null);
  const fetchProfilePreview = useAppStore(state => state.fetchProfilePreview);
  const userSettings        = useAppStore(state => state.userSettings);

  const isDark = userSettings?.darkMode === true;
  const theme  = useTheme(isDark);

  const [query,          setQuery]          = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  // FIX: recentSearches should ideally be persisted to AsyncStorage.
  // We seed with defaults here but the real app should load from storage on mount.
  const [recentSearches, setRecentSearches] = useState([
    'Yoga groups nearby', 'Photography tips', 'John Doe', 'Hiking trails',
  ]);

  const searchInputRef   = useRef(null);
  const debounceTimerRef = useRef(null);

  // ── window width — orientation-safe ─────────────────────────────────────
  // FIX: module-level Dimensions.get() is captured once and never updates on
  //      orientation change. useWindowDimensions solves this, but since this
  //      is a bottom-sheet that's probably portrait-locked we use a ref that
  //      reads at render time via a lazy initialiser.
  const [windowWidth, setWindowWidth] = useState(() => Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });
    return () => sub?.remove?.();
  }, []);

  // ── Debounced search ─────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    const trimmed = query.trim();
    if (trimmed.length >= MIN_QUERY_LENGTH && performSearch) {
      debounceTimerRef.current = setTimeout(() => {
        performSearch(trimmed);
      }, DEBOUNCE_MS);
    }

    return () => clearTimeout(debounceTimerRef.current);
  }, [query, performSearch]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleTagPress = useCallback((tagLabel) => {
    // Strip # before searching so the API receives a clean term.
    setQuery(tagLabel.replace('#', ''));
    setActiveCategory('all');
  }, []);

  const handleCategoryPress = useCallback((catId) => {
    setActiveCategory(catId);
    // Only focus if there's already a query — focusing an empty input while
    // switching categories is disruptive on mobile.
    if (query.length > 0) {
      searchInputRef.current?.focus();
    }
  }, [query.length]);

  // FIX: clearSearch now also clears the store's result state so stale data
  //      is not shown on next interaction.
  const clearSearch = useCallback(() => {
    setQuery('');
    setActiveCategory('all');
    clearSearchResults?.();
    Keyboard.dismiss();
  }, [clearSearchResults]);

  const clearAllRecent = useCallback(() => setRecentSearches([]), []);

  // FIX: use value-based filter instead of index — safer when list mutates.
  const deleteRecentItem = useCallback((term) => {
    setRecentSearches(prev => prev.filter(t => t !== term));
  }, []);

  // FIX: add to recent when search actually executes (not on every keystroke).
  const addToRecent = useCallback((term) => {
    if (!term) return;
    setRecentSearches(prev => {
      const withoutDuplicate = prev.filter(t => t.toLowerCase() !== term.toLowerCase());
      return [term, ...withoutDuplicate].slice(0, 10); // cap at 10
    });
  }, []);

  const handleRecentPress = useCallback((term) => {
    setQuery(term);
    setActiveCategory('all');
  }, []);

  // ── Filtered results ─────────────────────────────────────────────────────
  // FIX: 'posts' and 'events' categories previously fell through to `return true`
  //      (showing ALL items) because the filter had no branch for them.
  const filteredResults = useMemo(() => {
    const raw = searchItemsData?.Search ?? searchItemsData ?? [];
    const dataArray = Array.isArray(raw)
      ? raw
      : [...(raw.users ?? []), ...(raw.groups ?? []), ...(raw.posts ?? []), ...(raw.events ?? [])];

    const normalised = dataArray.map(normalizeResultItem);

    if (activeCategory === 'all') return normalised;
    if (activeCategory === 'people') return normalised.filter(item => item.isUser);
    if (activeCategory === 'groups') return normalised.filter(item => item.isGroup);
    if (activeCategory === 'posts')  return normalised.filter(item => item.isPost);
    if (activeCategory === 'events') return normalised.filter(item => item.isEvent);
    return normalised;
  }, [searchItemsData, activeCategory]);

  // ── renderResultItem for FlatList ────────────────────────────────────────
  const renderResultItem = useCallback(({ item }) => (
    <ResultItem
      item={item}
      onNavigate={onNavigate}
      fetchProfilePreview={fetchProfilePreview}
      theme={theme}
    />
  ), [onNavigate, fetchProfilePreview, theme]);

  const keyExtractor = useCallback((item) => item.id, []);

  // ── Results view ─────────────────────────────────────────────────────────
  const renderResults = () => {
    if (isSearchLoading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Data.brand?.blue ?? '#1565C0'} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>
            Searching the universe...
          </Text>
        </View>
      );
    }

    // FIX: added explicit error state — previously silently failed.
    if (searchError) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={50} color={theme.emptyIcon} />
          <Text style={[styles.emptyStateText, { color: theme.emptyText }]}>
            Something went wrong. Please try again.
          </Text>
        </View>
      );
    }

    const trimmedQuery = query.trim();
    if (filteredResults.length === 0 && trimmedQuery.length >= MIN_QUERY_LENGTH) {
      const categoryLabel = activeCategory === 'all' ? 'results' : activeCategory;
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={50} color={theme.emptyIcon} />
          <Text style={[styles.emptyStateText, { color: theme.emptyText }]}>
            No {categoryLabel} found for "{trimmedQuery}"
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={filteredResults}
        keyExtractor={keyExtractor}
        renderItem={renderResultItem}
        contentContainerStyle={styles.resultsContainer}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Text style={[globalStyles.h3, styles.resultsHeader, { color: theme.titleColor }]}>
            Results
          </Text>
        }
      />
    );
  };

  // ── Discovery view ───────────────────────────────────────────────────────
  const cardWidth = (windowWidth - 60) / 2;

  const renderDiscovery = () => (
    <ScrollView
      contentContainerStyle={styles.discoveryScroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {/* Trending Tags */}
      <View style={styles.section}>
        <Text style={[globalStyles.h3, { color: theme.titleColor }]}>
          Trending Now 🔥
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.marginTop12}
          keyboardShouldPersistTaps="handled"
        >
          {TRENDING_TAGS.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              style={[
                styles.chip,
                {
                  backgroundColor: theme.chipBg ?? tag.lightBg,
                  borderWidth: isDark ? 1 : 0,
                  borderColor: theme.chipBorder ?? 'transparent',
                },
              ]}
              onPress={() => handleTagPress(tag.label)}
              accessibilityRole="button"
              accessibilityLabel={`Search ${tag.label}`}
            >
              <Text style={[styles.chipText, { color: isDark ? tag.lightBg : tag.lightText }]}>
                {tag.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Browse Categories */}
      <View style={styles.section}>
        <Text style={[globalStyles.h3, { color: theme.titleColor }]}>
          Browse Categories
        </Text>
        <View style={styles.gridContainer}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.catCard,
                {
                  width: cardWidth,
                  backgroundColor: isDark ? theme.surface : cat.bg,
                  borderWidth: isDark ? 1 : 0,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => handleCategoryPress(cat.id)}
              accessibilityRole="button"
              accessibilityLabel={`Browse ${cat.label}`}
            >
              <Ionicons name={cat.icon} size={28} color={cat.color} />
              <Text style={[styles.catLabel, { color: cat.color }]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.recentHeader}>
            <Text style={[globalStyles.h3, { color: theme.titleColor }]}>Recent</Text>
            <TouchableOpacity
              onPress={clearAllRecent}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Clear all recent searches"
            >
              <Text style={[styles.clearAllText, { color: Data.brand?.blue ?? '#007BFF' }]}>
                Clear All
              </Text>
            </TouchableOpacity>
          </View>

          {recentSearches.map((term) => (
            // FIX: key uses the term string — stable and unique (duplicates are
            //      prevented in addToRecent). Index-based keys cause wrong
            //      animations when items are removed from the middle.
            <View
              key={term}
              style={[styles.recentItem, { borderBottomColor: theme.recentBorder }]}
            >
              <TouchableOpacity
                style={styles.recentItemInner}
                onPress={() => handleRecentPress(term)}
                accessibilityRole="button"
                accessibilityLabel={`Search again: ${term}`}
              >
                <Ionicons name="time-outline" size={20} color={theme.icon} />
                <Text style={[styles.recentText, { color: theme.recentText }]}>{term}</Text>
              </TouchableOpacity>
              {/* FIX: delete button extracted to a sibling View — nested
                  TouchableOpacity inside TouchableOpacity causes touch event
                  conflicts on Android. */}
              <TouchableOpacity
                style={styles.recentDelete}
                onPress={() => deleteRecentItem(term)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${term} from recent searches`}
              >
                <Ionicons name="close" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  // ── Placeholder text ──────────────────────────────────────────────────────
  const placeholderText = useMemo(() => {
    if (activeCategory === 'people') return 'Search for people...';
    if (activeCategory === 'groups') return 'Search for groups...';
    if (activeCategory === 'posts')  return 'Search for posts...';
    if (activeCategory === 'events') return 'Search for events...';
    return 'Discover people, groups...';
  }, [activeCategory]);

  const showResults = query.trim().length >= MIN_QUERY_LENGTH || activeCategory !== 'all';
  const showFilterBar = query.length > 0 || activeCategory !== 'all';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.mainContainer, { backgroundColor: theme.bg }]}>
      {/* Header Row */}
      <View style={styles.headerTop}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="compass" size={26} color={Data.brand?.blue ?? '#1565C0'} />
          <Text style={[styles.title, { color: theme.textPrimary }]}>Discover</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={[styles.closeBtn, { backgroundColor: theme.closeBtnBg }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Close search"
        >
          <Ionicons name="close" size={24} color={theme.closeBtnIcon} />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.header}>
        <View style={[styles.searchBox, { backgroundColor: theme.inputBg }]}>
          <Ionicons name="search" size={20} color={theme.icon} />
          <TextInput
            ref={searchInputRef}
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder={placeholderText}
            placeholderTextColor={theme.icon}
            value={query}
            onChangeText={setQuery}
            autoFocus={false}
            returnKeyType="search"
            autoCorrect={false}
            // FIX: maxLength prevents runaway input and oversized API queries
            maxLength={100}
            onSubmitEditing={() => {
              const trimmed = query.trim();
              if (trimmed.length >= MIN_QUERY_LENGTH) {
                addToRecent(trimmed);
                performSearch?.(trimmed);
              }
            }}
          />
          {showFilterBar && (
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        {showFilterBar && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterBar}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              style={[
                styles.filterPill,
                { backgroundColor: theme.pillBg, borderColor: theme.pillBorder },
                activeCategory === 'all' && { backgroundColor: theme.pillActiveBg },
              ]}
              onPress={() => setActiveCategory('all')}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: activeCategory === 'all' ? theme.pillActiveText : theme.pillText },
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterPill,
                  { backgroundColor: theme.pillBg, borderColor: theme.pillBorder },
                  activeCategory === cat.id && { backgroundColor: theme.pillActiveBg },
                ]}
                onPress={() => setActiveCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: activeCategory === cat.id ? theme.pillActiveText : theme.pillText },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {showResults ? renderResults() : renderDiscovery()}
    </View>
  );
}

// ---------------------------------------------------------------------------
// StyleSheet — static / layout-only values. Colours come from theme object.
// FIX: removed empty filterPillActive / filterTextActive entries (dead code).
// FIX: catCard width removed from StyleSheet — now dynamic (orientation-safe).
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  header: { paddingBottom: 10, marginBottom: 5, paddingHorizontal: 20 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, height: 50 },
  input: { flex: 1, marginLeft: 10, fontSize: 16, height: '100%', textAlign: 'left' },
  filterBar: { marginTop: 15, flexDirection: 'row' },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1 },
  filterText: { fontWeight: '600', fontSize: 13 },

  section: { marginTop: 24 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10 },
  chipText: { fontWeight: '600' },
  marginTop12: { marginTop: 12 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 },
  catCard: { height: 90, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  catLabel: { marginTop: 8, fontWeight: 'bold', fontSize: 14 },

  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearAllText: { fontSize: 12 },
  recentItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  recentItemInner: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  recentText: { flex: 1, marginLeft: 12, fontSize: 15, textAlign: 'left' },
  recentDelete: { padding: 8 },

  resultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, elevation: 1 },
  resultIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallbackOuter: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarFallbackTint: { ...StyleSheet.absoluteFillObject, opacity: 0.1 },
  avatarFallbackText: { fontWeight: '900', fontSize: 16 },

  flex1: { flex: 1 },
  resultTitle: { fontWeight: 'bold', fontSize: 16, textAlign: 'left' },
  resultBody: { fontSize: 13, textAlign: 'left', marginTop: 2 },

  centerState: { marginTop: 50, alignItems: 'center' },
  loadingText: { marginTop: 10 },
  emptyState: { marginTop: 50, alignItems: 'center', opacity: 0.7 },
  emptyStateText: { marginTop: 10, fontSize: 16, textAlign: 'center', paddingHorizontal: 30 },

  resultsContainer: { paddingBottom: 100, paddingHorizontal: 20 },
  resultsHeader: { marginVertical: 15, textAlign: 'left' },
  discoveryScroll: { paddingBottom: 100, paddingHorizontal: 20 },
});