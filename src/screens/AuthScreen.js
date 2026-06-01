// client/src/screens/AuthScreen.js
// ⭐️ V6.0 — FULL REWRITE & HARDENED
// Fix log:
//   [BUG-1]  DatePicker: display="spinner" + minimumDate fixes year > 1970 issue on Android
//   [BUG-2]  iOS DatePicker now closes after selection (was missing setShowDatePicker(false))
//   [BUG-3]  switchMode now resets ALL fields (name, username, gender, dob, password)
//   [UX-1]   Added Confirm Password field + mismatch validation
//   [UX-2]   Added password visibility toggle (show/hide eye icon)
//   [UX-3]   Added "Prefer Not to Say" gender option in UI (was in state but not rendered)
//   [UX-4]   Added username character validation (alphanumeric + underscore only)
//   [UX-5]   Added password strength indicator
//   [UX-6]   Added Terms & Conditions checkbox for registration
//   [UX-7]   Inline field-level error messages (not just a single bottom error)
//   [UX-8]   Registration success clears all fields before switching to login
//   [SEC-1]  confirmPassword never sent to server (local validation only)
//   [SEC-2]  Password min length enforced on register AND shown as inline hint

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
// Utility — username validation (alphanumeric + underscore, 3–20 chars)
// ============================================================
function isValidUsername(u) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(u);
}

// ============================================================
// Utility — password strength (0 = weak, 1 = fair, 2 = strong)
// ============================================================
function getPasswordStrength(p) {
  if (p.length < 6) return 0;
  let score = 0;
  if (p.length >= 8)              score++;
  if (/[A-Z]/.test(p))            score++;
  if (/[0-9]/.test(p))            score++;
  if (/[^A-Za-z0-9]/.test(p))    score++;
  if (score <= 1) return 0;
  if (score === 2) return 1;
  return 2;
}

// ============================================================
// Map server error → user-facing string.
// Prefers structured error.code over message-text matching.
// ============================================================
function translateAuthError(e) {
  const code = e?.code || e?.response?.data?.code;
  const fallback = e?.message || 'An unexpected error occurred.';

  if (code === 'INVALID_CREDENTIALS')  return 'Incorrect email or password. Please try again.';
  if (code === 'EMAIL_NOT_VERIFIED')   return 'Account not verified. Please check your email to confirm.';
  if (code === 'EMAIL_TAKEN')          return 'This email address is already registered.';
  if (code === 'WEAK_PASSWORD')        return 'Password is too weak. Please use at least 8 characters.';
  if (code === 'USERNAME_TAKEN')       return 'This username is already taken. Please choose another one.';
  if (code === 'INVALID_EMAIL')        return 'Please enter a valid email address.';

  const m = fallback.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Incorrect email or password. Please try again.';
  if (m.includes('not confirmed')  || m.includes('not verified'))       return 'Account not verified. Please check your email to confirm.';
  if (m.includes('already registered') || m.includes('email taken'))   return 'This email address is already registered.';
  if (m.includes('at least'))                                           return 'Password is too weak. Please use at least 8 characters.';
  if (m.includes('username'))                                           return 'This username is already taken. Please choose another one.';
  if (m.includes('valid email'))                                        return 'Please enter a valid email address.';

  return fallback;
}

// ============================================================
// Sub-components
// ============================================================

/** Standard text input with icon */
const ModernInput = React.memo(({
  icon, placeholder, value, onChange,
  secure = false, keyboard = 'default',
  isDark, autoCapitalize = 'none',
  errorMsg, rightIcon, onRightIconPress,
}) => (
  <View style={{ marginBottom: errorMsg ? 4 : 15 }}>
    <View style={[
      localStyles.inputWrapper,
      { backgroundColor: isDark ? '#1C1C1E' : '#F5F7FA', borderColor: errorMsg ? '#FF453A' : (isDark ? '#333' : '#eee') },
    ]}>
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
      {rightIcon && onRightIconPress && (
        <TouchableOpacity onPress={onRightIconPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={rightIcon} size={20} color={isDark ? '#888' : '#666'} />
        </TouchableOpacity>
      )}
    </View>
    {errorMsg ? <Text style={localStyles.fieldError}>{errorMsg}</Text> : null}
  </View>
));

/** Gender selector button */
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

/** Password strength bar */
const PasswordStrengthBar = React.memo(({ password, isDark }) => {
  if (!password) return null;
  const strength = getPasswordStrength(password);
  const labels = ['Weak', 'Fair', 'Strong'];
  const colors = ['#FF453A', '#FF9F0A', '#30D158'];
  return (
    <View style={{ marginTop: -8, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            backgroundColor: i <= strength ? colors[strength] : (isDark ? '#333' : '#eee'),
          }} />
        ))}
      </View>
      <Text style={{ fontSize: 11, marginTop: 4, color: colors[strength] }}>{labels[strength]} password</Text>
    </View>
  );
});

