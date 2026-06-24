// client/src/components/modals/SheetComponents.js
// ⭐️ V3.6 PRODUCTION: CHROMATIC GRID PALETTE + BULLETPROOF PROP SCANNER ⭐️
//
// [V3.6 CHANGES — Engineering Audit Fix]:
//   [FIX CRITICAL] SettingItem only ever destructured flat `icon`/`title`/`body`
//                  props — but EVERY call site across SheetModals.js (SecondSheet,
//                  ThirdSheet, FourthSheet, FifthSheet — i.e. the entire Settings/
//                  Search/Support/ticket drill-down navigation system) invokes it
//                  as `<SettingItem item={item} onPress={...} isDark={isDark} />`,
//                  passing the whole item as a SINGLE prop named `item`. Since
//                  SettingItem never read `props.item`, every single row rendered
//                  with no icon, no title, and no body — a stack of blank, silent,
//                  but still-tappable ghost rows across nearly every menu in the app.
//                  GridItem (right below, in this same file) already had the
//                  correct "smart scanner" extraction logic for this exact
//                  calling convention — SettingItem was simply missed when that
//                  fix was applied. Now mirrors the same pattern.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../../constants/data';

// פונקציית עזר לזיהוי שמות של אייקוני Ionicons לעומת אמוג'ים
const isIoniconName = (icon) =>
    typeof icon === 'string' && /^[a-z][a-z0-9-]*$/.test(icon);

// מנגנון חלוקת צבעים אקזוטיים אוטומטית למניעת כפילויות צבעים
const getDeterministicColor = (str, isDark) => {
    let hash = 0;
    const stringToHash = String(str || 'default_vibe');
    for (let i = 0; i < stringToHash.length; i++) {
        hash = stringToHash.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 6;
    
    const palette = [
        { bg: isDark ? 'rgba(255, 0, 110, 0.2)' : '#FFE5EC', color: '#FF006E' }, // ורוד מגנטה אקזוטי
        { bg: isDark ? 'rgba(255, 94, 0, 0.2)' : '#FFEDE5', color: '#FF5E00' },  // כתום תנועה אנרגטי
        { bg: isDark ? 'rgba(58, 134, 255, 0.2)' : '#EBF2FF', color: '#3A86FF' }, // כחול רויאל
        { bg: isDark ? 'rgba(131, 56, 236, 0.2)' : '#F3E9FF', color: '#8338EC' }, // סגול אולטרה
        { bg: isDark ? 'rgba(0, 245, 212, 0.15)' : '#E5FAF6', color: '#00F5D4' }, // טורקיז זוהר
        { bg: isDark ? 'rgba(46, 196, 182, 0.2)' : '#EAF9F7', color: '#2EC4B6' }  // ירוק מנטה אקזוטי
    ];
    return palette[index];
};

// מפת צבעים מותאמת אישית לפי סוגי הפיצ'רים והאייקונים
const getGridColors = (title, icon, isDark) => {
    const combinedText = String(title || icon || '').toLowerCase();
    
    // קריוקי / מוזיקה
    if (combinedText.includes('sing') || combinedText.includes('karaoke') || combinedText.includes('שיר') || combinedText.includes('קריוקי') || combinedText.includes('musical') || combinedText.includes('mic')) {
        return { bg: isDark ? 'rgba(255, 0, 110, 0.2)' : '#FFE5EC', color: '#FF006E' };
    }
    // אתגר ריקוד
    if (combinedText.includes('dance') || combinedText.includes('ריקוד') || combinedText.includes('אתגר') || combinedText.includes('flame')) {
        return { bg: isDark ? 'rgba(255, 94, 0, 0.2)' : '#FFEDE5', color: '#FF5E00' };
    }
    // סטודיו צילום / מצלמה
    if (combinedText.includes('photo') || combinedText.includes('studio') || combinedText.includes('צילום') || combinedText.includes('תמונ') || combinedText.includes('camera') || combinedText.includes('image')) {
        return { bg: isDark ? 'rgba(58, 134, 255, 0.2)' : '#EBF2FF', color: '#3A86FF' };
    }
    // קליפים קוליים
    if (combinedText.includes('voice') || combinedText.includes('קול') || combinedText.includes('שמע') || combinedText.includes('speak') || combinedText.includes('recording')) {
        return { bg: isDark ? 'rgba(0, 245, 212, 0.15)' : '#E5FAF6', color: '#00F5D4' };
    }
    // וידאו לאב / סרטונים
    if (combinedText.includes('video') || combinedText.includes('סרטון') || combinedText.includes('מעבד') || combinedText.includes('play') || combinedText.includes('film')) {
        return { bg: isDark ? 'rgba(131, 56, 236, 0.2)' : '#F3E9FF', color: '#8338EC' };
    }
    // סיפורים / טקסטים
    if (combinedText.includes('story') || combinedText.includes('סיפור') || combinedText.includes('כתב') || combinedText.includes('pencil') || combinedText.includes('book') || combinedText.includes('text')) {
        return { bg: isDark ? 'rgba(255, 190, 11, 0.2)' : '#FFF9E6', color: '#FFBE0B' };
    }
    // צ'אט
    if (combinedText.includes('chat') || combinedText.includes('talk') || combinedText.includes('צ\'אט') || combinedText.includes('people')) {
        return { bg: isDark ? 'rgba(0, 180, 216, 0.2)' : '#E6F7FF', color: '#00B4D8' };
    }
    // שידור חי
    if (combinedText.includes('live') || combinedText.includes('שידור') || combinedText.includes('radio') || combinedText.includes('broadcast')) {
        return { bg: isDark ? 'rgba(230, 57, 70, 0.2)' : '#FFEBEB', color: '#E63946' };
    }
    // סקרים
    if (combinedText.includes('poll') || combinedText.includes('vote') || combinedText.includes('סקר') || combinedText.includes('analytics') || combinedText.includes('list')) {
        return { bg: isDark ? 'rgba(46, 196, 182, 0.2)' : '#EAF9F7', color: '#2EC4B6' };
    }
    
    // אם לא נמצא קיוורד מדויק, מחזירים גוון דינמי מרהיב במקום הצהוב הקבוע
    return getDeterministicColor(combinedText, isDark);
};

export const SettingItem = (props) => {
    const { onPress, isDark } = props;

    // [FIX CRITICAL] Mirrors GridItem's existing "smart scanner" below — every
    // call site across SheetModals.js passes `item={item}`, not flat props.
    // Falls back to flat icon/title/body props too, so this stays backward
    // compatible with any caller that DOES pass them directly.
    let finalIcon  = props.icon  || '';
    let finalTitle = props.title || '';
    let finalBody  = props.body  || '';

    if (props.item && typeof props.item === 'object') {
        finalIcon  = props.item.icon  || finalIcon;
        finalTitle = props.item.title || props.item.label || props.item.text || props.item.name || finalTitle;
        finalBody  = props.item.body  || props.item.subtitle || props.item.description || finalBody;
    }

    const useIonicon = isIoniconName(finalIcon);

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
                    <Ionicons name={finalIcon} size={22} color={isDark ? '#4DA8DA' : brand.blue} />
                ) : (
                    <Text style={styles.emojiIcon}>{finalIcon}</Text>
                )}
            </View>

            <View style={styles.textContainer}>
                <Text style={[styles.itemTitle, { color: isDark ? '#fff' : '#333' }]}>{finalTitle}</Text>
                {finalBody ? (
                    <Text style={[styles.itemBody, { color: isDark ? '#aaa' : '#888' }]} numberOfLines={1}>{finalBody}</Text>
                ) : null}
            </View>

            <Ionicons name="chevron-forward" size={18} color={isDark ? '#666' : '#ccc'} />
        </TouchableOpacity>
    );
};

