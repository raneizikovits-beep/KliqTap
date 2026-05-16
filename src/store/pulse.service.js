// client/src/store/pulse.service.js
// ⭐️ V4.0 PRODUCTION: Web Blob Upload Fix Parity + Cleaner Error Surface ⭐️
//
// שינויים מ-V3.0:
//   • createPulse  — בנייה זהה ל-social.service.js: ב-Web → fetch(uri).blob() → append(blob)
//   • magicUpload  — אותו תיקון; גם תמיכה ב-https URLs (לא רק blob: / file:)
//   • Centralized helper — appendMediaToFormData מיובא מ-social.service כדי למנוע drift
//   • שדה 'text' מורם תמיד גם אם ריק → backend מצפה לקבל field
//   • שגיאות מטופלות ב-throw קונסיסטנטי במקום silent failure

import { Platform } from 'react-native';
import { fetchAPI } from './api';
import { describeFileFromUri } from './mimeUtils';

// ─────────────────────────────────────────────────────────────
// Internal helper — same logic as social.service.js
// (שיקול: לחלץ ל-mimeUtils.js בעתיד כדי שכל ה-services יחלקו)
// ─────────────────────────────────────────────────────────────
async function appendMediaToFormData(formData, fieldName, uri, fallback = 'upload.jpg') {
    const { filename, type } = describeFileFromUri(uri, fallback);

    if (Platform.OS === 'web') {
        // Chrome cannot handle { uri } objects — needs real Blob
        const response = await fetch(uri);
        if (!response.ok) {
            throw new Error(`Failed to read local media (status ${response.status})`);
        }
        const blob = await response.blob();
        // Use the blob's reported MIME type when available; fall back to inferred
        const finalType = blob.type || type || 'application/octet-stream';
        const ext = finalType.includes('/') ? finalType.split('/')[1].split(';')[0] : 'bin';
        formData.append(fieldName, blob, filename || `upload.${ext}`);
    } else {
        // React Native's polyfill handles { uri, name, type } natively
        formData.append(fieldName, { uri, name: filename, type });
    }
}

/**
 * Fetches the active pulses (stories) feed.
 * @returns {Promise<Array>} - always returns an array, never throws
 */
export async function fetchActivePulses() {
    try {
        const pulses = await fetchAPI('/pulse/feed');
        return Array.isArray(pulses) ? pulses : [];
    } catch (error) {
        if (__DEV__) console.error('[PulseService] fetchActivePulses error:', error);
        return [];
    }
}

/**
 * Creates a new Pulse (story) with text + optional media + vibe.
 *
 * @param {string}  text     - Caption text (may be empty)
 * @param {string?} imageUri - Local URI to image/video (optional)
 * @param {string}  vibe     - Vibe tag (default 'Neutral')
 * @returns {Promise<Object>} - the created pulse from server
 */
export async function createPulse(text, imageUri, vibe = 'Neutral') {
    const formData = new FormData();
    formData.append('text', text || '');
    formData.append('vibe', vibe || 'Neutral');

    if (imageUri) {
        await appendMediaToFormData(formData, 'image', imageUri, `pulse_${Date.now()}.jpg`);
    }

    return fetchAPI('/pulse', {
        method: 'POST',
        body: formData,
    });
}

/**
 * Deletes a Pulse by ID.
 * @param {string} pulseId
 */
export async function deletePulse(pulseId) {
    if (!pulseId) throw new Error('Pulse ID is required for deletion.');
    return fetchAPI(`/pulse/${pulseId}`, { method: 'DELETE' });
}

/**
 * Magic Upload — combined Pulse + Post + Profile in one request.
 * Now Web-safe.
 */
export async function magicUpload(fileUri, text = '', vibe = 'Normal') {
    if (!fileUri) throw new Error('File URI is required for magic upload.');

    const formData = new FormData();
    formData.append('text', text || '');
    formData.append('vibe', vibe || 'Normal');

    await appendMediaToFormData(formData, 'file', fileUri, `magic_${Date.now()}.jpg`);

    return fetchAPI('/pulse/magic-upload', {
        method: 'POST',
        body: formData,
    });
}