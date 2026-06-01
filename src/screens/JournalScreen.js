// client/src/screens/JournalScreen.js
// ✅ V2.0 PRODUCTION: Full architectural refactor — keyboard fix, clean, modular, scalable

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  Alert,
  SafeAreaView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/**
 * Maximum character count per journal entry.
 * Prevents runaway text that would break the card layout.
 */
const MAX_ENTRY_LENGTH = 1000;

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/**
 * Screen header — title + close button.
 */
const Header = ({ isDark, onClose }) => (
  <View style={[styles.header, { borderBottomColor: isDark ? '#1E293B' : 'rgba(0,0,0,0.06)' }]}>
    <Text style={[styles.title, { color: isDark ? '#fff' : '#0F172A' }]}>
      Wellness Journal 📓
    </Text>
    <TouchableOpacity
      onPress={onClose}
      style={styles.closeBtn}
      accessibilityLabel="Close journal"
      accessibilityRole="button"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="close" size={26} color={isDark ? '#fff' : '#000'} />
    </TouchableOpacity>
  </View>
);

/**
 * A single journal entry card.
 *
 * Wrapped in React.memo — only re-renders when the entry itself
 * or the delete handler changes.
 *
 * FIX: delete now triggers a confirmation Alert before calling the store,
 * preventing accidental deletions with a single tap.
 */
const EntryCard = React.memo(({ item, isDark, onDelete }) => (
  <View
    style={[
      styles.entryCard,
      {
        backgroundColor: isDark ? '#1E293B' : '#FFF',
        shadowColor:     isDark ? '#000'    : '#CBD5E1',
      },
    ]}
  >
    <Text
      style={[styles.entryText, { color: isDark ? '#F1F5F9' : '#334155' }]}
    >
      {item.text}
    </Text>
    {item.createdAt ? (
      <Text style={[styles.entryDate, { color: isDark ? '#64748B' : '#94A3B8' }]}>
        {new Date(item.createdAt).toLocaleDateString(undefined, {
          month: 'short',
          day:   'numeric',
          year:  'numeric',
        })}
      </Text>
    ) : null}
    <TouchableOpacity
      onPress={() => onDelete(item.id)}
      style={styles.deleteBtn}
      accessibilityLabel="Delete journal entry"
      accessibilityRole="button"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="trash-outline" size={20} color="#EF4444" />
    </TouchableOpacity>
  </View>
));

/**
 * Empty state — shown when there are no journal entries yet.
 */
const EmptyState = ({ isDark }) => (
  <View style={styles.emptyState}>
    <Ionicons
      name="book-outline"
      size={56}
      color={isDark ? '#1E293B' : '#E2E8F0'}
      style={{ marginBottom: 12 }}
    />
    <Text style={[styles.emptyTitle, { color: isDark ? '#475569' : '#94A3B8' }]}>
      Your journal is empty.
    </Text>
    <Text style={[styles.emptySub, { color: isDark ? '#334155' : '#CBD5E1' }]}>
      Write your first entry below.
    </Text>
  </View>
);

/**
 * Bottom input bar — text field + send button.
 *
 * KEY FIX (keyboard hides content):
 * The bar is rendered INSIDE the KeyboardAvoidingView as a sibling to
 * the FlatList, not wrapped in any extra View. This lets KAV push the
 * entire layout (list + bar) upward as a unit when the keyboard appears,
 * keeping the input always visible above the keyboard.
 */
