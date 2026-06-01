// client/src/utils/search.utils.js
// Shared normalization & helpers for search results across SearchScreen and SearchSheet

/**
 * Derives the entity type from a raw API item.
 * Priority: explicit `type` field → field-based heuristics → 'unknown'
 */
export const deriveItemType = (data) => {
    if (data.type === 'user')  return 'user';
    if (data.type === 'group') return 'group';
    if (data.type === 'event') return 'event';
    if (data.type === 'post')  return 'post';
    // Field-based heuristics (weaker, used only when `type` is absent)
    if (data.username && !data.memberCount) return 'user';
    if (data.memberCount !== undefined || data.category) return 'group';
    return 'unknown';
};

/**
 * Normalizes a raw API item into a stable, typed UI model.
 * NEVER generates Math.random() IDs — uses a stable fallback instead.
 *
 * @param {object} rawItem  - Raw item from API (may be nested under `data`)
 * @param {number} index    - Array index used for fallback ID (stable per render)
 * @returns {NormalizedItem}
 */
export const normalizeResultItem = (rawItem, index = 0) => {
    const data = rawItem?.data || rawItem || {};
    const type  = deriveItemType(data);

    const id = data.id != null
        ? String(data.id)
        : data._id != null
            ? String(data._id)
            : `fallback-${type}-${index}`; // stable, never random

    return {
        id,
        type,
        title:        data.name || data.username || data.title || 'Unknown',
        subTitle:     data.username
                        ? `@${data.username}`
                        : (data.description || data.body || ''),
        image:        data.avatarUrl || data.imageUrl || data.image || data.avatar || null,
        originalData: data,
        isUser:       type === 'user',
        isGroup:      type === 'group',
        isEvent:      type === 'event',
        isPost:       type === 'post',
    };
};

/**
 * Safely extracts an array of search results from the store's searchItemsData.
 * Handles two API shapes:
 *   Shape A: { users: User[], groups: Group[], events?: Event[], posts?: Post[] }
 *   Shape B: User[] | Group[]  (flat array, legacy)
 *
 * @param {any} searchItemsData
 * @returns {object[]}
 */
export const flattenSearchData = (searchItemsData) => {
    if (!searchItemsData) return [];
    if (Array.isArray(searchItemsData)) return searchItemsData;

    // Shape A — structured object
    return [
        ...(Array.isArray(searchItemsData.users)  ? searchItemsData.users  : []),
        ...(Array.isArray(searchItemsData.groups) ? searchItemsData.groups : []),
        ...(Array.isArray(searchItemsData.events) ? searchItemsData.events : []),
        ...(Array.isArray(searchItemsData.posts)  ? searchItemsData.posts  : []),
    ];
};

/**
 * Filter predicate for a category pill.
 *
 * @param {NormalizedItem} item
 * @param {'all'|'people'|'groups'|'events'|'posts'} category
 * @returns {boolean}
 */
export const matchesCategory = (item, category) => {
    switch (category) {
        case 'people': return item.isUser;
        case 'groups': return item.isGroup;
        case 'events': return item.isEvent;
        case 'posts':  return item.isPost;
        default:       return true; // 'all'
    }
};

/**
 * Builds a compact theme object from a boolean dark-mode flag.
 * Centralises all conditional colour logic so JSX stays clean.
 */
export const buildTheme = (isDark) => ({
    bg:           isDark ? '#000'     : '#F9FAFB',
    surface:      isDark ? '#1C1C1E'  : '#fff',
    surfaceAlt:   isDark ? '#2C2C2E'  : '#F5F5F5',
    border:       isDark ? '#333'     : '#f0f0f0',
    text:         isDark ? '#fff'     : '#111',
    textSecondary:isDark ? '#aaa'     : '#888',
    textMuted:    isDark ? '#666'     : '#ccc',
    inputBg:      isDark ? '#1C1C1E'  : '#e9ecef',
    iconColor:    isDark ? '#888'     : '#999',
    chipBorder:   isDark ? '#333'     : 'transparent',
    cardBorder:   isDark ? '#333'     : 'transparent',
    isDark,
});