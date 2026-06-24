// client/src/store/socialSlice.js
// ⭐️ V18.1 PRODUCTION: Added Share Tracking & Optimistic UI for Shares ⭐️
//
// שינויים מ-V18.0:
//   • repostPost מעודכן — קורא ל-SocialService.trackPostShare ומעדכן את מונה השיתופים (shares) בזמן אמת ב-UI!

import * as Location from 'expo-location';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';

import { fetchAPI } from './api';
import * as SocialService from './social.service';
import * as PulseService from './pulse.service';
import * as AIService from './aiService';

// ─────────────────────────────────────────────────────────────
// CONSTANTS — single source of truth
// ─────────────────────────────────────────────────────────────
export const VALID_VIBES = Object.freeze([
    'Normal', 'Happy', 'Focused', 'Party', 'Tired',
    'Love', 'Broken', 'Cool', 'Neutral'
]);

// ─────────────────────────────────────────────────────────────
// Slice initial state — exported for safe global reset
// ─────────────────────────────────────────────────────────────
export const socialInitialState = {
    posts: [],
    isPostsLoading: false,
    postsCursor: null,
    hasMorePosts: true,

    groups: [],
    isGroupsLoading: false,
    currentGroupPosts: [],
    isGroupPostsLoading: false,
    activeGroupDetails: null,

    notifications: [],
    isNotificationsLoading: false,

    pulses: [],
    isPulsesLoading: false,

    aiRecommendations: [],
    communityVibe: [],

    supportTickets: [],
    isSupportLoading: false,

    locationSearchResults: [],
    searchItemsData: { Search: [], Support: [] },
    isSearchLoading: false,

    postDraftText: '',
};

// ─────────────────────────────────────────────────────────────
// Toast wrapper — robust to bundler variants
// ─────────────────────────────────────────────────────────────
const safeToast = (options) => {
    try {
        if (Toast && typeof Toast.show === 'function') {
            Toast.show(options);
        } else if (Toast?.default && typeof Toast.default.show === 'function') {
            Toast.default.show(options);
        } else if (__DEV__) {
            console.warn('[SafeToast] Toast not available. Payload:', options);
        }
    } catch (error) {
        if (__DEV__) console.error('[SafeToast] Critical failure:', error);
    }
};

// ─────────────────────────────────────────────────────────────
// Normalize post.author into a consistent shape
// ─────────────────────────────────────────────────────────────
const mapPostAuthor = (post) => {
    if (!post) return null;
    const authorData = post.author || post.user || post.User || post.Profile || {};
    const finalName = authorData.name || authorData.full_name || authorData.username || 'Unknown User';
    const finalUsername = authorData.username || finalName.replace(/\s+/g, '').toLowerCase() || 'unknown';
    const authorShape = { ...authorData, name: finalName, username: finalUsername };
    return { ...post, user: authorShape, author: authorShape };
};

