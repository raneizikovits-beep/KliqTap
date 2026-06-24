// client/src/utils/trendRouter.js
// v1.1
// ═══════════════════════════════════════════════════════════════════════════
//  TREND ROUTER — Maps every trend to its REAL destination
// ═══════════════════════════════════════════════════════════════════════════
//
// [V1.1 CHANGES — Engineering Audit Fixes]:
//   • [FIX MEDIUM] TREND_KIND_META wrapped in Object.freeze() — it is an
//                  exported constant; any importer could accidentally mutate
//                  it otherwise, corrupting UI for the lifetime of the app.
//   • [FIX MEDIUM] `tag` now has an explicit null fallback (`?? null`) instead
//                  of silently being `undefined`. Every screen receives a clean
//                  null rather than an ambiguous undefined for unset tags.
//   • [FIX LOW]    DEV warnings added for critical missing payload fields:
//                  roomId (live), partnerId (duet), audioUrl (karaoke/dance).
//                  These screens almost certainly crash without them; the warning
//                  surfaces the malformed server payload during development.
//   • [NEW]        TREND_KINDS registry exported — callers can reference kind
//                  strings as constants instead of hardcoded literals, preventing
//                  silent typos when new kinds are added.
//
// INVARIANT: Every key in TREND_KIND_META must have a matching case in routeTrend.
// When adding a new kind, update BOTH TREND_KIND_META and the switch in routeTrend.

// ─────────────────────────────────────────────────────────────
// Cross-platform __DEV__ guard
// ─────────────────────────────────────────────────────────────
if (typeof __DEV__ === 'undefined') {
    Object.defineProperty(
        typeof globalThis !== 'undefined' ? globalThis : global,
        '__DEV__',
        { value: process.env.NODE_ENV !== 'production', configurable: true }
    );
}

// ─────────────────────────────────────────────────────────────
// Kind registry — single source of truth for trend kind strings.
// Use these constants in callers instead of string literals.
// ─────────────────────────────────────────────────────────────
export const TREND_KINDS = Object.freeze({
    KARAOKE: 'karaoke',
    DANCE:   'dance',
    PHOTO:   'photo',
    VOICE:   'voice',
    VIDEO:   'video',
    STORY:   'story',
    CHAT:    'chat',
    LIVE:    'live',
    POLL:    'poll',
    DUET:    'duet',
    DEFAULT: 'default',
});

// ─────────────────────────────────────────────────────────────
// Meta registry — UI presentation data per kind
// [FIX MEDIUM] Object.freeze prevents accidental mutation of this
// exported constant by any importer.
// ─────────────────────────────────────────────────────────────
export const TREND_KIND_META = Object.freeze({
    [TREND_KINDS.KARAOKE]: Object.freeze({
        icon: 'mic',
        label: 'KARAOKE',
        accent: '#FF2D55',
        actionLabel: 'SING NOW',
        bg: Object.freeze(['#FF006E', '#8338EC']),
    }),
    [TREND_KINDS.DANCE]: Object.freeze({
        icon: 'body',
        label: 'DANCE',
        accent: '#FFBE0B',
        actionLabel: 'JOIN DANCE',
        bg: Object.freeze(['#FB5607', '#FFBE0B']),
    }),
    [TREND_KINDS.PHOTO]: Object.freeze({
        icon: 'camera',
        label: 'PHOTO',
        accent: '#3A86FF',
        actionLabel: 'SHOOT',
        bg: Object.freeze(['#3A86FF', '#8338EC']),
    }),
    [TREND_KINDS.VOICE]: Object.freeze({
        icon: 'recording',
        label: 'VOICE',
        accent: '#00C9FF',
        actionLabel: 'RECORD',
        bg: Object.freeze(['#00C9FF', '#92FE9D']),
    }),
    [TREND_KINDS.VIDEO]: Object.freeze({
        icon: 'videocam',
        label: 'VIDEO',
        accent: '#E52E71',
        actionLabel: 'FILM',
        bg: Object.freeze(['#FF8A00', '#E52E71']),
    }),
    [TREND_KINDS.STORY]: Object.freeze({
        icon: 'book',
        label: 'STORY',
        accent: '#8E2DE2',
        actionLabel: 'WRITE',
        bg: Object.freeze(['#4A00E0', '#8E2DE2']),
    }),
    [TREND_KINDS.CHAT]: Object.freeze({
        icon: 'chatbubbles',
        label: 'CHAT',
        accent: '#06FFA5',
        actionLabel: 'JOIN CHAT',
        bg: Object.freeze(['#06FFA5', '#00C9FF']),
    }),
    [TREND_KINDS.LIVE]: Object.freeze({
        icon: 'radio',
        label: 'LIVE',
        accent: '#FF2D55',
        actionLabel: 'WATCH LIVE',
        bg: Object.freeze(['#FF2D55', '#7A0000']),
    }),
    [TREND_KINDS.POLL]: Object.freeze({
        icon: 'stats-chart',
        label: 'POLL',
        accent: '#FFD200',
        actionLabel: 'VOTE',
        bg: Object.freeze(['#F7971E', '#FFD200']),
    }),
    [TREND_KINDS.DUET]: Object.freeze({
        icon: 'people',
        label: 'DUET',
        accent: '#FF006E',
        actionLabel: 'DUET',
        bg: Object.freeze(['#FF006E', '#FB5607']),
    }),
    [TREND_KINDS.DEFAULT]: Object.freeze({
        icon: 'flame',
        label: 'TREND',
        accent: '#FF8A00',
        actionLabel: 'EXPLORE',
        bg: Object.freeze(['#FF8A00', '#FFD200']),
    }),
});

