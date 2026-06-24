// client/src/components/modals/SettingsViews.js
//
// [V1.1 — Engineering Audit Fixes]:
//   [FIX HIGH] NotificationSettings: 2 of 5 toggles ("Group Updates", "Mentions")
//              were hard-locked via `value={true}` + `onValueChange={() => {}}` —
//              a no-op handler. These switches looked interactive but tapping
//              them did absolutely nothing; React Native's Switch would just
//              snap back to its current value. Converted to proper local state,
//              matching the other 3 toggles in this same component.
//   [NOTE]     This whole component is local-state-only with zero connection to
//              useAppStore — unlike its sibling PrivacySettings below (which
//              correctly calls the real updateUserProfile action), every toggle
//              here resets to its hardcoded default the moment this screen is
//              unmounted and remounted. There's no confirmed backend schema for
//              these specific notification-preference fields, so rather than
//              guessing at field names for updateUserProfile(), this is flagged
//              here for the team to wire once the real fields are confirmed.
//   [FIX HIGH] SecuritySettings: all 3 buttons (Change Password, Enable 2FA,
//              Log Out Other Sessions) showed an Alert claiming the action had
//              succeeded ("Email sent...", "All other sessions logged out.")
//              when none of them do anything at all. This is the most severe
//              class of false-success claim in this audit given the security
//              stakes — a user could believe a lost device's sessions were
//              terminated when they weren't. Reworded to be honest about the
//              current state instead of claiming a security action occurred.

import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { styles as globalStyles } from '../../constants/styles';
import { brand } from '../../constants/data';
import { useAppStore } from '../../store/useAppStore';

const ToggleRow = ({ label, value, onValueChange }) => (
    <View style={localStyles.row}>
        <Text style={localStyles.label}>{label}</Text>
        <Switch 
            trackColor={{ false: "#767577", true: brand.blue }}
            thumbColor={value ? "#fff" : "#f4f3f4"}
            onValueChange={onValueChange}
            value={value}
        />
    </View>
);

export const NotificationSettings = () => {
    const [pushEnabled, setPushEnabled] = useState(true);
    // [FIX HIGH] Were hard-locked to `true` with a no-op onValueChange — the
    // switches looked tappable but did nothing. Now properly stateful.
    const [groupUpdatesEnabled, setGroupUpdatesEnabled] = useState(true);
    const [mentionsEnabled, setMentionsEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(false);
    const [marketingEnabled, setMarketingEnabled] = useState(false);

    return (
        <View style={localStyles.container}>
            <Text style={globalStyles.h2}>Push Notifications</Text>
            <ToggleRow label="New Messages" value={pushEnabled} onValueChange={setPushEnabled} />
            <ToggleRow label="Group Updates" value={groupUpdatesEnabled} onValueChange={setGroupUpdatesEnabled} />
            <ToggleRow label="Mentions" value={mentionsEnabled} onValueChange={setMentionsEnabled} />
            
            <View style={localStyles.spacer} />
            <Text style={globalStyles.h2}>Email Notifications</Text>
            <ToggleRow label="Weekly Digest" value={emailEnabled} onValueChange={setEmailEnabled} />
            <ToggleRow label="Promotions" value={marketingEnabled} onValueChange={setMarketingEnabled} />
        </View>
    );
};

export const PrivacySettings = () => {
    const { user, updateUserProfile } = useAppStore(state => ({ 
        user: state.user,
        updateUserProfile: state.updateUserProfile 
    }));
    
    const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
    const [isLoading, setIsLoading] = useState(false);

    const handleTogglePrivacy = async (val) => {
        setIsPrivate(val);
        setIsLoading(true);
        try {
            if (updateUserProfile) {
                await updateUserProfile({ isPrivate: val });
            }
        } catch (error) {
            Alert.alert("Error", "Failed to update privacy settings.");
            setIsPrivate(!val); 
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={localStyles.container}>
            <Text style={globalStyles.p}>Control who can see your content and activity.</Text>
            
            <View style={localStyles.toggleSection}>
                <ToggleRow 
                    label="Private Account" 
                    value={isPrivate} 
                    onValueChange={handleTogglePrivacy} 
                />
                <Text style={[globalStyles.p, localStyles.helperText]}>
                    When your account is private, only people you approve can see your posts and pulse.
                </Text>
            </View>

            {isLoading && <ActivityIndicator size="small" color={brand.blue} style={localStyles.loader} />}
        </View>
    );
};

export const SecuritySettings = () => {
    // [FIX HIGH] All three Alerts below previously claimed a security action had
    // already succeeded ("Email sent...", "All other sessions logged out.") when
    // none of them do anything. No confirmed backend endpoint exists for any of
    // these yet, so claiming success here would be actively misleading about the
    // user's account security state — e.g. believing a lost device was logged
    // out when it wasn't. Reworded to be honest about the current state.
    return (
        <View style={localStyles.container}>
            <TouchableOpacity style={localStyles.actionBtn} onPress={() => Alert.alert("Change Password", "This feature isn't available yet. Check back soon!")}>
                <Text style={localStyles.actionBtnText}>Change Password</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={localStyles.actionBtn} onPress={() => Alert.alert("Two-Factor Authentication", "This feature isn't available yet. Check back soon!")}>
                <Text style={localStyles.actionBtnText}>Enable Two-Factor Auth</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[localStyles.actionBtn, localStyles.dangerBorder]} onPress={() => Alert.alert("Log Out Other Sessions", "This feature isn't available yet. Check back soon!")}>
                <Text style={[localStyles.actionBtnText, localStyles.dangerText]}>Log Out Other Sessions</Text>
            </TouchableOpacity>
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: { padding: 20 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    label: { fontSize: 16, color: brand.ink, fontWeight: '500' },
    spacer: { height: 20 },
    toggleSection: { marginTop: 20 },
    helperText: { fontSize: 12, marginTop: -10 },
    loader: { marginTop: 20 },
    actionBtn: { padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#ddd', marginBottom: 10, alignItems: 'center', backgroundColor: '#fff' },
    actionBtnText: { fontWeight: 'bold', color: brand.blue },
    dangerBorder: { borderColor: brand.red },
    dangerText: { color: brand.red }
});