// client/src/components/PostCard.js
// ⭐️ KLIQMIND V8.8 — Fully Merged V7.0 with Persistent Likes, Native Emoji Keyboard, Share List Modal & Accessible Counters ⭐️

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
import { trackEvent } from '../utils/analytics';

// ⭐️ הייבוא של החלון החדש מהתיקייה שיצרת!
import PostSharesModal from './modals/PostSharesModal';

// ─── Trust & Safety: Report Helper ─────────────────────────────────────────
async function _submitSecurityReport(reportedId, reason, token) {
  if (!reportedId || !token) return false;
  try {
    const resp = await fetch('https://api.kliqtap.com/security/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ reportedId: String(reportedId), reason }),
    });
    return resp.ok;
  } catch { return false; }
}
// ─────────────────────────────────────────────────────────────────────────────

const { width } = Dimensions.get('window');

const VIBES = [
  { id: 'heart', icon: '❤️', label: 'Love' },
  { id: 'thumbsup', icon: '👍', label: 'Like' },
  { id: 'fire', icon: '🔥', label: 'Fire' },
  { id: 'laugh', icon: '😂', label: 'Haha' },
  { id: 'wow', icon: '😮', label: 'Wow' },
  { id: 'sad', icon: '😢', label: 'Sad' },
  { id: 'party', icon: '🥳', label: 'Party' },
  { id: 'clover', icon: '🍀', label: 'Luck' },
  { id: 'rocket', icon: '🚀', label: 'Rocket' },
  { id: 'star', icon: '⭐', label: 'Star' },
  { id: 'sunglasses', icon: '😎', label: 'Cool' },
  { id: 'muscle', icon: '💪', label: 'Strong' },
  { id: 'thinking', icon: '🤔', label: 'Think' },
  { id: '100', icon: '💯', label: '100' },
  { id: 'wave', icon: '👋', label: 'Wave' },
  { id: 'praying', icon: '🙏', label: 'Thanks' },
  { id: 'loveeyes', icon: '😍', label: 'Lovely' },
  { id: 'music', icon: '🎵', label: 'Music' },
  { id: 'trophy', icon: '🏆', label: 'Win' },
  { id: 'bulb', icon: '💡', label: 'Idea' },
  { id: 'coffee', icon: '☕', label: 'Coffee' },
  { id: 'sunset', icon: '🌅', label: 'Sunset' },
  { id: 'ocean', icon: '🌊', label: 'Ocean' },
  { id: 'peace', icon: '✌️', label: 'Peace' },
];

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
const isVideoUri = (uri) => {
  if (!uri || typeof uri !== 'string') return false;
  const lower = uri.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

const PostActionIcon = memo(({ iconName, customEmoji, count, color, onPress, onLongPress, onCountPress, size = 26, style, isDark, isActive }) => (
  <View style={[localStyles.actionIcon, style]}>
    {/* כפתור האייקון עם hitSlop */}
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      activeOpacity={0.6}
      accessibilityRole="button"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 5 }}
    >
      {customEmoji ? (
         <Text style={{ fontSize: size }}>{customEmoji}</Text>
      ) : (
         <Ionicons name={isActive ? iconName.replace('-outline', '') : iconName} size={size} color={isActive ? color : (isDark ? '#ddd' : brand.ink)} />
      )}
    </TouchableOpacity>

    {/* כפתור המספר עם העיצוב החדש והנגיש */}
    {count > 0 && (
      <TouchableOpacity 
        onPress={onCountPress || onPress} 
        hitSlop={{ top: 15, bottom: 15, left: 5, right: 15 }} 
        style={[localStyles.countBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]}
      >
         <Text style={[localStyles.actionText, { color: isDark ? '#ccc' : '#444' }]}>{count}</Text>
      </TouchableOpacity>
    )}
  </View>
));

