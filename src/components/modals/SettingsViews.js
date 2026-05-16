// client/src/components/modals/SettingsViews.js
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
    const [emailEnabled, setEmailEnabled] = useState(false);
    const [marketingEnabled, setMarketingEnabled] = useState(false);

    return (
        <View style={localStyles.container}>
            <Text style={globalStyles.h2}>Push Notifications</Text>
            <ToggleRow label="New Messages" value={pushEnabled} onValueChange={setPushEnabled} />
            <ToggleRow label="Group Updates" value={true} onValueChange={() => {}} />
            <ToggleRow label="Mentions" value={true} onValueChange={() => {}} />
            
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
    return (
        <View style={localStyles.container}>
            <TouchableOpacity style={localStyles.actionBtn} onPress={() => Alert.alert("Change Password", "Email sent to reset password.")}>
                <Text style={localStyles.actionBtnText}>Change Password</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={localStyles.actionBtn} onPress={() => Alert.alert("2FA", "Two-Factor Authentication setup...")}>
                <Text style={localStyles.actionBtnText}>Enable Two-Factor Auth</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[localStyles.actionBtn, localStyles.dangerBorder]} onPress={() => Alert.alert("Sessions", "All other sessions logged out.")}>
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