// client/src/components/modals/SheetModals.js
// ⭐️ V2 PRODUCTION: postId Backward Compat + All Original Functions Preserved
//
// CRITICAL FIX IN THIS VERSION:
// [FIX-1] ThirdSheet routed CommentsView using `sheet.body` as postId, while
//         SecondSheet routed it via `sheet.postId`. Inconsistent naming meant
//         updating one call site could silently break the other.
//         Now: both paths accept either `sheet.postId` (preferred) OR
//         `sheet.body` (legacy) — fully backward compatible.
//
// All other behaviors preserved 100%.

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
import EditProfileView from '../EditProfileView';
import GroupDetailsSheet from '../GroupDetailsSheet'; 
import { LeaderboardModal } from './LeaderboardModal'; 

const { width } = Dimensions.get('window');
const SUPPORT_SUB_PAGES = ['SupportPro', 'SupportPeers', 'SupportCrisis', 'SupportTools', 'SupportAnxiety', 'SupportDepression', 'SupportSleep'];

// --- AI INSIGHTS INTERNAL VIEW ---
const AiRecommendationsView = ({ recommendations, onClose, setSecondSheet, setPulseCreateOpen, isDark }) => {
    return (
        <View style={[localStyles.aiInternalContainer, { backgroundColor: isDark ? '#000' : '#F8F9FA' }]}>
            <View style={localStyles.aiHeader}>
                <View style={localStyles.aiBadge}>
                    <Ionicons name="sparkles" size={14} color="#6200EE" />
                    <Text style={localStyles.aiBadgeText}>KLIQMIND AI ENGINE</Text>
                </View>
                <Text style={[localStyles.aiMainTitle, { color: isDark ? '#fff' : '#000' }]}>AI Suggestions</Text>
                <Text style={[localStyles.aiMainSub, { color: isDark ? '#888' : '#666' }]}>
                    Insights analyzed from your current vibe and activity.
                </Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                
                {/* KLIQMIND ORACLE */}
                <Text style={[localStyles.sectionTitle, { color: isDark ? '#fff' : '#333' }]}>KLIQMIND ORACLE</Text>
                <View style={[localStyles.oracleContainer, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#eee' }]}>
                    <Ionicons name="search" size={20} color={isDark ? '#888' : '#999'} style={{marginLeft: 15}} />
                    <TextInput
                        style={[localStyles.oracleInput, { color: isDark ? '#fff' : '#000' }]}
                        placeholder="What's on your mind? Ask the Oracle..."
                        placeholderTextColor={isDark ? '#888' : '#999'}
                        onSubmitEditing={() => Alert.alert("🧠 KliqMind Oracle", "Query received. Synthesizing answer and drafting Pulse...")}
                    />
                    <TouchableOpacity style={localStyles.oracleBtn} onPress={() => Alert.alert("🧠 Oracle", "Connecting to KliqMind core...")}>
                        <Ionicons name="send" size={14} color="#fff" style={{marginLeft: 2}} />
                    </TouchableOpacity>
                </View>

                {/* AI TOOLBOX */}
                <Text style={[localStyles.sectionTitle, { color: isDark ? '#fff' : '#333', marginTop: 25 }]}>AI TOOLBOX</Text>
                
                <View style={localStyles.toolboxGrid}>
                    <View style={localStyles.toolboxRow}>
                        <TouchableOpacity 
                            style={[localStyles.toolChip, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: 'rgba(255, 0, 127, 0.4)' }]}
                            onPress={() => { onClose(); setTimeout(() => Alert.alert("🔮 Vibe Translator", "Enter 2 words, get a viral post. AI Engine hooking up..."), 350); }}
                        >
                            <LinearGradient colors={['#FF007F', '#7928CA']} style={localStyles.toolGradient} />
                            <Ionicons name="color-wand" size={26} color="#fff" />
                            <Text style={localStyles.toolText}>Vibe Translator</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[localStyles.toolChip, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: 'rgba(0, 229, 255, 0.4)' }]}
                            onPress={() => { onClose(); setTimeout(() => Alert.alert("📡 Network Scanner", "KliqMind Analyst says:\n\n'High engagement on nightlife posts in Cebu right now. Upload a photo from the club.'"), 350); }}
                        >
                            <LinearGradient colors={['#00E5FF', '#007AFF']} style={localStyles.toolGradient} />
                            <Ionicons name="scan" size={26} color="#fff" />
                            <Text style={localStyles.toolText}>Network Scanner</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        style={[localStyles.toolChip, { width: '100%', marginTop: 12, height: 75, flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'flex-start', borderColor: 'rgba(255, 215, 0, 0.4)' }]}
                        onPress={() => { onClose(); setTimeout(() => Alert.alert("🪽 Auto-Wingman", "Scanning your network for viral posts...\n\nDrafting 3 witty replies for you to choose from."), 350); }}
                    >
                        <LinearGradient colors={['#FFD700', '#FF8C00']} style={localStyles.toolGradient} start={{x: 0, y: 0}} end={{x: 1, y: 0}} />
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                            <Ionicons name="rocket" size={22} color="#fff" />
                        </View>
                        <View>
                            <Text style={[localStyles.toolText, { marginTop: 0, fontSize: 16, textAlign: 'left' }]}>Auto-Wingman</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2, fontWeight: '600' }}>Auto-reply to viral network posts</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <Text style={[localStyles.sectionTitle, { color: isDark ? '#fff' : '#333', marginTop: 30 }]}>TOP MATCHES</Text>
                {recommendations && recommendations.length > 0 ? (
                    recommendations.map((item, index) => (
                        <TouchableOpacity 
                            key={index}
                            style={[localStyles.recommendationCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#eee' }]}
                        >
                            <Image source={{ uri: item.avatarUrl || item.img || 'https://via.placeholder.com/50' }} style={localStyles.recAvatar} />
                            <View style={{ flex: 1 }}>
                                <Text style={[localStyles.recName, { color: isDark ? '#fff' : '#000' }]}>{item.title || item.name || 'User'}</Text>
                                <Text style={localStyles.recMatch}>{item.body || 'Shared vibe and interests'}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={isDark ? '#444' : '#ccc'} />
                        </TouchableOpacity>
                    ))
                ) : (
                    <View style={localStyles.emptyContainer}>
                        <ActivityIndicator size="large" color="#6200EE" />
                        <Text style={[localStyles.emptyText, { color: isDark ? '#aaa' : '#666' }]}>Analyzing new insights...</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

// --- SettingsSubContent (Dark Mode preserved) ---
const SettingsSubContent = ({ source, title, user, onClose, isDark }) => { 
    const [email, setEmail] = useState(user?.email || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [password, setPassword] = useState('');
    const [twoFactor, setTwoFactor] = useState(false);
    
    const [blockedUsers, setBlockedUsers] = useState([
        { id: 1, name: "Spam Bot 3000", handle: "@spambot" },
        { id: 2, name: "Mean User", handle: "@meanuser" }
    ]);

    const handleSave = () => {
        Alert.alert("Success", "Changes saved successfully.");
        onClose();
    };

    const textColor = isDark ? '#fff' : '#333';
    const subTextColor = isDark ? '#aaa' : '#666';
    const inputBg = isDark ? '#000' : '#f5f5f5'; 
    const cardBg = isDark ? '#000' : '#f9f9f9';
    const borderColor = isDark ? '#333' : '#eee';
    const mainBg = isDark ? '#1C1C1E' : '#fff'; 

    if (title === 'Personal Info' || title === 'Edit Profile') {
        return (
            <ScrollView style={[localStyles.scrollContainer, { backgroundColor: mainBg }]} keyboardShouldPersistTaps="handled">
                <Text style={[localStyles.label, {color: subTextColor}]}>Display Name</Text>
                <TextInput style={[localStyles.input, {backgroundColor: inputBg, color: textColor, borderColor: borderColor, borderWidth: 1}]} value={user?.name} editable={false} />
                <Text style={[localStyles.label, {color: subTextColor}]}>Email Address</Text>
                <TextInput style={[localStyles.input, {backgroundColor: inputBg, color: textColor, borderColor: borderColor, borderWidth: 1}]} value={email} onChangeText={setEmail} keyboardType="email-address" />
                <Text style={[localStyles.label, {color: subTextColor}]}>Phone Number</Text>
                <TextInput style={[localStyles.input, {backgroundColor: inputBg, color: textColor, borderColor: borderColor, borderWidth: 1}]} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+1..." placeholderTextColor={subTextColor}/>
                <TouchableOpacity style={localStyles.saveBtn} onPress={handleSave}><Text style={localStyles.saveBtnText}>Save Changes</Text></TouchableOpacity>
            </ScrollView>
        );
    }

    if (title === 'Security' || source === 'Security') {
        return (
            <ScrollView style={[localStyles.scrollContainer, { backgroundColor: mainBg }]} keyboardShouldPersistTaps="handled">
                <View style={[localStyles.card, {backgroundColor: cardBg, borderColor: borderColor}]}>
                    <Text style={[localStyles.cardHeader, {color: textColor}]}>Change Password</Text>
                    <TextInput style={[localStyles.input, {backgroundColor: inputBg, color: textColor, borderColor: borderColor, borderWidth: 1, marginBottom: 10}]} placeholder="Current Password" placeholderTextColor={subTextColor} secureTextEntry />
                    <TextInput style={[localStyles.input, {backgroundColor: inputBg, color: textColor, borderColor: borderColor, borderWidth: 1}]} placeholder="New Password" placeholderTextColor={subTextColor} secureTextEntry value={password} onChangeText={setPassword} />
                </View>
                <View style={[localStyles.card, localStyles.twoFactorRow, {backgroundColor: cardBg, borderColor: borderColor}]}>
                    <View><Text style={[localStyles.twoFactorTitle, {color: textColor}]}>Two-Factor Auth</Text><Text style={[localStyles.twoFactorSub, {color: subTextColor}]}>Secure your account</Text></View>
                    <Switch value={twoFactor} onValueChange={setTwoFactor} trackColor={{true: brand.green}} />
                </View>
                <TouchableOpacity style={localStyles.saveBtn} onPress={handleSave}><Text style={localStyles.saveBtnText}>Update Security</Text></TouchableOpacity>
            </ScrollView>
        );
    }

    if (title === 'Linked Accounts') {
        return (
            <View style={[localStyles.scrollContainer, { backgroundColor: mainBg, flex: 1 }]}>
                {['Google', 'Facebook', 'Apple'].map((provider, i) => (
                    <View key={i} style={[localStyles.rowItem, {borderBottomColor: borderColor}]}>
                        <View style={localStyles.providerInfo}><Ionicons name={`logo-${provider.toLowerCase()}`} size={24} color={isDark ? '#ccc' : "#555"} /><Text style={[localStyles.providerName, {color: textColor}]}>{provider}</Text></View>
                        <TouchableOpacity onPress={() => Alert.alert(provider, "Toggle connection...")}><Text style={localStyles.connectText}>Connect</Text></TouchableOpacity>
                    </View>
                ))}
            </View>
        );
    }

    if (title === 'Blocked Users') {
        return (
            <ScrollView style={[localStyles.scrollContainer, { backgroundColor: mainBg }]}>
                <Text style={[localStyles.blockedHelper, {color: subTextColor}]}>People you've blocked can't see your profile or posts.</Text>
                {blockedUsers.map(u => (
                    <View key={String(u.id)} style={[localStyles.rowItem, {borderBottomColor: borderColor}]}>
                        <View><Text style={[localStyles.blockedName, {color: textColor}]}>{u.name}</Text><Text style={[localStyles.blockedHandle, {color: subTextColor}]}>{u.handle}</Text></View>
                        <TouchableOpacity 
                            style={[localStyles.unblockBtn, {backgroundColor: isDark ? '#333' : '#eee'}]}
                            onPress={() => {
                                setBlockedUsers(blockedUsers.filter(user => String(user.id) !== String(u.id)));
                                Alert.alert("Unblocked", `${u.name} can now see you.`);
                            }}
                        >
                            <Text style={[localStyles.unblockText, {color: textColor}]}>Unblock</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
        );
    }

    if (title === 'Close Friends' || title === 'Hidden Accounts' || title === 'AI Persona') {
         return <View style={[localStyles.scrollContainer, { backgroundColor: mainBg, flex: 1 }]}><Text style={[globalStyles.p, {color: subTextColor, textAlign: 'center', marginTop: 20}]}>Management section ready.</Text></View>;
    }

    if (title === 'Language') {
        return (
            <View style={[localStyles.scrollContainer, { backgroundColor: mainBg, flex: 1 }]}>
                {['English (US)', 'Hebrew (עברית)', 'Spanish', 'French'].map((lang, i) => (
                    <TouchableOpacity key={i} style={[localStyles.rowItem, {borderBottomColor: borderColor}]} onPress={() => Alert.alert("Language", "App restart required.")}>
                        <Text style={[localStyles.langText, {color: textColor}]}>{lang}</Text>
                        {i === 0 && <Ionicons name="checkmark" size={20} color={brand.blue} />}
                    </TouchableOpacity>
                ))}
            </View>
        );
    }

    return (
        <View style={[localStyles.fallbackContainer, { backgroundColor: mainBg, flex: 1 }]}>
            <Ionicons name="information-circle-outline" size={50} color={isDark ? '#444' : "#ddd"} />
            <Text style={[globalStyles.h3, localStyles.fallbackTitle, {color: textColor}]}>{title}</Text>
            <Text style={[globalStyles.p, localStyles.fallbackSub, {color: subTextColor}]}>{source === 'AI_REC_INFO' ? "AI Insights Details" : "Settings page ready."}</Text>
        </View>
    );
};

// --- SecondSheet ---
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
        if (item.next === 'ProfilePeek') { onClose(); if (setProfilePeek) setProfilePeek(item.data); return; }
        if (item.next === 'GroupDetails') { if (setSecondSheet) setSecondSheet({ source: 'GroupDetails', group: item.data }); return; }
        if (item.next === 'PostView') { onThird({ title: 'Post', body: item.data.text }); return; }
        if (item.title === 'Edit Profile') { if (setSecondSheet) setSecondSheet({ source: "EditProfile" }); return; }
        else if (item.actionType === 'openVibeCheck' && openVibeCheck) { onClose(); openVibeCheck(); }
        else if (item.actionType === 'openDeletionLink' && openDeletionLink) { onClose(); openDeletionLink(); }
        else if (item.next) {
            const [sheetType, deepAction] = item.next.split(':');
            const sheetData = { source: item.title, title: item.title, body: item.body, deepAction, item }; 
            if (sheetType === 'third') onThird(sheetData);
            else if (sheetType === 'fourth') onFourth(sheetData);
            else if (sheetType === 'fifth') onFifth({ ...sheetData, title: item.title, onDeepLink });
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

        if (sheet.source === 'TrendOptions') return <TrendOptionsView trendName={sheet.trend || '#Trend'} onClose={onClose} openVibeCheck={openVibeCheck} openVoiceCall={openVoiceCall} />;
        if (sheet.source === 'CreatePulseOptions') return <PulseCreationOptionsView onClose={onClose} openVibeCheck={openVibeCheck} onStartImageUpload={onStartImageUpload} />;
        // [FIX-1] Accept either postId (preferred) or body (legacy) for backward compat
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
            return <View style={{ padding: 20 }}><Text style={[globalStyles.h2, { color: isDark ? '#fff' : '#000' }]}>{sheet.ticket?.subject || "Ticket"}</Text><Text style={[globalStyles.p, { color: isDark ? '#ccc' : '#333' }]}>{sheet.ticket?.messages?.[0]?.text || "No details provided."}</Text></View>;
        }

        if (SUPPORT_SUB_PAGES.includes(sheet.source) || sheet.source === 'SettingsGeneric') {
            const items = sheet.source === 'SettingsGeneric' ? getSettingsItems() : getSearchItems(sheet.source); 
            const gridItems = getIconGrid ? getIconGrid(sheet.source) : null;
            return (
                <View style={localStyles.scrollContainer}>
                    {items?.map((item, i) => <SettingItem key={i} icon={item.icon} title={item.title} body={item.body} onPress={() => handleNavigation(item)} isDark={isDark} />)}
                    {gridItems && <View style={localStyles.gridWrap}>{gridItems.map((item, i) => <GridItem key={i} icon={item.i} title={item.t} body={item.body} onPress={() => onThird({ source: item.t, body: item.body })} isDark={isDark} />)}</View>}
                </View>
            );
        }

        if (sheet.source === 'AI_REC_INFO') return <View style={localStyles.scrollContainer}><Text style={[globalStyles.h2, localStyles.aiTitle, { color: isDark ? '#fff' : '#000' }]}>{sheet.title}</Text><Text style={[globalStyles.p, { color: isDark ? '#ccc' : '#333' }]}>{sheet.body}</Text></View>;

        return <Text style={[globalStyles.p, localStyles.scrollContainer, { color: isDark ? '#fff' : '#000' }]}>Content source '{sheet.source}' ready.</Text>;
    };

    return (
        <BaseSheet visible={true} onClose={onClose} title={title} showBackButton={SUPPORT_SUB_PAGES.includes(currentView) || currentView === 'CreateTicket' || currentView === 'TicketDetails'} onBackPress={handleBackNavigation}>
            {renderContent()}
        </BaseSheet>
    );
};

// --- ThirdSheet ---
export const ThirdSheet = ({ sheet, onClose }) => {
    const { user, settings } = useAppStore(state => ({ user: state.user, settings: state.userSettings || {} }));
    const isDark = settings.darkMode === true;
    if (!sheet) return null;
    // [FIX-1] Accept either postId (preferred) or body (legacy) for backward compat
    if (sheet.title === 'Comments') return <BaseSheet visible={true} onClose={onClose} title="Comments" sheetHeight='75%'><CommentsView postId={sheet.postId || sheet.body} /></BaseSheet>;
    return <BaseSheet visible={true} onClose={onClose} title={sheet.title || sheet.source || 'Details'} sheetHeight='75%' showBackButton={true}><SettingsSubContent source={sheet.source} title={sheet.title} user={user} onClose={onClose} isDark={isDark} /></BaseSheet>;
};

// --- FourthSheet ---
export const FourthSheet = ({ sheet, onClose }) => {
    const { userSettings } = useAppStore(state => ({ userSettings: state.userSettings }));
    const isDark = userSettings?.darkMode === true;
    if (!sheet) return null;
    return <BaseSheet visible={true} onClose={onClose} title={sheet.source || 'Advanced'} sheetHeight='55%' showBackButton={true}><View style={localStyles.scrollContainer}><Text style={[globalStyles.p, { color: isDark ? '#ccc' : '#333' }]}>{sheet.body}</Text></View></BaseSheet>;
};

// --- FifthSheet ---
export const FifthSheet = ({ sheet, onClose }) => {
    const { userSettings } = useAppStore(state => ({ userSettings: state.userSettings }));
    const isDark = userSettings?.darkMode === true;
    if (!sheet) return null;
    return (
        <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
            <View style={globalStyles.overlay}>
                <View style={[globalStyles.cardModal, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
                    <Text style={[globalStyles.h2, { color: isDark ? '#fff' : '#000' }]}>{sheet.title || "Notice"}</Text>
                    <Text style={[globalStyles.p, { color: isDark ? '#ccc' : '#333', marginVertical: 10 }]}>{sheet.body || "Operation completed."}</Text>
                    <TouchableOpacity style={globalStyles.primaryBtn} onPress={() => { if (sheet.deepAction && sheet.onDeepLink) sheet.onDeepLink(sheet.deepAction); onClose(); }}><Text style={globalStyles.joinLabel}>{sheet.deepAction === 'DeleteAccount' ? 'CONFIRM ACTION' : 'OK'}</Text></TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const localStyles = StyleSheet.create({
    safeAreaWhite: { flex: 1 },
    scrollContainer: { padding: 20 },
    label: { fontSize: 13, marginBottom: 5, marginTop: 15, fontWeight: '600' },
    input: { borderRadius: 10, padding: 12, fontSize: 16 },
    saveBtn: { backgroundColor: brand.blue, padding: 15, borderRadius: 12, marginTop: 30, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    card: { padding: 15, borderRadius: 12, borderWidth: 1 },
    cardHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    twoFactorRow: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    twoFactorTitle: { fontWeight: 'bold', fontSize: 16 },
    twoFactorSub: { fontSize: 12 },
    rowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1 },
    providerInfo: { flexDirection: 'row', alignItems: 'center' },
    providerName: { marginLeft: 15, fontSize: 16, fontWeight: '500' },
    connectText: { color: brand.blue, fontWeight: 'bold' },
    blockedHelper: { marginBottom: 15 },
    blockedName: { fontWeight: 'bold' },
    blockedHandle: { fontSize: 12 },
    unblockBtn: { padding: 8, borderRadius: 8 },
    unblockText: { fontSize: 12, fontWeight: '600' },
    emptyText: { textAlign: 'center', marginTop: 20 },
    langText: { fontSize: 16 },
    fallbackContainer: { padding: 20, alignItems: 'center' },
    fallbackTitle: { marginTop: 15 },
    fallbackSub: { textAlign: 'center', marginTop: 10 },
    gridWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 20 },
    aiTitle: { marginBottom: 15 },
    aiInfoTitle: { marginBottom: 10 },
    modalBodyText: { marginVertical: 10 },
    
    // AI Insights Internal Design Styles
    aiInternalContainer: { flex: 1, padding: 24 },
    aiHeader: { alignItems: 'center', marginBottom: 25 },
    aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(98, 0, 238, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
    aiBadgeText: { fontSize: 10, fontWeight: '800', color: '#6200EE', marginLeft: 6, letterSpacing: 1 },
    aiMainTitle: { fontSize: 28, fontWeight: '900', marginBottom: 8 },
    aiMainSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
    sectionTitle: { fontSize: 13, fontWeight: '900', marginBottom: 12, letterSpacing: 1 },
    oracleContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, height: 55, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    oracleInput: { flex: 1, height: '100%', paddingHorizontal: 15, fontSize: 14, fontWeight: '500' },
    oracleBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#6200EE', justifyContent: 'center', alignItems: 'center', marginRight: 8, elevation: 3 },
    toolboxGrid: { width: '100%' },
    toolboxRow: { flexDirection: 'row', gap: 12 },
    toolChip: { flex: 1, height: 90, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    toolGradient: { ...StyleSheet.absoluteFillObject, opacity: 0.8 },
    toolText: { color: '#fff', fontWeight: 'bold', fontSize: 12, marginTop: 8 },
    recommendationCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 12, borderWidth: 1, elevation: 2 },
    recAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
    recName: { fontSize: 16, fontWeight: 'bold' },
    recMatch: { fontSize: 12, color: '#6200EE', fontWeight: '600', marginTop: 2 },
    emptyContainer: { alignItems: 'center', marginTop: 40 },
});