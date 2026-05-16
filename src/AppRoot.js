// client/src/AppRoot.js
// ⭐️ ULTIMATE FINAL VERSION: Enterprise Performance, Stabilized Global State, Fast GPS & GLOBAL DARK MODE ⭐️
// תיקונים:
//   [BUG-1] קריסת מיקרופון (Live Audio): נוספה בקשת הרשאה Audio.requestPermissionsAsync()
//   [BUG-2] PanResponder ב-web גורם לחסימת גלילה — מושבת על web בלבד
//   [BUG-3] שיחה נכנסת: נוסף IncomingCallModal + משיכת incomingCall מה-store

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { 
    ActivityIndicator, Text, View, 
    TouchableOpacity, Alert, Linking, StyleSheet, Dimensions,
    PanResponder, Animated, Platform 
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"; 
import { StatusBar } from 'expo-status-bar'; 
import * as ImagePicker from 'expo-image-picker'; 
import * as Location from 'expo-location'; 
import { Audio } from 'expo-av'; // ⭐️ התוספת למניעת קריסת האפליקציה (BUG-1) ⭐️
import { Ionicons } from '@expo/vector-icons'; 
import { useShallow } from 'zustand/react/shallow'; 

import { useAppStore } from './store/useAppStore'; 
import * as PulseService from './store/pulse.service'; 
import * as Data from './constants/data';
import { styles } from './constants/styles';
import { deepItems } from './constants/helpers'; 
import { getSettingsItems, getSearchItems, getIconGrid, getAllMessages } from './constants/sheetConfig';

import Header from './components/Header';
import TabBtn from './components/TabBar';
import MainNavigator from './navigation/MainNavigator';
import SpeedDial from './components/SpeedDial'; 
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import AppModals from './components/AppModals';
import { useWebScrollFix } from './hooks/useWebScrollFix';

const APP_NAME_DISPLAY = Data.APP_NAME || 'KliqTap';
const DELETION_URL = 'https://www.kliq-tap.com/privacy/account-deletion-request';
const { height, width } = Dimensions.get('window');

// Static — defined outside component so it is never recreated on re-render
const TABS = [
    { label: "Home",     type: "home"          },
    { label: "Tribes",   type: "groups"        },
    { label: "Explore",  type: "explore"       },
    { label: "Camera",   type: "camera"        },
    { label: "Messages", type: "messages"      },
    { label: "Alerts",   type: "notifications" },
    { label: "Profile",  type: "profile"       },
];

const handleAccountDeletionRequest = () => {
    Alert.alert(
        "Delete Account & Data",
        "You are about to open a secure web page to request the permanent deletion of your KliqTap account. This action is irreversible.",
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Continue", 
                onPress: () => Linking.openURL(DELETION_URL).catch(err => { if (__DEV__) console.error("Couldn't open URL:", err); }),
                style: "destructive"
            }
        ]
    );
};

