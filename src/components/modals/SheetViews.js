// client/src/components/modals/SheetViews.js
// ⭐️ V3.0 PRODUCTION: CommentsView now connects to real store when postId is provided.
//
// CRITICAL FIX IN THIS VERSION:
// [FIX-COMMENTS] CommentsView used to ignore its postId prop and always render
//                hardcoded DEMO_COMMENTS. Any comment typed there was lost.
//                Now:
//                  - If postId is provided → fully connected to store
//                    (createComment, editComment, deleteComment, profile peek, real avatars)
//                  - If no postId          → legacy demo behavior (backward compatible)
//                  - Long-press own comment → Edit / Delete (real mode only)
//                  - Comment shape is normalized so the SAME render path handles
//                    both the demo shape ({user, time, ...}) and the server shape
//                    ({username, timestamp, userId, ...})
//
// All other views (PulseCreationOptionsView, TrendOptionsView, LocationPickerView,
// GroupInfoPeekView) and ALL styles are preserved 100%.

import React, { useState, useMemo, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, Image, TextInput, Alert, ActivityIndicator, StyleSheet, ImageBackground, Dimensions
} from 'react-native';
import { styles as globalStyles } from '../../constants/styles';
import { brand } from '../../constants/data';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore'; 
import GroupDetailsSheet from '../GroupDetailsSheet'; 

const { width } = Dimensions.get('window');

const DEMO_COMMENTS = [
    { id: 'c1', user: 'Sarah J.', text: 'This is amazing! 🔥', avatar: 'https://i.pravatar.cc/150?img=5', time: '2m' },
    { id: 'c2', user: 'Mike T.', text: 'Totally agree, great vibes.', avatar: 'https://i.pravatar.cc/150?img=3', time: '5m' },
    { id: 'c3', user: 'Jessica', text: 'When is the next meetup?', avatar: 'https://i.pravatar.cc/150?img=9', time: '10m' },
    { id: 'c4', user: 'David B.', text: 'Can I join the group?', avatar: 'https://i.pravatar.cc/150?img=11', time: '15m' },
    { id: 'c5', user: 'Emily', text: 'Love this!', avatar: 'https://i.pravatar.cc/150?img=12', time: '20m' },
];

