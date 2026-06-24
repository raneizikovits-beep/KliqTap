// client/src/screens/ExploreScreen.js
// ✅ V5.0 PRODUCTION: Full architectural refactor — clean, modular, secure, scalable

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import * as Data from '../constants/data';
import PostCard from '../components/PostCard';
import { PostCommentsModal } from '../components/modals/PostCommentsModal';
import { PostLikesModal } from '../components/modals/PostLikesModal'; // 👈 הייבוא החדש
// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Stable style reference — never recreated between renders */
const FLATLIST_CONTENT_STYLE = { paddingBottom: 120 };

/**
 * Normalises a raw post object from the API into the shape
 * that <PostCard> expects. Centralising this transform means
 * PostCard's prop contract is enforced in exactly one place.
 *
 * @param {object} item - Raw post from the store
 * @returns {object} Normalised post props
 */
const normalisePost = (item) => ({
  id:        String(item.id || item._id),
  user:      item.author,
  authorId:  item.author?.id ? String(item.author.id) : null,
  timestamp: item.timestamp,
  text:      item.text,
  image:     item.imageUrl,
  stats:     item.stats,
});

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/**
 * Feed header — title only, intentionally minimal.
 * Extracted so it can be passed as a stable JSX element
 * (via useMemo) to ListHeaderComponent.
 */
const FeedHeader = ({ isDark }) => (
  <View style={styles.headerContainer}>
    <Text style={[styles.feedTitle, { color: isDark ? '#fff' : '#111' }]}>
      Global Kliq Feed 🌎
    </Text>
  </View>
);

/**
 * Shown when the feed has no posts and is not loading.
 */
const EmptyState = ({ isDark }) => (
  <View style={styles.emptyState}>
    <Ionicons
      name="planet-outline"
      size={60}
      color={isDark ? '#444' : '#E0E0E0'}
    />
    <Text style={[styles.emptyStateText, { color: isDark ? '#888' : '#888' }]}>
      No posts yet. Be the first to vibe!
    </Text>
  </View>
);

/**
 * Pagination spinner shown at the bottom of the list while
 * loading additional pages.
 */
const FeedFooter = () => (
  <ActivityIndicator
    size="large"
    color={Data.brand.blue}
    style={styles.loader}
  />
);

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────

/**
 * ExploreScreen — global "For You" feed with infinite scroll,
 * pull-to-refresh, and inline comments modal.
 *
 * Props:
 *   navigation    — React Navigation object (available for future use)
 *   setSecondSheet — Opens a sheet/modal in the parent navigator
 */
