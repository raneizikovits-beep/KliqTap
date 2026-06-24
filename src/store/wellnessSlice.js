// client/src/store/wellnessSlice.js
// 🌿 V1.1 PRODUCTION: Wellness state + actions for KliqTap support hub
//
// [V1.1 CHANGES — Engineering Audit Fixes]:
//   • [FIX HIGH-1]  logMood: mood enum validation + note length cap (500 chars)
//   • [FIX HIGH-1]  createJournalEntry: required-text guard + length cap (10,000 chars)
//   • [FIX HIGH-1]  replyToTicket: non-empty guard + length cap (2,000 chars)
//   • [FIX HIGH-2]  fetchWellnessStats: syncs top-level `streak` so gamification
//                   and wellness streak stay on a single source of truth
//   • [FIX MEDIUM-3] fetchMoodHistory: per-action `isMoodHistoryLoading` flag
//                   prevents race conditions on concurrent calls
//   • [FIX MEDIUM-3] fetchJournalEntries: per-action `isJournalLoading` flag
//                   prevents race conditions on concurrent calls
//   • [ARCH TODO]   replyToTicket marked for migration to supportSlice
//
// HOW TO INTEGRATE:
//   1) Save this file at client/src/store/wellnessSlice.js
//   2) In useAppStore.js, import and merge it:
//
//      import { createWellnessSlice } from './wellnessSlice';
//      // ...inside the store factory:
//      ...createWellnessSlice(set, get),
//
//   3) That's it — all functions become available via useAppStore().

import { fetchAPI } from './api';

// ─────────────────────────────────────────────────────────────
// Validation constants — single source of truth for all input rules
// ─────────────────────────────────────────────────────────────

/** Allowed mood values. Must match the backend enum exactly. */
const VALID_MOODS   = Object.freeze(['great', 'good', 'okay', 'bad', 'terrible']);
const MAX_NOTE_LEN  = 500;      // mood check-in note
const MAX_TEXT_LEN  = 10_000;  // journal entry body
const MAX_REPLY_LEN = 2_000;   // support ticket reply

/**
 * Throws a clear error if `mood` is not a recognised enum value.
 * This fires before any network call so invalid data never reaches the server.
 * @param {string} mood
 */
const assertValidMood = (mood) => {
  if (!VALID_MOODS.includes(mood)) {
    throw new Error(
      `[Wellness] Invalid mood value "${mood}". Must be one of: ${VALID_MOODS.join(', ')}`
    );
  }
};

/**
 * Truncate a string to at most `max` characters.
 * Returns undefined for non-string inputs (preserves optional field semantics).
 * @param {string|undefined} str
 * @param {number} max
 * @returns {string|undefined}
 */
const truncate = (str, max) =>
  typeof str === 'string' ? str.slice(0, max) : undefined;

// ─────────────────────────────────────────────────────────────
// Slice factory
// ─────────────────────────────────────────────────────────────