const POPULAR_CITIES = [
    { name: "New York, USA", img: "https://images.unsplash.com/photo-1496442226314-436b83deb23f?w=400&q=80", lat: 40.7128, lng: -74.0060 },
    { name: "Tokyo, Japan", img: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80", lat: 35.6762, lng: 139.6503 },
    { name: "Paris, France", img: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80", lat: 48.8566, lng: 2.3522 },
    { name: "Bali, Indonesia", img: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80", lat: -8.4095, lng: 115.1889 },
    { name: "Dubai, UAE", img: "https://images.unsplash.com/photo-1512453979798-5ea936a7fe5b?w=400&q=80", lat: 25.2048, lng: 55.2708 },
    { name: "London, UK", img: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&q=80", lat: 51.5074, lng: -0.1278 },
];

const TREND_ACTIONS = [
    { id: 'karaoke', title: 'Karaoke', sub: 'Sing it loud 🎤', icon: 'mic', color: '#E91E63', bg: '#FCE4EC', action: 'vibe' },
    { id: 'dance', title: 'Dance Off', sub: 'Show moves 💃', icon: 'musical-notes', color: '#9C27B0', bg: '#F3E5F5', action: 'vibe' },
    { id: 'task', title: 'Daily Task', sub: 'Challenge ✅', icon: 'checkmark-circle', color: '#4CAF50', bg: '#E8F5E9', action: 'photo' },
    { id: 'ootd', title: 'Fit Check', sub: 'Your Style 👗', icon: 'shirt', color: '#3F51B5', bg: '#E8EAF6', action: 'photo' },
    { id: 'food', title: 'Foodie', sub: 'Tasty eats 🍔', icon: 'fast-food', color: '#FF9800', bg: '#FFF3E0', action: 'photo' },
    { id: 'pet', title: 'Pet Love', sub: 'Cute pets 🐶', icon: 'paw', color: '#795548', bg: '#EFEBE9', action: 'photo' },
    { id: 'gym', title: 'Gym Flex', sub: 'Workout 💪', icon: 'barbell', color: '#607D8B', bg: '#ECEFF1', action: 'photo' },
    { id: 'gaming', title: 'Gaming', sub: 'Epic clips 🎮', icon: 'game-controller', color: '#2196F3', bg: '#E3F2FD', action: 'live' },
    { id: 'travel', title: 'Travel', sub: 'Dream spots ✈️', icon: 'airplane', color: '#00BCD4', bg: '#E0F7FA', action: 'photo' },
    { id: 'debate', title: 'Hot Take', sub: 'Debate it 🗣️', icon: 'chatbubbles', color: '#FF5722', bg: '#FBE9E7', action: 'live' },
];

const TOP_CREATORS = [
    { name: 'Anna', img: 'https://i.pravatar.cc/150?img=5', rank: '🥇' },
    { name: 'Josh', img: 'https://i.pravatar.cc/150?img=3', rank: '🥈' },
    { name: 'Kim', img: 'https://i.pravatar.cc/150?img=9', rank: '🥉' },
    { name: 'Alex', img: 'https://i.pravatar.cc/150?img=11', rank: '' },
    { name: 'Sam', img: 'https://i.pravatar.cc/150?img=12', rank: '' },
];

// ════════════════════════════════════════════════════════════════
// PRESERVED — PulseCreationOptionsView (unchanged from V2.0)
// ════════════════════════════════════════════════════════════════
export const PulseCreationOptionsView = ({ onClose, openVibeCheck, onStartImageUpload }) => {
    const { userSettings } = useAppStore();
    const isDark = userSettings?.darkMode === true;

    const handleSelection = (type) => {
        onClose(); 
        setTimeout(() => {
            if (type === 'vibeCheck') {
                if (openVibeCheck) openVibeCheck(); 
            } else if (type === 'uploadPhoto') {
                if (onStartImageUpload) onStartImageUpload('story'); 
            } else if (type === 'writePost') {
                Alert.alert("Write Story Text", "Text-only story creation coming soon!");
            }
        }, 300);
    };

    const OptionCard = ({ icon, title, subtitle, color, type }) => (
        <TouchableOpacity 
            onPress={() => handleSelection(type)}
            style={[localStyles.optionCard, { 
                backgroundColor: isDark ? '#222' : color + '10', 
                borderColor: isDark ? '#333' : color 
            }]}
        >
            <Text style={localStyles.optionEmoji}>{icon}</Text>
            <Text style={[localStyles.cardTitle, { color: isDark ? '#fff' : brand.ink }]}>{title}</Text>
            <Text style={[localStyles.cardSubtitle, { color: isDark ? '#aaa' : brand.soft }]}>{subtitle}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={[localStyles.genericPadding, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
            <Text style={[globalStyles.h2, localStyles.pulseTitle, { color: isDark ? '#fff' : '#111' }]}>Share Your Vibe</Text>
            <Text style={[globalStyles.p, localStyles.pulseSub, { color: isDark ? '#aaa' : '#666' }]}>How do you want to update your story?</Text>
            <View style={localStyles.gridContainer}>
                <OptionCard type="vibeCheck" icon="✨" title="Live Vibe Check" subtitle="Record a video/photo with Vibe AI" color={brand.green} />
                <OptionCard type="uploadPhoto" icon="🖼️" title="Upload Photo/Post" subtitle="Select an image from your gallery" color={brand.blue} />
                <OptionCard type="writePost" icon="✍️" title="Write a Text Pulse" subtitle="Share a quick thought" color={brand.yellow} />
            </View>
        </View>
    );
};

// ════════════════════════════════════════════════════════════════
// PRESERVED — TrendOptionsView (unchanged from V2.0)
// ════════════════════════════════════════════════════════════════
export const TrendOptionsView = ({ trendName, onClose, openVibeCheck, openVoiceCall }) => {
    const { userSettings } = useAppStore();
    const isDark = userSettings?.darkMode === true;

    const displayTrend = trendName || "#DailyVibe";

    const handleAction = (item) => {
        onClose();
        setTimeout(() => {
            if (item.action === 'vibe' && openVibeCheck) {
                openVibeCheck();
            } else if (item.action === 'live' && openVoiceCall) {
                openVoiceCall(`trend_${item.id}_${Date.now()}`);
            } else {
                Alert.alert(item.title, `Opening gallery for ${item.title}...`);
            }
        }, 300);
    };

    return (
        <View style={[localStyles.flexBgWhite, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={localStyles.trendScroll}>
                
                <View style={localStyles.heroContainer}>
                    <ImageBackground 
                        source={{ uri: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80' }} 
                        style={localStyles.trendHero}
                        imageStyle={localStyles.heroImageStyle}
                        resizeMode="cover"
                    >
                        <View style={localStyles.heroOverlay}>
                            <View style={localStyles.liveBadge}>
                                <Text style={localStyles.liveText}>🔥 HOT TREND</Text>
                            </View>
                            <Text style={localStyles.heroTitle}>{displayTrend}</Text>
                            <Text style={localStyles.heroSub}>Join 15.4k people participating today.</Text>
                        </View>
                    </ImageBackground>
                </View>

                <View style={localStyles.tagsWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.horizontalPad}>
                        {['#Lifestyle', '#Challenge', '#Viral', '#Morning', '#Community', '#Fun'].map((tag, i) => (
                            <View key={i} style={[localStyles.trendTag, { backgroundColor: isDark ? '#333' : '#f5f5f5', borderColor: isDark ? '#444' : '#eee' }]}>
                                <Text style={[localStyles.trendTagText, { color: isDark ? '#ddd' : '#555' }]}>{tag}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                <View style={localStyles.horizontalPad}>
                    <Text style={[globalStyles.h3, localStyles.stageTitle, { color: isDark ? '#fff' : '#111' }]}>Choose Your Stage</Text>
                    <View style={localStyles.gridContainer}>
                        {TREND_ACTIONS.map((item) => (
                            <TouchableOpacity 
                                key={item.id}
                                onPress={() => handleAction(item)} 
                                style={[localStyles.actionCard, { backgroundColor: isDark ? '#2C2C2E' : item.bg }]}
                                activeOpacity={0.8}
                            >
                                <View style={[localStyles.iconCircle, { backgroundColor: isDark ? '#3A3A3C' : '#fff' }]}>
                                    <Ionicons name={item.icon} size={24} color={item.color} />
                                </View>
                                <Text style={[localStyles.actionTitle, { color: isDark ? '#fff' : '#333' }]} numberOfLines={1}>{item.title}</Text>
                                <Text style={[localStyles.actionSub, { color: isDark ? '#aaa' : '#555' }]} numberOfLines={1}>{item.sub}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={localStyles.sectionContainer}>
                    <View style={localStyles.leaderboardHeader}>
                        <Text style={[globalStyles.h3, { color: isDark ? '#fff' : '#111' }]}>Top Trendsetters 👑</Text>
                        <Text style={localStyles.seeAllBtn}>See All</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.creatorsScroll}>
                        {TOP_CREATORS.map((creator, i) => (
                            <View key={i} style={localStyles.creatorItem}>
                                <View style={[localStyles.creatorCircle, i === 0 && localStyles.firstPlace]}>
                                    <Image source={{ uri: creator.img }} style={localStyles.fullImg} />
                                    {creator.rank ? <View style={localStyles.rankBadge}><Text style={localStyles.rankText}>{creator.rank}</Text></View> : null}
                                </View>
                                <Text style={[localStyles.creatorName, { color: isDark ? '#ccc' : '#111' }]}>{creator.name}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                <View style={localStyles.mysteryWrap}>
                    <TouchableOpacity 
                        style={localStyles.mysteryButton}
                        onPress={() => {
                            const randomAction = TREND_ACTIONS[Math.floor(Math.random() * TREND_ACTIONS.length)];
                            Alert.alert("🎲 Mystery Vibe", `Fate chose: ${randomAction.title}! Ready?`, [
                                { text: "Reroll" },
                                { text: "Let's Go!", onPress: () => handleAction(randomAction) }
                            ]);
                        }}
                    >
                        <Ionicons name="dice" size={24} color="#fff" style={localStyles.mysteryIcon} />
                        <Text style={localStyles.mysteryText}>Spin the Wheel Challenge</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </View>
    );
};

// ════════════════════════════════════════════════════════════════
// PRESERVED — LocationPickerView (unchanged from V2.0)
// ════════════════════════════════════════════════════════════════
export const LocationPickerView = ({ onClose }) => {
    const { detectLocation, setManualLocation, searchLocation, searchResults, isSearchLoading, userSettings } = useAppStore(state => ({
        detectLocation: state.detectLocation,
        setManualLocation: state.setManualLocation,
        searchLocation: state.searchLocation,
        searchResults: state.searchResults || [], 
        isSearchLoading: state.isSearchLoading,
        userSettings: state.userSettings
    }));
    
    const isDark = userSettings?.darkMode === true;
    const [searchText, setSearchText] = useState('');

    const handleGPS = async () => {
        try { await detectLocation(); onClose(); } catch (e) { Alert.alert("GPS Error", "Could not find you."); }
    };

    const handleSearch = () => {
        if (searchText.trim().length > 2) searchLocation(searchText); 
    };

    const handleSelect = (name, lat, lng) => {
        setManualLocation(name, lat, lng);
        onClose();
    };

    return (
        <View style={[localStyles.flexBgWhite, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
            <View style={localStyles.locHeader}>
                <Text style={[globalStyles.h2, localStyles.locTitle, { color: isDark ? '#fff' : '#111' }]}>Change Location 🌍</Text>
                <Text style={[localStyles.locSub, { color: isDark ? '#aaa' : '#666' }]}>Find vibes anywhere in the world.</Text>
                
                <View style={[localStyles.searchRow, { backgroundColor: isDark ? '#2C2C2E' : '#F5F7FA', borderColor: isDark ? '#444' : '#eee' }]}>
                    <Ionicons name="search" size={20} color="#999" style={localStyles.searchIcon} />
                    <TextInput 
                        style={[localStyles.searchInput, { color: isDark ? '#fff' : '#333' }]}
                        placeholder="Search city, neighborhood..."
                        placeholderTextColor={isDark ? '#aaa' : '#999'}
                        value={searchText}
                        onChangeText={setSearchText}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                    />
                    {isSearchLoading && <ActivityIndicator color={brand.blue} style={localStyles.loader} />}
                </View>
                
                <TouchableOpacity onPress={handleGPS} style={[localStyles.gpsBtn, { backgroundColor: isDark ? 'rgba(0,122,255,0.15)' : '#E3F2FD' }]}>
                    <Ionicons name="navigate-circle" size={24} color={brand.blue} />
                    <Text style={localStyles.gpsText}>Use Current Location</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={localStyles.locScroll}>
                {!!searchResults.length && (
                    <View style={localStyles.searchResultWrap}>
                        <Text style={[localStyles.sectionTitle, { color: isDark ? '#ddd' : '#333' }]}>Search Results</Text>
                        {searchResults.map((item, i) => (
                            <TouchableOpacity key={i} onPress={() => handleSelect(item.name, item.lat, item.lng)} style={[localStyles.resultRow, { borderColor: isDark ? '#333' : '#eee' }]}>
                                <Ionicons name="location-sharp" size={20} color={isDark ? '#aaa' : '#666'} />
                                <Text style={[localStyles.resultText, { color: isDark ? '#fff' : '#333' }]}>{item.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <Text style={[localStyles.sectionTitle, { color: isDark ? '#ddd' : '#333' }]}>Top Destinations ✨</Text>
                <View style={localStyles.destGrid}>
                    {POPULAR_CITIES.map((city, i) => (
                        <TouchableOpacity key={i} onPress={() => handleSelect(city.name, city.lat, city.lng)} style={localStyles.destCard}>
                            <Image source={{ uri: city.img }} style={localStyles.fullImg} />
                            <View style={localStyles.destOverlay}>
                                <Text style={localStyles.destName}>{city.name.split(',')[0]}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
};

// ════════════════════════════════════════════════════════════════
// [FIX-COMMENTS] CommentsView — now accepts postId and connects to real store
// ════════════════════════════════════════════════════════════════

/**
 * Normalize a comment from either the demo shape or the server shape
 * into a single canonical shape used by the render path.
 *
 * Demo shape:   { id, user, text, avatar, time }
 * Server shape: { id, username, text, avatar, timestamp, userId }
 */
const normalizeComment = (c) => {
    const timeDisplay =
        c.time ||
        (c.timestamp
            ? new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Now');

    return {
        id: c.id,
        username: c.username || c.user || 'User',
        text: c.text || '',
        avatar: c.avatar || 'https://i.pravatar.cc/150?img=12',
        timeDisplay,
        userId: c.userId, // undefined for demo comments — that's fine
    };
};

export const CommentsView = ({ postId } = {}) => {
    // [FIX-COMMENTS] Store wiring — selective subscriptions only (no full re-render storms)
    const {
        user,
        posts,
        createComment,
        deleteComment,
        editComment,
        setProfilePeekUser,
        userSettings,
        fetchPosts,
    } = useAppStore((state) => ({
        user: state.user,
        posts: state.posts || [],
        createComment: state.createComment,
        deleteComment: state.deleteComment,
        editComment: state.editComment,
        setProfilePeekUser: state.setProfilePeekUser,
        userSettings: state.userSettings,
        fetchPosts: state.fetchPosts,
    }));

    const isDark = userSettings?.darkMode === true;

    // Mode detection
    const safePostId = postId != null ? String(postId) : null;
    const isRealMode = !!safePostId;

    // Demo state (only used when no postId)
    const [demoComments, setDemoComments] = useState(DEMO_COMMENTS);

    // Real-mode resolved comments
    const realPost = useMemo(
        () => (isRealMode ? posts.find((p) => String(p.id) === safePostId) : null),
        [isRealMode, posts, safePostId]
    );
    const realComments = realPost?.comments || [];

    // Normalize for rendering
    const displayComments = useMemo(
        () => (isRealMode ? realComments : demoComments).map(normalizeComment),
        [isRealMode, realComments, demoComments]
    );

    // Input state
    const [text, setText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState(null);

    // ── Handlers ──────────────────────────────────────────────────
    const handleSend = useCallback(async () => {
        const textToSubmit = text.trim();
        if (!textToSubmit || isSubmitting) return;

        // ── Demo mode: local-only ──
        if (!isRealMode) {
            const newComment = {
                id: Date.now().toString(),
                user: 'You',
                text: textToSubmit,
                avatar: 'https://i.pravatar.cc/150?img=12',
                time: 'Just now',
            };
            setDemoComments((prev) => [newComment, ...prev]);
            setText('');
            return;
        }

        // ── Real mode: connect to store ──
        setIsSubmitting(true);
        try {
            if (editingCommentId) {
                if (!editComment) {
                    Alert.alert('Edit unavailable', 'Editing isn\'t ready. Please refresh and try again.');
                    return;
                }
                await editComment(safePostId, String(editingCommentId), textToSubmit);
                setText('');
                setEditingCommentId(null);
                if (fetchPosts) await fetchPosts(true);
            } else {
                if (!createComment) {
                    Alert.alert('Comment unavailable', 'Comment posting isn\'t ready. Please refresh and try again.');
                    return;
                }
                const result = await createComment(safePostId, textToSubmit);
                // Treat anything not explicitly === false as success
                if (result !== false) {
                    setText('');
                    if (fetchPosts) await fetchPosts(true);
                }
            }
        } catch (error) {
            console.error('[CommentsView] Comment error:', error);
            Alert.alert('Connection Error', 'Could not save your comment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }, [text, isSubmitting, isRealMode, editingCommentId, editComment, createComment, fetchPosts, safePostId]);

    const handleLongPress = useCallback(
        (comment) => {
            if (!isRealMode) return; // demo doesn't support edit/delete
            const isMyComment = String(comment.userId) === String(user?.id);
            if (!isMyComment) return;

            Alert.alert('Comment Options', 'Choose an action:', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Edit',
                    onPress: () => {
                        setEditingCommentId(comment.id);
                        setText(comment.text);
                    },
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteComment && deleteComment(safePostId, String(comment.id)),
                },
            ]);
        },
        [isRealMode, user?.id, deleteComment, safePostId]
    );

    const handleUserPress = useCallback(
        (comment) => {
            if (!isRealMode) return;
            if (setProfilePeekUser && comment.userId) {
                setProfilePeekUser({
                    id: comment.userId,
                    name: comment.username,
                    avatarUrl: comment.avatar,
                });
            }
        },
        [isRealMode, setProfilePeekUser]
    );

    // [FIX-COMMENTS] Early-return state when in real mode but post isn't loaded yet
    if (isRealMode && !realPost) {
        return (
            <View style={[localStyles.flexOne, { backgroundColor: isDark ? '#1C1C1E' : '#fff', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={brand.blue} />
                <Text style={{ color: isDark ? '#aaa' : '#666', marginTop: 12 }}>Loading comments...</Text>
            </View>
        );
    }

    return (
        <View style={[localStyles.flexOne, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
            <ScrollView style={localStyles.commentsScroll}>
                {displayComments.length === 0 && (
                    <View style={{ alignItems: 'center', marginTop: 40, opacity: 0.5 }}>
                        <Text style={{ fontSize: 40, marginBottom: 8 }}>💬</Text>
                        <Text style={{ color: isDark ? '#aaa' : '#888', fontWeight: '600' }}>No comments yet. Be the first!</Text>
                    </View>
                )}

                {displayComments.map((c) => (
                    <TouchableOpacity
                        key={c.id}
                        onLongPress={() => handleLongPress(c)}
                        activeOpacity={isRealMode ? 0.8 : 1}
                        style={localStyles.commentItem}
                    >
                        <TouchableOpacity onPress={() => handleUserPress(c)} disabled={!isRealMode}>
                            <Image source={{ uri: c.avatar }} style={localStyles.commentAvatar} />
                        </TouchableOpacity>

                        <View style={[localStyles.commentBubble, { backgroundColor: isDark ? '#2C2C2E' : '#fff', borderColor: isDark ? '#333' : '#eee' }]}>
                            <View style={localStyles.commentHeader}>
                                <Text style={[localStyles.commentUser, { color: isDark ? '#fff' : '#111' }]}>{c.username}</Text>
                                <Text style={localStyles.commentTime}>{c.timeDisplay}</Text>
                            </View>
                            <Text style={[localStyles.commentText, { color: isDark ? '#ddd' : brand.ink }]}>{c.text}</Text>
                        </View>
                    </TouchableOpacity>
                ))}

                {isSubmitting && <ActivityIndicator color={brand.blue} style={{ marginTop: 10 }} />}
            </ScrollView>

            <View style={[localStyles.inputContainer, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderTopColor: isDark ? '#333' : '#eee' }]}>
                {editingCommentId && (
                    <View style={{ position: 'absolute', top: -28, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: isDark ? '#332b00' : '#fffbe6', borderTopLeftRadius: 10, borderTopRightRadius: 10 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#FFD700' : '#856404' }}>Editing comment...</Text>
                        <TouchableOpacity onPress={() => { setEditingCommentId(null); setText(''); }}>
                            <Text style={{ color: brand.red, fontSize: 11, fontWeight: 'bold' }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                )}
                <TextInput
                    style={[localStyles.commentInput, { backgroundColor: isDark ? '#2C2C2E' : '#f5f5f5', color: isDark ? '#fff' : '#111' }]}
                    placeholder="Add a comment..."
                    placeholderTextColor={isDark ? '#aaa' : '#999'}
                    value={text}
                    onChangeText={setText}
                    onSubmitEditing={handleSend}
                    editable={!isSubmitting}
                />
                <TouchableOpacity onPress={handleSend} disabled={!text.trim() || isSubmitting}>
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color={brand.blue} />
                    ) : (
                        <Ionicons name="send" size={24} color={text.trim() ? brand.blue : (isDark ? '#555' : brand.soft)} />
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

// ════════════════════════════════════════════════════════════════
// PRESERVED — GroupInfoPeekView (unchanged)
// ════════════════════════════════════════════════════════════════
export const GroupInfoPeekView = ({ group, onClose, onThird, onOpenAvatar }) => {
    if (!group) return null;
    return <GroupDetailsSheet group={group} setThirdSheet={onThird} onClose={onClose} onOpenAvatar={onOpenAvatar} />;
};

const localStyles = StyleSheet.create({
    flexBgWhite: { flex: 1, backgroundColor: '#fff' },
    flexOne: { flex: 1 },
    genericPadding: { padding: 20 },
    horizontalPad: { paddingHorizontal: 20 },
    fullImg: { width: '100%', height: '100%' },
    
    // Pulse
    pulseTitle: { textAlign: 'center', marginBottom: 10, fontSize: 22 },
    pulseSub: { textAlign: 'center', marginBottom: 30 },
    optionCard: { width: '48%', padding: 20, borderRadius: 20, marginBottom: 15, borderWidth: 1, alignItems: 'center', elevation: 2, shadowOpacity: 0.1, shadowRadius: 3 },
    optionEmoji: { fontSize: 40, marginBottom: 10 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: brand.ink, marginBottom: 4 },
    cardSubtitle: { fontSize: 12, color: brand.soft, textAlign: 'center' },
    
    // Trend
    trendScroll: { paddingBottom: 80 },
    heroContainer: { width: '100%', alignItems: 'center', marginTop: 10, marginBottom: 15 },
    trendHero: { width: width - 40, height: 180, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: 20 },
    heroImageStyle: { borderRadius: 20 },
    heroOverlay: { backgroundColor: 'rgba(0,0,0,0.4)', padding: 15, width: '100%' },
    heroTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 },
    heroSub: { color: '#f0f0f0', fontSize: 13, marginTop: 4, fontWeight: '500' },
    liveBadge: { position: 'absolute', top: -120, right: 15, backgroundColor: '#FF3D00', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    liveText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    tagsWrapper: { marginBottom: 20 },
    trendTag: { backgroundColor: '#f5f5f5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, marginRight: 8, borderWidth: 1, borderColor: '#eee' },
    trendTagText: { color: '#555', fontWeight: '600', fontSize: 13 },
    stageTitle: { marginBottom: 15 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    actionCard: { width: (width - 55) / 2, padding: 15, borderRadius: 16, marginBottom: 15, alignItems: 'center', elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    iconCircle: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2, backgroundColor: '#fff' },
    actionTitle: { fontWeight: 'bold', fontSize: 15, color: '#333', textAlign: 'center' },
    actionSub: { fontSize: 11, color: '#555', marginTop: 2, textAlign: 'center' },
    sectionContainer: { marginTop: 25 },
    leaderboardHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 15 },
    seeAllBtn: { color: brand.blue, fontWeight: 'bold' },
    creatorsScroll: { paddingHorizontal: 20, gap: 15 },
    creatorItem: { alignItems: 'center' },
    creatorCircle: { width: 60, height: 60, borderRadius: 30, overflow: 'visible' },
    firstPlace: { borderColor: '#FFD700', borderWidth: 2 },
    rankBadge: { position: 'absolute', bottom: -5, right: -5, backgroundColor: '#fff', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center', elevation: 2 },
    rankText: { fontSize: 10 },
    creatorName: { fontSize: 12, fontWeight: '600', marginTop: 5 },
    mysteryWrap: { paddingHorizontal: 20, marginTop: 25 },
    mysteryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6200EE', padding: 15, borderRadius: 16, shadowColor: "#6200EE", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5 },
    mysteryIcon: { marginRight: 10 },
    mysteryText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    // Location
    locHeader: { padding: 20, paddingBottom: 10 },
    locTitle: { textAlign: 'center', marginBottom: 5 },
    locSub: { textAlign: 'center', color: '#666', marginBottom: 20 },
    searchRow: { flexDirection: 'row', marginBottom: 20, alignItems: 'center', backgroundColor: '#F5F7FA', borderRadius: 12, height: 50, borderWidth: 1, borderColor: '#eee' },
    searchIcon: { marginLeft: 10 },
    searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 16, color: '#333' },
    loader: { marginRight: 10 },
    gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, backgroundColor: '#E3F2FD', marginBottom: 20 },
    gpsText: { color: brand.blue, fontWeight: 'bold', marginLeft: 8 },
    locScroll: { paddingHorizontal: 20, paddingBottom: 50 },
    searchResultWrap: { marginBottom: 20 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 10, color: '#333' },
    resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderColor: '#eee' },
    resultText: { marginLeft: 10, fontSize: 16, color: '#333' },
    destGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    destCard: { width: '48%', height: 120, borderRadius: 16, marginBottom: 15, overflow: 'hidden' },
    destOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
    destName: { color: '#fff', fontWeight: 'bold', fontSize: 18, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 5 },

    // Comments
    commentsScroll: { flex: 1, padding: 16 },
    commentItem: { flexDirection: 'row', marginBottom: 16 },
    commentAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
    commentBubble: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderTopLeftRadius: 4, borderWidth: 1, borderColor: '#eee' },
    commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    commentUser: { fontWeight: 'bold', fontSize: 13 },
    commentTime: { color: brand.soft, fontSize: 11 },
    commentText: { color: brand.ink, lineHeight: 18 },
    inputContainer: { padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', flexDirection: 'row', alignItems: 'center' },
    commentInput: { flex: 1, height: 44, backgroundColor: '#f5f5f5', borderRadius: 22, paddingHorizontal: 16, marginRight: 8 }
});