// ─────────────────────────────────────────────────────────────
// Slice factory
// ─────────────────────────────────────────────────────────────
const createSocialSlice = (set, get) => ({
    ...socialInitialState,

    setPostDraftText: (text) => set({ postDraftText: text }),

    connectSocket: () => {
        const { user, token, socketId } = get();
        if (!user || !token || socketId) return;
        try {
            const { chatService } = require('./chatService');
            chatService.connect(get);
        } catch (e) {
            if (__DEV__) console.error('[SocialSlice] Socket connection error:', e);
        }
    },

    disconnectSocket: () => {
        try {
            const { chatService } = require('./chatService');
            chatService.disconnect();
        } catch (e) {
            if (__DEV__) console.error('[SocialSlice] Socket disconnection error:', e);
        }
    },

    refreshAllData: () => {
        const state = get();
        if (!state.token) return;

        state.fetchPosts?.(true);
        state.fetchGroups?.();
        state.fetchAiRecommendations?.();
        state.fetchCommunityVibe?.();
        state.fetchNotifications?.();
        state.fetchActivePulses?.();
        state.detectLocation?.();
        state.fetchMyTickets?.();
        state.fetchConversations?.();
        state.fetchUserDataAndMotivation?.();
    },

    // ============================================================
    // POSTS
    // ============================================================
    fetchPosts: async (reset = false) => {
        const { hasMorePosts, isPostsLoading } = get();
        if (isPostsLoading) return;           
        if (!reset && !hasMorePosts) return;

        set({ isPostsLoading: true });
        const currentCursor = reset ? null : get().postsCursor;

        try {
            const response = await SocialService.fetchPostsFeed(20, currentCursor);
            const { posts: newPosts = [], nextCursor = null, hasMore = false } = response || {};
            const mappedNewPosts = newPosts.map(mapPostAuthor).filter(Boolean);

            set(state => ({
                posts: reset ? mappedNewPosts : [...state.posts, ...mappedNewPosts],
                postsCursor: nextCursor,
                hasMorePosts: hasMore && nextCursor != null,
                isPostsLoading: false,
            }));
        } catch (e) {
            if (__DEV__) console.warn('[SocialSlice] fetchPosts error:', e?.message);
            set({ isPostsLoading: false });
        }
    },

    createPost: async (text, groupId = null, imageUri = null) => {
        try {
            if (!text?.trim() && !imageUri) throw new Error('Post must contain text or an image.');
            const newPost = await SocialService.createPost(text, groupId, imageUri);
            const mappedNewPost = mapPostAuthor(newPost);

            if (groupId) {
                set(state => ({ currentGroupPosts: [mappedNewPost, ...state.currentGroupPosts] }));
            } else {
                set(state => {
                    const isDuplicate = state.posts.some(p => String(p.id) === String(mappedNewPost?.id));
                    return isDuplicate ? state : { posts: [mappedNewPost, ...state.posts] };
                });
            }

            get().award?.('Create Post');
            get().fetchCommunityVibe?.();
            return mappedNewPost;
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to create post.');
            throw error;
        }
    },

    toggleLike: async (postId, isUnliking = false, selectedEmoji = null) => { 
        const sid = String(postId);
        try {
            const updatedPost = isUnliking
                ? await SocialService.unlikePost(sid)
                : await SocialService.likePost(sid, selectedEmoji); 

            get().award?.(isUnliking ? 'Unlike' : 'Like');

            const updatePost = (p) => {
                if (String(p.id) !== sid) return p;
                if (updatedPost) {
                    const mapped = mapPostAuthor(updatedPost);
                    return mapped || p; 
                }
                const prev = p.stats?.likes ?? 0;
                return {
                    ...p,
                    stats: {
                        ...p.stats,
                        likes: isUnliking ? Math.max(0, prev - 1) : prev + 1,
                        myVibe: isUnliking ? null : (selectedEmoji || '❤️'), 
                    },
                };
            };

            set(state => ({
                posts:             state.posts.map(updatePost),
                currentGroupPosts: state.currentGroupPosts.map(updatePost),
            }));
        } catch (e) {
            safeToast({ type: 'error', text1: 'Error', text2: 'Could not update like status.' });
        }
    },

    // ⭐️ שידרוג השיתופים מתבצע כאן!
    repostPost: async (originalPost) => {
        try {
            const authorData = originalPost?.user || originalPost?.author || {};
            const originalAuthor = authorData.username || authorData.name || 'Unknown';
            const repostText = `🔄 Repost from @${originalAuthor}:\n\n${originalPost.text || ''}`;
            const imageUri = originalPost.image || originalPost.imageUrl || null;

            // 1. ניצור את הפוסט החדש בפיד של המשתמש
            await get().createPost(repostText, null, imageUri);

            // 2. נדווח לשרת על השיתוף כדי להעלות את המונה ולהוסיף את המשתמש לרשימה!
            if (originalPost?.id) {
                await SocialService.trackPostShare(originalPost.id);
            }

            // 3. נעדכן אופטימית את המספר ב-UI כדי שהמשתמש יראה את המונה קופץ ב-+1 מיד
            const sid = String(originalPost.id);
            const updateShareCount = (p) => {
                if (String(p.id) !== sid) return p;
                return {
                    ...p,
                    stats: {
                        ...p.stats,
                        shares: (p.stats?.shares || 0) + 1
                    }
                };
            };

            set(state => ({
                posts: state.posts.map(updateShareCount),
                pulses: state.pulses.map(updateShareCount),
                currentGroupPosts: state.currentGroupPosts.map(updateShareCount),
            }));

            safeToast({ type: 'success', text1: 'Shared!', text2: 'Post shared to your profile.' });
            return true;
        } catch (error) {
            Alert.alert('Error', 'Failed to repost.');
            return false;
        }
    },

    deletePost: async (postId) => {
        const sid = String(postId);
        const prevState = {
            posts: get().posts,
            pulses: get().pulses,
            currentGroupPosts: get().currentGroupPosts,
        };

        set(state => ({
            posts:             state.posts.filter(p => String(p.id) !== sid),
            pulses:            state.pulses.filter(p => String(p.id) !== sid),
            currentGroupPosts: state.currentGroupPosts.filter(p => String(p.id) !== sid),
        }));

        try {
            await SocialService.deletePost(sid);
        } catch (e) {
            Alert.alert('Deletion Failed', 'Could not delete post. Reverting.');
            set(prevState);
        }
    },

    editPost: async (postId, newText, newImageUri = null, shouldDeleteImage = false) => {
        const sid = String(postId);
        try {
            const updatedPost = await SocialService.editPost(sid, newText, newImageUri, shouldDeleteImage);
            const mappedUpdatedPost = mapPostAuthor(updatedPost);
            set(state => ({
                posts: state.posts.map(p => String(p.id) === sid ? mappedUpdatedPost : p),
                currentGroupPosts: state.currentGroupPosts.map(p => String(p.id) === sid ? mappedUpdatedPost : p),
            }));
            return mappedUpdatedPost;
        } catch (e) {
            Alert.alert('Edit Failed', 'Could not edit post.');
            get().fetchPosts?.(true);
            throw e;
        }
    },

    // ============================================================
    // COMMENTS 
    // ============================================================
    createComment: async (postId, text, imageUri = null, storeId = null) => {
        if ((!text || !text.trim()) && !imageUri) return false;
        const sid  = String(postId);           
        const ssid = String(storeId || postId); 

        try {
            const response = await SocialService.addComment(sid, text?.trim(), imageUri);
            if (!response) return false;

            const me = get().user;
            const optimisticComment = {
                id: response.id || response._id || `temp-${Date.now()}`,
                text: response.text || text?.trim() || '',
                imageUrl: response.imageUrl || null,
                timestamp: response.timestamp || new Date().toISOString(),
                userId: response.userId || me?.id,
                username: response.username || me?.username,
                avatar: response.avatar || me?.avatarUrl,
                ...response,
            };

            const matchId = (p) => String(p.id) === ssid || String(p.id) === sid;
            const addTo   = (arr) => arr.map(p => {
                if (!matchId(p)) return p;
                return {
                    ...p,
                    comments: [...(p.comments || []), optimisticComment],
                    stats: {
                        ...p.stats,
                        comments: (p.stats?.comments ?? (p.comments?.length ?? 0)) + 1,
                    },
                };
            });
            set(state => ({
                posts:             addTo(state.posts),
                pulses:            addTo(state.pulses),
                currentGroupPosts: addTo(state.currentGroupPosts),
            }));

            get().award?.('Comment');
            return true;
        } catch (error) {
            safeToast({ type: 'error', text1: 'Error', text2: 'Could not post the comment.' });
            if (__DEV__) console.warn('[SocialSlice] createComment error:', error?.message);
            return false;
        }
    },

    deleteComment: async (postId, commentId, storeId = null) => {
        const psid  = String(postId);
        const pssid = String(storeId || postId);
        const csid  = String(commentId);
        try {
            await SocialService.deleteComment(csid);
            const removeComment = (arr) =>
                arr.map(p => {
                    if (!(String(p.id) === pssid || String(p.id) === psid)) return p;
                    return {
                        ...p,
                        comments: (p.comments || []).filter(c => String(c.id) !== csid),
                        stats: {
                            ...p.stats,
                            comments: Math.max(0, (p.stats?.comments ?? (p.comments?.length ?? 1)) - 1),
                        },
                    };
                });
            set(state => ({
                posts:             removeComment(state.posts),
                pulses:            removeComment(state.pulses),
                currentGroupPosts: removeComment(state.currentGroupPosts),
            }));
        } catch (e) {
            Alert.alert('Error', 'Failed to delete comment.');
        }
    },

    editComment: async (postId, commentId, newText, storeId = null) => {
        const psid  = String(postId);
        const pssid = String(storeId || postId);
        const csid  = String(commentId);
        try {
            await SocialService.editComment(csid, newText);
            const updateComment = (arr) =>
                arr.map(p =>
                    (String(p.id) === pssid || String(p.id) === psid)
                        ? { ...p, comments: (p.comments || []).map(c =>
                                String(c.id) === csid ? { ...c, text: newText, edited: true } : c
                            )}
                        : p
                );
            set(state => ({
                posts:             updateComment(state.posts),
                pulses:            updateComment(state.pulses),
                currentGroupPosts: updateComment(state.currentGroupPosts),
            }));
        } catch (e) {
            Alert.alert('Error', 'Failed to update comment.');
        }
    },

    // ============================================================
    // GROUPS
    // ============================================================
    fetchGroups: async () => {
        if (!get().token) return;
        set({ isGroupsLoading: true });
        try {
            const newGroups = (await SocialService.fetchPublicGroups()) || [];
            const currentUserId = String(get().user?.id || '');

            const mappedGroups = newGroups.map(group => {
                const isOwner =
                    String(group.ownerId)     === currentUserId ||
                    String(group.owner?.id)   === currentUserId ||
                    String(group.created_by)  === currentUserId;
                const safeMembers = Array.isArray(group.members) ? group.members : [];
                const isMember = safeMembers.some(m =>
                    String(m.userId)    === currentUserId ||
                    String(m.user?.id)  === currentUserId ||
                    String(m.id)        === currentUserId
                ) || isOwner;
                const isAdmin = isOwner || safeMembers.some(m =>
                    (String(m.userId) === currentUserId || String(m.user?.id) === currentUserId) && m.isAdmin
                );
                return { ...group, isMember, isAdmin };
            });

            set({ groups: mappedGroups });
        } catch (e) {
            if (__DEV__) console.warn('[SocialSlice] fetchGroups error:', e?.message);
        } finally {
            set({ isGroupsLoading: false });
        }
    },

    fetchGroupDetails: async (groupId) => {
        const sid = String(groupId);
        try {
            const groupData = await SocialService.fetchGroupDetails(sid);
            set(state => ({
                activeGroupDetails: groupData,
                groups: state.groups.map(g => String(g.id) === sid ? { ...g, ...groupData } : g),
            }));
            return groupData;
        } catch (e) {
            return null;
        }
    },

    fetchGroupFeed: async (groupId) => {
        const sid = String(groupId);
        set({ isGroupPostsLoading: true });
        try {
            const posts = await SocialService.fetchGroupPosts(sid);
            set({ currentGroupPosts: (posts || []).map(mapPostAuthor) });
        } catch (e) {
            set({ currentGroupPosts: [] });
        } finally {
            set({ isGroupPostsLoading: false });
        }
    },

    createGroup: async (groupData) => {
        if (!groupData?.name?.trim()) throw new Error('Missing group name');
        const newGroup = await SocialService.createGroup(groupData);
        if (newGroup) {
            const optimisticGroup = { ...newGroup, isMember: true, isAdmin: true };
            set(state => ({ groups: [optimisticGroup, ...state.groups] }));
            get().fetchGroups?.();
            get().fetchExploreData?.();
        }
        return newGroup;
    },

    updateGroupDetails: async (groupId, updates) => {
        const sid = String(groupId);
        try {
            const updatedGroup = await SocialService.updateGroup(sid, updates);
            set(state => ({
                groups: state.groups.map(g => String(g.id) === sid ? { ...g, ...updatedGroup } : g),
                activeGroupDetails: { ...state.activeGroupDetails, ...updatedGroup },
            }));
            return true;
        } catch (e) {
            Alert.alert('Update Failed', 'Could not update group details.');
            throw e;
        }
    },

    deleteGroup: async (groupId) => {
        const sid = String(groupId);
        const prevGroups = get().groups;
        set(state => ({ groups: state.groups.filter(g => String(g.id) !== sid) }));
        try {
            await SocialService.deleteGroup(sid);
            return true;
        } catch (e) {
            set({ groups: prevGroups });
            throw e;
        }
    },

    joinGroup: async (groupId) => {
        const sid = String(groupId);
        const result = await SocialService.joinGroup(sid);
        get().fetchGroupDetails?.(sid);
        return result;
    },

    leaveGroup: async (groupId) => {
        const sid = String(groupId);
        await SocialService.leaveGroup(sid);
        get().fetchGroupDetails?.(sid);
        return true;
    },

    // ============================================================
    // USER FOLLOW
    // ============================================================
    toggleFollow: async (userId) => {
        const sid = String(userId);
        try {
            const result = await SocialService.toggleFollow(sid);
            return result;
        } catch (e) {
            if (__DEV__) console.warn('[SocialSlice] toggleFollow error:', e?.message);
            throw e;
        }
    },

    // ============================================================
    // SUPPORT TICKETS
    // ============================================================
    fetchMyTickets: async () => {
        if (!get().token) return;
        set({ isSupportLoading: true });
        try {
            const tickets = await SocialService.fetchMyTickets();
            set({ supportTickets: tickets || [] });
        } catch (e) {
            if (__DEV__) console.warn('[SocialSlice] fetchMyTickets error:', e?.message);
        } finally {
            set({ isSupportLoading: false });
        }
    },

    createTicket: async (subject, message, category = 'General') => {
        const response = await SocialService.createTicket(subject, message, category);
        get().fetchMyTickets?.();
        return response;
    },

    // ============================================================
    // PULSES (Stories)
    // ============================================================
    fetchActivePulses: async () => {
        if (!get().token) return;
        set({ isPulsesLoading: true });
        try {
            const pulses = await PulseService.fetchActivePulses();
            set({ pulses: pulses || [] });
        } catch (e) {
            if (__DEV__) console.warn('[SocialSlice] fetchActivePulses error:', e?.message);
        } finally {
            set({ isPulsesLoading: false });
        }
    },

    createPulse: async (text, imageUri, vibe = 'Neutral') => {
        if (!imageUri) throw new Error('Media is required to create a Pulse.');

        const actualVibe = VALID_VIBES.includes(vibe) ? vibe : 'Neutral';
        const actualText = text || '';

        try {
            const newPulse = await PulseService.createPulse(actualText, imageUri, actualVibe);
            const me = get().user;

            const pulseWithAuthor = {
                id: newPulse?.id || `temp_${Date.now()}`,
                vibe: actualVibe,
                text: actualText,
                imageUrl: newPulse?.imageUrl || newPulse?.image || imageUri,
                ...newPulse,
                author: newPulse?.author || me,
                user: newPulse?.user || me,
            };

            set(state => ({ pulses: [pulseWithAuthor, ...state.pulses] }));
            get().award?.('Create Pulse');
            return pulseWithAuthor;
        } catch (e) {
            if (__DEV__) console.error('[SocialSlice] createPulse error:', e);
            throw e;
        }
    },

    deletePulse: async (pulseId) => {
        const sid = String(pulseId);
        const prevPulses = get().pulses;
        set(state => ({ pulses: state.pulses.filter(p => String(p.id) !== sid) }));
        try {
            await PulseService.deletePulse(sid);
            return true;
        } catch (e) {
            set({ pulses: prevPulses });
            throw e;
        }
    },

    submitVibeCheck: async (vibe, imageUri, caption = '') => {
        return get().createPulse(caption, imageUri, vibe);
    },

    // ============================================================
    // NOTIFICATIONS & SEARCH
    // ============================================================
    fetchNotifications: async () => {
        if (!get().token) return;
        set({ isNotificationsLoading: true });
        try {
            const notifications = await SocialService.fetchNotifications();
            set({ notifications: Array.isArray(notifications) ? notifications : [] });
        } catch (e) {
            if (__DEV__) console.warn('[SocialSlice] fetchNotifications error:', e?.message);
        } finally {
            set({ isNotificationsLoading: false });
        }
    },

    markAllNotificationsAsRead: async () => {
        try {
            await SocialService.markAllNotificationsAsRead();
            set(state => ({ notifications: state.notifications.map(n => ({ ...n, isRead: true })) }));
        } catch (e) {
            if (__DEV__) console.warn('[SocialSlice] markAllNotificationsAsRead error:', e?.message);
        }
    },

    performSearch: async (query) => {
        if (!query || query.length < 2) {
            set(state => ({ searchItemsData: { ...state.searchItemsData, Search: [] } }));
            return;
        }
        set({ isSearchLoading: true });
        try {
            const results = await SocialService.searchGlobal(query);
            const formatted = [];

            (results.users || []).forEach(u =>
                formatted.push({ type: 'item', icon: '👤', title: u.username || u.name, body: u.name || '', next: 'ProfilePeek', data: u })
            );
            (results.groups || []).forEach(g =>
                formatted.push({ type: 'item', icon: '👥', title: g.name, body: g.description, next: 'GroupDetails', data: g })
            );
            (results.posts || []).forEach(p => {
                const mappedPost = mapPostAuthor(p);
                formatted.push({ type: 'item', icon: '📝', title: `Post by ${mappedPost.user?.username}`, body: p.text, next: 'PostView', data: mappedPost });
            });

            set(state => ({
                searchItemsData: { ...state.searchItemsData, Search: formatted },
            }));
        } catch (e) {
            if (__DEV__) console.warn('[SocialSlice] performSearch error:', e?.message);
        } finally {
            set({ isSearchLoading: false });
        }
    },

    // ============================================================
    // LOCATION
    // ============================================================
    detectLocation: async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const location = await Location.getCurrentPositionAsync({});
            const geocode = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });
            const cityName = geocode[0]?.city || geocode[0]?.region || 'My Location';
            get().setUserLocation?.({
                name: cityName,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });
        } catch (e) {
            if (__DEV__) console.warn('[SocialSlice] detectLocation error:', e?.message);
        }
    },

    searchLocation: async (query) => {
        set({ isSearchLoading: true });
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
                {
                    headers: {
                        'User-Agent': 'KliqMind/1.0 (support@kliqtap.com)',
                        'Accept': 'application/json',
                    },
                }
            );
            const data = await response.json();
            const results = (data || []).map(item => ({
                name: item.address?.city || item.display_name.split(',')[0],
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
            }));
            set({ locationSearchResults: results });
        } catch (e) {
            if (__DEV__) console.warn('[SocialSlice] searchLocation error:', e?.message);
        } finally {
            set({ isSearchLoading: false });
        }
    },

    setManualLocation: (name, lat, lng) => {
        get().setUserLocation?.({ name, latitude: lat, longitude: lng });
        set({ locationSearchResults: [] });
        get().fetchGroups?.();
    },

    // ============================================================
    // AI & VIBE
    // ============================================================
    generateAiResponse: async (prompt) => {
        try {
            const response = await AIService.generateAiResponse(prompt);
            return response?.text || response || 'Thinking...';
        } catch (e) {
            return 'Error occurred.';
        }
    },

    fetchAiRecommendations: async () => {
        if (!get().token) return;
        try {
            const recommendations = await AIService.fetchAiRecommendations();
            set({ aiRecommendations: recommendations || [] });
        } catch (e) {
            if (__DEV__) console.warn('[SocialSlice] fetchAiRecommendations error:', e?.message);
        }
    },

    fetchCommunityVibe: async () => {
        if (!get().token) return;
        try {
            const vibeData = await SocialService.fetchCommunityVibe();
            set({ communityVibe: vibeData || [] });
        } catch (e) {
            set({ communityVibe: [] });
        }
    },
});

export default createSocialSlice;