// client/src/components/SupportSheet.js
// ⭐️ ULTIMATE CONCIERGE VERSION: Real-time Tickets, Modern UI & Wellness Hub ⭐️

import React, { useEffect, memo } from 'react';
import { 
    View, Text, ScrollView, TouchableOpacity, 
    StyleSheet, ActivityIndicator, Alert 
} from 'react-native';
import { brand } from '../constants/data';
import { SupportCard } from '../components/CommonComponents'; 
import { useAppStore } from '../store/useAppStore';
import { Ionicons } from '@expo/vector-icons';

const SupportSheet = ({ setSecondSheet, setThirdSheet }) => {
  // חיבור ללוגיקה החדשה ב-Store
  const { 
      points, streak, badges, 
      supportTickets, isSupportLoading, fetchMyTickets 
  } = useAppStore();

  // טעינת הפניות מהשרת ברגע שהמסך נפתח[cite: 11]
  useEffect(() => { 
      if (fetchMyTickets) fetchMyTickets(); 
  }, [fetchMyTickets]);

  // פונקציית עזר לצבעי סטטוס[cite: 11]
  const getStatusColor = (status) => {
    switch (status) {
        case 'OPEN': return brand.blue;
        case 'IN_PROGRESS': return brand.orange;
        case 'RESOLVED': return brand.green;
        default: return '#888';
    }
  };

  return (
    <ScrollView 
        contentContainerStyle={localStyles.scrollContent}
        showsVerticalScrollIndicator={false}
    >
      {/* ⭐️ 1. HERO SECTION: Welcome & Branding ⭐️ */}
      <View style={localStyles.hero}>
        <View style={localStyles.heroTextWrapper}>
            <Text style={localStyles.heroTitle}>KliqTap Concierge</Text>
            <Text style={localStyles.heroSub}>Your premium support and wellness hub.</Text>
        </View>
        <Ionicons name="shield-checkmark" size={60} color="rgba(33, 150, 243, 0.1)" style={localStyles.heroIcon} />
      </View>

      {/* ⭐️ 2. MY REQUESTS: Horizontal Ticket Tracking ⭐️ */}
      <View style={localStyles.sectionWrapper}>
        <View style={localStyles.sectionHeader}>
            <Text style={localStyles.sectionTitle}>ACTIVE REQUESTS</Text>
            {isSupportLoading && <ActivityIndicator size="small" color={brand.blue} />}
        </View>
        
        <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={localStyles.horizontalScroll}
            contentContainerStyle={localStyles.horizontalContent}
        >
            {/* כפתור פתיחת פנייה חדשה[cite: 11] */}
            <TouchableOpacity 
                style={localStyles.newTicketBtn}
                onPress={() => setThirdSheet({ 
                    source: "CreateTicket", 
                    title: "New Support Request" 
                })}
            >
                <View style={localStyles.addIconCircle}>
                    <Ionicons name="add" size={28} color={brand.blue} />
                </View>
                <Text style={localStyles.newTicketText}>New Request</Text>
            </TouchableOpacity>

            {/* רשימת פניות קיימות[cite: 11] */}
            {supportTickets && supportTickets.map((ticket) => (
                <TouchableOpacity 
                    key={String(ticket.id)} 
                    style={localStyles.ticketCard}
                    onPress={() => setThirdSheet({ 
                        source: "TicketDetails", 
                        ticket: ticket, 
                        title: "Request Details" 
                    })}
                >
                    <View style={localStyles.ticketHeader}>
                        <View style={[localStyles.statusDot, { backgroundColor: getStatusColor(ticket.status) }]} />
                        <Text style={localStyles.ticketDate}>
                            {new Date(ticket.createdAt).toLocaleDateString()}
                        </Text>
                    </View>
                    <Text style={localStyles.ticketSubject} numberOfLines={2}>{ticket.subject}</Text>
                    <View style={localStyles.statusBadge}>
                        <Text style={[localStyles.statusText, { color: getStatusColor(ticket.status) }]}>
                            {ticket.status.replace('_', ' ')}
                        </Text>
                    </View>
                </TouchableOpacity>
            ))}

            {supportTickets?.length === 0 && !isSupportLoading && (
                <View style={localStyles.emptyTicketsBox}>
                    <Text style={localStyles.emptyText}>No active requests found.</Text>
                </View>
            )}
        </ScrollView>
      </View>

      {/* ⭐️ 3. WELLNESS & SAFETY: Deep Resources ⭐️ */}
      <View style={localStyles.sectionWrapper}>
        <Text style={localStyles.sectionTitle}>WELLNESS & SAFETY</Text>
        <View style={localStyles.toolsGrid}>
            <SupportCard 
                title="Mental Health Support" 
                desc="Breathe, focus, and find your center." 
                // ⭐️ התיקון הקריטי: זה פותח את המרחב המנטלי (SupportScreen) ⭐️
                onPress={() => setThirdSheet({ source: "MentalSpace" })} 
            />
            <SupportCard 
                title="Privacy & Safety" 
                desc="Review blocked users and security settings." 
                onPress={() => setThirdSheet({ title: "Privacy Center", body: "Manage your safety settings here." })} 
            />
            <SupportCard 
                title="Crisis Resources" 
                desc="24/7 emergency hotlines and local help." 
                onPress={() => Alert.alert("Emergency Hotlines", "National crisis line: 988\n\nIf you are in immediate danger, please call your local emergency number.")} 
            />
            <SupportCard 
                title="Community Guidelines" 
                desc="Learn how we keep KliqTap a kind place." 
                onPress={() => Alert.alert("Guidelines", "Loading legal documents...")} 
            />
        </View>
      </View>

      {/* ⭐️ 4. REPUTATION SUMMARY ⭐️ */}
      <View style={localStyles.footerStats}>
        <Text style={localStyles.footerLabel}>COMMUNITY REPUTATION</Text>
        <View style={localStyles.statsRow}>
            <View style={localStyles.statItem}>
                <Text style={localStyles.statValue}>{points}</Text>
                <Text style={localStyles.statLabel}>Points</Text>
            </View>
            <View style={localStyles.statItem}>
                <Text style={localStyles.statValue}>{streak} 🔥</Text>
                <Text style={localStyles.statLabel}>Streak</Text>
            </View>
            <View style={localStyles.statItem}>
                <Text style={localStyles.statValue}>{badges?.length || 0}</Text>
                <Text style={localStyles.statLabel}>Badges</Text>
            </View>
        </View>
      </View>
      
      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

// --- STYLES ---[cite: 11]
const localStyles = StyleSheet.create({
  scrollContent: { paddingBottom: 50, backgroundColor: '#fff' },
  hero: { 
      padding: 30, backgroundColor: '#F4F9FF', borderBottomRightRadius: 50, 
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden'
  },
  heroTextWrapper: { flex: 1, zIndex: 2 },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.5 },
  heroSub: { fontSize: 15, color: '#666', marginTop: 6, lineHeight: 20 },
  heroIcon: { position: 'absolute', right: -10, bottom: -10 },
  sectionWrapper: { marginTop: 30, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#BBB', letterSpacing: 1.5 },
  horizontalScroll: { marginHorizontal: -20 },
  horizontalContent: { paddingHorizontal: 20, gap: 12 },
  newTicketBtn: { 
      width: 120, height: 140, borderRadius: 24, backgroundColor: '#fff', 
      borderStyle: 'dashed', borderWidth: 2, borderColor: brand.blue, 
      justifyContent: 'center', alignItems: 'center' 
  },
  addIconCircle: { 
      width: 44, height: 44, borderRadius: 22, backgroundColor: '#E3F2FD', 
      justifyContent: 'center', alignItems: 'center', marginBottom: 10 
  },
  newTicketText: { color: brand.blue, fontWeight: '800', fontSize: 13 },
  ticketCard: { 
      width: 180, height: 140, borderRadius: 24, backgroundColor: '#fff', 
      padding: 18, elevation: 5, shadowColor: '#000', shadowOpacity: 0.08, 
      shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, borderWidth: 1, borderColor: '#F0F0F0'
  },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  ticketDate: { fontSize: 11, color: '#AAA', fontWeight: '600' },
  ticketSubject: { fontWeight: '700', fontSize: 15, color: '#333', lineHeight: 20, flex: 1 },
  statusBadge: { marginTop: 'auto' },
  statusText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  emptyTicketsBox: { justifyContent: 'center', paddingLeft: 10 },
  emptyText: { color: '#999', fontStyle: 'italic', fontSize: 13 },
  toolsGrid: { gap: 12 },
  footerStats: { 
      marginTop: 40, marginHorizontal: 20, padding: 25, backgroundColor: '#1A1A1A', 
      borderRadius: 30, elevation: 10 
  },
  footerLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', textAlign: 'center', marginBottom: 20, letterSpacing: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 }
});

export default memo(SupportSheet);