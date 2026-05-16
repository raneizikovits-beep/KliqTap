// client/src/constants/auth.styles.js
// ⭐️ FINAL VERSION: Converted to native StyleSheet for optimal bridge performance ⭐️

import { StyleSheet } from 'react-native';
import { brand } from './data';

export const authStyles = StyleSheet.create({
  // --- Auth & Onboarding Screens ---
  
  // ⭐️ Reduced size and margin for tighter logo integration (AuthScreen) ⭐️
  authLogoTop: { 
    width: 120, 
    height: 120, 
    marginTop: 20, 
    marginBottom: 0, // Keeps the layout tight
    alignSelf: 'center',
  },
  
  authTitle: { 
    fontSize: 32, 
    fontWeight: "900",
    color: brand.ink,
    textAlign: 'center',
    marginTop: 8, 
  },

  authTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 16,
  },
  
  authTitleLogo: {
    width: 30, 
    height: 30,
    marginRight: 10,
  },
});