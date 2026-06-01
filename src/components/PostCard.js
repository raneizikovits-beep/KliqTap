// client/src/components/PostCard.js
// ⭐️ KLIQMIND V7.0 — Fixed BUG-B (useShallow), BUG-D (stale state), BUG-I (callback consistency), SEC-1 ⭐️
//
// CHANGES from V6.4:
//   [FIX-B]  Use atomic selectors (or useShallow) instead of object-returning selector.
//            Prevents whole-FlatList re-renders on unrelated state changes.
//   [FIX-D]  editText/editImage no longer captured at first mount; initialized in handleOpenEdit.
//   [FIX-I]  All handlers wrapped in useCallback for stable identity (memo-friendly).
//   [SEC-1]  clipboard fallback for browsers without navigator.clipboard.
//   [UX]     Optimistic like with rollback on toggleLike failure.

import React, { useState, useRef, memo, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, Share,
  Alert, Modal, TextInput, Dimensions, StyleSheet, Animated,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { useShallow } from 'zustand/react/shallow';
import { brand, imageFor } from '../constants/data';
import { styles as globalStyles } from '../constants/styles';
import { useAppStore } from '../store/useAppStore';

const { width } = Dimensions.get('window');

const VIBES = [
  { id: 'electric', icon: 'flash', color: '#FFD700', label: 'Electric' },
  { id: 'fire', icon: 'flame', color: '#FF4500', label: 'Fire' },
  { id: 'gem', icon: 'diamond', color: '#00FFFF', label: 'Rare' },
  { id: 'rocket', icon: 'rocket', color: '#FF69B4', label: 'Wild' },
  { id: 'galaxy', icon: 'planet', color: '#9370DB', label: 'Magic' },
  { id: 'clover', icon: 'leaf', color: '#32CD32', label: 'Luck' },
  { id: 'skull', icon: 'skull', color: '#555', label: 'Dead' },
  { id: 'drop', icon: 'water', color: '#1E90FF', label: 'Deep' },
  { id: 'vortex', icon: 'aperture', color: '#8A2BE2', label: 'Trippy' },
  { id: 'moon', icon: 'moon', color: '#C0C0C0', label: 'Night' },
  { id: 'cube', icon: 'cube', color: '#4682B4', label: 'Solid' },
  { id: 'alien', icon: 'happy', color: '#7FFF00', label: 'Weird' },
  { id: 'sun', icon: 'sunny', color: '#FFA500', label: 'Warm' },
  { id: 'rose', icon: 'rose', color: '#DC143C', label: 'Lovely' },
  { id: 'music', icon: 'musical-notes', color: '#9400D3', label: 'Vibe' },
  { id: 'trophy', icon: 'trophy', color: '#DAA520', label: 'Win' },
  { id: 'idea', icon: 'bulb', color: '#FFFF00', label: 'Smart' },
  { id: 'anchor', icon: 'boat', color: '#000080', label: 'Anchor' },
];

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
const isVideoUri = (uri) => {
  if (!uri || typeof uri !== 'string') return false;
  const lower = uri.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

const PostActionIcon = memo(({ iconName, count, color, onPress, onLongPress, size = 26, style, isDark }) => (
  <TouchableOpacity
    onPress={onPress}
    onLongPress={onLongPress}
    delayLongPress={250}
    style={[localStyles.actionIcon, style]}
    activeOpacity={0.6}
    accessibilityRole="button"
  >
    <Ionicons name={iconName} size={size} color={color || (isDark ? '#ddd' : brand.ink)} />
    {count > 0 && <Text style={[localStyles.actionText, { color: isDark ? '#fff' : '#000' }]}>{count}</Text>}
  </TouchableOpacity>
));

const PostCard = ({ post, onOpenProfile, onOpenComments, isDark }) => {
  // ⭐️ [FIX-B] useShallow prevents new-object identity on every store change.
  const {
    user, deletePost, editPost, repostPost, fetchProfilePreview,
    toggleLike, setPulseCreateOpen, setPulseImageUri,
  } = useAppStore(
    useShallow((state) => ({
      user: state.user,
      deletePost: state.deletePost,
      editPost: state.editPost,
      repostPost: state.repostPost,
      fetchProfilePreview: state.fetchProfilePreview,
      toggleLike: state.toggleLike,
      setPulseCreateOpen: state.setPulseCreateOpen,
      setPulseImageUri: state.setPulseImageUri,
    }))
  );

  const [selectedVibe, setSelectedVibe] = useState(null);
  const [showVibeMenu, setShowVibeMenu] = useState(false);
  const vibeMenuAnim = useRef(new Animated.Value(0)).current;

  const [likeCount, setLikeCount] = useState(post?.stats?.likes || 0);
  const [isSaved, setIsSaved] = useState(false);

  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  // ⭐️ [FIX-D] Edit state starts empty; populated only when opening edit modal.
  const [editText, setEditText] = useState('');
  const [editImage, setEditImage] = useState(null);
  const [isNewImagePicked, setIsNewImagePicked] = useState(false);
  const [isImageDeleted, setIsImageDeleted] = useState(false);

  // Schema mapping with fallbacks (server may return either shape)
  const postTextContent = post?.text || post?.content || '';
  const mediaUri = post?.imageUrl || post?.image;

  // Sync server like count → local optimistic state
  useEffect(() => {
    setLikeCount(post?.stats?.likes || 0);
  }, [post?.stats?.likes]);

  // Derived flags
  const hasValidImage = !!mediaUri && mediaUri !== 'null' && typeof mediaUri === 'string' && mediaUri.trim() !== '';
  const isVideoFile = hasValidImage && isVideoUri(mediaUri);

  const originalPost = post?.originalPost || post?.repost || post?.sharedPost;
  const originalMediaUri = originalPost?.imageUrl || originalPost?.image;
  const hasOriginalImage = !!originalMediaUri && originalMediaUri !== 'null' && typeof originalMediaUri === 'string' && originalMediaUri.trim() !== '';
  const isOriginalVideoFile = hasOriginalImage && isVideoUri(originalMediaUri);
  const repostTextContent = originalPost?.text || originalPost?.content || '';

  const authorName = post?.user?.name || post?.user?.username || post?.author?.name || 'Unknown';
  const avatar = post?.user?.avatarUrl || post?.user?.img || post?.author?.avatarUrl || imageFor(authorName);

  const currentUserId = String(user?.id || '');
  const rawAuthorId = post?.authorId || post?.user?.id || post?.author?.id;
  const postAuthorId = rawAuthorId ? String(rawAuthorId) : null;
  const canManage = !!currentUserId && !!postAuthorId && currentUserId === postAuthorId;

  // ⭐️ [FIX-I] All handlers are useCallback for stable refs.
  const handleEditSave = useCallback(() => {
    const textChanged = editText.trim() !== postTextContent.trim();
    const imageChanged = isNewImagePicked || (isImageDeleted && hasValidImage);

    if (textChanged || imageChanged) {
      editPost(String(post.id), editText.trim(), isNewImagePicked ? editImage : null, isImageDeleted);
    }
    setShowEditModal(false);
  }, [editText, postTextContent, isNewImagePicked, isImageDeleted, hasValidImage, editPost, post?.id, editImage]);

  const handleOpenProfile = useCallback(() => {
    if (postAuthorId && fetchProfilePreview) {
      fetchProfilePreview(postAuthorId);
    }
  }, [postAuthorId, fetchProfilePreview]);

  const handleLongPressVibe = useCallback(() => {
    setShowVibeMenu(true);
    Animated.spring(vibeMenuAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [vibeMenuAnim]);

  const closeVibeMenu = useCallback(() => {
    Animated.timing(vibeMenuAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => setShowVibeMenu(false));
  }, [vibeMenuAnim]);

  // ⭐️ Optimistic like with rollback on failure
  const performToggleLike = useCallback(async (isUnlike) => {
    const prevCount = likeCount;
    setLikeCount((c) => (isUnlike ? Math.max(0, c - 1) : c + 1));
    try {
      await toggleLike(String(post.id), isUnlike);
    } catch (e) {
      // Roll back on failure
      setLikeCount(prevCount);
      if (Platform.OS !== 'web') {
        Alert.alert('Connection error', 'Could not save your reaction.');
      }
    }
  }, [likeCount, toggleLike, post?.id]);

  const handleSelectVibe = useCallback((vibe) => {
    setSelectedVibe((prev) => {
      if (prev?.id === vibe.id) {
        performToggleLike(true);
        return null;
      }
      if (!prev) performToggleLike(false);
      return vibe;
    });
    closeVibeMenu();
  }, [performToggleLike, closeVibeMenu]);

  const handleQuickPressVibe = useCallback(() => {
    setSelectedVibe((prev) => {
      if (prev) {
        performToggleLike(true);
        return null;
      }
      performToggleLike(false);
      return VIBES[0];
    });
    if (showVibeMenu) closeVibeMenu();
  }, [performToggleLike, showVibeMenu, closeVibeMenu]);

  const handleBookmark = useCallback(() => setIsSaved((p) => !p), []);
  const handleSharePress = useCallback(() => setShowShareMenu(true), []);

  // ⭐️ [SEC-1] Graceful clipboard fallback
  const handleNativeShare = useCallback(async () => {
    setShowShareMenu(false);
    const shareUrl = hasValidImage ? mediaUri : 'https://kliqtap.com';
    const shareMsg = postTextContent || `Check out ${authorName}'s post on KliqTap!`;

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title: 'KliqTap', text: shareMsg, url: shareUrl });
        } catch (e) {
          console.warn('Share canceled or failed', e);
        }
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(`${shareMsg} - ${shareUrl}`);
          if (typeof window !== 'undefined') window.alert('Link copied to your clipboard.');
        } catch (e) {
          if (typeof window !== 'undefined') window.alert(`Copy failed. Link: ${shareUrl}`);
        }
      } else if (typeof window !== 'undefined') {
        window.alert(`Share link: ${shareUrl}`);
      }
    } else {
      try {
        await Share.share({ message: shareMsg, url: shareUrl });
      } catch (error) {
        console.warn('Error sharing:', error);
      }
    }
  }, [hasValidImage, mediaUri, postTextContent, authorName]);

  const handleShareToPulse = useCallback(() => {
    setShowShareMenu(false);
    if (hasValidImage) setPulseImageUri(mediaUri);
    else if (hasOriginalImage) setPulseImageUri(originalMediaUri);
    setPulseCreateOpen(true);
  }, [hasValidImage, mediaUri, hasOriginalImage, originalMediaUri, setPulseImageUri, setPulseCreateOpen]);

  const handleRepost = useCallback(async () => {
    setShowShareMenu(false);
    if (repostPost) await repostPost(post);
  }, [repostPost, post]);

  const handleDelete = useCallback(() => {
    setShowMenu(false);
    const postIdToDelete = String(post?.id);
    if (!postIdToDelete || postIdToDelete === 'undefined') return;

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm
        ? window.confirm('Are you sure you want to delete this post?')
        : true;
      if (confirmed && deletePost) deletePost(postIdToDelete);
    } else {
      Alert.alert(
        'Delete Kliq Feed', 'Are you sure you want to delete this post?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deletePost(postIdToDelete) },
        ]
      );
    }
  }, [post?.id, deletePost]);

  const pickImageForEdit = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: Platform.OS !== 'web',
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      setEditImage(result.assets[0].uri);
      setIsNewImagePicked(true);
      setIsImageDeleted(false);
    }
  }, []);

  const removeImageInEdit = useCallback(() => {
    setEditImage(null);
    setIsImageDeleted(true);
    setIsNewImagePicked(false);
  }, []);

  // ⭐️ [FIX-D] Populate edit state from CURRENT post at moment of opening.
  const handleOpenEdit = useCallback(() => {
    setShowMenu(false);
    setEditText(postTextContent);
    setEditImage(hasValidImage ? mediaUri : null);
    setIsImageDeleted(false);
    setIsNewImagePicked(false);
    setShowEditModal(true);
  }, [postTextContent, hasValidImage, mediaUri]);

  if (!post) return null;

  const mainVibeIconName = selectedVibe ? selectedVibe.icon : 'sparkles-outline';
  const mainVibeColor = selectedVibe ? selectedVibe.color : (isDark ? '#ddd' : brand.ink);

  const cardBg = isDark ? '#121212' : '#fff';
  const borderColor = isDark ? '#222' : '#EFEFEF';
  const textColor = isDark ? '#ddd' : '#222';
  const subTextColor = isDark ? '#888' : '#888';

  const timestampText = (post.createdAt || post.timestamp || post.time)
    ? new Date(post.createdAt || post.timestamp || post.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Recently';

  return (
    <View style={[localStyles.cardContainer, { backgroundColor: cardBg, borderColor }]}>

      {/* Header */}
      <View style={localStyles.header}>
        <TouchableOpacity style={localStyles.headerLeft} activeOpacity={0.7} onPress={handleOpenProfile}>
          <Image source={{ uri: avatar }} style={[localStyles.avatar, { backgroundColor: isDark ? '#333' : '#eee' }]} />
          <View style={localStyles.userInfo}>
            <Text style={[localStyles.username, { color: isDark ? '#fff' : '#000' }]} numberOfLines={1}>{authorName}</Text>
            <Text style={[localStyles.timestamp, { color: subTextColor }]}>{timestampText}</Text>
          </View>
        </TouchableOpacity>

        {canManage && (
          <TouchableOpacity onPress={() => setShowMenu(true)} style={localStyles.menuIcon} accessibilityLabel="Post options">
            <Ionicons name="ellipsis-horizontal" size={24} color={isDark ? '#888' : brand.soft} />
          </TouchableOpacity>
        )}
      </View>

      {/* Main Content */}
      {postTextContent ? (
        <View style={localStyles.textContainer}>
          <Text style={[localStyles.postText, { color: textColor }]}>{postTextContent}</Text>
        </View>
      ) : null}

      {/* Media */}
      {hasValidImage && (
        <View style={localStyles.naturalImageWrapper}>
          {isVideoFile ? (
            Platform.OS === 'web' ? (
              <video src={mediaUri} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls playsInline />
            ) : (
              <Video source={{ uri: mediaUri }} style={localStyles.naturalImage} useNativeControls={true} resizeMode={ResizeMode.COVER} isLooping={false} shouldPlay={false} />
            )
          ) : (
            <Image source={{ uri: mediaUri }} style={localStyles.naturalImage} resizeMode="contain" />
          )}
        </View>
      )}

      {/* Repost Box */}
      {originalPost && (
        <View style={[localStyles.repostBox, { borderColor: isDark ? '#333' : '#ddd', backgroundColor: isDark ? '#1A1A1A' : '#FAFAFA' }]}>
          <View style={localStyles.repostHeader}>
            <Image
              source={{ uri: originalPost.user?.avatarUrl || originalPost.author?.avatarUrl || imageFor(originalPost.user?.name || 'User') }}
              style={localStyles.repostAvatar}
            />
            <Text style={[localStyles.repostUsername, { color: isDark ? '#fff' : '#000' }]}>
              {originalPost.user?.name || originalPost.user?.username || 'Unknown'}
            </Text>
          </View>
          {repostTextContent ? (
            <Text style={[localStyles.repostText, { color: textColor }]}>{repostTextContent}</Text>
          ) : null}
          {hasOriginalImage && (
            <View style={localStyles.naturalRepostImageWrapper}>
              {isOriginalVideoFile ? (
                Platform.OS === 'web' ? (
                  <video src={originalMediaUri} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls playsInline />
                ) : (
                  <Video source={{ uri: originalMediaUri }} style={localStyles.naturalImage} useNativeControls={true} resizeMode={ResizeMode.COVER} isLooping={false} shouldPlay={false} />
                )
              ) : (
                <Image source={{ uri: originalMediaUri }} style={localStyles.naturalImage} resizeMode="contain" />
              )}
            </View>
          )}
        </View>
      )}

      {/* Action Bar */}
      <View style={localStyles.actionBar}>
        <View style={localStyles.actionRowLeft}>
          <View style={localStyles.relativeBox}>
            {showVibeMenu && (
              <Animated.View style={[
                localStyles.vibeMenuContainer,
                { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#eee' },
                {
                  opacity: vibeMenuAnim,
                  transform: [{ scale: vibeMenuAnim }, { translateY: vibeMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
                },
              ]}>
                <View style={localStyles.vibeGrid}>
                  {VIBES.map((vibe) => (
                    <TouchableOpacity
                      key={vibe.id}
                      onPress={() => handleSelectVibe(vibe)}
                      style={[localStyles.vibeOption, { backgroundColor: isDark ? '#333' : '#f8f9fa' }]}
                      accessibilityLabel={`React with ${vibe.label}`}
                    >
                      <Ionicons name={vibe.icon} size={22} color={vibe.color} />
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>
            )}
            <PostActionIcon
              iconName={mainVibeIconName} count={likeCount} color={mainVibeColor}
              onPress={handleQuickPressVibe} onLongPress={handleLongPressVibe}
              size={selectedVibe ? 28 : 26}
              style={selectedVibe && { transform: [{ scale: 1.1 }] }}
              isDark={isDark}
            />
          </View>

          <PostActionIcon
            iconName="chatbubble-outline"
            count={post.stats?.comments || 0}
            onPress={() => onOpenComments && onOpenComments(String(post.id))}
            isDark={isDark}
          />
          <PostActionIcon iconName="paper-plane-outline" count={0} onPress={handleSharePress} isDark={isDark} />
        </View>
        <TouchableOpacity onPress={handleBookmark} style={localStyles.bookmarkBtn} accessibilityLabel={isSaved ? 'Remove bookmark' : 'Save post'}>
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={24} color={isSaved ? brand.blue : (isDark ? '#ddd' : brand.ink)} />
        </TouchableOpacity>
      </View>

      {/* Conditionally mounted modals (memory leak fix preserved from V6.4) */}

      {showShareMenu && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setShowShareMenu(false)}>
          <TouchableOpacity style={[globalStyles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]} activeOpacity={1} onPress={() => setShowShareMenu(false)}>
            <View style={[globalStyles.cardModal, localStyles.shareModalCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
              <Text style={[localStyles.shareTitle, { borderColor: isDark ? '#333' : '#eee', color: isDark ? '#fff' : brand.soft }]}>Share</Text>

              <TouchableOpacity onPress={handleShareToPulse} style={[localStyles.shareOptionRow, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
                <Ionicons name="flash" size={20} color="#E91E63" style={localStyles.shareOptionIcon} />
                <View>
                  <Text style={[localStyles.shareOptionTitle, { color: isDark ? '#fff' : '#000' }]}>Share to Pulse</Text>
                  <Text style={[localStyles.shareOptionSub, { color: isDark ? '#888' : brand.soft }]}>Add this moment to your story</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleRepost} style={[localStyles.shareOptionRow, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
                <Ionicons name="repeat" size={20} color={brand.blue} style={localStyles.shareOptionIcon} />
                <View>
                  <Text style={[localStyles.shareOptionTitle, { color: isDark ? '#fff' : '#000' }]}>Repost to my Wall</Text>
                  <Text style={[localStyles.shareOptionSub, { color: isDark ? '#888' : brand.soft }]}>Share this to your profile feed</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleNativeShare} style={[localStyles.shareOptionRow, { borderBottomWidth: 0 }]}>
                <Ionicons name="share-social" size={20} color={isDark ? '#fff' : brand.ink} style={localStyles.shareOptionIcon} />
                <View>
                  <Text style={[localStyles.shareOptionTitle, { color: isDark ? '#fff' : '#000' }]}>Share via Apps / Copy</Text>
                  <Text style={[localStyles.shareOptionSub, { color: isDark ? '#888' : brand.soft }]}>Send externally or copy link</Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {showMenu && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
          <TouchableOpacity style={[globalStyles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }]} activeOpacity={1} onPress={() => setShowMenu(false)}>
            <View style={[globalStyles.cardModal, localStyles.menuModalCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
              <TouchableOpacity onPress={handleOpenEdit} style={[localStyles.menuOptionRow, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
                <Ionicons name="pencil" size={18} color={isDark ? '#fff' : '#000'} style={localStyles.menuOptionIcon} />
                <Text style={{ color: isDark ? '#fff' : '#000' }}>Edit Kliq Feed</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={[localStyles.menuOptionRow, { borderBottomWidth: 0 }]}>
                <Ionicons name="trash" size={18} color={brand.red} style={localStyles.menuOptionIcon} />
                <Text style={localStyles.menuDangerText}>Delete Kliq Feed</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {showEditModal && (
        <Modal visible={true} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={localStyles.flexOne}>
            <View style={[globalStyles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.5)' }]}>
              <View style={[globalStyles.cardModal, localStyles.editModalCard, { backgroundColor: isDark ? '#121212' : '#fff' }]}>

                <ScrollView contentContainerStyle={localStyles.editScrollContent} keyboardShouldPersistTaps="handled">
                  <Text style={[globalStyles.h1, { color: isDark ? '#fff' : '#000' }]}>Edit Kliq Feed</Text>

                  <TextInput
                    style={[
                      globalStyles.input, localStyles.editInput,
                      { backgroundColor: isDark ? '#1C1C1E' : '#F5F5F5', color: isDark ? '#fff' : '#000', borderColor: isDark ? '#333' : '#eee', borderWidth: 1 },
                    ]}
                    value={editText}
                    onChangeText={setEditText}
                    multiline
                    placeholder="What's on your mind?"
                    placeholderTextColor={isDark ? '#888' : '#999'}
                  />

                  <View style={localStyles.editImageWrapper}>
                    {editImage ? (
                      <View style={[localStyles.editImageContainer, { backgroundColor: isDark ? '#1C1C1E' : '#f0f0f0' }]}>
                        <Image source={{ uri: editImage }} style={localStyles.fullImg} resizeMode="cover" />
                        <TouchableOpacity onPress={removeImageInEdit} style={localStyles.editImageCloseBtn}>
                          <Ionicons name="close" size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={pickImageForEdit} style={[localStyles.addPhotoBtn, { backgroundColor: isDark ? '#102A43' : '#F0F8FF', borderColor: brand.blue }]}>
                        <Ionicons name="image" size={24} color={brand.blue} />
                        <Text style={localStyles.addPhotoText}>Add Photo</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>

                <View style={[localStyles.editFooter, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderTopColor: isDark ? '#333' : '#eee' }]}>
                  <TouchableOpacity onPress={() => setShowEditModal(false)} style={[localStyles.editCancelBtn, { backgroundColor: isDark ? '#333' : '#f0f2f5' }]}>
                    <Text style={[localStyles.editCancelText, { color: isDark ? '#ddd' : '#444' }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[localStyles.editSaveBtn, { backgroundColor: isDark ? '#fff' : brand.ink }]} onPress={handleEditSave}>
                    <Text style={[localStyles.editSaveText, { color: isDark ? '#000' : '#fff' }]}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
};

export default memo(PostCard);

const localStyles = StyleSheet.create({
  flexOne: { flex: 1 },
  fullImg: { width: '100%', height: '100%' },
  cardContainer: { marginBottom: 10, borderTopWidth: 1, borderBottomWidth: 1, paddingBottom: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  userInfo: { marginLeft: 10, flex: 1 },
  username: { fontWeight: '700', fontSize: 14 },
  timestamp: { fontSize: 11 },
  menuIcon: { padding: 10, paddingRight: 0 },
  textContainer: { paddingHorizontal: 12, paddingBottom: 10 },
  postText: { fontSize: 15, lineHeight: 22 },
  naturalImageWrapper: { width: '100%', aspectRatio: 1, backgroundColor: 'transparent', overflow: 'hidden', marginVertical: 4 },
  naturalImage: { width: '100%', height: '100%' },
  repostBox: { marginHorizontal: 12, marginBottom: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  repostHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  repostAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: 8 },
  repostUsername: { fontWeight: '600', fontSize: 13 },
  repostText: { fontSize: 14, lineHeight: 20 },
  naturalRepostImageWrapper: { width: '100%', aspectRatio: 1, backgroundColor: 'transparent', overflow: 'hidden', borderRadius: 8, marginTop: 10 },
  actionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4, zIndex: 20 },
  actionRowLeft: { flexDirection: 'row', gap: 20, alignItems: 'center' },
  relativeBox: { position: 'relative', alignItems: 'center', overflow: 'visible' },
  bookmarkBtn: { padding: 5 },
  actionIcon: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  actionText: { marginLeft: 6, fontWeight: '600', fontSize: 14 },
  vibeMenuContainer: { position: 'absolute', bottom: 50, left: -10, borderRadius: 20, padding: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10, borderWidth: 1, width: 260 },
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  vibeOption: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  shareModalCard: { position: 'absolute', bottom: 100, width: '90%', alignSelf: 'center', padding: 0 },
  shareTitle: { padding: 15, fontWeight: 'bold', textAlign: 'center', borderBottomWidth: 1 },
  shareOptionRow: { padding: 15, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' },
  shareOptionIcon: { marginRight: 10 },
  shareOptionTitle: { fontSize: 16, fontWeight: '600' },
  shareOptionSub: { fontSize: 12 },
  menuModalCard: { alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto', width: 250, padding: 0 },
  menuOptionRow: { padding: 15, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' },
  menuOptionIcon: { marginRight: 10 },
  menuDangerText: { color: brand.red },
  editModalCard: { height: 'auto', maxHeight: '90%', padding: 0, overflow: 'hidden', borderRadius: 24 },
  editScrollContent: { padding: 20, paddingBottom: 10 },
  editInput: { height: 100, textAlignVertical: 'top', paddingTop: 12, marginBottom: 15, fontSize: 16, borderRadius: 12 },
  editImageWrapper: { marginVertical: 10 },
  editImageContainer: { position: 'relative', width: '100%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden' },
  editImageCloseBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 },
  addPhotoBtn: { width: '100%', height: 60, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  addPhotoText: { color: brand.blue, fontWeight: '600', fontSize: 16 },
  editFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, paddingBottom: 25, borderTopWidth: 1, gap: 12 },
  editCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 25, alignItems: 'center' },
  editCancelText: { fontWeight: 'bold', fontSize: 15 },
  editSaveBtn: { flex: 1, paddingVertical: 14, borderRadius: 25, alignItems: 'center' },
  editSaveText: { fontWeight: 'bold', fontSize: 15 },
});