// client/src/components/modals/SheetModals.js
// ⭐️ V3.2 PRODUCTION: INTEGRATED GENUINE GROUP DETAILS SHEET + AUTOMATIC TREND ROUTER ⭐️

import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, Modal, TextInput, Alert, ScrollView, 
  Switch, StyleSheet, SafeAreaView, ActivityIndicator, Dimensions, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient'; 
import { styles as globalStyles } from '../../constants/styles';
import { brand } from '../../constants/data';
import { useAppStore } from '../../store/useAppStore'; 
import SupportScreen from '../../screens/SupportScreen'; 
import SearchScreen from '../../screens/SearchScreen'; 
import SettingsScreen from '../../screens/SettingsScreen'; 
import BotStudioScreen from '../../screens/BotStudioScreen'; 
import BaseSheet from './BaseSheet';
import { SettingItem, GridItem } from './SheetComponents';
import { PulseCreationOptionsView, TrendOptionsView, CommentsView, LocationPickerView } from './SheetViews';

// ⭐️ KLIQMIND FIX: יבוא של קובץ הקבוצות האמיתי והמעוצב שלך ומחיקת הכפילות הישנה ⭐️
import GroupDetailsSheet from '../GroupDetailsSheet';

// ייבוא 10 חדרים הטרנדים החדשים
import { KaraokeRoom } from './KaraokeRoom';
import { DanceChallenge } from './DanceChallenge';
import { PhotoStudio } from './PhotoStudio';
import { VoiceClip } from './VoiceClip';
import { VideoLab } from './VideoLab';
import { StoryComposer } from './StoryComposer';
import { TopicChat } from './TopicChat'; 
import { LiveRoom } from './LiveRoom'; 
import { PollVote } from './PollVote'; 
import { DuetCompose } from './DuetCompose';

const { width } = Dimensions.get('window');