export const GridItem = (props) => {
    const isDark = props.isDark;
    const onPress = props.onPress;
    
    // ⭐️ מנגנון סריקה חכם שמחלץ את המידע מכל וריאציה אפשרית של אובייקטים ⭐️
    let finalTitle = props.title || '';
    let finalIcon = props.icon || '';
    
    if (props.item && typeof props.item === 'object') {
        finalTitle = props.item.title || props.item.label || props.item.text || props.item.name || finalTitle;
        finalIcon = props.item.icon || props.item.name || finalIcon;
        
        // רשת ביטחון שלישית: מוצאת את שדה הסטרינג הראשון באובייקט שאיננו האייקון
        if (!finalTitle) {
            for (const key in props.item) {
                if (typeof props.item[key] === 'string' && key !== 'icon' && props.item[key].length > 1) {
                    finalTitle = props.item[key];
                    break;
                }
            }
        }
    }
    
    const useIonicon = isIoniconName(finalIcon);
    const colors = getGridColors(finalTitle, finalIcon, isDark);

    return (
        <TouchableOpacity 
            style={[styles.gridItem, { 
                backgroundColor: isDark ? '#1C1C1E' : '#fff', 
                borderColor: isDark ? '#333' : '#f0f0f0' 
            }]} 
            onPress={onPress} 
            activeOpacity={0.8}
        >
            <View style={[styles.gridIconCircle, { backgroundColor: colors.bg }]}>
                {useIonicon ? (
                    <Ionicons name={finalIcon} size={28} color={colors.color} />
                ) : (
                    <Text style={styles.gridEmoji}>{finalIcon}</Text>
                )}
            </View>
            <Text style={[styles.gridTitle, { color: isDark ? '#fff' : '#333' }]}>{finalTitle}</Text>
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