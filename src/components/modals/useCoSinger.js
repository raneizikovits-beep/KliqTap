// useCoSinger.js — KliqTap real-time duet (Co-Singer) v1.1
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS IS:
//   Two users sing together live. WebRTC peer-to-peer audio+video, with the
//   offer/answer/ICE handshake signaled over your Supabase Realtime channel.
//
// REQUIREMENTS:
//   npm i react-native-webrtc
//   ⚠️ react-native-webrtc does NOT run in Expo Go — you need a custom dev client
//      / EAS build (you're already past Expo Go since you use recordAsync, so fine).
//   • Pass your initialized Supabase client into the hook.
//   • For users behind strict NAT you'll want a TURN server. coturn on your Oracle
//     Cloud box is the natural move — drop its creds into ICE_SERVERS below.
//
// DESIGN NOTE — lazy require:
//   We require('react-native-webrtc') INSIDE the functions, not at module top.
//   That keeps this file import-safe so KaraokeRoom's SOLO mode still works even
//   before the WebRTC native module is installed. Nothing native loads until a
//   user actually starts a duet.
//
// SCOPE:
//   This delivers the live sing-together experience (local + remote streams).
//   Recording/posting the *combined* duet is Phase 2 (server-side compositing of
//   both tracks, or local screen-capture) — flagged where relevant.
//
// [V1.1 CHANGES — Engineering Audit Fixes]:
//   [FIX CRITICAL] leave() read `localStream` from a closure parameter, but the
//                  unmount-cleanup effect (`useEffect(() => () => leave(), [])`)
//                  only ever captures the FIRST render's version of `leave` — and
//                  at first render, `localStream` is always null (its initial
//                  useState value). This meant that if a user closed the duet
//                  screen WHILE a call was active, the camera/mic tracks were
//                  NEVER actually stopped on unmount — a real privacy/battery leak
//                  (camera light staying on, mic staying hot, after the user
//                  believes they've left the call). Fixed by mirroring
//                  localStream into a ref (localStreamRef) that leave() reads
//                  from instead — refs are always current regardless of when the
//                  closure capturing them was created.
//   [FIX MEDIUM]   The 'join' handler (createRoom) and 'offer' handler (joinRoom)
//                  had no try/catch around their WebRTC negotiation logic, while
//                  the sibling 'ice' handler did. A failure in createOffer/
//                  setLocalDescription/createAnswer left `status` stuck at
//                  'connecting' forever with no error surfaced — no way for the
//                  user to know it failed or retry. Wrapped both in try/catch,
//                  matching the existing error-handling pattern used everywhere
//                  else in this file.
//   [FIX LOW]      getUserMedia video constraints used bare numeric values
//                  (width: 720, height: 1280), which the WebRTC spec treats as
//                  EXACT/required — a device whose camera can't hit that precise
//                  resolution causes getUserMedia to reject outright instead of
//                  falling back to the closest match. Wrapped in { ideal: ... }.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  // 🔧 Add your coturn (Oracle Cloud) for reliable connects behind NAT:
  // { urls: 'turn:YOUR_HOST:3478', username: 'kliqtap', credential: 'YOUR_SECRET' },
];

const loadRTC = () => {
  try { return require('react-native-webrtc'); }
  catch { return null; } // not installed yet → duet stays disabled, no crash
};

