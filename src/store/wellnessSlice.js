// client/src/store/wellnessSlice.js
// 🌿 V1 PRODUCTION: Wellness state + actions for KliqTap support hub
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

export const createWellnessSlice = (set, get) => ({
  // ── State ─────────────────────────────────────────────────────
  moodHistory: [],
  todayMood: null,
  journalEntries: [],
  wellnessStats: {
    streak: 0,
    thisWeek: { moodCheckins: 0, activities: 0, meditationMinutes: 0 },
    journalTotal: 0,
    moodTrend: 'unknown',
  },
  isWellnessLoading: false,

  // ── Mood check-in ─────────────────────────────────────────────
  logMood: async (mood, note) => {
    try {
      const entry = await fetchAPI('/support/mood', {
        method: 'POST',
        body: JSON.stringify({ mood, note: note || undefined }),
      });
      set((state) => ({
        todayMood: mood,
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
    try {
      const history = await fetchAPI(`/support/mood/history?days=${days}`);
      const arr = Array.isArray(history) ? history : [];
      // Detect today's mood
      const todayKey = new Date().toISOString().slice(0, 10);
      const todayEntry = arr.find(
        (e) => new Date(e.createdAt).toISOString().slice(0, 10) === todayKey,
      );
      set({ moodHistory: arr, todayMood: todayEntry?.mood || null });
      return arr;
    } catch (e) {
      if (__DEV__) console.warn('[Wellness] fetchMoodHistory failed:', e?.message);
      set({ moodHistory: [], todayMood: null });
      return [];
    }
  },

  // ── Journal ───────────────────────────────────────────────────
  createJournalEntry: async (text, mood) => {
    try {
      const entry = await fetchAPI('/support/journal', {
        method: 'POST',
        body: JSON.stringify({ text, mood: mood || undefined }),
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
    try {
      const entries = await fetchAPI(`/support/journal?limit=${limit}`);
      const arr = Array.isArray(entries) ? entries : [];
      set({ journalEntries: arr });
      return arr;
    } catch (e) {
      if (__DEV__) console.warn('[Wellness] fetchJournalEntries failed:', e?.message);
      set({ journalEntries: [] });
      return [];
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
      set({
        wellnessStats: stats || {
          streak: 0,
          thisWeek: { moodCheckins: 0, activities: 0, meditationMinutes: 0 },
          journalTotal: 0,
          moodTrend: 'unknown',
        },
      });
    } catch (e) {
      if (__DEV__) console.warn('[Wellness] fetchStats failed:', e?.message);
    } finally {
      set({ isWellnessLoading: false });
    }
  },

  // ── Ticket reply (used inside ticket detail modal) ────────────
  replyToTicket: async (ticketId, text) => {
    try {
      const updated = await fetchAPI(`/support/ticket/${ticketId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text }),
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