const TrendPlaceholderView = ({ title, subtitle, icon, color, isDark, onClose, openVoiceCall, openVideoCall, openVibeCheck }) => {
    return (
        <View style={{ padding: 24, alignItems: 'center', backgroundColor: isDark ? '#1C1C1E' : '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: color + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                <Ionicons name={icon} size={40} color={color} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#fff' : '#000', marginBottom: 8 }}>{title}</Text>
            <Text style={{ fontSize: 16, color: isDark ? '#aaa' : '#555', textAlign: 'center', marginBottom: 30 }}>{subtitle}</Text>
            
            <View style={{ flexDirection: 'row', gap: 12, width: '100%', justifyContent: 'center' }}>
                {openVibeCheck && (
                    <TouchableOpacity onPress={() => { onClose(); setTimeout(() => openVibeCheck(), 300); }} style={{ flex: 1, backgroundColor: color, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Open Camera</Text>
                    </TouchableOpacity>
                )}
                {openVoiceCall && !openVibeCheck && (
                    <TouchableOpacity onPress={() => { onClose(); setTimeout(() => openVoiceCall('trend_voice'), 300); }} style={{ flex: 1, backgroundColor: color, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Join Voice</Text>
                    </TouchableOpacity>
                )}
                 {openVideoCall && !openVibeCheck && !openVoiceCall && (
                    <TouchableOpacity onPress={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }} style={{ flex: 1, backgroundColor: color, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Join Video</Text>
                    </TouchableOpacity>
                )}
                {!openVibeCheck && !openVoiceCall && !openVideoCall && (
                    <TouchableOpacity onPress={onClose} style={{ flex: 1, backgroundColor: color, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Let's Go!</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

export const SecondSheet = ({ 
    sheet, onClose, onThird, onFourth, onFifth, 
    onDeepLink, getSettingsItems, getSearchItems, getIconGrid, 
    openVoiceCall, openVideoCall, openVibeCheck, onOpenAvatar, openDeletionLink,
    onStartImageUpload, setThirdSheet, setFourthSheet, setFifthSheet,
    setProfilePeek, setSecondSheet 
}) => {
    const { userSettings, setPulseCreateOpen } = useAppStore(state => ({ userSettings: state.userSettings, setPulseCreateOpen: state.setPulseCreateOpen }));
    const isDark = userSettings?.darkMode === true;
    const [currentView, setCurrentView] = useState(sheet ? sheet.source : null);
    const [ticketSubject, setTicketSubject] = useState('');
    const [ticketMessage, setTicketMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    useEffect(() => { if (sheet) setCurrentView(sheet.source); }, [sheet]);

    if (!sheet) return null;

    const handleNavigation = (item) => {
        if (item.next === 'ProfilePeek') { onClose(); setTimeout(() => setProfilePeek({ userId: item.userId || 'demo1' }), 300); return; }
        if (item.next === 'Browser' && item.url) { onClose(); setTimeout(() => onDeepLink(item.url), 300); return; }
        if (item.next === 'SupportPage') { setSecondSheet({ source: 'Support' }); return; }
        if (item.next === 'CreateTicket') { setSecondSheet({ source: 'CreateTicket' }); return; }
        if (item.next === 'TicketDetails') { setSecondSheet({ source: 'TicketDetails', ticket: item }); return; }
        if (item.next === 'ChatScreen') { onClose(); setTimeout(() => { alert(`Opening chat for ticket #${item.id}`); }, 300); return; }
        if (item.next === 'AccountDeletion') { onClose(); setTimeout(() => openDeletionLink(), 300); return; }

        const sheetData = { source: item.next, title: item.title, items: item.items || [] };
        if (sheet.source === 'Settings' || sheet.source === 'Search') {
            onThird({ ...sheetData, onDeepLink });
        } else {
            setCurrentView(item.next);
        }
    };

    const SUPPORT_SUB_PAGES = ['CreateTicket', 'TicketDetails'];

    const handleThirdTransition = (item) => {
        if (item.next === 'ProfilePeek') { onClose(); setTimeout(() => setProfilePeek({ userId: item.userId || 'demo1' }), 300); return; }
        if (item.next === 'Browser' && item.url) { onClose(); setTimeout(() => onDeepLink(item.url), 300); return; }
        const sheetData = { source: item.next, title: item.title, items: item.items || [] };
        if (sheet.source === 'Settings' || sheet.source === 'Search') {
            if (onFourth) onFourth({ ...sheetData, onDeepLink });
        } else {
            if (onThird) onThird({ ...sheetData, onDeepLink });
        }
    };

    const handleFourthTransition = (item) => {
        if (item.next === 'ProfilePeek') { onClose(); setTimeout(() => setProfilePeek({ userId: item.userId || 'demo1' }), 300); return; }
        if (item.next === 'Browser' && item.url) { onClose(); setTimeout(() => onDeepLink(item.url), 300); return; }
        const sheetData = { source: item.next, title: item.title, items: item.items || [] };
        if (sheet.source === 'Settings' || sheet.source === 'Search') {
            if (onFifth) onFifth({ ...sheetData, title: item.title, onDeepLink });
        } else {
            if (onFourth) onFourth({ ...sheetData, title: item.title, onDeepLink });
        }
    };

    const handleBackNavigation = () => {
        if (SUPPORT_SUB_PAGES.includes(currentView)) { if (setSecondSheet) { setSecondSheet({ source: 'Support' }); return; } }
        onClose();
    };

    if (['Support', 'Search', 'Settings', 'Leaderboard', 'LocationPicker'].includes(sheet.source)) {
        return (
            <Modal visible={true} animationType="slide" transparent={true} onRequestClose={onClose}>
                <View style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' }}>
                    {sheet.source === 'Support' && <SupportScreen setSecondSheet={setSecondSheet || onClose} setThirdSheet={setThirdSheet || onThird} />}
                    {sheet.source === 'Search' && <SearchScreen onClose={onClose} onNavigate={handleNavigation} />}
                    {sheet.source === 'Settings' && <SettingsScreen onClose={onClose} onNavigate={handleNavigation} />}
                    {sheet.source === 'Leaderboard' && <LeaderboardModal setSecondSheet={setSecondSheet || onClose} />}
                    {sheet.source === 'LocationPicker' && <BaseSheet visible={true} onClose={onClose} title="Location"><LocationPickerView onClose={onClose} /></BaseSheet>} 
                </View>
            </Modal>
        );
    }

    if (sheet.source === 'BotStudio') {
        return (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#000' : '#F9FAFB', zIndex: 99999, elevation: 99999 }]}>
                <SafeAreaView style={{ flex: 1, paddingBottom: 20 }}>
                    <BotStudioScreen onClose={onClose} />
                </SafeAreaView>
            </View>
        );
    }

    if (sheet.source === 'GroupDetails') {
        return <Modal visible={true} animationType="slide" onRequestClose={onClose}><GroupDetailsSheet group={sheet.group} onClose={onClose} setThirdSheet={onThird} openVoiceCall={openVoiceCall} openVideoCall={openVideoCall} onOpenAvatar={onOpenAvatar} /></Modal>;
    }

    if (sheet.source === 'EditProfile') {
        return <Modal visible={true} animationType="slide" onRequestClose={onClose}><SafeAreaView style={[localStyles.safeAreaWhite, { backgroundColor: isDark ? '#000' : '#fff' }]}><EditProfileView onClose={onClose} /></SafeAreaView></Modal>;
    }
    
    let title = currentView === 'AI_RECOMMENDATIONS_FULL' ? 'AI Insights' : (sheet.title || currentView);

    const renderContent = () => {
        if (sheet.source === 'AI_RECOMMENDATIONS_FULL') {
            return <AiRecommendationsView recommendations={sheet.recommendations} onClose={onClose} setSecondSheet={setSecondSheet} setPulseCreateOpen={setPulseCreateOpen} isDark={isDark} />;
        }

        let finalSource = sheet.source;
        if (sheet.kind) finalSource = sheet.kind;

        const rawTag = sheet.trend || sheet.title || '';
        const cleanTag = rawTag.replace('#', '').trim();

        if (cleanTag === 'SingForKliq') finalSource = 'KaraokeRoom';
        else if (cleanTag === 'CebuDanceOff') finalSource = 'DanceChallenge';
        else if (cleanTag === 'MorningVibe') finalSource = 'PhotoStudio';
        else if (cleanTag === 'VoiceThoughts') finalSource = 'VoiceClip';
        else if (cleanTag === 'VideoViral') finalSource = 'VideoLab';
        else if (cleanTag === 'LifeStories') finalSource = 'StoryComposer';
        else if (cleanTag === 'TechDebate') finalSource = 'TopicChat';
        else if (cleanTag === 'LiveStreamKliq') finalSource = 'LiveRoom';
        else if (cleanTag === 'KliqPoll') finalSource = 'PollVote';
        else if (cleanTag === 'DuetChallenge') finalSource = 'DuetCompose';

        if (finalSource === 'KaraokeRoom') return <KaraokeRoom sheet={sheet} onClose={onClose} isDark={isDark} />;
        if (finalSource === 'DanceChallenge') return <DanceChallenge sheet={sheet} onClose={onClose} isDark={isDark} />;
        if (finalSource === 'PhotoStudio') return <PhotoStudio sheet={sheet} onClose={onClose} isDark={isDark} />;
        if (finalSource === 'VoiceClip') return <VoiceClip sheet={sheet} onClose={onClose} isDark={isDark} />;
        if (finalSource === 'VideoLab') return <VideoLab sheet={sheet} onClose={onClose} isDark={isDark} />;
        if (finalSource === 'StoryComposer') return <StoryComposer sheet={sheet} onClose={onClose} isDark={isDark} />;
        if (finalSource === 'TopicChat') return <TopicChat sheet={sheet} onClose={onClose} isDark={isDark} />;
        if (finalSource === 'LiveRoom') return <LiveRoom sheet={sheet} onClose={onClose} isDark={isDark} />;
        if (finalSource === 'PollVote') return <PollVote sheet={sheet} onClose={onClose} isDark={isDark} />;
        if (finalSource === 'DuetCompose') return <DuetCompose sheet={sheet} onClose={onClose} isDark={isDark} />;

        if (finalSource === 'TrendOptions') return <TrendOptionsView trendName={sheet.trend || '#Trend'} onClose={onClose} openVibeCheck={openVibeCheck} openVoiceCall={openVoiceCall} />;

        if (sheet.source === 'CreatePulseOptions') return <PulseCreationOptionsView onClose={onClose} openVibeCheck={openVibeCheck} onStartImageUpload={onStartImageUpload} />;
        if (sheet.source === 'PostComments') return <CommentsView postId={sheet.postId || sheet.body} />;

        if (sheet.source === 'CreateTicket') {
            const handleCreateTicket = async () => {
                if (!ticketSubject.trim() || !ticketMessage.trim()) return Alert.alert("Error", "Please enter subject and message.");
                setIsSending(true);
                try { await useAppStore.getState().createTicket(ticketSubject.trim(), ticketMessage.trim()); Alert.alert("Success! ✨", "Sent."); onClose(); } 
                catch (e) { Alert.alert("Error", "Failed."); } finally { setIsSending(false); }
            };
            return (
                <View style={{ padding: 20 }}>
                    <Text style={[globalStyles.h2, { color: isDark ? '#fff' : '#000' }]}>איך אפשר לעזור?</Text>
                    <TextInput style={[localStyles.input, { backgroundColor: isDark ? '#1C1C1E' : '#f5f5f5', color: isDark ? '#fff' : '#000' }]} placeholder="נושא" placeholderTextColor={isDark ? '#888' : '#999'} value={ticketSubject} onChangeText={setTicketSubject} />
                    <TextInput style={[localStyles.input, { height: 100, marginTop: 10, textAlignVertical: 'top', backgroundColor: isDark ? '#1C1C1E' : '#f5f5f5', color: isDark ? '#fff' : '#000' }]} placeholder="הודעה" placeholderTextColor={isDark ? '#888' : '#999'} multiline value={ticketMessage} onChangeText={setTicketMessage} />
                    <TouchableOpacity style={[localStyles.saveBtn, isSending && { opacity: 0.7 }]} onPress={handleCreateTicket} disabled={isSending}>{isSending ? <ActivityIndicator color="#fff" /> : <Text style={localStyles.saveBtnText}>Submit 🚀</Text>}</TouchableOpacity>
                </View>
            );
        }

        if (sheet.source === 'TicketDetails') {
            const ticket = sheet.ticket;
            return (
                <View style={{ padding: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                        <Text style={[globalStyles.h2, { color: isDark ? '#000' : '#000' }]}>{ticket.subject}</Text>
                        <View style={[localStyles.statusBadge, { backgroundColor: ticket.status === 'Open' ? '#e3f2fd' : '#e8f5e9' }]}><Text style={[localStyles.statusText, { color: ticket.status === 'Open' ? '#1565c0' : '#2e7d32' }]}>{ticket.status}</Text></View>
                    </View>
                    <Text style={[globalStyles.p, { color: isDark ? '#ccc' : '#555', marginBottom: 20 }]}>{ticket.message}</Text>
                    <View style={localStyles.ticketMeta}><Text style={localStyles.metaText}>Ticket #{ticket.id.substring(0,8)} • {new Date(ticket.created_at).toLocaleDateString()}</Text></View>
                    {ticket.status === 'Open' && <TouchableOpacity style={localStyles.chatBtn} onPress={() => handleNavigation({ next: 'ChatScreen', id: ticket.id })}><Ionicons name="chatbubbles" size={20} color="#fff" /><Text style={localStyles.chatBtnText}>Chat with Support</Text></TouchableOpacity>}
                </View>
            );
        }

        if (sheet.source === 'SettingsGeneric') {
            const items = sheet.source === 'SettingsGeneric' ? getSettingsItems() : getSearchItems(sheet.source); 
            return (
                <View style={localStyles.scrollContainer}>
                    <Text style={[globalStyles.h2, localStyles.bottomTitle, { color: isDark ? '#fff' : '#000' }]}>{title}</Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={{ paddingBottom: 40 }}>
                            {items.map((item, i) => <SettingItem key={i} item={item} onPress={() => handleNavigation(item)} isDark={isDark} />)}
                        </View>
                    </ScrollView>
                </View>
            );
        }

        if (sheet.source === 'AI_REC_INFO') return <View style={localStyles.scrollContainer}><Text style={[globalStyles.h2, localStyles.aiTitle, { color: isDark ? '#fff' : '#000' }]}>{sheet.title}</Text><Text style={[globalStyles.p, { color: isDark ? '#ccc' : '#333' }]}>{sheet.body}</Text></View>;
        
        const items = sheet.items || [];
        const isGrid = currentView === 'Plus';
        return (
            <View style={localStyles.scrollContainer}>
                <View style={localStyles.headerRow}>
                    {SUPPORT_SUB_PAGES.includes(currentView) && <TouchableOpacity onPress={handleBackNavigation} style={localStyles.backBtn}><Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#111'} /></TouchableOpacity>}
                    <Text style={[globalStyles.h2, localStyles.bottomTitle, { color: isDark ? '#fff' : '#000' }]}>{title}</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={isGrid ? localStyles.gridContainer : { paddingBottom: 40 }}>
                        {isGrid 
                            ? items.map((item, i) => <GridItem key={i} item={item} onPress={() => handleNavigation(item)} isDark={isDark} />)
                            : items.map((item, i) => <SettingItem key={i} item={item} onPress={() => handleNavigation(item)} isDark={isDark} />)
                        }
                    </View>
                </ScrollView>
            </View>
        );
    };

    return (
        <BaseSheet visible={true} onClose={onClose} isDark={isDark}>
            {renderContent()}
        </BaseSheet>
    );
};

export const ThirdSheet = ({ sheet, onClose, onFourth, onDeepLink, setProfilePeek }) => {
    const { userSettings } = useAppStore();
    const isDark = userSettings?.darkMode === true;
    if (!sheet) return null;

    const handleNavigation = (item) => {
        if (item.next === 'ProfilePeek') { onClose(); setTimeout(() => setProfilePeek({ userId: item.userId || 'demo1' }), 300); return; }
        if (item.next === 'Browser' && item.url) { onClose(); setTimeout(() => onDeepLink(item.url), 300); return; }
        const sheetData = { source: item.next, title: item.title, items: item.items || [] };
        if (onFourth) onFourth({ ...sheetData, onDeepLink });
    };

    const items = sheet.items || [];
    return (
        <BaseSheet visible={true} onClose={onClose} isDark={isDark}>
            <View style={localStyles.scrollContainer}>
                <Text style={[globalStyles.h2, localStyles.bottomTitle, { color: isDark ? '#fff' : '#000' }]}>{sheet.title}</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={{ paddingBottom: 40 }}>
                        {items.map((item, i) => <SettingItem key={i} item={item} onPress={() => handleNavigation(item)} isDark={isDark} />)}
                    </View>
                </ScrollView>
            </View>
        </BaseSheet>
    );
};

export const FourthSheet = ({ sheet, onClose, onFifth, onDeepLink }) => {
    const { userSettings } = useAppStore();
    const isDark = userSettings?.darkMode === true;
    if (!sheet) return null;

    const handleNavigation = (item) => {
        if (item.next === 'Browser' && item.url) { onClose(); setTimeout(() => onDeepLink(item.url), 300); return; }
        if (onFifth) onFifth({ source: item.next, title: item.title, items: item.items || [], onDeepLink });
    };

    const items = sheet.items || [];
    return (
        <BaseSheet visible={true} onClose={onClose} isDark={isDark}>
            <View style={localStyles.scrollContainer}>
                <Text style={[globalStyles.h2, localStyles.bottomTitle, { color: isDark ? '#fff' : '#000' }]}>{sheet.title}</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={{ paddingBottom: 40 }}>
                        {items.map((item, i) => <SettingItem key={i} item={item} onPress={() => handleNavigation(item)} isDark={isDark} />)}
                    </View>
                </ScrollView>
            </View>
        </BaseSheet>
    );
};

export const FifthSheet = ({ sheet, onClose, onDeepLink }) => {
    const { userSettings } = useAppStore();
    const isDark = userSettings?.darkMode === true;
    if (!sheet) return null;

    const handleNavigation = (item) => {
        if (item.next === 'Browser' && item.url) { onClose(); setTimeout(() => onDeepLink(item.url), 300); return; }
    };

    const items = sheet.items || [];
    return (
        <BaseSheet visible={true} onClose={onClose} isDark={isDark}>
            <View style={localStyles.scrollContainer}>
                <Text style={[globalStyles.h2, localStyles.bottomTitle, { color: isDark ? '#fff' : '#000' }]}>{sheet.title}</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={{ paddingBottom: 40 }}>
                        {items.map((item, i) => <SettingItem key={i} item={item} onPress={() => handleNavigation(item)} isDark={isDark} />)}
                    </View>
                </ScrollView>
            </View>
        </BaseSheet>
    );
};

const EditProfileView = ({ onClose }) => {
    const { userSettings } = useAppStore();
    const isDark = userSettings?.darkMode === true;
    return (
        <View style={{ flex: 1 }}>
            <View style={[localStyles.headerRow, { paddingHorizontal: 20, marginTop: 10, borderBottomWidth: 0 }]}>
                <Text style={[globalStyles.h2, { color: isDark ? '#fff' : '#111' }]}>Edit Profile</Text>
                <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color={isDark ? '#fff' : '#111'} /></TouchableOpacity>
            </View>
            <View style={{ padding: 20, alignItems: 'center' }}>
                <View style={localStyles.editAvatarWrap}>
                    <Image source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80' }} style={localStyles.editAvatar} />
                    <TouchableOpacity style={localStyles.editAvatarBtn}><Ionicons name="camera" size={20} color="#fff" /></TouchableOpacity>
                </View>
                <TextInput style={[localStyles.input, { width: '100%', marginTop: 30, backgroundColor: isDark ? '#1C1C1E' : '#f5f5f5', color: isDark ? '#fff' : '#000' }]} placeholder="Name" placeholderTextColor={isDark ? '#888' : '#999'} defaultValue="Ran Eizikovich" />
                <TextInput style={[localStyles.input, { width: '100%', marginTop: 15, backgroundColor: isDark ? '#1C1C1E' : '#f5f5f5', color: isDark ? '#fff' : '#000' }]} placeholder="Bio" placeholderTextColor={isDark ? '#888' : '#999'} defaultValue="Software Developer • Cebu" />
                <TouchableOpacity style={[localStyles.saveBtn, { width: '100%', marginTop: 30 }]} onPress={onClose}>
                    <Text style={localStyles.saveBtnText}>Save Changes</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const AiRecommendationsView = ({ recommendations = [], onClose, setSecondSheet, setPulseCreateOpen, isDark }) => {
    const themeBg = isDark ? '#000000' : '#F9FAFB';
    const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
    const textColor = isDark ? '#FFFFFF' : '#111111';
    const subTextColor = isDark ? '#8E8E93' : '#666666';
    const borderColor = isDark ? '#2C2C2E' : '#E5E5EA';

    // --- State Machine for the AI Toolkit Command ---
    const [oracleQuery, setOracleQuery] = useState('');
    const [oracleResponse, setOracleResponse] = useState('');
    const [vibeInput, setVibeInput] = useState('');
    const [vibeResult, setVibeResult] = useState('');
    const [scannerInsight, setScannerInsight] = useState('');
    const [wingmanReplies, setWingmanReplies] = useState([]);
    const [loadingTool, setLoadingTool] = useState(null);

    // 🧠 4. KliqMind Oracle
    const handleAskOracle = () => {
        if (!oracleQuery.trim()) return;
        setLoadingTool('oracle');
        setTimeout(() => {
            setOracleResponse(`Ran, the social graph shows a 42% engagement spike in tech architecture topics within Cebu City. Deploying your Sovereign Eye architecture overview will algorithmically maximize network reach right now.`);
            setLoadingTool(null);
        }, 800);
    };

    // 🔮 1. Vibe Translator
    const handleTranslateVibe = () => {
        if (!vibeInput.trim()) return;
        setLoadingTool('vibe');
        setTimeout(() => {
            setVibeResult(`"Architecting systems at Ramos Tower while the city rests. The social engine runs on data, but KliqMind runs on pure execution. ⚡ #SovereignEye #CebuDevs"`);
            setLoadingTool(null);
        }, 800);
    };

    // 📡 2. Network Scanner
    const handleScanNetwork = () => {
        setLoadingTool('scanner');
        setTimeout(() => {
            setScannerInsight(`INTELLIGENCE REPORT: Massive 88% velocity vector detected in lifestyle and fitness threads across your network tier. Strategic Move: Publish a high-fashion studio capture immediately to capture peak algorithmic stream.`);
            setLoadingTool(null);
        }, 900);
    };

    // 🪽 3. Auto-Wingman
    const handleGenerateWingman = () => {
        setLoadingTool('wingman');
        setTimeout(() => {
            setWingmanReplies([
                "Absolute masterclass in scalability. Cebu isn't ready for this level of execution! 🔥",
                "Exceptional data structures. Let's analyze the underlying behavioral metrics next. ⚡",
                "Incredible velocity on this thread. Pure sovereign energy right here! 🚀"
            ]);
            setLoadingTool(null);
        }, 800);
    };

    const handleShareAsPulse = (textToShare) => {
        alert(`Pulse drafted successfully! 🚀\n\n${textToShare}`);
        onClose();
        setTimeout(() => setPulseCreateOpen(true), 300);
    };

    return (
        <ScrollView style={{ backgroundColor: themeBg, padding: 20 }} showsVerticalScrollIndicator={false}>
            {/* Command Header */}
            <View style={{ marginBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ backgroundColor: 'rgba(131, 56, 236, 0.12)', padding: 12, borderRadius: 14 }}>
                    <Ionicons name="sparkles" size={24} color="#8338EC" />
                </View>
                <View>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: textColor, letterSpacing: -0.5 }}>KliqMind AI Toolkit</Text>
                    <Text style={{ fontSize: 13, color: subTextColor, fontWeight: '600' }}>Sovereign Agent Command Interface</Text>
                </View>
            </View>

            {/* 🧠 TOOL 4: KliqMind Oracle */}
            <View style={{ backgroundColor: cardBg, padding: 18, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: borderColor }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                    <Ionicons name="analytics" size={18} color="#8338EC" />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: textColor }}>KliqMind Oracle</Text>
                </View>
                <View style={{ flexDirection: 'row', backgroundColor: isDark ? '#121214' : '#F3F4F6', borderRadius: 14, paddingHorizontal: 14, alignItems: 'center', height: 48, borderWidth: 1, borderColor: isDark ? '#3A3A3C' : '#E5E5EA' }}>
                    <TextInput
                        style={{ flex: 1, height: '100%', color: textColor, fontSize: 14 }}
                        placeholder="What's on your mind?"
                        placeholderTextColor={isDark ? '#555558' : '#A9A9B0'}
                        value={oracleQuery}
                        onChangeText={setOracleQuery}
                        onSubmitEditing={handleAskOracle}
                    />
                    <TouchableOpacity onPress={handleAskOracle} disabled={loadingTool === 'oracle'}>
                        {loadingTool === 'oracle' ? <ActivityIndicator size="small" color="#8338EC" /> : <Ionicons name="arrow-forward" size={18} color="#8338EC" />}
                    </TouchableOpacity>
                </View>
                {oracleResponse ? (
                    <View style={{ marginTop: 14, backgroundColor: isDark ? '#121214' : '#F9FAFB', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: borderColor }}>
                        <Text style={{ color: textColor, fontSize: 14, lineHeight: 22 }}>{oracleResponse}</Text>
                        <TouchableOpacity style={{ marginTop: 12, alignSelf: 'flex-end', backgroundColor: '#8338EC', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }} onPress={() => handleShareAsPulse(oracleResponse)}>
                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Share as Pulse</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>

            {/* 🔮 TOOL 1: Vibe Translator */}
            <View style={{ backgroundColor: cardBg, padding: 18, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: borderColor }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                    <Ionicons name="color-filter" size={18} color="#FF006E" />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: textColor }}>Vibe Translator</Text>
                </View>
                <Text style={{ fontSize: 13, color: subTextColor, marginBottom: 14 }}>Convert your current raw state into a high-impact broadcast pulse.</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput
                        style={{ flex: 1, backgroundColor: isDark ? '#121214' : '#F3F4F6', borderRadius: 14, height: 46, paddingHorizontal: 14, color: textColor, fontSize: 14, borderWidth: 1, borderColor: isDark ? '#3A3A3C' : '#E5E5EA' }}
                        placeholder="e.g., grinding code, building ecosystems..."
                        placeholderTextColor={isDark ? '#555558' : '#A9A9B0'}
                        value={vibeInput}
                        onChangeText={setVibeInput}
                    />
                    <TouchableOpacity style={{ backgroundColor: '#FF006E', paddingHorizontal: 18, borderRadius: 14, justifyContent: 'center' }} onPress={handleTranslateVibe} disabled={loadingTool === 'vibe'}>
                        {loadingTool === 'vibe' ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Translate</Text>}
                    </TouchableOpacity>
                </View>
                {vibeResult ? (
                    <View style={{ marginTop: 14, backgroundColor: isDark ? '#121214' : '#FFF0F5', padding: 14, borderRadius: 14, borderLeftWidth: 3, borderLeftColor: '#FF006E' }}>
                        <Text style={{ color: textColor, fontStyle: 'italic', fontSize: 14, lineHeight: 22 }}>{vibeResult}</Text>
                        <TouchableOpacity style={{ marginTop: 12, alignSelf: 'flex-end', backgroundColor: '#FF006E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }} onPress={() => handleShareAsPulse(vibeResult)}>
                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Post Pulse</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>

            {/* 📡 TOOL 2: Network Scanner */}
            <View style={{ backgroundColor: cardBg, padding: 18, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: borderColor }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                    <Ionicons name="radio" size={18} color="#00F5D4" />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: textColor }}>Network Scanner</Text>
                </View>
                <Text style={{ fontSize: 13, color: subTextColor, marginBottom: 14 }}>Scan social nodes and vectors for live strategic insights.</Text>
                <TouchableOpacity style={{ backgroundColor: isDark ? 'rgba(0, 245, 212, 0.08)' : '#E6FAF7', borderWidth: 1, borderColor: '#00F5D4', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }} onPress={handleScanNetwork} disabled={loadingTool === 'scanner'}>
                    {loadingTool === 'scanner' ? <ActivityIndicator color="#00F5D4" /> : <Text style={{ color: '#00F5D4', fontWeight: '700', fontSize: 14 }}>Run Intelligence Scan</Text>}
                </TouchableOpacity>
                {scannerInsight ? (
                    <View style={{ marginTop: 14, backgroundColor: isDark ? '#121214' : '#E5FAF6', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#00F5D4' }}>
                        <Text style={{ color: textColor, fontSize: 14, lineHeight: 22, fontWeight: '500' }}>{scannerInsight}</Text>
                    </View>
                ) : null}
            </View>

            {/* 🪽 TOOL 3: Auto-Wingman */}
            <View style={{ backgroundColor: cardBg, padding: 18, borderRadius: 20, marginBottom: 40, borderWidth: 1, borderColor: borderColor }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                    <Ionicons name="rocket" size={18} color="#FF5E00" />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: textColor }}>Auto-Wingman</Text>
                </View>
                <Text style={{ fontSize: 13, color: subTextColor, marginBottom: 14 }}>Generate high-impact, contextual responses to dominate viral threads.</Text>
                <TouchableOpacity style={{ backgroundColor: '#FF5E00', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }} onPress={handleGenerateWingman} disabled={loadingTool === 'wingman'}>
                    {loadingTool === 'wingman' ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Generate Smart Replies</Text>}
                </TouchableOpacity>
                {wingmanReplies.length > 0 ? (
                    <View style={{ marginTop: 14, gap: 10 }}>
                        {wingmanReplies.map((reply, idx) => (
                            <TouchableOpacity key={idx} style={{ backgroundColor: isDark ? '#121214' : '#F9FAFB', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: borderColor }} onPress={() => { alert(`Copied to clipboard:\n"${reply}"`); }}>
                                <Text style={{ color: textColor, fontSize: 13, lineHeight: 18 }}>{reply}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : null}
            </View>
        </ScrollView>
    );
};

const localStyles = StyleSheet.create({
    scrollContainer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    backBtn: { marginRight: 15 },
    bottomTitle: { fontSize: 22 },
    aiTitle: { fontSize: 22, marginBottom: 10 },
    safeAreaWhite: { flex: 1 },
    groupHeader: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1 },
    backIcon: { padding: 5 },
    groupScroll: { paddingBottom: 40 },
    groupLargeImg: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8 },
    groupActions: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
    actionCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
    editAvatarWrap: { position: 'relative' },
    editAvatar: { width: 120, height: 120, borderRadius: 60 },
    editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: brand.blue, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
    input: { height: 50, borderRadius: 12, paddingHorizontal: 15, fontSize: 16 },
    saveBtn: { backgroundColor: brand.blue, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    statusText: { fontWeight: 'bold', fontSize: 12 },
    ticketMeta: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' },
    metaText: { color: '#888', fontSize: 12 },
    chatBtn: { marginTop: 20, backgroundColor: '#000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 12, gap: 10 },
    chatBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    aiEmptyWrap: { padding: 40, alignItems: 'center' },
    recommendationCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12 },
    recIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    recContent: { flex: 1, paddingRight: 10 },
    recTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    recDesc: { fontSize: 13, lineHeight: 18 }
});