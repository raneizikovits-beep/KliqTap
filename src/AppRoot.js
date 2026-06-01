// client/src/AppRoot.js
// ✅ V2.0 PRODUCTION: Full architectural refactor — clean, modular, secure, scalable
// Fixes:
//   [BUG-1] Microphone permission guard before roulette/audio call (preserved)
//   [BUG-2] PanResponder disabled on web (preserved)
//   [BUG-3] IncomingCall modal wired to store (preserved)
//   [BUG-4] NEW: Location effect had no mountedRef — setState after unmount possible
//   [BUG-5] NEW: handleStreamRouletteStart missing await on findStreamRouletteMatch
//   [BUG-6] NEW: allMessages recalculated on every render (now stable useMemo)
//   [BUG-7] NEW: groupForm field setters caused unnecessary re-renders

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  ActivityIndicator,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Linking,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useShallow } from "zustand/react/shallow";

import { useAppStore } from "./store/useAppStore";
import * as PulseService from "./store/pulse.service";
import * as Data from "./constants/data";
import { styles } from "./constants/styles";
import { deepItems } from "./constants/helpers";
import {
  getSettingsItems,
  getSearchItems,
  getIconGrid,
  getAllMessages,
} from "./constants/sheetConfig";

import Header from "./components/Header";
import TabBtn from "./components/TabBar";
import MainNavigator from "./navigation/MainNavigator";
import SpeedDial from "./components/SpeedDial";
import AuthScreen from "./screens/AuthScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import AppModals from "./components/AppModals";
import { useWebScrollFix } from "./hooks/useWebScrollFix";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const APP_NAME_DISPLAY = Data.APP_NAME || "KliqTap";
const DELETION_URL =
  "https://www.kliq-tap.com/privacy/account-deletion-request";

const { height, width } = Dimensions.get("window");

/**
 * Tab definitions — static, defined outside the component so the
 * array reference is never recreated on re-render.
 */
const TABS = [
  { label: "Home",     type: "home"          },
  { label: "Tribes",   type: "groups"        },
  { label: "Explore",  type: "explore"       },
  { label: "Arena",    type: "arena"         }, // ✅ שונה מ-Camera ל-Arena
  { label: "Messages", type: "messages"      },
  { label: "Alerts",   type: "notifications" },
  { label: "Profile",  type: "profile"       },
];

/**
 * Default AI welcome message — stable object, lives outside component.
 */
const AI_WELCOME_MESSAGE = {
  role: "system",
  text: `Hi, I am ${APP_NAME_DISPLAY} AI. How can I help you connect today?`,
  time: "just now",
  suggestions: ["Suggest group", "Find nearby", "Start call"],
};

/**
 * Default group form shape — stable reference, used for resets.
 */
const DEFAULT_GROUP_FORM = {
  name:     "",
  desc:     "",
  category: "Community",
  privacy:  "Public",
  location: "",
};

// ─────────────────────────────────────────────
// Module-level handler (no component state needed)
// ─────────────────────────────────────────────

/**
 * Opens the account deletion URL in the system browser after
 * a confirmation alert. Defined at module level — never recreated.
 */
const handleAccountDeletionRequest = () => {
  Alert.alert(
    "Delete Account & Data",
    "You are about to open a secure web page to request the permanent deletion of your KliqTap account. This action is irreversible.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue",
        style: "destructive",
        onPress: () =>
          Linking.openURL(DELETION_URL).catch((err) => {
            if (__DEV__) console.error("Couldn't open URL:", err);
          }),
      },
    ]
  );
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/**
 * Full-screen splash shown while the app is initialising or authenticating.
 */
const SplashScreen = ({ isDark, message }) => (
  <View
    style={[
      styles.appFrame,
      {
        justifyContent:   "center",
        alignItems:       "center",
        backgroundColor:  isDark ? "#000" : "#F9FAFB",
      },
    ]}
  >
    <ActivityIndicator size="large" color={Data.brand.blue} />
    <Text
      style={[styles.h3, { marginTop: 10, color: isDark ? "#CCC" : Data.brand.soft }]}
    >
      {message}
    </Text>
  </View>
);

/**
 * Semi-transparent backdrop that closes the SpeedDial when tapped.
 */
