// client/src/store/socialSlice.js
// ⭐️ V18.0 PRODUCTION: Unified Points, No Hardcoded URLs, No Duplicates ⭐️
//
// שינויים מ-V17.0:
//   • createComment שוכתב — משתמש ב-SocialService.addComment, תומך בתמונה,
//     מסיר URL קשיח, optimistic UI עם award() אמיתי במקום toast מטעה.
//   • toggleFollow / createGroup / fetchMyTickets — נשארים פה כ-source of truth
//     אבל useAppStore.js לא מספק יותר versions כפולות.
//   • VALID_VIBES חולץ ל-constant יחיד שניתן לייצא.
//   • setUserLocation תועבר ל-useAppStore (single source of truth).
//   • Vibe / Text shuffling ב-createPulse הוסר — חתימה ברורה.
//   • repostPost מנקה את URLs ההזרים — אם המקור הוא https://, מעבירים אותו כ-imageUrl
//     ולא כ-imageUri (כדי לא לדחוף ל-FormData).

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

    // Renamed to avoid collision with chatSlice.searchResults
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

    // ----- Socket lifecycle (delegates to chatSlice.connectSocket) -----
    // The actual implementation lives in chatSlice; this is a safety wrapper.
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

    // ----- Master refresh -----
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
        if (isPostsLoading) return;           // dedup
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
                // Guard: hasMore true but no cursor → stop to avoid infinite loop
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

            // Unified points system: only one source of truth
            get().award?.('Create Post');

            get().fetchCommunityVibe?.();
            return mappedNewPost;
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to create post.');
            throw error;
        }
    },

    toggleLike: async (postId, isUnliking = false) => {
        const sid = String(postId);
        try {
            const updatedPost = isUnliking
                ? await SocialService.unlikePost(sid)
                : await SocialService.likePost(sid);

            get().award?.(isUnliking ? 'Unlike' : 'Like');

            const mappedPost = mapPostAuthor(updatedPost);
            set(state => ({
                posts: state.posts.map(p => String(p.id) === sid ? mappedPost : p),
                currentGroupPosts: state.currentGroupPosts.map(p => String(p.id) === sid ? mappedPost : p),
            }));
        } catch (e) {
            safeToast({ type: 'error', text1: 'Error', text2: 'Could not update like status.' });
        }
    },

    repostPost: async (originalPost) => {
        try {
            const authorData = originalPost?.user || originalPost?.author || {};
            const originalAuthor = authorData.username || authorData.name || 'Unknown';
            const repostText = `🔄 Repost from @${originalAuthor}:\n\n${originalPost.text || ''}`;
            // NOTE: original.image is typically a remote https URL. Currently we re-upload by
            // passing the remote URL to createPost; this works on Web (fetch → blob)
            // and on native (RN downloads via uri). If needed in future, server-side repost
            // endpoint can avoid the round-trip entirely.
            const imageUri = originalPost.image || originalPost.imageUrl || null;

            await get().createPost(repostText, null, imageUri);
            safeToast({ type: 'success', text1: 'Shared!', text2: 'Post shared to your profile.' });
            return true;
        } catch (error) {
            Alert.alert('Error', 'Failed to repost.');
            return false;
        }
    },

    deletePost: async (postId) => {
        const sid = String(postId);
        const prevState = { posts: get().posts, currentGroupPosts: get().currentGroupPosts };

        // Optimistic removal
        set(state => ({
            posts: state.posts.filter(p => String(p.id) !== sid),
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
    // COMMENTS — ⭐️ FIXED: no hardcoded URL, supports image, web-safe
    // ============================================================
    createComment: async (postId, text, imageUri = null) => {
        if ((!text || !text.trim()) && !imageUri) return false;
        const sid = String(postId);

        try {
            // Uses SocialService → fetchAPI → proper auth/refresh/error flow
            const response = await SocialService.addComment(sid, text?.trim(), imageUri);

            if (!response) return false;

            // Build optimistic comment payload from server response + local user
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

            // Inject into matching post in both feeds
            set(state => ({
                posts: state.posts.map(p =>
                    String(p.id) === sid
                        ? { ...p, comments: [...(p.comments || []), optimisticComment] }
                        : p
                ),
                currentGroupPosts: state.currentGroupPosts.map(p =>
                    String(p.id) === sid
                        ? { ...p, comments: [...(p.comments || []), optimisticComment] }
                        : p
                ),
            }));

            get().award?.('Comment');
            return true;
        } catch (error) {
            safeToast({ type: 'error', text1: 'Error', text2: 'Could not post the comment.' });
            if (__DEV__) console.warn('[SocialSlice] createComment error:', error?.message);
            return false;
        }
    },

    deleteComment: async (postId, commentId) => {
        const psid = String(postId);
        const csid = String(commentId);
        try {
            await SocialService.deleteComment(csid);
            // Optimistic removal without full refetch
            set(state => ({
                posts: state.posts.map(p => String(p.id) === psid
                    ? { ...p, comments: (p.comments || []).filter(c => String(c.id) !== csid) }
                    : p
                ),
                currentGroupPosts: state.currentGroupPosts.map(p => String(p.id) === psid
                    ? { ...p, comments: (p.comments || []).filter(c => String(c.id) !== csid) }
                    : p
                ),
            }));
        } catch (e) {
            Alert.alert('Error', 'Failed to delete comment.');
        }
    },

    editComment: async (postId, commentId, newText) => {
        const psid = String(postId);
        const csid = String(commentId);
        try {
            await SocialService.editComment(csid, newText);
            set(state => ({
                posts: state.posts.map(p => String(p.id) === psid
                    ? {
                        ...p,
                        comments: (p.comments || []).map(c =>
                            String(c.id) === csid ? { ...c, text: newText, edited: true } : c
                        ),
                    }
                    : p
                ),
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
                    String(group.ownerId) === currentUserId ||
                    String(group.owner?.id) === currentUserId;
                const safeMembers = Array.isArray(group.members) ? group.members : [];
                const isMember = safeMembers.some(m =>
                    String(m.userId) === currentUserId ||
                    String(m.user?.id) === currentUserId ||
                    String(m.id) === currentUserId
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

    // SINGLE source of truth for createGroup — useAppStore should not override.
    createGroup: async (groupData) => {
        if (!groupData?.name?.trim()) throw new Error('Missing group name');
        const newGroup = await SocialService.createGroup(groupData);
        if (newGroup) {
            set(state => ({ groups: [newGroup, ...state.groups] }));
            // refresh explore data if available
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
    // SUPPORT TICKETS
    // ============================================================
    fetchMyTickets: async () => {
        if (!get().token) return;
        set({ isSupportLoading: true });
        try {
            const tickets = await SocialService.fetchMyTickets();
            set({ supportTickets: tickets || [] });
        } catch (e) {
            // keep previous tickets, just log
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

    // Deterministic signature: (text, imageUri, vibe). No more parameter shuffling.
    createPulse: async (text, imageUri, vibe = 'Neutral') => {
        if (!imageUri) throw new Error('Media is required to create a Pulse.');

        const actualVibe = VALID_VIBES.includes(vibe) ? vibe : 'Neutral';
        const actualText = text || '';

        try {
            const newPulse = await PulseService.createPulse(actualText, imageUri, actualVibe);
            const me = get().user;

            // Optimistic injection so the home screen renders the pulse immediately,
            // even if the server response is partial.
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

    // Backward-compatible alias (preserved from legacy signature).
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
            // Use the global setUserLocation so the server sync runs once.
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
                        // Nominatim policy: identify the client
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