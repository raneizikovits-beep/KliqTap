// client/src/store/useAiStore.js
// 🛡️ KLIQMIND V12.1 — FIXED: פונה ל-NestJS הקיים במקום לשרת Python

import { create } from 'zustand';

// ✅ תוקן: api.kliqtap.com (NestJS, port 3000) — לא api.kliqmind.com (Python)
// השרת NestJS כבר מכיל את כל ה-endpoints דרך ai-agents.controller.ts
const API_BASE_URL = 'https://api.kliqtap.com';

async function aiRequest(endpoint, options = {}, token) {
  if (!token) throw new Error('AUTH_REQUIRED');

  const headers = {
    'Authorization': `Bearer ${token}`,
    ...(options.body && { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) throw new Error('AUTH_EXPIRED');

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errorBody || response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error(`[aiRequest] Error on ${endpoint}:`, error.message);
    throw error;
  }
}

export const useAiStore = create((set, get) => ({
  myAgents: [],
  isLoadingAgents: false,
  isSendingMessage: false,
  isGeneratingAgent: false,
  chatHistory: [],
  lastError: null,

  clearError: () => set({ lastError: null }),

  /**
   * טעינת סוכנים
   * ✅ NestJS: GET /ai-agents/my-agents  (ai-agents.controller.ts → getUserAgents)
   * מחזיר: UserAgentRecord[] (מערך ישירות, לא { agents: [...] })
   */
  fetchMyAgents: async (token) => {
    if (!token) return;
    set({ isLoadingAgents: true, lastError: null });
    try {
      const data = await aiRequest('/ai-agents/my-agents', { method: 'GET' }, token);

      // השרת מחזיר מערך ישירות — לא { agents: [...] }
      const agentsArray = Array.isArray(data) ? data : [];

      set({ myAgents: agentsArray, isLoadingAgents: false });
    } catch (error) {
      set({
        isLoadingAgents: false,
        lastError:
          error.message === 'AUTH_EXPIRED'
            ? 'Session expired. Please log in again.'
            : 'Could not load AI agents.',
      });
    }
  },

  /**
   * יצירת סוכן מותאם אישית
   * ✅ NestJS: POST /ai-agents/generate  (ai-agents.controller.ts → generateCustomAgent)
   * Body: { prompt: string }
   * מחזיר: UserAgentRecord
   */
  createCustomAgent: async (token, prompt) => {
    if (!token || !prompt?.trim()) return false;
    set({ isGeneratingAgent: true, lastError: null });
    try {
      const newAgent = await aiRequest(
        '/ai-agents/generate',
        {
          method: 'POST',
          body: JSON.stringify({ prompt: prompt.trim() }),
        },
        token,
      );

      set((state) => ({
        myAgents: [newAgent, ...state.myAgents],
        isGeneratingAgent: false,
      }));
      return true;
    } catch (error) {
      set({ isGeneratingAgent: false, lastError: 'Agent creation failed.' });
      return false;
    }
  },

  /**
   * מחיקת סוכן
   * ✅ NestJS: DELETE /ai-agents/:id  (ai-agents.controller.ts → deleteCustomAgent)
   */
  deleteAgent: async (token, agentId) => {
    if (!token || !agentId) return;
    const prev = get().myAgents;

    // Optimistic update
    set({ myAgents: get().myAgents.filter((a) => String(a.id) !== String(agentId)) });

    try {
      await aiRequest(`/ai-agents/${agentId}`, { method: 'DELETE' }, token);
    } catch (error) {
      set({ myAgents: prev, lastError: 'Could not delete agent.' });
    }
  },

  /**
   * שליחת הודעה
   * ✅ NestJS: POST /ai-agents/chat  (ai-agents.controller.ts → chatWithAgent)
   * Body: { userAgentId: string, message: string }
   * מחזיר: { reply: string }
   */
    sendMessage: async (token, userAgentId, message) => {
    if (!token || !userAgentId || !message?.trim()) return;

    console.log('🆔 SENDING userAgentId:', userAgentId);   // ← הוסף את זה
    
    const trimmedMessage = message.trim();
    const userMsg = {
      id: `user-${Date.now()}`,
      text: trimmedMessage,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      chatHistory: [...state.chatHistory, userMsg],
      isSendingMessage: true,
      lastError: null,
    }));

    try {
      const data = await aiRequest(
        '/ai-agents/chat',
        {
          method: 'POST',
          body: JSON.stringify({ userAgentId, message: trimmedMessage }),
        },
        token,
      );

      const replyText = data?.reply || 'No response received.';
      const botMsg = {
        id: `bot-${Date.now()}`,
        text: replyText,
        sender: 'bot',
        timestamp: new Date().toISOString(),
      };

      set((state) => ({
        chatHistory: [...state.chatHistory, botMsg],
        isSendingMessage: false,
      }));
    } catch (error) {
      set({ isSendingMessage: false, lastError: 'Failed to connect to AI agent.' });
    }
  },

  clearChatHistory: () => set({ chatHistory: [], lastError: null }),
}));