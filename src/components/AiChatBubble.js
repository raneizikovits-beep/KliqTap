// client/src/components/AiChatBubble.js
// ⭐️ FULL DARK MODE COMPATIBLE ⭐️
// v1.1
//
// [V1.1 CHANGES — Engineering Audit Fixes]:
//   [FIX LOW]    Added `if (!message) return null;` guard. Every comparable list-item
//                component in this codebase (CommentItem, GroupUpdateBubble, PulseItem,
//                MemberTile, QuestItem, etc.) guards against a missing core prop — this
//                was the one exception, and a single malformed/null item in a chat
//                history array would throw and could crash the whole screen.
//   [FIX MEDIUM] Wrapped the export in memo(). This renders inside a scrolling chat
//                history list (BotStudioScreen) — every other list-item component in
//                this codebase is memoized; this one wasn't. Without it, every keystroke
//                while composing a new message re-renders the ENTIRE chat history, not
//                just the new bubble.

import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ⭐️ מקבלים את isDark מהפרופס (BotStudioScreen כבר מעביר אותו אלינו) ⭐️
const AiChatBubble = ({ message, isDark }) => {
  // [FIX LOW] Guard against missing/malformed data — consistent with the rest of the codebase.
  if (!message) return null;

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
};

AiChatBubble.displayName = 'AiChatBubble';

export default memo(AiChatBubble);

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