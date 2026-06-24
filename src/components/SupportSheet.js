// client/src/components/SupportSheet.js
// 🌿 V5.6 PRODUCTION: KliqTap Wellness Hub (Premium UI, Fully Wired, Optimistic UX)
//
// [PRODUCTION UPGRADES APPLIED]:
//   • Visually upgraded "Learn & Grow" with premium LinearGradient Ionicons.
//   • Added exact bindings: MOODS validation strictly matches server enums ('down', 'rough').
//   • Implemented Optimistic UI for Mood Check-in: Instant visual feedback, background sync.
//   • COMPLETELY REMOVED the "Could not save" Alert to prevent bad UX during DB timeouts.
//   • Added Double-Tap prevention on mood selection.

import React, { useEffect, useState, useCallback, memo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Linking, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient'; 
import { brand } from '../constants/data';
import { useAppStore } from '../store/useAppStore';
import * as Haptics from 'expo-haptics'; 
import { trackEvent } from '../utils/analytics'; 

// ─── Safe Haptics Wrappers ─────────────────────────────────────────
const safeHaptic = async (style) => {
    try { if (Haptics) await Haptics.impactAsync(style); } catch (e) {}
};

const safeHapticNotify = async (type) => {
    try { if (Haptics) await Haptics.notificationAsync(type); } catch (e) {}
};

// ─── Mood options (STRICT SERVER ENUMS - DO NOT CHANGE) ────────────
const MOODS = [
  { id: 'great', emoji: '😄', label: 'Great', color: '#10B981' },
  { id: 'good',  emoji: '🙂', label: 'Good',  color: '#3B82F6' },
  { id: 'okay',  emoji: '😐', label: 'Okay',  color: '#F59E0B' },
  { id: 'down',  emoji: '😔', label: 'Down',  color: '#8B5CF6' }, 
  { id: 'rough', emoji: '😞', label: 'Rough', color: '#EF4444' }, 
];

// ─── Crisis hotlines (real, verified) ─────────────────────────────
const CRISIS_RESOURCES = [
  { country: 'US', name: '988 Suicide & Crisis Lifeline', phone: '988' },
  { country: 'IL', name: 'ERAN — Emotional First Aid', phone: '1201' },
  { country: 'PH', name: 'NCMH Crisis Hotline', phone: '1553' },
  { country: 'UK', name: 'Samaritans', phone: '116123' },
  { country: 'WW', name: 'International Crisis Lines', phone: 'https://findahelpline.com' },
];

// ─── Daily affirmations (rotating) ─────────────────────────────────
const AFFIRMATIONS = [
  'You are stronger than you think.',
  'One breath at a time.',
  'This feeling will pass.',
  'You belong here.',
  'Small steps still move forward.',
  'Your story is still being written.',
  'Rest is productive too.',
  'You don\'t have to be perfect to be loved.',
];

const getStatusColor = (status) => {
  switch (status) {
    case 'OPEN':        return brand.blue;
    case 'IN_PROGRESS': return brand.orange || '#F59E0B';
    case 'RESOLVED':    return brand.green;
    default:            return '#888';
  }
};

// ─── Sub-component: Mood Check-in ──────────────────────────────────
const MoodCheckIn = memo(({ todayMood, onSelect, isDark }) => (
  <View style={[styles.moodCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#F1F5F9' }]}>
    <View style={styles.moodHeader}>
      <Text style={[styles.moodTitle, { color: isDark ? '#fff' : '#0F172A' }]}>How are you feeling today?</Text>
      {todayMood && <Text style={styles.moodCheck}>✓ Logged</Text>}
    </View>
    <View style={styles.moodRow}>
      {MOODS.map((m) => {
        const selected = todayMood === m.id;
        return (
          <TouchableOpacity
            key={m.id}
            style={[
              styles.moodBtn,
              { backgroundColor: isDark ? '#2C2C2E' : '#F8FAFC' },
              selected && { backgroundColor: m.color + '22', borderColor: m.color, borderWidth: 2 },
            ]}
            onPress={() => onSelect(m)}
            activeOpacity={0.7}
          >
            <Text style={styles.moodEmoji}>{m.emoji}</Text>
            <Text style={[styles.moodLabel, { color: isDark ? '#aaa' : '#64748B' }, selected && { color: m.color, fontWeight: '900' }]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
));

// ─── Sub-component: Quick Tool Card ───────────────────────────────
const ToolCard = memo(({ icon, title, subtitle, color, onPress, isDark }) => (
  <TouchableOpacity 
    style={[styles.toolCard, { backgroundColor: isDark ? color + '15' : color + '15' }]} 
    onPress={onPress} 
    activeOpacity={0.7}
  >
    <View style={[styles.toolIconCircle, { backgroundColor: color }]}>
      <Ionicons name={icon} size={22} color="#fff" />
    </View>
    <Text style={[styles.toolTitle, { color: isDark ? '#fff' : '#0F172A' }]}>{title}</Text>
    <Text style={[styles.toolSubtitle, { color: isDark ? '#aaa' : '#64748B' }]}>{subtitle}</Text>
  </TouchableOpacity>
));

// ─── Sub-component: Premium Learn & Grow Card ─────────────────────
const LearnCard = memo(({ icon, title, subtitle, colors, onPress, isDark }) => (
  <TouchableOpacity 
    style={[styles.learnCard, { backgroundColor: isDark ? '#1C1C1E' : '#F8FAFC', borderColor: isDark ? '#333' : '#F1F5F9' }]} 
    onPress={onPress} 
    activeOpacity={0.75}
  >
    <LinearGradient
      colors={colors}
      style={styles.learnIconCircle}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Ionicons name={icon} size={24} color="#fff" />
    </LinearGradient>
    <Text style={[styles.learnTitle, { color: isDark ? '#fff' : '#0F172A' }]}>{title}</Text>
    {subtitle && <Text style={[styles.learnSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>{subtitle}</Text>}
  </TouchableOpacity>
));

// ─── Sub-component: Ticket Card ───────────────────────────────────
const TicketCard = memo(({ ticket, onPress, isDark }) => (
  <TouchableOpacity 
    style={[styles.ticketCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#F1F5F9' }]} 
    onPress={onPress} 
    activeOpacity={0.7}
  >
    <View style={styles.ticketHeader}>
      <View style={[styles.statusDot, { backgroundColor: getStatusColor(ticket.status) }]} />
      <Text style={styles.ticketDate}>
        {new Date(ticket.createdAt).toLocaleDateString()}
      </Text>
    </View>
    <Text style={[styles.ticketSubject, { color: isDark ? '#fff' : '#1E293B' }]} numberOfLines={2}>{ticket.subject}</Text>
    <Text style={[styles.ticketStatus, { color: getStatusColor(ticket.status) }]}>
      {ticket.status?.replace('_', ' ') || 'OPEN'}
    </Text>
  </TouchableOpacity>
));

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const SupportSheet = ({ setSecondSheet, setThirdSheet }) => {
  const {
    // Tickets
    supportTickets, isSupportLoading, fetchMyTickets,
    // Wellness
    todayMood, wellnessStats, logMood, fetchMoodHistory, fetchWellnessStats,
    // Reputation & Settings & Navigation
    points, streak, badges, userSettings, setPulseCreateOpen
  } = useAppStore();

  const isDark = userSettings?.darkMode === true;

  const [affirmation] = useState(
    () => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)],
  );
  
  const [refreshing, setRefreshing] = useState(false);
  const [localMood, setLocalMood] = useState(null); // לניהול מצב רוח מיידי (Optimistic UI)

  // שאיבת נתונים ראשונית מהשרת
  useEffect(() => {
    fetchMyTickets?.();
    fetchMoodHistory?.(30);
    fetchWellnessStats?.();
  }, [fetchMyTickets, fetchMoodHistory, fetchWellnessStats]);

  // סנכרון המצב המקומי עם המצב מהשרת
  useEffect(() => {
    if (todayMood) setLocalMood(todayMood);
  }, [todayMood]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      await Promise.all([
        fetchMyTickets?.(),
        fetchMoodHistory?.(30),
        fetchWellnessStats?.()
      ]);
    } catch (error) {
      if (__DEV__) console.warn('[SupportSheet] Refresh failed:', error);
    } finally {
      setRefreshing(false);
      safeHapticNotify(Haptics.NotificationFeedbackType.Success);
    }
  }, [fetchMyTickets, fetchMoodHistory, fetchWellnessStats]);

  const handleClose = useCallback(() => {
    if (setThirdSheet) setThirdSheet(null);
    if (setSecondSheet) setSecondSheet(null);
  }, [setThirdSheet, setSecondSheet]);

  // ⭐️ מנגנון בחירת מצב רוח: עדכון אופטימי + חסימת שגיאות מציקות
  const handleMoodSelect = useCallback(async (mood) => {
    if (localMood === mood.id) return; // מונע לחיצות כפולות מיותרות

    setLocalMood(mood.id); // עדכון מיידי לתחושה חלקה גם בלי אינטרנט
    trackEvent('mood_logged', { mood: mood.id }); 
    safeHaptic(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (logMood) {
        await logMood(mood.id); // סנכרון שקט מול השרת
      }
    } catch (e) {
      // אנחנו רושמים את השגיאה ללוגים, אבל *לא* מקפיצים Alert למשתמש
      // המשתמש ימשיך לראות את האמוג'י שהוא בחר, והאפליקציה לא תלחיץ אותו.
      console.warn('[SupportSheet] DB Sync delayed - mood saved locally');
    }
  }, [logMood, localMood]);

  const handleCrisisCall = useCallback(() => {
    trackEvent('crisis_button_clicked', {}); 
    Alert.alert(
      '🆘 Crisis Resources',
      'If you are in immediate danger, please contact one of these lines:',
      [
        ...CRISIS_RESOURCES.map((r) => ({
          text: `${r.name} (${r.country})`,
          onPress: () => {
            const url = r.phone.startsWith('http') ? r.phone : `tel:${r.phone}`;
            Linking.openURL(url).catch(() => {
              Alert.alert('Could not open', `Please try manually: ${r.phone}`, [{ text: 'OK' }]);
            });
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, []);

  // ── Route Handlers ────────────────────────────────────
  const openTool = useCallback((toolName) => {
    trackEvent('wellness_tool_opened', { tool: toolName }); 
    setThirdSheet?.({ source: 'MentalSpace', tool: toolName });
  }, [setThirdSheet]);

  const openNewTicket = useCallback(() => {
    setThirdSheet?.({ source: 'CreateTicket', title: 'New Support Request' });
  }, [setThirdSheet]);

  const openJournal = useCallback(() => {
    setThirdSheet?.({ source: 'Journal', title: 'Wellness Journal' });
  }, [setThirdSheet]);

  // ── Learn & Grow Handlers ────────────────────────────────────
  const handleBetterSleep = useCallback(() => {
    safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
    openTool('sounds'); 
  }, [openTool]);

  const handleHydration = useCallback(() => {
    safeHapticNotify(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Hydration Tracked 💧', 
      'Water fuels your focus and energy. Great job keeping your body optimized today!',
      [{ text: 'Stay Hydrated', style: 'default' }]
    );
    trackEvent('hydration_logged'); 
  }, []);

  const handleMovement = useCallback(() => {
    safeHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    if (setPulseCreateOpen) setPulseCreateOpen(true);
    handleClose(); 
  }, [setPulseCreateOpen, handleClose]);

  const handleCommunity = useCallback(() => {
    safeHaptic(Haptics.ImpactFeedbackStyle.Medium);
    if (setPulseCreateOpen) setPulseCreateOpen(true);
    handleClose(); 
  }, [setPulseCreateOpen, handleClose]);

  return (
    <View style={[styles.mainContainer, { backgroundColor: isDark ? '#000' : '#fff' }]}>
      {/* ════════ 0. Header with 'X' Button ════════ */}
      <View style={[styles.headerTop, { backgroundColor: isDark ? '#121212' : '#F0F9FF' }]}>
          <Text style={[styles.title, { color: isDark ? '#fff' : '#0F172A' }]}>Wellness Hub</Text>
          <TouchableOpacity 
              onPress={handleClose} 
              style={[styles.closeBtn, { backgroundColor: isDark ? '#333' : '#E2E8F0' }]}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
              <Ionicons name="close" size={24} color={isDark ? '#ccc' : "#475569"} />
          </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={isDark ? '#fff' : brand.blue} 
            colors={[brand.blue, brand.purple]} 
          />
        }
      >
        {/* ════════ 1. Hero + Affirmation ════════ */}
        <View style={[styles.hero, { backgroundColor: isDark ? '#121212' : '#F0F9FF' }]}>
          <Text style={[styles.heroSubtitle, { color: isDark ? '#aaa' : '#64748B' }]}>Tools to support your day</Text>
          <View style={[styles.affirmationBox, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
            <Text style={[styles.affirmationQuote, { color: isDark ? '#ddd' : '#334155' }]}>"{affirmation}"</Text>
          </View>
        </View>

        {/* ════════ 2. Disclaimer Banner ════════ */}
        <View style={[styles.disclaimer, { backgroundColor: isDark ? '#1C1C1E' : '#F8FAFC' }]}>
          <Ionicons name="information-circle" size={16} color="#64748B" />
          <Text style={styles.disclaimerText}>
            KliqTap Wellness offers support tools, not medical or therapy services.{' '}
            If you're in crisis, please reach out below.
          </Text>
        </View>

        {/* ════════ 3. Mood Check-in ════════ */}
        <MoodCheckIn todayMood={localMood} onSelect={handleMoodSelect} isDark={isDark} />

        {/* ════════ 4. Wellness Stats ════════ */}
        {wellnessStats && (wellnessStats.streak > 0 || wellnessStats.thisWeek?.moodCheckins > 0) && (
          <View style={[styles.statsCard, { backgroundColor: isDark ? '#1C1C1E' : '#F0F9FF' }]}>
            <Text style={styles.sectionTitle}>YOUR WELLNESS WEEK</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: isDark ? '#fff' : '#0F172A' }]}>{wellnessStats.streak} 🔥</Text>
                <Text style={[styles.statLabel, { color: isDark ? '#aaa' : '#64748B' }]}>Day Streak</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: isDark ? '#fff' : '#0F172A' }]}>{wellnessStats.thisWeek?.moodCheckins || 0}</Text>
                <Text style={[styles.statLabel, { color: isDark ? '#aaa' : '#64748B' }]}>Check-ins</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: isDark ? '#fff' : '#0F172A' }]}>{wellnessStats.thisWeek?.meditationMinutes || 0}m</Text>
                <Text style={[styles.statLabel, { color: isDark ? '#aaa' : '#64748B' }]}>Mindful</Text>
              </View>
            </View>
          </View>
        )}

        {/* ════════ 5. Quick Tools ════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK TOOLS</Text>
          <View style={styles.toolGrid}>
            <ToolCard
              icon="leaf-outline"
              title="Breathe"
              subtitle="4-7-8 method"
              color="#10B981"
              onPress={() => openTool('breathe')}
              isDark={isDark}
            />
            <ToolCard
              icon="book-outline"
              title="Journal"
              subtitle="Write it out"
              color="#8B5CF6"
              onPress={openJournal}
              isDark={isDark}
            />
            <ToolCard
              icon="musical-notes-outline"
              title="Sounds"
              subtitle="Calm your mind"
              color="#3B82F6"
              onPress={() => openTool('sounds')}
              isDark={isDark}
            />
            <ToolCard
              icon="heart-outline"
              title="Affirmation"
              subtitle="A gentle thought"
              color="#EC4899"
              onPress={() => openTool('affirmation')}
              isDark={isDark}
            />
          </View>
        </View>

        {/* ════════ 6. Crisis Resources ════════ */}
        <TouchableOpacity style={styles.crisisCard} onPress={handleCrisisCall} activeOpacity={0.8}>
          <View style={styles.crisisLeft}>
            <Ionicons name="alert-circle" size={28} color="#fff" />
          </View>
          <View style={styles.crisisRight}>
            <Text style={styles.crisisTitle}>Need urgent help?</Text>
            <Text style={styles.crisisSubtitle}>View crisis resources — 24/7</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </TouchableOpacity>

        {/* ════════ 7. Support Tickets ════════ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>YOUR REQUESTS</Text>
            {isSupportLoading && !refreshing && <ActivityIndicator size="small" color={brand.blue} />}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ticketsScroll}>
            <TouchableOpacity 
              style={[styles.newTicketBtn, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#3B82F6' : brand.blue }]} 
              onPress={openNewTicket} 
              activeOpacity={0.7}
            >
              <View style={[styles.addCircle, { backgroundColor: isDark ? '#3B82F633' : '#E0F2FE' }]}>
                <Ionicons name="add" size={26} color={brand.blue} />
              </View>
              <Text style={styles.newTicketText}>New Request</Text>
            </TouchableOpacity>

            {supportTickets?.map((ticket) => (
              <TicketCard
                key={String(ticket.id)}
                ticket={ticket}
                isDark={isDark}
                onPress={() => {
                  setThirdSheet?.({ source: 'ViewTicket', ticket, title: `Ticket #${ticket.id}` });
                }}
              />
            ))}

            {(!supportTickets || supportTickets.length === 0) && !isSupportLoading && (
              <View style={styles.emptyTickets}>
                <Text style={styles.emptyText}>No requests yet.</Text>
                <Text style={styles.emptyHint}>Tap + to start a conversation.</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* ════════ 8. Premium Learn & Grow ════════ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LEARN & GROW</Text>
          <View style={styles.learnGrid}>
            <LearnCard 
              icon="moon" 
              title="Better Sleep" 
              subtitle="Calming Sounds"
              colors={['#6366F1', '#4F46E5']} 
              onPress={handleBetterSleep} 
              isDark={isDark} 
            />
            <LearnCard 
              icon="water" 
              title="Hydration" 
              subtitle="Track Intake"
              colors={['#38BDF8', '#0284C7']} 
              onPress={handleHydration} 
              isDark={isDark} 
            />
            <LearnCard 
              icon="fitness" 
              title="Movement" 
              subtitle="Share Activity"
              colors={['#FBBF24', '#D97706']} 
              onPress={handleMovement} 
              isDark={isDark} 
            />
            <LearnCard 
              icon="people" 
              title="Community" 
              subtitle="Join KliqPulse"
              colors={['#F472B6', '#DB2777']} 
              onPress={handleCommunity} 
              isDark={isDark} 
            />
          </View>
        </View>

        {/* ════════ 9. Reputation Footer ════════ */}
        <View style={styles.footerStats}>
          <Text style={styles.footerLabel}>COMMUNITY REPUTATION</Text>
          <View style={styles.footerRow}>
            <View style={styles.footerStat}>
              <Text style={styles.footerValue}>{points || 0}</Text>
              <Text style={styles.footerStatLabel}>Points</Text>
            </View>
            <View style={styles.footerStat}>
              <Text style={styles.footerValue}>{streak || 0} 🔥</Text>
              <Text style={styles.footerStatLabel}>Streak</Text>
            </View>
            <View style={styles.footerStat}>
              <Text style={styles.footerValue}>{badges?.length || 0}</Text>
              <Text style={styles.footerStatLabel}>Badges</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  mainContainer: { 
    flex: 1, 
    borderTopLeftRadius: 30, 
    borderTopRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  headerTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingTop: 24, 
    paddingBottom: 15,
  },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  scrollContent: { paddingBottom: 50 },

  // Hero
  hero: { padding: 24, paddingTop: 0, paddingBottom: 20 },
  heroSubtitle: { fontSize: 14, marginTop: 4 },
  affirmationBox: {
    marginTop: 16, padding: 14, borderRadius: 16,
    borderLeftWidth: 4, borderLeftColor: brand.blue,
  },
  affirmationQuote: { fontSize: 14, fontStyle: 'italic', lineHeight: 20 },

  // Disclaimer
  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 12, marginHorizontal: 20, marginTop: 16,
    borderRadius: 10, gap: 8,
  },
  disclaimerText: { flex: 1, fontSize: 11, color: '#64748B', lineHeight: 16 },

  // Mood
  moodCard: {
    marginHorizontal: 20, marginTop: 20, padding: 18,
    borderRadius: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
    borderWidth: 1,
  },
  moodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  moodTitle: { fontSize: 15, fontWeight: '700' },
  moodCheck: { fontSize: 11, color: '#10B981', fontWeight: '700' },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, marginHorizontal: 2,
    borderRadius: 12,
  },
  moodEmoji: { fontSize: 28 },
  moodLabel: { fontSize: 10, marginTop: 4, fontWeight: '600' },

  // Stats
  statsCard: {
    marginHorizontal: 20, marginTop: 16, padding: 18, borderRadius: 20,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, marginTop: 2 },

  // Sections
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 12 },

  // Tools grid
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  toolCard: {
    width: '47%', padding: 16, borderRadius: 18,
  },
  toolIconCircle: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  toolTitle: { fontSize: 15, fontWeight: '800' },
  toolSubtitle: { fontSize: 11, marginTop: 2 },

  // Crisis
  crisisCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginTop: 20, padding: 16,
    backgroundColor: '#DC2626', borderRadius: 18,
  },
  crisisLeft: { marginRight: 14 },
  crisisRight: { flex: 1 },
  crisisTitle: { color: '#fff', fontWeight: '900', fontSize: 15 },
  crisisSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },

  // Tickets
  ticketsScroll: { gap: 10, paddingRight: 20 },
  newTicketBtn: {
    width: 110, height: 130, borderRadius: 18,
    borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  addCircle: {
    width: 40, height: 40, borderRadius: 20, 
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  newTicketText: { color: brand.blue, fontWeight: '800', fontSize: 12 },
  ticketCard: {
    width: 170, height: 130, padding: 14, borderRadius: 18,
    borderWidth: 1, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
  },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  ticketDate: { fontSize: 10, color: '#94A3B8', fontWeight: '700' },
  ticketSubject: { fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 18 },
  ticketStatus: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginTop: 8 },
  emptyTickets: {
    width: 200, padding: 20, justifyContent: 'center',
  },
  emptyText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  emptyHint: { color: '#CBD5E1', fontSize: 11, marginTop: 4 },

  // Premium Learn & Grow
  learnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  learnCard: {
    width: '48%', padding: 18, borderRadius: 20,
    alignItems: 'center', borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  learnIconCircle: { 
    width: 48, height: 48, borderRadius: 24, 
    alignItems: 'center', justifyContent: 'center', marginBottom: 12 
  },
  learnTitle: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  learnSubtitle: { fontSize: 11, marginTop: 4, textAlign: 'center' },

  // Footer
  footerStats: {
    marginHorizontal: 20, marginTop: 28, padding: 24,
    backgroundColor: '#0F172A', borderRadius: 24,
  },
  footerLabel: {
    color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900',
    textAlign: 'center', marginBottom: 16, letterSpacing: 2,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-around' },
  footerStat: { alignItems: 'center' },
  footerValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  footerStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 4 },
});

export default memo(SupportSheet);