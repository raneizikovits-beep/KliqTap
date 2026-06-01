// client/src/components/AppModals.js
// ⭐️ V11.4 — Integrated V4 Support, MentalSpace Focus Mode, Journal, and CreateTicket ⭐️
//
// CHANGES from V11.3:
//   [UPDATED] Passed `sheet={thirdSheet}` and `sheet={secondSheet}` to SupportScreen 
//             so MentalSpace knows which focus tool to open (Breathe/Sounds/Affirmation).

import React, { memo, useCallback, useMemo, useRef, useEffect } from "react";
import { Modal, View, TouchableOpacity, Image, StyleSheet, SafeAreaView, Dimensions } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { styles as globalStyles } from '../constants/styles';

// --- Imports from /modals directory ---
import AiModal from './modals/AiModal';
import ChatModal from './modals/ChatModal';
import { PostCreateModal } from './modals/PostCreateModal';
import { GroupCreateModal } from './modals/GroupCreateModal';
import { PulseCreateModal } from './modals/PulseCreateModal';
import { PostCommentsModal } from './modals/PostCommentsModal';
import { ProfilePeekModal } from './modals/PeekModals';
import { SecondSheet, ThirdSheet, FourthSheet, FifthSheet } from './modals/SheetModals';
import { VideoCallModal, VoiceCallModal, IncomingCallModal } from './modals/CallModals';
import { GroupSettingsModal } from './modals/GroupSettingsModal';
import { LeaderboardModal } from './modals/LeaderboardModal';
import { RadarModal } from './modals/RadarModal';
import LocationPicker from './modals/LocationPicker';

// --- Screen Imports ---
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SupportScreen from '../screens/SupportScreen';
import SupportSheet from './SupportSheet'; 
import VibeCheckCamera from '../screens/VibeCheckCamera';
import LiveRoom from '../screens/LiveRoomScreen';
import ProfileScreen from '../screens/ProfileScreen';

// ⭐️ NEW SCREENS ADDED HERE ⭐️
import CreateTicketScreen from '../screens/CreateTicketScreen';
import JournalScreen from '../screens/JournalScreen';

const { height } = Dimensions.get('window');

