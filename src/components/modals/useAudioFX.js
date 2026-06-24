// useAudioFX.js — KliqTap Audio FX engine v4.1 (uses your api.fetchAPI)
// ─────────────────────────────────────────────────────────────────────────────
// HOW FX WORKS:
//   The recorded take is uploaded to your NestJS endpoint (POST /karaoke/fx),
//   ffmpeg applies the effect on Oracle, and the processed clip URL comes back.
//
// AUTH — handled for you:
//   This calls your existing api.fetchAPI(), which automatically attaches the
//   "Authorization: Bearer <token>" header (see buildHeaders in api.ts) AND
//   detects FormData uploads. So there is NO getToken to wire — it just works.
//
//   ⚠️ Adjust the import path on the next line if needed. From
//      components/modals/useAudioFX.js the store is usually '../../store/api'.
//
// [V4.1 CHANGES — Engineering Audit Fix]:
//   [FIX LOW-MEDIUM] processRecording was hardcoding `type: 'video/mp4'` for every
//                     upload regardless of the input file's actual container format.
//                     iOS camera captures frequently produce .mov (QuickTime) files —
//                     mislabeling those as video/mp4 can cause the server's ffmpeg
//                     step to fail silently, which this hook's own catch-block then
//                     masks as "FX unavailable, using dry clip" — making a real,
//                     fixable upload bug invisible. Now derives name/type from the
//                     actual URI extension, falling back to mp4 if undetermined.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import * as api from '../../store/api';   // 👈 your existing API wrapper

// Public base for resolving the relative clip path the server returns
// (e.g. "/uploads/karaoke/fx_echo_xxx.mp4").
const API_BASE = api.API_BASE_URL || 'https://api.kliqtap.com';

// Known video container → MIME type mapping. Extends easily if new formats appear.
const VIDEO_MIME_TYPES = {
  mp4:  'video/mp4',
  mov:  'video/quicktime', // common default for iOS camera captures
  webm: 'video/webm',
  m4v:  'video/x-m4v',
};

/**
 * Derives a safe { name, type } pair from a local file URI's extension.
 * Falls back to mp4 if the extension is missing or unrecognized.
 * @param {string} uri
 */
function resolveVideoFile(uri) {
  const match = uri.match(/\.(\w+)(?:\?.*)?$/);
  const rawExt = (match?.[1] || '').toLowerCase();
  const ext = VIDEO_MIME_TYPES[rawExt] ? rawExt : 'mp4';
  return { name: `take.${ext}`, type: VIDEO_MIME_TYPES[ext] };
}

// Panel chips. color reused for the active-chip glow.
export const FX_PRESETS = [
  { key: 'dry',     label: 'Dry',          icon: 'remove-outline',     color: '#888'    },
  { key: 'studio',  label: 'Studio',       icon: 'options-outline',    color: '#00F5D4' },
  { key: 'echo',    label: 'Echo',         icon: 'repeat-outline',     color: '#3A86FF' },
  { key: 'reverb',  label: 'Reverb',       icon: 'water-outline',      color: '#B14EFF' },
  { key: 'hall',    label: 'Concert Hall', icon: 'business-outline',   color: '#FF9F1C' },
  { key: 'harmony', label: 'Harmony',      icon: 'people-outline',     color: '#FF2D55' },
  { key: 'up',      label: 'Pitch Up',     icon: 'arrow-up-outline',   color: '#FFD700' },
  { key: 'down',    label: 'Pitch Down',   icon: 'arrow-down-outline', color: '#FF006E' },
];

export const useAudioFX = () => {
  const [processing, setProcessing] = useState(false);

  // Returns a uri for the processed clip. Dry preset → original uri unchanged.
  // Any failure → falls back to the dry clip so the user is never blocked.
  const processRecording = useCallback(async (inputUri, presetKey, intensity = 0.6) => {
    if (!inputUri || presetKey === 'dry') return inputUri;

    setProcessing(true);
    try {
      // [FIX LOW-MEDIUM] Derive the real container format instead of assuming mp4.
      const { name, type } = resolveVideoFile(inputUri);

      const form = new FormData();
      form.append('video', { uri: inputUri, name, type });
      form.append('preset', presetKey);
      form.append('intensity', String(intensity));

      // fetchAPI attaches the auth token + handles FormData automatically.
      const res = await api.fetchAPI('/karaoke/fx', { method: 'POST', body: form });

      const url = res?.url;
      if (!url) return inputUri;
      return url.startsWith('http') ? url : `${API_BASE}${url}`;
    } catch (e) {
      console.error('[useAudioFX] FX failed, using dry clip:', e?.message || e);
      return inputUri;
    } finally {
      setProcessing(false);
    }
  }, []);

  return { FX_PRESETS, processRecording, processing };
};