// client/src/components/modals/AiModal.js
// 🏆 KliqMind V3.3: Clean Header, FULL DARK MODE COMPATIBLE & Memory Leak Patched 🏆

import React, { useRef, useEffect, useState } from 'react';
import { 
    Modal, View, Text, ScrollView, TextInput, 
    TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, 
    Platform, StyleSheet, Dimensions, SafeAreaView, Animated, StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech'; 
import { useAppStore } from '../../store/useAppStore'; 

const { width } = Dimensions.get('window');

const formatAiText = (text) => {
    if (!text || typeof text !== 'string') return "";
    return text.replace(/KliqTap/g, 'KliqMind');
};

export default function AiModal({ 
    visible, onClose, thread, isLoading, input, onInputChange, onSubmit 
}) {
    const scrollViewRef = useRef();
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [activePersona, setActivePersona] = useState('Genius');
    const [smartContextActive, setSmartContextActive] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // ⭐️ הוספת משיכת הגדרות למצב לילה
    const { isAiSpeaking, setIsAiSpeaking, userSettings } = useAppStore();
    const isDark = userSettings?.darkMode === true;

    // סינון חכם: מוריד את הודעת ה"מערכת" הכפולה
    const displayThread = thread.filter(m => !(m.role === 'system' && m.text.includes('How can I help you connect today')));

    const hasServerMessages = displayThread.some(m => m.role === 'assistant' || (m.role === 'user' && m.text));
    const showWelcomeFrame = !hasServerMessages && !isLoading;

    const speakMessage = (text) => {
        if (!text) return;
        Speech.stop(); 
        setIsAiSpeaking(true);
        Speech.speak(text, {
            language: 'en',
            pitch: 1.0,
            rate: 0.9,
            onDone: () => setIsAiSpeaking(false),
            onStopped: () => setIsAiSpeaking(false),
            onError: () => setIsAiSpeaking(false)
        });
    };

    const stopSpeaking = () => {
        Speech.stop();
        setIsAiSpeaking(false);
    };

    // ⭐️ [MEM-LEAK FIX] Clearance לעצירת האנימציה כשחלון ה-AI נסגר ⭐️
    useEffect(() => {
        let animation;
        if (isVoiceMode || isAiSpeaking) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
                ])
            );
            animation.start();
        } else {
            pulseAnim.setValue(1);
        }

        return () => {
            if (animation) animation.stop();
        };
    }, [isVoiceMode, isAiSpeaking, pulseAnim]);

    useEffect(() => {
        const lastMsg = thread[thread.length - 1];
        if (visible && isVoiceMode && lastMsg?.role === 'assistant' && !isLoading) {
            speakMessage(lastMsg.text);
        }
        if (scrollViewRef.current && visible) {
            setTimeout(() => { scrollViewRef.current?.scrollToEnd({ animated: true }); }, 100);
        }
    }, [thread, isLoading, visible, isVoiceMode]);

    const handleSubmit = () => {
        if (input.trim()) {
            onSubmit(input.trim()); 
            setSmartContextActive(false);
        }
    };

    const togglePersona = () => {
        const p = ['Genius', 'Expert', 'Creative'];
        setActivePersona(p[(p.indexOf(activePersona) + 1) % 3]);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose} statusBarTranslucent={true}>
            <View style={[localStyles.fullScreenContainer, { backgroundColor: isDark ? '#000' : '#fff' }]}>
                <SafeAreaView style={localStyles.safeArea}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === "ios" ? "padding" : "height"} 
                        style={localStyles.keyboardContainer}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                    >
                        
                        {/* HEADER - עיצוב מתוקן ללא דחיסות */}
                        <View style={[localStyles.header, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderBottomColor: isDark ? '#333' : '#f0f0f0' }]}>
                            <View style={localStyles.headerTopRow}>
                                <TouchableOpacity onPress={() => { stopSpeaking(); onClose(); }} style={localStyles.iconBtnLeft}>
                                    <Ionicons name="chevron-down" size={26} color={isDark ? '#ccc' : "#333"} />
                                </TouchableOpacity>
                                
                                <View style={localStyles.headerTitleContainer}>
                                    <Ionicons name="sparkles" size={18} color="#6200EE" style={{marginRight: 6}} />
                                    <Text style={[localStyles.headerTitle, { color: isDark ? '#fff' : '#000' }]}>
                                        <Text style={{ color: '#2196F3' }}>Kliq</Text><Text style={{ color: '#FF9800' }}>Mind</Text>
                                    </Text>
                                </View>
                                
                                <View style={localStyles.headerActions}>
                                    <TouchableOpacity onPress={() => { setIsVoiceMode(!isVoiceMode); stopSpeaking(); }} style={[localStyles.iconBtnRight, isVoiceMode && localStyles.activeAction]}>
                                        <Ionicons name={isVoiceMode ? "mic" : "call-outline"} size={22} color={isVoiceMode ? "#fff" : (isDark ? '#BB86FC' : "#6200EE")} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={togglePersona} style={localStyles.iconBtnRight}>
                                        <Ionicons name="color-filter-outline" size={22} color={isDark ? '#ccc' : "#333"} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* CONTENT AREA */}
                        {isVoiceMode ? (
                            <View style={[localStyles.voiceContainer, { backgroundColor: isDark ? '#000' : '#fff' }]}>
                                <Animated.View style={[localStyles.pulseCircle, { transform: [{ scale: pulseAnim }], backgroundColor: isAiSpeaking ? '#2196F3' : '#6200EE' }]}>
                                    <Ionicons name={isAiSpeaking ? "volume-high" : "mic"} size={55} color="#fff" />
                                </Animated.View>
                                <Text style={[localStyles.voiceStatus, { color: isDark ? '#fff' : '#111' }]}>
                                    {isAiSpeaking ? "KliqMind is speaking..." : "Listening to you..."}
                                </Text>
                                <TouchableOpacity style={localStyles.stopVoiceBtn} onPress={() => { stopSpeaking(); setIsVoiceMode(false); }}>
                                    <Text style={localStyles.stopVoiceText}>End Call</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <ScrollView ref={scrollViewRef} style={[localStyles.scrollArea, { backgroundColor: isDark ? '#000' : '#F9FAFB' }]} contentContainerStyle={localStyles.scrollContent} keyboardShouldPersistTaps="handled">
                                
                                {showWelcomeFrame && (
                                    <View style={localStyles.welcomeContainer}>
                                        <View style={[localStyles.welcomeGlassCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#f0f0f0' }]}>
                                            <View style={localStyles.welcomeIconCircle}><Ionicons name="logo-electron" size={28} color="#fff" /></View>
                                            <Text style={[localStyles.welcomeTitle, { color: isDark ? '#fff' : '#111' }]}>Hello, I am KliqMind</Text>
                                            <Text style={[localStyles.welcomeSubtext, { color: isDark ? '#aaa' : '#666' }]}>Your advanced AI companion. Ready to help you create, discover, and vibe.</Text>
                                            <View style={[localStyles.welcomeDivider, { backgroundColor: isDark ? '#333' : '#eee' }]} />
                                            <Text style={[localStyles.welcomePrompt, { color: isDark ? '#888' : '#999' }]}>How can I help you today?</Text>
                                        </View>
                                    </View>
                                )}

                                {displayThread.map((m, i) => (
                                    <View key={i} style={[localStyles.messageWrapper, { alignItems: m.role === "user" ? 'flex-end' : 'flex-start' }]}>
                                        {m.role !== "user" && <View style={localStyles.aiAvatar}><Ionicons name="logo-electron" size={14} color="#fff" /></View>}
                                        <View style={[
                                            localStyles.bubble, 
                                            m.role === "user" ? localStyles.userBubble : [localStyles.aiBubble, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#eee' }]
                                        ]}>
                                            <Text style={[localStyles.msgText, m.role === "user" ? { color: '#fff' } : { color: isDark ? '#ddd' : '#333' }]}>{formatAiText(m.text)}</Text>
                                            
                                            {m.role === 'assistant' && (
                                                <TouchableOpacity onPress={() => speakMessage(m.text)} style={localStyles.bubbleSpeakBtn}>
                                                    <Ionicons name={isAiSpeaking ? "volume-medium" : "volume-medium-outline"} size={18} color={isDark ? '#888' : "#999"} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                ))}

                                {isLoading && (
                                    <View style={localStyles.typingIndicatorContainer}>
                                        <View style={localStyles.aiAvatar}><ActivityIndicator size="small" color="#fff" /></View>
                                        <View style={[localStyles.aiBubble, localStyles.typingBubble, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#eee' }]}>
                                            <Text style={[localStyles.typingText, { color: isDark ? '#888' : '#999' }]}>Thinking...</Text>
                                        </View>
                                    </View>
                                )}
                            </ScrollView>
                        )}
                        
                        {/* INPUT AREA */}
                        {!isVoiceMode && (
                            <View style={[localStyles.inputContainer, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderTopColor: isDark ? '#333' : '#f0f0f0' }]}>
                                <TouchableOpacity 
                                    style={[localStyles.contextBtn, { backgroundColor: isDark ? '#333' : '#f0f0f0' }, smartContextActive && localStyles.contextBtnActive]} 
                                    onPress={() => setSmartContextActive(!smartContextActive)}
                                >
                                    <Ionicons name="flash" size={20} color={smartContextActive ? "#fff" : (isDark ? '#888' : "#999")} />
                                </TouchableOpacity>
                                
                                <TextInput
                                    placeholder={`Ask ${activePersona}...`} 
                                    placeholderTextColor={isDark ? "#888" : "#999"}
                                    style={[localStyles.inputField, { backgroundColor: isDark ? '#333' : '#F3F4F6', color: isDark ? '#fff' : '#333' }]}
                                    value={input} 
                                    onChangeText={onInputChange} 
                                    onSubmitEditing={handleSubmit} 
                                    editable={!isLoading}
                                    returnKeyType="send"
                                />
                                
                                <TouchableOpacity onPress={handleSubmit} disabled={isLoading || !input.trim()} style={[localStyles.sendBtn, (!input.trim() || isLoading) && [localStyles.sendBtnDisabled, { backgroundColor: isDark ? '#555' : '#eee' }]]}>
                                    <Ionicons name="arrow-up" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

const localStyles = StyleSheet.create({
    fullScreenContainer: { flex: 1 },
    safeArea: { flex: 1 },
    keyboardContainer: { flex: 1 },
    header: { borderBottomWidth: 1, height: Platform.OS === 'android' ? 95 : 88, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 0, justifyContent: 'center' },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 50 },
    iconBtnLeft: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' }, 
    iconBtnRight: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
    activeAction: { backgroundColor: '#6200EE' },
    headerTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' }, 
    headerTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' }, 
    scrollArea: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 40 },
    welcomeContainer: { marginTop: 10, marginBottom: 30, alignItems: 'center' },
    welcomeGlassCard: { width: '100%', borderRadius: 28, padding: 25, alignItems: 'center', borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 5 },
    welcomeIconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#6200EE', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    welcomeTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
    welcomeSubtext: { fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 10 },
    welcomeDivider: { width: 40, height: 3, borderRadius: 2, marginVertical: 15 },
    welcomePrompt: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    messageWrapper: { marginBottom: 24, width: '100%' },
    bubble: { maxWidth: '85%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22 },
    userBubble: { backgroundColor: '#6200EE', borderBottomRightRadius: 4, alignSelf: 'flex-end', elevation: 2 },
    aiBubble: { borderTopLeftRadius: 4, marginLeft: 30, alignSelf: 'flex-start', borderWidth: 1, elevation: 1 },
    aiAvatar: { position: 'absolute', left: 0, top: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: '#2196F3', justifyContent: 'center', alignItems: 'center' },
    msgText: { fontSize: 16, lineHeight: 24 },
    bubbleSpeakBtn: { alignSelf: 'flex-end', marginTop: 8, padding: 4 },
    typingIndicatorContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    typingBubble: { paddingVertical: 10, paddingHorizontal: 16 },
    typingText: { fontSize: 13, fontStyle: 'italic' },
    inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1, paddingBottom: Platform.OS === 'ios' ? 35 : 15 },
    contextBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    contextBtnActive: { backgroundColor: '#2196F3' },
    inputField: { flex: 1, borderRadius: 25, paddingHorizontal: 18, paddingVertical: 12, fontSize: 16 },
    sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#6200EE', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    sendBtnDisabled: { },
    voiceContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pulseCircle: { width: 150, height: 150, borderRadius: 75, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#6200EE', shadowOpacity: 0.3, shadowRadius: 20 },
    voiceStatus: { marginTop: 50, fontSize: 24, fontWeight: '800' },
    stopVoiceBtn: { marginTop: 80, paddingHorizontal: 40, paddingVertical: 20, borderRadius: 40, backgroundColor: '#FF3B30', elevation: 5 },
    stopVoiceText: { color: '#fff', fontSize: 18, fontWeight: '900' }
});