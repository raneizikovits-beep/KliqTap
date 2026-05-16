// client/src/screens/OnboardingScreen.js
// ⭐️ FULL DARK MODE COMPATIBLE - ALL ORIGINAL FUNCTIONS PRESERVED ⭐️

import React, { useState, useCallback } from 'react';
import { SafeAreaView } from "react-native-safe-area-context"; 
import { styles as globalStyles } from '../constants/styles';
import { brand } from '../constants/data';
import { useAppStore } from '../store/useAppStore'; 
import PeopleHeartLogo from '../components/PeopleHeartLogo'; 
import { 
    ActivityIndicator, Text, ScrollView, 
    TouchableOpacity, TextInput, 
    KeyboardAvoidingView, Platform, View, StyleSheet 
} from "react-native";

export default function OnboardingScreen() {
    const [intentText, setIntentText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { user, submitOnboarding, userSettings } = useAppStore(state => ({
        user: state.user,
        submitOnboarding: state.submitOnboarding,
        userSettings: state.userSettings // ⭐️ משיכת הגדרות
    }));

    const isDark = userSettings?.darkMode === true;

    const handleSubmit = useCallback(async () => {
        setError('');
        if (!intentText.trim()) {
            setError("Please share a bit about yourself so we can help you connect.");
            return;
        }

        setLoading(true);
        try {
            await submitOnboarding(intentText);
        } catch (e) {
            console.error("Onboarding Error:", e.message);
            setError(e.message || "An unknown error occurred.");
            setLoading(false);
        }
    }, [intentText, submitOnboarding]);

    return (
        <SafeAreaView style={[localStyles.safeArea, { backgroundColor: isDark ? '#000' : brand.bg }]}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"} 
                style={localStyles.keyboardView}
            >
                <ScrollView 
                    contentContainerStyle={localStyles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <PeopleHeartLogo style={globalStyles.authLogoTop} /> 
                    
                    <Text style={[localStyles.title, { color: isDark ? '#fff' : brand.ink }]} numberOfLines={1}>
                        Welcome, {user?.name || 'friend'}!
                    </Text>
                    
                    <Text style={[localStyles.subtitle, { color: isDark ? '#ddd' : brand.ink }]}>
                        What are you looking for?
                    </Text>
                    
                    <Text style={[localStyles.description, { color: isDark ? '#aaa' : brand.soft }]}>
                        This helps our AI find the best groups for you.
                    </Text>

                    <View style={localStyles.formContainer}>
                        <TextInput 
                            placeholder="e.g., 'I'm a medical student looking for running partners' or 'Just moved to Tel Aviv, looking to meet new people'..."
                            placeholderTextColor={isDark ? "#888" : "#888"}
                            style={[localStyles.input, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#eee', color: isDark ? '#fff' : brand.ink }]}
                            value={intentText}
                            onChangeText={setIntentText}
                            autoCapitalize="sentences"
                            multiline={true}
                        />

                        {error ? (
                            <Text style={localStyles.errorText}>{error}</Text>
                        ) : null}

                        <TouchableOpacity 
                            style={localStyles.submitButton} 
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={localStyles.submitText}>Find My Kliq</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const localStyles = StyleSheet.create({
    safeArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    keyboardView: { flex: 1, width: '100%', justifyContent: 'center' },
    scrollContent: { padding: 30, alignItems: 'center', width: '100%' },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
    subtitle: { textAlign: 'center', marginTop: 8, fontSize: 16 },
    description: { textAlign: 'center', marginTop: 4, marginBottom: 20 },
    formContainer: { width: '100%', maxWidth: 350, marginTop: 20 },
    input: {
        height: 120, textAlignVertical: 'top', paddingTop: 12, lineHeight: 20,
        borderRadius: 12, paddingHorizontal: 15,
        borderWidth: 1, fontSize: 16
    },
    errorText: { color: brand.red, textAlign: 'center', marginBottom: 10, marginTop: 5 },
    submitButton: {
        marginTop: 10, backgroundColor: brand.blue, paddingVertical: 15,
        borderRadius: 12, alignItems: 'center', justifyContent: 'center'
    },
    submitText: { color: "#fff", fontWeight: "800", fontSize: 16 }
});