// client/src/components/Header.js
// ⭐️ PRODUCTION GRADE: Ultra-Clean JSX + Smaller Elegant Icons ⭐️
// ⭐️ SECURITY: Exact 10-second timer for Admin access, browser-safe ⭐️

import React, { memo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; 
import { useNavigation } from '@react-navigation/native';
import { brand } from '../constants/data';
import { useAppStore } from '../store/useAppStore'; 

const Header = ({ openSettings, openSearch, openSupport, openRadar, openLeaderboard }) => {
  const settings = useAppStore(state => state.userSettings || {});
  const isDark = settings.darkMode === true;
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  // ----- מנגנון טיימר מדויק ל-10 שניות -----
  const timerRef = useRef(null);

  const handlePressIn = () => {
    timerRef.current = setTimeout(() => {
      navigation.navigate('AdminNotice');
    }, 10000); // 10,000 מילישניות = 10 שניות בדיוק
  };

  const handlePressOut = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  // ------------------------------------------

  const headerBg = isDark ? '#000' : '#fff';
  const borderColor = isDark ? '#222' : '#f5f5f5';
  const iconBtnBg = isDark ? '#1C1C1E' : '#F5F7FA';
  const iconColor = isDark ? '#fff' : '#333';
  const logoKliqColor = isDark ? '#fff' : brand.blue;

  return (
    <View style={[localStyles.headerContainer, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
      <View style={localStyles.contentRow}>
        
        <TouchableOpacity 
          style={localStyles.logoSection}
          activeOpacity={1} 
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <View style={localStyles.logoIconBg}>
            <Ionicons name="scan-outline" size={18} color="#fff" />
          </View>
          <View style={localStyles.logoTextContainer}>
            <Text style={[localStyles.logoKliq, { color: logoKliqColor }]}>KliQ</Text>
            <Text style={localStyles.logoTap}>Tap</Text>
          </View>
        </TouchableOpacity>

        <View style={localStyles.actionsRow}>
          <TouchableOpacity
            onPress={openRadar}
            style={localStyles.radarBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open Radar"
          >
            <MaterialCommunityIcons name="radar" size={18} color="#fff" />
            {width > 395 && <Text style={localStyles.radarText}>Live</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openLeaderboard}
            style={[localStyles.iconBtn, { backgroundColor: iconBtnBg }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open Leaderboard"
          >
            <MaterialCommunityIcons name="crown" size={20} color="#FFD700" />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={openSupport}
            style={[localStyles.iconBtn, { backgroundColor: iconBtnBg }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open Support"
          >
            <Ionicons name="heart-circle-outline" size={21} color={iconColor} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={openSearch}
            style={[localStyles.iconBtn, { backgroundColor: iconBtnBg }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open Search"
          >
            <Ionicons name="search-outline" size={19} color={iconColor} />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={openSettings}
            style={[localStyles.iconBtn, { backgroundColor: iconBtnBg }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
          >
            <Ionicons name="settings-outline" size={19} color={iconColor} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default memo(Header);

const localStyles = StyleSheet.create({
    headerContainer: {
        paddingTop: Platform.OS === 'android' ? 10 : 0, 
        paddingBottom: 10, 
        paddingHorizontal: 4, 
        borderBottomWidth: 1,
        elevation: 2, 
        zIndex: 100,
    },
    contentRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        height: 50 
    },
    logoSection: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginLeft: 4 
    },
    logoIconBg: { 
        width: 32, 
        height: 32, 
        borderRadius: 10, 
        backgroundColor: brand.blue, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginRight: 6 
    },
    logoTextContainer: { 
        flexDirection: 'row', 
        alignItems: 'baseline' 
    },
    logoKliq: { 
        fontSize: 20, 
        fontWeight: '900', 
        letterSpacing: -0.8 
    },
    logoTap: { 
        fontSize: 20, 
        fontWeight: '300', 
        color: brand.orange, 
        letterSpacing: -0.8 
    },
    actionsRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 6, 
        flexShrink: 1, 
        paddingRight: 4 
    },
    iconBtn: { 
        width: 34, 
        height: 34, 
        borderRadius: 10, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    radarBtn: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#FF2D55', 
        paddingVertical: 6, 
        paddingHorizontal: 10, 
        borderRadius: 10 
    },
    radarText: { 
        color: '#fff', 
        fontWeight: '800', 
        marginLeft: 4, 
        fontSize: 10 
    }
});