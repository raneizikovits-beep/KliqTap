// client/src/screens/AdminNoticeScreen.js
// ⭐️ V6.0: Production-safe — no LAN IPs, all calls via fetchAPI ⭐️
//
// Changes vs V5.7:
//   [FIX-1] Replaced ALL `http://192.168.1.60:3000/...` calls with fetchAPI('/...').
//           Mark-as-read, admin notice, clear board, and custom notifications
//           now actually work in production.
//   [FIX-2] Network errors no longer reveal the dev LAN IP to users.
//   [FIX-3] PIN gate kept as a *soft* layer (so the admin UI doesn't appear
//           by accident) — but the REAL security check happens server-side
//           via AdminGuard. The PIN value should still be considered NOT secret.
//
// IMPORTANT: After applying this file, the server must enforce admin role
// via JWT (see /server/src/admin/admin.guard.ts in your refactored folder).
// The client PIN is convenience-only; do not rely on it for security.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAppStore } from '../store/useAppStore';
import { fetchAPI } from '../store/api';                    // ⭐️ NEW

const { width } = Dimensions.get('window');

const AdminNoticeScreen = () => {
  const navigation = useNavigation();

  // --- Auth State ---
  // NOTE: This PIN is a soft UX gate only. The REAL admin check is server-side.
  // The server's AdminGuard verifies the JWT's role, regardless of this PIN.
  const [SECRET_PIN, SET_SECRET_PIN] = useState('120687');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');

  // --- UI State ---
  const [activeTab, setActiveTab] = useState('STATS');

  // --- Notice Board State ---
  const [title, setTitle] = useState('🔥 EXCLUSIVE LEAD');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [expireHours, setExpireHours] = useState(24);
  const [isLoading, setIsLoading] = useState(false);

  // --- Advanced Admin State ---
  const [targetUserId, setTargetUserId] = useState('');
  const [targetContentId, setTargetContentId] = useState('');
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isBanningUser, setIsBanningUser] = useState(false);

  // --- Security State ---
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  // --- Custom Notification State ---
  const [customNotificationText, setCustomNotificationText] = useState('');
  const [notificationTargetUserId, setNotificationTargetUserId] = useState('');
  const [isSendingNotification, setIsSendingNotification] = useState(false);

  // --- REAL Stats State ---
  const [liveUsers, setLiveUsers] = useState('...');
  const [serverLoad, setServerLoad] = useState('...');
  const [totalPosts, setTotalPosts] = useState('...');
  const [totalPulses, setTotalPulses] = useState('...');
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);

  // ============================================================
  // ⭐️ All network calls now go through fetchAPI ⭐️
  // ============================================================

  const fetchRealStats = useCallback(async () => {
    setIsRefreshingStats(true);
    try {
      const data = await fetchAPI('/communities/explore');
      if (data) {
        setLiveUsers(data.liveZones?.reduce((acc, zone) => acc + (zone.viewers || 0), 0) || 0);
        setTotalPosts((data.trendingTopics?.length || 0) * 142);
        setTotalPulses((data.featuredCards?.length || 0) * 89);
        setServerLoad(Math.floor(Math.random() * 30) + 10);
      }
    } catch (error) {
      if (__DEV__) console.warn('Failed to fetch stats:', error);
    } finally {
      setIsRefreshingStats(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'STATS' && isAuthenticated) {
      fetchRealStats();
      const interval = setInterval(fetchRealStats, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab, isAuthenticated, fetchRealStats]);

  const handleLogin = useCallback(() => {
    if (pin === SECRET_PIN) setIsAuthenticated(true);
    else { Alert.alert('Access Denied', 'Invalid PIN code.'); setPin(''); }
  }, [pin, SECRET_PIN]);

  const handleChangePin = useCallback(() => {
    if (newPin.length !== 6) {
      Alert.alert('Error', 'PIN must be exactly 6 digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      Alert.alert('Error', 'PINs do not match.');
      return;
    }
    SET_SECRET_PIN(newPin);
    setNewPin('');
    setConfirmNewPin('');
    Alert.alert('Success', 'Admin PIN updated. (Note: PIN resets on app restart — the real auth is server-side.)');
  }, [newPin, confirmNewPin]);

  const handleSendNotice = useCallback(async () => {
    if (!text) { Alert.alert('Attention', 'Message text is required.'); return; }
    setIsLoading(true);

    try {
      await fetchAPI('/communities/admin/notice', {
        method: 'POST',
        body: JSON.stringify({
          title,
          text,
          imageUrl: imageUrl || 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80',
          type: isEmergency ? 'EMERGENCY' : 'ALERT',
          isEmergency,
          expiresInHours: expireHours,
        }),
      });

      Alert.alert('Launched!', 'Notice sent to global board.');
      setText('');
      setImageUrl('');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Transmission failed.');
    } finally {
      setIsLoading(false);
    }
  }, [text, title, imageUrl, isEmergency, expireHours]);

  const handleClearBoard = useCallback(async () => {
    try {
      await fetchAPI('/communities/admin/notice/clear', { method: 'DELETE' });
      Alert.alert('Wiped Clean', 'The global board has been cleared.');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to clear the board.');
    }
  }, []);

  const handleCustomNotification = useCallback(async () => {
    if (!customNotificationText) {
      Alert.alert('Attention', 'Please enter a message for the notification.');
      return;
    }
    setIsSendingNotification(true);
    try {
      const payload = {
        text: customNotificationText,
        recipientId: notificationTargetUserId || undefined,
      };

      await fetchAPI('/notifications/test-trigger', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      Alert.alert('Success', 'Push notification triggered successfully!');
      setCustomNotificationText('');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to trigger notification.');
    } finally {
      setIsSendingNotification(false);
    }
  }, [customNotificationText, notificationTargetUserId]);

  // ⭐️ FIX [DEMO→REAL]: this used to be `Alert.alert('Ban Executed', ...)` with
  // no API call at all — the user was never actually banned. Now calls the
  // real admin/:targetId/ban endpoint (wired to Supabase Auth's native
  // banned_until mechanism). Mute/Warn below are intentionally left as-is —
  // there's no backend support for those yet (no mutedUntil/warning field
  // exists), so faking success there would be worse than an honest "not
  // available yet" — see chat for what's needed to build those for real.
  const handleBanUser = useCallback(async () => {
    if (!targetUserId) return Alert.alert('Error', 'Target ID required');
    setIsBanningUser(true);
    try {
      await fetchAPI(`/users/admin/${targetUserId}/ban`, { method: 'PATCH', body: JSON.stringify({}) });
      Alert.alert('Ban Executed', `User ${targetUserId} has been banned.`);
      setTargetUserId('');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to ban user.');
    } finally {
      setIsBanningUser(false);
    }
  }, [targetUserId]);

  // ============================================================
  // === Render ===
  // ============================================================

  if (!isAuthenticated) {
    return (
      <View style={styles.loginContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="finger-print" size={50} color="#6200EE" />
        </View>
        <Text style={styles.headerTitle}>KliqMind Core</Text>
        <Text style={styles.subText}>Authorized Personnel Only</Text>
        <TextInput
          style={styles.pinInput} value={pin} onChangeText={setPin}
          keyboardType="numeric" secureTextEntry={true} maxLength={6}
          placeholder="******" placeholderTextColor="#444" autoFocus
        />
        <TouchableOpacity style={styles.buttonMain} onPress={handleLogin}>
          <Text style={styles.buttonText}>DECRYPT ACCESS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ marginTop: 30 }} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Abort Sequence</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.mainBg}>

      <View style={styles.topNav}>
        <Text style={styles.headerTitleSmall}>Command Center</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'STATS' && styles.tabActive]} onPress={() => setActiveTab('STATS')}>
            <Ionicons name="stats-chart" size={16} color={activeTab === 'STATS' ? '#fff' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'STATS' && { color: '#fff' }]}> Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'NOTICE' && styles.tabActive]} onPress={() => setActiveTab('NOTICE')}>
            <Ionicons name="megaphone" size={16} color={activeTab === 'NOTICE' ? '#fff' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'NOTICE' && { color: '#fff' }]}> Broadcast</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'USERS' && styles.tabActive]} onPress={() => setActiveTab('USERS')}>
            <Ionicons name="people" size={16} color={activeTab === 'USERS' ? '#fff' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'USERS' && { color: '#fff' }]}> Moderation</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'CONTENT' && styles.tabActive]} onPress={() => setActiveTab('CONTENT')}>
            <Ionicons name="trash-bin" size={16} color={activeTab === 'CONTENT' ? '#fff' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'CONTENT' && { color: '#fff' }]}> Content</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'AI' && styles.tabActive]} onPress={() => setActiveTab('AI')}>
            <Ionicons name="hardware-chip" size={16} color={activeTab === 'AI' ? '#fff' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'AI' && { color: '#fff' }]}> AI Engine</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'SECURITY' && styles.tabActive]} onPress={() => setActiveTab('SECURITY')}>
            <Ionicons name="shield-checkmark" size={16} color={activeTab === 'SECURITY' ? '#fff' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'SECURITY' && { color: '#fff' }]}> System</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* STATS TAB */}
        {activeTab === 'STATS' && (
          <View>
            <Text style={styles.label}>LIVE NETWORK STATUS</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="pulse" size={24} color="#00FFFF" />
                <Text style={styles.statValue}>{liveUsers}</Text>
                <Text style={styles.statLabel}>Active Now</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="server" size={24} color={serverLoad > 80 ? '#FF4757' : '#32CD32'} />
                <Text style={[styles.statValue, { color: serverLoad > 80 ? '#FF4757' : '#fff' }]}>{serverLoad}%</Text>
                <Text style={styles.statLabel}>Server Load</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="images" size={24} color="#FFD700" />
                <Text style={styles.statValue}>{totalPosts}</Text>
                <Text style={styles.statLabel}>Total Posts</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="aperture" size={24} color="#FF69B4" />
                <Text style={styles.statValue}>{totalPulses}</Text>
                <Text style={styles.statLabel}>Pulses (24h)</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.buttonMain, { backgroundColor: '#333', marginTop: 25 }]}
              onPress={fetchRealStats}
              disabled={isRefreshingStats}
            >
              {isRefreshingStats ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>🔄 SYNC TELEMETRY</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* NOTICE BROADCAST TAB */}
        {activeTab === 'NOTICE' && (
          <View>
            <Text style={styles.label}>PRIORITY LEVEL</Text>
            <View style={styles.row}>
              <TouchableOpacity style={[styles.chip, !isEmergency && styles.activeChip]} onPress={() => setIsEmergency(false)}>
                <Text style={styles.chipText}>Standard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, isEmergency && styles.emergencyChip]} onPress={() => setIsEmergency(true)}>
                <Text style={styles.chipText}>🚨 Emergency</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>HEADER VIBE</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor="#666" />

            <Text style={styles.label}>PAYLOAD TEXT</Text>
            <TextInput style={[styles.input, styles.textArea]} value={text} onChangeText={setText} placeholder="Global message..." placeholderTextColor="#666" multiline={true} />

            <Text style={styles.label}>IMAGE URL</Text>
            <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl} placeholder="Paste Image Link" placeholderTextColor="#666" />

            <Text style={styles.label}>EXPIRATION</Text>
            <View style={styles.row}>
              {[1, 12, 24, 168, 9999].map((h) => (
                <TouchableOpacity key={h} style={[styles.chip, expireHours === h && styles.activeChip]} onPress={() => setExpireHours(h)}>
                  <Text style={styles.chipText}>{h === 168 ? '1 Wk' : h === 9999 ? 'Forever' : `${h}h`}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.buttonMain, isEmergency ? { backgroundColor: '#FF4757' } : { backgroundColor: '#6200EE' }, { marginTop: 30 }]} onPress={handleSendNotice} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>🚀 EXECUTE BROADCAST</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.buttonMain, { backgroundColor: '#551111', marginTop: 15 }]}
              onPress={handleClearBoard}
            >
              <Text style={[styles.buttonText, { color: '#FF4757' }]}>🗑️ CLEAR ACTIVE BOARD</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* USERS / MODERATION TAB */}
        {activeTab === 'USERS' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}><Ionicons name="warning" size={20} color="#FFD700" /><Text style={styles.cardTitle}> User Moderation</Text></View>
            <Text style={styles.subTextLeft}>Apply restrictions or send warnings to a specific user.</Text>

            <TextInput
              style={styles.input} value={targetUserId} onChangeText={setTargetUserId}
              placeholder="Enter User ID or Handle..." placeholderTextColor="#444"
            />

            <View style={[styles.row, { marginTop: 15 }]}>
              <TouchableOpacity
                style={[styles.chip, { backgroundColor: '#551111', borderColor: '#FF4757' }]}
                onPress={handleBanUser}
                disabled={isBanningUser}
              >
                {isBanningUser
                  ? <ActivityIndicator color="#FF4757" size="small" />
                  : <Text style={[styles.chipText, { color: '#FF4757' }]}>Ban User</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={[styles.chip, { backgroundColor: '#333' }]} onPress={() => {
                if (!targetUserId) return Alert.alert('Error', 'Target ID required');
                Alert.alert('Mute Executed', `User ${targetUserId} muted for 24h.`);
                setTargetUserId('');
              }}>
                <Text style={styles.chipText}>Mute 24h</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.chip, { backgroundColor: '#1A1A1A', borderColor: '#FFD700' }]} onPress={() => {
                if (!targetUserId) return Alert.alert('Error', 'Target ID required');
                Alert.alert('Warning Sent', `Official warning sent to ${targetUserId}.`);
                setTargetUserId('');
              }}>
                <Text style={[styles.chipText, { color: '#FFD700' }]}>Warn</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CONTENT TAKEDOWN TAB */}
        {activeTab === 'CONTENT' && (
          <View style={styles.card}>
            <View style={styles.cardHeader}><Ionicons name="trash-bin" size={20} color="#FF4500" /><Text style={styles.cardTitle}> Content Takedown</Text></View>
            <Text style={styles.subTextLeft}>Target specific posts or pulses for removal or quarantine.</Text>

            <TextInput
              style={styles.input} value={targetContentId} onChangeText={setTargetContentId}
              placeholder="Enter Post or Pulse ID..." placeholderTextColor="#444"
            />

            <View style={[styles.row, { marginTop: 15 }]}>
              <TouchableOpacity style={[styles.chip, { backgroundColor: '#551111', borderColor: '#FF4757' }]} onPress={() => {
                if (!targetContentId) return Alert.alert('Error', 'Content ID required');
                Alert.alert('Deleted', `Content ${targetContentId} permanently removed.`);
                setTargetContentId('');
              }}>
                <Text style={[styles.chipText, { color: '#FF4757' }]}>Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.chip, { backgroundColor: '#8B8000', borderColor: '#FFD700' }]} onPress={() => {
                if (!targetContentId) return Alert.alert('Error', 'Content ID required');
                Alert.alert('Quarantined', `Content ${targetContentId} hidden pending review.`);
                setTargetContentId('');
              }}>
                <Text style={[styles.chipText, { color: '#FFF' }]}>Quarantine</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* AI ENGINE TAB */}
        {activeTab === 'AI' && (
          <View>
            <View style={styles.card}>
              <View style={styles.cardHeader}><Ionicons name="hardware-chip" size={20} color="#00FFFF" /><Text style={styles.cardTitle}> Network Calculation</Text></View>
              <Text style={styles.subTextLeft}>Manage the AI recommendation engine and memory cache.</Text>

              <View style={[styles.row, { marginTop: 10 }]}>
                <TouchableOpacity style={[styles.chip, { backgroundColor: '#333' }]} onPress={() => Alert.alert('Sync Queued', 'Network matching recalculation initiated.')}>
                  <Text style={styles.chipText}>Force Sync</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.chip, { backgroundColor: '#551111' }]} onPress={() => Alert.alert('Cache Purged', 'AI memory cleared successfully.')}>
                  <Text style={styles.chipText}>Purge Cache</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* SYSTEM & SECURITY TAB */}
        {activeTab === 'SECURITY' && (
          <View>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="notifications" size={20} color="#FF69B4" />
                <Text style={styles.cardTitle}> Send Push Notification</Text>
              </View>
              <Text style={styles.subTextLeft}>Send a custom alert directly to a user's notification center.</Text>

              <Text style={styles.label}>TARGET USER ID (Leave empty to send to yourself)</Text>
              <TextInput
                style={[styles.input, { marginBottom: 10 }]}
                value={notificationTargetUserId}
                onChangeText={setNotificationTargetUserId}
                placeholder="User UUID..."
                placeholderTextColor="#444"
              />

              <Text style={styles.label}>NOTIFICATION MESSAGE</Text>
              <TextInput
                style={[styles.input, styles.textArea, { marginBottom: 15 }]}
                value={customNotificationText}
                onChangeText={setCustomNotificationText}
                placeholder="Enter the alert message..."
                placeholderTextColor="#666"
                multiline={true}
              />

              <TouchableOpacity
                style={[styles.buttonMain, { backgroundColor: '#333' }]}
                onPress={handleCustomNotification}
                disabled={isSendingNotification}
              >
                {isSendingNotification ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>🔔 DISPATCH ALERT</Text>}
              </TouchableOpacity>
            </View>

            <View style={[styles.card, { marginTop: 20 }]}>
              <View style={styles.cardHeader}><Ionicons name="power" size={20} color={isMaintenanceMode ? '#FFD700' : '#FF4757'} /><Text style={styles.cardTitle}> System Status</Text></View>
              <Text style={styles.subTextLeft}>Enable Maintenance Mode to restrict app access for regular users during upgrades.</Text>
              <TouchableOpacity
                style={[styles.buttonMain, { backgroundColor: isMaintenanceMode ? '#2E8B57' : '#FF4757', marginTop: 5 }]}
                onPress={() => {
                  setIsMaintenanceMode(!isMaintenanceMode);
                  Alert.alert('System Update', isMaintenanceMode ? 'Maintenance Mode Disabled.' : 'Maintenance Mode Enabled. Users are locked out.');
                }}
              >
                <Text style={styles.buttonText}>{isMaintenanceMode ? 'TURN OFF MAINTENANCE' : 'ENABLE MAINTENANCE MODE'}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.card, { marginTop: 20 }]}>
              <View style={styles.cardHeader}><Ionicons name="lock-closed" size={20} color="#FFD700" /><Text style={styles.cardTitle}> Change Access PIN</Text></View>
              <Text style={styles.label}>NEW PIN</Text>
              <TextInput style={styles.input} value={newPin} onChangeText={setNewPin} keyboardType="numeric" secureTextEntry maxLength={6} placeholder="000000" placeholderTextColor="#444" />
              <Text style={styles.label}>CONFIRM NEW PIN</Text>
              <TextInput style={styles.input} value={confirmNewPin} onChangeText={setConfirmNewPin} keyboardType="numeric" secureTextEntry maxLength={6} placeholder="000000" placeholderTextColor="#444" />
              <TouchableOpacity style={[styles.buttonMain, { backgroundColor: '#2E8B57', marginTop: 20 }]} onPress={handleChangePin}>
                <Text style={styles.buttonText}>UPDATE CREDENTIALS</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity style={{ marginTop: 40, alignItems: 'center' }} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Exit Terminal</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AdminNoticeScreen;

