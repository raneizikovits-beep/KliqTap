// client/src/screens/ExploreScreen.js
// ⭐️ V4.2 SMART MINIMAL: Clean UI with Full Logic Restoration ⭐️

import React, { useState, useCallback, useEffect } from 'react';
import { 
    View, Text, ActivityIndicator, 
    StyleSheet, RefreshControl,
    FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore'; 
import * as Data from '../constants/data';
import PostCard from '../components/PostCard'; 
import { PostCommentsModal } from '../components/modals/PostCommentsModal'; 

// ⭐️ הוספנו חזרה את ה-navigation וה-setSecondSheet כפרופס
export default function ExploreScreen({ navigation, setSecondSheet }) {
    const { 
        posts, isPostsLoading, fetchPosts, hasMorePosts, user,
        fetchExploreData, refreshAllData, userSettings 
    } = useAppStore();
    
    const isDark = userSettings?.darkMode === true;

    const [refreshing, setRefreshing] = useState(false);
    const [commentPostId, setCommentPostId] = useState(null);

    useEffect(() => {
        // ⭐️ החזרנו את טעינת נתוני האקספלור הכלליים
        fetchExploreData(); 
        const hasNoPosts = !posts || posts.length === 0;
        if (hasNoPosts) {
            fetchPosts(true, 'foryou'); 
        }
    }, [fetchExploreData]); 

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            // ⭐️ רענון של כל הנתונים, לא רק הפוסטים
            await fetchExploreData();
            if (refreshAllData) await refreshAllData();
            await fetchPosts(true, 'foryou'); 
        } finally {
            setRefreshing(false);
        }
    }, [fetchPosts, fetchExploreData, refreshAllData]);

    const handleLoadMore = useCallback(() => {
        if (!isPostsLoading && hasMorePosts) {
            fetchPosts(false, 'foryou');
        }
    }, [isPostsLoading, hasMorePosts, fetchPosts]);
    
    const renderHeader = useCallback(() => (
        <View style={localStyles.headerContainer}>
            <Text style={[localStyles.feedTitle, { color: isDark ? '#fff' : '#111' }]}>Global Feed 🌎</Text>
        </View>
    ), [isDark]);

    const renderPost = useCallback(({ item }) => {
        const postId = String(item.id || item._id); 
        return (
            <View style={localStyles.postWrapper}>
                <PostCard 
                    post={{
                        id: postId, user: item.author, authorId: item.author?.id ? String(item.author.id) : null,
                        timestamp: item.timestamp, text: item.text, image: item.imageUrl, stats: item.stats
                    }}
                    user={user}
                    onOpenComments={() => setCommentPostId(postId)} 
                    // ⭐️ מאפשר לפוסט לפתוח פרופילים דרך ה-setSecondSheet
                    onOpenProfile={(userId) => setSecondSheet({ source: "Profile", userId })}
                    isDark={isDark} 
                />
            </View>
        );
    }, [user, isDark, setSecondSheet]);

    const renderEmptyState = useCallback(() => (
        !isPostsLoading ? (
            <View style={localStyles.emptyState}>
                <Ionicons name="planet-outline" size={60} color={isDark ? '#444' : "#E0E0E0"} />
                <Text style={[localStyles.emptyStateText, { color: isDark ? '#888' : '#888' }]}>No posts yet. Be the first to vibe!</Text>
            </View>
        ) : null
    ), [isPostsLoading, isDark]);

    const renderFooter = useCallback(() => (
        isPostsLoading ? <ActivityIndicator size="large" color={Data.brand.blue} style={localStyles.loader} /> : null
    ), [isPostsLoading]);

    return (
        <View style={[localStyles.mainBg, { backgroundColor: isDark ? '#000' : '#F9FAFB' }]}>
            <FlatList
                data={posts}
                keyExtractor={(item) => String(item.id || item._id)}
                renderItem={renderPost}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={renderEmptyState}
                ListFooterComponent={renderFooter}
                contentContainerStyle={localStyles.flatListContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Data.brand.blue]} />}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                showsVerticalScrollIndicator={false}
                // שיפור ביצועים לגלילה חלקה
                initialNumToRender={5}
                maxToRenderPerBatch={10}
                windowSize={5}
            />

            <PostCommentsModal 
                postId={commentPostId} 
                visible={!!commentPostId} 
                onClose={() => setCommentPostId(null)} 
            />
        </View>
    );
}

const localStyles = StyleSheet.create({
    mainBg: { flex: 1 },
    flatListContent: { paddingBottom: 120 },
    headerContainer: { marginBottom: 10, paddingTop: 15 },
    feedTitle: { fontSize: 24, fontWeight: '900', marginLeft: 20, marginBottom: 5, letterSpacing: -0.5 },
    postWrapper: { marginBottom: 16 },
    emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.8 },
    emptyStateText: { marginTop: 15, fontSize: 15, fontWeight: '600' },
    loader: { marginVertical: 30 }
});