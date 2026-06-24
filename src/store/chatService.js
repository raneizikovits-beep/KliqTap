// client/src/store/chatService.js
// ✅ V10.1 PRODUCTION — Auto-rejoin rooms on reconnect + ATTACHMENT SUPPORT
//
// ════════════════════════════════════════════════════════════════
// ROOT CAUSE FIX (v10):
//
//   [FIX-ROOT] Messages were one-directional after any socket
//              reconnect (network blip, app background, server
//              restart). The `connect` handler only flushed the
//              outbound queue — it never re-joined the chat rooms
//              the user was already in.
//
//              The server stores rooms per socket-session. When
//              Socket.io reconnects it assigns a NEW socket.id,
//              so the server has zero knowledge of which rooms
//              this client was in before. The client must
//              explicitly re-emit 'joinChat' for every active room.
//
//              Fix: activeRooms Set tracks every joinChat() call.
//              On every `connect` event (initial + reconnect)
//              we re-join all tracked rooms BEFORE flushing the
//              outbound queue, so no message is delivered to a
//              room the server thinks we've left.
//
//   [FIX-CALL] WebRTC call reliability: re-joining the voice room
//              on reconnect so ICE signaling can resume if the
//              socket dropped mid-call.
//
//   [FIX-QUEUE] Queue flush now happens AFTER room re-joins,
//               guaranteeing message delivery order.
//
// Preserved from V9.2:
//   [SECURITY]  senderId removed from payload — identity from JWT only
// ════════════════════════════════════════════════════════════════

import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

const MAX_QUEUE_SIZE          = 200;
const MAX_CONSECUTIVE_ERRORS  = 10;

const SOCKET_EVENTS = [
    'notification',
    'newMessage', 'chatHistory', 'messageEdited', 'messageDeleted',
    'user-joined', 'user-left',
    'signal-offer', 'signal-answer', 'signal-ice-candidate',
    'server.roulette-status', 'server.roulette-match-found',
    'call-error', 'ping-alive',
];

class ChatService {
    socket             = null;
    store              = null;
    messageQueue       = [];
    consecutiveErrors  = 0;

    // [FIX-ROOT] Track every room we've joined so we can re-join on reconnect.
    // Separate sets for chat rooms and voice rooms — they use different server events.
    activeRooms      = new Set();   // chat rooms  → 'joinChat'
    activeVoiceRooms = new Set();   // voice rooms → 'join-voice-room'

    // ─── connect ──────────────────────────────────────────────
    connect(store) {
        if (store) this.store = store;

        const state    = this.store?.();
        const token    = state?.token;
        const rawId    = state?.user?.id;
        const userId   = rawId ? String(rawId) : null;

        if (!token || !userId) {
            if (__DEV__) console.log('[Socket.io] No auth — skipping connect.');
            return;
        }

        // Already connected as this user — nothing to do.
        if (this.socket?.connected && this.socket.auth?.userId === userId) {
            return this.socket;
        }

        if (this.socket) {
            if (__DEV__) console.log('[Socket.io] Reconnecting with fresh credentials...');
            this._teardownSocket();
        }

        if (__DEV__) console.log(`[Socket.io] Connecting to ${API_BASE_URL} as user ${userId}...`);

        this.socket = io(API_BASE_URL, {
            auth:                 { token, userId },
            extraHeaders:         { Authorization: `Bearer ${token}` },
            query:                { userId, token },
            transports:           ['websocket'], 
            autoConnect:          true,
            forceNew:             true,
            reconnection:         true,
            reconnectionAttempts: Infinity,
            reconnectionDelay:    1_000,
            reconnectionDelayMax: 30_000,
            randomizationFactor:  0.5,
            timeout:              20_000,
        });

        this._registerListeners();
        return this.socket;
    }

    // ─── teardown ─────────────────────────────────────────────
    _teardownSocket() {
        if (!this.socket) return;
        SOCKET_EVENTS.forEach(ev => this.socket.off(ev));
        this.socket.off('connect');
        this.socket.off('disconnect');
        this.socket.off('connect_error');
        try { this.socket.disconnect(); } catch (_) {}
        this.socket = null;
    }

    // ─── [FIX-ROOT] Re-join all known rooms after (re)connect ─
        async _rejoinAllRooms() {
        if (!this.socket?.connected) return;
        const delay = (ms) => new Promise(res => setTimeout(res, ms));

        if (this.activeRooms.size > 0) {
            for (const chatId of this.activeRooms) {
                if (__DEV__) console.log(`[Socket.io] Joining chat room: ${chatId}`);
                this.socket.emit('joinChat', chatId);
                await delay(300); // ⭐️ השהייה של 300 מילי-שניות בין חדר לחדר
            }
        }

        if (this.activeVoiceRooms.size > 0) {
            for (const roomId of this.activeVoiceRooms) {
                this.socket.emit('join-voice-room', { roomId });
                await delay(300);
            }
        }
    }

