// client/src/components/modals/PeekModals.js
// ⭐️ FULL VERSION: Instagram-Style Stories (Grouped, Swiping, Auto-Advance) + Profile Peek + VIBE PICKER + KEYBOARD & UI FIX ⭐️
// 🛠️ V5 ENTERPRISE UPGRADE: 
// - Removed Fake/Demo data (Points, Streak, Picsum placeholders).
// - Added Auto-Pause when typing a reply or viewing Vibes (UX Critical).
// - Added URL Encoding for Avatars & Safe Linking for external URLs.
// - Fixed Web blocking alerts -> Replaced with Async Toasts.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    View, Text, Image, Modal, TouchableOpacity, ActivityIndicator,
    TextInput, Alert, Share, StyleSheet, Dimensions,
    Platform, Linking, Animated, KeyboardAvoidingView, Keyboard
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Video } from 'expo-av'; 
import Toast from 'react-native-toast-message'; 
import { brand } from '../../constants/data';
import { useAppStore } from '../../store/useAppStore'; 
import { fetchAPI } from '../../store/api'; 

const { width, height } = Dimensions.get('window');

const QUICK_EMOJIS = ['❤️', '🔥', '😂', '😮', '😢', '👏'];

/**
 * 1. PROFILE PEEK MODAL
 */
