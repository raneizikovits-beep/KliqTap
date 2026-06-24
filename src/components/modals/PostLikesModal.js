// client/src/components/modals/PostLikesModal.js
import React, { useEffect, useState, useRef } from 'react';
import { 
    Modal, View, Text, TouchableOpacity, StyleSheet, 
    FlatList, Image, ActivityIndicator, useWindowDimensions, Animated 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchAPI } from '../../store/api';
import { useAppStore } from '../../store/useAppStore';
import { brand } from '../../constants/data';

// ─── רכיב אנימציה שורה-אחרי-שורה ──────────────────────────────────────
const AnimatedRow = ({ item, index, isDark, onUserPress }) => {
    const slideAnim = useRef(new Animated.Value(20)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const anim = Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, speed: 20, bounciness: 8, delay: index * 60, useNativeDriver: true })
        ]);
        anim.start();
        return () => anim.stop();
    }, []);

    const user = item.user || item.author || item;
    const avatarUrl = user?.avatarUrl || user?.img;
    const name = user?.name || user?.username || 'KliqTap User';
    const userId = user?.id || user?.userId;
    
    const vibe = item.vibe || item.emoji || item.reaction || '❤️';

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <TouchableOpacity 
                style={[styles.userRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderColor: isDark ? '#222' : '#F0F4F8' }]} 
                onPress={() => onUserPress(userId)}
                activeOpacity={0.7}
            >
                <LinearGradient 
                    colors={isDark ? ['#8E2DE2', '#4A00E0'] : ['#00C9FF', '#92FE9D']} 
                    style={styles.avatarBorder}
                >
                    <View style={[styles.avatarBox, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                        ) : (
                            <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
                        )}
                    </View>
                </LinearGradient>

                <View style={styles.userInfo}>
                    <Text style={[styles.username, { color: isDark ? '#fff' : '#111' }]} numberOfLines={1}>{name}</Text>
                    <Text style={[styles.userSub, { color: isDark ? '#888' : '#aaa' }]}>Felt the vibe</Text>
                </View>

                <View style={[styles.vibeBadge, { backgroundColor: isDark ? '#2A2A2A' : '#F9FAFB' }]}>
                    <Text style={styles.vibeEmoji}>{vibe}</Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ─── המודאל הראשי ───────────────────────────────────────────────────
export function PostLikesModal({ postId, visible, onClose, isDark }) {
    const { height: SCREEN_H } = useWindowDimensions();
    const [likes, setLikes] = useState([]);
    const [loading, setLoading] = useState(false);
    const fetchProfilePreview = useAppStore(state => state.fetchProfilePreview);

    useEffect(() => {
        let cancelled = false;

        if (visible && postId) {
            (async () => {
                setLoading(true);
                try {
                    let data;
                    try {
                        data = await fetchAPI(`/posts/${postId}/likes`);
                    } catch (postError) {
                        data = await fetchAPI(`/pulse/${postId}/likes`);
                    }

                    if (cancelled) return;
                    const likesArray = Array.isArray(data) ? data : (data?.likes || data?.data || []);
                    setLikes(likesArray);
                } catch (error) {
                    if (cancelled) return;
                    setLikes([]);
                } finally {
                    if (!cancelled) setLoading(false);
                }
            })();
        } else {
            setLikes([]);
        }

        return () => { cancelled = true; };
    }, [visible, postId]);

    const handleUserPress = (userId) => {
        onClose();
        if (fetchProfilePreview && userId) {
            fetchProfilePreview(userId);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                {/* ⭐️ התיקון כאן: העברנו את הגובה לכאן כסטייל דינמי */}
                <View style={[styles.sheet, { backgroundColor: isDark ? '#0F0F13' : '#F9FAFB', height: SCREEN_H * 0.65 }]}>
                    
                    <LinearGradient 
                        colors={isDark ? ['#1a1a24', '#0F0F13'] : ['#E8EEF6', '#F9FAFB']} 
                        style={styles.header}
                    >
                        <View>
                            <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Vibes & Reactions</Text>
                            <Text style={[styles.subtitle, { color: isDark ? '#aaa' : '#666' }]}>{likes.length} people reacted</Text>
                        </View>
                        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} onPress={onClose}>
                            <Ionicons name="close" size={22} color={isDark ? '#fff' : '#000'} />
                        </TouchableOpacity>
                    </LinearGradient>

                    {loading ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={brand.blue || '#007AFF'} />
                            <Text style={[styles.loadingText, { color: isDark ? '#888' : '#aaa' }]}>Gathering vibes...</Text>
                        </View>
                    ) : likes.length === 0 ? (
                        <View style={styles.center}>
                            <View style={[styles.emptyCircle, { backgroundColor: isDark ? '#1C1C22' : '#E8EEF6' }]}>
                                <Text style={{fontSize: 44}}>👻</Text>
                            </View>
                            <Text style={[styles.emptyText, { color: isDark ? '#fff' : '#111' }]}>It's quiet here...</Text>
                            <Text style={[styles.emptySub, { color: isDark ? '#888' : '#888' }]}>Be the first to drop a vibe on this post!</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={likes}
                            keyExtractor={(item, index) => String(item?.id || item?.user?.id || index)}
                            renderItem={({item, index}) => <AnimatedRow item={item} index={index} isDark={isDark} onUserPress={handleUserPress} />}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: { 
        borderTopLeftRadius: 28, 
        borderTopRightRadius: 28, 
        overflow: 'hidden' 
    },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
    },
    title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
    subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    
    listContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 40 },
    
    userRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 12, 
        borderRadius: 20,
        marginBottom: 10,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5
    },
    avatarBorder: {
        width: 50, height: 50, borderRadius: 25,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 14
    },
    avatarBox: { 
        width: 44, height: 44, borderRadius: 22, 
        alignItems: 'center', justifyContent: 'center', 
        overflow: 'hidden' 
    },
    avatar: { width: '100%', height: '100%' },
    avatarInitial: { fontSize: 18, fontWeight: '900', color: brand.blue || '#007AFF' },
    
    userInfo: { flex: 1 },
    username: { fontSize: 16, fontWeight: '800' },
    userSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    
    vibeBadge: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 3, elevation: 2
    },
    vibeEmoji: { fontSize: 22 },
    
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 15, fontSize: 14, fontWeight: '700' },
    emptyCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyText: { fontSize: 20, fontWeight: '900', marginBottom: 6 },
    emptySub: { fontSize: 14, fontWeight: '500' }
});