// client/src/components/CommonComponents.js

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { brand } from '../constants/data';
import { styles } from '../constants/styles';

// --- 1. IconChip ---
export const IconChip = memo(({ label, icon, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.iconChip}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <Text style={styles.iconChipText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
});

// --- 2. PulseItem ---
export const PulseItem = memo(({ pulse, onPress, onLongPress }) => {
    const avatarUrl = pulse?.author?.avatarUrl || pulse?.user?.avatarUrl || 'https://via.placeholder.com/150';
    const username = pulse?.author?.username || pulse?.user?.username || 'User';
    
    // Dynamic border color mapping
    const vibeColors = {
        Party: '#FF2D55',
        Happy: brand.yellow,
        Focused: brand.purple,
        Love: '#FF3B30'
    };
    
    let borderColor = vibeColors[pulse?.vibe] || (pulse?.isNew ? brand.blue : '#E0E0E0');

    // Emoji mapping
    const vibeEmojis = {
        Happy: '😊',
        Tired: '😴',
        Party: '🔥',
        Love: '😍',
        Focused: '🧠'
    };
    const currentEmoji = vibeEmojis[pulse?.vibe] || '✨';

    return (
      <TouchableOpacity 
        onPress={onPress} 
        onLongPress={onLongPress} 
        activeOpacity={0.8}
        style={{ alignItems: 'center', marginRight: 14, width: 72 }}
      >
        <View style={{
          width: 68, height: 68, borderRadius: 34, padding: 3, backgroundColor: '#fff',
          shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3,
        }}>
            <View style={{
                flex: 1, borderRadius: 32, borderWidth: 2, borderColor: borderColor,
                padding: 2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden'
            }}>
                <Image 
                  source={{ uri: avatarUrl }} 
                  style={{ width: '100%', height: '100%', borderRadius: 30 }}
                  resizeMode="cover"
                />
            </View>
            
            {pulse?.vibe && pulse.vibe !== 'Neutral' && (
                <View style={{
                    position: 'absolute', bottom: 0, right: -2, backgroundColor: '#fff',
                    borderRadius: 10, width: 22, height: 22, justifyContent: 'center',
                    alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0', elevation: 2
                }}>
                    <Text style={{ fontSize: 12 }}>{currentEmoji}</Text>
                </View>
            )}
        </View>
  
        <Text 
            style={{ marginTop: 6, fontSize: 11, color: brand.ink, fontWeight: '600', textAlign: 'center' }} 
            numberOfLines={1}
        >
            {username}
        </Text>
      </TouchableOpacity>
  );
});

// --- 3. MemberTile ---
export const MemberTile = memo(({ user, onOpenProfile, onAdd, onRemove }) => {
  if (!user) return null;
  
  return (
    <View style={styles.memberTile}>
      <TouchableOpacity onPress={onRemove} style={[styles.sideActionAbs, { left: 10 }]}>
        <View style={[styles.badge, { backgroundColor: brand.red }]}>
          <Text style={styles.badgeText}>✕</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={onOpenProfile} style={styles.memberCenter}>
        <Image source={{ uri: user.img || 'https://via.placeholder.com/50' }} style={styles.memberAvatar} />
        <Text style={[styles.p, { marginTop: 6 }]} numberOfLines={1}>{user.name || 'Unknown'}</Text>
        {user.intent && <Text style={[styles.p, { fontSize: 11 }]} numberOfLines={1}>{user.intent}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={onAdd} style={[styles.sideActionAbs, { right: 10 }]}>
        <View style={[styles.badge, { backgroundColor: brand.green }]}>
          <Text style={styles.badgeText}>✓</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
});

// --- 4. SupportCard ---
export const SupportCard = memo(({ title, desc, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.groupCard}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={styles.h2} numberOfLines={1}>{title}</Text>
        <Text style={styles.p} numberOfLines={1}>{desc}</Text>
      </View>
      <IconChip label="Open" icon="➡️" onPress={onPress} />
    </TouchableOpacity>
  );
});

// --- 5. BadgeIcon ---
export const BadgeIcon = memo(({ badge, icon = "🏅", onPress, locked = false }) => {
  return (
    <TouchableOpacity 
      onPress={onPress} 
      style={[styles.badgeIcon, locked && styles.badgeIconLocked]}
    >
      <Text style={styles.badgeIconImage}>{icon}</Text>
      <Text style={styles.badgeIconLabel} numberOfLines={1}>{badge}</Text>
    </TouchableOpacity>
  );
});

// --- 6. QuestItem ---
export const QuestItem = memo(({ quest }) => {
  if (!quest) return null;
  
  return (
    <View style={[styles.questItem, quest.completed && styles.questItemCompleted]}>
      <Text style={styles.questIcon}>{quest.completed ? '✅' : quest.icon}</Text>
      <Text style={styles.questText}>{quest.text}</Text>
      <Text style={styles.questPoints}>{quest.points}</Text>
    </View>
  );
});