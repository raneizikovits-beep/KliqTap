// client/src/components/modals/PeekModals.js
// ⭐️ FULL VERSION: Video Support + Working Replies + Profile Peek ⭐️

import React, { useState, useEffect } from 'react';
import { 
    View, Text, Image, Modal, TouchableOpacity, ActivityIndicator,
    TextInput, Alert, Share, StyleSheet, ScrollView, Dimensions,
    Platform, Linking 
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Video } from 'expo-av'; // ⭐️ הוספת תמיכה בניגון וידאו ⭐️
import Toast from 'react-native-toast-message'; // ⭐️ הוספת תמיכה בהתראות הצלחה לשליחת תגובה ⭐️
import { brand } from '../../constants/data';
import { useAppStore } from '../../store/useAppStore'; 
import { fetchAPI } from '../../store/api'; 

const { width, height } = Dimensions.get('window');

/**
 * 1. PROFILE PEEK MODAL (Global - Premium UI with Cover & Loading State)
 * ⭐️ Removed Follow & Message buttons to direct users to Full Profile ⭐️
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
  
  const avatar = activeProfile?.avatarUrl || activeProfile?.profilePic || activeProfile?.profileImage || activeProfile?.picture || activeProfile?.photoUrl || activeProfile?.imageUrl || activeProfile?.img || activeProfile?.avatar || activeProfile?.image || `https://ui-avatars.com/api/?name=${activeProfile?.name || activeProfile?.username || 'User'}&background=random`;
  const cover = activeProfile?.coverUrl || 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=1000'; 
  const name = activeProfile?.name || activeProfile?.username || 'Anonymous User';
  const bio = activeProfile?.bio || activeProfile?.intent || 'Just vibing on KliqTap ✌️';
  const points = activeProfile?.points || 120;
  const streak = activeProfile?.streak || 5;
  const isOnline = activeProfile?.isOnline !== false;

  const handleViewFullProfile = () => {
      handleClose();
      setTimeout(() => {
          if (setViewingUserId && profileId) setViewingUserId(profileId); 
          if (setTriggerOpenProfile && profileId) setTriggerOpenProfile(profileId); 
      }, 350);
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
                                  <TouchableOpacity style={localStyles.statItem} onPress={() => Linking.openURL(activeProfile.instagramUrl)}>
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
 * ⭐️ Added Video playback and functional replies ⭐️
 */
