// client/src/constants/styles.js
// ⭐️ FINAL VERSION: Added Voice Pulse & Clean Overlay Constants ⭐️

import { StyleSheet, Platform } from 'react-native';

import { layoutStyles } from './layout.styles';
import { authStyles } from './auth.styles';
import { componentsStyles } from './components.styles';

// --- Final Merge ---
export const styles = StyleSheet.create({
  ...layoutStyles,
  ...authStyles,
  ...componentsStyles,
  
  // ⭐️ Overlay configuration supporting both Native and Web constraints ⭐️
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 540 : '100%', 
  },

  // ⭐️ Voice & AI Pulse Animations ⭐️
  voicePulseWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  
  pulseCircle: {
    backgroundColor: '#6200EE',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#6200EE",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },

  // Glassmorphic Welcome Card
  glassCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  }
});