export const createWellnessSlice = (set, get) => ({
  // ── State ─────────────────────────────────────────────────────
  moodHistory:   [],
  todayMood:     null,
  journalEntries: [],
  wellnessStats: {
    streak:    0,
    thisWeek:  { moodCheckins: 0, activities: 0, meditationMinutes: 0 },
    journalTotal: 0,
    moodTrend: 'unknown',
  },
  isWellnessLoading:    false,
  isMoodHistoryLoading: false,  // per-action flag — prevents duplicate concurrent fetches
  isJournalLoading:     false,  // per-action flag — prevents duplicate concurrent fetches

  // ── Mood check-in ─────────────────────────────────────────────

  logMood: async (mood, note) => {
    // Validate before touching the network
    assertValidMood(mood);
    const safeNote = truncate(note, MAX_NOTE_LEN);

    try {
      const entry = await fetchAPI('/support/mood', {
        method: 'POST',
        body: JSON.stringify({ mood, note: safeNote }),
      });
      set((state) => ({
        todayMood:   mood,
        moodHistory: [entry, ...(state.moodHistory || [])].slice(0, 365),
      }));
      // Refresh stats after logging
      get().fetchWellnessStats?.();
      return entry;
    } catch (e) {
      if (__DEV__) console.warn('[Wellness] logMood failed:', e?.message);
      throw e;
    }
  },

  fetchMoodHistory: async (days = 30) => {
    // [FIX MEDIUM-3] Per-action guard — a second call while one is in-flight
    // returns the current cached array instead of firing a duplicate request.
    if (get().isMoodHistoryLoading) return get().moodHistory;
    set({ isMoodHistoryLoading: true });

    try {
      const history = await fetchAPI(`/support/mood/history?days=${days}`);
      const arr     = Array.isArray(history) ? history : [];

      // Detect today's mood from the returned history
      const todayKey  = new Date().toISOString().slice(0, 10);
      const todayEntry = arr.find(
        (e) => new Date(e.createdAt).toISOString().slice(0, 10) === todayKey,
      );
      set({ moodHistory: arr, todayMood: todayEntry?.mood || null });
      return arr;
    } catch (e) {
      if (__DEV__) console.warn('[Wellness] fetchMoodHistory failed:', e?.message);
      set({ moodHistory: [], todayMood: null });
      return [];
    } finally {
      set({ isMoodHistoryLoading: false });
    }
  },

  // ── Journal ───────────────────────────────────────────────────

  createJournalEntry: async (text, mood) => {
    // Validate required fields before network call
    if (!text?.trim()) throw new Error('[Wellness] Journal text is required.');
    if (mood) assertValidMood(mood);
    const safeText = truncate(text, MAX_TEXT_LEN);

    try {
      const entry = await fetchAPI('/support/journal', {
        method: 'POST',
        body: JSON.stringify({ text: safeText, mood: mood || undefined }),
      });
      set((state) => ({
        journalEntries: [entry, ...(state.journalEntries || [])].slice(0, 200),
      }));
      get().fetchWellnessStats?.();
      return entry;
    } catch (e) {
      if (__DEV__) console.warn('[Wellness] createJournalEntry failed:', e?.message);
      throw e;
    }
  },

  fetchJournalEntries: async (limit = 50) => {
    // [FIX MEDIUM-3] Per-action guard — prevents duplicate concurrent fetches.
    if (get().isJournalLoading) return get().journalEntries;
    set({ isJournalLoading: true });

    try {
      const entries = await fetchAPI(`/support/journal?limit=${limit}`);
      const arr     = Array.isArray(entries) ? entries : [];
      set({ journalEntries: arr });
      return arr;
    } catch (e) {
      if (__DEV__) console.warn('[Wellness] fetchJournalEntries failed:', e?.message);
      set({ journalEntries: [] });
      return [];
    } finally {
      set({ isJournalLoading: false });
    }
  },

  deleteJournalEntry: async (entryId) => {
    try {
      await fetchAPI(`/support/journal/${entryId}`, { method: 'DELETE' });
      set((state) => ({
        journalEntries: (state.journalEntries || []).filter((e) => e.id !== entryId),
      }));
      return true;
    } catch (e) {
      if (__DEV__) console.warn('[Wellness] deleteJournalEntry failed:', e?.message);
      return false;
    }
  },

  // ── Activity logging (meditation, breathing, etc.) ────────────

  logWellnessActivity: async (activity, durationSec) => {
    try {
      const entry = await fetchAPI('/support/activity', {
        method: 'POST',
        body: JSON.stringify({
          activity,
          durationSec: durationSec || undefined,
        }),
      });
      get().fetchWellnessStats?.();
      return entry;
    } catch (e) {
      if (__DEV__) console.warn('[Wellness] logActivity failed:', e?.message);
      // Don't throw — activity logging should never block UX
      return null;
    }
  },

  // ── Stats ─────────────────────────────────────────────────────

  fetchWellnessStats: async () => {
    try {
      set({ isWellnessLoading: true });
      const stats = await fetchAPI('/support/wellness/stats');

      const resolved = stats || {
        streak:    0,
        thisWeek:  { moodCheckins: 0, activities: 0, meditationMinutes: 0 },
        journalTotal: 0,
        moodTrend: 'unknown',
      };

      set({
        wellnessStats: resolved,
        // [FIX HIGH-2] Sync the top-level `streak` key that gamification uses
        // so both `state.streak` and `state.wellnessStats.streak` always agree.
        // The server is the source of truth; local award('Streak') increments are
        // reconciled here on every stats refresh.
        streak: resolved.streak ?? get().streak,
      });
    } catch (e) {
      if (__DEV__) console.warn('[Wellness] fetchStats failed:', e?.message);
    } finally {
      set({ isWellnessLoading: false });
    }
  },

  // ── Ticket reply ──────────────────────────────────────────────
  // TODO [ARCH HIGH-4]: Move this function to a dedicated supportSlice.
  //   It lives here temporarily because wellnessSlice was the first
  //   support-adjacent slice created. It has no conceptual relation to
  //   wellness state. Moving it requires no behaviour changes.
  replyToTicket: async (ticketId, text) => {
    // Validate before network call
    const safeText = truncate(text, MAX_REPLY_LEN);
    if (!safeText?.trim()) throw new Error('[Support] Reply text is required.');

    try {
      const updated = await fetchAPI(`/support/ticket/${ticketId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text: safeText }),
      });
      // Refresh tickets list to show new message
      get().fetchMyTickets?.();
      return updated;
    } catch (e) {
      if (__DEV__) console.warn('[Wellness] replyToTicket failed:', e?.message);
      throw e;
    }
  },
});