export function StoryModal({ item, onClose }) {
    const { user, deletePulse } = useAppStore();

    const [replyText, setReplyText] = useState('');
    const [liked, setLiked] = useState(false);
    const [isSendingReply, setIsSendingReply] = useState(false); // ⭐️ סטייט לניהול שליחת התגובה ⭐️
    
    if (!item) return null;

    const myId = String(user?.id || '');
    const isMe = String(item.author?.id || '') === myId || String(item.user?.id || '') === myId;
    const imageSrc = item.imageUrl || item.image || item.img || 'https://picsum.photos/800/1600';
    const username = item.author?.username || item.user?.username || 'User';
    const userAvatar = item.author?.avatarUrl || item.user?.avatarUrl;

    // ⭐️ זיהוי האם הקובץ הוא וידאו ⭐️
    const isVideo = imageSrc && (imageSrc.toLowerCase().endsWith('.mp4') || imageSrc.toLowerCase().endsWith('.mov') || imageSrc.toLowerCase().endsWith('.webm'));

    const handleShare = async () => {
        try { 
            if (Platform.OS === 'web') {
                if (navigator.share) await navigator.share({ title: 'KliqTap', text: `Check out ${username}'s vibe on KliqTap!`, url: imageSrc });
                else {
                    navigator.clipboard.writeText(`Check out ${username}'s vibe: ${imageSrc}`);
                    window.alert("Link copied!");
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
                if (deletePulse && item.id) { 
                    await deletePulse(item.id); 
                    onClose(); 
                } 
            } catch (e) { 
                if (Platform.OS === 'web') window.alert("Could not delete.");
                else Alert.alert("Error", "Could not delete."); 
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

    // ⭐️ פונקציה לשליחת תגובה לפאלס ⭐️
    const handleSendReply = async () => {
        if (!replyText.trim() || isSendingReply) return;
        setIsSendingReply(true);

        try {
            const recipientId = item.author?.id || item.user?.id;
            
            // שליחת הודעה פרטית באמצעות ה-API הקיים שלך
            await fetchAPI('/chats/private', {
                method: 'POST',
                body: JSON.stringify({ 
                    recipientId: recipientId, 
                    message: `Replying to your Pulse: ${replyText.trim()}`,
                    pulseContext: item.id
                })
            });

            Toast.show({ type: 'success', text1: 'Sent!', text2: `Replied to ${username}.` });
            setReplyText(''); 
            onClose(); 
        } catch (error) {
            console.error("Reply error:", error);
            Toast.show({ type: 'error', text1: 'Oops', text2: 'Could not send the reply.' });
        } finally {
            setIsSendingReply(false);
        }
    };

    return (
        <Modal visible={!!item} transparent={true} animationType="fade" onRequestClose={onClose}>
            <View style={[localStyles.storyContainer, { width, height }]}>
                
                {/* תצוגת רקע מטושטשת מיועדת רק לתמונות למניעת עומס רינדור בווידאו */}
                {!isVideo && (
                    <Image 
                        source={{ uri: imageSrc }} 
                        style={[StyleSheet.absoluteFillObject, { width, height }]} 
                        resizeMode="cover" 
                        blurRadius={40} 
                    />
                )}
                
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: isVideo ? '#000' : 'rgba(0,0,0,0.5)', width, height }]} />

                {/* ⭐️ הרנדור הראשי: וידאו או תמונה ⭐️ */}
                {isVideo ? (
                    <Video
                        source={{ uri: imageSrc }}
                        style={[StyleSheet.absoluteFillObject, { width, height }]}
                        resizeMode="contain"
                        shouldPlay
                        isLooping
                    />
                ) : (
                    <Image 
                        source={{ uri: imageSrc }} 
                        style={[StyleSheet.absoluteFillObject, { width, height }]} 
                        resizeMode="contain" 
                    />
                )}

                <View style={[localStyles.storyUIContent, { width, height }]}>
                    <View style={localStyles.storyHeader}>
                        <View style={localStyles.storyUserInfo}>
                            <View style={localStyles.storyAvatarWrapper}>
                                {userAvatar && <Image source={{ uri: userAvatar }} style={{width: '100%', height: '100%'}} />}
                            </View>
                            <View>
                                <Text style={localStyles.storyUsername}>{username}</Text>
                                <Text style={localStyles.storyTime}>Just now</Text>
                            </View>
                        </View>
                        <View style={localStyles.storyActions}>
                            {isMe && (
                                <TouchableOpacity onPress={handleDelete} style={localStyles.trashBtn}>
                                    <Ionicons name="trash-outline" size={22} color="#fff" />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={onClose}>
                                <Ionicons name="close" size={32} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={localStyles.storyFooter}>
                        {item.text ? <Text style={localStyles.storyMainText}>{item.text}</Text> : null}
                        {!isMe && (
                            <View style={localStyles.replyRow}>
                                {/* ⭐️ שורת התגובה המעודכנת ⭐️ */}
                                <TextInput 
                                    placeholder="Reply..." 
                                    placeholderTextColor="rgba(255,255,255,0.7)"
                                    value={replyText}
                                    onChangeText={setReplyText}
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
                                <TouchableOpacity onPress={() => setLiked(!liked)}>
                                    <Ionicons name={liked ? "heart" : "heart-outline"} size={32} color={liked ? brand.red : "#fff"} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleShare}>
                                    <Ionicons name="share-social-outline" size={28} color="#fff" style={{marginLeft: 10}}/>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const localStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    
    sheet: { 
        width: '100%', 
        height: height * 0.50, 
        backgroundColor: '#fff', 
        borderTopLeftRadius: 30, 
        borderTopRightRadius: 30, 
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 24
    },
    coverImage: { width: '100%', height: 110 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    floatingClose: { position: 'absolute', top: 15, right: 15, borderRadius: 20, padding: 6, zIndex: 10 },
    contentCenter: { alignItems: 'center', width: '100%', paddingHorizontal: 20 },
    
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', marginTop: -45, marginBottom: 15 },
    avatarWrapper: { position: 'relative' },
    avatarRing: { padding: 4, backgroundColor: '#fff', borderRadius: 55, elevation: 5 },
    mainAvatar: { width: 90, height: 90, borderRadius: 45 },
    kingBadge: { position: 'absolute', top: 5, right: -5, backgroundColor: 'black', padding: 5, borderRadius: 12, borderWidth: 1, borderColor: 'gold' },
    statusIndicator: { 
        position: 'absolute', bottom: 5, right: 5, 
        width: 20, height: 20, borderRadius: 10, 
        borderWidth: 3, borderColor: '#fff',
        justifyContent: 'center', alignItems: 'center'
    },
    statusDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
    
    actionButtons: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    followBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 25, flexDirection: 'row', alignItems: 'center' },
    followingBtn: { backgroundColor: '#333' },
    btnTextWhite: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    btnTextDark: { color: '#444', fontWeight: 'bold', fontSize: 14 },
    connectedRow: { flexDirection: 'row', gap: 8 },
    iconCircleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F9F0', justifyContent: 'center', alignItems: 'center' },

    userName: { fontSize: 24, fontWeight: '900', color: '#111', alignSelf: 'flex-start' },
    userHandle: { fontSize: 15, color: '#888', marginBottom: 5, fontWeight: '600', alignSelf: 'flex-start' },
    vibeStatus: { fontSize: 14, fontWeight: 'bold', marginBottom: 15, alignSelf: 'flex-start' },
    userBio: { alignSelf: 'flex-start', fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 20 },
    
    statsBar: { 
        flexDirection: 'row', backgroundColor: '#F8F9FB', 
        borderRadius: 20, paddingVertical: 15, width: '100%', 
        justifyContent: 'space-evenly', marginBottom: 20,
        borderWidth: 1, borderColor: '#F0F0F0'
    },
    statItem: { alignItems: 'center', justifyContent: 'center' },
    statVal: { fontSize: 18, fontWeight: '900', color: '#111' },
    statLab: { fontSize: 11, color: '#999', fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
    divider: { width: 1, height: '70%', backgroundColor: '#E0E0E0', alignSelf: 'center' },
    
    fullProfileLink: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 15, backgroundColor: '#f5f5f5', borderRadius: 15, width: '100%', justifyContent: 'center' },
    fullProfileText: { color: brand.blue, fontWeight: '800', fontSize: 15 },

    // ⭐️ Story Styles ⭐️
    storyContainer: { backgroundColor: '#000', position: 'relative' },
    storyUIContent: { position: 'absolute', top: 0, left: 0, justifyContent: 'space-between', padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, zIndex: 10 }, 
    storyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    storyUserInfo: { flexDirection: 'row', alignItems: 'center' },
    storyAvatarWrapper: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginRight: 12, borderWidth: 2, borderColor: '#fff' },
    storyUsername: { color: '#fff', fontWeight: '900', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
    storyTime: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
    storyActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    trashBtn: { backgroundColor: 'rgba(255,0,0,0.3)', padding: 8, borderRadius: 15 },
    storyFooter: { marginBottom: 30 },
    storyMainText: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 40, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 },
    replyRow: { flexDirection: 'row', alignItems: 'center' },
    replyInput: { flex: 1, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, color: '#fff', marginRight: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }
});