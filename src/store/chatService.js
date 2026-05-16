// client/src/store/chatService.js
// ✅ V9.1 PRODUCTION: Reconnect Backoff + ClientId Synchronization Fix

import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';

const MAX_QUEUE_SIZE = 200;
const MAX_CONSECUTIVE_ERRORS = 10;

const SOCKET_EVENTS = [
    'notification',
    'newMessage', 'chatHistory', 'messageEdited', 'messageDeleted',
    'user-joined', 'user-left',
    'signal-offer', 'signal-answer', 'signal-ice-candidate',
    'server.roulette-status', 'server.roulette-match-found',
    'call-error',
];

class ChatService {
    socket = null;
    store = null;
    messageQueue = [];
    consecutiveErrors = 0;

    connect(store) {
        if (store) this.store = store;

        const state = this.store?.();
        const token = state?.token;
        const rawUserId = state?.user?.id;
        const userId = rawUserId ? String(rawUserId) : null;

        if (!token || !userId) {
            if (__DEV__) console.log('[Socket.io] No auth token or user ID. Skipping connection.');
            return;
        }

        if (this.socket?.connected && this.socket.auth?.userId === userId) {
            return this.socket;
        }

        if (this.socket) {
            if (__DEV__) console.log('[Socket.io] Reconnecting with fresh credentials...');
            this._teardownSocket();
        }

        if (__DEV__) console.log(`[Socket.io] Connecting to ${API_BASE_URL} as user ${userId}...`);

        this.socket = io(API_BASE_URL, {
            auth: { token, userId },
            extraHeaders: { Authorization: `Bearer ${token}` },
            query: { userId, token },
            transports: ['websocket', 'polling'],
            autoConnect: true,
            forceNew: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1_000,
            reconnectionDelayMax: 30_000,
            randomizationFactor: 0.5,
            timeout: 20_000,
        });

        this.registerListeners();
        return this.socket;
    }

    _teardownSocket() {
        if (!this.socket) return;
        SOCKET_EVENTS.forEach(ev => this.socket.off(ev));
        this.socket.off('connect');
        this.socket.off('disconnect');
        this.socket.off('connect_error');
        try { this.socket.disconnect(); } catch (e) {}
        this.socket = null;
    }

    registerListeners() {
        if (!this.socket) return;

        const s = this.store;

        this.socket.on('connect', () => {
            if (__DEV__) console.log(`[Socket.io] Connected: ${this.socket.id}`);
            this.consecutiveErrors = 0;
            s?.().setSocketId?.(this.socket.id);
            this.flushQueue();
        });

        this.socket.on('disconnect', (reason) => {
            if (__DEV__) console.log(`[Socket.io] Disconnected: ${reason}`);
            s?.().setSocketId?.(null);
        });

        this.socket.on('connect_error', (err) => {
            this.consecutiveErrors += 1;
            if (__DEV__) console.warn(`[Socket.io] Connection error (#${this.consecutiveErrors}): ${err.message}`);

            if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                if (__DEV__) console.error('[Socket.io] Too many consecutive errors. Triggering auth failure.');
                try {
                    s?.().setCallError?.('Connection lost. Please log in again.');
                } catch (e) {}
                this._teardownSocket();
            }
        });

        // --- Notifications ---
        this.socket.on('notification', () => {
            s?.().fetchNotifications?.();
        });

        // --- Chat messages ---
        this.socket.on('newMessage',     (msg)  => s?.().addMessageToHistory?.(msg));
        this.socket.on('chatHistory',    (data) => s?.().setChatHistory?.(String(data.chatId), data.messages));
        this.socket.on('messageEdited',  (data) => s?.().editChatMessage?.(String(data.id), data.text));
        this.socket.on('messageDeleted', (data) => s?.().deleteChatMessage?.(String(data.id), String(data.chatId)));

