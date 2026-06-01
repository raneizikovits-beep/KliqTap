// client/src/components/TabBar.js
// ⭐️ FULL DARK MODE COMPATIBLE + MOBILE WEB OPTIMIZED ⭐️

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import { useAppStore } from '../store/useAppStore'; 

const getIconName = (type, active) => {
    switch (type) {
        case "home": return active ? "home" : "home-outline";
        case "explore": return active ? "compass" : "compass-outline";
        case "groups": return active ? "people" : "people-outline"; 
        case "arena": return active ? "trophy" : "trophy-outline"; // ✅ שונה מ-camera ל-arena
        case "messages": return active ? "chatbubble" : "chatbubble-outline";
        case "notifications": return active ? "notifications" : "notifications-outline";
        case "profile": return active ? "person" : "person-outline";
        default: return "square-outline";
    }
};

const TabBtn = ({ label, active, onPress, onExtra, type }) => {
  const settings = useAppStore(state => state.userSettings || {});
  const isDark = settings.darkMode === true;

  const iconName = getIconName(type, active);
  
  const activeIconColor = isDark ? '#000' : '#fff'; 
  const inactiveIconColor = isDark ? '#888' : '#999';
  const activeBgColor = isDark ? '#fff' : '#222'; 
  
  const iconColor = active ? activeIconColor : inactiveIconColor;

  return (
    <TouchableOpacity 
        onPress={onPress} 
        onLongPress={onExtra} 
        style={localStyles.tabBtn}
        activeOpacity={0.7}
    >
      <View style={[
          localStyles.iconContainer, 
          active && localStyles.activeContainer,
          active && { backgroundColor: activeBgColor },
          !active && isDark && { backgroundColor: 'transparent' } 
      ]}>
        <Ionicons name={iconName} size={22} color={iconColor} />
      </View>
      
      {!active && <Text style={[localStyles.label, { color: inactiveIconColor }]}>{label}</Text>}
    </TouchableOpacity>
  );
};

export default memo(TabBtn);

const localStyles = StyleSheet.create({
    tabBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18, 
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 2,
    },
    activeContainer: {
        transform: [{translateY: -5}], 
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    label: {
        fontSize: 9,
        fontWeight: '500',
    }
});