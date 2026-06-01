// client/src/screens/ProfileScreen.js
// ✅ V9.0 PRODUCTION: Full architectural refactor — clean, modular, secure, scalable

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  RefreshControl, Alert, ActivityIndicator, StyleSheet,
  Dimensions, Modal, Platform, TextInput, KeyboardAvoidingView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Data from '../constants/data';
import { styles as globalStyles } from '../constants/styles';
import { useAppStore } from '../store/useAppStore';
import PostCard from '../components/PostCard';
import { PostCommentsModal } from '../components/modals/PostCommentsModal';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const { width } = Dimensions.get('window');
const COVER_HEIGHT = 200;
const AVATAR_SIZE = 84;
const GENERIC_COVER = 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=1000';

const TABS = ['posts', 'pulse', 'activity', 'about'];

const VIBE_COLORS = {
  Party: '#FF2D55',
  Happy: '#FFD700',
  Focused: '#6200EE',
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Resolves avatar URL from EVERY possible field name used across the app.
 * This must stay in sync with PostCard / UserCard / chat avatars so the same
 * user always shows the same picture everywhere. Falls back to the default pic.
 */
const AVATAR_KEYS = ['avatarUrl', 'avatar', 'img', 'image', 'photoURL', 'photoUrl', 'profilePic', 'profileImage', 'picture'];
const COVER_KEYS = ['coverUrl', 'coverImage', 'cover', 'bannerUrl', 'banner'];

const resolveAvatar = (user, fallback = Data.USER_PROFILE_PIC) =>
  firstValue(user, AVATAR_KEYS) || fallback;

/**
 * Resolves cover image URL from multiple possible field names.
 * Falls back to a generic Unsplash photo.
 */
const resolveCover = (user, peek, fallback = GENERIC_COVER) =>
  firstValue(user, COVER_KEYS) || firstValue(peek, COVER_KEYS) || fallback;

/**
 * Returns the first non-empty value from an object given a list of keys.
 */
function firstValue(obj, keys) {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}

/**
 * Returns the first non-empty value from an object given inline keys.
 * e.g. getField(user, 'work', 'job', 'company')
 */
const getField = (obj, ...keys) => firstValue(obj, keys);

/**
 * Resolves a numeric count from either a dedicated count field
 * or the length of the array it refers to, avoiding undefined.
 */
const resolveCount = (obj, countKey, arrayKey) =>
  obj?.[countKey] ?? obj?.[arrayKey]?.length ?? 0;

/**
 * Formats a join date ("createdAt") into a friendly "Month Year" string.
 */
const formatJoined = (raw) => {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

/**
 * Formats a birthday value into a clean "Month Day, Year" string.
 * - Accepts ISO strings ("1999-06-15T00:00:00.000Z"), "1999-06-15", etc.
 * - Uses UTC so date-only values never drift a day from the timezone.
 * - If the value isn't a parseable date, returns it untouched.
 */
const formatBirthday = (raw) => {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
};

/**
 * Turns snake_case / lowercase values into Title Case for display
 * (e.g. "in_relationship" -> "In Relationship").
 */
const prettify = (val) => {
  if (!val) return val;
  return String(val)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

// ─────────────────────────────────────────────
// Sub-components (extracted for readability & reuse)
// ─────────────────────────────────────────────

/**
 * Full-screen image viewer modal.
 * Renders on top of everything; closes on button press or back gesture.
 */
const ImageViewerModal = ({ uri, onClose }) => (
  <Modal
    visible={!!uri}
    transparent
    animationType="fade"
    onRequestClose={onClose}
    statusBarTranslucent
  >
    <View style={styles.imageViewerContainer}>
      <TouchableOpacity style={styles.imageViewerCloseBtn} onPress={onClose} accessibilityLabel="Close image viewer">
        <Ionicons name="close" size={32} color="#fff" />
      </TouchableOpacity>
      {!!uri && (
        <Image
          source={{ uri }}
          style={styles.imageViewerImg}
          resizeMode="contain"
        />
      )}
    </View>
  </Modal>
);

/**
 * Cover photo with gradient overlay and optional edit affordance.
 */
const CoverPhoto = ({ uri, isMe, isLoading, isDark, onPress }) => (
  <TouchableOpacity
    style={[styles.fullCoverContainer, { backgroundColor: isDark ? '#1C1C1E' : '#eee' }]}
    onPress={onPress}
    activeOpacity={isMe ? 0.95 : 0.8}
    accessibilityLabel={isMe ? 'Change cover photo' : 'View cover photo'}
  >
    <Image source={{ uri }} style={styles.coverImage} />
    <LinearGradient
      colors={['transparent', isDark ? '#000' : 'rgba(0,0,0,0.7)']}
      style={styles.coverGradient}
    />
    {isMe && (
      <View style={styles.coverEditIcon}>
        <Ionicons name="camera-outline" size={16} color="#fff" />
      </View>
    )}
    {isLoading && <ActivityIndicator color="#fff" style={styles.loaderCenter} />}
  </TouchableOpacity>
);

/**
 * Avatar with loading indicator and tap-to-edit / tap-to-view logic.
 */
const Avatar = ({ uri, isMe, isLoading, isDark, onPress }) => (
  <View style={[styles.avatarWrapper, { borderColor: isDark ? '#000' : '#fff', backgroundColor: isDark ? '#000' : '#fff' }]}>
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityLabel={isMe ? 'Change avatar' : 'View avatar'}
    >
      <Image source={{ uri }} style={styles.mainAvatar} />
      {isLoading && <ActivityIndicator color="#fff" style={styles.loaderCenter} />}
    </TouchableOpacity>
  </View>
);

/**
 * The stats row: Karma / Streak / Badges.
 */
const StatsRow = ({ points, streak, badgeCount, textColor, subTextColor, cardBg, borderColor }) => (
  <View style={[styles.statsContainer, { backgroundColor: cardBg, borderColor }]}>
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color: textColor }]}>{points}</Text>
      <Text style={[styles.statLabel, { color: subTextColor }]}>Karma</Text>
    </View>
    <View style={[styles.statBox, styles.statBoxBorder, { borderColor }]}>
      <Text style={[styles.statValue, { color: textColor }]}>{streak}🔥</Text>
      <Text style={[styles.statLabel, { color: subTextColor }]}>Streak</Text>
    </View>
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color: textColor }]}>{badgeCount}</Text>
      <Text style={[styles.statLabel, { color: subTextColor }]}>Badges</Text>
    </View>
  </View>
);

