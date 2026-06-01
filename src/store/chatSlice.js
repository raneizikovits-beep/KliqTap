// client/src/store/chatSlice.js
// ✅ V11.3 PRODUCTION — SINGLE FILE WEB & NATIVE SAFE 
// פתרון מוחלט לקריסות ב-Android וב-Web (Chrome) בקובץ אחד.

import { Platform } from 'react-native';
import { chatService } from './chatService';
import { fetchAPI } from './api';

// ─────────────────────────────────────────────────────────────
// Cross-platform WebRTC bindings (Smart Conditional Loading)
// מונע קריסות ב-Chrome ומונע שגיאות undefined ב-Android
// ─────────────────────────────────────────────────────────────
let RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices;

if (Platform.OS === 'web') {
    RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    RTCIceCandidate = window.RTCIceCandidate;
    RTCSessionDescription = window.RTCSessionDescription;
    mediaDevices = window.navigator?.mediaDevices || null;
} else {
    // דינמי רק לנייטיב כדי שהדפדפן לא ינסה לטעון מודולים של טלפון
    const NativeWebRTC = require('react-native-webrtc');
    RTCPeerConnection = NativeWebRTC.RTCPeerConnection;
    RTCIceCandidate = NativeWebRTC.RTCIceCandidate;
    RTCSessionDescription = NativeWebRTC.RTCSessionDescription;
    mediaDevices = NativeWebRTC.mediaDevices;
}

// ─────────────────────────────────────────────────────────────
// Constants — single source of truth
// ─────────────────────────────────────────────────────────────
const STUN_SERVER = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

const CALLER_DIAL_TIMEOUT_MS = 45_000;
const RECEIVER_CONNECT_TIMEOUT_MS = 30_000;
const ROULETTE_SESSION_MS = 60_000;
const CHAT_HISTORY_CAP = 200;
const ICE_QUEUE_CAP = 200;

// ─────────────────────────────────────────────────────────────
// UUID generator — Pure JS (No expo-crypto requires)
// ─────────────────────────────────────────────────────────────
const generateRoomId = (userId, targetUserId) => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).slice(2, 11);
    return `${userId}_${targetUserId}_${timestamp}_${randomStr}`;
};

