// client/src/components/GroupDetailsSheet.js
// ⭐️ V23.0 - WEB FIX: Working Delete Button on Chrome + Full Logic Sync ⭐️

import React, { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { 
    View, Text, TouchableOpacity, ActivityIndicator, TextInput, 
    Alert, Image, StyleSheet, ImageBackground, Platform, FlatList,
    KeyboardAvoidingView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker'; 
import { Ionicons } from '@expo/vector-icons'; 
import { LinearGradient } from 'expo-linear-gradient'; 
import { styles as globalStyles } from '../constants/styles';
import { brand, imageFor } from '../constants/data';
import PostCard from './PostCard';
import { useAppStore } from '../store/useAppStore'; 
import { GroupSettingsModal } from './modals/GroupSettingsModal'; 

const GroupDetailsSheet = ({ group, setThirdSheet, openVoiceCall, openVideoCall, onClose, onOpenAvatar }) => {
    
    const user = useAppStore(state => state.user);
    const userSettings = useAppStore(state => state.userSettings); 
    const isDark = userSettings?.darkMode === true;

    const currentGroupPosts = useAppStore(state => state.currentGroupPosts) || [];
    const isGroupPostsLoading = useAppStore(state => state.isGroupPostsLoading);
    const fetchGroupFeed = useAppStore(state => state.fetchGroupFeed);
    const createPost = useAppStore(state => state.createPost);
    const updateGroupDetails = useAppStore(state => state.updateGroupDetails);
    const deleteGroup = useAppStore(state => state.deleteGroup);
    const joinGroup = useAppStore(state => state.joinGroup);
    const leaveGroup = useAppStore(state => state.leaveGroup);
    const openChat = useAppStore(state => state.openChat);
    const setProfilePeekUser = useAppStore(state => state.setProfilePeekUser);
    const startDirectChat = useAppStore(state => state.startDirectChat);

    const [currentTab, setCurrentTab] = useState('feed'); 
    const [newPostText, setNewPostText] = useState('');
    const [localPosting, setLocalPosting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    const flatListRef = useRef(null);

    const groupId = String(group?.id || ''); 
    const groupName = group?.name || 'Unknown Community';
    const groupImg = group?.imageUrl || group?.image || imageFor(groupName);

    const currentUserId = String(user?.id || '');
    const groupOwnerId = String(group?.ownerId || '');
    
    const isMember = useMemo(() => {
        if (!group) return false;
        return group.isMember || (group.members && group.members.some(m => String(m.userId) === currentUserId));
    }, [group, currentUserId]);

    const isAdmin = useMemo(() => {
        if (!group) return false;
        return (groupOwnerId === currentUserId) || (group.members?.some(m => String(m.userId) === currentUserId && m.isAdmin));
    }, [groupOwnerId, currentUserId, group]);

    useEffect(() => {
        if (groupId) fetchGroupFeed(groupId);
    }, [groupId, fetchGroupFeed]);

    const onRefresh = useCallback(async () => {
        if (!groupId) return;
        setRefreshing(true);
        await fetchGroupFeed(groupId);
        setRefreshing(false);
    }, [groupId, fetchGroupFeed]);

    const handleUpdateImage = useCallback(async () => {
        if (!isAdmin) {
            Alert.alert("Permission Denied", "Only admins can change the group image.");
            return;
        }
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) return;
        
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [16, 9], quality: 0.6,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            try {
                await updateGroupDetails(groupId, { imageUri: result.assets[0].uri });
                Alert.alert("Success", "Community image updated!");
            } catch (error) {
                Alert.alert("Error", "Failed to update image.");
            }
        }
    }, [isAdmin, groupId, updateGroupDetails]);

    const handlePostSubmit = useCallback(async () => {
        if (!newPostText.trim()) return;
        if (!isMember) {
            Alert.alert("Join Community", "You must join to post.");
            return;
        }
        setLocalPosting(true);
        try {
            await createPost(newPostText.trim(), groupId);
            setNewPostText(''); 
            if (flatListRef.current) {
                flatListRef.current.scrollToOffset({ offset: 0, animated: true });
            }
        } catch (error) {
            Alert.alert("Error", "Failed to post.");
        } finally {
            setLocalPosting(false);
        }
    }, [newPostText, isMember, groupId, createPost]);

    const handleMembership = useCallback(async () => {
        try {
            if (isMember) {
                if (Platform.OS === 'web') {
                    if (window.confirm("Leave Community? Are you sure?")) leaveGroup(groupId);
                } else {
                    Alert.alert("Leave Community", "Are you sure?", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Leave", style: 'destructive', onPress: () => leaveGroup(groupId) }
                    ]);
                }
            } else {
                await joinGroup(groupId);
                Alert.alert("Joined!", "Welcome to the community.");
            }
        } catch (e) { Alert.alert("Error", "Action failed."); }
    }, [isMember, groupId, joinGroup, leaveGroup]);
    
    // ⭐️ התיקון המרכזי עבור כרום: תמיכה במחיקה בדפדפן ⭐️
    const handleDeleteGroupWrapper = useCallback(() => {
        const title = "Delete Community";
        const message = "Are you absolutely sure? This action cannot be undone.";

        if (Platform.OS === 'web') {
            // שימוש בתיבת אישור של הדפדפן
            const confirmed = window.confirm(`${title}\n\n${message}`);
            if (confirmed) {
                deleteGroup(groupId);
                if (onClose) onClose();
            }
        } else {
            // שימוש בהתראה המקורית של הנייטיב
            Alert.alert(title, message, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: async () => {
                    await deleteGroup(groupId);
                    if (onClose) onClose();
                }}
            ]);
        }
    }, [groupId, deleteGroup, onClose]);
    
    const handleOpenProfilePeek = useCallback((userObject) => {
        setProfilePeekUser(userObject);
    }, [setProfilePeekUser]);

    const handleOpenGroupChat = useCallback(() => {
        if (isMember) openChat(groupId);
        else Alert.alert("Join Chat", "You must join to access the chat.");
    }, [isMember, groupId, openChat]);

    const listData = useMemo(() => {
        if (currentTab === 'feed') return currentGroupPosts;
        if (currentTab === 'members') return group?.members || [];
        return [1]; 
    }, [currentTab, currentGroupPosts, group?.members]);

    const listHeader = useMemo(() => {
        return (
            <View>
                <ImageBackground source={{ uri: groupImg }} style={localStyles.heroHeader}>
                    <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.8)']} style={localStyles.heroGradient}>
                        <View style={localStyles.topBar}>
                            <TouchableOpacity onPress={onClose} style={localStyles.glassBtn}>
                                <Ionicons name="arrow-back" size={24} color="#fff" />
                            </TouchableOpacity>
                            <View style={localStyles.actionIconsRow}>
                                {isAdmin && (
                                    <TouchableOpacity onPress={handleUpdateImage} style={localStyles.glassBtn}>
                                        <Ionicons name="camera" size={22} color="#fff" />
                                    </TouchableOpacity>
                                )}
                                {isAdmin && (
                                    <TouchableOpacity onPress={() => setIsSettingsOpen(true)} style={localStyles.glassBtn}>
                                        <Ionicons name="settings-outline" size={22} color="#fff" />
                                    </TouchableOpacity>
                                )}
                                {isAdmin && (
                                    <TouchableOpacity onPress={handleDeleteGroupWrapper} style={[localStyles.glassBtn, localStyles.deleteBtn]}>
                                        <Ionicons name="trash-outline" size={22} color="#fff" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <View style={localStyles.heroContent}>
                            <View style={localStyles.badge}><Text style={localStyles.badgeText}>{group?.category || 'Community'}</Text></View>
                            <Text style={localStyles.heroTitle}>{groupName}</Text>
                            <Text style={localStyles.heroDesc}>{group?.description || 'A place for amazing vibes and connections.'}</Text>
                            
                            <View style={localStyles.statsRow}>
                                <View style={localStyles.avatarsRow}>
                                    {[1,2,3].map((num, idx) => (
                                        <Image key={`av-${num}`} source={{uri: imageFor(`Member${num}`)}} style={[localStyles.miniAvatar, { left: -10 * idx, zIndex: 3 - idx }]} />
                                    ))}
                                </View>
                                <Text style={localStyles.membersCount}>{group?.membersCount || group?.memberCount || 1} Members</Text>
                                <TouchableOpacity style={[localStyles.joinBtn, isMember && localStyles.joinedBtn]} onPress={handleMembership}>
                                    <Text style={[localStyles.joinBtnText, isMember && localStyles.joinedBtnText]}>{isMember ? 'Joined' : 'Join'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </LinearGradient>
                </ImageBackground>

                <View style={[localStyles.tabContainer, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#eee' }]}>
                    {['feed', 'events', 'chat', 'members'].map(tab => (
                        <TouchableOpacity key={tab} style={[localStyles.tab, currentTab === tab && localStyles.activeTab]} onPress={() => setCurrentTab(tab)}>
                            <Text style={[localStyles.tabText, { color: isDark ? '#aaa' : '#888' }, currentTab === tab && localStyles.activeTabText]}>{tab.toUpperCase()}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {currentTab === 'members' && (
                    <View style={localStyles.membersHeaderBox}>
                        <TouchableOpacity style={localStyles.voiceBtn} onPress={() => openVoiceCall && openVoiceCall(groupId)}>
                            <View style={localStyles.voiceIconBox}><Text style={localStyles.emojiIcon}>🎤</Text></View>
                            <View style={localStyles.btnTextCol}>
                                <Text style={localStyles.btnTitle}>Join Voice Room</Text>
                                <Text style={localStyles.btnSub}>Hop in and talk instantly</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color="#fff" style={localStyles.chevron} />
                        </TouchableOpacity>

                        <TouchableOpacity style={[localStyles.voiceBtn, localStyles.videoBtnModifier]} onPress={() => openVideoCall && openVideoCall(groupId)}>
                            <View style={localStyles.voiceIconBox}><Ionicons name="videocam" size={20} color="#fff" /></View>
                            <View style={localStyles.btnTextCol}>
                                <Text style={localStyles.btnTitle}>Join Video Room</Text>
                                <Text style={localStyles.btnSub}>Face-to-face community chat</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color="#fff" style={localStyles.chevron} />
                        </TouchableOpacity>
                        
                        <Text style={[globalStyles.h2, localStyles.membersListTitle, { color: isDark ? '#fff' : '#000' }]}>All Members</Text>
                    </View>
                )}
            </View>
        );
    }, [groupImg, groupName, isMember, isAdmin, currentTab, groupOwnerId, currentUserId, isDark, group, handleDeleteGroupWrapper, handleUpdateImage, onClose, handleMembership]);

    const renderListItem = useCallback(({ item, index }) => {
        if (currentTab === 'feed') return <PostCard post={item} user={user} onOpenProfile={handleOpenProfilePeek} onOpenComments={() => setThirdSheet && setThirdSheet({ source: "Comments", post: item })} isDark={isDark} />; 
        
        if (currentTab === 'members') {
            const memberUser = item.user || item; 
            const memberId = String(memberUser._id || memberUser.id || memberUser.userId || `temp-${index}`);
            const memberName = memberUser.name || memberUser.username || 'User';
            const memberAvatar = memberUser.avatarUrl || memberUser.profilePic || memberUser.profileImage || memberUser.picture || memberUser.photoUrl || memberUser.imageUrl || memberUser.avatar || memberUser.image || `https://ui-avatars.com/api/?name=${memberName}&background=random`;
            const memberRole = item.isAdmin ? 'Admin' : 'Member';
            const isMe = memberId === currentUserId;

            return (
                <View style={[localStyles.memberRow, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
                    <TouchableOpacity onPress={() => handleOpenProfilePeek(memberUser)}>
                        <Image source={{ uri: memberAvatar }} style={localStyles.memberAvatar} />
                    </TouchableOpacity>
                    
                    <View style={localStyles.memberInfo}>
                        <Text style={[localStyles.memberName, { color: isDark ? '#fff' : '#000' }]}>@{memberName}</Text>
                        <Text style={localStyles.memberRole}>{memberRole}</Text>
                    </View>

                    {!isMe && (
                        <TouchableOpacity 
                            style={[localStyles.memberChatBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }]} 
                            onPress={async () => {
                                if (startDirectChat) {
                                    await startDirectChat(memberUser);
                                    if (onClose) onClose(); 
                                } else {
                                    Alert.alert("Error", "Direct chat is currently unavailable.");
                                }
                            }}
                        >
                            <Ionicons name="chatbubble-ellipses-outline" size={20} color={brand.blue} />
                        </TouchableOpacity>
                    )}
                </View>
            );
        }
        
        if (currentTab === 'events') return (
            <View style={localStyles.staticTabContainer}>
                <Text style={[globalStyles.h1, localStyles.marginBottom12, { color: isDark ? '#fff' : '#000' }]}>Community Events</Text>
                {isMember && (
                    <TouchableOpacity style={[globalStyles.primaryBtn, localStyles.createEventBtn]}>
                        <Ionicons name="calendar-outline" size={20} color="#fff" style={localStyles.marginRight8} />
                        <Text style={localStyles.btnFontWhite}>Create New Event</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
        if (currentTab === 'chat') return (
            <View style={localStyles.staticTabContainer}>
                <Text style={[globalStyles.h1, localStyles.marginBottom12, { color: isDark ? '#fff' : '#000' }]}>Community Chat</Text>
                <TouchableOpacity onPress={handleOpenGroupChat} style={[globalStyles.primaryBtn, localStyles.marginTop20]}>
                    <Text style={localStyles.btnFontWhite}>{isMember ? 'Open Chat Room' : 'Join Community to Chat'}</Text>
                </TouchableOpacity>
            </View>
        );
        return null;
    }, [currentTab, user, handleOpenProfilePeek, setThirdSheet, isMember, handleOpenGroupChat, isDark, currentUserId, startDirectChat, onClose]);

    const renderEmptyComponent = () => {
        if (currentTab === 'feed') {
            if (isGroupPostsLoading) return <ActivityIndicator size="large" color={brand.blue} style={localStyles.marginTop20} />;
            return (
                <View style={localStyles.emptyState}>
                    <Ionicons name="planet-outline" size={60} color={isDark ? '#444' : "#ccc"} />
                    <Text style={[localStyles.emptyTitle, { color: isDark ? '#fff' : '#555' }]}>It's quiet here...</Text>
                    <Text style={[localStyles.emptyDesc, { color: isDark ? '#888' : '#888' }]}>Be the first to spark a conversation!</Text>
                </View>
            );
        }
        if (currentTab === 'members') return <Text style={[localStyles.loadingText, { color: isDark ? '#888' : '#888' }]}>Member list is empty...</Text>;
        return null;
    };

    if (!group) return null;

    return (
        <KeyboardAvoidingView 
            style={localStyles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 80} 
        >
            <View style={[localStyles.container, { backgroundColor: isDark ? '#000' : '#f9f9f9' }]}> 
                <FlatList
                    ref={flatListRef}
                    data={listData}
                    keyExtractor={(item, index) => String(item.id || item.userId || `static-${index}`)}
                    renderItem={renderListItem}
                    ListHeaderComponent={listHeader}
                    ListEmptyComponent={renderEmptyComponent}
                    contentContainerStyle={localStyles.listContent}
                    refreshing={refreshing}
                    onRefresh={currentTab === 'feed' ? onRefresh : undefined}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    removeClippedSubviews={true}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                />

                {currentTab === 'feed' && isMember && (
                    <View style={[localStyles.stickyComposeBox, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#eee' }]}>
                        <Image source={{ uri: user?.avatarUrl || imageFor(user?.username) }} style={localStyles.composeAvatar} />
                        <TextInput 
                            placeholder="Share something with the community..."
                            placeholderTextColor={isDark ? "#888" : "#999"}
                            style={[localStyles.composeInput, { backgroundColor: isDark ? '#333' : '#f5f5f5', color: isDark ? '#fff' : '#000' }]}
                            multiline 
                            value={newPostText} 
                            onChangeText={setNewPostText}
                        />
                        {newPostText.trim().length > 0 && (
                            <TouchableOpacity onPress={handlePostSubmit} disabled={localPosting} style={localStyles.sendBtn}>
                                {localPosting ? <ActivityIndicator size="small" color={brand.blue}/> : <Ionicons name="send" size={24} color={brand.blue} />}
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <GroupSettingsModal 
                    group={group}
                    isVisible={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    onSave={updateGroupDetails} 
                />
            </View>
        </KeyboardAvoidingView>
    );
};

export default memo(GroupDetailsSheet);

const localStyles = StyleSheet.create({
    keyboardContainer: { flex: 1 },
    container: { flex: 1 },
    listContent: { paddingBottom: 20 },
    heroHeader: { width: '100%', height: 260 },
    heroGradient: { flex: 1, justifyContent: 'space-between', padding: 20 },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Platform.OS === 'ios' ? 30 : 10 },
    actionIconsRow: { flexDirection: 'row', gap: 10 },
    glassBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    deleteBtn: { backgroundColor: 'rgba(255,0,0,0.4)' },
    badge: { backgroundColor: brand.blue, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    heroContent: { justifyContent: 'flex-end' },
    heroTitle: { fontSize: 28, fontWeight: '900', color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 4 },
    heroDesc: { fontSize: 14, color: '#eee', marginTop: 5, marginBottom: 15 },
    statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    avatarsRow: { flexDirection: 'row', marginLeft: 20 },
    miniAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#222', position: 'relative' },
    membersCount: { color: '#ddd', fontSize: 13, marginLeft: -15, flex: 1 },
    joinBtn: { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 25 },
    joinBtnText: { color: '#000', fontWeight: '800' },
    joinedBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: '#fff' },
    joinedBtnText: { color: '#fff' },
    tabContainer: { flexDirection: 'row', borderBottomWidth: 1 },
    tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderColor: 'transparent' },
    activeTab: { borderColor: brand.blue },
    tabText: { fontSize: 13, fontWeight: '600' },
    activeTabText: { color: brand.blue, fontWeight: 'bold' },
    
    stickyComposeBox: { 
        flexDirection: 'row', 
        alignItems: 'flex-end', 
        paddingHorizontal: 16, 
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 30 : 15, 
        borderTopWidth: 1, 
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 10
    },
    composeAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, marginBottom: 5 },
    composeInput: { 
        flex: 1, 
        fontSize: 15, 
        minHeight: 40,
        maxHeight: 120, 
        borderRadius: 20, 
        paddingHorizontal: 15,
        paddingTop: 10,
        paddingBottom: 10,
        marginBottom: 5
    },
    sendBtn: { padding: 8, marginBottom: 5 },
    
    membersHeaderBox: { padding: 16 },
    voiceBtn: { backgroundColor: brand.green, padding: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', elevation: 3 },
    videoBtnModifier: { backgroundColor: brand.blue, marginTop: 12 },
    voiceIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    emojiIcon: { fontSize: 20 },
    btnTextCol: { marginLeft: 12 },
    btnTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    btnSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
    chevron: { marginLeft: 'auto' },
    membersListTitle: { marginTop: 20, marginBottom: 10 },

    staticTabContainer: { padding: 16 },
    marginBottom12: { marginBottom: 12 },
    marginRight8: { marginRight: 8 },
    marginTop20: { marginTop: 20 },
    createEventBtn: { marginTop: 20, backgroundColor: brand.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    btnFontWhite: { color: '#fff', fontWeight: 'bold' },

    emptyState: { alignItems: 'center', marginTop: 60 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 10 },
    emptyDesc: { marginTop: 5 },
    loadingText: { marginTop: 10, textAlign: 'center' },

    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    memberAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#eee',
    },
    memberInfo: {
        flex: 1,
        marginLeft: 14,
    },
    memberName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    memberRole: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    memberChatBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
    },
});