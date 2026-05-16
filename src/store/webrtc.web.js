// client/src/store/webrtc.web.js
export const RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
export const RTCIceCandidate = window.RTCIceCandidate;
export const RTCSessionDescription = window.RTCSessionDescription;
export const mediaDevices = window.navigator?.mediaDevices || null;