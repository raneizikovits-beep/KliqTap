import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { brand } from '../constants/data';
import { styles } from '../constants/styles';
import { IconChip } from './CommonComponents';

export const NotificationBlock = memo(({ item, onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.notificationCard}>
      <View style={styles.notificationIcon}>
        <Text style={{ fontSize: 20 }}>{item.icon}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.p} numberOfLines={2}>{item.text}</Text>
        <Text style={[styles.p, { fontSize: 12, color: brand.soft, marginTop: 2 }]}>{item.time}</Text>
      </View>
      <View style={styles.notificationDot} />
    </TouchableOpacity>
  );
});

// ⭐️ FIX: `actions` had no default — actions.map() crashed any caller that
// rendered this block without an actions array (e.g. a message with no actions).
export const MessageBlock = memo(({ title, body, actions = [], onAction }) => {
  return (
    <View style={styles.blockCard}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.p}>{body}</Text>
      <View style={[styles.actionsRow, { marginTop: 8 }]}>
        {actions.map((a, i) => (
          // ⭐️ Fix: Added unique key fallback to prevent map index anti-pattern
          <IconChip key={a.label || String(i)} label={a.label} icon={a.icon} onPress={() => onAction(a.label)} />
        ))}
      </View>
    </View>
  );
});

// ⭐️ FIX: same missing default as MessageBlock above.
export const EventBlock = memo(({ title, details, actions = [], onAction }) => {
  return (
    <View style={styles.blockCard}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.p}>{details}</Text>
      <View style={[styles.actionsRow, { marginTop: 8 }]}>
        {actions.map((a, i) => (
           // ⭐️ Fix: Added unique key fallback
          <IconChip key={a.label || String(i)} label={a.label} icon={a.icon} onPress={() => onAction(a.label)} />
        ))}
      </View>
    </View>
  );
});