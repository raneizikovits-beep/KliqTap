// client/src/constants/layout.styles.js
// ⭐️ FINAL FIX: Adjusted Tab Switcher spacing for readability & Native Bridge Optimization ⭐️

import { StyleSheet } from 'react-native';
import { brand } from './data';

export const layoutStyles = StyleSheet.create({
  // --- General Frame & Typography ---
  appFrame: { flex: 1, backgroundColor: brand.bg }, 

  h1: { fontSize: 24, fontWeight: "900", color: brand.ink, paddingHorizontal: 16 },
  h2: { fontSize: 18, fontWeight: "900", color: brand.ink },
  p: { color: brand.soft, lineHeight: 18, fontSize: 14 },
  sub: { color: brand.soft, marginBottom: 6, paddingHorizontal: 16 },

  // --- Header & Global Buttons ---
  headerRow: { height: 60, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: brand.header, borderBottomWidth: 1, borderBottomColor: brand.headerBorder },
  brandRow: { flexDirection: "row", alignItems: "center" },
  headerLogo: { width: 30, height: 30, marginRight: 6 }, 
  brandTitle: { fontSize: 22, fontWeight: "900", marginLeft: 6, color: brand.ink },
  headRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  headBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  aiChip: { backgroundColor: brand.blue, paddingHorizontal: 10, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  addBtn: { backgroundColor: brand.yellow, width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  // --- Tab Bar ---
  tabs: { 
    position: "absolute", 
    bottom: 0, 
    left: 0, 
    right: 0, 
    height: 78, 
    backgroundColor: "#FAF7F3", 
    borderTopWidth: 1, 
    borderTopColor: "#E8E1D8", 
    flexDirection: "row", 
    justifyContent: "space-around", 
    alignItems: "center", 
    paddingBottom: 10 
  }, 
  tabBtn: { alignItems: "center" },
  tabIconWrap: { 
    width: 48, 
    height: 38, 
    borderRadius: 10, 
    alignItems: "center", 
    justifyContent: "center" 
  },
  tabLabel: { fontSize: 12, color: brand.soft, marginTop: 2 },

  // --- Form Controls & Buttons ---
  primaryBtn: { backgroundColor: brand.active, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  input: { height: 44, borderRadius: 10, borderWidth: 1, borderColor: "#E0E0E0", paddingHorizontal: 12, backgroundColor: "#FFFFFF", marginBottom: 8 },
  
  // --- Global Actions & Switchers (Profile Tabs) ---
  tabSwitcherContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: brand.headerBorder, marginTop: 8, marginBottom: 4, marginHorizontal: 16 },
  tabSwitcherButton: { 
    flex: 1, 
    paddingVertical: 12, 
    paddingHorizontal: 2, // ⭐️ FIX: Reduced horizontal padding for text ⭐️
    alignItems: 'center', 
    justifyContent: 'center', 
    borderBottomWidth: 2, 
    borderBottomColor: 'transparent' 
  },
  tabSwitcherButtonActive: { borderBottomColor: brand.blue },
  tabSwitcherText: { 
    fontSize: 13, // ⭐️ FIX: Smaller font size for tighter fit ⭐️
    fontWeight: '700', 
    color: brand.soft 
  },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  
  iconChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: "#F6F6E6", borderWidth: 1, borderColor: "#E7E7E7", marginRight: 8, marginBottom: 8 },
  iconChipText: { fontWeight: "800", color: "#0F1720", fontSize: 12 },
});