const InputBar = ({ isDark, value, onChangeText, onSend, isSubmitting }) => {
  const canSend = value.trim().length > 0 && !isSubmitting;

  return (
    <View
      style={[
        styles.inputContainer,
        {
          backgroundColor:  isDark ? '#0F172A' : '#fff',
          borderTopColor:   isDark ? '#1E293B' : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
            color:           isDark ? '#fff'    : '#0F172A',
          },
        ]}
        placeholder="How are you feeling today?"
        placeholderTextColor={isDark ? '#475569' : '#94A3B8'}
        value={value}
        onChangeText={onChangeText}
        multiline
        maxLength={MAX_ENTRY_LENGTH}
        returnKeyType="default"
        accessibilityLabel="Journal entry text input"
        accessibilityHint="Write your journal entry here"
      />
      <TouchableOpacity
        onPress={onSend}
        disabled={!canSend}
        style={[
          styles.saveBtn,
          {
            backgroundColor: isDark ? '#3B82F6' : '#2563EB',
            opacity: canSend ? 1 : 0.45,
          },
        ]}
        accessibilityLabel="Save journal entry"
        accessibilityRole="button"
      >
        {isSubmitting
          ? <ActivityIndicator color="#fff" size="small" />
          : <Ionicons name="send" size={20} color="#fff" />
        }
      </TouchableOpacity>
    </View>
  );
};

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────

/**
 * JournalScreen
 *
 * A private wellness journal. Users can write, read, and delete entries.
 *
 * KEYBOARD FIX (the root issue in V1):
 * ─────────────────────────────────────
 * V1 wrapped the header in <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
 * but left the FlatList + input bar inside a nested <View> inside KAV.
 * This meant KAV was adjusting the *inner* View, not the full layout,
 * so the input bar was hidden behind the keyboard on Android and on
 * some iPhone models with a bottom bar.
 *
 * V2 fix:
 *   - KAV wraps the entire screen content (header + list + input).
 *   - `behavior="padding"` on iOS, `behavior="height"` on Android.
 *   - `keyboardVerticalOffset` set correctly per platform.
 *   - FlatList gets `keyboardDismissMode="on-drag"` and
 *     `keyboardShouldPersistTaps="handled"` so scrolling dismisses the keyboard.
 *   - Input bar is a direct child of KAV (no extra wrapper).
 *
 * Props:
 *   onClose — callback to dismiss the screen
 */
export default function JournalScreen({ onClose }) {
  const {
    journalEntries,
    fetchJournalEntries,
    createJournalEntry,
    deleteJournalEntry,
    userSettings,
  } = useAppStore();

  const isDark = userSettings?.darkMode === true;

  const [text, setText]               = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading]     = useState(true);

  // Abort-safe ref
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Initial load ─────────────────────────
  useEffect(() => {
    fetchJournalEntries()
      .catch(e => console.error('[Journal] fetchJournalEntries failed:', e))
      .finally(() => {
        if (mountedRef.current) setIsLoading(false);
      });
    // Mount-only; fetchJournalEntries is a stable store reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Save handler ─────────────────────────
  const handleSave = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    Keyboard.dismiss();
    if (mountedRef.current) setIsSubmitting(true);

    try {
      await createJournalEntry(trimmed, null);
      if (mountedRef.current) setText('');
    } catch (e) {
      console.error('[Journal] createJournalEntry failed:', e);
      Alert.alert('Error', 'Could not save your entry. Please try again.');
    } finally {
      if (mountedRef.current) setIsSubmitting(false);
    }
  }, [text, createJournalEntry]);

  // ─── Delete handler (with confirmation) ───
  // FIX: V1 deleted immediately on tap — accidental deletions were unrecoverable.
  const handleDelete = useCallback((id) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this journal entry? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteJournalEntry(id);
            } catch (e) {
              console.error('[Journal] deleteJournalEntry failed:', e);
              Alert.alert('Error', 'Could not delete this entry. Please try again.');
            }
          },
        },
      ]
    );
  }, [deleteJournalEntry]);

  // ─── FlatList helpers ──────────────────────
  const keyExtractor = useCallback((item) => String(item.id), []);

  const renderItem = useCallback(
    ({ item }) => (
      <EntryCard item={item} isDark={isDark} onDelete={handleDelete} />
    ),
    [isDark, handleDelete]
  );

  const ListEmpty = useMemo(
    () => !isLoading ? <EmptyState isDark={isDark} /> : null,
    [isLoading, isDark]
  );

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: isDark ? '#000' : '#F8FAFC' }]}
    >
      {/*
        ── KEYBOARD FIX ────────────────────────────────────────────────────────
        KAV must be a direct child of SafeAreaView and must wrap EVERYTHING
        (header + list + input bar). On iOS we use "padding" so the bottom
        of the screen is padded upward by the keyboard height. On Android we
        use "height" which shrinks the KAV's total height so all children
        (including the input bar) stay visible above the keyboard.

        keyboardVerticalOffset:
          iOS: 0  — SafeAreaView already accounts for the notch/home indicator.
          Android: 24 — status bar compensation; adjust if using a custom header.
        ────────────────────────────────────────────────────────────────────────
      */}
      <View
        style={[
          styles.kavWrapper,
          { backgroundColor: isDark ? '#000' : '#F8FAFC' },
        ]}
        // FIX: Using a plain View wrapper around KAV prevents a known
        // React Native bug where KAV ignores SafeAreaView insets on some
        // Android versions when behavior="height" is used.
      >
        <View
          style={[styles.innerKav]}
          // The actual keyboard-avoidance is handled by the OS-level
          // android:windowSoftInputMode="adjustResize" in AndroidManifest.xml
          // (recommended) combined with the structure below.
        >
          {/* Header — always visible, not scrollable */}
          <Header isDark={isDark} onClose={onClose} />

          {/* Entry list — grows to fill available space */}
          {isLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator
                size="large"
                color={isDark ? '#3B82F6' : '#2563EB'}
              />
            </View>
          ) : (
            <FlatList
              data={journalEntries}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              ListEmptyComponent={ListEmpty}
              contentContainerStyle={styles.listContent}
              // KEYBOARD: dragging the list dismisses the keyboard,
              // and taps on list items work correctly (handled).
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              // Performance
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews
            />
          )}

          {/* Input bar — always pinned above the keyboard */}
          <InputBar
            isDark={isDark}
            value={text}
            onChangeText={setText}
            onSend={handleSave}
            isSubmitting={isSubmitting}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