const generateClientId = () =>
    `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// ─────────────────────────────────────────────────────────────
// Per-chat history bounding (slide window of most-recent N)
// ─────────────────────────────────────────────────────────────
const trimHistory = (messages) =>
    messages.length > CHAT_HISTORY_CAP ? messages.slice(-CHAT_HISTORY_CAP) : messages;

// ─────────────────────────────────────────────────────────────
// Normalizers
// ─────────────────────────────────────────────────────────────
const normalizeSender = (rawSender) => {
    if (!rawSender) return { id: null, name: 'Unknown' };
    if (typeof rawSender === 'string') {
        return { id: rawSender, name: 'User', username: 'user', avatar: null };
    }
    const id = rawSender._id || rawSender.id;
    if (id) {
        return {
            id: String(id),
            name: rawSender.name || rawSender.username || 'Unknown',
            username: rawSender.username,
            avatar: rawSender.avatarUrl || rawSender.avatar,
        };
    }
    return { id: null, ...rawSender };
};

const buildIncomingCall = (existing, patch, userCache) => {
    const merged = { ...(existing || {}), ...(patch || {}) };
    const callId = String(merged.callId || merged.roomId || patch?.callId || patch?.roomId || '');
    const callerId = String(merged.callerId || merged.fromUserId || patch?.callerId || patch?.fromUserId || '');

    let callerName = merged.callerName || merged.name || merged.username;
    if (!callerName && userCache && callerId) {
        const cached = userCache[callerId];
        if (cached) callerName = cached.name || cached.username;
    }
    if (!callerName) {
        callerName = callerId ? `User ${callerId.slice(0, 6)}` : 'Incoming Call';
    }

    return {
        callId,
        callerId,
        callerName,
        isVideo: merged.isVideo === true,
        signal: merged.signal || null,
    };
};

const buildRemoteParty = (userId, userCache) => {
    if (!userId) return null;
    const id = String(userId);
    const cached = (userCache || {})[id];
    const name = cached?.name || cached?.username || `User ${id.slice(0, 6)}`;
    return { id, name, avatar: cached?.avatarUrl || cached?.avatar || null };
};

// Push to ICE queue with cap
const pushBoundedICE = (queue, candidate) => {
    const next = [...queue, candidate];
    return next.length > ICE_QUEUE_CAP ? next.slice(-ICE_QUEUE_CAP) : next;
};

// ─────────────────────────────────────────────────────────────
// Initial state — exported for global reset composition (authSlice)
// ─────────────────────────────────────────────────────────────
export const chatInitialState = {
    socketId: null,
    currentChatId: null,
    chatHistory: {},
    chatMetadata: {},

    searchResults: [],
    isSearchingUsers: false,

    currentVoiceRoomId: null,
    currentVideoRoomId: null,
    currentCallId: null,
    incomingCall: null,
    remoteParty: null,
    localStream: null,
    peerConnections: {},
    peerStreams: {},
    pendingIceCandidates: {},
    videoSenders: {},                  
    isMuted: false,
    isSpeakerOn: false,
    isCameraEnabled: true,

    callStatus: 'idle',
    callError: null,
    _callTimeoutId: null,

    isRouletteSearching: false,
    rouletteStatusMessage: null,
    rouletteTimerId: null,
};

// ═════════════════════════════════════════════════════════════
// Slice factory
// ═════════════════════════════════════════════════════════════
export const createChatSlice = (set, get) => ({
    ...chatInitialState,

    // ----- Simple setters -----
    setSocketId: (socketId) => set({ socketId }),
    setCurrentCallId: (callId) => set({ currentCallId: String(callId) }),
    setCallError: (msg) => set({ callStatus: 'error', callError: msg }),
    resetCallState: () => set({ callStatus: 'idle', callError: null }),
    getOtherUserIdInDM: (chatId) => get().chatMetadata[String(chatId)]?.otherUserId || null,

    // ─────────────────────────────────────────────────────────
    // SOCKET LIFECYCLE
    // ─────────────────────────────────────────────────────────
    connectSocket: () => {
        const socket = chatService.connect(get);
        if (!socket) return;

        const events = [
            'messageDeleted', 'messageEdited', 'callError',
            'userOffline', 'signal', 'incomingCall',
            'callDeclined', 'callEnded',
        ];
        events.forEach(ev => socket.off(ev));

        socket.on('messageDeleted', (data) => {
            const msgId = String(data.id || data.messageId);
            const chatId = String(data.chatId);
            set(state => {
                const newHistory = { ...state.chatHistory };
                if (chatId && chatId !== 'undefined' && newHistory[chatId]) {
                    newHistory[chatId] = newHistory[chatId].filter(m => String(m.id) !== msgId);
                    return { chatHistory: newHistory };
                }
                return state;
            });
        });

        socket.on('messageEdited', (data) => {
            const msgId = String(data.id || data.messageId);
            const newText = data.text || data.newText;
            const chatId = String(data.chatId);
            set(state => {
                const newHistory = { ...state.chatHistory };
                if (newHistory[chatId]) {
                    newHistory[chatId] = newHistory[chatId].map(m =>
                        String(m.id) === msgId
                            ? { ...m, text: newText, body: newText, edited: true }
                            : m
                    );
                }
                return { chatHistory: newHistory };
            });
        });

        socket.on('signal', (data) => {
            get().handleSignal(data.fromUserId, data.signal, data.roomId);
        });

        socket.on('incomingCall', (data) => {
            if (get().currentCallId) {
                if (__DEV__) console.warn('[Call] Ignoring incoming call — already in a call');
                return;
            }
            set(state => {
                const userCache = state.userCache || {};
                const merged = buildIncomingCall(state.incomingCall, data, userCache);
                const callerId = merged.callerId;

                if (callerId && !userCache[callerId] && typeof get().resolveUser === 'function') {
                    Promise.resolve(get().resolveUser(callerId))
                        .then(u => {
                            if (!u) return;
                            set(s => {
                                if (!s.incomingCall || s.incomingCall.callerId !== callerId) return s;
                                return {
                                    incomingCall: {
                                        ...s.incomingCall,
                                        callerName: u.name || u.username || s.incomingCall.callerName,
                                    },
                                };
                            });
                        })
                        .catch(() => {});
                }

                return { incomingCall: merged };
            });
        });

        socket.on('callDeclined', (data) => {
            const myCallId = get().currentCallId;
            const declinedCallId = String(data?.callId || data?.roomId || '');
            if (myCallId && declinedCallId && String(myCallId) !== declinedCallId) return;

            set({ callStatus: 'error', callError: 'Call declined' });
            try {
                const id = get().currentCallId;
                if (id) get().endCall(id);
            } catch (e) {}
        });

        socket.on('callEnded', (data) => {
            const id = get().currentCallId;
            if (!id) return;
            const endedId = String(data?.callId || data?.roomId || id);
            if (String(id) === endedId) {
                try { get().endCall(id); } catch (e) {}
            }
        });

        socket.on('callError', (data) => {
            set({ callStatus: 'error', callError: data?.message || 'Call failed' });
        });

        socket.on('userOffline', () => {
            set({ callStatus: 'error', callError: 'The user is currently offline.' });
        });
    },

    disconnectSocket: () => {
        if (chatService && typeof chatService.disconnect === 'function') {
            chatService.disconnect();
        }
    },

    // ─────────────────────────────────────────────────────────
    // USER SEARCH & CONVERSATIONS
    // ─────────────────────────────────────────────────────────
    searchUsers: async (query) => {
        if (!query || query.length < 2) {
            set({ searchResults: [] });
            return;
        }
        set({ isSearchingUsers: true });
        try {
            const results = await fetchAPI(`/users/search?q=${encodeURIComponent(query)}`);
            set({ searchResults: Array.isArray(results) ? results : [] });
        } catch (error) {
            set({ searchResults: [] });
        } finally {
            set({ isSearchingUsers: false });
        }
    },

    startDirectChat: async (targetUser) => {
        const targetId = String(targetUser.id || targetUser._id);
        try {
            if (get().userCache) {
                set(state => ({ userCache: { ...state.userCache, [targetId]: targetUser } }));
            }

            const chatData = await fetchAPI('/chats/private', {
                method: 'POST',
                body: JSON.stringify({ targetUserId: targetId }),
            });

            if (chatData?.id || chatData?._id) {
                const safeChatId = String(chatData.id || chatData._id);
                const targetName = targetUser.name || targetUser.username || 'User';
                const targetImage = targetUser.avatarUrl || targetUser.avatar || null;

                set(state => ({
                    currentChatId: safeChatId,
                    chatMetadata: {
                        ...state.chatMetadata,
                        [safeChatId]: {
                            isDM: true,
                            otherUserId: targetId,
                            fallbackName: targetName,
                            name: targetName,
                            image: targetImage,
                            unreadCount: 0,
                        },
                    },
                    chatHistory: {
                        ...state.chatHistory,
                        ...(!state.chatHistory[safeChatId] ? { [safeChatId]: [] } : {}),
                    },
                }));

                chatService.joinChat(safeChatId);
                chatService.loadHistory(safeChatId);
            }
        } catch (error) {
            if (__DEV__) console.warn('[Chat] startDirectChat failed:', error?.message);
        }
    },

    fetchConversations: async () => {
        try {
            const conversations = await fetchAPI('/chats');
            if (!Array.isArray(conversations)) return;

            const newHistory = { ...get().chatHistory };
            const userCacheUpdates = {};
            const metadataUpdates = {};
            const myId = get().user?.id ? String(get().user.id) : null;

            conversations.forEach(chat => {
                const safeChatId = String(chat.id || chat._id);

                if (chat.lastMessage) {
                    if (!newHistory[safeChatId] || newHistory[safeChatId].length === 0) {
                        newHistory[safeChatId] = [{
                            ...chat.lastMessage,
                            id: String(chat.lastMessage._id || chat.lastMessage.id),
                            text: chat.lastMessage.body || chat.lastMessage.text,
                            body: chat.lastMessage.body || chat.lastMessage.text,
                            time: chat.lastMessage.time || chat.lastMessage.createdAt,
                            isRead: chat.lastMessage.isRead ?? true,
                            sender: normalizeSender(chat.lastMessage.sender || chat.lastMessage.user),
                        }];
                    }
                }

                const safeOtherUserId = chat.otherUserId ? String(chat.otherUserId) : null;

                if (chat.isDM && safeOtherUserId) {
                    userCacheUpdates[safeOtherUserId] = {
                        id: safeOtherUserId,
                        name: chat.name,
                        username: chat.username || chat.name,
                        avatarUrl: chat.image,
                    };
                }

                let dmUserId = safeOtherUserId;
                let dmUserName = chat.name;

                if (chat.isDM && !dmUserId && chat.lastMessage?.sender && myId) {
                    const sender = normalizeSender(chat.lastMessage.sender);
                    if (sender.id && sender.id !== myId) {
                        dmUserId = sender.id;
                        dmUserName = sender.name || sender.username;
                    }
                }

                metadataUpdates[safeChatId] = {
                    isDM: chat.isDM === true,
                    otherUserId: dmUserId,
                    fallbackName: dmUserName,
                    name: dmUserName,
                    image: chat.image,
                    unreadCount: chat.unreadCount || 0,
                    lastMessage: chat.lastMessage
                        ? { ...chat.lastMessage, text: chat.lastMessage.body || chat.lastMessage.text }
                        : null,
                };
            });

            set(state => ({
                chatHistory: newHistory,
                userCache: { ...state.userCache, ...userCacheUpdates },
                chatMetadata: { ...state.chatMetadata, ...metadataUpdates },
            }));
        } catch (error) {
            if (__DEV__) console.warn('[Chat] fetchConversations failed:', error?.message);
        }
    },

    openChat: (chatId) => {
        const safeChatId = String(chatId);
        set(state => ({
            currentChatId: safeChatId,
            chatHistory: {
                ...state.chatHistory,
                ...(!state.chatHistory[safeChatId] ? { [safeChatId]: [] } : {}),
            },
            chatMetadata: {
                ...state.chatMetadata,
                ...(state.chatMetadata[safeChatId]
                    ? { [safeChatId]: { ...state.chatMetadata[safeChatId], unreadCount: 0 } }
                    : {}),
            },
        }));
        chatService.joinChat(safeChatId);
        chatService.loadHistory(safeChatId);
    },

    closeChat: () => set({ currentChatId: null }),

    // ─────────────────────────────────────────────────────────
    // CHAT MESSAGES 
    // ─────────────────────────────────────────────────────────
    sendChatMessage: (text) => {
        const { currentChatId, user } = get();
        if (!currentChatId || !text || !user) return;

        const clientId = generateClientId();

        const tempMessage = {
            id: clientId,
            clientId,
            sender: {
                id: String(user.id),
                name: user.name || user.username || 'Me',
                username: user.username,
                avatar: user.avatarUrl,
            },
            text, body: text, type: 'text',
            time: new Date().toISOString(),
            timestamp: new Date().toISOString(),
            isRead: true,
            pending: true,
        };

        get().addMessageToHistory(tempMessage);
        chatService.sendChatMessage(currentChatId, String(user.id), text, clientId);
    },

    editChatMessage: (messageId, newText) => {
        const { currentChatId, user } = get();
        if (!currentChatId || !messageId || !newText || !user) return;

        const safeChatId = String(currentChatId);
        const safeMessageId = String(messageId);

        set(state => {
            const messages = state.chatHistory[safeChatId] || [];
            const updated = messages.map(m =>
                String(m.id) === safeMessageId
                    ? { ...m, text: newText, body: newText, edited: true, isEdited: true }
                    : m
            );
            return { chatHistory: { ...state.chatHistory, [safeChatId]: updated } };
        });

        chatService.editChatMessageOnServer?.(safeMessageId, newText);
    },

    deleteChatMessage: (messageId, forEveryone = false) => {
        const { currentChatId } = get();
        if (!currentChatId || !messageId) return;

        const safeChatId = String(currentChatId);
        const safeMessageId = String(messageId);

        set(state => {
            const messages = state.chatHistory[safeChatId] || [];
            const filtered = messages.filter(m => String(m.id) !== safeMessageId);
            return { chatHistory: { ...state.chatHistory, [safeChatId]: filtered } };
        });

        if (forEveryone) {
            chatService.deleteChatMessageOnServer?.(safeMessageId, safeChatId);
        }
    },

    addMessageToHistory: (rawMessage) => {
        const senderObject = normalizeSender(rawMessage.sender || rawMessage.user);

        if (senderObject?.id && get().userCache) {
            set(state => ({ userCache: { ...state.userCache, [senderObject.id]: senderObject } }));
        }

        const messageId = String(rawMessage._id || rawMessage.id || '');
        const clientId = rawMessage.clientId || null;
        const targetChatId = String(
            rawMessage.chatId || rawMessage.groupId || rawMessage.chat || get().currentChatId || ''
        );

        if (!targetChatId || targetChatId === 'undefined') return;

        const message = {
            id: messageId,
            clientId,
            chatId: targetChatId,
            sender: senderObject,
            text: rawMessage.body || rawMessage.text || '',
            body: rawMessage.body || rawMessage.text || '',
            type: rawMessage.type || 'text',
            time: rawMessage.time || rawMessage.createdAt || new Date().toISOString(),
            isRead: rawMessage.isRead ?? false,
            edited: rawMessage.edited || rawMessage.isEdited || (() => {
                if (!rawMessage.updatedAt || !rawMessage.createdAt) return false;
                return Math.abs(new Date(rawMessage.updatedAt) - new Date(rawMessage.createdAt)) > 1000;
            })(),
            pending: rawMessage.pending || false,
        };

        set(state => {
            const currentMessages = state.chatHistory[targetChatId] || [];
            const myId = state.user?.id ? String(state.user.id) : null;

            if (messageId && !messageId.startsWith('local-')) {
                const exists = currentMessages.some(m =>
                    String(m.id) === messageId && !String(m.id).startsWith('local-')
                );
                if (exists) return state;
            }

            if (myId && message.sender?.id && String(message.sender.id) === myId && !messageId.startsWith('local-')) {
                let tempIndex = -1;

                if (clientId) {
                    tempIndex = currentMessages.findIndex(m => m.clientId && m.clientId === clientId);
                }

                if (tempIndex === -1) {
                    const messageText = message.text || message.body || '';
                    tempIndex = currentMessages.findIndex(m =>
                        m.pending && (m.text === messageText || m.body === messageText)
                    );
                }

                if (tempIndex !== -1) {
                    const updatedMessages = [...currentMessages];
                    updatedMessages[tempIndex] = { ...message, pending: false };

                    const newMetadata = { ...state.chatMetadata };
                    newMetadata[targetChatId] = {
                        ...(newMetadata[targetChatId] || {}),
                        lastMessage: message,
                    };

                    return {
                        chatHistory: { ...state.chatHistory, [targetChatId]: trimHistory(updatedMessages) },
                        chatMetadata: newMetadata,
                    };
                }
            }

            const newMetadata = { ...state.chatMetadata };
            const isFromOther = myId && message.sender?.id && String(message.sender.id) !== myId;
            const isNotOpen = targetChatId !== state.currentChatId;

            if (isFromOther && isNotOpen) {
                const existing = newMetadata[targetChatId] || {};
                newMetadata[targetChatId] = {
                    ...existing,
                    unreadCount: (existing.unreadCount || 0) + 1,
                    lastMessage: message,
                };
            } else {
                const existing = newMetadata[targetChatId] || {};
                newMetadata[targetChatId] = { ...existing, lastMessage: message };
            }

            return {
                chatHistory: {
                    ...state.chatHistory,
                    [targetChatId]: trimHistory([...currentMessages, message]),
                },
                chatMetadata: newMetadata,
            };
        });
    },

    setChatHistory: (chatId, rawMessages) => {
        const safeChatId = String(chatId);
        if (!Array.isArray(rawMessages)) return;

        const seen = new Set();
        const normalizedMessages = rawMessages
            .map(raw => {
                const sender = normalizeSender(raw.sender || raw.user);
                if (sender?.id && get().userCache) {
                    const currentCache = get().userCache;
                    if (!currentCache[sender.id]) {
                        set(state => ({ userCache: { ...state.userCache, [sender.id]: sender } }));
                    }
                }
                return {
                    id: String(raw._id || raw.id),
                    sender,
                    text: raw.body || raw.text || '',
                    body: raw.body || raw.text || '',
                    type: raw.type || 'text',
                    time: raw.time || raw.createdAt || new Date().toISOString(),
                    isRead: raw.isRead ?? true,
                    edited: raw.edited || raw.isEdited || (() => {
                        if (!raw.updatedAt || !raw.createdAt) return false;
                        return Math.abs(new Date(raw.updatedAt) - new Date(raw.createdAt)) > 1000;
                    })(),
                };
            })
            .filter(msg => {
                if (seen.has(msg.id)) return false;
                seen.add(msg.id);
                return true;
            });

        set(state => ({
            chatHistory: {
                ...state.chatHistory,
                [safeChatId]: trimHistory(normalizedMessages),
            },
        }));
    },

    clearChatHistory: (chatId) => set(state => ({
        chatHistory: { ...state.chatHistory, [String(chatId)]: [] },
    })),

    deleteChatConversation: (chatId) => set(state => {
        const newHistory = { ...state.chatHistory };
        delete newHistory[String(chatId)];
        return { chatHistory: newHistory };
    }),

    // ═════════════════════════════════════════════════════════
    // WebRTC — Voice & Video
    // ═════════════════════════════════════════════════════════
    startLocalStream: async (isVideo = false) => {
        if (!mediaDevices) {
            set({ callStatus: 'error', callError: 'Media devices not available' });
            return null;
        }
        try {
            const constraints = {
                audio: true,
                video: isVideo
                    ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
                    : false,
            };
            const stream = await mediaDevices.getUserMedia(constraints);
            set({ localStream: stream, isCameraEnabled: isVideo });
            return stream;
        } catch (error) {
            const isPermission =
                error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
            const msg = isPermission
                ? 'Microphone/Camera permission denied.'
                : (error?.message || 'Could not access microphone.');
            set({ callStatus: 'error', callError: msg });
            return null;
        }
    },

    stopLocalStream: () => {
        const { localStream } = get();
        if (localStream) {
            try { localStream.getTracks().forEach(t => t.stop()); } catch (e) {}
        }
        set({ localStream: null });
    },

    toggleMute: () => set(state => {
        if (state.localStream) {
            try {
                state.localStream.getAudioTracks().forEach(t => { t.enabled = state.isMuted; });
            } catch (e) {}
        }
        return { isMuted: !state.isMuted };
    }),

    toggleSpeaker: () => set(state => ({ isSpeakerOn: !state.isSpeakerOn })),

    toggleCamera: async () => {
        const { localStream, isCameraEnabled, peerConnections, videoSenders, currentCallId } = get();

        if (isCameraEnabled) {
            if (localStream) {
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack) videoTrack.enabled = false;
            }
            set({ isCameraEnabled: false });
            return;
        }

        if (!localStream) return;

        const existingVideoTracks = localStream.getVideoTracks();
        if (existingVideoTracks.length > 0) {
            existingVideoTracks[0].enabled = true;
            set({ isCameraEnabled: true });
            return;
        }

        if (!mediaDevices) return;

        let videoStream = null;
        let newVideoTrack = null;

        try {
            videoStream = await mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            });
            newVideoTrack = videoStream.getVideoTracks()[0];
            if (!newVideoTrack) throw new Error('No video track produced by getUserMedia');

            localStream.addTrack(newVideoTrack);

            for (const partnerId of Object.keys(peerConnections)) {
                const pc = peerConnections[partnerId];
                if (!pc) continue;
                try {
                    const existingSender = videoSenders[partnerId];
                    if (existingSender && typeof existingSender.replaceTrack === 'function') {
                        await existingSender.replaceTrack(newVideoTrack);
                    } else {
                        const sender = pc.addTrack(newVideoTrack, localStream);
                        set(state => ({
                            videoSenders: { ...state.videoSenders, [partnerId]: sender },
                        }));

                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        chatService.sendSignalOffer(
                            String(partnerId),
                            { type: offer.type, sdp: offer.sdp },
                            currentCallId
                        );
                    }
                } catch (peerErr) {
                    if (__DEV__) console.warn(`[WebRTC] Upgrade failed for peer ${partnerId}:`, peerErr?.message);
                }
            }

            set({ isCameraEnabled: true });
        } catch (error) {
            if (__DEV__) console.error('[WebRTC] Camera upgrade failed:', error);

            if (newVideoTrack) {
                try { newVideoTrack.stop(); } catch (e) {}
                try { localStream.removeTrack?.(newVideoTrack); } catch (e) {}
            }
            if (videoStream) {
                try { videoStream.getTracks().forEach(t => t.stop()); } catch (e) {}
            }
            set({
                isCameraEnabled: false,
                callError: 'Camera permission denied or unavailable',
            });
        }
    },

    // ─────────────────────────────────────────────────────────
    // CALL ORCHESTRATION
    // ─────────────────────────────────────────────────────────
    startCall: async (targetUserId, isVideo = false) => {
        const { user, userCache } = get();
        if (!user?.id) return;

        const roomId = generateRoomId(user.id, targetUserId);
        const remoteParty = buildRemoteParty(targetUserId, userCache);

        set({
            currentCallId: roomId,
            callStatus: 'calling',
            callError: null,
            currentVoiceRoomId: isVideo ? null : roomId,
            currentVideoRoomId: isVideo ? roomId : null,
            remoteParty,
        });

        if (remoteParty && (!userCache || !userCache[remoteParty.id]) && typeof get().resolveUser === 'function') {
            Promise.resolve(get().resolveUser(targetUserId))
                .then(u => {
                    if (!u) return;
                    set(s => {
                        if (!s.remoteParty || s.remoteParty.id !== remoteParty.id) return s;
                        return {
                            remoteParty: {
                                ...s.remoteParty,
                                name: u.name || u.username || s.remoteParty.name,
                                avatar: u.avatarUrl || u.avatar || s.remoteParty.avatar,
                            },
                        };
                    });
                })
                .catch(() => {});
        }

        const localStream = await get().startLocalStream(isVideo);
        if (!localStream) {
            set({
                currentCallId: null,
                currentVoiceRoomId: null,
                currentVideoRoomId: null,
                remoteParty: null,
            });
            return;
        }

        const pc = get().setupPeerConnection(targetUserId, isVideo);
        if (!pc) {
            set({
                currentCallId: null,
                currentVoiceRoomId: null,
                currentVideoRoomId: null,
                remoteParty: null,
            });
            return;
        }

        // ✅ FIX: Join the socket room BEFORE sending the offer.
        // Previously the offer was sent before joinVoiceRoom, so the caller
        // wasn't in the room yet when the answer/ICE arrived — causing the
        // PeerConnection to close after ~5s with no response.
        if (typeof chatService.joinVoiceRoom === 'function') {
            try { chatService.joinVoiceRoom(String(roomId)); } catch (e) {}
        }

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            chatService.sendSignalOffer(
                String(targetUserId),
                { type: offer.type, sdp: offer.sdp },
                roomId
            );
        } catch (e) {
            if (__DEV__) console.error('[Call] startCall offer failed:', e);
            set({ callStatus: 'error', callError: 'Failed to start call' });
            try { get().endCall(roomId); } catch (err) {}
            return;
        }

        const tid = setTimeout(() => {
            const s = get();
            if (s.currentCallId === roomId && Object.keys(s.peerStreams || {}).length === 0) {
                set({ callError: 'No answer' });
                try { s.endCall(roomId); } catch (e) {}
            }
        }, CALLER_DIAL_TIMEOUT_MS);
        set({ _callTimeoutId: tid });
    },

    endCall: (roomId) => {
        const { peerConnections, _callTimeoutId } = get();

        if (_callTimeoutId) {
            try { clearTimeout(_callTimeoutId); } catch (e) {}
        }

        Object.values(peerConnections).forEach(pc => {
            try { pc.close(); } catch (e) {}
        });
        get().stopLocalStream();

        if (roomId && typeof chatService.leaveVoiceRoom === 'function') {
            try { chatService.leaveVoiceRoom(String(roomId)); } catch (e) {}
        }

        set(state => ({
            currentVoiceRoomId: null,
            currentVideoRoomId: null,
            currentCallId: null,
            incomingCall: null,
            remoteParty: null,
            peerConnections: {},
            peerStreams: {},
            pendingIceCandidates: {},
            videoSenders: {},
            isMuted: false,
            isSpeakerOn: false,
            isCameraEnabled: true,
            callStatus: state.callStatus === 'error' ? 'error' : 'idle',
            _callTimeoutId: null,
        }));

        get().endRouletteMatch?.(true);
    },

    joinVoiceRoom: async (roomId, isVideo = false) => {
        let { localStream } = get();
        if (!localStream) {
            localStream = await get().startLocalStream(isVideo);
            if (!localStream) return false;
        }

        if (typeof chatService.joinVoiceRoom === 'function') {
            try { chatService.joinVoiceRoom(String(roomId)); } catch (e) {}
        }

        set({
            callStatus: 'connecting',
            callError: null,
            currentVoiceRoomId: isVideo ? null : String(roomId),
            currentVideoRoomId: isVideo ? String(roomId) : null,
            currentCallId: String(roomId),
        });
        return true;
    },

    setupPeerConnection: (partnerId, isVideo = false) => {
        const { localStream } = get();
        if (!localStream) return null;

        const pc = new RTCPeerConnection(STUN_SERVER);
        const safePartnerId = String(partnerId);

        try {
            localStream.getTracks().forEach(track => {
                const sender = pc.addTrack(track, localStream);
                if (track.kind === 'video' && sender) {
                    set(state => ({
                        videoSenders: { ...state.videoSenders, [safePartnerId]: sender },
                    }));
                }
            });
        } catch (e) {
            if (__DEV__) console.warn('[Call] addTrack failed:', e?.message);
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                const candidatePayload = {
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex,
                };
                try {
                    chatService.sendIceCandidate(safePartnerId, candidatePayload, get().currentCallId);
                } catch (e) {}
            }
        };

        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                set(state => {
                    if (state._callTimeoutId) {
                        try { clearTimeout(state._callTimeoutId); } catch (e) {}
                    }
                    return {
                        peerStreams: { ...state.peerStreams, [safePartnerId]: event.streams[0] },
                        callStatus: 'connected',
                        _callTimeoutId: null,
                    };
                });
            }
        };

        pc.onconnectionstatechange = () => {
            const cs = pc.connectionState;
            if (cs === 'failed' || cs === 'disconnected' || cs === 'closed') {
                set(state => {
                    const newStreams = { ...state.peerStreams };
                    delete newStreams[safePartnerId];
                    return { peerStreams: newStreams };
                });
            }
        };

        set(state => ({
            peerConnections: { ...state.peerConnections, [safePartnerId]: pc },
        }));

        const queued = get().pendingIceCandidates[safePartnerId];
        if (queued && queued.length > 0) {
            setTimeout(async () => {
                const currentPc = get().peerConnections[safePartnerId];
                if (!currentPc) return;
                if (!currentPc.remoteDescription) return;
                for (const c of queued) {
                    try { await currentPc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
                }
                set(state => {
                    const p = { ...state.pendingIceCandidates };
                    delete p[safePartnerId];
                    return { pendingIceCandidates: p };
                });
            }, 0);
        }

        return pc;
    },

    handleSignal: async (fromUserId, signal, roomId) => {
        const { peerConnections, currentCallId } = get();
        const safeFromUserId = String(fromUserId);
        let pc = peerConnections[safeFromUserId];
        const isVideo = signal.type === 'offer' && signal.sdp?.includes('m=video');

        if (signal.type === 'offer' && !currentCallId) {
            set(state => {
                const userCache = state.userCache || {};
                const merged = buildIncomingCall(state.incomingCall, {
                    callId: String(roomId),
                    callerId: safeFromUserId,
                    isVideo,
                    signal: { type: signal.type, sdp: signal.sdp },
                }, userCache);
                return { incomingCall: merged };
            });

            const userCache = get().userCache || {};
            if (!userCache[safeFromUserId] && typeof get().resolveUser === 'function') {
                Promise.resolve(get().resolveUser(fromUserId))
                    .then(u => {
                        if (!u) return;
                        set(s => {
                            if (!s.incomingCall || s.incomingCall.callerId !== safeFromUserId) return s;
                            return {
                                incomingCall: {
                                    ...s.incomingCall,
                                    callerName: u.name || u.username || s.incomingCall.callerName,
                                },
                            };
                        });
                    })
                    .catch(() => {});
            }
            return;
        }

        if (pc) {
            if (signal.type === 'offer') {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    chatService.sendSignalAnswer(
                        safeFromUserId,
                        { type: answer.type, sdp: answer.sdp },
                        roomId
                    );
                } catch (e) {
                    if (__DEV__) console.warn('[Call] Mid-call offer (renegotiation) failed:', e);
                }
            } else if (signal.type === 'answer') {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal));
                } catch (e) {
                    if (__DEV__) console.warn('[Call] setRemoteDescription(answer) failed:', e?.message);
                }
                const pending = get().pendingIceCandidates[safeFromUserId] || [];
                for (const c of pending) {
                    try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
                }
                set(state => {
                    const p = { ...state.pendingIceCandidates };
                    delete p[safeFromUserId];
                    return { pendingIceCandidates: p };
                });
            } else if (signal.candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                } catch (e) {
                    set(state => ({
                        pendingIceCandidates: {
                            ...state.pendingIceCandidates,
                            [safeFromUserId]: pushBoundedICE(
                                state.pendingIceCandidates[safeFromUserId] || [],
                                signal.candidate
                            ),
                        },
                    }));
                }
            }
        } else if (signal.candidate) {
            set(state => ({
                pendingIceCandidates: {
                    ...state.pendingIceCandidates,
                    [safeFromUserId]: pushBoundedICE(
                        state.pendingIceCandidates[safeFromUserId] || [],
                        signal.candidate
                    ),
                },
            }));
        }
    },

    acceptCall: async (callIdParam) => {
        const incoming = get().incomingCall;
        if (!incoming) {
            if (__DEV__) console.warn('[Call] acceptCall called with no incomingCall');
            return false;
        }

        const callId = String(incoming.callId || callIdParam || '');
        const callerId = String(incoming.callerId || '');
        const isVideo = !!incoming.isVideo;
        const savedOffer = incoming.signal;
        const callerName = incoming.callerName;

        if (!callId) {
            set({ incomingCall: null });
            return false;
        }

        const userCache = get().userCache || {};
        const cached = userCache[callerId];
        const remoteParty = {
            id: callerId,
            name: callerName || cached?.name || cached?.username || `User ${callerId.slice(0, 6)}`,
            avatar: cached?.avatarUrl || cached?.avatar || null,
        };

        set({
            incomingCall: null,
            callStatus: 'connecting',
            callError: null,
            remoteParty,
        });

        const joined = await get().joinVoiceRoom(callId, isVideo);
        if (!joined) {
            set({
                currentCallId: null,
                currentVoiceRoomId: null,
                currentVideoRoomId: null,
                remoteParty: null,
                callStatus: 'error',
            });
            return false;
        }

        if (savedOffer && callerId) {
            try {
                const pc = get().setupPeerConnection(callerId, isVideo);
                if (!pc) {
                    set({ callStatus: 'error', callError: 'Failed to create peer connection' });
                    return false;
                }

                await pc.setRemoteDescription(new RTCSessionDescription(savedOffer));

                const pending = get().pendingIceCandidates[callerId] || [];
                for (const c of pending) {
                    try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
                }
                set(state => {
                    const p = { ...state.pendingIceCandidates };
                    delete p[callerId];
                    return { pendingIceCandidates: p };
                });

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                chatService.sendSignalAnswer(
                    callerId,
                    { type: answer.type, sdp: answer.sdp },
                    callId
                );

                set({
                    [isVideo ? 'currentVideoRoomId' : 'currentVoiceRoomId']: callId,
                    currentCallId: callId,
                });
            } catch (e) {
                if (__DEV__) console.error('[Call] WebRTC accept failed:', e);
                set({ callStatus: 'error', callError: 'Failed to establish connection' });
                try { get().endCall(callId); } catch (err) {}
                return false;
            }
        }

        const tid = setTimeout(() => {
            const s = get();
            if (s.currentCallId === callId && Object.keys(s.peerStreams || {}).length === 0) {
                set({ callError: 'Connection failed' });
                try { s.endCall(callId); } catch (e) {}
            }
        }, RECEIVER_CONNECT_TIMEOUT_MS);
        set({ _callTimeoutId: tid });

        return true;
    },

    declineCall: (callIdParam) => {
        const incoming = get().incomingCall;
        if (!incoming) return false;

        const callId = String(incoming.callId || callIdParam || '');
        const callerId = String(incoming.callerId || '');

        try {
            if (typeof chatService.declineCall === 'function') {
                chatService.declineCall(callerId, callId);
            } else if (typeof chatService.sendCallDecline === 'function') {
                chatService.sendCallDecline(callerId, callId);
            } else if (typeof chatService.sendDecline === 'function') {
                chatService.sendDecline(callerId, callId);
            } else if (callId && typeof chatService.leaveVoiceRoom === 'function') {
                chatService.leaveVoiceRoom(callId);
            }
        } catch (e) {
            if (__DEV__) console.warn('[Call] declineCall service error (non-fatal):', e?.message);
        }

        set(state => {
            const p = { ...state.pendingIceCandidates };
            if (callerId) delete p[callerId];
            return {
                incomingCall: null,
                pendingIceCandidates: p,
                currentCallId: null,
                currentVoiceRoomId: null,
                currentVideoRoomId: null,
                remoteParty: null,
                callStatus: 'idle',
                callError: null,
            };
        });

        return true;
    },

    removePeerConnection: (userId) => {
        const sid = String(userId);
        set(state => {
            const newPcs = { ...state.peerConnections };
            const newStreams = { ...state.peerStreams };
            const newSenders = { ...state.videoSenders };
            try { newPcs[sid]?.close(); } catch (e) {}
            delete newPcs[sid];
            delete newStreams[sid];
            delete newSenders[sid];
            return {
                peerConnections: newPcs,
                peerStreams: newStreams,
                videoSenders: newSenders,
            };
        });
    },

    // ═════════════════════════════════════════════════════════
    // ROULETTE
    // ═════════════════════════════════════════════════════════
    findStreamRouletteMatch: () => {
        const { isRouletteSearching, currentVoiceRoomId, user } = get();
        if (isRouletteSearching || currentVoiceRoomId || !user) return;

        if (!user.intent) {
            set({
                rouletteStatusMessage: 'Please complete your Vibe Check first.',
                isRouletteSearching: false,
            });
            return;
        }

        set({ isRouletteSearching: true, rouletteStatusMessage: 'Finding your match...' });
        chatService.findRouletteMatch();
    },

    setRouletteStatus: (status, message) => {
        if (status === 'error' || status === 'waiting') {
            set({ rouletteStatusMessage: message });
        }
        if (status === 'error') {
            set({ isRouletteSearching: false, rouletteStatusMessage: message });
        }
    },

    matchFound: (roomId, partnerId) => {
        set({
            isRouletteSearching: false,
            rouletteStatusMessage: `Match found with ${partnerId}!`,
            currentCallId: String(roomId),
        });
        get().joinVoiceRoom(roomId);

        if (get().rouletteTimerId) clearTimeout(get().rouletteTimerId);

        const timerId = setTimeout(() => {
            if (get().currentCallId === String(roomId)) {
                get().endCall(roomId);
                set({ rouletteStatusMessage: 'Session ended. Finding new match...' });
            }
        }, ROULETTE_SESSION_MS);

        set({ rouletteTimerId: timerId });
    },

    endRouletteMatch: (silent = false) => {
        if (get().rouletteTimerId) {
            clearTimeout(get().rouletteTimerId);
            set({ rouletteTimerId: null });
        }

        const { currentCallId } = get();
        if (currentCallId && !silent) {
            get().endCall(currentCallId);
        }

        set({ rouletteStatusMessage: 'Session ended.', isRouletteSearching: false });
    },
});