// client/src/store/social.service.js
// ⭐️ V3.1 PRODUCTION: Added Share tracking + Centralized media helper + URLSearchParams ⭐️
//
// שינויים מ-V3.0:
//   • fetchPostShares — משיכת רשימת המשתפים מהשרת
//   • trackPostShare — רישום שיתוף במסד הנתונים

import { Platform } from 'react-native';
import { fetchAPI } from './api';
import { describeFileFromUri } from './mimeUtils';

// ====================================================
// --- SHARED HELPER (exported for other services) ---
// ====================================================

/**
 * Appends a media file to FormData in a platform-aware way.
 */
export async function appendMediaToFormData(formData, fieldName, uri, fallback = 'upload.jpg') {
    const { filename, type } = describeFileFromUri(uri, fallback);

    if (Platform.OS === 'web') {
        const response = await fetch(uri);
        if (!response.ok) {
            throw new Error(`Failed to read local media (status ${response.status})`);
        }
        const blob = await response.blob();
        const finalType = blob.type || type || 'application/octet-stream';
        const ext = finalType.includes('/') ? finalType.split('/')[1].split(';')[0] : 'bin';
        formData.append(fieldName, blob, filename || `upload.${ext}`);
    } else {
        formData.append(fieldName, { uri, name: filename, type });
    }
}

// ====================================================
// --- POSTS ACTIONS ---
// ====================================================

export async function fetchPostsFeed(limit = 20, cursor = null) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.append('cursor', cursor);
    return fetchAPI(`/posts?${params.toString()}`);
}

export async function likePost(postId, vibe = null) {
    const options = { method: 'POST' };
    if (vibe) {
        options.body = JSON.stringify({ vibe });
    }
    return fetchAPI(`/posts/${postId}/like`, options);
}

export async function unlikePost(postId) {
    return fetchAPI(`/posts/${postId}/unlike`, { method: 'POST' });
}

// ⭐️ הפונקציה החדשה למשיכת רשימת השיתופים ⭐️
export async function fetchPostShares(postId) {
    return fetchAPI(`/posts/${postId}/shares`);
}

// ⭐️ הפונקציה החדשה לרישום שיתוף ⭐️
export async function trackPostShare(postId) {
    return fetchAPI(`/posts/${postId}/share`, { method: 'POST' });
}

export async function createPost(text, groupId = null, imageUri = null) {
    if (!imageUri) {
        return fetchAPI('/posts', {
            method: 'POST',
            body: JSON.stringify({ text, groupId, imageUrl: null }),
        });
    }

    const formData = new FormData();
    formData.append('text', text || '');
    if (groupId) formData.append('groupId', String(groupId));

    await appendMediaToFormData(formData, 'image', imageUri, 'post_upload.jpg');

    return fetchAPI('/posts', { method: 'POST', body: formData });
}

export async function deletePost(postId) {
    return fetchAPI(`/posts/${postId}`, { method: 'DELETE' });
}

export async function editPost(postId, newText, newImageUri = null, shouldDeleteImage = false) {
    const formData = new FormData();
    formData.append('text', newText || '');

    if (shouldDeleteImage) formData.append('deleteImage', 'true');
    if (newImageUri) {
        await appendMediaToFormData(formData, 'image', newImageUri, 'post_edit.jpg');
    }

    return fetchAPI(`/posts/${postId}`, { method: 'PATCH', body: formData });
}

// ====================================================
// --- GROUPS ACTIONS ---
// ====================================================

export async function fetchPublicGroups() {
    return fetchAPI('/groups');
}

export async function fetchGroupPosts(groupId) {
    return fetchAPI(`/groups/${groupId}/feed`);
}

export async function fetchGroupDetails(groupId) {
    return fetchAPI(`/groups/${groupId}`);
}

export async function createGroup(groupData) {
    return fetchAPI('/groups', {
        method: 'POST',
        body: JSON.stringify(groupData),
    });
}

export async function updateGroup(groupId, updates) {
    const formData = new FormData();
    ['name', 'description', 'privacy', 'category'].forEach(key => {
        if (updates[key] != null) formData.append(key, String(updates[key]));
    });
    if (updates.imageUri) {
        await appendMediaToFormData(formData, 'image', updates.imageUri, 'group_img.jpg');
    }
    return fetchAPI(`/groups/${groupId}`, { method: 'PATCH', body: formData });
}

export async function deleteGroup(groupId) {
    return fetchAPI(`/groups/${groupId}`, { method: 'DELETE' });
}

export async function joinGroup(groupId) {
    return fetchAPI(`/groups/${groupId}/join`, { method: 'POST' });
}

export async function leaveGroup(groupId) {
    return fetchAPI(`/groups/${groupId}/leave`, { method: 'DELETE' });
}

// ====================================================
// --- SEARCH ACTIONS ---
// ====================================================

export async function searchGlobal(query) {
    if (!query || query.length < 2) return { users: [], groups: [], posts: [] };
    const params = new URLSearchParams({ q: query });
    return fetchAPI(`/search?${params.toString()}`);
}

// ====================================================
// --- COMMENT ACTIONS ---
// ====================================================

export async function addComment(postId, text, imageUri = null) {
    if (!imageUri) {
        return fetchAPI(`/posts/${postId}/comment`, {
            method: 'POST',
            body: JSON.stringify({ text: text || '' }),
        });
    }

    const formData = new FormData();
    if (text) formData.append('text', text);
    await appendMediaToFormData(formData, 'image', imageUri, 'comment.jpg');
    return fetchAPI(`/posts/${postId}/comment`, { method: 'POST', body: formData });
}

export async function deleteComment(commentId) {
    return fetchAPI(`/posts/comment/${commentId}`, { method: 'DELETE' });
}

export async function editComment(commentId, newText) {
    return fetchAPI(`/posts/comment/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: newText }),
    });
}

// ====================================================
// --- NOTIFICATIONS ---
// ====================================================

export async function fetchNotifications() {
    return fetchAPI('/notifications');
}

export async function markAllNotificationsAsRead() {
    return fetchAPI('/notifications/read/all', { method: 'PATCH' });
}

// ====================================================
// --- SUPPORT TICKETS ---
// ====================================================

export async function fetchMyTickets() {
    return fetchAPI('/support/my-tickets');
}

export async function createTicket(subject, message, category = 'General') {
    return fetchAPI('/support/ticket', {
        method: 'POST',
        body: JSON.stringify({ subject, message, category }),
    });
}

// ====================================================
// --- USER FOLLOW ---
// ====================================================

export async function toggleFollow(userId) {
    return fetchAPI(`/users/${userId}/follow`, { method: 'POST' });
}

// ====================================================
// --- COMMUNITY VIBE ---
// ====================================================

export async function fetchCommunityVibe() {
    return fetchAPI('/kliq-king/vibe');
}