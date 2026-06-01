// client/src/utils/trendRouter.js
// ═══════════════════════════════════════════════════════════════════════════
//  TREND ROUTER — Maps every trend to its REAL destination
// ═══════════════════════════════════════════════════════════════════════════

export const TREND_KIND_META = {
  karaoke: {
    icon: 'mic',
    label: 'KARAOKE',
    accent: '#FF2D55',
    actionLabel: 'SING NOW',
    bg: ['#FF006E', '#8338EC'],
  },
  dance: {
    icon: 'body',
    label: 'DANCE',
    accent: '#FFBE0B',
    actionLabel: 'JOIN DANCE',
    bg: ['#FB5607', '#FFBE0B'],
  },
  photo: {
    icon: 'camera',
    label: 'PHOTO',
    accent: '#3A86FF',
    actionLabel: 'SHOOT',
    bg: ['#3A86FF', '#8338EC'],
  },
  voice: {
    icon: 'recording',
    label: 'VOICE',
    accent: '#00C9FF',
    actionLabel: 'RECORD',
    bg: ['#00C9FF', '#92FE9D'],
  },
  video: {
    icon: 'videocam',
    label: 'VIDEO',
    accent: '#E52E71',
    actionLabel: 'FILM',
    bg: ['#FF8A00', '#E52E71'],
  },
  story: {
    icon: 'book',
    label: 'STORY',
    accent: '#8E2DE2',
    actionLabel: 'WRITE',
    bg: ['#4A00E0', '#8E2DE2'],
  },
  chat: {
    icon: 'chatbubbles',
    label: 'CHAT',
    accent: '#06FFA5',
    actionLabel: 'JOIN CHAT',
    bg: ['#06FFA5', '#00C9FF'],
  },
  live: {
    icon: 'radio',
    label: 'LIVE',
    accent: '#FF2D55',
    actionLabel: 'WATCH LIVE',
    bg: ['#FF2D55', '#7A0000'],
  },
  poll: {
    icon: 'stats-chart',
    label: 'POLL',
    accent: '#FFD200',
    actionLabel: 'VOTE',
    bg: ['#F7971E', '#FFD200'],
  },
  duet: {
    icon: 'people',
    label: 'DUET',
    accent: '#FF006E',
    actionLabel: 'DUET',
    bg: ['#FF006E', '#FB5607'],
  },
  default: {
    icon: 'flame',
    label: 'TREND',
    accent: '#FF8A00',
    actionLabel: 'EXPLORE',
    bg: ['#FF8A00', '#FFD200'],
  },
};

export const getTrendMeta = (trend) =>
  TREND_KIND_META[trend?.kind] || TREND_KIND_META.default;

// ──────────────────────────────────────────────────────────────────────────
//  THE ROUTER — given a trend, return what to do
// ──────────────────────────────────────────────────────────────────────────
export const routeTrend = (trend) => {
  const kind = trend?.kind || 'default';
  const payload = trend?.payload || {};
  const tag = trend?.tag;

  switch (kind) {
    case 'karaoke':
      return {
        source: 'KaraokeRoom',
        params: {
          songId: payload.songId,
          songTitle: payload.songTitle,
          audioUrl: payload.audioUrl,
          lyricsUrl: payload.lyricsUrl,
          trend: tag,
        },
      };

    case 'dance':
      return {
        source: 'DanceChallenge',
        params: {
          audioId: payload.audioId,
          audioUrl: payload.audioUrl,
          filters: payload.filters || [],
          trend: tag,
        },
      };

    case 'photo':
      return {
        source: 'PhotoStudio',
        params: {
          stickerPack: payload.stickerPack,
          theme: payload.theme,
          trend: tag,
        },
      };

    case 'voice':
      return {
        source: 'VoiceClip',
        params: { promptId: payload.promptId, trend: tag },
      };

    case 'video':
      return {
        source: 'VideoLab',
        params: { templateId: payload.templateId, trend: tag },
      };

    case 'story':
      return {
        source: 'StoryComposer',
        params: { templateId: payload.templateId, trend: tag },
      };

    case 'chat':
      return {
        source: 'TopicChat',
        params: { topicId: payload.topicId || tag, trend: tag },
      };

    case 'live':
      return {
        source: 'LiveRoom',
        params: { roomId: payload.roomId, trend: tag },
      };

    case 'poll':
      return {
        source: 'PollVote',
        params: { pollId: payload.pollId, trend: tag },
      };

    case 'duet':
      return {
        source: 'DuetCompose',
        params: { partnerId: payload.partnerId, trend: tag },
      };

    default:
      // Graceful fallback — old sheet, but at least tag is real
      return { source: 'TrendOptions', params: { trend: tag } };
  }
};