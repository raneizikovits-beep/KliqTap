// client/src/components/modals/PremiumUpgradeSheet.js
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Platform } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import BaseSheet from './BaseSheet';
import { brand } from '../../constants/data';
import { useAppStore } from '../../store/useAppStore';

const { width } = Dimensions.get('window');

export default function PremiumUpgradeSheet({ visible, onClose }) {
    const { userSettings } = useAppStore();
    const isDark = userSettings?.darkMode === true;

    // ⭐️ אנימציות לכניסה חלקה של כרטיס הפרימיום ⭐️
    const scaleAnim = useRef(new Animated.Value(0.95)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
                Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true })
            ]).start();
        } else {
            scaleAnim.setValue(0.95);
            opacityAnim.setValue(0);
        }
    }, [visible]);

    if (!visible) return null;

    const themeBg = isDark ? '#0F0F13' : '#FFFFFF';
    const textColor = isDark ? '#FFFFFF' : '#111111';
    const subTextColor = isDark ? '#8E8E93' : '#666666';
    const cardBg = isDark ? '#1C1C1E' : '#F9FAFB';

    return (
        <BaseSheet visible={visible} onClose={onClose} isDark={isDark}>
            <Animated.View style={[styles.container, { backgroundColor: themeBg, opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>

                {/* --- Header --- */}
                <View style={styles.header}>
                    <View style={styles.iconWrap}>
                        <FontAwesome5 name="crown" size={32} color="#FFD700" />
                    </View>
                    <Text style={[styles.title, { color: textColor }]}>KliqTap Premium</Text>
                    <Text style={[styles.subtitle, { color: subTextColor }]}>Unlock your ultimate social power.</Text>
                </View>

                {/* --- Features List --- */}
                <View style={styles.featuresList}>
                    <View style={[styles.featureCard, { backgroundColor: cardBg }]}>
                        <View style={[styles.featureIcon, { backgroundColor: 'rgba(255, 215, 0, 0.15)' }]}>
                            <FontAwesome5 name="crown" size={16} color="#FFD700" />
                        </View>
                        <View style={styles.featureTextWrap}>
                            <Text style={[styles.featureTitle, { color: textColor }]}>The KliqKing Badge</Text>
                            <Text style={[styles.featureDesc, { color: subTextColor }]}>Stand out in the feed with an exclusive gold crown next to your name.</Text>
                        </View>
                    </View>

                    <View style={[styles.featureCard, { backgroundColor: cardBg }]}>
                        <View style={[styles.featureIcon, { backgroundColor: 'rgba(131, 56, 236, 0.15)' }]}>
                            <Ionicons name="sparkles" size={18} color="#8338EC" />
                        </View>
                        <View style={styles.featureTextWrap}>
                            <Text style={[styles.featureTitle, { color: textColor }]}>Unlimited KliqMind AI</Text>
                            <Text style={[styles.featureDesc, { color: subTextColor }]}>Bypass daily limits. Use the Oracle, Vibe Translator, and Auto-Wingman anytime.</Text>
                        </View>
                    </View>
                </View>

                {/* --- Pricing --- */}
                <View style={styles.pricingWrap}>
                    <Text style={[styles.price, { color: textColor }]}>₱99 <Text style={[styles.pricePeriod, { color: subTextColor }]}>/ month</Text></Text>
                    <Text style={[styles.priceNote, { color: subTextColor }]}>Cancel anytime. No hidden fees.</Text>
                </View>

                {/* --- Payment Actions --- */}
                <View style={styles.paymentActions}>
                    <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.8} onPress={() => alert('Google/Apple Pay Integration Pending')}>
                        <LinearGradient colors={['#8338EC', '#FF006E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGradient}>
                            <Text style={styles.primaryBtnText}>Upgrade Now</Text>
                            <Ionicons name="flash" size={18} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.localPaymentsRow}>
                        <TouchableOpacity style={[styles.localBtn, { backgroundColor: '#0052FE' }]} activeOpacity={0.8} onPress={() => alert('GCash Integration Pending')}>
                            <Text style={styles.localBtnText}>Pay with GCash</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.localBtn, { backgroundColor: '#131A22' }]} activeOpacity={0.8} onPress={() => alert('Maya Integration Pending')}>
                            <Text style={styles.localBtnText}>Pay with Maya</Text>
                        </TouchableOpacity>
                    </View>
                </View>

            </Animated.View>
        </BaseSheet>
    );
}

const styles = StyleSheet.create({
    container: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 10 },
    header: { alignItems: 'center', marginBottom: 30 },
    iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255, 215, 0, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)' },
    title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
    subtitle: { fontSize: 15, fontWeight: '500', textAlign: 'center' },
    featuresList: { gap: 12, marginBottom: 30 },
    featureCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(128,128,128,0.1)' },
    featureIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    featureTextWrap: { flex: 1 },
    featureTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
    featureDesc: { fontSize: 13, lineHeight: 18 },
    pricingWrap: { alignItems: 'center', marginBottom: 24 },
    price: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
    pricePeriod: { fontSize: 16, fontWeight: '600' },
    priceNote: { fontSize: 12, marginTop: 4 },
    paymentActions: { gap: 12 },
    primaryBtn: { borderRadius: 16, overflow: 'hidden', shadowColor: '#FF006E', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
    primaryBtnGradient: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
    localPaymentsRow: { flexDirection: 'row', gap: 10 },
    localBtn: { flex: 1, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    localBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' }
});