// client/src/constants/components.styles.js
// ⭐️ FINAL COMPLETE FIX: Native StyleSheet Implementation & UI Upgrades ⭐️

import { StyleSheet } from 'react-native';
import { brand } from './data';

export const componentsStyles = StyleSheet.create({
  // --- ⭐️ NEW: UI Upgrades (Handle, Full Screen, Edit Mode) ⭐️ ---
  
  // 1. Handle Bar for Sheets (מקל סגירה)
  sheetHandleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },

  // 2. Full Screen Image Modal (מודל תמונה מלאה)
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
    resizeMode: 'contain',
  },
  fullScreenCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 3. Admin Controls & Edit Mode
  removeMemberBtn: {
    backgroundColor: brand.red,
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 10,
  },

  // --- Card & Block Styles ---
  blockCard: { 
    backgroundColor: "#fff", 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: "#EFE8DE", 
    padding: 12, 
    marginBottom: 10, 
    elevation: 1, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 3, 
    shadowOffset: { width: 0, height: 1 } 
  },
  notificationCard: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    padding: 12, 
    borderRadius: 14, 
    marginBottom: 10, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#EFE8DE', 
    elevation: 1, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 3, 
    shadowOffset: { width: 0, height: 1 } 
  },
  notificationIcon: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: brand.header, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  notificationDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: brand.blue, 
    marginLeft: 10 
  },
  
  // --- Group Card ---
  groupCard: { 
    flexDirection: "row", 
    backgroundColor: "#fff", 
    padding: 10, 
    borderRadius: 14, 
    marginBottom: 10, 
    alignItems: "center", 
    justifyContent: "space-between", 
    borderWidth: 1, 
    borderColor: "#EFE8DE", 
    elevation: 1, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 3, 
    shadowOffset: { width: 0, height: 1 } 
  },
  groupImg: { 
    width: 60, 
    height: 60, 
    borderRadius: 12 
  },
  groupCardPulseBar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: brand.header,
    marginTop: 4,
    overflow: 'hidden',
  },
  joinPill: { 
    height: 36, 
    paddingHorizontal: 16, 
    backgroundColor: "#111", 
    borderRadius: 14, 
    alignItems: "center", 
    justifyContent: "center" 
  },
  joinLabel: { 
    color: "#fff", 
    fontWeight: "900" 
  },
  
  // --- Post Card (Used in Profile/Explore) ---
  postCard: { 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: brand.headerBorder, 
    marginBottom: 16, 
    overflow: 'hidden',
    width: '100%', 
  },
  postHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12 
  },
  postAvatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22 
  },
  postUserTime: { 
    flex: 1, 
    marginLeft: 10 
  },
  postUserName: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: brand.ink 
  },
  postTimestamp: { 
    fontSize: 13, 
    color: brand.soft 
  },
  postBodyText: { 
    fontSize: 15, 
    color: brand.ink, 
    lineHeight: 22, 
    paddingHorizontal: 16, 
    paddingBottom: 12 
  },
  postImage: { 
    width: '100%', 
    height: 300, 
    backgroundColor: brand.header 
  },
  postStats: { 
    flexDirection: 'row', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderTopWidth: 1, 
    borderTopColor: brand.header 
  },
  postStatText: { 
    fontSize: 12, 
    color: brand.soft, 
    marginRight: 12 
  },
  postActions: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    borderTopWidth: 1, 
    borderTopColor: brand.header 
  },
  postActionBtn: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 12 
  },
  postActionText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: brand.soft 
  },
  
  // --- Floating Action Buttons (FABs) ---
  fabContainer: {
    position: 'absolute',
    bottom: 87, 
    left: 13, 
    right: 13,
    flexDirection: 'row', 
    alignItems: 'center',
    gap: 12, 
    zIndex: 10,
    justifyContent: 'flex-end', 
  },
  fab: { 
    width: 54, 
    height: 54, 
    borderRadius: 27, 
    backgroundColor: 'rgba(247, 193, 31, 0.95)',
    alignItems: "center", 
    justifyContent: "center",
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  }, 
  quickAiFab: { 
    width: 54, 
    height: 54, 
    borderRadius: 27, 
    backgroundColor: 'rgba(120, 80, 220, 0.95)',
    alignItems: "center", 
    justifyContent: "center",
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  speedDialContainer: {
    position: 'absolute',
    bottom: 70, 
    right: 4, 
    alignItems: 'center',
    zIndex: 9, 
  },
  speedDialAction: {
    position: 'absolute',
    flexDirection: 'row-reverse', 
    alignItems: 'center',
    right: 1, 
  },
  speedDialLabel: {
    backgroundColor: 'rgba(255, 255, 255, 0.87)', 
    color: brand.ink,
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderRadius: 0,
    marginRight: 2, 
    fontWeight: '600',
    elevation: 0,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  speedDialIcon: { 
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    borderWidth: 1, 
    borderColor: '#E8E8E8', 
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },

  // --- List Item Styles ---
  listHeader: {
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  listHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: brand.soft,
    letterSpacing: 0.5,
  },
  listItemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: brand.header,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: brand.headerBorder,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1, 
    shadowColor: '#000', 
    shadowOpacity: 0.04, 
    shadowRadius: 2, 
    shadowOffset: { width: 0, height: 1 }
  },
  listItemIcon: {
    fontSize: 20,
  },
  listItemTextContainer: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: brand.ink,
  },
  listItemBody: {
    fontSize: 13,
    color: brand.soft,
    marginTop: 2,
  },
  listItemChevron: {
    fontSize: 20,
    color: brand.soft,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  aiButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  aiButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: brand.ink,
  },
  
  // --- Profile/Gamification Styles ---
  profileAvatarPlaceholder: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: brand.header, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 2, 
    borderColor: brand.headerBorder, 
    overflow: 'hidden' 
  },
  profileAvatarImage: { 
    width: '100%', 
    height: '100%' 
  },
  profileStatsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginTop: 16, 
    marginBottom: 16, 
    borderTopWidth: 1, 
    borderBottomWidth: 1, 
    borderColor: brand.headerBorder, 
    paddingVertical: 12 
  },
  profileStatBox: { 
    alignItems: 'center' 
  },
  profileStatValue: { 
    fontSize: 22, 
    fontWeight: '900', 
    color: brand.ink 
  },
  profileStatLabel: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: brand.soft 
  },
  profileVibeContainer: {
    backgroundColor: brand.sky + '40', 
    borderColor: brand.blue,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    position: 'relative',
  },
  profileVibeLabel: {
    fontWeight: 'bold',
    color: brand.blue,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  profileVibeText: {
    fontSize: 16,
    color: brand.ink,
    fontStyle: 'italic',
    fontWeight: '600',
    marginTop: 4,
  },
  profileVibeEditButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: brand.headerBorder,
  },
  profileVibeEditText: {
    color: brand.blue,
    fontWeight: '600',
    fontSize: 12,
  },
  badgeGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10, 
  },
  badgeIcon: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: brand.headerBorder,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    width: 100, 
  },
  badgeIconLocked: {
    backgroundColor: brand.header,
    opacity: 0.6,
  },
  badgeIconImage: {
    fontSize: 32,
  },
  badgeIconLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: brand.ink,
    marginTop: 4,
    textAlign: 'center',
  },
  questContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: brand.headerBorder,
    borderRadius: 12,
    padding: 16,
  },
  questItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: brand.header,
  },
  questItemCompleted: {
    opacity: 0.5,
  },
  questIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  questText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: brand.ink,
  },
  questPoints: {
    fontSize: 14,
    fontWeight: 'bold',
    color: brand.green,
  },
  questViewAll: {
    color: brand.blue,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',  
  },
  
  // --- Pulse Bar / Story Bar Styles ---
  pulseBarContainer: { 
    backgroundColor: brand.header, 
    borderBottomWidth: 1, 
    borderBottomColor: brand.headerBorder 
  },
  intentionsContainer: { 
    paddingVertical: 13, 
    paddingHorizontal: 16, 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  intentionBubble: { 
    alignItems: 'center', 
    width: 80, 
    marginRight: 4 
  },
  intentionAvatarRing: { 
    width: 64, 
    height: 64, 
    borderRadius: 18, 
    borderWidth: 3, 
    alignItems: 'center', 
    justifyContent: 'center', 
    position: 'relative' 
  },
  intentionAvatar: { 
    width: 56, 
    height: 56, 
    borderRadius: 16 
  },
  intentionAddBtn: { 
    width: 56, 
    height: 56, 
    borderRadius: 16, 
    backgroundColor: '#fff', 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderWidth: 2, 
    borderColor: brand.blue, 
    borderStyle: 'dashed' 
  },
  intentionLabel: { 
    fontSize: 12, 
    color: brand.soft, 
    marginTop: 4, 
    fontWeight: '600' 
  },
  liveIndicator: { 
    width: 12, 
    height: 12, 
    borderRadius: 6, 
    backgroundColor: brand.green, 
    position: 'absolute', 
    bottom: 2, 
    right: 2, 
    borderWidth: 2, 
    borderColor: '#fff' 
  },
  
  // --- Chat & Modal Styles ---
  chatBubble: {
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '80%',
  },
  chatBubbleUser: {
    backgroundColor: brand.blue,
    alignSelf: 'flex-end',
  },
  chatBubbleThem: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: brand.headerBorder,
  },
  chatSenderName: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  chatBubbleTextUser: {
    color: '#fff',
    lineHeight: 18,
  },
  chatBubbleTextThem: {
    color: brand.ink,
    lineHeight: 18,
  },
  messageListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: brand.header,
  },
  messageAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  messageContent: {
    flex: 1,
  },
  messageSender: {
    fontSize: 16,
    fontWeight: 'bold',
    color: brand.ink,
  },
  messageMeta: {
    alignItems: 'flex-end',
  },
  messageTime: {
    fontSize: 12,
    color: brand.soft,
  },
  
  // ⭐️ FIX: Perfectly Centered Notification Badges ⭐️
  messageUnreadBadge: {
    backgroundColor: brand.blue,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    height: 20, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 4,
  },
  messageUnreadText: {
    color: '#fff',
    fontSize: 10, 
    fontWeight: 'bold',
    textAlign: 'center',
    includeFontPadding: false, 
  },

  overlay: { 
    flex: 1, 
    backgroundColor: "rgba(0,0,0,0.35)", 
    alignItems: "center", 
    justifyContent: "center", 
    padding: 16 
  },
  cardModal: { 
    width: "92%", 
    backgroundColor: "#fff", 
    borderRadius: 18, 
    padding: 16, 
    maxHeight: "90%" 
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: brand.headerBorder,
  },
  modalCloseButton: {
    paddingTop: 8,
    paddingBottom: 8, 
    borderTopWidth: 1,
    borderTopColor: brand.headerBorder,
  },
  sheetVoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.green + '20', 
    borderColor: brand.green,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 16,
  },
  sheetVoiceButtonText: {
    color: brand.green,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  // --- Misc/Utility Styles ---
  gpsChipInline: { 
    alignSelf: "flex-start", 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 12, 
    height: 34, 
    borderRadius: 17, 
    backgroundColor: "rgba(255,255,255,0.55)", 
    borderWidth: 1, 
    borderColor: "#E0E0E0", 
    marginHorizontal: 16 
  },
  profileCard: { 
    backgroundColor: "#fff", 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: "#EFE8DE", 
    padding: 12, 
    marginTop: 8, 
    elevation: 1, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 3, 
    shadowOffset: { width: 0, height: 1 } 
  },
  profileCardFull: { 
    backgroundColor: "#fff", 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: "#EFE8DE", 
    padding: 16, 
    marginTop: 8 
  },
});