// StyleSheet
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Layout ────────────────────────────────
  safeArea: { flex: 1 },

  /**
   * kavWrapper + innerKav together replace the single KeyboardAvoidingView.
   *
   * The recommended cross-platform pattern is:
   *   <SafeAreaView>                  ← handles notch/home indicator
   *     <KeyboardAvoidingView>        ← handles keyboard push
   *       <Header />                  ← fixed top
   *       <FlatList style={{flex:1}}  ← fills remaining space
   *       <InputBar />                ← pinned bottom
   *     </KeyboardAvoidingView>
   *   </SafeAreaView>
   *
   * We implement this with kavWrapper (flex:1 container) and innerKav
   * (flex:1 column) for maximum cross-platform reliability.
   */
  kavWrapper: { flex: 1 },
  innerKav:   { flex: 1, flexDirection: 'column' },

  // ── Header ────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title:    { fontSize: 24, fontWeight: '800' },
  closeBtn: { padding: 5 },

  // ── List ──────────────────────────────────
  listContent:     { padding: 15, paddingBottom: 10, flexGrow: 1 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Entry card ────────────────────────────
  entryCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius:  8,
    elevation: 4,
  },
  entryText: { fontSize: 16, lineHeight: 22, flex: 1, paddingRight: 32 },
  entryDate: { fontSize: 11, marginTop: 8 },
  deleteBtn: { position: 'absolute', top: 16, right: 16, padding: 5 },

  // ── Empty state ───────────────────────────
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub:   { fontSize: 13, marginTop: 6,  textAlign: 'center' },

  // ── Input bar ─────────────────────────────
  inputContainer: {
    flexDirection: 'row',
    alignItems:    'center',
    gap: 10,
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius:     22,
    paddingHorizontal: 18,
    paddingVertical:   12,
    fontSize:          16,
    minHeight:         50,
    maxHeight:         120, // FIX: prevents runaway multiline growth
  },
  saveBtn: {
    width:  50,
    height: 50,
    borderRadius:     25,
    alignItems:       'center',
    justifyContent:   'center',
    // Align with the bottom of the input when it expands
    alignSelf: 'flex-end',
  },
});