const PostCard = ({ post, onOpenProfile, onOpenComments, onOpenLikes, isDark }) => {
  const {
    user, deletePost, editPost, repostPost, fetchProfilePreview,
    toggleLike, setPulseCreateOpen, setPulseImageUri, token,
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
      token: state.token,
    }))
  );

  const [isLiked, setIsLiked] = useState(post?.stats?.isLikedByMe || false);
  const [myVibe, setMyVibe] = useState(post?.stats?.myVibe || null);
  const [likeCount, setLikeCount] = useState(post?.stats?.likes || 0);

  const [showVibeMenu, setShowVibeMenu] = useState(false);
  const vibeMenuAnim = useRef(new Animated.Value(0)).current;
  const emojiInputRef = useRef(null);

  const [isSaved, setIsSaved] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  
  // ⭐️ State חדש לשליטה בחלון משתפים!
  const [isSharesModalVisible, setSharesModalVisible] = useState(false);

  const [editText, setEditText] = useState('');
  const [editImage, setEditImage] = useState(null);
  const [isNewImagePicked, setIsNewImagePicked] = useState(false);
  const [isImageDeleted, setIsImageDeleted] = useState(false);
  // ⭐️ FIX [IMAGE CROPPING]: dynamic aspect ratio per image.
  // Default 4/3 is a reasonable placeholder before the image loads —
  // avoids a jarring layout jump while keeping the feed stable.
  // onLoad updates it to the image's actual ratio so the container
  // always matches the photo exactly (no white bars, no cropping).
  const [imageAspectRatio, setImageAspectRatio] = useState(4 / 3);
  const [repostImageAspectRatio, setRepostImageAspectRatio] = useState(4 / 3);

  useEffect(() => {
    setLikeCount(post?.stats?.likes || 0);
    setIsLiked(post?.stats?.isLikedByMe || false);
    if (post?.stats?.myVibe) {
      setMyVibe(post.stats.myVibe);
    } else if (post?.stats?.isLikedByMe === false) {
      setMyVibe(null);
    }
  }, [post?.stats]);

  const postTextContent = post?.text || post?.content || '';
  const mediaUri = post?.imageUrl || post?.image;
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

  const performToggleLike = useCallback(async (isUnlike, selectedEmoji = null) => {
    const prevCount = likeCount;
    const prevLiked = isLiked;
    const prevVibe = myVibe;

    setIsLiked(!isUnlike);
    setMyVibe(isUnlike ? null : selectedEmoji);
    setLikeCount((c) => (isUnlike ? Math.max(0, c - 1) : c + 1));

    try {
      await toggleLike(String(post.id), isUnlike, selectedEmoji);
    } catch (e) {
      setLikeCount(prevCount); setIsLiked(prevLiked); setMyVibe(prevVibe);
      if (Platform.OS !== 'web') {
        Alert.alert('Connection error', 'Could not save your reaction.');
      }
    }
  }, [likeCount, isLiked, myVibe, toggleLike, post?.id]);

  const handleSelectVibe = useCallback((vibeValue) => {
    if (myVibe === vibeValue && isLiked) {
      performToggleLike(true);
    } else {
      performToggleLike(false, vibeValue);
    }
    closeVibeMenu();
  }, [myVibe, isLiked, performToggleLike, closeVibeMenu]);

  const handleQuickPressVibe = useCallback(() => {
    if (isLiked) {
      performToggleLike(true);
    } else {
      performToggleLike(false, null);
    }
    if (showVibeMenu) closeVibeMenu();
  }, [isLiked, performToggleLike, showVibeMenu, closeVibeMenu]);

  const triggerNativeEmojiKeyboard = useCallback(() => {
    emojiInputRef.current?.focus();
  }, []);

  const onCustomEmojiTyped = (text) => {
    if (!text) return;
    if (/[a-zA-Z0-9א-ת\s\.,!?\-_]/i.test(text)) {
      emojiInputRef.current?.clear();
      return;
    }
    handleSelectVibe(text);
    emojiInputRef.current?.blur();
    emojiInputRef.current?.clear();
  };

  const handleBookmark = useCallback(() => setIsSaved((p) => !p), []);
  const handleSharePress = useCallback(() => setShowShareMenu(true), []);

  const handleNativeShare = useCallback(async () => {
    setShowShareMenu(false);
    trackEvent('post_shared_externally', { postId: post?.id }); 
    const shareUrl = hasValidImage ? mediaUri : 'https://kliqtap.com';
    const shareMsg = postTextContent || `Check out ${authorName}'s post on KliqTap!`;

    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title: 'KliqTap', text: shareMsg, url: shareUrl });
        } catch (e) { console.warn('Share canceled or failed', e); }
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
      try { await Share.share({ message: shareMsg, url: shareUrl }); } catch (error) { console.warn('Error sharing:', error); }
    }
  }, [hasValidImage, mediaUri, postTextContent, authorName, post?.id]);

  const handleShareToPulse = useCallback(() => {
    setShowShareMenu(false);
    if (hasValidImage) setPulseImageUri(mediaUri);
    else if (hasOriginalImage) setPulseImageUri(originalMediaUri);
    setPulseCreateOpen(true);
  }, [hasValidImage, mediaUri, hasOriginalImage, originalMediaUri, setPulseImageUri, setPulseCreateOpen]);

  const handleRepost = useCallback(async () => {
    setShowShareMenu(false);
    trackEvent('post_reposted', { postId: post?.id, authorId: postAuthorId }); 
    if (repostPost) await repostPost(post);
  }, [repostPost, post, postAuthorId]); 

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
      mediaTypes: ImagePicker.MediaType.All,
      allowsEditing: Platform.OS !== 'web',
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
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

  const handleOpenEdit = useCallback(() => {
    setShowMenu(false);
    setEditText(postTextContent);
    setEditImage(hasValidImage ? mediaUri : null);
    setIsImageDeleted(false);
    setIsNewImagePicked(false);
    setShowEditModal(true);
  }, [postTextContent, hasValidImage, mediaUri]);

  const handleReport = useCallback((type) => {
    setShowMenu(false);
    const reasons = type === 'post'
      ? [
          { text: '🚫 Spam or irrelevant',      reason: 'spam' },
          { text: '🔞 Inappropriate content',    reason: 'inappropriate_content' },
          { text: '🤖 Fake / Scam',              reason: 'fake_account' },
          { text: '😤 Harassment',               reason: 'harassment' },
        ]
      : [
          { text: '🤖 Fake account',             reason: 'fake_account' },
          { text: '😤 Harassment or threats',    reason: 'harassment' },
          { text: '💊 Illegal activity',         reason: 'illegal_activity' },
          { text: '🚫 Spam',                     reason: 'spam' },
        ];
    Alert.alert(
      type === 'post' ? 'Report Kliq Feed' : 'Report User',
      'Why are you reporting this?',
      [
        { text: 'Cancel', style: 'cancel' },
        ...reasons.map(({ text, reason }) => ({
          text,
          onPress: () => _doReport(reason),
        })),
      ],
    );
  }, []);

  const _doReport = useCallback(async (reason) => {
    if (!postAuthorId || isReporting) return;
    setIsReporting(true);
    const ok = await _submitSecurityReport(postAuthorId, reason, token);
    setIsReporting(false);
    if (ok) {
      Alert.alert('✅ Reported', 'Thank you for keeping KliqTap safe. Our team will review this.');
    } else {
      Alert.alert('Error', 'Could not submit your report. Please try again.');
    }
  }, [postAuthorId, token, isReporting]);

  if (!post) return null;

  let mainVibeIconName = 'heart-outline';
  let mainVibeColor = isDark ? '#ddd' : brand.ink;
  let customTextEmoji = null;

  if (isLiked && myVibe) {
    customTextEmoji = myVibe;
    mainVibeColor   = brand.blue;
  } else if (isLiked) {
    mainVibeIconName = 'heart'; 
    mainVibeColor   = '#FF2D55'; 
  }

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

        {!!currentUserId && (
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
        <View style={[localStyles.naturalImageWrapper, { aspectRatio: imageAspectRatio }]}>
          {isVideoFile ? (
            Platform.OS === 'web' ? (
              <video src={mediaUri} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls playsInline />
            ) : (
              <Video source={{ uri: mediaUri }} style={localStyles.naturalImage} useNativeControls={true} resizeMode={ResizeMode.COVER} isLooping={false} shouldPlay={false} />
            )
          ) : (
            <Image
              source={{ uri: mediaUri }}
              style={localStyles.naturalImage}
              resizeMode="cover"
              onLoad={(e) => {
                const { width: w, height: h } = e.nativeEvent.source;
                if (w && h && h > 0) setImageAspectRatio(w / h);
              }}
            />
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
            <View style={[localStyles.naturalRepostImageWrapper, { aspectRatio: repostImageAspectRatio }]}>
              {isOriginalVideoFile ? (
                Platform.OS === 'web' ? (
                  <video src={originalMediaUri} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls playsInline />
                ) : (
                  <Video source={{ uri: originalMediaUri }} style={localStyles.naturalImage} useNativeControls={true} resizeMode={ResizeMode.COVER} isLooping={false} shouldPlay={false} />
                )
              ) : (
                <Image
                  source={{ uri: originalMediaUri }}
                  style={localStyles.naturalImage}
                  resizeMode="cover"
                  onLoad={(e) => {
                    const { width: w, height: h } = e.nativeEvent.source;
                    if (w && h && h > 0) setRepostImageAspectRatio(w / h);
                  }}
                />
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
              <TouchableOpacity
                style={localStyles.vibeMenuBackdrop}
                activeOpacity={1}
                onPress={closeVibeMenu}
              />
            )}

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
                  onPress={() => handleSelectVibe(vibe.icon)} 
                  style={[localStyles.vibeOption, { backgroundColor: isDark ? '#333' : '#f8f9fa' }]}
                  >
                  <Text style={{ fontSize: 22 }}>{vibe.icon}</Text>
                  </TouchableOpacity>
                  ))}

                  <TouchableOpacity 
                  onPress={triggerNativeEmojiKeyboard} 
                  style={[localStyles.vibeOption, { backgroundColor: '#FFD700', borderRadius: 20 }]}
                  >
                  <Ionicons name="add" size={24} color="#000" />
                  </TouchableOpacity>

                  <TextInput 
                  ref={emojiInputRef} 
                  style={{ position: 'absolute', left: -1000, width: 1, height: 1, opacity: 0 }} 
                  maxLength={2} 
                  onChangeText={onCustomEmojiTyped} 
                  autoCorrect={false}
                  />

                </View>
              </Animated.View>
            )}

            <PostActionIcon
              iconName={mainVibeIconName} 
              customEmoji={customTextEmoji}
              count={likeCount} 
              color={mainVibeColor}
              isActive={isLiked}
              onPress={handleQuickPressVibe} 
              onLongPress={handleLongPressVibe}
              onCountPress={() => onOpenLikes && onOpenLikes(String(post.id))}
              size={isLiked && myVibe ? 28 : 26}
              style={isLiked && myVibe && { transform: [{ scale: 1.1 }] }}
              isDark={isDark}
            />
          </View>

          <PostActionIcon
            iconName="chatbubble-outline"
            count={post.stats?.comments || 0}
            onPress={() => onOpenComments && onOpenComments(String(post.id))}
            isDark={isDark}
          />

          {/* ⭐️ כפתור השיתופים: אייקון פותח שיתוף, המספר פותח את רשימת המשתפים! */}
          <PostActionIcon 
            iconName="paper-plane-outline" 
            count={post.stats?.shares || 0} 
            onPress={handleSharePress} 
            onCountPress={() => setSharesModalVisible(true)}
            isDark={isDark} 
          />
        </View>
        <TouchableOpacity onPress={handleBookmark} style={localStyles.bookmarkBtn} accessibilityLabel={isSaved ? 'Remove bookmark' : 'Save post'}>
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={24} color={isSaved ? brand.blue : (isDark ? '#ddd' : brand.ink)} />
        </TouchableOpacity>
      </View>

      {/* החלון הקופץ של המשתפים מרונדר כאן בתחתית הכרטיס */}
      {isSharesModalVisible && (
        <PostSharesModal 
          visible={isSharesModalVisible} 
          onClose={() => setSharesModalVisible(false)} 
          postId={post.id} 
        />
      )}

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
              {canManage ? (
                <>
                  <TouchableOpacity onPress={handleOpenEdit} style={[localStyles.menuOptionRow, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
                    <Ionicons name="pencil" size={18} color={isDark ? '#fff' : '#000'} style={localStyles.menuOptionIcon} />
                    <Text style={{ color: isDark ? '#fff' : '#000' }}>Edit Kliq Feed</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDelete} style={[localStyles.menuOptionRow, { borderBottomWidth: 0 }]}>
                    <Ionicons name="trash" size={18} color={brand.red} style={localStyles.menuOptionIcon} />
                    <Text style={localStyles.menuDangerText}>Delete Kliq Feed</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => handleReport('post')}
                    style={[localStyles.menuOptionRow, { borderBottomColor: isDark ? '#333' : '#eee' }]}
                  >
                    <Ionicons name="alert-circle-outline" size={18} color={brand.red} style={localStyles.menuOptionIcon} />
                    <Text style={localStyles.menuDangerText}>Report Kliq Feed</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleReport('user')}
                    style={[localStyles.menuOptionRow, { borderBottomWidth: 0 }]}
                  >
                    <Ionicons name="flag-outline" size={18} color={brand.red} style={localStyles.menuOptionIcon} />
                    <Text style={localStyles.menuDangerText}>Report User</Text>
                  </TouchableOpacity>
                </>
              )}
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
                        {isVideoUri(editImage) ? (
                          Platform.OS === 'web' ? (
                            <video src={editImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls playsInline />
                          ) : (
                            <Video source={{ uri: editImage }} style={localStyles.fullImg} useNativeControls={true} resizeMode={ResizeMode.COVER} isLooping={false} shouldPlay={false} />
                          )
                        ) : (
                          <Image source={{ uri: editImage }} style={localStyles.fullImg} resizeMode="cover" />
                        )}
                        <TouchableOpacity onPress={removeImageInEdit} style={localStyles.editImageCloseBtn}>
                          <Ionicons name="close" size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={pickImageForEdit} style={[localStyles.addPhotoBtn, { backgroundColor: isDark ? '#102A43' : '#F0F8FF', borderColor: brand.blue }]}>
                        <Ionicons name="images" size={24} color={brand.blue} />
                        <Text style={localStyles.addPhotoText}>Add Photo / Video</Text>
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
  naturalImageWrapper: { width: '100%', backgroundColor: 'transparent', overflow: 'hidden', marginVertical: 4 },
  naturalImage: { width: '100%', height: '100%' },
  repostBox: { marginHorizontal: 12, marginBottom: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  repostHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  repostAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: 8 },
  repostUsername: { fontWeight: '600', fontSize: 13 },
  repostText: { fontSize: 14, lineHeight: 20 },
  naturalRepostImageWrapper: { width: '100%', backgroundColor: 'transparent', overflow: 'hidden', borderRadius: 8, marginTop: 10 },
  actionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4, zIndex: 20 },
  actionRowLeft: { flexDirection: 'row', gap: 20, alignItems: 'center' },
  relativeBox: { position: 'relative', alignItems: 'center', overflow: 'visible' },
  vibeMenuBackdrop: { position: 'absolute', top: -1000, bottom: -1000, left: -1000, right: -1000, zIndex: 10, backgroundColor: 'transparent' },
  vibeMenuContainer: { position: 'absolute', bottom: 50, left: 0, zIndex: 20, borderRadius: 20, padding: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10, borderWidth: 1, width: 280 },
  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  vibeOption: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  bookmarkBtn: { padding: 5 },
  
  // ⭐️ העיצובים החדשים של האייקונים והתגיות
  actionIcon: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  actionText: { fontWeight: '600', fontSize: 14 },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ⭐️ סוף העיצובים החדשים

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