// client/src/screens/ResetPasswordScreen.js
// ✅ PRODUCTION FIX:
//   • SafeAreaView — prevents notch overlap on iOS
//   • Min password 8 chars (6 is NIST non-compliant)
//   • Confirm password field — prevents typo lockouts
//   • Handles expired Supabase recovery tokens gracefully
//   • Consistent dark theme with the rest of the app

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const MIN_PASSWORD_LENGTH = 8;

export const ResetPasswordScreen = ({ navigation }) => {
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,         setLoading]         = useState(false);
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);

  // ─── Derived state ───────────────────────────────────────────────────────
  const passwordsMatch  = newPassword === confirmPassword;
  const passwordLongEnough = newPassword.length >= MIN_PASSWORD_LENGTH;
  const canSubmit = newPassword.length > 0 && confirmPassword.length > 0 && !loading;

  // ─── Handler ─────────────────────────────────────────────────────────────
  const handleUpdatePassword = async () => {
    // Validate locally before hitting the network
    if (!passwordLongEnough) {
      Alert.alert('Password too short', `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (!passwordsMatch) {
      Alert.alert('Passwords do not match', 'Please make sure both fields are identical.');
      return;
    }

    setLoading(true);
    try {
      // supabase.auth.updateUser requires an active recovery session.
      // The recovery token is embedded in the deep-link URL that Supabase
      // sends by email and is automatically consumed by the Supabase client
      // when the app opens. If the session has expired (> 1 h), the call will
      // return an AuthApiError with a clear message.
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        // Map common Supabase error codes to user-friendly messages
        const friendly =
          error.message?.toLowerCase().includes('expired') ||
          error.message?.toLowerCase().includes('invalid')
            ? 'Your reset link has expired. Please request a new one from the login screen.'
            : error.message || 'Update failed. Please try again.';
        Alert.alert('Error', friendly);
        return;
      }

      Alert.alert(
        '✅ Password Updated',
        'Your password has been changed successfully. Please log in with your new password.',
        [{ text: 'Go to Login', onPress: () => navigation.replace('Login') }],
      );
    } catch (err) {
      console.error('[ResetPassword] Unexpected error:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── UI ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Set New Password</Text>
        <Text style={styles.subtitle}>
          Enter a new password for your KliqTap account.{'\n'}
          Must be at least {MIN_PASSWORD_LENGTH} characters.
        </Text>

        {/* New password */}
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.inputFlex]}
            placeholder={`New password (min ${MIN_PASSWORD_LENGTH} chars)`}
            placeholderTextColor="rgba(255,255,255,0.4)"
            secureTextEntry={!showNew}
            value={newPassword}
            onChangeText={setNewPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn} accessibilityLabel="Toggle password visibility">
            <Text style={styles.eyeIcon}>{showNew ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        {/* Confirm password */}
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.inputFlex, !passwordsMatch && confirmPassword.length > 0 && styles.inputError]}
            placeholder="Confirm new password"
            placeholderTextColor="rgba(255,255,255,0.4)"
            secureTextEntry={!showConfirm}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn} accessibilityLabel="Toggle confirm visibility">
            <Text style={styles.eyeIcon}>{showConfirm ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        {/* Inline mismatch warning */}
        {!passwordsMatch && confirmPassword.length > 0 && (
          <Text style={styles.errorHint}>Passwords do not match</Text>
        )}

        <TouchableOpacity
          style={[styles.btn, (!canSubmit || !passwordsMatch || !passwordLongEnough) && styles.btnDisabled]}
          onPress={handleUpdatePassword}
          disabled={!canSubmit || !passwordsMatch || !passwordLongEnough}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Update Password</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.replace('Login')} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back to Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F22',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
    paddingRight: 10,
  },
  input: {
    color: '#fff',
    padding: 15,
    fontSize: 15,
  },
  inputFlex: { flex: 1 },
  inputError: { borderColor: '#FF3B30' },
  eyeBtn: { padding: 8 },
  eyeIcon: { fontSize: 16 },
  errorHint: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 12,
    marginLeft: 4,
  },
  btn: {
    backgroundColor: '#FF006E',
    padding: 16,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  backLink: { marginTop: 20, alignItems: 'center' },
  backLinkText: { color: '#888', fontSize: 14 },
});