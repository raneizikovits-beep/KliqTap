// client/src/constants/sheetConfig.js
import * as Data from './data';

// --- Settings Items Generator ---
export const getSettingsItems = (user) => [
    { type: 'header', title: 'Account & Profile' },
    { type: 'item', icon: '📝', title: 'Edit Profile', body: 'Name, username, bio, avatar, gender', next: 'third' },
    { type: 'item', icon: '🔗', title: 'Linked Accounts', body: 'Google, Apple, Facebook, etc.', next: 'third' },
    { type: 'item', icon: '🔑', title: 'Security & Access', body: 'Password, Two-Factor Auth, sessions', next: 'fourth' },

    { type: 'header', title: 'Social & Connections' },
    { type: 'item', icon: '👁️', title: 'Privacy Control', body: 'Who can see your posts and profile', next: 'third' },
    { type: 'item', icon: '🤫', title: 'Muted & Hidden Accounts', body: 'Manage who you don\'t see', next: 'third' },
    { type: 'item', icon: '🔇', title: 'Blocked Users', body: 'Manage users you have blocked', next: 'third' },
    { type: 'item', icon: '🤝', title: 'Follower Requests', body: 'Approve or deny new followers', next: 'third' },
    { type: 'item', icon: '✉️', title: 'Direct Messages', body: 'Control who can message you', next: 'third' },
    
    { type: 'header', title: 'App & Experience' },
    { type: 'item', icon: '🔔', title: 'Notifications', body: 'Push, email, and in-app alerts', next: 'third' },
    { type: 'item', icon: '🎨', title: 'Appearance', body: 'Theme (Light/Dark), text size, font', next: 'fourth' },
    { type: 'item', icon: '🗺️', title: 'Location Settings', body: 'Manage GPS access and virtual travel location', next: 'third' }, 
    { type: 'item', icon: '📸', title: 'Vibe Check Camera', body: 'Analyze your mood and share as a Story.', actionType: 'openVibeCheck' }, 
    
    { type: 'header', title: 'Support & Data' },
    { type: 'item', icon: '🗄️', title: 'Manage Data', body: 'Privacy Policy, Terms of Service, Data History', next: 'third:ManageData' }, 
    { type: 'item', icon: '🚩', title: 'Report a Problem', body: 'Send feedback or report a bug', next: 'third' },
    { type: 'item', icon: '🧾', title: 'Download My Data (GDPR)', body: 'Export a copy of your personal data', next: 'fifth:DataExport' },
    { type: 'item', icon: '🚪', title: 'Logout', body: 'Sign out of this session', next: 'fifth:Logout' }, 
    { 
        type: 'item', 
        icon: '🗑️', 
        title: 'Delete Account & Data', 
        body: 'Permanently remove your KliqTap account.', 
        actionType: 'openDeletionLink' 
    },

    { type: 'header', title: 'About' },
    { type: 'item', icon: 'ℹ️', title: Data.ABOUT_TITLE, body: Data.ABOUT_BODY, next: 'third' },
];

// --- Search Items Generator ---
export const getSearchItems = (currentTab) => {
    let items = [];
    if (currentTab === "Support") { 
        items.push({ type: 'header', title: 'Support Resources' }); 
        items.push({ type: 'item', icon: '🧠', title: 'Find Peer Support', body: 'Groups and 1-on-1 matches', next: 'third' }); 
        items.push({ type: 'item', icon: '🧑‍⚕️', title: 'Find Counselors', body: 'Professional mental health resources', next: 'third' }); 
    } 
    else if (currentTab === "Explore" || currentTab === "Home") { 
        items.push({ type: 'header', title: 'Explore Community' }); 
        items.push({ type: 'item', icon: '🧭', title: 'Search Hobbies & Interests', body: 'Filter by category, size, and activity', next: 'third' }); 
        items.push({ type: 'item', icon: '📍', title: 'Search Nearby Groups', body: 'Find local meetups', next: 'third' }); 
    }
    items.push({ type: 'header', title: 'Find Content & Users' }); 
    items.push({ type: 'item', icon: '🔎', title: 'Global Search', body: 'Groups, people, posts, messages', next: 'third' }); 
    items.push({ type: 'item', icon: '👥', title: 'Search People & Users', body: 'Find friends and interesting profiles', next: 'third' }); 
    items.push({ type: 'item', icon: '🧩', title: 'Advanced Filters', body: 'Filter by mood, purpose, distance', next: 'third' }); 
    items.push({ type: 'header', title: 'Saved' }); 
    items.push({ type: 'item', icon: '⭐', title: 'Saved Searches', body: 'Re-run your favorite filters', next: 'fifth' }); 
    return items;
  };
  
// --- Icon Grid Generator ---
export const getIconGrid = (src) => {
    if (src === "SupportPeers") { 
        return [
            { i: "🗣️", t: "Join a Talk Circle", body: "Join an open, moderated group chat.", next: "third" }, 
            { i: "🎧", t: "Listen-in Room", body: "Listen anonymously to a support session.", next: "third" }, 
            { i: "🤝", t: "Find a Peer", body: "AI match with a 1-on-1 peer.", next: "fourth" }, 
            { i: "📅", t: "Scheduled Sessions", body: "See all upcoming peer-led events.", next: "fourth" }, 
            { i: "🛡️", t: "Moderation", body: "Learn about our safety and training.", next: "fifth" }
        ]; 
    }
    if (src === "SupportTools") { 
        return [
            { i: "🌬️", t: "Breathing Exercise", body: "Start a 3-minute guided breathing session.", next: "third" }, 
            { i: "✍️", t: "Guided Journal", body: "AI prompts for journaling your thoughts.", next: "third" }, 
            { i: "🧘", t: "Grounding", body: "5-4-3-2-1 technique for mindfulness.", next: "fourth" }, 
            { i: "🎵", t: "Calm Audio", body: "Listen to rain, waves, or white noise.", next: "fourth" }, 
            { i: "🏃", t: "Movement", body: "Quick 5-minute stretch guide.", next: 'fifth' }
        ]; 
    }
    return [
        { i: "ℹ️", t: Data.ABOUT_TITLE, body: Data.ABOUT_BODY, next: "third" }, 
        { i: "📋", t: "Shortcuts", body: "Handy links for this section.", next: "third" }
    ];
};

// --- Messages Generator ---
export const getAllMessages = () => {
    const all = [
        ...(Array.isArray(Data.DEMO_MESSAGES) ? Data.DEMO_MESSAGES : []), 
        ...(Array.isArray(Data.DEMO_VOICE_NOTES) ? Data.DEMO_VOICE_NOTES : []), 
        ...(Array.isArray(Data.DEMO_CALL_LOG) ? Data.DEMO_CALL_LOG : [])
    ];

    // [FIX] Safer sort that handles BOTH ISO timestamps and "10:20 AM" strings.
    // Previous logic: `a.time.localeCompare(b.time)` would alphabetize ISO dates
    // backwards and crash if `a.time` was undefined.
    return all.sort((a, b) => {
        const ta = a?.time || '';
        const tb = b?.time || '';
        // If both look like ISO timestamps, sort by Date
        const dateA = Date.parse(ta);
        const dateB = Date.parse(tb);
        if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA; // newest first
        // Fallback to string compare
        return String(tb).localeCompare(String(ta));
    });
};