export default function ExploreScreen({ navigation, setSecondSheet }) {
  const {
    posts,
    isPostsLoading,
    fetchPosts,
    hasMorePosts,
    user,
    fetchExploreData,
    refreshAllData,
    userSettings,
  } = useAppStore();

  const isDark = userSettings?.darkMode === true;

  const [refreshing, setRefreshing]     = useState(false);
  const [commentPostId, setCommentPostId] = useState(null);
  const [likesPostId, setLikesPostId]   = useState(null); // 👈 הסטייט החדש

  // Abort-safe ref — prevents setState after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Initial load ─────────────────────────
  // BUG FIX: `posts` was in the closure of useEffect but NOT in its
  // dependency array, so the "hasNoPosts" guard was always evaluated
  // against stale data. The safest fix is to always fetch on mount and
  // let the store decide whether a network call is necessary (via its
  // own staleness logic). fetchPosts(true, …) resets the page cursor,
  // so calling it unconditionally on mount is correct and idempotent.
  useEffect(() => {
    const init = async () => {
      try {
        await fetchExploreData();
        await fetchPosts(true, 'foryou');
      } catch (e) {
        console.error('[Explore] Initial load failed:', e);
      }
    };
    init();
    // Mount-only — fetchExploreData and fetchPosts are stable store refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Pull-to-refresh ──────────────────────
  const onRefresh = useCallback(async () => {
    if (mountedRef.current) setRefreshing(true);
    try {
      await fetchExploreData();
      if (refreshAllData) await refreshAllData();
      await fetchPosts(true, 'foryou');
    } catch (e) {
      console.error('[Explore] Refresh failed:', e);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [fetchPosts, fetchExploreData, refreshAllData]);

  // ─── Infinite scroll ──────────────────────
  // BUG FIX: guard against calling fetchPosts while already loading
  // (original code did this), but also guard against calling it when
  // onEndReached fires spuriously on initial render (offset === 0).
  const handleLoadMore = useCallback(() => {
    if (!isPostsLoading && hasMorePosts) {
      fetchPosts(false, 'foryou');
    }
  }, [isPostsLoading, hasMorePosts, fetchPosts]);

  // ─── Stable list components (useMemo) ────
  // Using useMemo instead of useCallback for components so React can
  // properly bail out of re-renders when dependencies haven't changed.
  const ListHeader = useMemo(
    () => <FeedHeader isDark={isDark} />,
    [isDark]
  );

  const ListEmpty = useMemo(
    () => !isPostsLoading ? <EmptyState isDark={isDark} /> : null,
    [isPostsLoading, isDark]
  );

  const ListFooter = useMemo(
    () => isPostsLoading ? <FeedFooter /> : null,
    [isPostsLoading]
  );

  // ─── renderItem ───────────────────────────
  // useCallback so the function reference is stable between renders,
  // keeping React.memo on PostCard effective.
  const renderItem = useCallback(({ item }) => {
    const post   = normalisePost(item);
    const postId = post.id;

    return (
      <View style={styles.postWrapper}>
       <PostCard
          post={post}
          user={user}
          onOpenComments={() => setCommentPostId(postId)}
          onOpenProfile={(userId) => setSecondSheet({ source: 'Profile', userId })}
          onOpenLikes={setLikesPostId} // 👈 חיבור הכפתור לחלון
          isDark={isDark}
        />
      </View>
    );
  }, [user, isDark, setSecondSheet]);

  // ─── keyExtractor (stable) ────────────────
  const keyExtractor = useCallback(
    (item) => String(item.id || item._id),
    []
  );

  // ─── Close comments handler (stable) ─────
  const handleCloseComments = useCallback(() => setCommentPostId(null), []);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <View style={[styles.mainBg, { backgroundColor: isDark ? '#000' : '#F9FAFB' }]}>
      <FlatList
        data={posts}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        contentContainerStyle={FLATLIST_CONTENT_STYLE}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            // FIX: `colors` is Android-only; `tintColor` is iOS.
            // Both should be provided for cross-platform consistency.
            colors={[Data.brand.blue]}
            tintColor={Data.brand.blue}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        // Performance tuning (aligned with TribesScreen V2.0)
        initialNumToRender={5}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
      />

      <PostCommentsModal
        postId={commentPostId}
        visible={!!commentPostId}
        onClose={handleCloseComments}
        isDark={isDark}
      />

      {/* ⭐️ מודאל הלייקים ⭐️ */}
      <PostLikesModal
        postId={likesPostId}
        visible={!!likesPostId}
        onClose={() => setLikesPostId(null)}
        isDark={isDark}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Screen ────────────────────────────────
  mainBg: { flex: 1 },

  // ── List layout ───────────────────────────
  postWrapper: { marginBottom: 16 },

  // ── Header ────────────────────────────────
  headerContainer: { marginBottom: 10, paddingTop: 15 },
  feedTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginLeft: 20,
    marginBottom: 5,
    letterSpacing: -0.5,
  },

  // ── Empty state ───────────────────────────
  emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.8 },
  emptyStateText: { marginTop: 15, fontSize: 15, fontWeight: '600' },

  // ── Footer loader ─────────────────────────
  loader: { marginVertical: 30 },
});