export function ProfilePeekModal({ profile, onClose }) { 

  const { 
    user, 
    profilePeekUser, 
    isProfileLoading, 
    closeProfilePeek, 
    setTriggerOpenProfile,
    setViewingUserId,
    userSettings
  } = useAppStore();

  const isDark = userSettings?.darkMode === true; 
  const activeProfile = profile || profilePeekUser;
  const profileId = activeProfile?.id || activeProfile?.uid || activeProfile?.userId;

  if (!activeProfile && !isProfileLoading) return null;

  const handleClose = () => {
      if (onClose) onClose();
      closeProfilePeek(); 
  };
  
  // SECURITY FIX: URL Encoding for user names to prevent URL breakage
  const safeName = encodeURIComponent(activeProfile?.name || activeProfile?.username || 'User');
  const avatar = activeProfile?.avatarUrl || activeProfile?.profilePic || activeProfile?.profileImage || activeProfile?.picture || activeProfile?.photoUrl || activeProfile?.imageUrl || activeProfile?.img || activeProfile?.avatar || activeProfile?.image || `https://ui-avatars.com/api/?name=${safeName}&background=random`;
  
  const cover = activeProfile?.coverUrl || 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=1000'; 
  const name = activeProfile?.name || activeProfile?.username || 'Anonymous User';
  const bio = activeProfile?.bio || activeProfile?.intent || 'Just vibing on KliqTap ✌️';
  
  // PRODUCTION FIX: Removed hardcoded demo data (120 points, 5 streak)
  const points = activeProfile?.points ?? 0;
  const streak = activeProfile?.streak ?? 0;
  // SECURITY FIX: Default online status should be false unless explicitly true
  const isOnline = activeProfile?.isOnline === true;

  const handleViewFullProfile = () => {
      handleClose();
      setTimeout(() => {
          if (setViewingUserId && profileId) setViewingUserId(profileId); 
          if (setTriggerOpenProfile && profileId) setTriggerOpenProfile(profileId); 
      }, 350);
  };

  const handleInstagramPress = async () => {
      const url = activeProfile?.instagramUrl;
      if (!url) return;
      try {
          const supported = await Linking.canOpenURL(url);
          if (supported) {
              await Linking.openURL(url);
          } else {
              Toast.show({ type: 'error', text1: 'Link Error', text2: 'Cannot open Instagram link.' });
          }
      } catch (error) {
          Toast.show({ type: 'error', text1: 'Link Error', text2: 'Invalid URL format.' });
      }
  };

  return (
    <Modal animationType="slide" transparent={true} visible={!!activeProfile || isProfileLoading} onRequestClose={handleClose}>
      <TouchableOpacity style={localStyles.overlay} activeOpacity={1} onPress={handleClose}>
        <TouchableOpacity activeOpacity={1} style={[localStyles.sheet, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
            {isProfileLoading ? (
                <View style={localStyles.loadingContainer}>
                    <ActivityIndicator size="large" color={brand.blue} />
                    <Text style={{ marginTop: 15, color: isDark ? '#aaa' : '#666', fontWeight: 'bold' }}>Loading Kliq profile...</Text>
                </View>
            ) : (
                <>
                    <Image source={{ uri: cover }} style={localStyles.coverImage} />
                    <TouchableOpacity onPress={handleClose} style={[localStyles.floatingClose, { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)' }]}>
                        <Ionicons name="close" size={22} color={isDark ? "#fff" : "#333"} />
                    </TouchableOpacity>

                    <View style={localStyles.contentCenter}>
                        <View style={localStyles.headerRow}>
                            <TouchableOpacity style={localStyles.avatarWrapper} onPress={handleViewFullProfile}>
                                <View style={[localStyles.avatarRing, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
                                    <Image source={{ uri: avatar }} style={localStyles.mainAvatar} />
                                </View>
                                <View style={[localStyles.statusIndicator, { backgroundColor: isOnline ? '#2ecc71' : '#bdc3c7', borderColor: isDark ? '#1C1C1E' : '#fff' }]}>
                                    <View style={localStyles.statusDotInner} />
                                </View>
                                {activeProfile?.isKliqKing && (
                                    <View style={localStyles.kingBadge}>
                                        <FontAwesome5 name="crown" size={12} color="gold" />
                                    </View>
                                )}
                            </TouchableOpacity>

                            <View style={localStyles.actionButtons}>
                                <TouchableOpacity style={[localStyles.followBtn, { backgroundColor: brand.blue }]} onPress={handleViewFullProfile}>
                                    <Text style={localStyles.btnTextWhite}>View Full Profile</Text>
                                    <Ionicons name="arrow-forward" size={16} color="#fff" style={{marginLeft: 5}} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Text style={[localStyles.userName, { color: isDark ? '#fff' : '#111' }]}>{name}</Text>
                        <Text style={[localStyles.userHandle, { color: isDark ? '#aaa' : '#aaa' }]}>@{activeProfile.username || 'kliqtapper'}</Text>
                        <Text style={[localStyles.vibeStatus, { color: brand.blue }]}>{activeProfile.currentVibeStatus || 'The Seeker 🗺️'}</Text>
                        <Text style={[localStyles.userBio, { color: isDark ? '#ccc' : '#444' }]} numberOfLines={2}>{bio}</Text>

                        <View style={[localStyles.statsBar, { backgroundColor: isDark ? '#111' : '#F8F9FB', borderColor: isDark ? '#222' : '#F0F0F0' }]}>
                            <View style={localStyles.statItem}>
                                <Text style={[localStyles.statVal, { color: isDark ? '#fff' : '#111' }]}>{points}</Text>
                                <Text style={[localStyles.statLab, { color: isDark ? '#888' : '#999' }]}>Points</Text>
                            </View>
                            <View style={[localStyles.divider, { backgroundColor: isDark ? '#333' : '#E0E0E0' }]} />
                            <View style={localStyles.statItem}>
                                <Text style={[localStyles.statVal, { color: isDark ? '#fff' : '#111' }]}>🔥 {streak}</Text>
                                <Text style={[localStyles.statLab, { color: isDark ? '#888' : '#999' }]}>Streak</Text>
                            </View>
                            {activeProfile?.instagramUrl && (
                                <>
                                  <View style={[localStyles.divider, { backgroundColor: isDark ? '#333' : '#E0E0E0' }]} />
                                  <TouchableOpacity style={localStyles.statItem} onPress={handleInstagramPress}>
                                      <Ionicons name="logo-instagram" size={24} color="#E1306C" />
                                  </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>
                </>
            )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/**
 * 2. STORY MODAL (PULSE VIEWER) 
 * ⭐️ V5: Added Pause-on-Type, Removed Fake Images, Web Fallbacks ⭐️
 */
export function StoryModal({ item, onClose }) {
    const { user, pulses, deletePulse } = useAppStore();

    const [replyText, setReplyText] = useState('');
    const [liked, setLiked] = useState(false);
    const [localVibe, setLocalVibe] = useState(null); 
    const [showVibes, setShowVibes] = useState(false); 
    const [isSendingReply, setIsSendingReply] = useState(false);
    
    const [currentIndex, setCurrentIndex] = useState(0);
    const animProgress = useRef(new Animated.Value(0)).current;

    // UX FIX: Tracking input focus to pause story
    const [isInputFocused, setIsInputFocused] = useState(false);
    const isPaused = showVibes || isInputFocused;

    const authorId = item?.author?.id || item?.user?.id;
    const userPulses = useMemo(() => {
        if (!authorId) return item ? [item] : [];
        return pulses
            .filter(p => (p.author?.id || p.user?.id) === authorId)
            .sort((a, b) => new Date(a.createdAt || a.timestamp) - new Date(b.createdAt || b.timestamp));
    }, [pulses, authorId, item]);

    useEffect(() => {
        if (item && userPulses.length > 0) {
            const idx = userPulses.findIndex(p => String(p.id) === String(item.id));
            setCurrentIndex(idx >= 0 ? idx : 0);
        }
    }, [item]);

    const currentPulse = userPulses[currentIndex];

    useEffect(() => {
        if (currentPulse) {
            setLiked(currentPulse.stats?.isLikedByMe || false);
            setLocalVibe(currentPulse.stats?.myVibe || null);
            setShowVibes(false); 
        }
    }, [currentPulse]);

    useEffect(() => {
        if (!currentPulse) return;
        
        const imageSrc = currentPulse.imageUrl || currentPulse.image || currentPulse.img || '';
        const isVideo = imageSrc.toLowerCase().match(/\.(mp4|mov|webm)$/i);
        
        if (isVideo) return; // Video manages its own progress updates
        
        if (isPaused) {
            animProgress.stopAnimation();
            return;
        }

        animProgress.setValue(0);
        
        Animated.timing(animProgress, {
            toValue: 1,
            duration: 5000, 
            useNativeDriver: false
        }).start(({ finished }) => {
            if (finished && !isPaused) handleNext();
        });
    }, [currentIndex, currentPulse, isPaused]);

    const handleNext = () => {
        if (currentIndex < userPulses.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        } else {
            animProgress.setValue(0);
        }
    };

    const handleToggleLike = async () => {
        const isNowLiked = !liked;
        setLiked(isNowLiked);
        if (!isNowLiked) setLocalVibe(null);
        else if (!localVibe) setLocalVibe('❤️');
        
        try {
            if (isNowLiked) {
                await fetchAPI(`/pulse/${currentPulse.id}/like`, { method: 'POST', body: { vibe: localVibe || '❤️' } });
            } else {
                await fetchAPI(`/pulse/${currentPulse.id}/unlike`, { method: 'POST' });
            }
        } catch (e) { console.error(e); }
    };

    const handleVibeSelect = async (vibe) => {
        setShowVibes(false);
        setLiked(true);
        setLocalVibe(vibe);
        try {
            await fetchAPI(`/pulse/${currentPulse.id}/like`, { method: 'POST', body: { vibe } });
        } catch (e) { console.error(e); }
    };

    if (!currentPulse) return null;

    const myId = String(user?.id || '');
    const isMe = String(currentPulse.author?.id || '') === myId || String(currentPulse.user?.id || '') === myId;
    
    // PRODUCTION FIX: Removed `picsum.photos` fallback. Left empty so UI falls back cleanly.
    const imageSrc = currentPulse.imageUrl || currentPulse.image || currentPulse.img || '';
    const username = currentPulse.author?.username || currentPulse.user?.username || 'User';
    const userAvatar = currentPulse.author?.avatarUrl || currentPulse.user?.avatarUrl;
    const isVideo = imageSrc && imageSrc.toLowerCase().match(/\.(mp4|mov|webm)$/i);

    const handleShare = async () => {
        try { 
            fetchAPI(`/pulse/${currentPulse.id}/share`, { method: 'POST' }).catch(()=>{});

            if (Platform.OS === 'web') {
                if (navigator.share) {
                    await navigator.share({ title: 'KliqTap', text: `Check out ${username}'s vibe on KliqTap!`, url: imageSrc || window.location.href });
                } else {
                    navigator.clipboard.writeText(imageSrc || window.location.href);
                    Toast.show({ type: 'success', text1: 'Link Copied!' });
                }
            } else {
                await Share.share({ message: `Check out ${username}'s vibe on KliqTap!`, url: imageSrc }); 
            }
        } 
        catch (error) { console.error("Share error:", error); }
    };

    const handleDelete = () => {
        const confirmDelete = async () => {
            try { 
                if (deletePulse && currentPulse.id) { 
                    await deletePulse(currentPulse.id); 
                    if (userPulses.length === 1) onClose(); 
                    else handleNext();
                } 
            } catch (e) { 
                Toast.show({ type: 'error', text1: 'Error', text2: 'Could not delete.' });
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Remove this from your story?")) confirmDelete();
        } else {
            Alert.alert("Delete Pulse", "Remove this from your story?", [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: confirmDelete }
            ]);
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || isSendingReply) return;
        setIsSendingReply(true);

        try {
            const recipientId = currentPulse.author?.id || currentPulse.user?.id;
            await fetchAPI('/chats/private', {
                method: 'POST',
                body: JSON.stringify({ 
                    recipientId: recipientId, 
                    message: `Replying to your Pulse: ${replyText.trim()}`,
                    pulseContext: currentPulse.id
                })
            });

            Toast.show({ type: 'success', text1: 'Sent!', text2: `Replied to ${username}.` });
            setReplyText(''); 
            setIsInputFocused(false);
            Keyboard.dismiss();
            onClose(); 
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Oops', text2: 'Could not send the reply.' });
        } finally {
            setIsSendingReply(false);
        }
    };

    return (
        <Modal visible={!!item} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={[localStyles.storyContainer, { width, height }]}>
                
                <View style={localStyles.progressContainer}>
                    {userPulses.map((p, i) => (
                        <View key={p.id} style={localStyles.progressBarBg}>
                            {i < currentIndex && <View style={[localStyles.progressBarFill, { width: '100%' }]} />}
                            {i === currentIndex && (
                                <Animated.View style={[localStyles.progressBarFill, { 
                                    width: animProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) 
                                }]} />
                            )}
                        </View>
                    ))}
                </View>

                {imageSrc ? (
                    !isVideo && (
                        <Image source={{ uri: imageSrc }} style={[StyleSheet.absoluteFillObject, { width, height }]} resizeMode="cover" blurRadius={40} />
                    )
                ) : (
                    // Fallback gradient for text-only pulses
                    <View style={[StyleSheet.absoluteFillObject, { width, height, backgroundColor: '#1a1a2e' }]} />
                )}
                
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isVideo ? '#000' : 'rgba(0,0,0,0.5)', width, height }]} />

                {imageSrc ? (
                    isVideo ? (
                        <Video
                            source={{ uri: imageSrc }}
                            style={[StyleSheet.absoluteFillObject, { width, height }]}
                            resizeMode="contain"
                            shouldPlay={!isPaused} // UX FIX: Video pauses when typing
                            isLooping={false} 
                            onPlaybackStatusUpdate={(status) => {
                                if (status.didJustFinish) {
                                    if (!isPaused) handleNext();
                                } else if (status.durationMillis && status.positionMillis) {
                                    if (!isPaused) animProgress.setValue(status.positionMillis / status.durationMillis);
                                }
                            }}
                        />
                    ) : (
                        <Image source={{ uri: imageSrc }} style={[StyleSheet.absoluteFillObject, { width, height }]} resizeMode="contain" />
                    )
                ) : null}

                <TouchableOpacity style={localStyles.tapAreaLeft} onPress={handlePrev} activeOpacity={1} />
                <TouchableOpacity style={localStyles.tapAreaRight} onPress={handleNext} activeOpacity={1} />

                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                    style={[localStyles.storyUIContent, { width, height }]} 
                    pointerEvents="box-none"
                >
                    <View style={localStyles.storyHeader}>
                        <View style={localStyles.storyUserInfo}>
                            <View style={localStyles.storyAvatarWrapper}>
                                {userAvatar && <Image source={{ uri: userAvatar }} style={{width: '100%', height: '100%'}} />}
                            </View>
                            <View>
                                <Text style={localStyles.storyUsername}>{username}</Text>
                                <Text style={localStyles.storyTime}>{new Date(currentPulse.createdAt || currentPulse.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                            </View>
                        </View>
                        <View style={localStyles.storyActions}>
                            {isMe && (
                                <TouchableOpacity onPress={handleDelete} style={localStyles.trashBtn}>
                                    <Ionicons name="trash-outline" size={22} color="#fff" />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={onClose} style={{ padding: 5 }}>
                                <Ionicons name="close" size={32} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={localStyles.storyFooter}>
                        {currentPulse.text ? <Text style={localStyles.storyMainText}>{currentPulse.text}</Text> : null}
                        {!isMe && (
                            <View style={localStyles.replyRow}>
                                <TextInput 
                                    placeholder="Reply..." 
                                    placeholderTextColor="rgba(255,255,255,0.7)"
                                    value={replyText}
                                    onChangeText={setReplyText}
                                    onFocus={() => setIsInputFocused(true)}
                                    onBlur={() => setIsInputFocused(false)}
                                    style={localStyles.replyInput}
                                    onSubmitEditing={handleSendReply}
                                    returnKeyType="send"
                                    editable={!isSendingReply}
                                />
                                {replyText.trim().length > 0 && (
                                    <TouchableOpacity onPress={handleSendReply} style={{marginRight: 10}}>
                                        {isSendingReply ? (
                                            <ActivityIndicator color={brand.blue} size="small" />
                                        ) : (
                                            <Ionicons name="send" size={24} color={brand.blue} />
                                        )}
                                    </TouchableOpacity>
                                )}
                                
                                <View style={{ position: 'relative', marginLeft: 10, zIndex: 9999 }}>
                                    
                                    {showVibes && (
                                        <Animated.View style={{
                                            position: 'absolute', bottom: 55, right: 0,
                                            flexDirection: 'row', backgroundColor: 'rgba(20,20,20,0.98)',
                                            borderRadius: 30, paddingHorizontal: 12, paddingVertical: 8, 
                                            borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                                            alignItems: 'center', gap: 14, elevation: 20,
                                            shadowColor: '#000', shadowOffset: { width:0, height:4 }, shadowOpacity: 0.6, shadowRadius: 10,
                                            zIndex: 9999
                                        }}>
                                            {QUICK_EMOJIS.map(em => (
                                                <TouchableOpacity key={em} onPress={() => handleVibeSelect(em)}>
                                                    <Text style={{ fontSize: 16 }}>{em}</Text>
                                                </TouchableOpacity>
                                            ))}
                                            <View style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                                            <TouchableOpacity onPress={() => setShowVibes(false)} style={{ padding: 4 }}>
                                                <Ionicons name="close-circle" size={26} color="rgba(255,255,255,0.6)" />
                                            </TouchableOpacity>
                                        </Animated.View>
                                    )}

                                    <View style={{ position: 'relative' }}>
                                        <TouchableOpacity onPress={handleToggleLike} onLongPress={() => setShowVibes(true)}>
                                            {liked && localVibe && localVibe !== '❤️' ? (
                                                <Text style={{ fontSize: 30, marginHorizontal: 6 }}>{localVibe}</Text>
                                            ) : (
                                                <Ionicons name={liked ? "heart" : "heart-outline"} size={34} color={liked ? "#FF2D55" : "#fff"} style={{ marginHorizontal: 6 }} />
                                            )}
                                        </TouchableOpacity>
                                        
                                        {!showVibes && (
                                            <TouchableOpacity onPress={() => setShowVibes(!showVibes)} style={{
                                                position: 'absolute', bottom: -2, right: 2,
                                                backgroundColor: brand.blue || '#8E2DE2', borderRadius: 12, width: 20, height: 20,
                                                alignItems: 'center', justifyContent: 'center',
                                                borderWidth: 2, borderColor: '#000', elevation: 5
                                            }}>
                                                <Ionicons name="add" size={12} color="#FFF" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                <TouchableOpacity onPress={handleShare}>
                                    <Ionicons name="share-social-outline" size={28} color="#fff" style={{marginLeft: 15}}/>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const localStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: { width: '100%', height: height * 0.50, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden', shadowColor: "#000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 24 },
    coverImage: { width: '100%', height: 110 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    floatingClose: { position: 'absolute', top: 15, right: 15, borderRadius: 20, padding: 6, zIndex: 10 },
    contentCenter: { alignItems: 'center', width: '100%', paddingHorizontal: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', marginTop: -45, marginBottom: 15 },
    avatarWrapper: { position: 'relative' },
    avatarRing: { padding: 4, backgroundColor: '#fff', borderRadius: 55, elevation: 5 },
    mainAvatar: { width: 90, height: 90, borderRadius: 45 },
    kingBadge: { position: 'absolute', top: 5, right: -5, backgroundColor: 'black', padding: 5, borderRadius: 12, borderWidth: 1, borderColor: 'gold' },
    statusIndicator: { position: 'absolute', bottom: 5, right: 5, width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    statusDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
    actionButtons: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    followBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25, flexDirection: 'row', alignItems: 'center' },
    btnTextWhite: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    userName: { fontSize: 24, fontWeight: '900', color: '#111', alignSelf: 'flex-start' },
    userHandle: { fontSize: 15, color: '#888', marginBottom: 5, fontWeight: '600', alignSelf: 'flex-start' },
    vibeStatus: { fontSize: 14, fontWeight: 'bold', marginBottom: 15, alignSelf: 'flex-start' },
    userBio: { alignSelf: 'flex-start', fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 20 },
    statsBar: { flexDirection: 'row', backgroundColor: '#F8F9FB', borderRadius: 20, paddingVertical: 15, width: '100%', justifyContent: 'space-evenly', marginBottom: 20, borderWidth: 1, borderColor: '#F0F0F0' },
    statItem: { alignItems: 'center', justifyContent: 'center' },
    statVal: { fontSize: 18, fontWeight: '900', color: '#111' },
    statLab: { fontSize: 11, color: '#999', fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
    divider: { width: 1, height: '70%', backgroundColor: '#E0E0E0', alignSelf: 'center' },

    storyContainer: { backgroundColor: '#000', position: 'relative' },
    progressContainer: { flexDirection: 'row', position: 'absolute', top: Platform.OS === 'ios' ? 50 : 20, left: 10, right: 10, zIndex: 30, gap: 4 },
    progressBarBg: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },

    tapAreaLeft: { position: 'absolute', top: 100, bottom: 100, left: 0, width: '30%', zIndex: 15 },
    tapAreaRight: { position: 'absolute', top: 100, bottom: 100, right: 0, width: '70%', zIndex: 15 },

    storyUIContent: { position: 'absolute', top: 0, left: 0, justifyContent: 'space-between', padding: 20, paddingTop: Platform.OS === 'ios' ? 65 : 35, zIndex: 20 }, 
    storyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    storyUserInfo: { flexDirection: 'row', alignItems: 'center' },
    storyAvatarWrapper: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginRight: 12, borderWidth: 2, borderColor: '#fff' },
    storyUsername: { color: '#fff', fontWeight: '900', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
    storyTime: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
    storyActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    trashBtn: { backgroundColor: 'rgba(255,0,0,0.3)', padding: 8, borderRadius: 15 },
    
    storyFooter: { marginBottom: 70 }, 
    
    storyMainText: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 40, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 },
    replyRow: { flexDirection: 'row', alignItems: 'center' },
    replyInput: { flex: 1, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, color: '#fff', marginRight: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }
});