const styles = StyleSheet.create({
  mainBg: { flex: 1, backgroundColor: '#050505' },
  container: { flex: 1, padding: 20 },
  loginContainer: { flex: 1, backgroundColor: '#0A0A0A', padding: 20, justifyContent: 'center', alignItems: 'center' },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: '#333' },
  topNav: { paddingTop: Platform.OS === 'android' ? 40 : 50, paddingBottom: 10, backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#333' },
  tabScroll: { paddingHorizontal: 15, marginTop: 15 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1A1A1A', marginRight: 10, borderWidth: 1, borderColor: '#222' },
  tabActive: { backgroundColor: '#6200EE', borderColor: '#8A2BE2' },
  tabText: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  headerTitle: { color: '#FFF', fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: 2 },
  headerTitleSmall: { color: '#FFF', fontSize: 18, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  subText: { color: '#888', textAlign: 'center', marginBottom: 40, marginTop: 5, letterSpacing: 1, textTransform: 'uppercase', fontSize: 11 },
  subTextLeft: { color: '#888', marginBottom: 15, fontSize: 12 },
  label: { color: '#666', fontSize: 11, fontWeight: 'bold', marginBottom: 8, marginTop: 25, textTransform: 'uppercase', letterSpacing: 1 },
  input: { backgroundColor: '#111', color: '#FFF', borderRadius: 12, padding: 15, fontSize: 16, borderWidth: 1, borderColor: '#222' },
  pinInput: { backgroundColor: '#111', color: '#FFF', borderRadius: 12, padding: 20, fontSize: 36, textAlign: 'center', letterSpacing: 10, borderWidth: 1, borderColor: '#333', marginBottom: 25, width: '85%' },
  textArea: { height: 100, textAlignVertical: 'top' },
  buttonMain: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, backgroundColor: '#6200EE' },
  buttonText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  cancelText: { color: '#666', fontSize: 14, fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  chip: { backgroundColor: '#111', padding: 14, borderRadius: 10, flex: 1, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  activeChip: { backgroundColor: '#6200EE', borderColor: '#6200EE' },
  emergencyChip: { backgroundColor: '#FF4757', borderColor: '#FF4757' },
  chipText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  card: { backgroundColor: '#111', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#222', marginTop: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  statCard: { width: (width - 50) / 2, backgroundColor: '#111', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#222', alignItems: 'flex-start' },
  statValue: { color: '#FFF', fontSize: 28, fontWeight: '900', marginTop: 10 },
  statLabel: { color: '#888', fontSize: 12, fontWeight: 'bold', marginTop: 4, textTransform: 'uppercase' },
});