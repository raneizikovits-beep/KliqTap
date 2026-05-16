// client/src/screens/ProfileScreen.js
// ⭐️ V8.2 ULTIMATE: Fixed UI Layout, Call Buttons in Same Row, Real Data ⭐️

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, 
  Alert, ActivityIndicator, StyleSheet, Dimensions, Modal
} from 'react-native'; 
import * as ImagePicker from 'expo-image-picker'; 
import { Ionicons } from '@expo/vector-icons'; 
import { LinearGradient } from 'expo-linear-gradient'; 
import * as Data from '../constants/data';
import { styles as globalStyles } from '../constants/styles';
import { useAppStore } from '../store/useAppStore'; 
import PostCard from '../components/PostCard';
import { PostCommentsModal } from '../components/modals/PostCommentsModal';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ setSecondSheet, openChat, sheet, route }) {
  const {
      user: loggedInUser, logout, points: myPoints, streak: myStreak, badges: myBadges,
      posts: allPosts, pulses, refreshAllData, uploadFile, updateUserProfile,
      setPulseCreateOpen, setPulseImageUri, viewingUserId, setViewingUserId,
      resolveUser, startDirectChat, userSettings, startCall, 
      followStatuses, checkFollowStatus, toggleFollow, profilePeekUser
  } = useAppStore();

  const isDark = userSettings?.darkMode === true; 

  const targetId = String(sheet?.userId || route?.params?.userId || viewingUserId || loggedInUser?.id || '');
  const isMe = !!targetId && targetId === String(loggedInUser?.id || '');

  // ⭐️ משיכת הנתונים ישירות מהמיני-פרופיל אם הם קיימים כדי למנוע הבהובים
  const [displayUser, setDisplayUser] = useState(() => {
      if (isMe) return loggedInUser;
      if (profilePeekUser && String(profilePeekUser.id) === targetId) return profilePeekUser;
      return null;
  });
  
  const [isLoadingDisplay, setIsLoadingDisplay] = useState(!displayUser);
  const [profileTab, setProfileTab] = useState('posts'); 
  const [refreshing, setRefreshing] = useState(false);
  const [loadingImage, setLoadingImage] = useState(null); 
  const [commentPostId, setCommentPostId] = useState(null);
  const [viewImage, setViewImage] = useState(null); 

  const loggedInUserId = loggedInUser?.id;

  // ⭐️ זיכרון עוקב חכם: קודם בודק את הסטטוס החי, ואז את המיני-פרופיל
  const isCurrentlyFollowing = useMemo(() => {
      if (typeof followStatuses[targetId] === 'boolean') return followStatuses[targetId];
      if (profilePeekUser && String(profilePeekUser.id) === targetId && typeof profilePeekUser.isFollowing === 'boolean') return profilePeekUser.isFollowing;
      if (displayUser && typeof displayUser.isFollowing === 'boolean') return displayUser.isFollowing;
      return false;
  }, [followStatuses, targetId, profilePeekUser, displayUser]);

  // ⭐️ סנכרון עוקב: מבצע checkFollowStatus מיד לאחר טעינת הפרופיל למניעת איפוס הכפתור
  const loadProfileData = useCallback(async (silent = false) => {
      if (!silent) setIsLoadingDisplay(true);
      try {
          const data = await resolveUser(targetId);
          if (data) {
              setDisplayUser(data);
              if (!isMe) {
                  await checkFollowStatus(targetId);
              }
          }
      } catch (e) {
          console.error("[Profile] Failed to load user data:", e);
      } finally {
          setIsLoadingDisplay(false);
      }
  }, [targetId, isMe, resolveUser, checkFollowStatus]);

  useEffect(() => {
      let active = true;
      if (isMe) {
          if (active) { setDisplayUser(loggedInUser); setIsLoadingDisplay(false); }
      } else if (targetId) {
          loadProfileData();
      }
      return () => { active = false; };
  }, [targetId, isMe, loggedInUserId, loggedInUser, loadProfileData]); 

  useEffect(() => {
      return () => { if (viewingUserId) setViewingUserId(null); };
  }, [viewingUserId, setViewingUserId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
        if (isMe && refreshAllData) {
            await refreshAllData();
        } 
        await loadProfileData(true);
    } catch(e) {
        console.error("Failed to refresh data", e);
    } finally {
        setRefreshing(false);
    }
  }, [isMe, refreshAllData, loadProfileData]);

  const handleOpenPulseCreator = useCallback(() => {
      if (setPulseImageUri) setPulseImageUri(null);
      if (setPulseCreateOpen) setPulseCreateOpen(true);
  }, [setPulseImageUri, setPulseCreateOpen]);

  const handleImageUpload = useCallback(async (type) => {
      if (!isMe) return; 
      try {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
              Alert.alert("Permission Required", "We need access to your gallery to update your profile.");
              return;
          }
          const options = {
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true, 
              aspect: type === 'cover1' ? [16, 9] : [1, 1],
              quality: 0.8,
          };
          const result = await ImagePicker.launchImageLibraryAsync(options);
          if (!result.canceled && result.assets && result.assets.length > 0) {
              const uri = result.assets[0].uri;
              setLoadingImage(type);
              
              const targetType = type === 'cover1' ? 'cover' : type;
              const uploadedUrl = await uploadFile(uri, targetType); 
              
              if (uploadedUrl) {
                  const updates = {};
                  if (type === 'avatar') updates.avatarUrl = uploadedUrl;
                  if (type === 'cover1') updates.coverUrl = uploadedUrl;
                  
                  await updateUserProfile(updates);
                  if (refreshAllData) refreshAllData();
                  loadProfileData(true);
              }
          }
      } catch (error) {
          Alert.alert("Error", "Image upload failed. Please try again.");
      } finally { 
          setLoadingImage(null); 
      }
  }, [isMe, uploadFile, updateUserProfile, refreshAllData, loadProfileData]);

  // ⭐️ פונקציית התקשרות (Call Handler) למשתמש ⭐️
  const handleCallPress = useCallback(async (isVideo = false) => {
      if (!targetId) return;
      try {
          if (startCall) {
              await startCall(targetId, isVideo);
          } else {
              Alert.alert("Call Offline", "Call service is currently not connected.");
          }
      } catch (error) {
          console.error("[Profile] Call Error:", error);
          Alert.alert("Call Failed", "Could not establish a connection right now.");
      }
  }, [startCall, targetId]);

  const userPosts = useMemo(() => {
    if (!displayUser || !allPosts) return [];
    const tId = String(displayUser.id);
    return allPosts.filter(post => post.author && String(post.author.id) === tId).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [allPosts, displayUser]);
  
  const userActivePulses = useMemo(() => {
     if (!displayUser || !pulses) return [];
     const tId = String(displayUser.id);
     return pulses.filter(p => String(p.author?.id) === tId);
  }, [pulses, displayUser]);

  const currentAvatar = displayUser?.avatarUrl || displayUser?.img || displayUser?.avatar || profilePeekUser?.avatarUrl || Data.USER_PROFILE_PIC;
  const genericCover = 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=1000';
  const coverImage = displayUser?.coverUrl || displayUser?.coverImage || displayUser?.cover || profilePeekUser?.coverUrl || genericCover; 

  const displayPoints = isMe ? myPoints : (displayUser?.points || 0);
  const displayStreak = isMe ? myStreak : (displayUser?.streak || 0);
  const displayBadges = isMe ? myBadges : (displayUser?.badges || []);

  if (isLoadingDisplay && !displayUser) {
      return (
         <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#000' : '#fff' }}>
             <ActivityIndicator size="large" color={Data.brand.blue} />
         </View>
      );
  }

  const renderContent = () => {
    const textColor = isDark ? '#fff' : '#222';
    const subTextColor = isDark ? '#aaa' : '#888';
    const cardBg = isDark ? '#1C1C1E' : '#fff';
    const borderColor = isDark ? '#333' : '#eee';

    switch(profileTab) {
        case 'about':
            return (
              <View style={localStyles.tabContent}>
                <View style={[localStyles.glassCard, { backgroundColor: cardBg, borderColor }]}>
                    <Text style={[localStyles.sectionTitle, { color: textColor }]}>{isMe ? "My Bio ✍️" : "Bio ✍️"}</Text>
                    <Text style={[localStyles.bioText, { color: isDark ? '#ccc' : '#555' }]}>
                        {displayUser?.bio || displayUser?.intent || (isMe ? "Add a bio in Edit Profile." : "No bio available.")}
                    </Text>
                </View>
                
                {/* ⭐️ Real Interests - No Placeholders ⭐️ */}
                <Text style={[localStyles.sectionTitle, { color: textColor, marginTop: 25, marginBottom: 10 }]}>Passions & Interests</Text>
                <View style={localStyles.tagsContainer}>
                    {displayUser?.interests && Array.isArray(displayUser.interests) && displayUser.interests.length > 0 ? (
                        displayUser.interests.map((tag, i) => (
                            <View key={i} style={[localStyles.luxuryTag, { backgroundColor: cardBg, borderColor }]}>
                                <Text style={[localStyles.tagText, { color: isDark ? '#ddd' : '#444' }]}>{tag}</Text>
                            </View>
                        ))
                    ) : (
                         <Text style={{ color: subTextColor, fontStyle: 'italic' }}>No interests added yet.</Text>
                    )}
                </View>

                {/* ⭐️ Improved Black Logout Button ⭐️ */}
                {isMe && (
                    <TouchableOpacity style={localStyles.blackLogoutBtn} onPress={logout} activeOpacity={0.8}>
                        <Ionicons name="log-out-outline" size={22} color="#fff" />
                        <Text style={localStyles.blackLogoutText}>Sign Out</Text>
                    </TouchableOpacity>
                )}
              </View>
            );

        case 'activity':
            return (
              <View style={localStyles.tabContent}>
                {/* Real Stats */}
                <View style={[localStyles.statsContainer, { backgroundColor: cardBg, borderColor }]}>
                    <View style={localStyles.statBox}>
                        <Text style={[localStyles.statValue, { color: textColor }]}>{displayPoints}</Text>
                        <Text style={[localStyles.statLabel, { color: subTextColor }]}>Karma</Text>
                    </View>
                    <View style={[localStyles.statBox, localStyles.statBoxBorder, { borderColor }]}>
                        <Text style={[localStyles.statValue, { color: textColor }]}>{displayStreak}🔥</Text>
                        <Text style={[localStyles.statLabel, { color: subTextColor }]}>Streak</Text>
                    </View>
                    <View style={localStyles.statBox}>
                        <Text style={[localStyles.statValue, { color: textColor }]}>{displayBadges?.length || 0}</Text>
                        <Text style={[localStyles.statLabel, { color: subTextColor }]}>Badges</Text>
                    </View>
                </View>

                {/* ⭐️ Real Followers / Following Counts ⭐️ */}
                <Text style={[localStyles.sectionTitle, { color: textColor, marginTop: 10 }]}>Connections</Text>
                <View style={[localStyles.glassCard, { backgroundColor: cardBg, borderColor, flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15 }]}>
                    <View style={localStyles.statItemSmall}>
                        <Text style={[localStyles.statValue, { color: textColor }]}>{displayUser?.followersCount || displayUser?.followers?.length || 0}</Text>
                        <Text style={[localStyles.statLabel, { color: subTextColor }]}>Followers</Text>
                    </View>
                    <View style={localStyles.statItemSmall}>
                        <Text style={[localStyles.statValue, { color: textColor }]}>{displayUser?.followingCount || displayUser?.following?.length || 0}</Text>
                        <Text style={[localStyles.statLabel, { color: subTextColor }]}>Following</Text>
                    </View>
                </View>

                {/* ⭐️ Real Followers List (Scrollable inside the main ScrollView) ⭐️ */}
                {displayUser?.followers && Array.isArray(displayUser.followers) && displayUser.followers.length > 0 && (
                    <View style={{ marginTop: 20 }}>
                        <Text style={[localStyles.sectionTitle, { color: textColor, fontSize: 16 }]}>Followers List</Text>
                        <View style={[localStyles.glassCard, { backgroundColor: cardBg, borderColor, padding: 5 }]}>
                            {displayUser.followers.map((f, i) => {
                                const fData = f.follower || f.user || f; 
                                return (
                                    <TouchableOpacity 
                                        key={i} 
                                        style={[localStyles.followerRow, { borderBottomWidth: i === displayUser.followers.length - 1 ? 0 : 1, borderBottomColor: borderColor }]} 
                                        onPress={() => setSecondSheet({ source: "Profile", userId: fData.id })}
                                    >
                                        <Image source={{ uri: fData.avatarUrl || fData.avatar || Data.USER_PROFILE_PIC }} style={localStyles.followerAvatar} />
                                        <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 15 }}>{fData.name || fData.username || 'User'}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}
              </View>
            );

        case 'posts':
            return (
                <View style={{ marginTop: 10 }}>
                {userPosts.length > 0 ? (
                    userPosts.map(post => (
                    <PostCard 
                        key={String(post.id)}  
                        post={{ ...post, user: post.author, authorId: post.author?.id, image: post.imageUrl }}
                        onOpenProfile={() => setSecondSheet({ source: "EditProfile" })} 
                        onOpenComments={() => setCommentPostId(String(post.id || post._id))} 
                        isDark={isDark} 
                    />
                    ))
                ) : (
                    <View style={localStyles.emptyState}>
                        <Ionicons name="camera-outline" size={60} color={isDark ? '#444' : "#ddd"} />
                        <Text style={[localStyles.emptyStateText, { color: subTextColor }]}>No memories yet.</Text>
                        {isMe && (
                            <TouchableOpacity onPress={handleOpenPulseCreator} style={localStyles.createBtnSmall}>
                                <Text style={localStyles.createBtnText}>Create First Post</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
                </View>
            );

        case 'pulse':
            const activePulse = userActivePulses[0];
            let vibeColor = Data.brand.blue;
            if (activePulse?.vibe === 'Party') vibeColor = '#FF2D55';
            if (activePulse?.vibe === 'Happy') vibeColor = '#FFD700';
            if (activePulse?.vibe === 'Focused') vibeColor = '#6200EE';
            const pulseImgSource = activePulse ? (activePulse.image || activePulse.imageUrl || activePulse.img) : null;

            return (
                <View style={localStyles.tabContent}>
                    {activePulse ? (
                        <View style={[localStyles.pulseCard, { backgroundColor: cardBg }]}>
                            {pulseImgSource ? (
                                <Image source={{ uri: pulseImgSource }} style={localStyles.pulseImage} />
                            ) : (
                                <View style={[localStyles.pulsePlaceholder, { backgroundColor: vibeColor }]}>
                                    <Text style={localStyles.pulsePlaceholderText}>"{activePulse.text}"</Text>
                                </View>
                            )}
                            <View style={localStyles.pulseMeta}>
                                {pulseImgSource && <Text style={[globalStyles.h3, { color: textColor }]}>{activePulse.text || "Vibe"}</Text>}
                                <View style={localStyles.liveIndicator}>
                                    <View style={localStyles.pulsingDot} />
                                    <Text style={localStyles.liveIndicatorText}>LIVE NOW</Text>
                                </View>
                                {isMe && (
                                    <TouchableOpacity style={[localStyles.updatePulseBtn, { backgroundColor: isDark ? '#333' : '#222' }]} onPress={handleOpenPulseCreator}>
                                        <Ionicons name="refresh" size={18} color="#fff" style={{marginRight: 8}}/>
                                        <Text style={localStyles.updatePulseText}>Update Vibe</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ) : (
                        <View style={localStyles.emptyState}>
                            <View style={[localStyles.emptyStateIconWrapper, { backgroundColor: isDark ? '#1C1C1E' : '#F0F4F8' }]}><Ionicons name="flash" size={40} color={Data.brand.blue} /></View>
                            <Text style={[globalStyles.h3, { color: textColor }]}>{isMe ? "Your Vibe is Offline" : "Vibe is Offline"}</Text>
                            <Text style={[localStyles.emptyStateSub, { color: subTextColor }]}>{isMe ? "Share what you're up to right now." : "No active pulse right now."}</Text>
                            {isMe && (
                                <TouchableOpacity style={localStyles.createPulseHeroBtn} onPress={handleOpenPulseCreator}>
                                    <Text style={localStyles.createPulseHeroText}>⚡ Create Pulse</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>
            );

        default:
            return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Data.brand.blue} />}>
        <View style={{ marginBottom: 20 }}> 
            
            <TouchableOpacity style={[localStyles.fullCoverContainer, { backgroundColor: isDark ? '#1C1C1E' : '#eee' }]} onPress={() => isMe ? handleImageUpload('cover1') : setViewImage(coverImage)} activeOpacity={isMe ? 0.95 : 0.8}>
                <Image source={{ uri: coverImage }} style={localStyles.coverImage} />
                <LinearGradient colors={['transparent', isDark ? '#000' : 'rgba(0,0,0,0.7)']} style={localStyles.coverGradient} />
                {isMe && <View style={localStyles.coverEditIcon}><Ionicons name="camera-outline" size={16} color="#fff" /></View>}
                {loadingImage === 'cover1' && <ActivityIndicator color="#fff" style={localStyles.loaderCenter} />}
            </TouchableOpacity>
            
            <View style={localStyles.profileHeaderBlock}>
                <View style={[localStyles.avatarWrapper, { borderColor: isDark ? '#000' : '#fff', backgroundColor: isDark ? '#000' : '#fff' }]}>
                    <TouchableOpacity onPress={() => isMe ? handleImageUpload('avatar') : setViewImage(currentAvatar)} activeOpacity={0.8}>
                        <Image source={{ uri: currentAvatar }} style={localStyles.mainAvatar} />
                        {loadingImage === 'avatar' && <ActivityIndicator color="#fff" style={localStyles.loaderCenter} />}
                    </TouchableOpacity>
                </View>
                
                {/* ⭐️ Header Text (Name and Username) ⭐️ */}
                <View style={localStyles.nameBlock}>
                    <Text style={[localStyles.bigName, { color: isDark ? '#fff' : '#222' }]} numberOfLines={1}>{displayUser?.name || 'Guest'}</Text>
                    <Text style={[localStyles.handle, { color: isDark ? '#aaa' : '#888' }]}>@{displayUser?.username || 'user'}</Text>
                </View>
            </View>

            {/* ⭐️ Actions Row - Moved below Header Block for full width ⭐️ */}
            <View style={localStyles.actionsRow}>
                {isMe ? (
                    <>
                        <TouchableOpacity style={[localStyles.settingsCircleBtn, { backgroundColor: isDark ? '#1C1C1E' : '#f5f5f5', borderColor: isDark ? '#333' : '#eee' }]} onPress={() => setSecondSheet({ source: "Settings" })}><Ionicons name="settings-outline" size={20} color={isDark ? '#fff' : '#333'} /></TouchableOpacity>
                        <TouchableOpacity style={[localStyles.luxuryEditBtn, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#E0E0E0' }]} onPress={() => setSecondSheet({ source: "EditProfile" })}>
                            <Text style={[localStyles.luxuryEditBtnText, { color: isDark ? '#fff' : '#333' }]}>Edit Profile</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        {/* Follow Button */}
                        <TouchableOpacity 
                            style={[localStyles.luxuryEditBtn, { 
                                backgroundColor: isCurrentlyFollowing ? (isDark ? '#1C1C1E' : '#f0f0f0') : Data.brand.blue, 
                                borderColor: isCurrentlyFollowing ? (isDark ? '#333' : '#ccc') : Data.brand.blue,
                            }]} 
                            onPress={() => toggleFollow(targetId)}
                        >
                            <Text style={[localStyles.luxuryEditBtnText, { color: isCurrentlyFollowing ? (isDark ? '#fff' : '#333') : '#fff' }]}>
                                {isCurrentlyFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                        
                        {/* Message Button */}
                        <TouchableOpacity style={[localStyles.luxuryEditBtn, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#E0E0E0' }]} onPress={() => startDirectChat(displayUser)}>
                            <Text style={[localStyles.luxuryEditBtnText, { color: isDark ? '#fff' : '#333' }]}>Message</Text>
                        </TouchableOpacity>

                        {/* Call Icons */}
                        <TouchableOpacity style={[localStyles.iconActionBtn, { borderColor: isDark ? '#333' : '#E0E0E0', backgroundColor: isDark ? '#1C1C1E' : '#fff' }]} onPress={() => handleCallPress(false)}>
                            <Ionicons name="call" size={16} color={isDark ? '#fff' : '#333'} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[localStyles.iconActionBtn, { borderColor: isDark ? '#333' : '#E0E0E0', backgroundColor: isDark ? '#1C1C1E' : '#fff' }]} onPress={() => handleCallPress(true)}>
                            <Ionicons name="videocam" size={16} color={isDark ? '#fff' : '#333'} />
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>

        <View style={[localStyles.tabRow, { borderBottomColor: isDark ? '#333' : '#f0f0f0' }]}>
            {['posts', 'pulse', 'activity', 'about'].map(tab => {
                const active = profileTab === tab;
                return (
                    <TouchableOpacity key={tab} onPress={() => setProfileTab(tab)} style={[localStyles.tabItem, active && localStyles.tabItemActive]}>
                        <Text style={[localStyles.tabText, { color: isDark ? '#888' : '#999' }, active && {color: Data.brand.blue}]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
                        {active && <View style={localStyles.activeIndicator} />}
                    </TouchableOpacity>
                );
            })}
        </View>

        {renderContent()}
        </ScrollView>

        <PostCommentsModal postId={commentPostId} visible={!!commentPostId} onClose={() => setCommentPostId(null)} isDark={isDark} />
        
        <Modal visible={!!viewImage} transparent={true} animationType="fade" onRequestClose={() => setViewImage(null)}>
            <View style={localStyles.imageViewerContainer}>
                <TouchableOpacity style={localStyles.imageViewerCloseBtn} onPress={() => setViewImage(null)}>
                    <Ionicons name="close" size={32} color="#fff" />
                </TouchableOpacity>
                <Image source={{ uri: viewImage }} style={localStyles.imageViewerImg} />
            </View>
        </Modal>

    </View>
  );
}

const localStyles = StyleSheet.create({
    fullCoverContainer: { width: '100%', height: 200 },
    coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    coverGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
    coverEditIcon: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 20 },
    loaderCenter: { position: 'absolute', alignSelf: 'center', top: '40%' },
    
    // ⭐️ Header layout improvements ⭐️
    profileHeaderBlock: { paddingHorizontal: 20, marginTop: -40, flexDirection: 'row', alignItems: 'flex-end' },
    avatarWrapper: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    mainAvatar: { width: '100%', height: '100%', borderRadius: 42 },
    nameBlock: { flex: 1, marginLeft: 15, paddingBottom: 5 }, 
    bigName: { fontSize: 22, fontWeight: '800' },
    handle: { fontSize: 14, fontWeight: '500' },
    
    // ⭐️ Actions row layout improvement to prevent overflow ⭐️
    actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingHorizontal: 20, flexWrap: 'wrap', gap: 8 },
    settingsCircleBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    luxuryEditBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    luxuryEditBtnText: { fontSize: 12, fontWeight: '700' },
    iconActionBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, alignItems: 'center', justifyContent: 'center' },
    
    tabRow: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 15 },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    tabItemActive: {  },
    tabText: { fontSize: 14, fontWeight: '600' },
    activeIndicator: { width: 40, height: 3, backgroundColor: Data.brand.blue, borderRadius: 2, marginTop: 4 },
    tabContent: { paddingHorizontal: 20 },
    glassCard: { padding: 20, borderRadius: 16, borderWidth: 1 },
    sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
    bioText: { fontSize: 15, lineHeight: 24 },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    luxuryTag: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, elevation: 1 },
    tagText: { fontSize: 13, fontWeight: '600' },
    
    blackLogoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, backgroundColor: '#000', borderRadius: 25, marginTop: 30, elevation: 4, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 },
    blackLogoutText: { color: '#fff', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
    
    statsContainer: { flexDirection: 'row', borderRadius: 16, padding: 15, borderWidth: 1, marginBottom: 25, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5 },
    statBox: { flex: 1, alignItems: 'center' },
    statBoxBorder: { borderLeftWidth: 1, borderRightWidth: 1 },
    statValue: { fontSize: 18, fontWeight: '900' },
    statLabel: { fontSize: 12, marginTop: 2 },
    statItemSmall: { alignItems: 'center', flex: 1 },
    
    followerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 10 },
    followerAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 15, backgroundColor: '#eee', borderWidth: 1, borderColor: '#ddd' },
    
    pulseCard: { borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, marginBottom: 20 },
    pulseImage: { width: '100%', height: 400, resizeMode: 'cover' },
    pulsePlaceholder: { height: 300, justifyContent: 'center', alignItems: 'center', padding: 20 },
    pulsePlaceholderText: { fontSize: 28, color: '#fff', fontWeight: '800', textAlign: 'center', fontStyle: 'italic' },
    pulseMeta: { padding: 20 },
    liveIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    pulsingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Data.brand.green, marginRight: 6 },
    liveIndicatorText: { color: Data.brand.green, fontWeight: '800', fontSize: 12 },
    updatePulseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, padding: 12, borderRadius: 12 },
    updatePulseText: { color: "#fff", fontWeight: "bold" },
    createPulseHeroBtn: { backgroundColor: Data.brand.blue, paddingHorizontal: 30, paddingVertical: 14, borderRadius: 30, elevation: 5 },
    createPulseHeroText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
    emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center', minHeight: 300 },
    emptyStateIconWrapper: { padding: 20, borderRadius: 50, marginBottom: 15 },
    emptyStateText: { marginTop: 15, fontSize: 16 },
    emptyStateSub: { textAlign: 'center', marginBottom: 25, marginTop: 5 },
    createBtnSmall: { marginTop: 10, padding: 10 },
    createBtnText: { color: Data.brand.blue, fontWeight: 'bold' },
    
    imageViewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
    imageViewerCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
    imageViewerImg: { width: '100%', height: '80%', resizeMode: 'contain' }
});