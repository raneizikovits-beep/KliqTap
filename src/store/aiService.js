// client/src/store/aiService.js
// ⭐️ PRODUCTION GRADE: Documented and standard error boundaries ⭐️

import { fetchAPI } from "./api"; 

/**
 * Generates an AI response for a given prompt by calling the secured API endpoint.
 * Requires an active JWT token.
 * * @param {string} prompt - The text prompt for the AI.
 * @returns {Promise<{ role: string, text: string }>} The AI's structured response.
 */
export async function generateAiResponse(prompt) {
  try {
    const response = await fetchAPI('/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
    return response;
  } catch (error) {
    console.error("[AI Service] Generate Error:", error);
    throw new Error('Internal server error on AI module. Check connection or server logs.'); 
  }
}

/**
 * Submits the user's intent/bio to the server for AI Matchmaking.
 * * @param {string} intentText - The user's described intent or bio.
 * @returns {Promise<Object>} Server response (updated user or success status).
 */
export async function submitUserIntent(intentText) {
  try {
    const response = await fetchAPI('/ai/onboarding', {
        method: 'POST',
        body: JSON.stringify({ intent: intentText }),
    });
    return response;
  } catch (error) {
    console.error("[AI Service] Submit Intent Failed:", error);
    throw new Error(error.message || 'Failed to submit user intent. Server connection error.');
  }
}

/**
 * Fetches AI-driven group recommendations based on user profile/intent.
 * * @returns {Promise<Array>} List of recommended groups.
 */
export async function fetchAiRecommendations() {
  try {
    return await fetchAPI('/ai/recommendations');
  } catch (error) {
    console.error("[AI Service] Failed to fetch recommendations:", error);
    throw error; 
  }
}