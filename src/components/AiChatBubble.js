// client/src/components/AiChatBubble.js
// ⭐️ FULL DARK MODE COMPATIBLE ⭐️

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ⭐️ מקבלים את isDark מהפרופס (BotStudioScreen כבר מעביר אותו אלינו) ⭐️
export default function AiChatBubble({ message, isDark }) {
  const isUser = message.sender === 'user';

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.botContainer]}>
      {!isUser && (
        <View style={[styles.botAvatar, isDark && { backgroundColor: '#444' }]}>
          <Ionicons name="hardware-chip" size={16} color="#fff" />
        </View>
      )}
      <View style={[
          styles.bubble, 
          isUser ? styles.userBubble : [styles.botBubble, isDark && { backgroundColor: '#1C1C1E' }]
      ]}>
        <Text style={[
            styles.text, 
            isUser ? styles.userText : [styles.botText, isDark && { color: '#ddd' }]
        ]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', marginVertical: 6, width: '100%' },
  userContainer: { justifyContent: 'flex-end' },
  botContainer: { justifyContent: 'flex-start', alignItems: 'flex-end' },
  botAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 8, marginBottom: 4 },
  bubble: { maxWidth: '75%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  userBubble: { backgroundColor: '#007AFF', borderBottomRightRadius: 4 },
  botBubble: { backgroundColor: '#E5E5EA', borderBottomLeftRadius: 4 },
  text: { fontSize: 15, lineHeight: 20 },
  userText: { color: '#fff' },
  botText: { color: '#000' },
});