const AppModals = memo(function AppModals({
  aiOpen, setAiOpen, aiThread, isAiLoading, aiInput, setAiInput, handleAiSubmit,
  postCreateOpen, setPostCreateOpen, setPostImageUri, postImageUri, handleImagePick, isPosting, handlePostSubmit,
  groupCreateOpen, setGroupCreateOpen, isCreatingGroup, handleGroupSubmit,
  groupName, setGroupName, groupDesc, setGroupDesc, groupCategory, setGroupCategory,
  groupPrivacy, setGroupPrivacy, groupLocation, setGroupLocation,
  secondSheet, setSecondSheet, thirdSheet, setThirdSheet, fourthSheet, setFourthSheet, fifthSheet, setFifthSheet,
  handleDeepLinkAction, getSettingsItems, getSearchItems, getIconGrid,
  setCurrentCallId, setVoiceModalOpen, setVideoModalOpen, setIsVibeCheckOpen, setFullScreenImage,
  handleAccountDeletionRequest, handleImagePickForGenericUpload,
  profilePeek, setProfilePeek, groupUpdateOpen, setGroupUpdateOpen, groupModalTab, setGroupModalTab,
  videoModalOpen, voiceModalOpen, currentCallId,
  isVibeCheckOpen, vibeCheckKey,
  pulseCreateOpen, pulseImageUri, isPostingPulse, setPulseCreateOpen, setPulseImageUri, handlePulseSubmit,
  fullScreenImage,
  isAiSpeaking,
  incomingCall,
  onAcceptIncomingCall,
  onDeclineIncomingCall,
}) {

  const callTimeoutRef = useRef(null);

  // Cleanup timer on unmount (prevents memory leak when call modals close during transition)
  useEffect(() => {
      return () => {
          if (callTimeoutRef.current) {
              clearTimeout(callTimeoutRef.current);
              callTimeoutRef.current = null;
          }
      };
  }, []);

  // Helper to schedule a deferred modal open, replacing any pending timer
  const scheduleModalOpen = useCallback((setterFn, delay = 350) => {
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
          callTimeoutRef.current = null;
          setterFn(true);
      }, delay);
  }, []);

  // ⭐️ Safe Call Switcher: voice ↔ video with no race
  const handleSwitchToVideo = useCallback(() => {
      setVoiceModalOpen(false);
      scheduleModalOpen(setVideoModalOpen);
  }, [setVoiceModalOpen, setVideoModalOpen, scheduleModalOpen]);

  // Comments modal visibility derived state
  const { isCommentsModalVisible, commentsPostId, commentsPost } = useMemo(() => {
      const isVisible = secondSheet?.source === 'PostComments' || thirdSheet?.source === 'Comments';
      const post = secondSheet?.post || thirdSheet?.post;
      const id = post?.id || secondSheet?.postId || thirdSheet?.postId;
      return { isCommentsModalVisible: isVisible, commentsPostId: id, commentsPost: post };
  }, [secondSheet, thirdSheet]);

  // Sheet close/transition helpers
  const handleCloseSecondSheet = useCallback(() => setSecondSheet(null), [setSecondSheet]);
  const handleThirdSheetTransition = useCallback((data) => { setThirdSheet(data); setSecondSheet(null); }, [setThirdSheet, setSecondSheet]);
  const handleFourthSheetTransition = useCallback((data) => { setFourthSheet(data); setSecondSheet(null); }, [setFourthSheet, setSecondSheet]);
  const handleFifthSheetTransition = useCallback((data) => { setFifthSheet(data); setSecondSheet(null); }, [setFifthSheet, setSecondSheet]);

  // ⭐️ [FIX-F] Voice/Video call open helpers — no race condition
  const handleOpenVoiceCall = useCallback((roomId) => {
      setSecondSheet(null);
      setCurrentCallId(roomId);
      scheduleModalOpen(setVoiceModalOpen);
  }, [setSecondSheet, setCurrentCallId, setVoiceModalOpen, scheduleModalOpen]);

  const handleOpenVideoCall = useCallback((roomId) => {
      setSecondSheet(null);
      setCurrentCallId(roomId);
      scheduleModalOpen(setVideoModalOpen);
  }, [setSecondSheet, setCurrentCallId, setVideoModalOpen, scheduleModalOpen]);

  const handleOpenVibeCheck = useCallback(() => {
      setIsVibeCheckOpen(true);
      setSecondSheet(null);
  }, [setIsVibeCheckOpen, setSecondSheet]);

  // AppRoot owns the call lifecycle (acceptCall/declineCall from store) — we just sync UI props.
  const handleAcceptIncomingCall = useCallback((callData) => {
      if (onAcceptIncomingCall) {
          onAcceptIncomingCall(callData);
      }
  }, [onAcceptIncomingCall]);

  const handleDeclineIncomingCall = useCallback((callData) => {
      if (onDeclineIncomingCall) {
          onDeclineIncomingCall(callData);
      }
  }, [onDeclineIncomingCall]);

  // ⭐️ Smart second-sheet content rendering
  const renderSecondSheetContent = useMemo(() => {
      if (!secondSheet || secondSheet.source === 'PostComments') return null;

      const { source } = secondSheet;

      const handleSettingsNav = (navData) => {
          if (navData.actionType === 'openVibeCheck') {
              handleOpenVibeCheck();
              return;
          }
          if (navData.source === 'Support' || navData.title === 'Help Center') {
              setThirdSheet({ source: 'Support' });
              return;
          }
          if (navData.next && navData.next.includes('fifth')) {
              setFifthSheet({ source: 'DataExport', title: navData.title });
              return;
          }
          setThirdSheet({
              source: navData.source || (navData.title === 'Edit Profile' ? 'EditProfile' : 'SettingsGeneric'),
              title: navData.title,
              ...navData,
          });
      };

      if (['Search', 'Settings', 'Support', 'Leaderboard', 'Radar', 'LocationPicker', 'Profile', 'LiveRoom', 'MentalSpace'].includes(source)) {
          return (
              <Modal visible={true} animationType="slide" transparent={true} onRequestClose={handleCloseSecondSheet}>
                  <View style={localStyles.cleanModalWrapper}>

                      {source === 'Profile' && (
                          <TouchableOpacity onPress={handleCloseSecondSheet} style={localStyles.topCloseButton}>
                              <Ionicons name="chevron-down" size={32} color="#fff" />
                          </TouchableOpacity>
                      )}

                      {source === 'Search' && <SearchScreen onClose={handleCloseSecondSheet} onNavigate={handleDeepLinkAction} />}
                      {source === 'Settings' && <SettingsScreen onClose={handleCloseSecondSheet} onNavigate={handleSettingsNav} />}
                      
                      {source === 'Support' && <SupportSheet setSecondSheet={setSecondSheet} setThirdSheet={setThirdSheet} />}
                      
                      {/* ⭐️ Added sheet={secondSheet} here to pass Focus Mode data if opened directly */}
                      {source === 'MentalSpace' && <SupportScreen sheet={secondSheet} setSecondSheet={setSecondSheet} setThirdSheet={setThirdSheet} />}
                      
                      {source === 'Leaderboard' && <LeaderboardModal setSecondSheet={setSecondSheet} />}
                      {source === 'Radar' && (
                      <RadarModal
                      onClose={handleCloseSecondSheet}
                      setSecondSheet={setSecondSheet}
                      setGroupModalTab={setGroupModalTab}
                      />
                      )}
                      {source === 'LocationPicker' && <LocationPicker onClose={handleCloseSecondSheet} />}

                      {source === 'LiveRoom' && (
                          <LiveRoom
                              roomId={secondSheet.roomId}
                              roomName={secondSheet.roomName}
                              zone={secondSheet.zone}
                              onClose={handleCloseSecondSheet}
                          />
                      )}

                      {source === 'Profile' && (
                          <View style={localStyles.profileWrapper}>
                              <ProfileScreen
                                  sheet={secondSheet}
                                  setSecondSheet={setSecondSheet}
                                  openChat={() => console.log('Chat opened')}
                              />
                          </View>
                      )}

                  </View>
              </Modal>
          );
      }

      return (
          <SecondSheet
              sheet={secondSheet}
              onClose={handleCloseSecondSheet}
              onThird={handleThirdSheetTransition}
              onFourth={handleFourthSheetTransition}
              onFifth={handleFifthSheetTransition}
              onDeepLink={handleDeepLinkAction}
              getSettingsItems={getSettingsItems}
              getSearchItems={getSearchItems}
              getIconGrid={getIconGrid}
              openVoiceCall={handleOpenVoiceCall}
              openVideoCall={handleOpenVideoCall}
              openVibeCheck={handleOpenVibeCheck}
              onOpenAvatar={setFullScreenImage}
              openDeletionLink={handleAccountDeletionRequest}
              onStartImageUpload={handleImagePickForGenericUpload}
              setThirdSheet={setThirdSheet}
              setFourthSheet={setFourthSheet}
              setFifthSheet={setFifthSheet}
              setProfilePeek={setProfilePeek}
              setSecondSheet={setSecondSheet}
           />
      );
  }, [
      secondSheet, handleCloseSecondSheet, handleThirdSheetTransition, handleFourthSheetTransition,
      handleFifthSheetTransition, handleDeepLinkAction, getSettingsItems, getSearchItems, getIconGrid,
      handleOpenVoiceCall, handleOpenVideoCall, handleOpenVibeCheck, setFullScreenImage,
      handleAccountDeletionRequest, handleImagePickForGenericUpload, setThirdSheet, setFourthSheet,
      setFifthSheet, setProfilePeek, setSecondSheet,
  ]);

  return (
    <>
      <AiModal
        visible={aiOpen}
        onClose={() => setAiOpen(false)}
        thread={aiThread}
        isLoading={isAiLoading}
        input={aiInput}
        onInputChange={setAiInput}
        onSubmit={handleAiSubmit}
        isAiSpeaking={isAiSpeaking}
      />

      <PostCreateModal
        visible={postCreateOpen}
        onClose={() => { setPostCreateOpen(false); setPostImageUri(null); }}
        imageUri={postImageUri}
        onImagePick={() => handleImagePick('post')}
        onImageRemove={() => setPostImageUri(null)}
        onSubmit={handlePostSubmit}
        isPosting={isPosting}
      />

      <GroupCreateModal
        visible={groupCreateOpen}
        onClose={() => setGroupCreateOpen(false)}
        isCreating={isCreatingGroup}
        onSubmit={handleGroupSubmit}
        name={groupName}
        onNameChange={setGroupName}
        desc={groupDesc}
        onDescChange={setGroupDesc}
        category={groupCategory}
        onCategoryChange={setGroupCategory}
        privacy={groupPrivacy}
        onPrivacyChange={setGroupPrivacy}
        location={groupLocation}
        onLocationChange={setGroupLocation}
      />

      {renderSecondSheetContent}

      {/* ⭐️ EXCLUDED ALL OUR CUSTOM SCREENS FROM THE DEFAULT THIRDSHEET RENDERER */}
      {thirdSheet && 
       thirdSheet.source !== 'Comments' && 
       thirdSheet.source !== 'Support' && 
       thirdSheet.source !== 'MentalSpace' && 
       thirdSheet.source !== 'CreateTicket' && 
       thirdSheet.source !== 'Journal' && (
          <ThirdSheet sheet={thirdSheet} onClose={() => setThirdSheet(null)} />
      )}

      {/* ⭐️ CUSTOM ROUTING FOR SUPPORT HUB & MENTAL SPACE */}
      {thirdSheet && thirdSheet.source === 'Support' && (
          <Modal visible={true} animationType="slide" transparent={true} onRequestClose={() => setThirdSheet(null)}>
              <View style={localStyles.cleanModalWrapper}>
                  <SupportSheet setSecondSheet={() => setThirdSheet(null)} setThirdSheet={setFourthSheet} />
              </View>
          </Modal>
      )}

      {thirdSheet && thirdSheet.source === 'MentalSpace' && (
          <Modal visible={true} animationType="slide" transparent={true} onRequestClose={() => setThirdSheet(null)}>
              <View style={localStyles.cleanModalWrapper}>
                  {/* ⭐️ Added sheet={thirdSheet} here to pass Focus Mode data! ⭐️ */}
                  <SupportScreen sheet={thirdSheet} setSecondSheet={() => setThirdSheet(null)} setThirdSheet={setFourthSheet} />
              </View>
          </Modal>
      )}

      {/* ⭐️ NEW ROUTES: CREATE TICKET & JOURNAL ⭐️ */}
      {thirdSheet && thirdSheet.source === 'CreateTicket' && (
          <Modal visible={true} animationType="slide" transparent={true} onRequestClose={() => setThirdSheet(null)}>
              <View style={localStyles.cleanModalWrapper}>
                  <CreateTicketScreen onClose={() => setThirdSheet(null)} />
              </View>
          </Modal>
      )}

      {thirdSheet && thirdSheet.source === 'Journal' && (
          <Modal visible={true} animationType="slide" transparent={true} onRequestClose={() => setThirdSheet(null)}>
              <View style={localStyles.cleanModalWrapper}>
                  <JournalScreen onClose={() => setThirdSheet(null)} />
              </View>
          </Modal>
      )}

      {fourthSheet && <FourthSheet sheet={fourthSheet} onClose={() => setFourthSheet(null)} />}
      {fifthSheet && <FifthSheet sheet={fifthSheet} onClose={() => setFifthSheet(null)} />}

      <ProfilePeekModal profile={profilePeek} onClose={() => setProfilePeek(null)} />

      <GroupSettingsModal
        isVisible={!!groupUpdateOpen}
        group={groupUpdateOpen ? groupUpdateOpen.group : null}
        onClose={() => setGroupUpdateOpen(null)}
        onSave={(id, updates) => console.log('Update group', id, updates)}
      />

      <ChatModal />

      <PostCommentsModal
          visible={isCommentsModalVisible}
          postId={commentsPostId}
          post={commentsPost}
          onClose={() => { setSecondSheet(null); setThirdSheet(null); }}
      />

      <VideoCallModal
          isOpen={videoModalOpen}
          onClose={() => setVideoModalOpen(false)}
          callId={currentCallId}
      />

      <VoiceCallModal
          isOpen={voiceModalOpen}
          onClose={() => setVoiceModalOpen(false)}
          callId={currentCallId}
          onSwitchToVideo={handleSwitchToVideo}
      />

      <IncomingCallModal
          incomingCall={incomingCall}
          onAccept={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
      />

      <Modal visible={isVibeCheckOpen} onRequestClose={() => setIsVibeCheckOpen(false)} animationType="slide">
          {isVibeCheckOpen && <VibeCheckCamera key={vibeCheckKey} onClose={() => setIsVibeCheckOpen(false)} />}
      </Modal>

      <PulseCreateModal
          visible={pulseCreateOpen}
          imageUri={pulseImageUri}
          isPosting={isPostingPulse}
          onClose={() => { setPulseCreateOpen(false); setPulseImageUri(null); }}
          onSubmit={handlePulseSubmit}
      />

      <Modal visible={!!fullScreenImage} transparent={true} animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
           <View style={localStyles.fullScreenModalContainer}>
               <SafeAreaView style={{ flex: 1, width: '100%' }}>
                   <TouchableOpacity style={localStyles.fullScreenCloseBtn} onPress={() => setFullScreenImage(null)}>
                       <Ionicons name="close" size={32} color="#fff" />
                   </TouchableOpacity>
                   {fullScreenImage && (
                       <View style={localStyles.imageWrapper}>
                           <Image source={{ uri: fullScreenImage }} style={localStyles.fullScreenImage} />
                       </View>
                   )}
               </SafeAreaView>
           </View>
      </Modal>
    </>
  );
});

export default AppModals;

const localStyles = StyleSheet.create({
  cleanModalWrapper: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'flex-end',
  },
  topCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 4,
  },
  profileWrapper: {
    flex: 1,
    backgroundColor: '#000',
    marginTop: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  fullScreenModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  fullScreenCloseBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
});