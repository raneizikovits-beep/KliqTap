// client/src/components/modals/PostSharesModal.js
//
// [V1.1 — Engineering Audit Fixes]:
// [BUG]   Same race condition as PostLikesModal.js's identical fix this
//         session — the mount effect had no protection against a stale
//         response landing after postId had already changed again. Fixed
//         with the standard React "cancelled" flag pattern.
// [LOW]   The @username text was missing the `isDark && textDark` override
//         that its immediate sibling (the display name, right above it) has.
//         Minor, low-severity inconsistency — added for consistency.
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ⭐️ התיקון: הוספנו עוד ../ כדי לעלות מתוך תיקיית modals לתיקיית src ואז ל-store
import { fetchPostShares } from '../../store/social.service';
import { useAppStore } from '../../store/useAppStore';

const PostSharesModal = ({ visible, onClose, postId }) => {
    const [shares, setShares] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // משיכת הגדרות עיצוב (תואם לשאר המערכת שלך)
    const settings = useAppStore(state => state.userSettings || {});
    const isDark = settings.darkMode === true;

    useEffect(() => {
        // [FIX] Standard "cancelled" guard — see header note for full detail.
        let cancelled = false;

        if (visible && postId) {
            (async () => {
                setLoading(true);
                try {
                    const data = await fetchPostShares(postId);
                    if (cancelled) return;
                    setShares(data || []);
                } catch (error) {
                    if (cancelled) return;
                    console.warn('Error fetching shares:', error);
                } finally {
                    if (!cancelled) setLoading(false);
                }
            })();
        } else {
            setShares([]); // ניקוי הנתונים כשהחלון נסגר
        }

        return () => { cancelled = true; };
    }, [visible, postId]);

    const renderItem = ({ item }) => {
        const user = item.user;
        if (!user) return null;
        
        return (
            <View style={localStyles.userRow}>
                <Image
                    source={{ uri: user.avatarUrl || 'https://via.placeholder.com/150' }}
                    style={localStyles.avatar}
                />
                <View style={localStyles.userInfo}>
                    <Text style={[localStyles.name, isDark && localStyles.textDark]}>
                        {user.name || user.username}
                    </Text>
                    <Text style={[localStyles.username, isDark && localStyles.textDark]}>@{user.username}</Text>
                </View>
                {/* אייקון קטן שמסמל שיתוף (Repost) */}
                <View style={localStyles.iconWrapper}>
                    <Ionicons name="repeat" size={18} color="#4ECDC4" />
                </View>
            </View>
        );
    };

    return (
        <Modal 
            visible={visible} 
            transparent={true} 
            animationType="slide" 
            onRequestClose={onClose}
        >
            <View style={localStyles.overlay}>
                {/* לחיצה מחוץ לחלון תסגור אותו */}
                <TouchableOpacity style={localStyles.backgroundArea} onPress={onClose} activeOpacity={1} />
                
                <View style={[localStyles.bottomSheet, isDark && localStyles.sheetDark]}>
                    {/* כותרת החלון */}
                    <View style={localStyles.header}>
                        <Text style={[localStyles.title, isDark && localStyles.textDark]}>Shared by</Text>
                        <TouchableOpacity onPress={onClose} style={localStyles.closeBtn}>
                            <Ionicons name="close-circle" size={28} color={isDark ? '#555' : '#ccc'} />
                        </TouchableOpacity>
                    </View>

                    {/* תוכן החלון */}
                    {loading ? (
                        <ActivityIndicator size="large" color="#4ECDC4" style={localStyles.loader} />
                    ) : shares.length === 0 ? (
                        <Text style={[localStyles.emptyText, isDark && localStyles.textDark]}>
                            No one has shared this yet.
                        </Text>
                    ) : (
                        <FlatList
                            data={shares}
                            keyExtractor={(item) => String(item.id)}
                            renderItem={renderItem}
                            contentContainerStyle={localStyles.listContainer}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default PostSharesModal;

const localStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backgroundArea: {
        flex: 1,
    },
    bottomSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        height: '60%', 
        paddingTop: 10,
        paddingHorizontal: 20,
    },
    sheetDark: {
        backgroundColor: '#1E1E1E',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        marginBottom: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    textDark: {
        color: '#FFF',
    },
    closeBtn: {
        padding: 5,
    },
    loader: {
        marginTop: 40,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
        color: '#666',
    },
    listContainer: {
        paddingBottom: 40,
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#eee',
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#222',
    },
    username: {
        fontSize: 14,
        color: '#888',
        marginTop: 2,
    },
    iconWrapper: {
        backgroundColor: 'rgba(78, 205, 196, 0.1)',
        padding: 8,
        borderRadius: 20,
    }
});