        // --- WebRTC: voice/video ---
        this.socket.on('user-joined', async (data) => {
            const joinedUserId = String(data.userId);
            const state = s?.();
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
                if (__DEV__) console.log(`[WebRTC] Sent offer to newly joined user ${joinedUserId}`);
            } catch (e) {
                if (__DEV__) console.error('[WebRTC] Failed to create offer:', e.message);
            }
        });

        this.socket.on('user-left', (data) => {
            s?.().removePeerConnection?.(String(data.userId));
        });

        this.socket.on('signal-offer', (data) =>
            s?.().handleSignal?.(String(data.fromUserId), data.signal, String(data.roomId))
        );
        this.socket.on('signal-answer', (data) =>
            s?.().handleSignal?.(String(data.fromUserId), data.signal, String(data.roomId))
        );
        this.socket.on('signal-ice-candidate', (data) =>
            s?.().handleSignal?.(
                String(data.fromUserId),
                { candidate: data.candidate },
                String(data.roomId)
            )
        );

        // --- Roulette ---
        this.socket.on('server.roulette-status', (data) =>
            s?.().setRouletteStatus?.(data.status, data.message)
        );
        this.socket.on('server.roulette-match-found', (data) =>
            s?.().matchFound?.(String(data.roomId), String(data.partnerId))
        );

        // --- Error feedback ---
        this.socket.on('call-error', (data) => {
            if (__DEV__) console.warn(`[WebRTC] Call error: ${data.reason} (target: ${data.targetUserId})`);
        });
    }

    disconnect() {
        if (this.socket) {
            if (__DEV__) console.log('[Socket.io] Manually disconnecting...');
            this._teardownSocket();
        }
        this.messageQueue = [];
        this.consecutiveErrors = 0;
        this.store = null;
    }

    flushQueue() {
        if (!this.socket?.connected || this.messageQueue.length === 0) return;
        while (this.messageQueue.length > 0) {
            const item = this.messageQueue.shift();
            if (item) {
                try { this.socket.emit(item.event, item.data); } catch (e) {}
            }
        }
    }

    emit(event, data) {
        if (!this.socket?.connected) {
            if (__DEV__) console.log(`[Socket.io] Not connected — queuing '${event}'`);
            if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
                this.messageQueue.shift(); 
            }
            this.messageQueue.push({ event, data });
            if (this.store) this.connect(this.store);
            return;
        }
        try { this.socket.emit(event, data); } catch (e) {
            if (__DEV__) console.warn('[Socket.io] emit failed:', e?.message);
        }
    }

    // --- Chat ---
    sendChatMessage(chatId, senderId, text, clientId) {
        this.emit('sendMessage', { chatId: String(chatId), senderId: String(senderId), text, clientId });
    }
    editChatMessageOnServer(messageId, newText) {
        this.emit('editMessage', { messageId: String(messageId), newText });
    }
    deleteChatMessageOnServer(messageId, chatId) {
        this.emit('deleteMessage', { messageId: String(messageId), chatId: String(chatId) });
    }
    joinChat(chatId) { this.emit('joinChat', String(chatId)); }
    loadHistory(chatId) { this.emit('loadHistory', String(chatId)); }

    // --- Voice/Video ---
    joinVoiceRoom(roomId) { this.emit('join-voice-room', { roomId: String(roomId) }); }
    leaveVoiceRoom(roomId) { this.emit('leave-voice-room', { roomId: String(roomId) }); }
    sendSignalOffer(targetUserId, signal, roomId) {
        this.emit('send-signal-offer', { targetUserId: String(targetUserId), signal, roomId: String(roomId) });
    }
    sendSignalAnswer(targetUserId, signal, roomId) {
        this.emit('send-signal-answer', { targetUserId: String(targetUserId), signal, roomId: String(roomId) });
    }
    sendIceCandidate(targetUserId, candidate, roomId) {
        this.emit('send-ice-candidate', { targetUserId: String(targetUserId), candidate, roomId: String(roomId) });
    }

    // --- Roulette ---
    findRouletteMatch() { this.emit('client.find-roulette-match'); }
}

export const chatService = new ChatService();