export default function AppRoot() {
  const { 
    user, needsOnboarding, isRouletteSearching, rouletteStatusMessage, 
    isInitialized, isAuthLoading, token, points, streak, badges, award, 
    logout, initialize, postDraftText, setPostDraftText,
    generateAiResponse, createPost, createGroup, openChat,
    findStreamRouletteMatch, setCurrentCallId, currentCallId, 
    createPulse, uploadFile, pulseCreateOpen, setPulseCreateOpen,
    pulseImageUri, setPulseImageUri,
    triggerOpenProfile, setTriggerOpenProfile,
    refreshAllData, isAiSpeaking,
    setUserLocation,
    incomingCall, acceptCall, declineCall,
    settings 
  } = useAppStore(useShallow(state => ({
    user: state.user, needsOnboarding: state.needsOnboarding,
    isRouletteSearching: state.isRouletteSearching, rouletteStatusMessage: state.rouletteStatusMessage,
    isInitialized: state.isInitialized, isAuthLoading: state.isAuthLoading, token: state.token,
    points: state.points, streak: state.streak, badges: state.badges, 
    award: state.award, logout: state.logout, initialize: state.initialize, 
    postDraftText: state.postDraftText, setPostDraftText: state.setPostDraftText,
    generateAiResponse: state.generateAiResponse, createPost: state.createPost, 
    createGroup: state.createGroup, openChat: state.openChat, 
    findStreamRouletteMatch: state.findStreamRouletteMatch,
    setCurrentCallId: state.setCurrentCallId, currentCallId: state.currentCallId, 
    createPulse: state.createPulse, uploadFile: state.uploadFile, 
    pulseCreateOpen: state.pulseCreateOpen, setPulseCreateOpen: state.setPulseCreateOpen,
    pulseImageUri: state.pulseImageUri, setPulseImageUri: state.setPulseImageUri,
    triggerOpenProfile: state.triggerOpenProfile, setTriggerOpenProfile: state.setTriggerOpenProfile,
    refreshAllData: state.refreshAllData,
    isAiSpeaking: state.isAiSpeaking ?? false,
    setUserLocation: state.setUserLocation,
    incomingCall: state.incomingCall || null,
    acceptCall: state.acceptCall || null,
    declineCall: state.declineCall || null,
    settings: state.userSettings || {} 
  })));
  
  const isDark = settings.darkMode === true;

  const insets = useSafeAreaInsets();
  const isMobileWeb = Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth < 768;

  const [aiOpen, setAiOpen] = useState(false);
  const [aiThread, setAiThread] = useState([{ 
    role: "system", 
    text: `Hi, I am ${APP_NAME_DISPLAY} AI. How can I help you connect today?`, 
    time: 'just now',
    suggestions: ["Suggest group", "Find nearby", "Start call"]
  }]);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  const [postCreateOpen, setPostCreateOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false); 
  const [postImageUri, setPostImageUri] = useState(null); 
  const [isPostingPulse, setIsPostingPulse] = useState(false);

  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: "", desc: "", category: "Community", privacy: "Public", location: "" });
  
  const [sheets, setSheets] = useState({ second: null, third: null, fourth: null, fifth: null }); 
  const [tab, setTab] = useState("Home");
  const [profilePeek, setProfilePeek] = useState(null);
  const [groupUpdateOpen, setGroupUpdateOpen] = useState(null);
  const [groupModalTab, setGroupModalTab] = useState('members'); 
  
  const [messageTab, setMessageTab] = useState("CHATS"); 
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [isVibeCheckOpen, setIsVibeCheckOpen] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [vibeCheckKey, setVibeCheckKey] = useState('cam-init');

  const toggleSpeedDial = useCallback(() => setIsSpeedDialOpen(prev => !prev), []);
  const closeSpeedDial = useCallback(() => setIsSpeedDialOpen(false), []);

  const pan = useRef(new Animated.ValueXY()).current;
  const panOffset = useRef({ x: 0, y: 0 }).current;
  
  const panResponder = useMemo(() => {
    if (Platform.OS === 'web') {
      return { panHandlers: {} };
    }
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => pan.setOffset({ x: panOffset.x, y: panOffset.y }),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gestureState) => {
        panOffset.x += gestureState.dx;
        panOffset.y += gestureState.dy;
        pan.flattenOffset();
      }
    });
  }, [pan, panOffset]);

  useWebScrollFix();

  useEffect(() => { 
      initialize(); 
  }, [initialize]);

  useEffect(() => {
    const fetchFastLocation = async () => {
        if (!user) return;
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            let fastLocation = await Location.getLastKnownPositionAsync();
            if (fastLocation && setUserLocation) {
                setUserLocation({ latitude: fastLocation.coords.latitude, longitude: fastLocation.coords.longitude });
            }

            let accurateLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (accurateLocation && setUserLocation) {
                setUserLocation({ latitude: accurateLocation.coords.latitude, longitude: accurateLocation.coords.longitude });
            }
        } catch (error) {
            if (__DEV__) console.warn("Location error:", error);
        }
    };
    fetchFastLocation();
  }, [user, setUserLocation]);

  useEffect(() => {
      if (triggerOpenProfile) {
          setSheets(s => ({ ...s, second: { source: "Profile", userId: triggerOpenProfile } }));
          setTriggerOpenProfile(null);
      }
  }, [triggerOpenProfile, setTriggerOpenProfile]);
  
  const handleAiSubmit = useCallback(async (promptOverride) => {
    const newPrompt = promptOverride || aiInput.trim();
    if (!newPrompt || isAiLoading) return;
    
    setAiInput("");
    setIsAiLoading(true);
    setAiThread(prev => [...prev, { role: "user", text: newPrompt, time: 'now' }]);
    
    try {
        const aiResponse = await generateAiResponse(newPrompt);
        const responseText = (typeof aiResponse === 'string' ? aiResponse : aiResponse?.text) || "No response received.";
        
        let suggestions = [];
        if (responseText.toLowerCase().includes("group")) suggestions.push("Suggest group");
        if (responseText.toLowerCase().includes("call")) suggestions.push("Start call");

        setAiThread(prev => [...prev, { 
          role: "assistant", 
          text: responseText, 
          time: 'now',
          suggestions: suggestions.length > 0 ? suggestions : null
        }]);
        award("AI Query"); 
    } catch (e) {
        setAiThread(prev => [...prev, { role: "system", text: "Error: Failed to get response from AI.", time: 'now' }]);
    } finally {
        setIsAiLoading(false);
    }
  }, [aiInput, isAiLoading, generateAiResponse, award]);

  const handleImagePick = useCallback(async (target) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission denied', 'Camera roll permissions are required!');
    
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, quality: 0.9,
    });

    if (pickerResult.canceled) return;
    const uri = pickerResult.assets[0].uri;

    setSheets(prev => ({ ...prev, second: null }));
    if (target === 'post') {
        setPostImageUri(uri);
        if (!postCreateOpen) setPostCreateOpen(true);
    } else if (target === 'story') {
        setPulseImageUri(uri); 
        setPulseCreateOpen(true);
    }
  }, [postCreateOpen, setPulseCreateOpen, setPulseImageUri]);
  
  const handleImagePickForGenericUpload = useCallback(async () => {
    closeSpeedDial(); 
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission denied', 'Camera roll permissions are required!');
    
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, allowsEditing: false, quality: 0.8,
    });
    
    if (pickerResult.canceled) return;
    setIsUploadingFile(true);
    
    try {
        const finalUri = pickerResult.assets[0].uri;
        await PulseService.magicUpload(finalUri);
        if (refreshAllData) await refreshAllData();
        Alert.alert("Magic Complete ✨", "Your file is now live!");
        award("Upload File");
    } catch (error) {
        if (__DEV__) console.error("Magic Upload Error:", error);
        Alert.alert("Upload Error", "Could not complete the magic upload.");
    } finally {
        setIsUploadingFile(false);
    }
  }, [closeSpeedDial, award, refreshAllData]);

  const handlePostSubmit = useCallback(async (draftText) => {
    const text = draftText || postDraftText;
    if ((!text.trim() && !postImageUri) || isPosting) return;
    setIsPosting(true);
    try {
      await createPost(text, null, postImageUri); 
      setPostDraftText(""); setPostImageUri(null); setPostCreateOpen(false); 
      award("Create Post"); setTab("Explore"); 
    } catch (error) {
      Alert.alert('Upload Failed', error.message);
    } finally { setIsPosting(false); }
  }, [postDraftText, postImageUri, isPosting, createPost, setPostDraftText, award]);
  
  const handlePulseSubmit = useCallback(async (text, imageUri, vibe) => {
    if (!imageUri || isPostingPulse) return;
    setIsPostingPulse(true);
    try {
        await createPulse(text, imageUri, vibe); 
        setPulseCreateOpen(false); setPulseImageUri(null);
        award("Create Pulse");
    } catch (error) {
        Alert.alert('Upload Failed', error.message);
    } finally { setIsPostingPulse(false); }
  }, [isPostingPulse, createPulse, setPulseCreateOpen, setPulseImageUri, award]);
  
  const handleGroupSubmit = useCallback(async () => {
    const { name, desc, category, privacy, location } = groupForm;
    if (!name.trim() || !desc.trim() || !category.trim() || isCreatingGroup) return;
    setIsCreatingGroup(true);
    
    const groupPayload = { name, description: desc, category, privacy };
    if (location.trim()) groupPayload.location = location.trim();
    
    try {
      await createGroup(groupPayload);
      setGroupForm({ name: "", desc: "", category: "Community", privacy: "Public", location: "" }); 
      setGroupCreateOpen(false); 
      award("Create Group"); setTab("Home"); 
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally { setIsCreatingGroup(false); }
  }, [groupForm, isCreatingGroup, createGroup, award]);
  
  // ────────────────────────────────────────────────────────────────────────────
  // [BUG-1 FIX] הוספת בדיקת הרשאת מיקרופון כדי למנוע קריסה!
  // ────────────────────────────────────────────────────────────────────────────
  const handleStreamRouletteStart = useCallback(async () => {
    closeSpeedDial(); 
    
    // ⭐️ התיקון שלנו: עצירה ובדיקת הרשאות לפני פתיחת המודל ⭐️
    try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Microphone Required", "KliqTap needs microphone access to join the Live Audio Room.");
            return; // מונע את פתיחת החדר ואת קריסת האפליקציה!
        }
    } catch (error) {
        if (__DEV__) console.error("Audio permission error:", error);
        return;
    }

    if (currentCallId) {
        setVoiceModalOpen(true);
        return;
    }
    const rouletteRoomId = 'ROULETTE_' + Date.now();
    if (setCurrentCallId) setCurrentCallId(rouletteRoomId);
    setVoiceModalOpen(true);
    if (findStreamRouletteMatch) findStreamRouletteMatch();
    award("Roulette Call"); 
  }, [closeSpeedDial, currentCallId, setCurrentCallId, findStreamRouletteMatch, award]);
  
  const handleDeepLinkAction = useCallback((type, targetId) => {
    setSheets(prev => ({ ...prev, third: null, fourth: null, fifth: null }));
    if (type === 'StartVideoCall') {
      setVoiceModalOpen(false); 
      setCurrentCallId(targetId || 'DEMO_VIDEO_123'); 
      setVideoModalOpen(true); 
    } else if (type === 'StartVoiceCall') {
      setVideoModalOpen(false); 
      setCurrentCallId(targetId || 'DEMO_VOICE_456'); 
      setVoiceModalOpen(true); 
    } else if (type === 'DeleteAccount') {
      handleAccountDeletionRequest();
    } else if (type === 'Logout') {
      logout();
    } else if (type === 'SubmitReport') {
      setSheets(prev => ({ ...prev, fifth: { title: "Report Submitted", body: "Thank you for helping." } }));
    }
  }, [logout, setCurrentCallId]);
  
  const handleOpenCamera = useCallback(() => {
      setVibeCheckKey('cam-' + Date.now()); 
      setIsVibeCheckOpen(true);
      closeSpeedDial();
  }, [closeSpeedDial]);

  const handleSetSecondSheet = useCallback((s) => setSheets(prev => ({...prev, second: s})), []);
  const handleSetThirdSheet = useCallback((s) => setSheets(prev => ({...prev, third: s})), []);
  const handleSetFourthSheet = useCallback((s) => setSheets(prev => ({...prev, fourth: s})), []);
  const handleSetFifthSheet = useCallback((s) => setSheets(prev => ({...prev, fifth: s})), []);
  
  const setGroupName = useCallback((v) => setGroupForm(s => ({...s, name: v})), []);
  const setGroupDesc = useCallback((v) => setGroupForm(s => ({...s, desc: v})), []);
  const setGroupCategory = useCallback((v) => setGroupForm(s => ({...s, category: v})), []);
  const setGroupPrivacy = useCallback((v) => setGroupForm(s => ({...s, privacy: v})), []);
  const setGroupLocation = useCallback((v) => setGroupForm(s => ({...s, location: v})), []);

  const openRadarSheet = useCallback(() => { handleSetSecondSheet({ source: "Radar" }); closeSpeedDial(); }, [handleSetSecondSheet, closeSpeedDial]);
  const openLeaderboardSheet = useCallback(() => { handleSetSecondSheet({ source: "Leaderboard" }); closeSpeedDial(); }, [handleSetSecondSheet, closeSpeedDial]);
  const openSettingsSheet = useCallback(() => { handleSetSecondSheet({ source: "Settings" }); closeSpeedDial(); }, [handleSetSecondSheet, closeSpeedDial]);
  const openSearchSheet = useCallback(() => { handleSetSecondSheet({ source: "Search" }); closeSpeedDial(); }, [handleSetSecondSheet, closeSpeedDial]);
  const openSupportSheet = useCallback(() => { handleSetSecondSheet({ source: "Support" }); closeSpeedDial(); }, [handleSetSecondSheet, closeSpeedDial]);

  const handleTabPress = useCallback((type, label) => {
      type === 'camera' ? handleOpenCamera() : setTab(label); 
      closeSpeedDial();
  }, [handleOpenCamera, closeSpeedDial]);

  const handleTabExtra = useCallback((type) => {
      if (type === "profile") { handleSetSecondSheet({ source: "Profile" }); closeSpeedDial(); }
      else if (type === "home") { handleSetSecondSheet({ source: "Home" }); closeSpeedDial(); }
  }, [handleSetSecondSheet, closeSpeedDial]);

  const handleAcceptIncomingCall = useCallback((callInfo) => {
    if (!callInfo) return;
    setCurrentCallId(callInfo.callId);
    if (callInfo.isVideo) {
      setVideoModalOpen(true);
    } else {
      setVoiceModalOpen(true);
    }
    if (acceptCall) acceptCall(callInfo.callId);
  }, [setCurrentCallId, acceptCall]);

  const handleDeclineIncomingCall = useCallback((callInfo) => {
    if (declineCall && callInfo?.callId) declineCall(callInfo.callId);
  }, [declineCall]);

  const allMessages = useMemo(() => getAllMessages(), []);
  const settingsItemsCallback = useCallback(() => getSettingsItems(user), [user]);
  const searchItemsCallback = useCallback(() => getSearchItems(tab), [tab]);
  const iconGridCallback = useCallback((src) => getIconGrid(src), []);

  if (!isInitialized || isAuthLoading) {
      return (
        <View style={[styles.appFrame, { justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#000' : '#F9FAFB' }]}>
            <ActivityIndicator size="large" color={Data.brand.blue} />
            <Text style={[styles.h3, { marginTop: 10, color: isDark ? '#CCC' : Data.brand.soft }]}>
                {isAuthLoading ? "Connecting..." : "Loading KliQTap..."}
            </Text>
        </View>
      );
  }
  
  if (!user) return (<AuthScreen />); 
  if (needsOnboarding) return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000' : Data.brand.bg }}> 
        <StatusBar style={isDark ? "light" : "dark"} /> 
        <OnboardingScreen />
      </SafeAreaView>
  );
  

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#000' : '#F9FAFB' }}> 
      <StatusBar style={isDark ? "light" : "dark"} /> 
      
      <View style={[styles.appFrame, { backgroundColor: 'transparent' }]}>
          <Header 
            openRadar={openRadarSheet}
            openLeaderboard={openLeaderboardSheet}
            openSettings={openSettingsSheet} 
            openSearch={openSearchSheet}
            openSupport={openSupportSheet}
          />
          
          <MainNavigator 
              user={user} tab={tab} points={points} streak={streak} badges={badges} deepItems={deepItems}
              setSecondSheet={handleSetSecondSheet} 
              setThirdSheet={handleSetThirdSheet} 
              setProfilePeek={setProfilePeek} setGroupModalTab={setGroupModalTab} 
              messageTab={messageTab} setMessageTab={setMessageTab} 
              allMessages={allMessages} 
              openChat={openChat} award={award} logout={logout}
              setTab={newTab => { setTab(newTab); closeSpeedDial(); }}
              openVoiceCall={(roomId) => { setCurrentCallId(roomId); setVoiceModalOpen(true); }}
              openVideoCall={(roomId) => { setCurrentCallId(roomId); setVideoModalOpen(true); }}
          /> 
          
          {isSpeedDialOpen ? (
              <TouchableOpacity style={localStyles.backdrop} activeOpacity={1} onPress={closeSpeedDial} />
          ) : null}

          <Animated.View 
            style={[
              localStyles.fabContainer,
              Platform.OS !== 'web' && { transform: [{ translateX: pan.x }, { translateY: pan.y }] }
            ]}
            {...panResponder.panHandlers} 
            pointerEvents="box-none"
          >
            <View style={{position: 'absolute', right: 0, bottom: 0}}>
                <SpeedDial 
                  onOpenPost={() => {setPostCreateOpen(true); closeSpeedDial();}}
                  onOpenGroup={() => {setGroupCreateOpen(true); closeSpeedDial();}}
                  onOpenAI={() => {setAiOpen(true); closeSpeedDial();}}
                  onOpenFileUpload={handleImagePickForGenericUpload}
                  onOpenBotStudio={() => { 
                      setSheets({ second: null, third: null, fourth: null, fifth: null }); 
                      setTab("BotStudio"); 
                      closeSpeedDial(); 
                  }}
                  isSpeedDialOpen={isSpeedDialOpen} onToggleMenu={toggleSpeedDial}
                />
            </View>
            <TouchableOpacity
              style={localStyles.solidVoiceFab} onPress={handleStreamRouletteStart} 
              disabled={isRouletteSearching || isUploadingFile} activeOpacity={0.9}
            >
              <Ionicons name="mic" size={28} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
          
          {isRouletteSearching ? (
              <View style={localStyles.statusPopup}>
                <ActivityIndicator color={Data.brand.ink} size="small" style={{marginRight: 8}}/>
                <Text style={{color: Data.brand.ink, fontWeight: 'bold'}}>{rouletteStatusMessage || 'Searching...'}</Text>
              </View>
          ) : null}
          
          {isUploadingFile ? (
               <View style={[localStyles.statusPopup, { backgroundColor: Data.brand.blue }]}>
                 <ActivityIndicator color="#fff" size="small" style={{marginRight: 8}} />
                 <Text style={{color: '#fff', fontWeight: 'bold'}}>Uploading Magic Post...</Text>
               </View>
          ) : null}

            <View style={[
            styles.tabs, 
            { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderTopColor: isDark ? '#333' : '#eee' },
            Platform.OS === 'web' && { 
              position: 'fixed',
              bottom: 0, 
              left: 0, 
              right: 0, 
              zIndex: 1000,
              width: '100%',
              paddingBottom: isMobileWeb ? 'calc(8px + env(safe-area-inset-bottom, 0px))' : 8,
            },
            Platform.OS !== 'web' && insets.bottom > 0 && { paddingBottom: insets.bottom }
          ]}>

            {TABS.map((tabItem) => (
                <TabBtn 
                    key={tabItem.type} label={tabItem.label} type={tabItem.type} active={tab === tabItem.label} 
                    onPress={() => handleTabPress(tabItem.type, tabItem.label)} 
                    onExtra={() => handleTabExtra(tabItem.type)}
                />
            ))}
          </View>
        </View>

        <AppModals 
            aiOpen={aiOpen} setAiOpen={setAiOpen} aiThread={aiThread} 
            isAiLoading={isAiLoading} aiInput={aiInput} setAiInput={setAiInput} 
            handleAiSubmit={handleAiSubmit}
            postCreateOpen={postCreateOpen} setPostCreateOpen={setPostCreateOpen}
            setPostImageUri={setPostImageUri} postImageUri={postImageUri}
            handleImagePick={handleImagePick} isPosting={isPosting} handlePostSubmit={handlePostSubmit}
            groupCreateOpen={groupCreateOpen} setGroupCreateOpen={setGroupCreateOpen}
            isCreatingGroup={isCreatingGroup} handleGroupSubmit={handleGroupSubmit}
            groupName={groupForm.name} setGroupName={setGroupName} 
            groupDesc={groupForm.desc} setGroupDesc={setGroupDesc}
            groupCategory={groupForm.category} setGroupCategory={setGroupCategory}
            groupPrivacy={groupForm.privacy} setGroupPrivacy={setGroupPrivacy}
            groupLocation={groupForm.location} setGroupLocation={setGroupLocation}
            secondSheet={sheets.second} setSecondSheet={handleSetSecondSheet}
            thirdSheet={sheets.third} setThirdSheet={handleSetThirdSheet}
            fourthSheet={sheets.fourth} setFourthSheet={handleSetFourthSheet}
            fifthSheet={sheets.fifth} setFifthSheet={handleSetFifthSheet}
            handleDeepLinkAction={handleDeepLinkAction} getSettingsItems={settingsItemsCallback} 
            getSearchItems={searchItemsCallback} getIconGrid={iconGridCallback}
            setCurrentCallId={setCurrentCallId} setVoiceModalOpen={setVoiceModalOpen}
            setVideoModalOpen={setVideoModalOpen} 
            setIsVibeCheckOpen={setIsVibeCheckOpen} setFullScreenImage={setFullScreenImage}
            handleAccountDeletionRequest={handleAccountDeletionRequest} handleImagePickForGenericUpload={handleImagePickForGenericUpload}
            profilePeek={profilePeek} setProfilePeek={setProfilePeek} groupUpdateOpen={groupUpdateOpen} setGroupUpdateOpen={setGroupUpdateOpen}
            videoModalOpen={videoModalOpen} voiceModalOpen={voiceModalOpen} currentCallId={currentCallId}
            isVibeCheckOpen={isVibeCheckOpen} vibeCheckKey={vibeCheckKey}
            pulseCreateOpen={pulseCreateOpen} setPulseCreateOpen={setPulseCreateOpen}
            pulseImageUri={pulseImageUri} setPulseImageUri={setPulseImageUri} 
            isPostingPulse={isPostingPulse} handlePulseSubmit={handlePulseSubmit}
            fullScreenImage={fullScreenImage}
            isAiSpeaking={isAiSpeaking}
            incomingCall={incomingCall}
            onAcceptIncomingCall={handleAcceptIncomingCall}
            onDeclineIncomingCall={handleDeclineIncomingCall}
        />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
    backdrop: {
        position: 'absolute', top: 0, left: 0, width: width, height: height,
        zIndex: 5, backgroundColor: 'transparent' 
    },
   fabContainer: {
        // שימוש ב-fixed גורם לכפתורים "לצוף" מעל התוכן ולא לזוז בגלילה (במיוחד בכרום מובייל)
        position: Platform.OS === 'web' ? 'fixed' : 'absolute', 
        
        // הגובה מהתחתית
        bottom: Platform.OS === 'web' ? 105 : 90, 
        
        // פתרון חכם למיקום הימני:
        // אם זה טלפון - נצמד לימין (20px).
        // אם זה מחשב - נשאר בתוך מסגרת ה-550px המרכזית.
        right: Platform.OS === 'web' 
            ? 'max(20px, calc(50% - 230px))' 
            : 20,
            
        zIndex: 200, 
        width: 150, 
        height: 70, 
    },
    solidVoiceFab: {
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: '#6200EE', justifyContent: 'center', alignItems: 'center',
        position: 'absolute', bottom: 0, right: 80, 
        shadowColor: "#6200EE", shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4, shadowRadius: 5, elevation: 6,
    },
    statusPopup: {
        position: 'absolute', bottom: 170, right: 16,
        backgroundColor: Data.brand.yellow, padding: 10, borderRadius: 12,
        zIndex: 11, flexDirection: 'row', alignItems: 'center',
        shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
    }
});