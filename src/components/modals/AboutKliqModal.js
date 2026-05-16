// client/src/components/modals/AboutKliqModal.js
import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function AboutKliqModal({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>About KliqTap</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Mission Section */}
          <LinearGradient colors={['#6200EE', '#2196F3']} style={styles.missionCard}>
            <Text style={styles.missionTitle}>The Internet is Broken. We're fixing it.</Text>
            <Text style={styles.missionText}>
              KliqTap was born from a simple realization: Users have become the product. 
              Toxic algorithms, digital loneliness, and zero privacy are the new norms. 
              We are reclaiming social connection[cite: 11, 16].
            </Text>
          </LinearGradient>

          {/* The Algorithm Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>The Kliq Genius AI</Text>
            <Text style={styles.bodyText}>
              Unlike traditional feeds designed for outrage and infinite scrolling, 
              our algorithm matches you instantly to hyper-relevant micro-communities 
              based on your real-time vibe. We use AI to get you OFF the screen and 
              into safe, authentic physical meetups[cite: 11, 17].
            </Text>
          </View>

          {/* Founder Section */}
          <View style={styles.founderSection}>
            <View style={styles.founderHeader}>
              <View style={styles.founderInfo}>
                <Text style={styles.founderLabel}>THE ARCHITECT & VISIONARY</Text>
                <Text style={styles.founderName}>Ran Eizikovich</Text>
                <Text style={styles.founderBio}>Founder, CEO & Lead Developer</Text>
              </View>
            </View>
            
            <Text style={styles.bodyText}>
              As a PhD Candidate in Business Administration and a seasoned entrepreneur in Cebu's 
              real estate market, Ran combined deep academic research with technical execution 
              to build KliqTap solo. His mission: Build an "Architecture of Trust" where users 
              are partners, not products[cite: 11, 14].
            </Text>
            
            <View style={styles.academicBadges}>
               <View style={styles.badge}><Text style={styles.badgeText}>PhD Candidate</Text></View>
               <View style={styles.badge}><Text style={styles.badgeText}>MBA</Text></View>
               <View style={styles.badge}><Text style={styles.badgeText}>BSTM</Text></View>
            </View>
          </View>

          {/* Core Pillars */}
          <View style={styles.pillarsContainer}>
             <View style={styles.pillar}>
                <Ionicons name="shield-half" size={24} color="#6200EE" />
                <Text style={styles.pillarTitle}>True Deletion</Text>
                <Text style={styles.pillarDesc}>100% Data Sovereignty. When you delete it, it's gone forever[cite: 11].</Text>
             </View>
             <View style={styles.pillar}>
                <Ionicons name="people" size={24} color="#2196F3" />
                <Text style={styles.pillarTitle}>Democracy</Text>
                <Text style={styles.pillarDesc}>Features and rules are dictated by user majority vote[cite: 11, 16].</Text>
             </View>
          </View>

          <Text style={styles.footerText}>Built with ❤️ in Cebu City, Philippines</Text>
          <Text style={styles.versionText}>v3.5.0 Deployment</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#111' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20 },
  missionCard: { padding: 25, borderRadius: 24, marginBottom: 30 },
  missionTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  missionText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 22 },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 10 },
  bodyText: { fontSize: 15, color: '#666', lineHeight: 24 },
  founderSection: { backgroundColor: '#F9FAFB', padding: 20, borderRadius: 20, marginBottom: 30 },
  founderHeader: { marginBottom: 15 },
  founderLabel: { fontSize: 12, fontWeight: '800', color: '#6200EE', letterSpacing: 1, marginBottom: 5 },
  founderName: { fontSize: 24, fontWeight: '900', color: '#111' },
  founderBio: { fontSize: 14, color: '#888', fontWeight: '600' },
  academicBadges: { flexDirection: 'row', gap: 10, marginTop: 15 },
  badge: { backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  badgeText: { fontSize: 12, fontWeight: 'bold', color: '#444' },
  pillarsContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 15, marginBottom: 40 },
  pillar: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 18, borderWidth: 1, borderColor: '#f0f0f0' },
  pillarTitle: { fontSize: 14, fontWeight: '800', marginTop: 10, marginBottom: 5 },
  pillarDesc: { fontSize: 12, color: '#888', lineHeight: 18 },
  footerText: { textAlign: 'center', color: '#AAA', fontWeight: '700', marginTop: 20 },
  versionText: { textAlign: 'center', color: '#CCC', fontSize: 12, marginTop: 5, marginBottom: 40 }
});