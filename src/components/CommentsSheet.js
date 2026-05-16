// client/src/components/CommentsSheet.js
// ⭐️ KLIQMIND V6.3: Comments Feedback (+2 PTS) & Performance Optimized ⭐️

import React, { useState, useRef, useEffect, memo } from 'react'; 
import { 
    View, Text, TextInput, TouchableOpacity, FlatList, 
    Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
    SafeAreaView, Keyboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; 
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabase'; 
import { useAppStore } from '../store/useAppStore'; 
import { styles } from '../constants/styles';
import { brand } from '../constants/data';

// --- רכיב תגובה בודדת ---
const CommentItem = memo(({ comment, currentUserId, onDelete }) => {
    const isMine = String(comment.userId) === String(currentUserId);
    
    const [displayName, setDisplayName] = useState(comment.username || 'User');
    const [displayAvatar, setDisplayAvatar] = useState(comment.avatar || null);

    useEffect(() => {
        let isMounted = true;
        const fetchProfile = async () => {
            if (!comment.userId) return;
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('full_name, avatar_url')
                    .eq('id', comment.userId)
                    .single();

                if (error) throw error;

                if (data && isMounted) {
                    if (data.full_name) setDisplayName(data.full_name);
                    if (data.avatar_url) setDisplayAvatar(data.avatar_url);
                }
            } catch (e) {
                console.log("Error fetching profile for comment:", e.message);
            }
        };
        
        fetchProfile();
        return () => { isMounted = false; };
    }, [comment.userId]);

    return (
        <View style={{ flexDirection: 'row', marginBottom: 16 }}>
            <Image 
                source={{ uri: displayAvatar || 'https://via.placeholder.com/36' }} 
                style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#eee' }}
            />
            <View style={{ flex: 1 }}>
                <View style={{ backgroundColor: '#f0f2f5', borderRadius: 12, padding: 10, alignSelf: 'flex-start' }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 2 }}>{displayName}</Text>
                    {comment.text ? <Text style={{ fontSize: 14, color: '#111' }}>{comment.text}</Text> : null}
                    {comment.imageUrl && (
                        <Image 
                            source={{ uri: comment.imageUrl }} 
                            style={{ width: 150, height: 150, borderRadius: 8, marginTop: 5 }} 
                            resizeMode="cover"
                        />
                    )}
                </View>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 4 }}>
                    <Text style={{ fontSize: 11, color: '#888' }}>
                        {new Date(comment.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {isMine && (
                        <TouchableOpacity onPress={() => onDelete(comment.id)} style={{ marginLeft: 10 }}>
                            <Text style={{ fontSize: 11, color: '#D32F2F', fontWeight: '600' }}>Delete</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
});

export default function CommentsSheet({ post, onClose }) {
    // ✅ תיקון: שם הפונקציה תוקן מ-addComment ל-createComment (תואם לסטור)
    const { user, createComment, deleteComment } = useAppStore(state => ({
        user: state.user,
        createComment: state.createComment,
        deleteComment: state.deleteComment,
    }));

    const [inputText, setInputText] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const flatListRef = useRef();
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);
    
    if (!post) return null; 

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setSelectedImage(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if ((!inputText.trim() && !selectedImage) || isSending) return;
        
        const postId = String(post.id); 
        
        setIsSending(true);
        try {
            // ✅ תיקון: קריאה ל-createComment במקום addComment
            const success = await createComment(postId, inputText.trim()); 
            
            if (success) {
                setInputText('');
                setSelectedImage(null);

                setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                }, 500);
            }

        } catch (error) {
            console.warn("Comment submit error:", error?.message);
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteWrapper = (commentId) => {
        Alert.alert("Delete Comment", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: 'destructive', onPress: () => deleteComment(String(post.id), String(commentId)) }
        ]);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : undefined} 
                style={{ flex: 1 }}
                keyboardVerticalOffset={0} 
            >
                <View style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.h2}>Comments ({post.comments?.length || 0})</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={brand?.ink || '#000'} />
                    </TouchableOpacity>
                </View>

                <FlatList
                    ref={flatListRef}
                    data={post.comments || []}
                    keyExtractor={(item, index) => String(item.id || index)} 
                    renderItem={({ item }) => (
                        <CommentItem 
                            comment={item} 
                            currentUserId={user?.id} 
                            onDelete={handleDeleteWrapper} 
                        />
                    )}
                    onContentSizeChange={() => { 
                        if (keyboardVisible && post.comments?.length > 0) { 
                            flatListRef.current?.scrollToEnd({ animated: true });
                        }
                    }}
                    contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                    ListEmptyComponent={
                        <Text style={{ textAlign: 'center', color: '#999', marginTop: 20 }}>
                            No comments yet. Be the first to vibe!
                        </Text>
                    }
                />

                {selectedImage && (
                    <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                        <View style={{ position: 'relative', width: 80, height: 80 }}>
                            <Image source={{ uri: selectedImage }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                            <TouchableOpacity 
                                onPress={() => setSelectedImage(null)}
                                style={{ position: 'absolute', top: -5, right: -5, backgroundColor: 'black', borderRadius: 10, padding: 2 }}
                            >
                                <Ionicons name="close-circle" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={{ 
                    flexDirection: 'row', alignItems: 'center', padding: 12, 
                    borderTopWidth: 1, borderColor: '#eee', backgroundColor: '#fff' 
                }}>
                    <TouchableOpacity onPress={handlePickImage} style={{ padding: 8 }}>
                        <Ionicons name="image-outline" size={24} color={brand?.blue || '#007AFF'} />
                    </TouchableOpacity>

                    <TextInput 
                        style={{ 
                            flex: 1, backgroundColor: '#f5f5f5', borderRadius: 20, 
                            paddingHorizontal: 15, paddingVertical: 8, maxHeight: 100, fontSize: 15 
                        }}
                        placeholder="Add a comment..."
                        multiline
                        value={inputText}
                        onChangeText={setInputText}
                    />

                    <TouchableOpacity 
                        onPress={handleSubmit} 
                        disabled={(!inputText.trim() && !selectedImage) || isSending}
                        style={{ padding: 8, marginLeft: 4 }}
                    >
                        {isSending ? <ActivityIndicator color={brand?.blue || '#007AFF'}/> : <Ionicons name="send" size={24} color={brand?.blue || '#007AFF'} />}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}