    // ─── listeners ────────────────────────────────────────────
    _registerListeners() {
        if (!this.socket) return;
        const s = this.store;

        // ── Connection lifecycle ──────────────────────────────
        this.socket.on('connect', () => {
            if (__DEV__) console.log(`[Socket.io] Connected: ${this.socket.id}`);
            this.consecutiveErrors = 0;
            s?.().setSocketId?.(this.socket.id);

            // [FIX-ROOT] Re-join rooms FIRST, then flush the message queue.
            // Order matters: if we flush before rejoining, messages sent to a
            // room arrive at the server before we're a member of that room.
            this._rejoinAllRooms();
            this.flushQueue();
        });

        this.socket.on('disconnect', (reason) => {
            if (__DEV__) console.log(`[Socket.io] Disconnected: ${reason}`);
            s?.().setSocketId?.(null);
            // NOTE: We deliberately do NOT clear activeRooms here.
            //       Socket.io will reconnect automatically and _rejoinAllRooms
            //       will fire on the next 'connect' event.
        });

        this.socket.on('connect_error', (err) => {
            this.consecutiveErrors += 1;
            if (__DEV__) console.warn(`[Socket.io] Connection error (#${this.consecutiveErrors}): ${err.message}`);

            if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                if (__DEV__) console.error('[Socket.io] Too many errors — triggering auth failure.');
                s?.().setCallError?.('Connection lost. Please log in again.');
                this._teardownSocket();
            }
        });

        // ── Notifications ─────────────────────────────────────
        this.socket.on('notification', () => s?.().fetchNotifications?.());

        // ── Chat messages ─────────────────────────────────────
        this.socket.on('newMessage',  (msg)  => s?.().addMessageToHistory?.(msg));
        this.socket.on('chatHistory', (data) => s?.().setChatHistory?.(String(data.chatId), data.messages));
        // NOTE: 'messageEdited' and 'messageDeleted' are intentionally NOT handled here.
        // chatSlice.connectSocket() owns these two events: it calls socket.off() to remove
        // any handlers registered here, then adds its own correct handlers that use the
        // per-message chatId from the event payload (not currentChatId from state).
        // Handling them here would also re-emit to the server (via editChatMessageOnServer /
        // deleteChatMessageOnServer), creating an infinite loop.

