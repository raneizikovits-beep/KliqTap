// client/src/components/ListItems.js
// ⭐️ V10.0: Unified Avatar Logic (First Letter) + Integrated Call Buttons ⭐️

import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Data from '../constants/data';

/**
 * 🎨 עוזר פנימי לציור אווטאר צבעוני עם אות
 * מחליף את כל התמונות הגנריות ('https://via.placeholder.com/150')
 */
const RenderSmartAvatar = ({ uri, name, size, isDark }) => {
    const firstLetter = name ? name.charAt(0).toUpperCase() : '?';
    
    if (uri) {
        return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
    }

    return (
        <View style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
            overflow: 'hidden'
        }}>
            <View style={{
                width: '100%',
                height: '100%',
                backgroundColor: Data.brand.blue,
                opacity: 0.1,
                position: 'absolute'
            }} />
            <Text style={{ 
                color: isDark ? '#FFF' : Data.brand.blue, 
                fontWeight: '900', 
                fontSize: size * 0.35 
            }}>
                {firstLetter}
            </Text>
        </View>
    );
};

// --- 1. Message List Item ---
// הרכיב המרכזי המציג שיחה בפיד ההודעות
export const MessageListItem = ({ item, onPress, onLongPress, isDark, onCall, onVideo }) => {
    const cardBg = isDark ? '#1C1C1E' : '#fff';
    const textColor = isDark ? '#fff' : '#333';
    const subTextColor = isDark ? '#aaa' : '#888';
    const borderColor = isDark ? '#333' : '#f0f0f0';
    const unreadBg = isDark ? '#102A43' : '#F0F7FF'; // רקע כחול עדין להודעות שלא נקראו

    const isCall = item.type && item.type.indexOf('call') === 0;
    const isMissedCall = item.type === 'call_missed';
    const isVoiceMsg = item.type === 'voice';

    return (
        <TouchableOpacity 
            style={[
                localStyles.messageCard, 
                { backgroundColor: item.unread > 0 ? unreadBg : cardBg, borderBottomColor: borderColor }
            ]}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.7}
        >
            {/* 🌟 אווטאר חכם וסטטוס מחובר */}
            <View style={localStyles.avatarWrapper}>
                <RenderSmartAvatar 
                    uri={item.avatar} 
                    name={item.sender} 
                    size={52} 
                    isDark={isDark} 
                />
                {item.unread > 0 && (
                    <View style={[localStyles.onlineDot, { borderColor: item.unread > 0 ? unreadBg : cardBg }]} />
                )}
            </View>

            {/* תוכן ההודעה: שם, זמן וטקסט */}
            <View style={localStyles.messageContent}>
                <View style={localStyles.messageHeader}>
                    <Text style={[localStyles.senderName, { color: textColor }]} numberOfLines={1}>
                        {item.sender}
                    </Text>
                    <Text style={[localStyles.timeText, { color: item.unread > 0 ? Data.brand.blue : subTextColor }]}>
                        {item.time}
                    </Text>
                </View>

                <View style={localStyles.messageBodyRow}>
                    {/* אייקונים לסוגי הודעות מיוחדים (שיחה, קול) */}
                    {isCall && (
                        <Ionicons 
                            name={isMissedCall ? "call" : "videocam"} 
                            size={14} 
                            color={isMissedCall ? Data.brand.red : Data.brand.green} 
                            style={{ marginRight: 4 }} 
                        />
                    )}
                    {isVoiceMsg && (
                        <Ionicons name="mic" size={14} color={Data.brand.blue} style={{ marginRight: 4 }} />
                    )}
                    
                    <Text 
                        style={[
                            localStyles.messageText, 
                            { color: subTextColor },
                            item.unread > 0 && { color: textColor, fontWeight: '700' },
                            isMissedCall && { color: Data.brand.red }
                        ]} 
                        numberOfLines={1}
                    >
                        {item.body || item.text || "Sent an attachment"}
                    </Text>
                </View>
            </View>

            {/* ⭐️ כפתורי שיחה מהירים המשולבים בתוך השורה ⭐️ */}
            {!item.isGroup && (onCall || onVideo) && (
                <View style={localStyles.quickActionsInside}>
                    {onCall && (
                        <TouchableOpacity style={localStyles.miniActionBtn} onPress={onCall}>
                            <Ionicons name="call" size={18} color={Data.brand.blue} />
                        </TouchableOpacity>
                    )}
                    {onVideo && (
                        <TouchableOpacity style={localStyles.miniActionBtn} onPress={onVideo}>
                            <Ionicons name="videocam" size={20} color={Data.brand.blue} />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* בועת מספר הודעות שלא נקראו (מוצגת רק אם אין כפתורי שיחה) */}
            {item.unread > 0 && !onCall && (
                <View style={localStyles.unreadBadge}>
                    <Text style={localStyles.unreadText}>{item.unread}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

// --- 2. Post Comment Item ---
export const CommentItem = ({ comment, isDark }) => {
    const textColor = isDark ? '#fff' : '#333';
    const subTextColor = isDark ? '#aaa' : '#888';
    
    return (
        <View style={localStyles.commentItem}>
            {/* 🌟 אווטאר חכם לתגובה */}
            <View style={{ marginRight: 12 }}>
                <RenderSmartAvatar uri={comment.avatar} name={comment.user} size={36} isDark={isDark} />
            </View>
            <View style={localStyles.commentContent}>
                <View style={localStyles.commentHeader}>
                    <Text style={[localStyles.commentUser, { color: textColor }]}>{comment.user}</Text>
                    <Text style={[localStyles.commentTime, { color: subTextColor }]}>{comment.time}</Text>
                </View>
                <Text style={[localStyles.commentText, { color: textColor }]}>{comment.text}</Text>
            </View>
        </View>
    );
};

// --- 3. Group Member List Item ---
export const GroupMemberListItem = ({ member, onOpenAvatar, isDark }) => {
    const textColor = isDark ? '#fff' : '#1E293B';
    const subTextColor = isDark ? '#aaa' : '#64748B';
    const borderColor = isDark ? '#333' : '#eee';

    return (
        <View style={[localStyles.memberRow, { borderBottomColor: borderColor }]}>
            <TouchableOpacity onPress={onOpenAvatar} activeOpacity={0.8} style={{ marginRight: 15 }}>
                {/* 🌟 אווטאר חכם לחבר קבוצה */}
                <RenderSmartAvatar uri={member.avatarUrl} name={member.name} size={44} isDark={isDark} />
            </TouchableOpacity>
            
            <View style={localStyles.memberInfo}>
                <Text style={[localStyles.memberName, { color: textColor }]}>{member.name || 'User'}</Text>
                <Text style={[localStyles.memberStatus, { color: subTextColor }]}>{member.status || 'Member'}</Text>
            </View>

            <TouchableOpacity style={localStyles.memberAction}>
                <Ionicons name="chatbubble-outline" size={20} color={Data.brand.blue} />
            </TouchableOpacity>
        </View>
    );
};

const localStyles = StyleSheet.create({
    messageCard: {
        flexDirection: 'row',
        paddingVertical: 15,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        alignItems: 'center',
    },
    avatarWrapper: {
        position: 'relative',
        marginRight: 14,
    },
    onlineDot: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Data.brand.green,
        borderWidth: 2,
    },
    messageContent: {
        flex: 1,
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    senderName: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    timeText: {
        fontSize: 11,
    },
    messageBodyRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    messageText: {
        fontSize: 14,
        flex: 1,
    },
    unreadBadge: {
        backgroundColor: Data.brand.blue,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        marginLeft: 10,
    },
    unreadText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    quickActionsInside: {
        flexDirection: 'row',
        gap: 10,
        marginLeft: 10,
    },
    miniActionBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(0, 122, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    commentItem: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    commentContent: {
        flex: 1,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 2,
    },
    commentUser: {
        fontWeight: 'bold',
        fontSize: 14,
        marginRight: 8,
    },
    commentTime: {
        fontSize: 12,
    },
    commentText: {
        fontSize: 14,
        lineHeight: 20,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 16,
        fontWeight: '700',
    },
    memberStatus: {
        fontSize: 13,
        marginTop: 2,
    },
    memberAction: {
        padding: 8,
    }
});