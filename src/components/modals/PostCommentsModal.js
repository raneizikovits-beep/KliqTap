// client/src/components/modals/PostCommentsModal.js
// 🏆 KliqMind V4.7: Architect Edition — Edit Success + Delete Confirmation + Safety Guards 🏆
//
// CRITICAL FIXES IN THIS VERSION:
//
// [FIX-1] editComment success was never verified. The branch ALWAYS cleared
//         editing state, even on server failure. User saw fake "success".
//         Now: edit result is checked. If the store returns false explicitly,
//         the edit state is preserved so the user can retry.
//
// [FIX-2] Delete had no confirmation dialog. One tap on the long-press menu
//         and the comment was gone forever. Now: a "Delete Forever?" dialog
//         appears before the destructive action runs.
//
// [FIX-3] isMyComment check returned TRUE when both userId and user.id were
//         undefined. Now: both must be present AND equal as strings.
//
// [FIX-4] Delete was a fire-and-forget onPress with no error handling.
//         Now: async-safe with user feedback on failure.
//
// [FIX-5] Edit/draft state persisted when switching postId while modal was
//         already visible. Now: state resets on postId change too.
//
// [FIX-6] Generic "Could not reach community server" was misleading for
//         validation errors (400/422). Now: distinguishes network from
//         server-validation errors and shows meaningful messages.
//
// [FIX-7] Profile peek was triggered with id: undefined for malformed comments,
//         which can break the consuming modal. Now: guarded.
//
// PERFORMANCE:
//   - All handlers wrapped in useCallback to avoid unnecessary re-creation
//   - Comment item render still uses TouchableOpacity wrapping the avatar
//     for tap-on-avatar profile peek (preserved)
//
// All UI, styles, dark mode, layout, and existing integration with the store
// are preserved 100%.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    Modal, View, Text, ScrollView, TextInput, TouchableOpacity, 
    StyleSheet, KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../../constants/data';
import { useAppStore } from '../../store/useAppStore';

