// client/src/components/CommentsSheet.js
// ⭐️ KLIQMIND V6.4: Comments Feedback (+2 PTS) & Performance Optimized ⭐️
//
// [V6.4 CHANGES — Engineering Audit Fixes]:
//   [FIX CRITICAL] CommentItem was firing a DIRECT Supabase query
//                  (`supabase.from('profiles')...`) per comment to resolve the
//                  commenter's name/avatar — bypassing the entire store/API
//                  architecture used everywhere else in this codebase. On a post
//                  with 50 comments from 30 different users, this fired up to 50
//                  separate uncached Supabase queries on every single mount of
//                  this sheet (N+1 query pattern, zero deduplication). Replaced
//                  with `resolveUser(userId)` from useAppStore, which already has
//                  a 5-minute TTL cache + LRU eviction and goes through the same
//                  fetchAPI authorization path as every other data fetch in the app.
//                  The now-unused `supabase` import was removed.
//   [FIX CRITICAL] selectedImage was picked via ImagePicker, previewed with a
//                  removable thumbnail, but NEVER actually uploaded or sent —
//                  createComment was called with only (postId, text). Now uploads
//                  via uploadFile() first and passes the resulting URL through.
//                  ⚠️ socialSlice.createComment (not available for this audit) MUST
//                  accept and forward a 3rd `imageUrl` argument for this to reach
//                  the backend — verify/update that file to match.
//   [FIX MEDIUM]   Zero dark-mode support previously — the only major sheet/modal
//                  in the whole codebase without it. Added throughout (header,
//                  bubbles, input bar, all text colors).
//   [FIX MEDIUM]   handleDeleteWrapper was a plain (non-memoized) function passed
//                  as the `onDelete` prop into memo()-wrapped CommentItem. Since
//                  inputText lives in this component, every keystroke while typing
//                  a comment recreated this function and forced every CommentItem
//                  in the list to re-render, defeating memo() entirely. Wrapped in
//                  useCallback (along with handlePickImage/handleSubmit for
//                  consistency). This required moving `if (!post) return null;`
//                  to AFTER all hook declarations — hooks cannot follow a
//                  conditional return (Rules of Hooks) — which is a pure reordering
//                  with no behavioral change for the post-truthy case.
//   [Minor]        Empty-list view extracted to a small memoized component so it
//                  also picks up dark mode correctly.