// status: idle | hosting | joining | connecting | live | ended | error
export const useCoSinger = (supabase) => {
  const [status, setStatus]             = useState('idle');
  const [roomCode, setRoomCode]         = useState(null);
  const [localStream, setLocalStream]   = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [error, setError]               = useState(null);

  const pcRef      = useRef(null);
  const channelRef = useRef(null);
  // [FIX CRITICAL] Mirrors `localStream` state for stable access inside leave().
  // See header note — the mount-once unmount-cleanup effect can only ever see
  // the FIRST render's closure, so leave() must read mutable state via a ref,
  // not a closed-over variable that goes stale the moment localStream updates.
  const localStreamRef = useRef(null);

  const getLocal = useCallback(async () => {
    const rtc = loadRTC();
    if (!rtc) { setError('react-native-webrtc not installed'); setStatus('error'); return null; }
    const { mediaDevices } = rtc;
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      // [FIX LOW] { ideal: ... } instead of bare numbers — the WebRTC spec treats
      // bare numeric constraints as EXACT/required, so a camera that can't hit
      // this precise resolution would reject the whole call instead of falling
      // back to its closest supported mode.
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30 } },
    });
    localStreamRef.current = stream; // [FIX CRITICAL] keep ref in sync
    setLocalStream(stream);
    return stream;
  }, []);

  const buildPeer = useCallback((channel, stream) => {
    const { RTCPeerConnection } = loadRTC();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.ontrack = (e) => {
      if (e.streams && e.streams[0]) setRemoteStream(e.streams[0]);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) channel.send({ type: 'broadcast', event: 'ice', payload: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') setStatus('live');
      if (s === 'failed' || s === 'disconnected') setStatus('ended');
    };

    pcRef.current = pc;
    return pc;
  }, []);

  // ── HOST: open a room, wait for a guest, then send the offer ────────────────
  const createRoom = useCallback(async () => {
    if (!supabase) { setError('Supabase client not provided'); setStatus('error'); return; }
    try {
      setError(null);
      const code = Math.random().toString(36).slice(2, 7).toUpperCase();
      setRoomCode(code);
      setStatus('hosting');

      const stream  = await getLocal();
      if (!stream) return; // RTC missing — error already set
      const channel = supabase.channel(`duet:${code}`, { config: { broadcast: { self: false } } });
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'join' }, async () => {
          // [FIX MEDIUM] try/catch added — without it, a failure in createOffer/
          // setLocalDescription left `status` stuck at 'connecting' forever with
          // no error surfaced to the user and no way to retry.
          try {
            setStatus('connecting');
            const { RTCSessionDescription } = loadRTC();
            const pc    = buildPeer(channel, stream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(new RTCSessionDescription(offer));
            channel.send({ type: 'broadcast', event: 'offer', payload: offer });
          } catch (e) {
            console.error('[useCoSinger] Offer negotiation failed:', e);
            setError(e.message); setStatus('error');
          }
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          const { RTCSessionDescription } = loadRTC();
          await pcRef.current?.setRemoteDescription(new RTCSessionDescription(payload));
        })
        .on('broadcast', { event: 'ice' }, async ({ payload }) => {
          const { RTCIceCandidate } = loadRTC();
          try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(payload)); } catch {}
        })
        .subscribe();

      return code;
    } catch (e) {
      console.error('[useCoSinger] createRoom:', e);
      setError(e.message); setStatus('error');
    }
  }, [supabase, getLocal, buildPeer]);

  // ── GUEST: join an existing room and answer the host's offer ────────────────
  const joinRoom = useCallback(async (code) => {
    if (!supabase) { setError('Supabase client not provided'); setStatus('error'); return; }
    if (!code) return;
    try {
      setError(null);
      setRoomCode(code);
      setStatus('joining');

      const stream  = await getLocal();
      if (!stream) return; // RTC missing — error already set
      const channel = supabase.channel(`duet:${code}`, { config: { broadcast: { self: false } } });
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          // [FIX MEDIUM] Same gap as createRoom's 'join' handler — see that comment.
          try {
            setStatus('connecting');
            const { RTCSessionDescription } = loadRTC();
            const pc     = buildPeer(channel, stream);
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(new RTCSessionDescription(answer));
            channel.send({ type: 'broadcast', event: 'answer', payload: answer });
          } catch (e) {
            console.error('[useCoSinger] Answer negotiation failed:', e);
            setError(e.message); setStatus('error');
          }
        })
        .on('broadcast', { event: 'ice' }, async ({ payload }) => {
          const { RTCIceCandidate } = loadRTC();
          try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(payload)); } catch {}
        })
        .subscribe((st) => {
          // announce arrival once subscribed so the host fires its offer
          if (st === 'SUBSCRIBED') channel.send({ type: 'broadcast', event: 'join', payload: {} });
        });
    } catch (e) {
      console.error('[useCoSinger] joinRoom:', e);
      setError(e.message); setStatus('error');
    }
  }, [supabase, getLocal, buildPeer]);

  const leave = useCallback(() => {
    try {
      pcRef.current?.close();
      // [FIX CRITICAL] Read from the ref, not the closed-over `localStream` param.
      // See header note for why the closure version goes stale on unmount.
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (channelRef.current && supabase) supabase.removeChannel(channelRef.current);
    } catch {}
    pcRef.current = null;
    channelRef.current = null;
    localStreamRef.current = null; // [FIX CRITICAL] clear the ref alongside state
    setLocalStream(null);
    setRemoteStream(null);
    setRoomCode(null);
    setStatus('idle');
  }, [supabase]); // [FIX CRITICAL] localStream removed — leave() now reads the stable ref instead

  // cleanup on unmount
  useEffect(() => () => leave(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, roomCode, localStream, remoteStream, error, createRoom, joinRoom, leave };
};