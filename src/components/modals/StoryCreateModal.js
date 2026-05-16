// client/src/components/modals/StoryCreateModal.js
// ⭐️ FULL DARK MODE COMPATIBLE - ALL ORIGINAL FUNCTIONS PRESERVED ⭐️

import React, { useState } from 'react';
import { 
    Modal, View, Text, TouchableOpacity, 
    TextInput, ImageBackground, ActivityIndicator, 
    KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet 
} from 'react-native';
import { brand } from '../../constants/data';
import { useAppStore } from '../../store/useAppStore'; 

export const StoryCreateModal = ({ visible, onClose, imageUri, onSubmit, isPosting }) => {
  const [text, setText] = useState('');

  // משיכת הגדרות (למרות שסטוריז נהוגים להיות על רקע כהה תמיד, הנה הכנה לזה)
  const { userSettings } = useAppStore(state => ({ userSettings: state.userSettings }));
  const isDark = userSettings?.darkMode === true;

  const handleSubmit = () => {
    onSubmit(text, imageUri);
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={[localStyles.container, { backgroundColor: isDark ? '#000' : '#111' }]} // משאיר תמיד כהה כמו המקור
      >
        <SafeAreaView style={[localStyles.safeArea, { backgroundColor: isDark ? '#000' : '#111' }]}>
          
          <View style={localStyles.header}>
            <TouchableOpacity onPress={onClose} style={localStyles.closeBtn}>
              <Text style={localStyles.closeText}>✕</Text>
            </TouchableOpacity>
            <Text style={localStyles.headerTitle}>Create Story</Text>
            <View style={localStyles.headerSpacer} />
          </View>

          <View style={localStyles.mainContent}>
            <ImageBackground
              source={imageUri ? { uri: imageUri } : null}
              style={localStyles.imageBg}
              resizeMode="contain"
            >
              <TextInput
                style={localStyles.textInput}
                placeholder="Add text..."
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={text}
                onChangeText={setText}
                multiline
              />
            </ImageBackground>
          </View>
          
          <View style={localStyles.footer}>
            <TouchableOpacity 
              style={[localStyles.submitBtn, { backgroundColor: isPosting ? brand.soft : brand.blue }]} 
              onPress={handleSubmit}
              disabled={isPosting}
            >
              {isPosting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={localStyles.submitBtnText}>🚀 Publish Story</Text>
              )}
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const localStyles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10 },
    closeBtn: { padding: 10 },
    closeText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    headerSpacer: { width: 40 },
    mainContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    imageBg: { width: '100%', height: '80%', justifyContent: 'center', alignItems: 'center' },
    textInput: { fontSize: 28, color: 'white', fontWeight: 'bold', textAlign: 'center', padding: 20, textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10 },
    footer: { padding: 20 },
    submitBtn: { width: '100%', borderRadius: 30, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', elevation: 3 },
    submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 }
});