/**
 * Single follower row inside the followers list.
 */
const FollowerRow = ({ follower, isLast, borderColor, textColor, onPress }) => {
  const fData = follower?.follower || follower?.user || follower;
  return (
    <TouchableOpacity
      style={[
        styles.followerRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: borderColor },
      ]}
      onPress={() => onPress(fData.id)}
      accessibilityLabel={`View profile of ${fData.name || fData.username || 'User'}`}
    >
      <Image
        source={{ uri: resolveAvatar(fData) }}
        style={styles.followerAvatar}
      />
      <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 15 }}>
        {fData.name || fData.username || 'User'}
      </Text>
    </TouchableOpacity>
  );
};

/**
 * A single Facebook-style detail row with INLINE editing.
 *
 * Display mode:
 *   - Has value  -> "[icon] prefix value"  (tap pencil to edit, if owner)
 *   - No value + owner -> "[icon] addLabel" in blue (tap to add)
 *   - No value + visitor -> renders nothing
 *
 * Edit mode (owner only): the row becomes a text input right in place with
 * a ✓ (save) and ✕ (cancel). No modal, no separate screen.
 */
const DetailRow = ({
  icon, prefix, value, addLabel, isMe, theme, fieldKey,
  editingKey, onStartEdit, onSave, onCancel, saving,
  keyboardType, autoCapitalize, placeholder, formatDisplay,
}) => {
  const raw = value && String(value).trim() !== '' ? value : null;
  const display = raw && formatDisplay ? formatDisplay(raw) : raw;
  const isEditing = isMe && editingKey === fieldKey;
  const [draft, setDraft] = useState(raw ?? '');

  // Keep draft in sync when entering edit mode for this field.
  useEffect(() => {
    if (isEditing) setDraft(raw ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  if (!display && !isMe) return null;

  if (isEditing) {
    return (
      <View style={[styles.detailRow, { alignItems: 'center' }]}>
        <Ionicons name={icon} size={20} color={Data.brand.blue} style={styles.detailIcon} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder || addLabel}
          placeholderTextColor={theme.subTextColor}
          autoFocus
          editable={!saving}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'sentences'}
          style={[styles.inlineInput, { color: theme.textColor, borderColor: Data.brand.blue, backgroundColor: theme.inputBg }]}
          onSubmitEditing={() => onSave(fieldKey, draft)}
          returnKeyType="done"
        />
        {saving ? (
          <ActivityIndicator size="small" color={Data.brand.blue} style={{ marginLeft: 6 }} />
        ) : (
          <>
            <TouchableOpacity onPress={() => onSave(fieldKey, draft)} style={styles.inlineBtn} accessibilityLabel="Save">
              <Ionicons name="checkmark" size={22} color={Data.brand.green || '#34C759'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onCancel} style={styles.inlineBtn} accessibilityLabel="Cancel">
              <Ionicons name="close" size={22} color={theme.subTextColor} />
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.detailRow}
      activeOpacity={isMe ? 0.6 : 1}
      disabled={!isMe}
      onPress={isMe ? () => onStartEdit(fieldKey) : undefined}
      accessibilityLabel={display ? `Edit ${prefix || addLabel}` : addLabel}
    >
      <Ionicons
        name={icon}
        size={20}
        color={display ? theme.subTextColor : Data.brand.blue}
        style={styles.detailIcon}
      />
      {display ? (
        <Text style={[styles.detailText, { color: theme.textColor }]}>
          {prefix ? <Text style={{ color: theme.subTextColor }}>{prefix} </Text> : null}
          <Text style={{ fontWeight: '700' }}>{display}</Text>
        </Text>
      ) : (
        <Text style={[styles.detailText, { color: Data.brand.blue, fontWeight: '600' }]}>
          {addLabel}
        </Text>
      )}
      {isMe && display ? (
        <Ionicons name="pencil" size={15} color={theme.subTextColor} style={{ marginLeft: 6, opacity: 0.6 }} />
      ) : null}
    </TouchableOpacity>
  );
};

/**
 * A titled card wrapper used for the About sections.
 */
const AboutCard = ({ title, theme, children, style }) => (
  <View style={style}>
    {!!title && (
      <Text style={[styles.sectionTitle, { color: theme.textColor, marginBottom: 10 }]}>{title}</Text>
    )}
    <View style={[styles.glassCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
      {children}
    </View>
  </View>
);

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────

export default function ProfileScreen({ setSecondSheet, openChat, sheet, route }) {
  const {
    user: loggedInUser,
    logout,
    points: myPoints,
    streak: myStreak,
    badges: myBadges,
    posts: allPosts,
    pulses,
    refreshAllData,
    uploadFile,
    updateUserProfile,
    setPulseCreateOpen,
    setPulseImageUri,
    viewingUserId,
    setViewingUserId,
    resolveUser,
    startDirectChat,
    userSettings,
    startCall,
    followStatuses,
    checkFollowStatus,
    toggleFollow,
    profilePeekUser,
    deletePost,
  } = useAppStore();

  const isDark = userSettings?.darkMode === true;

  // ─── Identity resolution ───────────────────
  const targetId = useMemo(
    () => String(sheet?.userId || route?.params?.userId || viewingUserId || loggedInUser?.id || ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet?.userId, route?.params?.userId, viewingUserId, loggedInUser?.id]
  );
  const isMe = !!targetId && targetId === String(loggedInUser?.id || '');
  const loggedInUserId = loggedInUser?.id;

  // ─── Local state ───────────────────────────
  const [displayUser, setDisplayUser] = useState(() => {
    if (isMe) return loggedInUser;
    if (profilePeekUser && String(profilePeekUser.id) === targetId) return profilePeekUser;
    return null;
  });
  const [isLoadingDisplay, setIsLoadingDisplay] = useState(!displayUser);
  const [profileTab, setProfileTab] = useState('posts');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingImage, setLoadingImage] = useState(null); // 'avatar' | 'cover1' | null
  const [commentPostId, setCommentPostId] = useState(null);
  const [viewImage, setViewImage] = useState(null);
  const [editingField, setEditingField] = useState(null); // which About field is being edited inline
  const [savingField, setSavingField] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [interestsDraft, setInterestsDraft] = useState('');

  // ─── Abort-safe ref (prevents setState on unmounted component) ─────────
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Follow status (derived) ───────────────
  const isCurrentlyFollowing = useMemo(() => {
    if (typeof followStatuses[targetId] === 'boolean') return followStatuses[targetId];
    if (profilePeekUser && String(profilePeekUser.id) === targetId && typeof profilePeekUser.isFollowing === 'boolean') return profilePeekUser.isFollowing;
    if (typeof displayUser?.isFollowing === 'boolean') return displayUser.isFollowing;
    return false;
  }, [followStatuses, targetId, profilePeekUser, displayUser]);

  // ─── Data loading ──────────────────────────
  const loadProfileData = useCallback(async (silent = false) => {
    if (!silent && mountedRef.current) setIsLoadingDisplay(true);
    try {
      const data = await resolveUser(targetId);
      if (data && mountedRef.current) {
        setDisplayUser(data);
        if (!isMe) await checkFollowStatus(targetId);
      }
    } catch (e) {
      console.error('[Profile] Failed to load user data:', e);
    } finally {
      if (mountedRef.current) setIsLoadingDisplay(false);
    }
  }, [targetId, isMe, resolveUser, checkFollowStatus]);

  // Initial load / targetId change
  useEffect(() => {
    if (isMe) {
      if (mountedRef.current) {
        setDisplayUser(loggedInUser); // הצג מיד מה שיש
        setIsLoadingDisplay(false);
      }
      loadProfileData(true); // רענן מה-API ברקע (silent)
    } else if (targetId) {
      loadProfileData();
    }
  }, [targetId, isMe, loggedInUserId, loggedInUser, loadProfileData]);

  // Cleanup viewingUserId on unmount
  useEffect(() => {
    return () => {
      if (viewingUserId) setViewingUserId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Pull-to-refresh ──────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isMe && refreshAllData) await refreshAllData();
      await loadProfileData(true);
    } catch (e) {
      console.error('[Profile] Refresh failed:', e);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [isMe, refreshAllData, loadProfileData]);

  // ─── Pulse creator ────────────────────────
  const handleOpenPulseCreator = useCallback(() => {
    setPulseImageUri?.(null);
    setPulseCreateOpen?.(true);
  }, [setPulseImageUri, setPulseCreateOpen]);

  // ─── Image upload (avatar / cover) ────────
  const handleImageUpload = useCallback(async (type) => {
    if (!isMe) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your gallery to update your profile.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'cover1' ? [16, 9] : [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const uri = result.assets[0].uri;
      if (mountedRef.current) setLoadingImage(type);

      const uploadedUrl = await uploadFile(uri, type === 'cover1' ? 'cover' : type);

      if (uploadedUrl) {
        const updates = {};
        // ✅ FIX: Send ONLY the fields the server accepts.
        // avatar → avatarUrl only. cover → coverUrl only.
        // Sending extra aliases (avatar, img, coverImage, cover) causes the
        // server to reject the ENTIRE request with a validation error.
        if (type === 'avatar') {
          updates.avatarUrl = uploadedUrl;
        }
        if (type === 'cover1') {
          updates.coverUrl = uploadedUrl;
        }
        // ✅ FIX: update local displayUser IMMEDIATELY so the new image shows
        // without waiting for a refetch. For 'isMe', loadProfileData() mirrors
        // loggedInUser and does not re-fetch, so we merge the new URL here.
        if (mountedRef.current) {
          setDisplayUser((prev) => ({ ...(prev || {}), ...updates }));
        }
        await updateUserProfile(updates);
        refreshAllData?.();
        if (!isMe) loadProfileData(true);
      }
    } catch (error) {
      console.error('[Profile] Image upload error:', error);
      Alert.alert('Error', 'Image upload failed. Please try again.');
    } finally {
      if (mountedRef.current) setLoadingImage(null);
    }
  }, [isMe, uploadFile, updateUserProfile, refreshAllData, loadProfileData]);

  // ─── Call handler ─────────────────────────
  const handleCallPress = useCallback(async (isVideo = false) => {
    if (!targetId) return;
    try {
      if (startCall) {
        await startCall(targetId, isVideo);
      } else {
        Alert.alert('Call Offline', 'Call service is currently not connected.');
      }
    } catch (error) {
      console.error('[Profile] Call error:', error);
      Alert.alert('Call Failed', 'Could not establish a connection right now.');
    }
  }, [startCall, targetId]);

  // ─── Inline About-field editing ───────────
  // Each field saves directly to the store; the displayed user updates
  // optimistically so the change appears instantly with no modal/extra screen.
  const handleStartEditField = useCallback((key) => {
    if (!isMe) return;
    setEditingField(key);
  }, [isMe]);

  const handleCancelEditField = useCallback(() => setEditingField(null), []);

  const handleSaveField = useCallback(async (key, value) => {
    if (!isMe) return;
    const trimmed = typeof value === 'string' ? value.trim() : value;
    setSavingField(true);
    try {
      // Languages & interests are stored as arrays elsewhere in the app.
      let payloadValue = trimmed;
      if (key === 'languages' || key === 'interests') {
        payloadValue = String(trimmed || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
      }
      await updateUserProfile({ [key]: payloadValue });
      // Optimistic local update so the row reflects the change immediately.
      if (mountedRef.current) {
        setDisplayUser((prev) => (prev ? { ...prev, [key]: payloadValue } : prev));
        setEditingField(null);
      }
      refreshAllData?.();
    } catch (e) {
      console.error('[Profile] Inline field save failed:', e);
      Alert.alert('Save failed', 'Could not save that change. Please try again.');
    } finally {
      if (mountedRef.current) setSavingField(false);
    }
  }, [isMe, updateUserProfile, refreshAllData]);

  // ─── Derived data ─────────────────────────
  // Profile posts MUST mirror the feed: any post this user publishes appears
  // here automatically. We merge two sources and de-duplicate:
  //   1. Posts already loaded in the global feed (allPosts) authored by them.
  //   2. Posts attached to the user object itself (displayUser.posts), if any.
  // Author matching tolerates every common id field shape used across the app.
  const userPosts = useMemo(() => {
    const tId = String(displayUser?.id ?? targetId ?? '');
    if (!tId) return [];

    const authorIdOf = (post) => String(
      post?.author?.id ?? post?.authorId ?? post?.user?.id ??
      post?.userId ?? post?.ownerId ?? post?.uid ?? ''
    );
    const postKey = (post) => String(post?.id ?? post?._id ?? '');

    const fromFeed = Array.isArray(allPosts)
      ? allPosts.filter(p => authorIdOf(p) === tId)
      : [];
    const fromUser = Array.isArray(displayUser?.posts) ? displayUser.posts : [];

    // ✅ FIX: כשצופים בפרופיל שלך, allPosts הוא source of truth —
    // deletePost מעדכן אותו מיד. fromUser (displayUser.posts) לא מתעדכן
    // אחרי מחיקה ולכן גורם לפוסטים שנמחקו להישאר בתצוגה.
    // לפרופילים אחרים — ממשיכים למזג כרגיל.
    const isOwnProfile = tId === String(displayUser?.id ?? '') &&
      tId !== '' &&
      fromFeed.length > 0;

    const postsToMerge = isOwnProfile
      ? fromFeed
      : (() => {
          const merged = new Map();
          [...fromUser, ...fromFeed].forEach((p) => {
            const k = postKey(p);
            if (k && !merged.has(k)) merged.set(k, p);
          });
          return Array.from(merged.values());
        })();

    return postsToMerge.sort(
      (a, b) =>
        new Date(b?.timestamp || b?.createdAt || 0) -
        new Date(a?.timestamp || a?.createdAt || 0)
    );
  }, [allPosts, displayUser, targetId]);

  const userActivePulses = useMemo(() => {
    if (!displayUser || !pulses) return [];
    const tId = String(displayUser.id);
    return pulses.filter(p => String(p.author?.id) === tId);
  }, [pulses, displayUser]);

  const currentAvatar = resolveAvatar(displayUser, profilePeekUser?.avatarUrl || Data.USER_PROFILE_PIC);
  const coverImage = resolveCover(displayUser, profilePeekUser);

  const displayPoints = isMe ? myPoints : (displayUser?.points ?? 0);
  const displayStreak = isMe ? myStreak : (displayUser?.streak ?? 0);
  const displayBadges = isMe ? myBadges : (displayUser?.badges ?? []);

  // ─── Theme tokens (derived once per render) ─
  const theme = useMemo(() => ({
    textColor: isDark ? '#fff' : '#222',
    subTextColor: isDark ? '#aaa' : '#888',
    cardBg: isDark ? '#1C1C1E' : '#fff',
    borderColor: isDark ? '#333' : '#eee',
    inputBg: isDark ? '#2C2C2E' : '#f5f5f5',
  }), [isDark]);

  // ─────────────────────────────────────────────
  // Tab renderers (each in its own named function for clarity)
  // ─────────────────────────────────────────────

  const renderAbout = () => {
    // ── Pull every field defensively (supports many backend naming styles) ──
    const bio        = getField(displayUser, 'bio', 'intent', 'about', 'description', 'tagline');
    const work       = getField(displayUser, 'work', 'job', 'jobTitle', 'occupation', 'profession');
    const company    = getField(displayUser, 'company', 'workplace', 'employer');
    const college    = getField(displayUser, 'college', 'university', 'education', 'school');
    const highSchool = getField(displayUser, 'highSchool', 'highschool', 'secondarySchool');
    const currentCity= getField(displayUser, 'currentCity', 'city', 'location', 'livesIn');
    const hometown   = getField(displayUser, 'hometown', 'homeTown', 'origin', 'from');
    const relationship = getField(displayUser, 'relationshipStatus', 'relationship', 'status', 'civilStatus');
    const joined     = formatJoined(getField(displayUser, 'createdAt', 'joinedAt', 'joined', 'memberSince'));

    const email      = getField(displayUser, 'email', 'contactEmail');
    const phone      = getField(displayUser, 'phone', 'phoneNumber', 'mobile');
    const website    = getField(displayUser, 'website', 'url', 'link', 'portfolio');
    const gender     = getField(displayUser, 'gender', 'sex', 'pronouns');
    const birthday   = getField(displayUser, 'birthday', 'birthdate', 'dob', 'dateOfBirth');
    const languages  = (() => {
      const l = getField(displayUser, 'languages', 'languagesSpoken', 'langs');
      return Array.isArray(l) ? l.join(', ') : l;
    })();
    const interestsStr = (() => {
      const i = displayUser?.interests;
      return Array.isArray(i) ? i.join(', ') : (i || '');
    })();

    // Shared props for every editable row.
    const rowProps = {
      isMe,
      theme,
      editingKey: editingField,
      onStartEdit: handleStartEditField,
      onSave: handleSaveField,
      onCancel: handleCancelEditField,
      saving: savingField,
    };

    const followerCount  = resolveCount(displayUser, 'followersCount', 'followers');
    const followingCount = resolveCount(displayUser, 'followingCount', 'following');

    const bioEditing = isMe && editingField === 'bio';

    return (
      <View style={styles.tabContent}>

        {/* ── Intro card (bio + quick facts) ── */}
        <AboutCard title="Intro" theme={theme}>
          {bioEditing ? (
            <View style={{ marginBottom: 4 }}>
              <TextInput
                value={bioDraft}
                onChangeText={setBioDraft}
                placeholder="Write something about yourself…"
                placeholderTextColor={theme.subTextColor}
                autoFocus
                multiline
                maxLength={160}
                style={[styles.bioInput, { color: theme.textColor, borderColor: Data.brand.blue, backgroundColor: theme.inputBg }]}
              />
              <View style={styles.bioEditActions}>
                <Text style={{ color: theme.subTextColor, fontSize: 12 }}>{bioDraft.length}/160</Text>
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity onPress={handleCancelEditField} style={styles.inlineBtn} accessibilityLabel="Cancel">
                    <Ionicons name="close" size={22} color={theme.subTextColor} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSaveField('bio', bioDraft)} style={styles.inlineBtn} accessibilityLabel="Save bio">
                    <Ionicons name="checkmark" size={22} color={Data.brand.green || '#34C759'} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : bio ? (
            <TouchableOpacity
              activeOpacity={isMe ? 0.6 : 1}
              disabled={!isMe}
              onPress={isMe ? () => { setBioDraft(bio); setEditingField('bio'); } : undefined}
              accessibilityLabel="Edit bio"
            >
              <Text style={[styles.introBio, { color: isDark ? '#ddd' : '#444' }]}>
                {bio}{isMe ? '  ' : ''}
                {isMe ? <Ionicons name="pencil" size={13} color={theme.subTextColor} /> : null}
              </Text>
            </TouchableOpacity>
          ) : isMe ? (
            <TouchableOpacity
              onPress={() => { setBioDraft(''); setEditingField('bio'); }}
              style={styles.introAddBio}
              accessibilityLabel="Add bio"
            >
              <Text style={{ color: Data.brand.blue, fontWeight: '600' }}>＋ Add a short bio</Text>
            </TouchableOpacity>
          ) : null}

          {((bio || isMe) && (work || company || college || highSchool || currentCity || hometown || relationship || joined || isMe)) && (
            <View style={[styles.divider, { backgroundColor: theme.borderColor }]} />
          )}

          <DetailRow {...rowProps} fieldKey="work"        icon="briefcase-outline" prefix="Works as"   value={work}        addLabel="Add job title" placeholder="e.g. Software Developer" />
          <DetailRow {...rowProps} fieldKey="company"     icon="business-outline"  prefix="At"          value={company}     addLabel="Add company" placeholder="e.g. KliqTap" />
          <DetailRow {...rowProps} fieldKey="college"     icon="school-outline"    prefix="Studied at"  value={college}     addLabel="Add college / university" />
          <DetailRow {...rowProps} fieldKey="highSchool"  icon="library-outline"   prefix="Went to"     value={highSchool}  addLabel="Add high school" />
          <DetailRow {...rowProps} fieldKey="currentCity" icon="home-outline"      prefix="Lives in"    value={currentCity} addLabel="Add current city" />
          <DetailRow {...rowProps} fieldKey="hometown"    icon="navigate-outline"  prefix="From"        value={hometown}    addLabel="Add hometown" />
          <DetailRow {...rowProps} fieldKey="relationshipStatus" icon="heart-outline" prefix="" value={relationship} addLabel="Add relationship status" formatDisplay={prettify} />
          {/* Joined is read-only, never editable */}
          <DetailRow icon="calendar-outline" prefix="Joined" value={joined} addLabel={null} isMe={false} theme={theme} fieldKey="__joined" />
        </AboutCard>

        {/* ── Contact & basic info ── */}
        {(email || phone || website || gender || birthday || languages || isMe) && (
          <AboutCard title="Contact & Basic Info" theme={theme} style={{ marginTop: 25 }}>
            <DetailRow {...rowProps} fieldKey="email"     icon="mail-outline"     prefix="Email"    value={email}     addLabel="Add email"    keyboardType="email-address" autoCapitalize="none" />
            <DetailRow {...rowProps} fieldKey="phone"     icon="call-outline"     prefix="Phone"    value={phone}     addLabel="Add phone"    keyboardType="phone-pad" />
            <DetailRow {...rowProps} fieldKey="website"   icon="globe-outline"    prefix="Website"  value={website}   addLabel="Add website"  keyboardType="url" autoCapitalize="none" />
            <DetailRow {...rowProps} fieldKey="gender"    icon="person-outline"   prefix="Gender"   value={gender}    addLabel="Add gender"   formatDisplay={prettify} />
            <DetailRow {...rowProps} fieldKey="birthday"  icon="gift-outline"     prefix="Birthday" value={birthday}  addLabel="Add birthday" placeholder="YYYY-MM-DD" autoCapitalize="none" formatDisplay={formatBirthday} />
            <DetailRow {...rowProps} fieldKey="languages" icon="language-outline" prefix="Speaks"   value={languages} addLabel="Add languages" placeholder="English, Bisaya, Tagalog" />
          </AboutCard>
        )}

        {/* ── Connections summary (linked to the Activity tab data) ── */}
        <AboutCard title="Friends & Followers" theme={theme} style={{ marginTop: 25 }}>
          <View style={styles.connectionsRow}>
            <TouchableOpacity style={styles.connectionStat} onPress={() => setProfileTab('activity')} accessibilityLabel="View followers">
              <Text style={[styles.statValue, { color: theme.textColor }]}>{followerCount}</Text>
              <Text style={[styles.statLabel, { color: theme.subTextColor }]}>Followers</Text>
            </TouchableOpacity>
            <View style={[styles.connectionDivider, { backgroundColor: theme.borderColor }]} />
            <TouchableOpacity style={styles.connectionStat} onPress={() => setProfileTab('activity')} accessibilityLabel="View following">
              <Text style={[styles.statValue, { color: theme.textColor }]}>{followingCount}</Text>
              <Text style={[styles.statLabel, { color: theme.subTextColor }]}>Following</Text>
            </TouchableOpacity>
          </View>
        </AboutCard>

        {/* ── Passions & Interests (inline editable) ── */}
        <Text style={[styles.sectionTitle, { color: theme.textColor, marginTop: 25, marginBottom: 10 }]}>
          Passions & Interests
        </Text>
        {isMe && editingField === 'interests' ? (
          <View style={[styles.glassCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
            <TextInput
              value={interestsDraft}
              onChangeText={setInterestsDraft}
              placeholder="Travel, Music, Coding"
              placeholderTextColor={theme.subTextColor}
              autoFocus
              style={[styles.inlineInput, { color: theme.textColor, borderColor: Data.brand.blue, backgroundColor: theme.inputBg, flex: 0 }]}
            />
            <Text style={{ color: theme.subTextColor, fontSize: 12, marginTop: 6 }}>Separate with commas</Text>
            <View style={[styles.bioEditActions, { marginTop: 8 }]}>
              <View />
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity onPress={handleCancelEditField} style={styles.inlineBtn} accessibilityLabel="Cancel">
                  <Ionicons name="close" size={22} color={theme.subTextColor} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleSaveField('interests', interestsDraft)} style={styles.inlineBtn} accessibilityLabel="Save interests">
                  <Ionicons name="checkmark" size={22} color={Data.brand.green || '#34C759'} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.tagsContainer}>
            {displayUser?.interests?.length > 0 ? (
              <>
                {displayUser.interests.map((tag, i) => (
                  <View key={i} style={[styles.luxuryTag, { backgroundColor: theme.cardBg, borderColor: theme.borderColor }]}>
                    <Text style={[styles.tagText, { color: isDark ? '#ddd' : '#444' }]}>{tag}</Text>
                  </View>
                ))}
                {isMe && (
                  <TouchableOpacity
                    onPress={() => { setInterestsDraft(interestsStr); setEditingField('interests'); }}
                    style={[styles.luxuryTag, { backgroundColor: theme.cardBg, borderColor: Data.brand.blue }]}
                    accessibilityLabel="Edit interests"
                  >
                    <Ionicons name="pencil" size={13} color={Data.brand.blue} />
                  </TouchableOpacity>
                )}
              </>
            ) : isMe ? (
              <TouchableOpacity
                onPress={() => { setInterestsDraft(''); setEditingField('interests'); }}
                style={[styles.luxuryTag, { backgroundColor: theme.cardBg, borderColor: Data.brand.blue }]}
                accessibilityLabel="Add interests"
              >
                <Text style={[styles.tagText, { color: Data.brand.blue }]}>＋ Add interests</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ color: theme.subTextColor, fontStyle: 'italic' }}>No interests added yet.</Text>
            )}
          </View>
        )}

        {isMe && (
          <TouchableOpacity style={styles.blackLogoutBtn} onPress={logout} activeOpacity={0.8} accessibilityLabel="Sign out">
            <Ionicons name="log-out-outline" size={22} color="#fff" />
            <Text style={styles.blackLogoutText}>Sign Out</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderActivity = () => (
    <View style={styles.tabContent}>
      <StatsRow
        points={displayPoints}
        streak={displayStreak}
        badgeCount={displayBadges?.length ?? 0}
        textColor={theme.textColor}
        subTextColor={theme.subTextColor}
        cardBg={theme.cardBg}
        borderColor={theme.borderColor}
      />

      <Text style={[styles.sectionTitle, { color: theme.textColor, marginTop: 10 }]}>Connections</Text>
      <View style={[styles.glassCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15 }]}>
        <View style={styles.statItemSmall}>
          <Text style={[styles.statValue, { color: theme.textColor }]}>
            {resolveCount(displayUser, 'followersCount', 'followers')}
          </Text>
          <Text style={[styles.statLabel, { color: theme.subTextColor }]}>Followers</Text>
        </View>
        <View style={styles.statItemSmall}>
          <Text style={[styles.statValue, { color: theme.textColor }]}>
            {resolveCount(displayUser, 'followingCount', 'following')}
          </Text>
          <Text style={[styles.statLabel, { color: theme.subTextColor }]}>Following</Text>
        </View>
      </View>

      {Array.isArray(displayUser?.followers) && displayUser.followers.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={[styles.sectionTitle, { color: theme.textColor, fontSize: 16 }]}>Followers List</Text>
          <View style={[styles.glassCard, { backgroundColor: theme.cardBg, borderColor: theme.borderColor, padding: 5 }]}>
            {displayUser.followers.map((f, i) => (
              <FollowerRow
                key={f?.id || f?.follower?.id || i}
                follower={f}
                isLast={i === displayUser.followers.length - 1}
                borderColor={theme.borderColor}
                textColor={theme.textColor}
                onPress={(id) => setSecondSheet({ source: 'Profile', userId: id })}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderPosts = () => (
    <View style={{ marginTop: 10 }}>
      {userPosts.length > 0 ? (
        userPosts.map(post => {
          const author = post.author || post.user || displayUser;
          return (
            <PostCard
              key={String(post.id || post._id)}
              post={{
                ...post,
                user: author,
                author,
                authorId: author?.id || post.authorId || post.userId,
                image: post.imageUrl || post.image || post.img || null,
              }}
              // Navigate to the post's author, not always EditProfile
              onOpenProfile={() => setSecondSheet({ source: 'Profile', userId: author?.id })}
              onOpenComments={() => setCommentPostId(String(post.id || post._id))}
              onDelete={isMe ? () => deletePost(String(post.id || post._id)) : undefined}
              isDark={isDark}
            />
          );
        })
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="camera-outline" size={60} color={isDark ? '#444' : '#ddd'} />
          <Text style={[styles.emptyStateText, { color: theme.subTextColor }]}>No memories yet.</Text>
          {isMe && (
            <TouchableOpacity onPress={handleOpenPulseCreator} style={styles.createBtnSmall}>
              <Text style={styles.createBtnText}>Create First Post</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const renderPulse = () => {
    const activePulse = userActivePulses[0];
    const vibeColor = activePulse?.vibe ? (VIBE_COLORS[activePulse.vibe] ?? Data.brand.blue) : Data.brand.blue;
    const pulseImgSource = activePulse?.image || activePulse?.imageUrl || activePulse?.img || null;

    return (
      <View style={styles.tabContent}>
        {activePulse ? (
          <View style={[styles.pulseCard, { backgroundColor: theme.cardBg }]}>
            {pulseImgSource ? (
              <Image source={{ uri: pulseImgSource }} style={styles.pulseImage} />
            ) : (
              <View style={[styles.pulsePlaceholder, { backgroundColor: vibeColor }]}>
                <Text style={styles.pulsePlaceholderText}>"{activePulse.text}"</Text>
              </View>
            )}
            <View style={styles.pulseMeta}>
              {pulseImgSource && (
                <Text style={[globalStyles.h3, { color: theme.textColor }]}>
                  {activePulse.text || 'Vibe'}
                </Text>
              )}
              <View style={styles.liveIndicator}>
                <View style={styles.pulsingDot} />
                <Text style={styles.liveIndicatorText}>LIVE NOW</Text>
              </View>
              {isMe && (
                <TouchableOpacity
                  style={[styles.updatePulseBtn, { backgroundColor: isDark ? '#333' : '#222' }]}
                  onPress={handleOpenPulseCreator}
                  accessibilityLabel="Update vibe"
                >
                  <Ionicons name="refresh" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.updatePulseText}>Update Vibe</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIconWrapper, { backgroundColor: isDark ? '#1C1C1E' : '#F0F4F8' }]}>
              <Ionicons name="flash" size={40} color={Data.brand.blue} />
            </View>
            <Text style={[globalStyles.h3, { color: theme.textColor }]}>
              {isMe ? 'Your Vibe is Offline' : 'Vibe is Offline'}
            </Text>
            <Text style={[styles.emptyStateSub, { color: theme.subTextColor }]}>
              {isMe ? "Share what you're up to right now." : 'No active pulse right now.'}
            </Text>
            {isMe && (
              <TouchableOpacity style={styles.createPulseHeroBtn} onPress={handleOpenPulseCreator} accessibilityLabel="Create pulse">
                <Text style={styles.createPulseHeroText}>⚡ Create Pulse</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    switch (profileTab) {
      case 'about':    return renderAbout();
      case 'activity': return renderActivity();
      case 'posts':    return renderPosts();
      case 'pulse':    return renderPulse();
      default:         return null;
    }
  };

  // ─────────────────────────────────────────────
  // Loading guard
  // ─────────────────────────────────────────────
  if (isLoadingDisplay && !displayUser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#000' : '#fff' }}>
        <ActivityIndicator size="large" color={Data.brand.blue} />
      </View>
    );
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Data.brand.blue} />
        }
      >
        <View style={{ marginBottom: 20 }}>

          {/* Cover Photo */}
          <CoverPhoto
            uri={coverImage}
            isMe={isMe}
            isLoading={loadingImage === 'cover1'}
            isDark={isDark}
            onPress={() => isMe ? handleImageUpload('cover1') : setViewImage(coverImage)}
          />

          {/* Avatar + Name */}
          <View style={styles.profileHeaderBlock}>
            <Avatar
              uri={currentAvatar}
              isMe={isMe}
              isLoading={loadingImage === 'avatar'}
              isDark={isDark}
              onPress={() => isMe ? handleImageUpload('avatar') : setViewImage(currentAvatar)}
            />
            <View style={styles.nameBlock}>
              <Text style={[styles.bigName, { color: isDark ? '#fff' : '#222' }]} numberOfLines={1}>
                {getField(displayUser, 'name', 'fullName', 'displayName') ||
                 getField(displayUser, 'username', 'handle') ||
                 (isMe ? 'You' : 'User')}
              </Text>
              <Text style={[styles.handle, { color: isDark ? '#aaa' : '#888' }]}>
                @{displayUser?.username || 'user'}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            {isMe ? (
              <>
                <TouchableOpacity
                  style={[styles.settingsCircleBtn, { backgroundColor: isDark ? '#1C1C1E' : '#f5f5f5', borderColor: isDark ? '#333' : '#eee' }]}
                  onPress={() => setSecondSheet({ source: 'Settings' })}
                  accessibilityLabel="Open settings"
                >
                  <Ionicons name="settings-outline" size={20} color={isDark ? '#fff' : '#333'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.luxuryEditBtn, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#E0E0E0', flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                  onPress={() => setProfileTab('about')}
                  accessibilityLabel="Edit your details"
                >
                  <Ionicons name="create-outline" size={15} color={isDark ? '#fff' : '#333'} />
                  <Text style={[styles.luxuryEditBtnText, { color: isDark ? '#fff' : '#333' }]}>Edit Details</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Follow */}
                <TouchableOpacity
                  style={[styles.luxuryEditBtn, {
                    backgroundColor: isCurrentlyFollowing ? (isDark ? '#1C1C1E' : '#f0f0f0') : Data.brand.blue,
                    borderColor: isCurrentlyFollowing ? (isDark ? '#333' : '#ccc') : Data.brand.blue,
                  }]}
                  onPress={() => toggleFollow(targetId)}
                  accessibilityLabel={isCurrentlyFollowing ? 'Unfollow user' : 'Follow user'}
                >
                  <Text style={[styles.luxuryEditBtnText, { color: isCurrentlyFollowing ? (isDark ? '#fff' : '#333') : '#fff' }]}>
                    {isCurrentlyFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>

                {/* Message */}
                <TouchableOpacity
                  style={[styles.luxuryEditBtn, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#E0E0E0' }]}
                  onPress={() => startDirectChat(displayUser)}
                  accessibilityLabel="Send message"
                >
                  <Text style={[styles.luxuryEditBtnText, { color: isDark ? '#fff' : '#333' }]}>Message</Text>
                </TouchableOpacity>

                {/* Voice call */}
                <TouchableOpacity
                  style={[styles.iconActionBtn, { borderColor: isDark ? '#333' : '#E0E0E0', backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}
                  onPress={() => handleCallPress(false)}
                  accessibilityLabel="Start voice call"
                >
                  <Ionicons name="call" size={16} color={isDark ? '#fff' : '#333'} />
                </TouchableOpacity>

                {/* Video call */}
                <TouchableOpacity
                  style={[styles.iconActionBtn, { borderColor: isDark ? '#333' : '#E0E0E0', backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}
                  onPress={() => handleCallPress(true)}
                  accessibilityLabel="Start video call"
                >
                  <Ionicons name="videocam" size={16} color={isDark ? '#fff' : '#333'} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Tab Bar */}
          <View style={[styles.tabRow, { borderBottomColor: isDark ? '#333' : '#f0f0f0' }]}>
            {TABS.map(tab => {
              const active = profileTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setProfileTab(tab)}
                  style={[styles.tabItem, active && styles.tabItemActive]}
                  accessibilityLabel={`${tab} tab`}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.tabText, { color: isDark ? '#888' : '#999' }, active && { color: Data.brand.blue }]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                  {active && <View style={styles.activeIndicator} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tab Content */}
          {renderContent()}

        </View>
      </ScrollView>

      {/* Modals */}
      <PostCommentsModal
        postId={commentPostId}
        visible={!!commentPostId}
        onClose={() => setCommentPostId(null)}
        isDark={isDark}
      />

      <ImageViewerModal uri={viewImage} onClose={() => setViewImage(null)} />
    </View>
  );
}

// ─────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Cover ──────────────────────────────────
  fullCoverContainer: { width: '100%', height: COVER_HEIGHT },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
  coverEditIcon: {
    position: 'absolute', top: 15, right: 15,
    backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 20,
  },
  loaderCenter: { position: 'absolute', alignSelf: 'center', top: '40%' },

  // ── Header ─────────────────────────────────
  profileHeaderBlock: {
    paddingHorizontal: 20, marginTop: -40,
    flexDirection: 'row', alignItems: 'flex-end',
  },
  avatarWrapper: {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2, borderWidth: 4,
    elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5,
  },
  mainAvatar: { width: '100%', height: '100%', borderRadius: AVATAR_SIZE / 2 },
  nameBlock: { flex: 1, marginLeft: 15, paddingBottom: 5 },
  bigName: { fontSize: 22, fontWeight: '800' },
  handle: { fontSize: 14, fontWeight: '500' },

  // ── Action Buttons ─────────────────────────
  actionsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 15, paddingHorizontal: 20,
    flexWrap: 'wrap', gap: 8,
  },
  settingsCircleBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  luxuryEditBtn: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  luxuryEditBtnText: { fontSize: 12, fontWeight: '700' },
  iconActionBtn: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Tab Bar ────────────────────────────────
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 15 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabItemActive: {},
  tabText: { fontSize: 14, fontWeight: '600' },
  activeIndicator: {
    width: 40, height: 3,
    backgroundColor: Data.brand.blue,
    borderRadius: 2, marginTop: 4,
  },

  // ── Shared Content ─────────────────────────
  tabContent: { paddingHorizontal: 20 },
  glassCard: { padding: 20, borderRadius: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  bioText: { fontSize: 15, lineHeight: 24 },

  // ── About: Intro & detail rows ─────────────
  introBio: { fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 4 },
  introAddBio: { alignItems: 'center', paddingVertical: 6 },
  divider: { height: 1, marginVertical: 14, opacity: 0.8 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 9 },
  detailIcon: { width: 26, marginRight: 10, textAlign: 'center', lineHeight: 21 },
  detailText: { fontSize: 15, flex: 1, lineHeight: 21 },
  inlineInput: {
    flex: 1, borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 8 : 5,
    fontSize: 15,
  },
  inlineBtn: { padding: 6, marginLeft: 2 },
  bioInput: {
    borderWidth: 1.5, borderRadius: 12, padding: 12,
    fontSize: 15, lineHeight: 22, minHeight: 70, textAlignVertical: 'top',
  },
  bioEditActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 6,
  },
  connectionsRow: { flexDirection: 'row', alignItems: 'center' },
  connectionStat: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  connectionDivider: { width: 1, height: 36 },

  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  luxuryTag: {
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 20, borderWidth: 1, elevation: 1,
  },
  tagText: { fontSize: 13, fontWeight: '600' },

  // ── Logout ─────────────────────────────────
  blackLogoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 15, backgroundColor: '#000', borderRadius: 25,
    marginTop: 30, elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5,
  },
  blackLogoutText: { color: '#fff', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },

  // ── Stats ──────────────────────────────────
  statsContainer: {
    flexDirection: 'row', borderRadius: 16, padding: 15,
    borderWidth: 1, marginBottom: 25,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statBoxBorder: { borderLeftWidth: 1, borderRightWidth: 1 },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 12, marginTop: 2 },
  statItemSmall: { alignItems: 'center', flex: 1 },

  // ── Followers ──────────────────────────────
  followerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 10,
  },
  followerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    marginRight: 15, backgroundColor: '#eee',
    borderWidth: 1, borderColor: '#ddd',
  },

  // ── Pulse ──────────────────────────────────
  pulseCard: {
    borderRadius: 24, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
    elevation: 5, marginBottom: 20,
  },
  pulseImage: { width: '100%', height: 400, resizeMode: 'cover' },
  pulsePlaceholder: { height: 300, justifyContent: 'center', alignItems: 'center', padding: 20 },
  pulsePlaceholderText: {
    fontSize: 28, color: '#fff', fontWeight: '800',
    textAlign: 'center', fontStyle: 'italic',
  },
  pulseMeta: { padding: 20 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  pulsingDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Data.brand.green, marginRight: 6,
  },
  liveIndicatorText: { color: Data.brand.green, fontWeight: '800', fontSize: 12 },
  updatePulseBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 15, padding: 12, borderRadius: 12,
  },
  updatePulseText: { color: '#fff', fontWeight: 'bold' },
  createPulseHeroBtn: {
    backgroundColor: Data.brand.blue,
    paddingHorizontal: 30, paddingVertical: 14,
    borderRadius: 30, elevation: 5,
  },
  createPulseHeroText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // ── Empty States ───────────────────────────
  emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  emptyStateIconWrapper: { padding: 20, borderRadius: 50, marginBottom: 15 },
  emptyStateText: { marginTop: 15, fontSize: 16 },
  emptyStateSub: { textAlign: 'center', marginBottom: 25, marginTop: 5 },
  createBtnSmall: { marginTop: 10, padding: 10 },
  createBtnText: { color: Data.brand.blue, fontWeight: 'bold' },

  // ── Image Viewer Modal ─────────────────────
  imageViewerContainer: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  imageViewerCloseBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 60 : 50,
    right: 20, zIndex: 10, padding: 10,
  },
  imageViewerImg: { width: '100%', height: '80%' },
});