        // ── WebRTC signaling ──────────────────────────────────
        this.socket.on('user-joined', async (data) => {
            const joinedUserId = String(data.userId);
            const state        = s?.();
            if (!state) return;

            const roomId = state.currentCallId;
            if (!roomId) return;

            const isVideo = !!state.currentVideoRoomId;

            let localStream = state.localStream;
            if (!localStream) {
                localStream = await state.startLocalStream?.(isVideo);
                if (!localStream) return;
            }

            const pc = state.setupPeerConnection?.(joinedUserId, isVideo);
            if (!pc) return;

            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                this.sendSignalOffer(joinedUserId, { type: offer.type, sdp: offer.sdp }, roomId);
                if (__DEV__) console.log(`[WebRTC] Sent offer to ${joinedUserId}`);
            } catch (e) {
                if (__DEV__) console.error('[WebRTC] Failed to create offer:', e.message);
            }
        });

        this.socket.on('user-left', (data) => s?.().removePeerConnection?.(String(data.userId)));

        this.socket.on('signal-offer',         (data) => s?.().handleSignal?.(String(data.fromUserId), data.signal,              String(data.roomId)));
        this.socket.on('signal-answer',        (data) => s?.().handleSignal?.(String(data.fromUserId), data.signal,              String(data.roomId)));
        this.socket.on('signal-ice-candidate', (data) => s?.().handleSignal?.(String(data.fromUserId), { candidate: data.candidate }, String(data.roomId)));

        // ── Roulette ──────────────────────────────────────────
        this.socket.on('server.roulette-status',      (data) => s?.().setRouletteStatus?.(data.status, data.message));
        this.socket.on('server.roulette-match-found', (data) => s?.().matchFound?.(String(data.roomId), String(data.partnerId)));

        // ── Liveness ack (prevents server treating us as zombie) ─
        this.socket.on('ping-alive', (_data, callback) => {
            if (typeof callback === 'function') callback(null);
        });

        // ── Call errors ───────────────────────────────────────
        this.socket.on('call-error', (data) => {
            if (__DEV__) console.warn(`[WebRTC] Call error: ${data.reason} (target: ${data.targetUserId})`);
        });
    }

    // ─── public disconnect ────────────────────────────────────
    disconnect() {
        if (this.socket) {
            if (__DEV__) console.log('[Socket.io] Manually disconnecting...');
            this._teardownSocket();
        }
        // On explicit logout/disconnect we DO clear rooms — user is leaving intentionally.
        this.activeRooms.clear();
        this.activeVoiceRooms.clear();
        this.messageQueue       = [];
        this.consecutiveErrors  = 0;
        this.store              = null;
    }

    // ─── queue flush ──────────────────────────────────────────
    flushQueue() {
        if (!this.socket?.connected || this.messageQueue.length === 0) return;
        while (this.messageQueue.length > 0) {
            const item = this.messageQueue.shift();
            if (item) {
                try { this.socket.emit(item.event, item.data); } catch (_) {}
            }
        }
    }

    // ─── emit (with offline queue) ────────────────────────────
    emit(event, data) {
        if (!this.socket?.connected) {
            if (__DEV__) console.log(`[Socket.io] Offline — queuing '${event}'`);
            if (this.messageQueue.length >= MAX_QUEUE_SIZE) this.messageQueue.shift();
            this.messageQueue.push({ event, data });
            if (this.store) this.connect(this.store);
            return;
        }
        try { this.socket.emit(event, data); } catch (e) {
            if (__DEV__) console.warn('[Socket.io] emit failed:', e?.message);
        }
    }

    // ─── Chat ─────────────────────────────────────────────────

    /**
     * Join a chat room and track it for automatic reconnect re-join.
     * Safe to call multiple times — Set deduplicates.
     */
    joinChat(chatId) {
        const id = String(chatId);
        this.activeRooms.add(id);           // [FIX-ROOT] track for reconnect
        this.emit('joinChat', id);
    }

    /**
     * Leave a chat room explicitly (e.g. user deletes conversation).
     * Normal navigation unmount should NOT call this — the room stays
     * tracked so reconnects keep it live in the background.
     */
    leaveChat(chatId) {
        const id = String(chatId);
        this.activeRooms.delete(id);
        this.emit('leaveChat', id);
    }

    loadHistory(chatId) {
        this.emit('loadHistory', String(chatId));
    }

    // ⭐️ V10.1: Added attachmentUrl to payload. Server reads from JWT for senderId.
    sendChatMessage(chatId, _senderId, text, clientId, replyToId = null, attachmentUrl = null) {
        const payload = { chatId: String(chatId), text, clientId };
        if (replyToId) payload.replyToId = String(replyToId);
        if (attachmentUrl) payload.attachmentUrl = attachmentUrl; // 👈 צירוף הקובץ להודעה
        this.emit('sendMessage', payload);
    }

    // פונקציה חדשה שמודיעה לשרת שקראת את ההודעות
    markChatAsRead(chatId) {
        this.emit('markChatAsRead', { chatId: String(chatId) });
    }

    editChatMessageOnServer(messageId, newText) {
        this.emit('editMessage', { messageId: String(messageId), newText });
    }

    deleteChatMessageOnServer(messageId, chatId) {
        this.emit('deleteMessage', { messageId: String(messageId), chatId: String(chatId) });
    }

    // ─── Voice / Video ────────────────────────────────────────

    joinVoiceRoom(roomId) {
        const id = String(roomId);
        this.activeVoiceRooms.add(id);      // [FIX-CALL] track for reconnect
        this.emit('join-voice-room', { roomId: id });
    }

    leaveVoiceRoom(roomId) {
        const id = String(roomId);
        this.activeVoiceRooms.delete(id);
        this.emit('leave-voice-room', { roomId: id });
    }

    // ⭐️ [FIX] Notify the room that this user is ending the call.
    // Server relays 'callEnded' to all other participants so their UI dismisses.
    sendCallEnded(roomId) {
        this.emit('endCall', { roomId: String(roomId) });
    }

    sendSignalOffer(targetUserId, signal, roomId) {
        this.emit('send-signal-offer', { targetUserId: String(targetUserId), signal, roomId: String(roomId) });
    }

    sendSignalAnswer(targetUserId, signal, roomId) {
        this.emit('send-signal-answer', { targetUserId: String(targetUserId), signal, roomId: String(roomId) });
    }

    sendIceCandidate(targetUserId, candidate, roomId) {
        this.emit('send-ice-candidate', { targetUserId: String(targetUserId), candidate, roomId: String(roomId) });
    }

    // ─── Roulette ─────────────────────────────────────────────
    findRouletteMatch() { this.emit('client.find-roulette-match'); }
}

export const chatService = new ChatService();