export function PostCommentsModal({ postId, visible, onClose }) {
    
    const { 
        user, 
        posts, 
        createComment, 
        deleteComment, 
        editComment, 
        setProfilePeekUser, 
        userSettings, 
        fetchPosts 
    } = useAppStore(state => ({
        user: state.user,
        posts: state.posts || [],
        createComment: state.createComment,
        deleteComment: state.deleteComment,
        editComment: state.editComment,
        setProfilePeekUser: state.setProfilePeekUser,
        userSettings: state.userSettings,
        fetchPosts: state.fetchPosts
    }));

    const isDark = userSettings?.darkMode === true; 
    const [inputText, setInputText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const scrollRef = useRef(null);

    const currentPost = posts.find(p => String(p.id) === String(postId));
    const comments = currentPost?.comments || [];

    // Reset on modal close
    useEffect(() => {
        if (!visible) {
            setInputText('');
            setEditingCommentId(null);
            setIsSubmitting(false);
        }
    }, [visible]);

    // [FIX-5] Reset draft/edit state when switching to a different postId mid-session
    useEffect(() => {
        setInputText('');
        setEditingCommentId(null);
    }, [postId]);

    // ════════════════════════════════════════════════════════════════
    // [FIX-1, FIX-6] Submit — verifies edit success, distinguishes error types
    // ════════════════════════════════════════════════════════════════
    const handleSubmit = useCallback(async () => {
        const textToSubmit = inputText.trim();
        if (!textToSubmit || isSubmitting) return;
        
        if (!postId) {
            Alert.alert("Error", "Post reference lost. Please reopen the comments.");
            return;
        }

        setIsSubmitting(true);
        const safePostId = String(postId);

        try {
            if (editingCommentId) {
                // [FIX-1] Guard + verify success
                if (!editComment) {
                    Alert.alert("Edit unavailable", "Editing isn't ready. Please refresh and try again.");
                    return;
                }
                const result = await editComment(safePostId, String(editingCommentId), textToSubmit);

                // Treat anything not explicitly === false as success.
                // This handles stores that return: a comment object, true, or undefined on success.
                // Only an explicit `false` keeps the edit state so the user can retry.
                if (result !== false) {
                    setInputText('');
                    setEditingCommentId(null);
                    if (fetchPosts) await fetchPosts(true);
                } else {
                    Alert.alert("Edit Failed", "Your edit couldn't be saved. Please try again.");
                }
            } else {
                if (!createComment) {
                    Alert.alert("Comment unavailable", "Comment posting isn't ready. Please refresh and try again.");
                    return;
                }
                const result = await createComment(safePostId, textToSubmit);

                if (result !== false) {
                    setInputText('');
                    if (fetchPosts) await fetchPosts(true);
                    setTimeout(() => {
                        scrollRef.current?.scrollToEnd({ animated: true });
                    }, 300);
                }
            }
        } catch (error) {
            console.error("[PostCommentsModal] Comment error:", error);

            // [FIX-6] Distinguish network from server-validation errors
            const msg = String(error?.message || '').toLowerCase();
            const isNetwork = 
                msg.includes('network') || 
                msg.includes('fetch') || 
                msg.includes('timeout') || 
                error?.code === 'NETWORK_ERROR';

            Alert.alert(
                isNetwork ? "Connection Error" : "Couldn't Save Comment",
                isNetwork 
                    ? "Could not reach the community server. Check your connection and try again."
                    : (error?.message || "Something went wrong. Please try again.")
            );
        } finally {
            setIsSubmitting(false);
        }
    }, [inputText, isSubmitting, postId, editingCommentId, editComment, createComment, fetchPosts]);

    // ════════════════════════════════════════════════════════════════
    // [FIX-2, FIX-3, FIX-4] Long-press → confirmation + safer ownership check
    // ════════════════════════════════════════════════════════════════
    const handleLongPress = useCallback((comment) => {
        // [FIX-3] Both must be present AND equal — closes the undefined === undefined trap
        const commentUserId = comment?.userId;
        const currentUserId = user?.id;
        if (!commentUserId || !currentUserId) return;
        if (String(commentUserId) !== String(currentUserId)) return;

        Alert.alert(
            "Comment Options",
            "Choose an action:",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Edit", 
                    onPress: () => { 
                        setEditingCommentId(comment.id); 
                        setInputText(comment.text || ''); 
                    } 
                },
                { 
                    text: "Delete", 
                    style: "destructive", 
                    // [FIX-2] Confirmation dialog before destructive action
                    onPress: () => {
                        Alert.alert(
                            "Delete Comment?",
                            "This action cannot be undone.",
                            [
                                { text: "Cancel", style: "cancel" },
                                {
                                    text: "Delete Forever",
                                    style: "destructive",
                                    // [FIX-4] Async-safe with user feedback on failure
                                    onPress: async () => {
                                        if (!deleteComment) {
                                            Alert.alert("Delete unavailable", "Comment deletion isn't ready.");
                                            return;
                                        }
                                        try {
                                            await deleteComment(String(postId), String(comment.id));
                                            if (fetchPosts) await fetchPosts(true);
                                        } catch (err) {
                                            console.error("[PostCommentsModal] Delete error:", err);
                                            Alert.alert(
                                                "Couldn't Delete", 
                                                err?.message || "The comment couldn't be deleted. Please try again."
                                            );
                                        }
                                    }
                                }
                            ]
                        );
                    }
                }
            ]
        );
    }, [user?.id, deleteComment, postId, fetchPosts]);

    // ════════════════════════════════════════════════════════════════
    // [FIX-7] Profile peek — guarded against missing userId
    // ════════════════════════════════════════════════════════════════
    const handleUserPress = useCallback((comment) => {
        if (!comment?.userId || !setProfilePeekUser) return;
        setProfilePeekUser({ 
            id: comment.userId, 
            name: comment.username || 'User', 
            avatarUrl: comment.avatar 
        });
    }, [setProfilePeekUser]);

    const formatTime = (timestamp) => {
        if (!timestamp) return 'Now';
        try {
            return new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch {
            return 'Now';
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : undefined} 
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
                style={[localStyles.keyboardView, { backgroundColor: isDark ? '#121212' : '#fff' }]}
            >
                {/* Header */}
                <View style={[localStyles.header, { borderBottomColor: isDark ? '#333' : '#f0f0f0' }]}>
                    <View style={localStyles.headerLeft}>
                        <Ionicons name="chatbubbles-outline" size={20} color={brand.blue} />
                        <Text style={[localStyles.headerTitle, { color: isDark ? '#fff' : '#111' }]}> Comments ({comments.length})</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={localStyles.closeArea}>
                        <Ionicons name="close-circle" size={28} color={isDark ? '#666' : '#ccc'} />
                    </TouchableOpacity>
                </View>

                {/* Comments list */}
                <ScrollView 
                    ref={scrollRef}
                    contentContainerStyle={localStyles.scrollContent} 
                    keyboardShouldPersistTaps="always"
                >
                    {comments.length === 0 && !isSubmitting && (
                        <View style={localStyles.emptyState}>
                            <Text style={localStyles.emptyEmoji}>💬</Text>
                            <Text style={[localStyles.emptyText, { color: isDark ? '#aaa' : '#888' }]}>No vibes yet. Be the first!</Text>
                        </View>
                    )}
                    
                    {comments.map((comment, index) => (
                        <TouchableOpacity 
                            key={comment.id ? String(comment.id) : `c-${index}`} 
                            onLongPress={() => handleLongPress(comment)}
                            activeOpacity={0.8}
                            style={localStyles.commentRow}
                        >
                            <TouchableOpacity onPress={() => handleUserPress(comment)}>
                                <Image 
                                    source={{ uri: comment.avatar || 'https://via.placeholder.com/50' }} 
                                    style={[localStyles.avatar, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]} 
                                />
                            </TouchableOpacity>

                            <View style={[localStyles.bubble, { backgroundColor: isDark ? '#1C1C1E' : '#f2f3f5' }]}>
                                <View style={localStyles.bubbleHeader}>
                                    <Text style={[localStyles.username, { color: isDark ? '#ddd' : '#333' }]}>{comment.username || 'User'}</Text>
                                    <Text style={[localStyles.time, { color: isDark ? '#888' : '#999' }]}>{formatTime(comment.timestamp)}</Text>
                                </View>
                                <Text style={[localStyles.text, { color: isDark ? '#fff' : '#222' }]}>{comment.text}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                    
                    {isSubmitting && <ActivityIndicator color={brand.blue} style={{ marginTop: 10 }} />}
                </ScrollView>

                {/* Input area */}
                <View style={[localStyles.inputContainer, { borderTopColor: isDark ? '#333' : '#eee', backgroundColor: isDark ? '#121212' : '#fff' }]}>
                    {editingCommentId && (
                        <View style={[localStyles.editIndicator, { backgroundColor: isDark ? '#332b00' : '#fffbe6' }]}>
                            <Text style={[localStyles.editIndicatorText, { color: isDark ? '#FFD700' : '#856404' }]}>Editing mode active</Text>
                            <TouchableOpacity onPress={() => { setEditingCommentId(null); setInputText(''); }}>
                                <Text style={{color: brand.red, fontSize: 12, fontWeight: 'bold'}}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    
                    <TextInput 
                        style={[localStyles.input, { backgroundColor: isDark ? '#1C1C1E' : '#f8f8f8', color: isDark ? '#fff' : '#000', borderColor: isDark ? '#333' : '#eee' }]}
                        placeholder="Share your vibe..."
                        placeholderTextColor={isDark ? "#888" : "#999"}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        editable={!isSubmitting}
                    />
                    
                    <TouchableOpacity 
                        onPress={handleSubmit} 
                        disabled={!inputText.trim() || isSubmitting}
                        style={localStyles.sendBtn}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator size="small" color={brand.blue} />
                        ) : (
                            <Ionicons name="send" size={28} color={inputText.trim() ? brand.blue : (isDark ? '#444' : "#eee")} />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const localStyles = StyleSheet.create({
    keyboardView: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '800' },
    closeArea: {},
    scrollContent: { padding: 16, paddingBottom: 40, flexGrow: 1 },
    emptyState: { marginTop: 60, alignItems: 'center', opacity: 0.5 },
    emptyEmoji: { fontSize: 40, marginBottom: 10 },
    emptyText: { fontWeight: '600' },
    commentRow: { flexDirection: 'row', marginBottom: 16 },
    avatar: { width: 34, height: 34, borderRadius: 17, marginRight: 10 },
    bubble: { padding: 12, borderRadius: 18, borderTopLeftRadius: 2, flex: 1 },
    bubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    username: { fontWeight: '700', fontSize: 12 },
    text: { fontSize: 14, lineHeight: 18 },
    time: { fontSize: 9 },
    inputContainer: { padding: 12, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 35 : 15 },
    input: { flex: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10, fontSize: 15, borderWidth: 1 },
    editIndicator: { position: 'absolute', top: -35, left: 0, right: 0, height: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderTopLeftRadius: 15, borderTopRightRadius: 15 },
    editIndicatorText: { fontSize: 11, fontWeight: 'bold' },
    sendBtn: { justifyContent: 'center', alignItems: 'center', padding: 4 }
});