const SpeedDialBackdrop = ({ onPress }) => (
  <TouchableOpacity
    style={localStyles.backdrop}
    activeOpacity={1}
    onPress={onPress}
    accessibilityLabel="Close speed dial"
  />
);

/**
 * Status popup — shown during roulette search or file upload.
 */
const StatusPopup = ({ isDark: _isDark, color, textColor, icon, message }) => (
  <View style={[localStyles.statusPopup, { backgroundColor: color }]}>
    <ActivityIndicator color={textColor} size="small" style={{ marginRight: 8 }} />
    <Text style={{ color: textColor, fontWeight: "bold" }}>{message}</Text>
  </View>
);

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function AppRoot() {

  // ─── Store (granular shallow selector) ────
  const {
    user,
    needsOnboarding,
    isRouletteSearching,
    rouletteStatusMessage,
    isInitialized,
    isAuthLoading,
    token,
    points,
    streak,
    badges,
    award,
    logout,
    initialize,
    postDraftText,
    setPostDraftText,
    generateAiResponse,
    createPost,
    createGroup,
    openChat,
    findStreamRouletteMatch,
    setCurrentCallId,
    currentCallId,
    createPulse,
    uploadFile,
    pulseCreateOpen,
    setPulseCreateOpen,
    pulseImageUri,
    setPulseImageUri,
    // 🚀 הוסר מהמקומי ומושך מהסטור הגלובלי! 🚀
    postCreateOpen,
    setPostCreateOpen,
    postImageUri,
    setPostImageUri,
    triggerOpenProfile,
    setTriggerOpenProfile,
    refreshAllData,
    isAiSpeaking,
    setUserLocation,
    incomingCall,
    acceptCall,
    declineCall,
    settings,
  } = useAppStore(
    useShallow((state) => ({
      user:                  state.user,
      needsOnboarding:       state.needsOnboarding,
      isRouletteSearching:   state.isRouletteSearching,
      rouletteStatusMessage: state.rouletteStatusMessage,
      isInitialized:         state.isInitialized,
      isAuthLoading:         state.isAuthLoading,
      token:                 state.token,
      points:                state.points,
      streak:                state.streak,
      badges:                state.badges,
      award:                 state.award,
      logout:                state.logout,
      initialize:            state.initialize,
      postDraftText:         state.postDraftText,
      setPostDraftText:      state.setPostDraftText,
      generateAiResponse:    state.generateAiResponse,
      createPost:            state.createPost,
      createGroup:           state.createGroup,
      openChat:              state.openChat,
      findStreamRouletteMatch: state.findStreamRouletteMatch,
      setCurrentCallId:      state.setCurrentCallId,
      currentCallId:         state.currentCallId,
      createPulse:           state.createPulse,
      uploadFile:            state.uploadFile,
      pulseCreateOpen:       state.pulseCreateOpen,
      setPulseCreateOpen:    state.setPulseCreateOpen,
      pulseImageUri:         state.pulseImageUri,
      setPulseImageUri:      state.setPulseImageUri,
      // 🚀 חיבור למשתני ה-Feed החדשים מהסטור:
      postCreateOpen:        state.postCreateOpen,
      setPostCreateOpen:     state.setPostCreateOpen,
      postImageUri:          state.postImageUri,
      setPostImageUri:       state.setPostImageUri,
      triggerOpenProfile:    state.triggerOpenProfile,
      setTriggerOpenProfile: state.setTriggerOpenProfile,
      refreshAllData:        state.refreshAllData,
      isAiSpeaking:          state.isAiSpeaking ?? false,
      setUserLocation:       state.setUserLocation,
      incomingCall:          state.incomingCall   || null,
      acceptCall:            state.acceptCall     || null,
      declineCall:           state.declineCall    || null,
      settings:              state.userSettings   || {},
    }))
  );

  const isDark = settings.darkMode === true;
  const insets = useSafeAreaInsets();
  const isMobileWeb =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.innerWidth < 768;

  // ─── Abort-safe ref ────────────────────────
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── UI state ─────────────────────────────
  const [aiOpen, setAiOpen]         = useState(false);
  const [aiThread, setAiThread]     = useState([AI_WELCOME_MESSAGE]);
  const [aiInput, setAiInput]       = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 🚀 המשתנים המקומיים הוסרו כדי לתת לסטור הגלובלי לנהל את מסך ה-Feed!
  const [isPosting, setIsPosting]             = useState(false);
  const [isPostingPulse, setIsPostingPulse]   = useState(false);

  const [groupCreateOpen, setGroupCreateOpen]   = useState(false);
  const [isCreatingGroup, setIsCreatingGroup]   = useState(false);
  // FIX: groupForm as a single state object — field setters use functional
  // updates to avoid stale closure bugs and reduce re-render count.
  const [groupForm, setGroupForm] = useState(DEFAULT_GROUP_FORM);

  const [sheets, setSheets] = useState({
    second: null, third: null, fourth: null, fifth: null,
  });
  const [tab, setTab]                       = useState("Home");
  const [profilePeek, setProfilePeek]       = useState(null);
  const [groupUpdateOpen, setGroupUpdateOpen] = useState(null);
  const [groupModalTab, setGroupModalTab]   = useState("members");

  const [messageTab, setMessageTab]         = useState("CHATS");
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [isVibeCheckOpen, setIsVibeCheckOpen] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [vibeCheckKey, setVibeCheckKey]       = useState("cam-init");

  // ─── SpeedDial toggles ────────────────────
  const toggleSpeedDial = useCallback(() => setIsSpeedDialOpen((p) => !p), []);
  const closeSpeedDial  = useCallback(() => setIsSpeedDialOpen(false), []);

  // ─── Draggable FAB (PanResponder) ─────────
  const pan       = useRef(new Animated.ValueXY()).current;
  const panOffset = useRef({ x: 0, y: 0 }).current;

  // BUG-2 (preserved): PanResponder disabled on web to prevent scroll blocking.
  const panResponder = useMemo(() => {
    if (Platform.OS === "web") return { panHandlers: {} };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onPanResponderGrant: () =>
        pan.setOffset({ x: panOffset.x, y: panOffset.y }),
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, g) => {
        panOffset.x += g.dx;
        panOffset.y += g.dy;
        pan.flattenOffset();
      },
    });
  }, [pan, panOffset]);

  // ─── Web scroll fix ───────────────────────
  useWebScrollFix();

  // ─── App initialisation ───────────────────
  useEffect(() => {
    initialize();
    // initialize is a stable store reference; run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Location (two-stage: fast then accurate) ──
  // BUG-4 FIX: added mountedRef guard — setUserLocation was called after
  // unmount if the component was torn down mid-async.
  useEffect(() => {
    if (!user) return;

    const fetchFastLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const fast = await Location.getLastKnownPositionAsync();
        if (fast && mountedRef.current) {
          setUserLocation({
            latitude:  fast.coords.latitude,
            longitude: fast.coords.longitude,
          });
        }

        const accurate = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (accurate && mountedRef.current) {
          setUserLocation({
            latitude:  accurate.coords.latitude,
            longitude: accurate.coords.longitude,
          });
        }
      } catch (error) {
        if (__DEV__) console.warn("[AppRoot] Location error:", error);
      }
    };

    fetchFastLocation();
  }, [user, setUserLocation]);

  // ─── Profile deep-link trigger ────────────
  useEffect(() => {
    if (!triggerOpenProfile) return;
    setSheets((s) => ({
      ...s,
      second: { source: "Profile", userId: triggerOpenProfile },
    }));
    setTriggerOpenProfile(null);
  }, [triggerOpenProfile, setTriggerOpenProfile]);

  // ─────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────

  // ─── AI ───────────────────────────────────
  const handleAiSubmit = useCallback(
    async (promptOverride) => {
      const newPrompt = (promptOverride || aiInput).trim();
      if (!newPrompt || isAiLoading) return;

      setAiInput("");
      if (mountedRef.current) setIsAiLoading(true);
      setAiThread((prev) => [
        ...prev,
        { role: "user", text: newPrompt, time: "now" },
      ]);

      try {
        const aiResponse = await generateAiResponse(newPrompt);
        const responseText =
          (typeof aiResponse === "string"
            ? aiResponse
            : aiResponse?.text) || "No response received.";

        const suggestions = [];
        if (responseText.toLowerCase().includes("group"))
          suggestions.push("Suggest group");
        if (responseText.toLowerCase().includes("call"))
          suggestions.push("Start call");

        if (mountedRef.current) {
          setAiThread((prev) => [
            ...prev,
            {
              role: "assistant",
              text: responseText,
              time: "now",
              suggestions: suggestions.length > 0 ? suggestions : null,
            },
          ]);
        }
        award("AI Query");
      } catch (e) {
        if (mountedRef.current) {
          setAiThread((prev) => [
            ...prev,
            {
              role: "system",
              text: "Error: Failed to get response from AI.",
              time: "now",
            },
          ]);
        }
      } finally {
        if (mountedRef.current) setIsAiLoading(false);
      }
    },
    [aiInput, isAiLoading, generateAiResponse, award]
  );

  // ─── Image pick (post / pulse) ────────────
  const handleImagePick = useCallback(
    async (target) => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted")
        return Alert.alert(
          "Permission denied",
          "Camera roll permissions are required!"
        );

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:    ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality:       0.9,
      });
      if (result.canceled) return;

      const uri = result.assets[0].uri;
      setSheets((prev) => ({ ...prev, second: null }));

      if (target === "post") {
        setPostImageUri(uri);
        if (!postCreateOpen) setPostCreateOpen(true);
      } else if (target === "story") {
        setPulseImageUri(uri);
        setPulseCreateOpen(true);
      }
    },
    [postCreateOpen, setPulseCreateOpen, setPulseImageUri, setPostImageUri, setPostCreateOpen]
  );

  // ─── Magic upload (generic file) ──────────
  const handleImagePickForGenericUpload = useCallback(async () => {
    closeSpeedDial();
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted")
      return Alert.alert(
        "Permission denied",
        "Camera roll permissions are required!"
      );

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality:       0.8,
    });
    if (result.canceled) return;

    if (mountedRef.current) setIsUploadingFile(true);
    try {
      const finalUri = result.assets[0].uri;
      await PulseService.magicUpload(finalUri);
      if (refreshAllData) await refreshAllData();
      Alert.alert("Magic Complete ✨", "Your file is now live!");
      award("Upload File");
    } catch (error) {
      if (__DEV__) console.error("[AppRoot] Magic Upload Error:", error);
      Alert.alert("Upload Error", "Could not complete the magic upload.");
    } finally {
      if (mountedRef.current) setIsUploadingFile(false);
    }
  }, [closeSpeedDial, award, refreshAllData]);

  // ─── Post submit ──────────────────────────
  const handlePostSubmit = useCallback(
    async (draftText) => {
      const text = draftText || postDraftText;
      if ((!text.trim() && !postImageUri) || isPosting) return;

      if (mountedRef.current) setIsPosting(true);
      try {
        await createPost(text, null, postImageUri);
        setPostDraftText("");
        setPostImageUri(null);
        setPostCreateOpen(false);
        award("Create Post");
        setTab("Explore");
      } catch (error) {
        Alert.alert("Upload Failed", error.message);
      } finally {
        if (mountedRef.current) setIsPosting(false);
      }
    },
    [postDraftText, postImageUri, isPosting, createPost, setPostDraftText, setPostImageUri, setPostCreateOpen, award]
  );

  // ─── Pulse submit ─────────────────────────
  const handlePulseSubmit = useCallback(
    async (text, imageUri, vibe) => {
      if (!imageUri || isPostingPulse) return;

      if (mountedRef.current) setIsPostingPulse(true);
      try {
        await createPulse(text, imageUri, vibe);
        setPulseCreateOpen(false);
        setPulseImageUri(null);
        award("Create Pulse");
      } catch (error) {
        Alert.alert("Upload Failed", error.message);
      } finally {
        if (mountedRef.current) setIsPostingPulse(false);
      }
    },
    [isPostingPulse, createPulse, setPulseCreateOpen, setPulseImageUri, award]
  );

  // ─── Group submit ─────────────────────────
  const handleGroupSubmit = useCallback(async () => {
    const { name, desc, category, privacy, location } = groupForm;
    if (!name.trim() || !desc.trim() || !category.trim() || isCreatingGroup)
      return;

    if (mountedRef.current) setIsCreatingGroup(true);
    const payload = { name, description: desc, category, privacy };
    if (location.trim()) payload.location = location.trim();

    try {
      await createGroup(payload);
      setGroupForm(DEFAULT_GROUP_FORM);
      setGroupCreateOpen(false);
      award("Create Group");
      setTab("Home");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      if (mountedRef.current) setIsCreatingGroup(false);
    }
  }, [groupForm, isCreatingGroup, createGroup, award]);

  // ─── Stream roulette (BUG-1 preserved + BUG-5 fixed) ────────────────
  // BUG-5 FIX: findStreamRouletteMatch was called without await — if it
  // throws, the error was silently swallowed. Now wrapped in try/catch.
  const handleStreamRouletteStart = useCallback(async () => {
    closeSpeedDial();

    // BUG-1 (preserved): audio permission gate prevents crash
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Microphone Required",
          "KliqTap needs microphone access to join the Live Audio Room."
        );
        return;
      }
    } catch (error) {
      if (__DEV__) console.error("[AppRoot] Audio permission error:", error);
      return;
    }

    if (currentCallId) {
      setVoiceModalOpen(true);
      return;
    }

    const rouletteRoomId = "ROULETTE_" + Date.now();
    if (setCurrentCallId) setCurrentCallId(rouletteRoomId);
    setVoiceModalOpen(true);

    try {
      if (findStreamRouletteMatch) await findStreamRouletteMatch();
    } catch (e) {
      if (__DEV__)
        console.error("[AppRoot] findStreamRouletteMatch error:", e);
    }

    award("Roulette Call");
  }, [
    closeSpeedDial,
    currentCallId,
    setCurrentCallId,
    findStreamRouletteMatch,
    award,
  ]);

  // ─── Deep-link actions ────────────────────
  const handleDeepLinkAction = useCallback(
    (type, targetId) => {
      setSheets((prev) => ({
        ...prev,
        third: null,
        fourth: null,
        fifth: null,
      }));

      if (type === "StartVideoCall") {
        setVoiceModalOpen(false);
        setCurrentCallId(targetId || "DEMO_VIDEO_123");
        setVideoModalOpen(true);
      } else if (type === "StartVoiceCall") {
        setVideoModalOpen(false);
        setCurrentCallId(targetId || "DEMO_VOICE_456");
        setVoiceModalOpen(true);
      } else if (type === "DeleteAccount") {
        handleAccountDeletionRequest();
      } else if (type === "Logout") {
        logout();
      } else if (type === "SubmitReport") {
        setSheets((prev) => ({
          ...prev,
          fifth: { title: "Report Submitted", body: "Thank you for helping." },
        }));
      }
    },
    [logout, setCurrentCallId]
  );

  // ─── Camera open ─────────────────────────
  const handleOpenCamera = useCallback(() => {
    setVibeCheckKey("cam-" + Date.now());
    setIsVibeCheckOpen(true);
    closeSpeedDial();
  }, [closeSpeedDial]);

  // ─── Sheet setters (stable) ───────────────
  const handleSetSecondSheet = useCallback(
    (s) => setSheets((prev) => ({ ...prev, second: s })),
    []
  );
  const handleSetThirdSheet = useCallback(
    (s) => setSheets((prev) => ({ ...prev, third: s })),
    []
  );
  const handleSetFourthSheet = useCallback(
    (s) => setSheets((prev) => ({ ...prev, fourth: s })),
    []
  );
  const handleSetFifthSheet = useCallback(
    (s) => setSheets((prev) => ({ ...prev, fifth: s })),
    []
  );

  // ─── Group form field setters (BUG-7 FIX) ─
  // FIX: one setter per field caused 5 separate function allocations.
  // Replaced with a single parameterised setter — stable, reusable.
  const setGroupField = useCallback(
    (field) => (value) =>
      setGroupForm((s) => ({ ...s, [field]: value })),
    []
  );
  const setGroupName     = useMemo(() => setGroupField("name"),     [setGroupField]);
  const setGroupDesc     = useMemo(() => setGroupField("desc"),     [setGroupField]);
  const setGroupCategory = useMemo(() => setGroupField("category"), [setGroupField]);
  const setGroupPrivacy  = useMemo(() => setGroupField("privacy"),  [setGroupField]);
  const setGroupLocation = useMemo(() => setGroupField("location"), [setGroupField]);

  // ─── Quick sheet openers ──────────────────
  const openRadarSheet       = useCallback(() => { handleSetSecondSheet({ source: "Radar" });       closeSpeedDial(); }, [handleSetSecondSheet, closeSpeedDial]);
  const openLeaderboardSheet = useCallback(() => { handleSetSecondSheet({ source: "Leaderboard" }); closeSpeedDial(); }, [handleSetSecondSheet, closeSpeedDial]);
  const openSettingsSheet    = useCallback(() => { handleSetSecondSheet({ source: "Settings" });    closeSpeedDial(); }, [handleSetSecondSheet, closeSpeedDial]);
  const openSearchSheet      = useCallback(() => { handleSetSecondSheet({ source: "Search" });      closeSpeedDial(); }, [handleSetSecondSheet, closeSpeedDial]);
  const openSupportSheet     = useCallback(() => { handleSetSecondSheet({ source: "Support" });     closeSpeedDial(); }, [handleSetSecondSheet, closeSpeedDial]);

  // ─── Tab press ────────────────────────────
  const handleTabPress = useCallback(
    (type, label) => {
      // ✅ camera הוסר מהטאבים — Arena מנווט כמו כל טאב רגיל
      setTab(label);
      closeSpeedDial();
    },
    [closeSpeedDial]
  );

  const handleTabExtra = useCallback(
    (type) => {
      if (type === "profile") {
        handleSetSecondSheet({ source: "Profile" });
        closeSpeedDial();
      } else if (type === "home") {
        handleSetSecondSheet({ source: "Home" });
        closeSpeedDial();
      }
    },
    [handleSetSecondSheet, closeSpeedDial]
  );

  // ─── Incoming call (BUG-3 preserved) ──────
  const handleAcceptIncomingCall = useCallback(
    (callInfo) => {
      if (!callInfo) return;
      setCurrentCallId(callInfo.callId);
      if (callInfo.isVideo) {
        setVideoModalOpen(true);
      } else {
        setVoiceModalOpen(true);
      }
      if (acceptCall) acceptCall(callInfo.callId);
    },
    [setCurrentCallId, acceptCall]
  );

  const handleDeclineIncomingCall = useCallback(
    (callInfo) => {
      if (declineCall && callInfo?.callId) declineCall(callInfo.callId);
    },
    [declineCall]
  );

  // ─── Config callbacks ─────────────────────
  // BUG-6 FIX: getAllMessages() was called in a useMemo without dependencies,
  // but originally called inline on every render. Now correctly memoised.
  const allMessages          = useMemo(() => getAllMessages(), []);
  const settingsItemsCallback = useCallback(() => getSettingsItems(user), [user]);
  const searchItemsCallback   = useCallback(() => getSearchItems(tab),   [tab]);
  const iconGridCallback      = useCallback((src) => getIconGrid(src),   []);

  // ─────────────────────────────────────────────
  // Render guards
  // ─────────────────────────────────────────────

  if (!isInitialized || isAuthLoading) {
    return (
      <SplashScreen
        isDark={isDark}
        message={isAuthLoading ? "Connecting..." : `Loading ${APP_NAME_DISPLAY}...`}
      />
    );
  }

  if (!user) return <AuthScreen />;

  if (needsOnboarding) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: isDark ? "#000" : Data.brand.bg }}
      >
        <StatusBar style={isDark ? "light" : "dark"} />
        <OnboardingScreen />
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? "#000" : "#F9FAFB" }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={[styles.appFrame, { backgroundColor: "transparent" }]}>

        {/* ── Header ─────────────────────────── */}
        <Header
          openRadar={openRadarSheet}
          openLeaderboard={openLeaderboardSheet}
          openSettings={openSettingsSheet}
          openSearch={openSearchSheet}
          openSupport={openSupportSheet}
        />

        {/* ── Main content ───────────────────── */}
        <MainNavigator
          user={user}
          tab={tab}
          points={points}
          streak={streak}
          badges={badges}
          deepItems={deepItems}
          setSecondSheet={handleSetSecondSheet}
          setThirdSheet={handleSetThirdSheet}
          setProfilePeek={setProfilePeek}
          setGroupModalTab={setGroupModalTab}
          messageTab={messageTab}
          setMessageTab={setMessageTab}
          allMessages={allMessages}
          openChat={openChat}
          award={award}
          logout={logout}
          setTab={(newTab) => { setTab(newTab); closeSpeedDial(); }}
          openVoiceCall={(roomId) => {
            setCurrentCallId(roomId);
            setVoiceModalOpen(true);
          }}
          openVideoCall={(roomId) => {
            setCurrentCallId(roomId);
            setVideoModalOpen(true);
          }}
        />

        {/* ── SpeedDial backdrop ─────────────── */}
        {isSpeedDialOpen && <SpeedDialBackdrop onPress={closeSpeedDial} />}

        {/* ── Draggable FAB container ────────── */}
        <Animated.View
          style={[
            localStyles.fabContainer,
            Platform.OS !== "web" && {
              transform: [{ translateX: pan.x }, { translateY: pan.y }],
            },
          ]}
          {...panResponder.panHandlers}
          pointerEvents="box-none"
        >
          <View style={{ position: "absolute", right: 0, bottom: 0 }}>
            <SpeedDial
              onOpenPost={() => { setPostCreateOpen(true); closeSpeedDial(); }}
              onOpenGroup={() => { setGroupCreateOpen(true); closeSpeedDial(); }}
              onOpenAI={() => { setAiOpen(true); closeSpeedDial(); }}
              onOpenCamera={handleOpenCamera}
              onOpenFileUpload={handleImagePickForGenericUpload}
              onOpenBotStudio={() => {
                setSheets({ second: null, third: null, fourth: null, fifth: null });
                setTab("BotStudio");
                closeSpeedDial();
              }}
              isSpeedDialOpen={isSpeedDialOpen}
              onToggleMenu={toggleSpeedDial}
            />
          </View>

          <TouchableOpacity
            style={localStyles.solidVoiceFab}
            onPress={handleStreamRouletteStart}
            disabled={isRouletteSearching || isUploadingFile}
            activeOpacity={0.9}
            accessibilityLabel="Start voice roulette"
            accessibilityRole="button"
          >
            <Ionicons name="mic" size={28} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Status popups ──────────────────── */}
        {isRouletteSearching && (
          <StatusPopup
            color={Data.brand.yellow}
            textColor={Data.brand.ink}
            message={rouletteStatusMessage || "Searching..."}
          />
        )}
        {isUploadingFile && (
          <StatusPopup
            color={Data.brand.blue}
            textColor="#fff"
            message="Uploading Magic Post..."
          />
        )}

        {/* ── Tab bar ────────────────────────── */}
        <View
          style={[
            styles.tabs,
            {
              backgroundColor: isDark ? "#1C1C1E" : "#fff",
              borderTopColor:  isDark ? "#333"    : "#eee",
            },
            Platform.OS === "web" && {
              position:    "fixed",
              bottom:      0,
              left:        0,
              right:       0,
              zIndex:      1000,
              width:       "100%",
              paddingBottom: isMobileWeb
                ? "calc(8px + env(safe-area-inset-bottom, 0px))"
                : 8,
            },
            Platform.OS !== "web" &&
              insets.bottom > 0 && { paddingBottom: insets.bottom },
          ]}
        >
          {TABS.map((tabItem) => (
            <TabBtn
              key={tabItem.type}
              label={tabItem.label}
              type={tabItem.type}
              active={tab === tabItem.label}
              onPress={() => handleTabPress(tabItem.type, tabItem.label)}
              onExtra={() => handleTabExtra(tabItem.type)}
            />
          ))}
        </View>
      </View>

      {/* ── All modals ─────────────────────── */}
      <AppModals
        aiOpen={aiOpen}                         setAiOpen={setAiOpen}
        aiThread={aiThread}
        isAiLoading={isAiLoading}
        aiInput={aiInput}                       setAiInput={setAiInput}
        handleAiSubmit={handleAiSubmit}

        postCreateOpen={postCreateOpen}         setPostCreateOpen={setPostCreateOpen}
        setPostImageUri={setPostImageUri}       postImageUri={postImageUri}
        handleImagePick={handleImagePick}
        isPosting={isPosting}                   handlePostSubmit={handlePostSubmit}

        groupCreateOpen={groupCreateOpen}       setGroupCreateOpen={setGroupCreateOpen}
        isCreatingGroup={isCreatingGroup}       handleGroupSubmit={handleGroupSubmit}
        groupName={groupForm.name}              setGroupName={setGroupName}
        groupDesc={groupForm.desc}              setGroupDesc={setGroupDesc}
        groupCategory={groupForm.category}      setGroupCategory={setGroupCategory}
        groupPrivacy={groupForm.privacy}        setGroupPrivacy={setGroupPrivacy}
        groupLocation={groupForm.location}      setGroupLocation={setGroupLocation}

        secondSheet={sheets.second}             setSecondSheet={handleSetSecondSheet}
        thirdSheet={sheets.third}               setThirdSheet={handleSetThirdSheet}
        fourthSheet={sheets.fourth}             setFourthSheet={handleSetFourthSheet}
        fifthSheet={sheets.fifth}               setFifthSheet={handleSetFifthSheet}

        handleDeepLinkAction={handleDeepLinkAction}
        getSettingsItems={settingsItemsCallback}
        getSearchItems={searchItemsCallback}
        getIconGrid={iconGridCallback}

        setCurrentCallId={setCurrentCallId}
        setVoiceModalOpen={setVoiceModalOpen}
        setVideoModalOpen={setVideoModalOpen}
        setIsVibeCheckOpen={setIsVibeCheckOpen}
        setFullScreenImage={setFullScreenImage}

        handleAccountDeletionRequest={handleAccountDeletionRequest}
        handleImagePickForGenericUpload={handleImagePickForGenericUpload}

        profilePeek={profilePeek}               setProfilePeek={setProfilePeek}
        groupUpdateOpen={groupUpdateOpen}        setGroupUpdateOpen={setGroupUpdateOpen}
        groupModalTab={groupModalTab}

        videoModalOpen={videoModalOpen}
        voiceModalOpen={voiceModalOpen}
        currentCallId={currentCallId}

        isVibeCheckOpen={isVibeCheckOpen}        vibeCheckKey={vibeCheckKey}

        pulseCreateOpen={pulseCreateOpen}        setPulseCreateOpen={setPulseCreateOpen}
        pulseImageUri={pulseImageUri}            setPulseImageUri={setPulseImageUri}
        isPostingPulse={isPostingPulse}          handlePulseSubmit={handlePulseSubmit}

        fullScreenImage={fullScreenImage}
        isAiSpeaking={isAiSpeaking}

        incomingCall={incomingCall}
        onAcceptIncomingCall={handleAcceptIncomingCall}
        onDeclineIncomingCall={handleDeclineIncomingCall}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────

const localStyles = StyleSheet.create({
  backdrop: {
    position:        "absolute",
    top:             0,
    left:            0,
    width:           width,
    height:          height,
    zIndex:          5,
    backgroundColor: "transparent",
  },
  fabContainer: {
    position: Platform.OS === "web" ? "fixed" : "absolute",
    bottom:   Platform.OS === "web" ? 105 : 90,
    right:    Platform.OS === "web"
      ? "max(20px, calc(50% - 230px))"
      : 20,
    zIndex: 200,
    width:  150,
    height: 70,
  },
  solidVoiceFab: {
    width:           60,
    height:          60,
    borderRadius:    30,
    backgroundColor: "#6200EE",
    justifyContent:  "center",
    alignItems:      "center",
    position:        "absolute",
    bottom:          0,
    right:           80,
    shadowColor:     "#6200EE",
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.4,
    shadowRadius:    5,
    elevation:       6,
  },
  statusPopup: {
    position:        "absolute",
    bottom:          170,
    right:           16,
    padding:         10,
    borderRadius:    12,
    zIndex:          11,
    flexDirection:   "row",
    alignItems:      "center",
    shadowColor:     "#000",
    shadowOpacity:   0.1,
    shadowRadius:    4,
    elevation:       3,
  },
});