/**
 * Returns the display metadata for a trend, falling back to 'default'.
 * @param {{ kind?: string }} trend
 * @returns {object}
 */
export const getTrendMeta = (trend) =>
    TREND_KIND_META[trend?.kind] || TREND_KIND_META[TREND_KINDS.DEFAULT];

// ──────────────────────────────────────────────────────────────────────────
//  THE ROUTER — given a trend object, return { source, params }
//  `source` is the screen name; `params` are passed as navigation params.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Maps a trend to its navigation destination.
 *
 * @param {{ kind?: string, payload?: object, tag?: string }} trend
 * @returns {{ source: string, params: object }}
 */
export const routeTrend = (trend) => {
    const kind    = trend?.kind    || TREND_KINDS.DEFAULT;
    const payload = trend?.payload || {};

    // [FIX MEDIUM] `tag` was `undefined` when trend had no tag property.
    // Every screen receives `trend: tag` in params; screens that use it for
    // analytics context or back-navigation labels expect a string or null,
    // not undefined. Explicit null makes intent clear and simplifies callers.
    const tag = trend?.tag ?? null;

    switch (kind) {
        case TREND_KINDS.KARAOKE: {
            // audioUrl is required — KaraokeRoom cannot function without audio
            if (__DEV__ && !payload.audioUrl) {
                console.warn('[trendRouter] karaoke trend missing payload.audioUrl:', trend);
            }
            return {
                source: 'KaraokeRoom',
                params: {
                    songId:    payload.songId    ?? null,
                    songTitle: payload.songTitle ?? null,
                    audioUrl:  payload.audioUrl  ?? null,
                    lyricsUrl: payload.lyricsUrl ?? null,
                    trend: tag,
                },
            };
        }

        case TREND_KINDS.DANCE: {
            if (__DEV__ && !payload.audioUrl) {
                console.warn('[trendRouter] dance trend missing payload.audioUrl:', trend);
            }
            return {
                source: 'DanceChallenge',
                params: {
                    audioId:  payload.audioId  ?? null,
                    audioUrl: payload.audioUrl ?? null,
                    filters:  payload.filters  || [],
                    trend: tag,
                },
            };
        }

        case TREND_KINDS.PHOTO:
            return {
                source: 'PhotoStudio',
                params: {
                    stickerPack: payload.stickerPack ?? null,
                    theme:       payload.theme       ?? null,
                    trend: tag,
                },
            };

        case TREND_KINDS.VOICE:
            return {
                source: 'VoiceClip',
                params: { promptId: payload.promptId ?? null, trend: tag },
            };

        case TREND_KINDS.VIDEO:
            return {
                source: 'VideoLab',
                params: { templateId: payload.templateId ?? null, trend: tag },
            };

        case TREND_KINDS.STORY:
            return {
                source: 'StoryComposer',
                params: { templateId: payload.templateId ?? null, trend: tag },
            };

        case TREND_KINDS.CHAT:
            return {
                source: 'TopicChat',
                params: { topicId: payload.topicId || tag, trend: tag },
            };

        case TREND_KINDS.LIVE: {
            // roomId is required — LiveRoom cannot connect without it
            if (__DEV__ && !payload.roomId) {
                console.warn('[trendRouter] live trend missing payload.roomId:', trend);
            }
            return {
                source: 'LiveRoom',
                params: { roomId: payload.roomId ?? null, trend: tag },
            };
        }

        case TREND_KINDS.POLL:
            return {
                source: 'PollVote',
                params: { pollId: payload.pollId ?? null, trend: tag },
            };

        case TREND_KINDS.DUET: {
            // partnerId is required — DuetCompose must know who to pair with
            if (__DEV__ && !payload.partnerId) {
                console.warn('[trendRouter] duet trend missing payload.partnerId:', trend);
            }
            return {
                source: 'DuetCompose',
                params: { partnerId: payload.partnerId ?? null, trend: tag },
            };
        }

        default:
            // Graceful fallback — surfaces the trend tag so TrendOptions can display something
            return { source: 'TrendOptions', params: { trend: tag } };
    }
};