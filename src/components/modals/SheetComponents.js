// client/src/components/modals/SheetComponents.js
// ⭐️ V2 PRODUCTION: Robust Ionicon Detection + Dark Mode (preserved)
//
// CRITICAL FIX IN THIS VERSION:
// [FIX-1] The previous Ionicon detection was: `typeof icon === 'string' && icon.length > 2`.
//         This broke on emoji surrogate pairs:
//           - '🔥' has .length === 2 → treated as emoji ✓ (correct by luck)
//           - '🇮🇱' (flag) has .length === 4 → treated as Ionicon (WRONG → crash)
//           - '👨‍💻' (ZWJ joiner) has .length === 5 → treated as Ionicon (WRONG → crash)
//         Now: use Ionicons naming convention (lowercase ASCII letters,
//         digits, hyphens) — only that pattern is treated as Ionicon.
//         Everything else (emojis, multi-codepoint sequences) renders as text.
//
// All UI, styles, dark mode, and component contracts are preserved.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../../constants/data';

// [FIX-1] Ionicons use lowercase letters, digits, and hyphens only.
// Any string outside that pattern is treated as an emoji or text glyph.
// Examples that match: "send", "chevron-back", "videocam-off-outline"
// Examples that DON'T match: "🔥", "🇮🇱", "👨‍💻", "Aa", "Hi"
const isIoniconName = (icon) =>
    typeof icon === 'string' && /^[a-z][a-z0-9-]*$/.test(icon);

export const SettingItem = ({ icon, title, body, onPress, isDark }) => {
    const useIonicon = isIoniconName(icon);

    return (
        <TouchableOpacity 
            style={[styles.itemContainer, { 
                backgroundColor: isDark ? '#1C1C1E' : '#fff', 
                borderBottomColor: isDark ? '#333' : '#f5f5f5' 
            }]} 
            onPress={onPress} 
            activeOpacity={0.7}
        >
            <View style={[styles.iconBox, { backgroundColor: isDark ? '#333' : '#F5F7FA' }]}>
                {useIonicon ? (
                    <Ionicons name={icon} size={22} color={isDark ? '#4DA8DA' : brand.blue} />
                ) : (
                    <Text style={styles.emojiIcon}>{icon}</Text>
                )}
            </View>

            <View style={styles.textContainer}>
                <Text style={[styles.itemTitle, { color: isDark ? '#fff' : '#333' }]}>{title}</Text>
                {body ? (
                    <Text style={[styles.itemBody, { color: isDark ? '#aaa' : '#888' }]} numberOfLines={1}>{body}</Text>
                ) : null}
            </View>

            <Ionicons name="chevron-forward" size={18} color={isDark ? '#666' : '#ccc'} />
        </TouchableOpacity>
    );
};

export const GridItem = ({ icon, title, onPress, isDark }) => {
    const useIonicon = isIoniconName(icon);

    return (
        <TouchableOpacity 
            style={[styles.gridItem, { 
                backgroundColor: isDark ? '#1C1C1E' : '#fff', 
                borderColor: isDark ? '#333' : '#f0f0f0' 
            }]} 
            onPress={onPress} 
            activeOpacity={0.8}
        >
            <View style={[styles.gridIconCircle, { backgroundColor: isDark ? '#4A4A20' : '#FFF9C4' }]}>
                {useIonicon ? (
                    <Ionicons name={icon} size={28} color={isDark ? '#fff' : brand.ink} />
                ) : (
                    <Text style={styles.gridEmoji}>{icon}</Text>
                )}
            </View>
            <Text style={[styles.gridTitle, { color: isDark ? '#fff' : '#333' }]}>{title}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    itemContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
    iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    emojiIcon: { fontSize: 22 },
    textContainer: { flex: 1, marginRight: 10 },
    itemTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
    itemBody: { fontSize: 13 },
    
    gridItem: { width: '48%', borderRadius: 16, padding: 15, marginBottom: 15, alignItems: 'center', borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 2 },
    gridIconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    gridEmoji: { fontSize: 28 },
    gridTitle: { fontSize: 14, fontWeight: 'bold', textAlign: 'center' }
});