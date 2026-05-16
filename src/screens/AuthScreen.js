// client/src/screens/AuthScreen.js
// ⭐️ V5.2 — PRODUCTION HARDENED (Email Validation + Smart Error Handling + UX Alerts)
// Audit fixes:
//   [H-6]  Age calculation now correctly accounts for month + day
//   [L-2]  Apple sign-in button hidden when not available; tappable button does real work
//   [L-4]  Error mapping uses server error codes when present, falls back to message match
//   [SEC]  Added strict Regex email validation to prevent silent server failures
//   [FLOW] Synchronized with authSlice to handle requiresVerification flow properly
//   [UX]   Added Alert.alert popups so users don't get kicked out on errors (KliqMind Fix)

import React, { useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Text, ScrollView, TouchableOpacity, TextInput,
  Platform, View, ImageBackground, KeyboardAvoidingView, Alert, StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { brand } from '../constants/data';
import { useAppStore } from '../store/useAppStore';

const BG_IMAGE = 'https://images.unsplash.com/photo-1557683316-973673baf926?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80';

// ============================================================
// Utility — proper age calculation (handles month/day correctly)
// ============================================================
function calculateAge(dob) {
  if (!(dob instanceof Date) || isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// ============================================================
// Map server error → user-facing string.
// Prefers structured error.code over message-text matching.
// ============================================================
function translateAuthError(e) {
  const code = e?.code || e?.response?.data?.code;
  const fallback = e?.message || 'An unexpected error occurred.';

  if (code === 'INVALID_CREDENTIALS')   return 'Incorrect email or password. Please try again.';
  if (code === 'EMAIL_NOT_VERIFIED')    return 'Account not verified. Please check your email to confirm.';
  if (code === 'EMAIL_TAKEN')           return 'This email address is already registered.';
  if (code === 'WEAK_PASSWORD')         return 'Password is too weak. Please use at least 8 characters.';
  if (code === 'USERNAME_TAKEN')        return 'This username is already taken. Please choose another one.';
  if (code === 'INVALID_EMAIL')         return 'Please enter a valid email address.';

  // Legacy: try matching the message string.
  const m = fallback.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Incorrect email or password. Please try again.';
  if (m.includes('not confirmed')   || m.includes('not verified'))      return 'Account not verified. Please check your email to confirm.';
  if (m.includes('already registered') || m.includes('email taken'))    return 'This email address is already registered.';
  if (m.includes('at least'))                                            return 'Password is too weak. Please use at least 8 characters.';
  if (m.includes('username'))                                            return 'This username is already taken. Please choose another one.';
  if (m.includes('valid email'))                                         return 'Please enter a valid email address.';

  return fallback;
}

// ============================================================
// Sub-components
// ============================================================
const ModernInput = React.memo(({ icon, placeholder, value, onChange, secure = false, keyboard = 'default', isDark, autoCapitalize = 'none' }) => (
  <View style={[localStyles.inputWrapper, { backgroundColor: isDark ? '#1C1C1E' : '#F5F7FA', borderColor: isDark ? '#333' : '#eee' }]}>
    <Ionicons name={icon} size={20} color={isDark ? '#888' : '#666'} style={{ marginRight: 10 }} />
    <TextInput
      placeholder={placeholder}
      placeholderTextColor={isDark ? '#666' : '#999'}
      style={[localStyles.inputField, { color: isDark ? '#fff' : '#333' }]}
      value={value}
      onChangeText={onChange}
      secureTextEntry={secure}
      keyboardType={keyboard}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
    />
  </View>
));

const GenderButton = React.memo(({ label, value, selectedValue, onSelect, isDark }) => {
  const isSelected = selectedValue === value;
  return (
    <TouchableOpacity
      onPress={() => onSelect(value)}
      style={[
        localStyles.genderBtn,
        { backgroundColor: isDark ? '#1C1C1E' : '#F5F7FA', borderColor: isDark ? '#333' : '#eee' },
        isSelected && localStyles.genderBtnActive,
      ]}
    >
      <Text style={[
        localStyles.genderText,
        { color: isDark ? '#aaa' : '#666' },
        isSelected && { color: '#fff' },
      ]}>{label}</Text>
    </TouchableOpacity>
  );
});

// ============================================================
// Main screen
// ============================================================
export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('PreferNotToSay');
  const [dateOfBirth, setDateOfBirth] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pull store actions with a stable selector to avoid extra renders.
  const loginAction        = useAppStore(state => state.login);
  const registerAction     = useAppStore(state => state.register);
  const loginWithGoogle    = useAppStore(state => state.loginWithGoogle);
  const loginWithApple     = useAppStore(state => state.loginWithApple);
  const resetPasswordAction = useAppStore(state => state.resetPassword);
  const darkMode           = useAppStore(state => state.userSettings?.darkMode === true);

  const isDark = darkMode;

  const appleAvailable = useMemo(() => Platform.OS === 'ios' && typeof loginWithApple === 'function', [loginWithApple]);

  // ----- Handlers ------------------------------------------------------------
  const handleGoogleLogin = useCallback(async () => {
    setError('');
    try {
      await loginWithGoogle?.();
    } catch (e) {
      const errorMessage = translateAuthError(e);
      setError(errorMessage);
      Alert.alert('Google Login Failed', errorMessage, [{ text: 'OK' }]);
    }
  }, [loginWithGoogle]);

  const handleAppleLogin = useCallback(async () => {
    if (!appleAvailable) return;
    setError('');
    try {
      await loginWithApple();
    } catch (e) {
      const errorMessage = translateAuthError(e);
      setError(errorMessage);
      Alert.alert('Apple Login Failed', errorMessage, [{ text: 'OK' }]);
    }
  }, [appleAvailable, loginWithApple]);

  const handleDateChange = useCallback((event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      setDateOfBirth(selectedDate);
    }
  }, []);

  const handlePasswordReset = useCallback(async () => {
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address.');
      Alert.alert('Missing Email', 'Please enter your email address to reset your password.', [{ text: 'OK' }]);
      return;
    }
    setLoading(true);
    try {
      if (!resetPasswordAction) {
        throw new Error('Reset function not configured');
      }
      await resetPasswordAction(email.trim());
      Alert.alert('Check your email', "We've sent you a password reset link.");
      setIsForgotPassword(false);
    } catch (e) {
      const errorMessage = translateAuthError(e);
      setError(errorMessage);
      Alert.alert('Reset Failed', errorMessage, [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  }, [email, resetPasswordAction]);

  const handleSubmit = useCallback(async () => {
    setError('');

    const emailTrim    = email.trim();
    const nameTrim     = name.trim();
    const usernameTrim = username.trim();

    if (!emailTrim || !password) {
      setError('Email and Password are required.');
      Alert.alert('Missing Fields', 'Email and Password are required.', [{ text: 'OK' }]);
      return;
    }

    // Strict Regex validation before hitting the server
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrim)) {
      setError('Please enter a valid email address.');
      Alert.alert('Invalid Email', 'Please enter a valid email address.', [{ text: 'OK' }]);
      return;
    }

    if (!isLogin) {
      if (!nameTrim || !usernameTrim) {
        setError('Name and Username are required.');
        Alert.alert('Missing Fields', 'Name and Username are required.', [{ text: 'OK' }]);
        return;
      }
      const age = calculateAge(dateOfBirth);
      if (age < 13) {
        setError('You must be 13+ to join KliqTap.');
        Alert.alert('Age Restriction', 'You must be at least 13 years old to join KliqTap.', [{ text: 'OK' }]);
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        Alert.alert('Weak Password', 'Please use at least 8 characters to keep your account secure.', [{ text: 'OK' }]);
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        await loginAction(emailTrim, password);
      } else {
        const result = await registerAction(
          nameTrim, usernameTrim, emailTrim, password, gender,
          dateOfBirth.toISOString().split('T')[0],
        );
        
        // Check if verification is actually required
        if (result && result.requiresVerification) {
          Alert.alert(
            'Registration Successful!',
            'Please check your inbox (or spam) and click the verification link before logging in.'
          );
          setIsLogin(true);
          setPassword('');
        }
      }
    } catch (e) {
      // ⭐️ KLIQMIND FIX: Added Alert.alert for errors
      const errorMessage = translateAuthError(e);
      setError(errorMessage); 
      Alert.alert(
        isLogin ? 'Login Failed' : 'Registration Error', 
        errorMessage, 
        [{ text: 'OK' }] 
      );
    } finally {
      setLoading(false);
    }
  }, [email, password, isLogin, name, username, gender, dateOfBirth, loginAction, registerAction]);

  const switchMode = useCallback(() => {
    setIsLogin(prev => !prev);
    setError('');
  }, []);

  // ----- Render --------------------------------------------------------------
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <ImageBackground
        source={{ uri: BG_IMAGE }}
        style={{ flex: 1, width: '100%', height: '100%' }}
        resizeMode="cover"
        defaultSource={undefined}
      >
        <View style={localStyles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={localStyles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <View style={localStyles.brandSection}>
                <View style={localStyles.logoIconBg}>
                  <Ionicons name="scan-outline" size={30} color="#fff" />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={localStyles.brandKliq}>KliQ</Text>
                  <Text style={localStyles.brandTap}>Tap</Text>
                  <View style={localStyles.brandDot} />
                </View>
                <Text style={localStyles.tagline}>Tap into your world.</Text>
              </View>

              <View style={[localStyles.card, { backgroundColor: isDark ? '#121212' : '#fff' }]}>

                {isForgotPassword ? (
                  <>
                    <Text style={[localStyles.cardTitle, { color: isDark ? '#fff' : '#333' }]}>Reset Password</Text>
                    <Text style={{ textAlign: 'center', color: isDark ? '#aaa' : '#666', marginBottom: 20 }}>
                      Enter the email associated with your account and we'll send instructions to reset your password.
                    </Text>
                    <ModernInput icon="mail-outline" placeholder="Email Address" value={email} onChange={setEmail} keyboard="email-address" isDark={isDark} />
                    {error ? <Text style={localStyles.errorText}>{error}</Text> : null}
                    <TouchableOpacity style={localStyles.mainBtn} onPress={handlePasswordReset} disabled={loading}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={localStyles.mainBtnText}>Send Reset Link</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={{ marginTop: 20, alignItems: 'center' }} onPress={() => { setIsForgotPassword(false); setError(''); }}>
                      <Text style={{ color: brand.blue, fontWeight: 'bold' }}>Back to Log In</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={[localStyles.cardTitle, { color: isDark ? '#fff' : '#333' }]}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>

                    {!isLogin && (
                      <>
                        <ModernInput icon="person-outline" placeholder="Full Name" value={name} onChange={setName} isDark={isDark} autoCapitalize="words" />
                        <ModernInput icon="at-outline" placeholder="Username" value={username} onChange={setUsername} isDark={isDark} />

                        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[localStyles.inputWrapper, { backgroundColor: isDark ? '#1C1C1E' : '#F5F7FA', borderColor: isDark ? '#333' : '#eee' }]}>
                          <Ionicons name="calendar-outline" size={20} color={isDark ? '#888' : '#666'} style={{ marginRight: 10 }} />
                          <Text style={{ color: isDark ? '#fff' : '#333', fontSize: 16 }}>
                            Birth Date: {dateOfBirth.toLocaleDateString()}
                          </Text>
                        </TouchableOpacity>
                        {showDatePicker && (
                          <DateTimePicker
                            value={dateOfBirth}
                            mode="date"
                            display="default"
                            onChange={handleDateChange}
                            maximumDate={new Date()}
                          />
                        )}

                        <View style={{ flexDirection: 'row', marginBottom: 15, gap: 10 }}>
                          <GenderButton label="Male"   value="Male"   selectedValue={gender} onSelect={setGender} isDark={isDark} />
                          <GenderButton label="Female" value="Female" selectedValue={gender} onSelect={setGender} isDark={isDark} />
                          <GenderButton label="Other"  value="Other"  selectedValue={gender} onSelect={setGender} isDark={isDark} />
                        </View>
                      </>
                    )}

                    <ModernInput icon="mail-outline" placeholder="Email Address" value={email} onChange={setEmail} keyboard="email-address" isDark={isDark} />
                    <ModernInput icon="lock-closed-outline" placeholder="Password" value={password} onChange={setPassword} secure isDark={isDark} />

                    {isLogin && (
                      <TouchableOpacity onPress={() => setIsForgotPassword(true)} style={{ alignSelf: 'flex-end', marginTop: -5, marginBottom: 15 }}>
                        <Text style={{ color: brand.blue, fontSize: 14, fontWeight: '600' }}>Forgot Password?</Text>
                      </TouchableOpacity>
                    )}

                    {error ? <Text style={localStyles.errorText}>{error}</Text> : null}

                    <TouchableOpacity style={localStyles.mainBtn} onPress={handleSubmit} disabled={loading}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={localStyles.mainBtnText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>}
                    </TouchableOpacity>

                    <View style={localStyles.divider}>
                      <View style={[localStyles.line, { backgroundColor: isDark ? '#333' : '#eee' }]} />
                      <Text style={[localStyles.orText, { color: isDark ? '#666' : '#999' }]}>OR</Text>
                      <View style={[localStyles.line, { backgroundColor: isDark ? '#333' : '#eee' }]} />
                    </View>

                    <TouchableOpacity style={[localStyles.socialBtn, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#ddd' }]} onPress={handleGoogleLogin}>
                      <Ionicons name="logo-google" size={20} color="#DB4437" />
                      <Text style={[localStyles.socialText, { color: isDark ? '#fff' : '#333' }]}>Continue with Google</Text>
                    </TouchableOpacity>

                    {appleAvailable && (
                      <TouchableOpacity style={[localStyles.socialBtn, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#ddd' }]} onPress={handleAppleLogin}>
                        <Ionicons name="logo-apple" size={20} color={isDark ? '#fff' : '#000'} />
                        <Text style={[localStyles.socialText, { color: isDark ? '#fff' : '#333' }]}>Continue with Apple</Text>
                      </TouchableOpacity>
                    )}

                    <View style={localStyles.footer}>
                      <Text style={{ color: isDark ? '#aaa' : '#666' }}>{isLogin ? 'New here? ' : 'Have an account? '}</Text>
                      <TouchableOpacity onPress={switchMode}>
                        <Text style={{ color: brand.blue, fontWeight: 'bold' }}>{isLogin ? 'Create Account' : 'Log In'}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </ImageBackground>
    </View>
  );
}

// ============================================================
const localStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scrollContent: { padding: 20, flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  brandSection: { alignItems: 'center', marginBottom: 30, marginTop: 40 },
  logoIconBg: { width: 60, height: 60, borderRadius: 18, backgroundColor: brand.blue, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  brandKliq: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  brandTap: { fontSize: 36, fontWeight: '300', color: brand.orange },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: brand.orange, marginLeft: 4, marginBottom: 6 },
  tagline: { color: 'rgba(255,255,255,0.8)', fontSize: 16, marginTop: 5, letterSpacing: 1 },
  card: { width: '100%', maxWidth: 400, borderRadius: 24, padding: 25, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  cardTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 15, height: 55, marginBottom: 15, borderWidth: 1 },
  inputField: { flex: 1, fontSize: 16, height: '100%' },
  genderBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1 },
  genderBtnActive: { backgroundColor: brand.blue, borderColor: brand.blue },
  genderText: { fontWeight: '600' },
  mainBtn: { backgroundColor: brand.blue, height: 55, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: brand.blue, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4, marginTop: 10 },
  mainBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  errorText: { color: 'red', textAlign: 'center', marginBottom: 10 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1 },
  orText: { marginHorizontal: 10, fontSize: 12 },
  socialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, height: 50, borderRadius: 16, marginBottom: 12 },
  socialText: { fontWeight: '600', marginLeft: 10 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 15 },
});