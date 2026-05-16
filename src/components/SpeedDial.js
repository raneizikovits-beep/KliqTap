// client/src/components/SpeedDial.js
// ⭐️ FINAL COMPLETE VERSION: Orange Glassy FAB + Full Menu Logic & Memoized Performance ⭐️
// ⭐️ FULL DARK MODE COMPATIBLE ⭐️

import React, { useEffect, useRef, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../constants/data';
import { useAppStore } from '../store/useAppStore'; // ⭐️ משיכת הסטור

const ACTIONS = [
    { 
        id: 'bot_studio', label: 'Bot Studio 🤖', icon: 'color-wand', 
        color: '#4CAF50', bg: '#E8F5E9', actionProp: 'onOpenBotStudio' 
    },
    { 
        id: 'ai', label: 'Ask AI Genius', icon: 'sparkles', 
        color: '#6200EE', bg: '#F3E5F5', actionProp: 'onOpenAI' 
    },
    { 
        id: 'upload', label: 'Magic Multi-Post ✨', icon: 'rocket', 
        color: '#00BCD4', bg: '#E0F7FA', actionProp: 'onOpenFileUpload' 
    },
    { 
        id: 'group', label: 'Create Community', icon: 'people', 
        color: '#FF9800', bg: '#FFF3E0', actionProp: 'onOpenGroup' 
    },
    { 
        id: 'post', label: 'New Post', icon: 'create', 
        color: '#2196F3', bg: '#E3F2FD', actionProp: 'onOpenPost' 
    },
];

const SpeedDial = (props) => {
    const { isSpeedDialOpen, onToggleMenu } = props;
    
    // ⭐️ זיהוי מצב לילה
    const userSettings = useAppStore(state => state.userSettings);
    const isDark = userSettings?.darkMode === true;

    // Animation Values
    const animation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(animation, {
            toValue: isSpeedDialOpen ? 1 : 0,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
        }).start();
    }, [isSpeedDialOpen, animation]);

    // Rotation Interpolation for Main Button
    const rotation = animation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '45deg']
    });

    return (
        <View style={localStyles.container} pointerEvents="box-none">
            
            {/* --- EXPANDED MENU ITEMS (Pop Upwards) --- */}
            <View style={localStyles.menuWrapper} pointerEvents="box-none">
                {ACTIONS.map((item, index) => {
                    const translateY = animation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [10 * (ACTIONS.length - index), -10]
                    });
                    
                    const opacity = animation.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 0, 1]
                    });

                    const scale = animation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 1]
                    });

                    return (
                        <Animated.View 
                            key={item.id} 
                            style={[localStyles.actionRow, { opacity, transform: [{ translateY }, { scale }] }]}
                            pointerEvents={isSpeedDialOpen ? 'auto' : 'none'}
                        >
                            <View style={[localStyles.labelContainer, { backgroundColor: isDark ? 'rgba(40,40,40,0.95)' : 'rgba(255,255,255,0.95)' }]}>
                                <Text style={[localStyles.labelText, { color: isDark ? '#fff' : '#333' }]}>{item.label}</Text>
                            </View>

                            <TouchableOpacity 
                                style={[
                                    localStyles.actionBtn, 
                                    { backgroundColor: isDark ? '#1C1C1E' : item.bg, borderColor: item.color }
                                ]}
                                onPress={() => {
                                    onToggleMenu(); 
                                    if (props[item.actionProp]) props[item.actionProp](); 
                                }}
                                activeOpacity={0.8}
                            >
                                <Ionicons name={item.icon} size={22} color={item.color} />
                            </TouchableOpacity>
                        </Animated.View>
                    );
                })}
            </View>

            {/* --- MAIN FAB BUTTON (ORANGE GLASS STYLE) --- */}
            <TouchableOpacity 
                activeOpacity={0.9} 
                onPress={onToggleMenu}
                style={[
                    localStyles.fab, 
                    { backgroundColor: isDark ? 'rgba(40,40,40,0.95)' : 'rgba(255,255,255,0.95)' },
                    isSpeedDialOpen && localStyles.fabOpen
                ]}
            >
                <Animated.View style={{ transform: [{ rotate: rotation }] }}>
                    <Ionicons name="add" size={36} color={isSpeedDialOpen ? "#fff" : "#FF9800"} />
                </Animated.View>
            </TouchableOpacity>

        </View>
    );
};

export default memo(SpeedDial);

const localStyles = StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'flex-end', zIndex: 200 },
    menuWrapper: { position: 'absolute', bottom: 75, right: 0, alignItems: 'flex-end', paddingRight: 5, width: 200 },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 15 },
    labelContainer: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginRight: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
    labelText: { fontWeight: 'bold', fontSize: 13 },
    actionBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 4 },
    fab: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: "#FF9800", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6, borderWidth: 1, borderColor: 'rgba(255, 152, 0, 0.3)' },
    fabOpen: { backgroundColor: brand.red, shadowColor: brand.red, borderColor: brand.red }
});