import React, { useState, useRef, useEffect, useCallback, memo } from 'react'; 
import { 
    View, Text, TextInput, TouchableOpacity, FlatList, 
    Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
    SafeAreaView, Keyboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; 
import { useAppStore } from '../store/useAppStore'; 
import { styles } from '../constants/styles';
import { brand } from '../constants/data';
import { trackEvent } from '../utils/analytics';

// ─────────────────────────────────────────────────────────────
// Cross-platform __DEV__ guard
// ─────────────────────────────────────────────────────────────
if (typeof __DEV__ === 'undefined') {
    Object.defineProperty(
        typeof globalThis !== 'undefined' ? globalThis : global,
        '__DEV__',
        { value: process.env.NODE_ENV !== 'production', configurable: true }
    );
}

// --- Empty state -----------------------------------------------------------
const EmptyCommentsView = memo(({ isDark }) => (
    <Text style={{ textAlign: 'center', color: isDark ? '#888' : '#999', marginTop: 20 }}>
        No comments yet. Be the first to vibe!
    </Text>
));

// --- רכיב תגובה בודדת --------------------------------------------------------
const CommentItem = memo(({ comment, currentUserId, onDelete, isDark }) => {
    const isMine = String(comment.userId) === String(currentUserId);

    // [FIX CRITICAL] Resolve via the store's cached resolver, not a raw Supabase call.
    const resolveUser = useAppStore(state => state.resolveUser);

    const [displayName, setDisplayName] = useState(comment.username || 'User');
    const [displayAvatar, setDisplayAvatar] = useState(comment.avatar || null);

    useEffect(() => {
        let isMounted = true;
        const loadProfile = async () => {
            if (!comment.userId) return;
            try {
                // Cached (5min TTL) + LRU-evicted + goes through fetchAPI's auth path —
                // repeated comments from the same user across a thread cost one network
                // call total instead of one per comment.
                const userData = await resolveUser(comment.userId);
                if (userData && isMounted) {
                    if (userData.name) setDisplayName(userData.name);
                    if (userData.avatarUrl) setDisplayAvatar(userData.avatarUrl);
                }
            } catch (e) {
                if (__DEV__) console.warn('[CommentsSheet] Failed to resolve commenter profile:', e?.message);
            }
        };

        loadProfile();
        return () => { isMounted = false; };
    }, [comment.userId, resolveUser]);

    return (
        <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            <Image 
                source={{ uri: displayAvatar || 'https://via.placeholder.com/36' }} 
                style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#eee' }}
            />
            <View style={{ flex: 1 }}>
                <View style={{
                    backgroundColor: isDark ? '#1C1C1E' : '#f0f2f5',
                    borderRadius: 12, padding: 10, alignSelf: 'flex-start',
                }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 2, color: isDark ? '#fff' : '#000' }}>
                        {displayName}
                    </Text>
                    {comment.text ? (
                        <Text style={{ fontSize: 14, color: isDark ? '#ddd' : '#111' }}>{comment.text}</Text>
                    ) : null}
                    {comment.imageUrl && (
                        <Image 
                            source={{ uri: comment.imageUrl }} 
                            style={{ width: 150, height: 150, borderRadius: 8, marginTop: 5 }} 
                            resizeMode="cover"
                        />
                    )}
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 4 }}>
                    <Text style={{ fontSize: 11, color: isDark ? '#888' : '#888' }}>
                        {new Date(comment.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {isMine && (
                        <TouchableOpacity onPress={() => onDelete(comment.id)} style={{ marginLeft: 10 }}>
                            <Text style={{ fontSize: 11, color: '#D32F2F', fontWeight: '600' }}>Delete</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
});

export default function CommentsSheet({ post, onClose }) {
    const { user, createComment, deleteComment, uploadFile } = useAppStore(state => ({
        user: state.user,
        createComment: state.createComment,
        deleteComment: state.deleteComment,
        uploadFile: state.uploadFile,
    }));
    const isDark = useAppStore(state => state.userSettings?.darkMode === true);

    const [inputText, setInputText] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef();
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    const handlePickImage = useCallback(async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setSelectedImage(result.assets[0].uri);
        }
    }, []);

    // [FIX CRITICAL] [FIX MEDIUM] — image upload wiring + useCallback memoization.
    // `post` is read from the closure rather than guarded by an early return above,
    // since hooks can't follow a conditional return (see the file-level note up top).
    const handleSubmit = useCallback(async () => {
        if (!post) return;
        if ((!inputText.trim() && !selectedImage) || isSending) return;

        const postId = String(post.id);

        setIsSending(true);
        try {
            // [FIX CRITICAL] Upload the picked image BEFORE creating the comment.
            // Previously selectedImage was collected and previewed but never sent.
            let uploadedImageUrl = null;
            if (selectedImage) {
                uploadedImageUrl = await uploadFile(selectedImage, 'comment');
            }

            // ⚠️ Verify socialSlice.createComment(postId, text, imageUrl) accepts and
            // forwards this 3rd argument — that file wasn't available for this audit.
            const success = await createComment(postId, inputText.trim(), uploadedImageUrl);

            if (success) {
                trackEvent('comment_created', { postId, hasImage: !!selectedImage });
                setInputText('');
                setSelectedImage(null);

                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                }, 500);
            }
        } catch (error) {
            console.warn('Comment submit error:', error?.message);
        } finally {
            setIsSending(false);
        }
    }, [post, inputText, selectedImage, isSending, uploadFile, createComment]);

    // [FIX MEDIUM] Memoized — this is passed as `onDelete` into memo()-wrapped
    // CommentItem. An unmemoized version here defeated that memoization on every
    // keystroke in the comment input (see file header).
    const handleDeleteWrapper = useCallback((commentId) => {
        if (!post) return;
        Alert.alert('Delete Comment', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteComment(String(post.id), String(commentId)) },
        ]);
    }, [post, deleteComment]);

    // All hooks are declared above this line — safe to conditionally return now.
    if (!post) return null;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                style={{ flex: 1 }}
                keyboardVerticalOffset={0} 
            >
                <View style={{
                    padding: 16, borderBottomWidth: 1, borderColor: isDark ? '#333' : '#eee',
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <Text style={[styles.h2, isDark && { color: '#fff' }]}>
                        Comments ({post.comments?.length || 0})
                    </Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={isDark ? '#fff' : (brand?.ink || '#000')} />
                    </TouchableOpacity>
                </View>

                <FlatList
                    ref={flatListRef}
                    data={post.comments || []}
                    keyExtractor={(item, index) => String(item.id || index)} 
                    renderItem={({ item }) => (
                        <CommentItem 
                            comment={item} 
                            currentUserId={user?.id} 
                            onDelete={handleDeleteWrapper}
                            isDark={isDark}
                        />
                    )}
                    onContentSizeChange={() => { 
                        if (keyboardVisible && post.comments?.length > 0) { 
                            flatListRef.current?.scrollToEnd({ animated: true });
                        }
                    }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                    ListEmptyComponent={<EmptyCommentsView isDark={isDark} />}
                />

                {selectedImage && (
                    <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                        <View style={{ position: 'relative', width: 80, height: 80 }}>
                            <Image source={{ uri: selectedImage }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                            <TouchableOpacity 
                                onPress={() => setSelectedImage(null)}
                                style={{ position: 'absolute', top: -5, right: -5, backgroundColor: 'black', borderRadius: 10, padding: 2 }}
                            >
                                <Ionicons name="close-circle" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={{ 
                    flexDirection: 'row', alignItems: 'center', padding: 12, 
                    borderTopWidth: 1, borderColor: isDark ? '#333' : '#eee',
                    backgroundColor: isDark ? '#000' : '#fff', 
                }}>
                    <TouchableOpacity onPress={handlePickImage} style={{ padding: 8 }}>
                        <Ionicons name="image-outline" size={24} color={brand?.blue || '#007AFF'} />
                    </TouchableOpacity>

                    <TextInput 
                        style={{ 
                            flex: 1, backgroundColor: isDark ? '#1C1C1E' : '#f5f5f5', borderRadius: 20, 
                            paddingHorizontal: 15, paddingVertical: 8, maxHeight: 100, fontSize: 15,
                            color: isDark ? '#fff' : '#000',
                        }}
                        placeholder="Add a comment..."
                        placeholderTextColor={isDark ? '#888' : '#999'}
                        multiline
                        value={inputText}
                        onChangeText={setInputText}
                    />

                    <TouchableOpacity 
                        onPress={handleSubmit} 
                        disabled={(!inputText.trim() && !selectedImage) || isSending}
                        style={{ padding: 8, marginLeft: 4 }}
                    >
                        {isSending
                            ? <ActivityIndicator color={brand?.blue || '#007AFF'} />
                            : <Ionicons name="send" size={24} color={brand?.blue || '#007AFF'} />}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}