// ============================================================
// Main screen
// ============================================================
export default function AuthScreen() {
  const [isLogin, setIsLogin]                   = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  // Shared fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Register-only fields
  const [name, setName]                   = useState('');
  const [username, setUsername]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [gender, setGender]               = useState('PreferNotToSay');
  const [dateOfBirth, setDateOfBirth]     = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Error state — per field + global
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading]         = useState(false);

  // Store actions
  const loginAction         = useAppStore(state => state.login);
  const registerAction      = useAppStore(state => state.register);
  const loginWithGoogle     = useAppStore(state => state.loginWithGoogle);
  const loginWithApple      = useAppStore(state => state.loginWithApple);
  const resetPasswordAction = useAppStore(state => state.resetPassword);
  const darkMode            = useAppStore(state => state.userSettings?.darkMode === true);

  const isDark = darkMode;
  const appleAvailable = useMemo(() => Platform.OS === 'ios' && typeof loginWithApple === 'function', [loginWithApple]);

  // ----- Field helpers -------------------------------------------------------
  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setGlobalError('');
  }, []);

  const setFieldError = useCallback((field, msg) => {
    setFieldErrors(prev => ({ ...prev, [field]: msg }));
  }, []);

  // ----- Handlers ------------------------------------------------------------

  /** [BUG-FIX] iOS didn't close picker; Android already did.
   *  display="spinner" avoids the compact modal that loses years > 1970 on older Android. */
  const handleDateChange = useCallback((event, selectedDate) => {
    // Always close on Android; on iOS close only when confirmed
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setDateOfBirth(selectedDate);
      // Also close on iOS after selection
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    } else if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    clearErrors();
    try {
      await loginWithGoogle?.();
    } catch (e) {
      const msg = translateAuthError(e);
      setGlobalError(msg);
      Alert.alert('Google Login Failed', msg, [{ text: 'OK' }]);
    }
  }, [loginWithGoogle, clearErrors]);

  const handleAppleLogin = useCallback(async () => {
    if (!appleAvailable) return;
    clearErrors();
    try {
      await loginWithApple();
    } catch (e) {
      const msg = translateAuthError(e);
      setGlobalError(msg);
      Alert.alert('Apple Login Failed', msg, [{ text: 'OK' }]);
    }
  }, [appleAvailable, loginWithApple, clearErrors]);

  const handlePasswordReset = useCallback(async () => {
    clearErrors();
    if (!email.trim()) {
      setFieldError('email', 'Email is required.');
      Alert.alert('Missing Email', 'Please enter your email address to reset your password.', [{ text: 'OK' }]);
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFieldError('email', 'Please enter a valid email address.');
      Alert.alert('Invalid Email', 'Please enter a valid email address.', [{ text: 'OK' }]);
      return;
    }
    setLoading(true);
    try {
      if (!resetPasswordAction) throw new Error('Reset function not configured');
      await resetPasswordAction(email.trim());
      Alert.alert('Check your email', "We've sent you a password reset link. Don't forget to check your spam folder.");
      setIsForgotPassword(false);
      setEmail('');
    } catch (e) {
      const msg = translateAuthError(e);
      setGlobalError(msg);
      Alert.alert('Reset Failed', msg, [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  }, [email, resetPasswordAction, clearErrors, setFieldError]);

  const handleSubmit = useCallback(async () => {
    clearErrors();

    const emailTrim    = email.trim();
    const nameTrim     = name.trim();
    const usernameTrim = username.trim().toLowerCase();

    // ── Shared validation ────────────────────────────────────────────────────
    let hasError = false;

    if (!emailTrim) {
      setFieldError('email', 'Email is required.');
      hasError = true;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrim)) {
        setFieldError('email', 'Please enter a valid email address.');
        hasError = true;
      }
    }

    if (!password) {
      setFieldError('password', 'Password is required.');
      hasError = true;
    }

    // ── Register-only validation ─────────────────────────────────────────────
    if (!isLogin) {
      if (!nameTrim) {
        setFieldError('name', 'Full name is required.');
        hasError = true;
      }

      if (!usernameTrim) {
        setFieldError('username', 'Username is required.');
        hasError = true;
      } else if (!isValidUsername(usernameTrim)) {
        setFieldError('username', 'Username: 3–20 chars, letters, numbers, _ only.');
        hasError = true;
      }

      if (password.length < 8) {
        setFieldError('password', 'Password must be at least 8 characters.');
        hasError = true;
      }

      if (!confirmPassword) {
        setFieldError('confirmPassword', 'Please confirm your password.');
        hasError = true;
      } else if (password !== confirmPassword) {
        setFieldError('confirmPassword', 'Passwords do not match.');
        hasError = true;
      }

      const age = calculateAge(dateOfBirth);
      if (age < 13) {
        setFieldError('dob', 'You must be at least 13 years old to join.');
        hasError = true;
      }

      if (!agreedToTerms) {
        setFieldError('terms', 'You must agree to the Terms & Conditions.');
        hasError = true;
      }
    }

    if (hasError) {
      Alert.alert(
        isLogin ? 'Check your details' : 'Please fix the errors',
        'Some fields need attention. Please review the form and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    // ── Submit ───────────────────────────────────────────────────────────────
    setLoading(true);
    try {
      if (isLogin) {
        await loginAction(emailTrim, password);
      } else {
        const result = await registerAction(
          nameTrim, usernameTrim, emailTrim, password, gender,
          dateOfBirth.toISOString().split('T')[0],
        );
        if (result && result.requiresVerification) {
          Alert.alert(
            '🎉 Account Created!',
            'Please check your inbox (or spam) and click the verification link before logging in.',
            [{ text: 'Got it!' }]
          );
        }
        // Clear form and go to login
        resetFormFields();
        setIsLogin(true);
      }
    } catch (e) {
      const msg = translateAuthError(e);
      setGlobalError(msg);
      Alert.alert(
        isLogin ? 'Login Failed' : 'Registration Error',
        msg,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, isLogin, name, username, gender, dateOfBirth, agreedToTerms, loginAction, registerAction, clearErrors, setFieldError]);

  /** [BUG-FIX] Reset ALL fields when switching modes */
  const resetFormFields = useCallback(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setUsername('');
    setGender('PreferNotToSay');
    setDateOfBirth(new Date(2000, 0, 1));
    setAgreedToTerms(false);
    setShowPass(false);
    setShowConfirmPass(false);
    clearErrors();
  }, [clearErrors]);

  const switchMode = useCallback(() => {
    resetFormFields();
    setIsLogin(prev => !prev);
  }, [resetFormFields]);

  // ----- Render --------------------------------------------------------------
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <ImageBackground
        source={{ uri: BG_IMAGE }}
        style={{ flex: 1, width: '100%', height: '100%' }}
        resizeMode="cover"
      >
        <View style={localStyles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={localStyles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Brand section */}
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

                {/* ── FORGOT PASSWORD ── */}
                {isForgotPassword ? (
                  <>
                    <Text style={[localStyles.cardTitle, { color: isDark ? '#fff' : '#333' }]}>Reset Password</Text>
                    <Text style={{ textAlign: 'center', color: isDark ? '#aaa' : '#666', marginBottom: 20 }}>
                      Enter the email associated with your account and we'll send you a reset link.
                    </Text>
                    <ModernInput
                      icon="mail-outline" placeholder="Email Address"
                      value={email} onChange={setEmail}
                      keyboard="email-address" isDark={isDark}
                      errorMsg={fieldErrors.email}
                    />
                    {globalError ? <Text style={localStyles.errorText}>{globalError}</Text> : null}
                    <TouchableOpacity style={localStyles.mainBtn} onPress={handlePasswordReset} disabled={loading}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={localStyles.mainBtnText}>Send Reset Link</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={{ marginTop: 20, alignItems: 'center' }} onPress={() => { setIsForgotPassword(false); clearErrors(); }}>
                      <Text style={{ color: brand.blue, fontWeight: 'bold' }}>← Back to Log In</Text>
                    </TouchableOpacity>
                  </>

                ) : (
                  <>
                    <Text style={[localStyles.cardTitle, { color: isDark ? '#fff' : '#333' }]}>
                      {isLogin ? 'Welcome Back 👋' : 'Create Account'}
                    </Text>

                    {/* ── REGISTER FIELDS ── */}
                    {!isLogin && (
                      <>
                        <ModernInput
                          icon="person-outline" placeholder="Full Name"
                          value={name} onChange={setName}
                          isDark={isDark} autoCapitalize="words"
                          errorMsg={fieldErrors.name}
                        />
                        <ModernInput
                          icon="at-outline" placeholder="Username (e.g. john_doe)"
                          value={username} onChange={setUsername}
                          isDark={isDark}
                          errorMsg={fieldErrors.username}
                        />

                        {/* Date of Birth picker */}
                        <TouchableOpacity
                          onPress={() => setShowDatePicker(true)}
                          style={[
                            localStyles.inputWrapper,
                            {
                              backgroundColor: isDark ? '#1C1C1E' : '#F5F7FA',
                              borderColor: fieldErrors.dob ? '#FF453A' : (isDark ? '#333' : '#eee'),
                              marginBottom: fieldErrors.dob ? 4 : 15,
                            },
                          ]}
                        >
                          <Ionicons name="calendar-outline" size={20} color={isDark ? '#888' : '#666'} style={{ marginRight: 10 }} />
                          <Text style={{ color: isDark ? '#fff' : '#333', fontSize: 16 }}>
                            Birth Date: {dateOfBirth.toLocaleDateString()}
                          </Text>
                          <Ionicons name="chevron-down-outline" size={16} color={isDark ? '#666' : '#999'} style={{ marginLeft: 'auto' }} />
                        </TouchableOpacity>
                        {fieldErrors.dob ? <Text style={localStyles.fieldError}>{fieldErrors.dob}</Text> : null}

                        {/* [BUG-FIX] display="spinner" + minimumDate fixes year > 1970 on Android */}
                        {showDatePicker && (
                          <DateTimePicker
                            value={dateOfBirth}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'spinner'}
                            onChange={handleDateChange}
                            maximumDate={new Date()}
                            minimumDate={new Date(1900, 0, 1)}
                          />
                        )}

                        {/* Gender selector */}
                        <Text style={[localStyles.sectionLabel, { color: isDark ? '#aaa' : '#666' }]}>Gender</Text>
                        <View style={{ flexDirection: 'row', marginBottom: 15, gap: 8, flexWrap: 'wrap' }}>
                          <GenderButton label="Male"       value="Male"            selectedValue={gender} onSelect={setGender} isDark={isDark} />
                          <GenderButton label="Female"     value="Female"          selectedValue={gender} onSelect={setGender} isDark={isDark} />
                          <GenderButton label="Other"      value="Other"           selectedValue={gender} onSelect={setGender} isDark={isDark} />
                          <GenderButton label="Prefer not" value="PreferNotToSay"  selectedValue={gender} onSelect={setGender} isDark={isDark} />
                        </View>
                      </>
                    )}

                    {/* ── SHARED FIELDS ── */}
                    <ModernInput
                      icon="mail-outline" placeholder="Email Address"
                      value={email} onChange={setEmail}
                      keyboard="email-address" isDark={isDark}
                      errorMsg={fieldErrors.email}
                    />

                    {/* [UX] Password with visibility toggle */}
                    <ModernInput
                      icon="lock-closed-outline" placeholder="Password"
                      value={password} onChange={setPassword}
                      secure={!showPass} isDark={isDark}
                      rightIcon={showPass ? 'eye-off-outline' : 'eye-outline'}
                      onRightIconPress={() => setShowPass(p => !p)}
                      errorMsg={fieldErrors.password}
                    />

                    {/* [UX] Password strength only on register */}
                    {!isLogin && <PasswordStrengthBar password={password} isDark={isDark} />}

                    {/* [UX] Confirm password — register only */}
                    {!isLogin && (
                      <ModernInput
                        icon="lock-closed-outline" placeholder="Confirm Password"
                        value={confirmPassword} onChange={setConfirmPassword}
                        secure={!showConfirmPass} isDark={isDark}
                        rightIcon={showConfirmPass ? 'eye-off-outline' : 'eye-outline'}
                        onRightIconPress={() => setShowConfirmPass(p => !p)}
                        errorMsg={fieldErrors.confirmPassword}
                      />
                    )}

                    {/* Forgot password link */}
                    {isLogin && (
                      <TouchableOpacity onPress={() => setIsForgotPassword(true)} style={{ alignSelf: 'flex-end', marginTop: -5, marginBottom: 15 }}>
                        <Text style={{ color: brand.blue, fontSize: 14, fontWeight: '600' }}>Forgot Password?</Text>
                      </TouchableOpacity>
                    )}

                    {/* [UX] Terms checkbox — register only */}
                    {!isLogin && (
                      <View style={{ marginBottom: 15 }}>
                        <TouchableOpacity
                          onPress={() => setAgreedToTerms(p => !p)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                        >
                          <View style={[
                            localStyles.checkbox,
                            { borderColor: fieldErrors.terms ? '#FF453A' : (isDark ? '#555' : '#ccc') },
                            agreedToTerms && { backgroundColor: brand.blue, borderColor: brand.blue },
                          ]}>
                            {agreedToTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
                          </View>
                          <Text style={{ color: isDark ? '#aaa' : '#666', flex: 1, fontSize: 13 }}>
                            I agree to the{' '}
                            <Text style={{ color: brand.blue, fontWeight: '600' }}>Terms & Conditions</Text>
                            {' '}and{' '}
                            <Text style={{ color: brand.blue, fontWeight: '600' }}>Privacy Policy</Text>
                          </Text>
                        </TouchableOpacity>
                        {fieldErrors.terms ? <Text style={localStyles.fieldError}>{fieldErrors.terms}</Text> : null}
                      </View>
                    )}

                    {/* Global error */}
                    {globalError ? <Text style={localStyles.errorText}>{globalError}</Text> : null}

                    {/* Main action button */}
                    <TouchableOpacity style={localStyles.mainBtn} onPress={handleSubmit} disabled={loading}>
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={localStyles.mainBtnText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
                      }
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={localStyles.divider}>
                      <View style={[localStyles.line, { backgroundColor: isDark ? '#333' : '#eee' }]} />
                      <Text style={[localStyles.orText, { color: isDark ? '#666' : '#999' }]}>OR</Text>
                      <View style={[localStyles.line, { backgroundColor: isDark ? '#333' : '#eee' }]} />
                    </View>

                    {/* Social logins */}
                    <TouchableOpacity
                      style={[localStyles.socialBtn, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#ddd' }]}
                      onPress={handleGoogleLogin}
                    >
                      <Ionicons name="logo-google" size={20} color="#DB4437" />
                      <Text style={[localStyles.socialText, { color: isDark ? '#fff' : '#333' }]}>Continue with Google</Text>
                    </TouchableOpacity>

                    {appleAvailable && (
                      <TouchableOpacity
                        style={[localStyles.socialBtn, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#ddd' }]}
                        onPress={handleAppleLogin}
                      >
                        <Ionicons name="logo-apple" size={20} color={isDark ? '#fff' : '#000'} />
                        <Text style={[localStyles.socialText, { color: isDark ? '#fff' : '#333' }]}>Continue with Apple</Text>
                      </TouchableOpacity>
                    )}

                    {/* Switch mode footer */}
                    <View style={localStyles.footer}>
                      <Text style={{ color: isDark ? '#aaa' : '#666' }}>{isLogin ? "Don't have an account? " : 'Already have an account? '}</Text>
                      <TouchableOpacity onPress={switchMode}>
                        <Text style={{ color: brand.blue, fontWeight: 'bold' }}>{isLogin ? 'Sign Up' : 'Log In'}</Text>
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
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scrollContent: { padding: 20, flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  brandSection:  { alignItems: 'center', marginBottom: 30, marginTop: 40 },
  logoIconBg:    { width: 60, height: 60, borderRadius: 18, backgroundColor: brand.blue, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  brandKliq:     { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  brandTap:      { fontSize: 36, fontWeight: '300', color: brand.orange },
  brandDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: brand.orange, marginLeft: 4, marginBottom: 6 },
  tagline:       { color: 'rgba(255,255,255,0.8)', fontSize: 16, marginTop: 5, letterSpacing: 1 },
  card:          { width: '100%', maxWidth: 400, borderRadius: 24, padding: 25, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  cardTitle:     { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  inputWrapper:  { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 15, height: 55, borderWidth: 1 },
  inputField:    { flex: 1, fontSize: 16, height: '100%' },
  sectionLabel:  { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 2 },
  genderBtn:     { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, minWidth: 70 },
  genderBtnActive: { backgroundColor: brand.blue, borderColor: brand.blue },
  genderText:    { fontWeight: '600', fontSize: 13 },
  checkbox:      { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  mainBtn:       { backgroundColor: brand.blue, height: 55, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: brand.blue, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4, marginTop: 10 },
  mainBtnText:   { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  errorText:     { color: '#FF453A', textAlign: 'center', marginBottom: 10, fontSize: 14 },
  fieldError:    { color: '#FF453A', fontSize: 12, marginBottom: 10, marginLeft: 5 },
  divider:       { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line:          { flex: 1, height: 1 },
  orText:        { marginHorizontal: 10, fontSize: 12 },
  socialBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, height: 50, borderRadius: 16, marginBottom: 12 },
  socialText:    { fontWeight: '600', marginLeft: 10 },
  footer:        { flexDirection: 'row', justifyContent: 'center', marginTop: 15 },
});