// client/src/components/modals/PostCommentsModal.js
// ═══════════════════════════════════════════════════════════════════════════════
//  🏆 KLIQTAP — COMMENTS MODAL v6.0 (PERSIST + EDIT + DELETE + MODERN UI)
//  • Optimistic UI: changes appear instantly, sync to server in background
//  • Full edit/delete: swipe-to-reveal actions on each comment
//  • Persistent: comments survive refresh because they live on the server
//  • Beautiful: glassmorphism bubbles, animated reactions, smooth keyboards
// ═══════════════════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import {
  Modal, View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Image, Alert,
  ActivityIndicator, Animated, Dimensions, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../../constants/data';
import { useAppStore } from '../../store/useAppStore';

const { width: W } = Dimensions.get('window');
const IS_IOS = Platform.OS === 'ios';

// ─── Haptics (optional) ───────────────────────────────────────────────────────
let Haptics;
try {
  Haptics = require('expo-haptics');
} catch (_) {
  Haptics = {
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
    NotificationFeedbackType: { Success: 'success', Error: 'error' },
    impactAsync: () => Promise.resolve(),
    notificationAsync: () => Promise.resolve(),
    selectionAsync: () => Promise.resolve(),
  };
}
const haptic = (k = 'light') => {
  try {
    if (k === 'light')   return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (k === 'medium')  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (k === 'success') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (k === 'error')   return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (k === 'select')  return Haptics.selectionAsync();
  } catch (_) {}
  return Promise.resolve();
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTimeAgo = (ts) => {
  if (!ts) return 'now';
  try {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60)   return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  } catch {
    return 'now';
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SWIPEABLE COMMENT ROW
//  Swipe left → reveals Edit & Delete buttons
// ═══════════════════════════════════════════════════════════════════════════════
const SWIPE_THRESHOLD = 60;
const ACTION_WIDTH    = 130; // total width of the revealed action area

const CommentRow = React.memo(({ comment, currentUserId, isDark, onEdit, onDelete, onUserPress }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOwner    = String(comment.userId) === String(currentUserId);
  const [isOpen, setIsOpen] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => {
        if (!isOwner) return;
        const x = Math.max(-ACTION_WIDTH, Math.min(0, g.dx + (isOpen ? -ACTION_WIDTH : 0)));
        translateX.setValue(x);
      },
      onPanResponderRelease: (_, g) => {
        if (!isOwner) return;
        const shouldOpen = g.dx < -SWIPE_THRESHOLD || (isOpen && g.dx < SWIPE_THRESHOLD);
        Animated.spring(translateX, {
          toValue: shouldOpen ? -ACTION_WIDTH : 0,
          useNativeDriver: true, speed: 20, bounciness: 6,
        }).start();
        setIsOpen(shouldOpen);
        if (shouldOpen) haptic('light');
      },
    })
  ).current;

  const closeSwipe = useCallback(() => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
    setIsOpen(false);
  }, [translateX]);

  const avatarLetter = (comment.username || 'U').charAt(0).toUpperCase();

  return (
    <View style={{ marginBottom: 14, overflow: 'hidden' }}>
      {/* Action buttons (revealed on swipe) */}
      {isOwner && (
        <View style={[styles.swipeActions, { backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0' }]}>
          <TouchableOpacity
            onPress={() => { closeSwipe(); onEdit(comment); }}
            style={[styles.swipeBtn, { backgroundColor: brand.blue || '#0A84FF' }]}
          >
            <Ionicons name="create-outline" size={18} color="#FFF" />
            <Text style={styles.swipeBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { closeSwipe(); onDelete(comment); }}
            style={[styles.swipeBtn, { backgroundColor: '#FF3B30' }]}
          >
            <Ionicons name="trash-outline" size={18} color="#FFF" />
            <Text style={styles.swipeBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Comment content */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }], backgroundColor: isDark ? '#121212' : '#fff' }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={() => isOwner && (haptic('medium'), setIsOpen(!isOpen), Animated.spring(translateX, { toValue: isOpen ? 0 : -ACTION_WIDTH, useNativeDriver: true, speed: 20, bounciness: 6 }).start())}
          style={styles.commentRow}
        >
          {/* Avatar */}
          <TouchableOpacity onPress={() => onUserPress(comment)} activeOpacity={0.8}>
            {comment.avatar ? (
              <Image source={{ uri: comment.avatar }} style={[styles.avatar, { backgroundColor: isDark ? '#333' : '#eee' }]} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: (brand.blue || '#0A84FF') + '33' }]}>
                <Text style={{ color: brand.blue || '#0A84FF', fontWeight: '900', fontSize: 14 }}>{avatarLetter}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Bubble */}
          <View style={[
            styles.bubble,
            { backgroundColor: isDark ? '#1C1C1E' : '#F2F3F5' },
            comment.id?.toString().startsWith('temp-') && { opacity: 0.7 },
          ]}>
            <View style={styles.bubbleHeader}>
              <TouchableOpacity onPress={() => onUserPress(comment)}>
                <Text style={[styles.username, { color: isDark ? '#E0E0E0' : '#222' }]}>
                  {comment.username || 'User'}
                  {String(comment.userId) === String(currentUserId) && (
                    <Text style={{ color: brand.blue || '#0A84FF', fontWeight: '700', fontSize: 10 }}> · You</Text>
                  )}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.time, { color: isDark ? '#666' : '#aaa' }]}>
                {comment.id?.toString().startsWith('temp-') ? 'Sending…' : formatTimeAgo(comment.timestamp)}
              </Text>
            </View>
            <Text style={[styles.commentText, { color: isDark ? '#FFF' : '#111' }]}>{comment.text}</Text>
            {comment.edited && (
              <Text style={{ color: isDark ? '#666' : '#aaa', fontSize: 9, marginTop: 3, fontStyle: 'italic' }}>edited</Text>
            )}
          </View>

          {/* Swipe hint icon for own comments */}
          {isOwner && !isOpen && (
            <Ionicons name="chevron-back" size={12} color={isDark ? '#444' : '#ccc'} style={{ marginLeft: 4 }} />
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN MODAL
// ═══════════════════════════════════════════════════════════════════════════════
export function PostCommentsModal({ postId, apiPostId, visible, onClose }) {
  // effectiveApiId: the real Post ID to use for server calls.
  // Falls back to postId when apiPostId is not provided (e.g. non-pulse posts).
  const effectiveApiId = apiPostId || postId;

  const {
    user,
    posts,
    pulses,
    createComment,
    deleteComment,
    editComment,
    setProfilePeekUser,
    userSettings,
    fetchPosts,
    fetchActivePulses,
    refreshAllData,
  } = useAppStore((state) => ({
    user:               state.user,
    posts:              state.posts     || [],
    pulses:             state.pulses    || [],
    createComment:      state.createComment,
    deleteComment:      state.deleteComment,
    editComment:        state.editComment,
    setProfilePeekUser: state.setProfilePeekUser,
    userSettings:       state.userSettings,
    fetchPosts:         state.fetchPosts,
    fetchActivePulses:  state.fetchActivePulses,
    refreshAllData:     state.refreshAllData,
  }));

  const isDark = userSettings?.darkMode !== false;

  const [inputText,        setInputText]        = useState('');
  const [isSubmitting,     setIsSubmitting]      = useState(false);
  const [editingComment,   setEditingComment]    = useState(null); // full comment object
  const [liveComments,     setLiveComments]      = useState([]);
  const scrollRef  = useRef(null);
  const inputRef   = useRef(null);

  // ── Resolve current post from store ─────────────────────────────────────────
  const currentPost = useMemo(() =>
    posts.find((p) => String(p.id) === String(postId)) ||
    pulses.find((p) => String(p.id) === String(postId)),
  [posts, pulses, postId]);

  // ── Sync live comments when the store updates ────────────────────────────────
  useEffect(() => {
    setLiveComments(currentPost?.comments || []);
  }, [currentPost?.comments]);

  // ── Reset when modal closes or postId changes ────────────────────────────────
  useEffect(() => {
    if (!visible) {
      setInputText('');
      setEditingComment(null);
      setIsSubmitting(false);
    }
  }, [visible]);

  useEffect(() => {
    setInputText('');
    setEditingComment(null);
    setLiveComments(currentPost?.comments || []);
  }, [postId]);

  // ── Sync from server when modal opens ────────────────────────────────────────
  useEffect(() => {
    if (visible && postId) {
      // Refresh both pulses and posts so the latest comments are shown
      fetchActivePulses?.().catch(() => {});
      fetchPosts?.().catch(() => {});
    }
  }, [visible, postId]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  SUBMIT (create or update)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSubmitting || !postId) return;

    setIsSubmitting(true);
    // effectiveApiId → Post ID for server   |   postId → Pulse ID for store update
    const safeApiId   = String(effectiveApiId);
    const safeStoreId = String(postId);

    try {
      if (editingComment) {
        // ── EDIT ──────────────────────────────────────────────────────────────
        const updatedComment = { ...editingComment, text, edited: true };

        // Optimistic
        setLiveComments((prev) =>
          prev.map((c) => String(c.id) === String(editingComment.id) ? updatedComment : c)
        );
        setInputText('');
        setEditingComment(null);

        if (editComment) {
          const result = await editComment(safeApiId, String(editingComment.id), text, safeStoreId);
          if (result !== false) {
            await fetchActivePulses?.();
            haptic('success');
          } else {
            throw new Error('Edit returned false');
          }
        }
      } else {
        // ── CREATE ────────────────────────────────────────────────────────────
        const tempId = `temp-${Date.now()}`;
        const instant = {
          id:        tempId,
          text,
          userId:    user?.id,
          username:  user?.username || user?.name || 'Me',
          avatar:    user?.avatarUrl || null,
          timestamp: new Date().toISOString(),
        };

        setLiveComments((prev) => [...prev, instant]);
        setInputText('');
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

        if (createComment) {
          // Pass safeStoreId so the slice updates the correct pulse in the store
          const result = await createComment(safeApiId, text, null, safeStoreId);
          if (result !== false) {
            await fetchActivePulses?.();
            haptic('success');
            // Replace temp comment with real one from store
            setLiveComments((prev) => {
              const fresh = currentPost?.comments || [];
              return fresh.length > 0 ? fresh : prev.filter((c) => c.id !== tempId);
            });
          }
        }
      }
    } catch (err) {
      haptic('error');
      const msg = String(err?.message || '').toLowerCase();
      const isNet = msg.includes('network') || msg.includes('fetch') || msg.includes('timeout');
      Alert.alert(
        isNet ? 'Connection Error' : "Couldn't Save",
        isNet ? 'Check your connection and try again.' : (err?.message || 'Something went wrong.')
      );
      // Rollback on create failure
      if (!editingComment) {
        setLiveComments((prev) => prev.filter((c) => !String(c.id).startsWith('temp-')));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [inputText, isSubmitting, postId, effectiveApiId, editingComment, editComment, createComment, fetchActivePulses, user, currentPost]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  DELETE
  // ─────────────────────────────────────────────────────────────────────────────
  const handleDelete = useCallback((comment) => {
    Alert.alert(
      'Delete Comment?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            haptic('medium');
            // Optimistic remove
            setLiveComments((prev) => prev.filter((c) => String(c.id) !== String(comment.id)));

            try {
              if (deleteComment) {
                await deleteComment(String(effectiveApiId), String(comment.id), String(postId));
                await fetchActivePulses?.();
                haptic('success');
              }
            } catch (err) {
              haptic('error');
              // Rollback
              setLiveComments((prev) => [...prev, comment].sort((a, b) =>
                new Date(a.timestamp) - new Date(b.timestamp)
              ));
              Alert.alert("Couldn't Delete", err?.message || 'Please try again.');
            }
          },
        },
      ]
    );
  }, [deleteComment, effectiveApiId, postId, fetchActivePulses]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  EDIT INITIATION
  // ─────────────────────────────────────────────────────────────────────────────
  const handleEditStart = useCallback((comment) => {
    haptic('select');
    setEditingComment(comment);
    setInputText(comment.text || '');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingComment(null);
    setInputText('');
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  //  USER PRESS
  // ─────────────────────────────────────────────────────────────────────────────
  const handleUserPress = useCallback((comment) => {
    if (!comment?.userId || !setProfilePeekUser) return;
    setProfilePeekUser({ id: comment.userId, name: comment.username || 'User', avatarUrl: comment.avatar });
  }, [setProfilePeekUser]);

  if (!visible) return null;

  const ACCENT = brand?.blue || '#0A84FF';
  const BG     = isDark ? '#0D0D0D' : '#FFFFFF';
  const BORDER = isDark ? '#2A2A2A' : '#F0F0F0';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={IS_IOS ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={[styles.keyboardView, { backgroundColor: BG }]}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { borderBottomColor: BORDER }]}>
          <View style={styles.dragHandle} />
          <View style={styles.headerContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: ACCENT + '22', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chatbubbles" size={16} color={ACCENT} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: isDark ? '#FFF' : '#111' }]}>Comments</Text>
                <Text style={{ color: isDark ? '#666' : '#AAA', fontSize: 11, fontWeight: '600' }}>
                  {liveComments.length} {liveComments.length === 1 ? 'vibe' : 'vibes'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={isDark ? '#AAA' : '#888'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Comment list ── */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, liveComments.length === 0 && { flex: 1 }]}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {liveComments.length === 0 && !isSubmitting ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>💬</Text>
              <Text style={{ color: isDark ? '#FFF' : '#111', fontWeight: '800', fontSize: 18, marginBottom: 6 }}>
                No vibes yet
              </Text>
              <Text style={{ color: isDark ? '#666' : '#AAA', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                Be the first to drop a comment on this pulse!
              </Text>
            </View>
          ) : (
            <>
              {/* Swipe hint (shown once at top) */}
              {liveComments.some((c) => String(c.userId) === String(user?.id)) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, paddingHorizontal: 4, opacity: 0.5 }}>
                  <Ionicons name="swap-horizontal-outline" size={12} color={isDark ? '#666' : '#AAA'} />
                  <Text style={{ color: isDark ? '#666' : '#AAA', fontSize: 10, fontWeight: '600' }}>
                    Swipe your comments left to edit or delete
                  </Text>
                </View>
              )}

              {liveComments.map((comment, index) => (
                <CommentRow
                  key={comment.id ? String(comment.id) : `c-${index}`}
                  comment={comment}
                  currentUserId={user?.id}
                  isDark={isDark}
                  onEdit={handleEditStart}
                  onDelete={handleDelete}
                  onUserPress={handleUserPress}
                />
              ))}
            </>
          )}

          {isSubmitting && (
            <ActivityIndicator color={ACCENT} style={{ marginTop: 8, marginBottom: 4 }} />
          )}
        </ScrollView>

        {/* ── Edit banner ── */}
        {editingComment && (
          <View style={[styles.editBanner, { backgroundColor: isDark ? '#1C1C1E' : '#F8F0FF', borderTopColor: ACCENT + '44' }]}>
            <Ionicons name="create-outline" size={14} color={ACCENT} />
            <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '700', flex: 1, marginLeft: 6 }}>
              Editing comment
            </Text>
            <TouchableOpacity onPress={handleCancelEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: '#FF3B30', fontSize: 12, fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Input bar ── */}
        <View style={[styles.inputContainer, { borderTopColor: BORDER, backgroundColor: BG }]}>
          {/* User avatar */}
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.inputAvatar} />
          ) : (
            <View style={[styles.inputAvatar, styles.avatarFallback, { backgroundColor: ACCENT + '33' }]}>
              <Text style={{ color: ACCENT, fontWeight: '900', fontSize: 13 }}>
                {(user?.username || user?.name || 'M').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Text input */}
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                backgroundColor: isDark ? '#1C1C1E' : '#F5F5F5',
                color: isDark ? '#FFF' : '#000',
                borderColor: editingComment ? ACCENT + '88' : (isDark ? '#2A2A2A' : '#E8E8E8'),
              },
            ]}
            placeholder={editingComment ? 'Update your comment…' : 'Share your vibe…'}
            placeholderTextColor={isDark ? '#555' : '#AAA'}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isSubmitting}
            returnKeyType="default"
            blurOnSubmit={false}
          />

          {/* Send button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!inputText.trim() || isSubmitting}
            activeOpacity={0.7}
            style={[
              styles.sendBtn,
              {
                backgroundColor: inputText.trim() ? ACCENT : (isDark ? '#2A2A2A' : '#F0F0F0'),
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={inputText.trim() ? '#FFF' : (isDark ? '#555' : '#CCC')} />
            ) : (
              <Ionicons
                name={editingComment ? 'checkmark' : 'send'}
                size={18}
                color={inputText.trim() ? '#FFF' : (isDark ? '#555' : '#CCC')}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  keyboardView: { flex: 1 },

  header: {
    borderBottomWidth: 1,
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  dragHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#555',
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerContent: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  scrollContent: { padding: 16, paddingBottom: 8 },

  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingVertical: 60,
  },

  // Comment row
  commentRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 4,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, marginTop: 2 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  bubble: {
    flex: 1, padding: 12,
    borderRadius: 18, borderTopLeftRadius: 4,
  },
  bubbleHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 5,
  },
  username:    { fontWeight: '800', fontSize: 12 },
  time:        { fontSize: 10 },
  commentText: { fontSize: 14, lineHeight: 19 },

  // Swipe actions
  swipeActions: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: ACTION_WIDTH,
    flexDirection: 'row',
    alignItems: 'center', justifyContent: 'flex-end',
    paddingRight: 8,
    gap: 6,
  },
  swipeBtn: {
    width: 58, height: 52, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  swipeBtnText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  // Edit banner
  editBanner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1,
  },

  // Input
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12,
    paddingBottom: IS_IOS ? 32 : 12,
    borderTopWidth: 1,
    gap: 10,
  },
  inputAvatar: { width: 34, height: 34, borderRadius: 17, flexShrink: 0 },
  input: {
    flex: 1,
    borderRadius: 22, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 9,
    fontSize: 15, maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
});