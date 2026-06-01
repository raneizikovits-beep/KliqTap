import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

export const ResetPasswordScreen = ({ navigation }) => {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('שגיאה', 'הסיסמה חייבת להכיל לפחות 6 תווים.');
      return;
    }

    setLoading(true);

    // זו הפקודה שמעדכנת את הסיסמה ב-Supabase!
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    setLoading(false);

    if (error) {
      Alert.alert('שגיאה בעדכון', error.message);
    } else {
      Alert.alert('הצלחה!', 'הסיסמה שלך עודכנה בהצלחה. העין הריבונית מאשרת.');
      // ניווט חזרה למסך ההתחברות או מסך הבית
      navigation.replace('Login'); 
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>הגדרת סיסמה חדשה</Text>
      <Text style={styles.subtitle}>הזן את הסיסמה החדשה לחשבון KliqTap שלך.</Text>

      <TextInput
        style={styles.input}
        placeholder="סיסמה חדשה (מינימום 6 תווים)"
        placeholderTextColor="rgba(255,255,255,0.5)"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />

      <TouchableOpacity 
        style={styles.btn} 
        onPress={handleUpdatePassword} 
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? 'מעדכן...' : 'עדכן סיסמה'}</Text>
      </TouchableOpacity>
    </View>
  );
};

// עיצוב בסיסי באווירת האפליקציה שלך (תוכל לשנות ולהתאים)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', padding: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  subtitle: { color: '#ccc', fontSize: 14, marginBottom: 30, textAlign: 'center' },
  input: { backgroundColor: '#1F1F22', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  btn: { backgroundColor: '#FF006E', padding: 15, borderRadius: 25, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});