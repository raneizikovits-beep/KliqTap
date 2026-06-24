// client/src/store/webrtc.web.js
// [FIX MEDIUM-8] Guard against non-browser environments (SSR, Jest, build tools).
// `window` is undefined in Node.js — accessing it directly throws ReferenceError.
// This shim makes the module safe to import in any environment.
const _win = typeof window !== 'undefined' ? window : {};

export const RTCPeerConnection     = _win.RTCPeerConnection || _win.webkitRTCPeerConnection || null;
export const RTCIceCandidate       = _win.RTCIceCandidate        || null;
export const RTCSessionDescription = _win.RTCSessionDescription   || null;
export const mediaDevices          = _win.navigator?.mediaDevices || null;