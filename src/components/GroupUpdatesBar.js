// client/src/components/GroupUpdatesBar.js
// ⭐️ V2.1 — Fix undefined.. bug in onLongPress intent string ⭐️
//
// CHANGES from V2.0:
//   [FIX LOW]  onLongPress handler: `item.text?.substring(0, 30) + '...'` produced
//              the literal string "undefined..." when item.text was null or absent.
//              Fixed to `item.text ? item.text.substring(0, 30) + '...' : ''`.
//
// [Previous V2.0]:
//   [FIX-G]  Removed DEMO_GROUP_UPDATES from useMemo deps (it's a module constant).
//   [FIX-S1] Added dark mode awareness via userSettings.darkMode.
//   [DRY]    Add Update item as module-level constant builder.

import React, { memo, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { brand, DEMO_GROUP_UPDATES } from '../constants/data';
import { styles } from '../constants/styles';
import { useAppStore } from '../store/useAppStore';

// --- GroupUpdateBubble component ---
const GroupUpdateBubble = memo(({ item, onPress, onLongPress, onAddStory, isDark }) => {
  const isAddButton = item.isSelf || item.id === 'u1';
  const imageSource = item.img ? { uri: item.img } : null;

  const getBorderColor = () => {
    if (isAddButton) return brand.blue;
    if (item.isNew) return brand.yellow;
    return brand.soft;
  };

  const handlePress = () => {
    if (isAddButton) onAddStory();
    else onPress(item);
  };

  return (
    <TouchableOpacity onPress={handlePress} onLongPress={onLongPress} style={styles.intentionBubble}>
      <View style={[styles.intentionAvatarRing, { borderColor: getBorderColor() }]}>
        {isAddButton ? (
          <View style={[styles.intentionAddBtn, isDark && localStyles.intentionAddBtnDark]}>
            <Text style={{ color: brand.blue, fontSize: 18, fontWeight: '700' }}>+</Text>
          </View>
        ) : (
          <Image source={imageSource} style={styles.intentionAvatar} />
        )}
        {item.isLive && !isAddButton && (
          <View style={styles.liveIndicator} />
        )}
      </View>
      <Text
        style={[styles.intentionLabel, isDark && localStyles.intentionLabelDark]}
        numberOfLines={1}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );
});

// --- GroupUpdatesBar component ---
const GroupUpdatesBar = ({ onOpenStory, onOpenProfile, onAddStory }) => {
  const { user, pulses, isDark } = useAppStore(
    useShallow((state) => ({
      user: state.user,
      pulses: state.pulses || [],
      isDark: state.userSettings?.darkMode === true,
    }))
  );

  // ⭐️ [FIX-G] Removed DEMO_GROUP_UPDATES from deps (module constant).
  const displayUpdates = useMemo(() => {
    const myUserId = String(user?.id || '');
    const myPulse = pulses.find(p => String(p.author?.id || '') === myUserId);

    const addUpdateItem = {
      id: 'u1',
      name: 'Add Update',
      img: user?.avatarUrl,
      isSelf: true,
      text: 'Share an update...',
      isNew: false,
      isLive: false,
    };

    const activePulses = DEMO_GROUP_UPDATES.filter(item => !item.isSelf);
    const updates = [];

    if (myPulse) {
      updates.push({
        id: myPulse.id,
        name: user?.name || 'My Vibe',
        img: user?.avatarUrl,
        isSelf: false,
        isNew: true,
        isLive: true,
        text: myPulse.text,
      });
    } else {
      updates.push(addUpdateItem);
    }

    activePulses.forEach(item => {
      if (!updates.find(u => u.id === item.id)) {
        updates.push(item);
      }
    });

    return updates;
  }, [pulses, user]);

  return (
    <View style={[styles.pulseBarContainer, isDark && localStyles.barContainerDark]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.intentionsContainer}
      >
        {displayUpdates.map(item => (
          <GroupUpdateBubble
            key={item.id}
            item={item}
            isDark={isDark}
            onAddStory={onAddStory}
            onPress={(pressedItem) => {
              onOpenProfile(null);
              onOpenStory(pressedItem);
            }}
            onLongPress={() => {
              onOpenStory(null);
              onOpenProfile({
                name: item.name,
                img:  item.img,
                // [FIX LOW] item.text can be null/undefined; `?.substring` returns undefined,
                // and `undefined + '...'` = `'undefined...'`. Guard explicitly.
                intent: item.text ? item.text.substring(0, 30) + '...' : '',
              });
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
};

export default memo(GroupUpdatesBar);

const localStyles = StyleSheet.create({
  barContainerDark: { backgroundColor: '#0a0a0a' },
  intentionAddBtnDark: { backgroundColor: '#1C1C1E' },
  intentionLabelDark: { color: '#ddd' },
});