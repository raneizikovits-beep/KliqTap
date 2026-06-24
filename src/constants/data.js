// client/src/constants/data.js

// 🛡️ מידות קבועות למניעת שגיאת ReferenceError ב-Hermes/Web
export const width = 375;
export const height = 812;

/* ---------- Palette and constants ---------- */
// Object.freeze ensures the core brand palette cannot be mutated accidentally
export const brand = Object.freeze({
  bg: "#F9FAFB",           // הלבן-אפור הנקי של הכתר והרדאר
  header: "#F9FAFB",
  headerBorder: "#E5E7EB",
  ink: "#202224",
  soft: "#6B6A6A",
  active: "#1F2328",
  blue: "#2962FF",
  green: "#20B86A",
  red: "#D44B3E",
  yellow: "#F7C11F",
  sky: "#BBD6FF",
  purple: "#8A2BE2",
  orange: '#FFC000' 
});

export const APP_NAME = "KliqTap";
export const ABOUT_TITLE = "About " + APP_NAME;
export const ABOUT_BODY =
  `${APP_NAME} is a connectivity platform built on empathy. Our mission is to solve loneliness by facilitating meaningful, small-group connections based on shared life experiences, goals, and core values. We use AI to help you find your people, whether it's a support circle, a project team, or a study group. Created by Ran Eizikovich (with help from a friend), ${APP_NAME} values privacy, accessibility, and the power of genuine human connection.`;

/* ---------- Home groups list (DEMO) ---------- */
export const HOME_GROUPS_EN = Object.freeze([
  "Students","Young Professionals","Professionals","Remote Workers","Freelancers",
  "Adults 45-65","Hobbies","Health","Older Adults 50-80","Under 30 Singles",
  "Low Income","Solo Employees","Minorities","LGBT","Immigrants",
  "People With Disabilities","Disabled","Regional Communities","Neighborhood",
  "Book Clubs", "Hiking Enthusiasts", "AI Developers", "Local Gardeners",
  "Startup Founders", "Musicians", "Photographers", "Parents of Toddlers",
  "Digital Nomads", "Mental Health Advocates", "Coders Guild", "Writers Corner",
  "Language Exchange (Spanish)", "Meditation Circle", "Cooking Fans", "Fitness Buddies"
]);

/* Group/User images (DEMO) */
export const GROUP_IMG = Object.freeze({
  "Students": "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?w=400&h=400&fit=crop",
  "Young Professionals": "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&h=400&fit=crop",
  "Professionals": "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&h=400&fit=crop",
  "Remote Workers": "https://images.unsplash.com/photo-1587614203976-365c74645e83?w=400&h=400&fit=crop",
  "Freelancers": "https://images.unsplash.com/photo-1552581234-26160f608093?w=400&h=400&fit=crop",
  "Adults 45-65": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop",
  "Hobbies": "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=400&fit=crop",
  "Health": "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=400&h=400&fit=crop",
  "Older Adults 50-80": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
  "Under 30 Singles": "https://images.unsplash.com/photo-1519340241574-2cec6aef0c01?w=400&h=400&fit=crop",
  "Low Income": "https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=400&h=400&fit=crop",
  "Solo Employees": "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400&h=400&fit=crop",
  "Minorities": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop",
  "LGBT": "https://images.unsplash.com/photo-1496317899792-9d7dbcd928a1?w=400&h=400&fit=crop",
  "Immigrants": "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=400&h=400&fit=crop",
  "People With Disabilities": "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop",
  "Disabled": "https://images.unsplash.com/photo-1484186304838-0bf1a8cff81c?w=400&h=400&fit=crop",
  "Regional Communities": "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&h=400&fit=crop",
  "Neighborhood": "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&h=400&fit=crop",
  "Book Clubs": "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&h=400&fit=crop",
  "Hiking Enthusiasts": "https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&h=400&fit=crop",
  "AI Developers": "https://images.unsplash.com/photo-1620712943543-aebc690011c2?w=400&h=400&fit=crop",
  "Local Gardeners": "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=400&h=400&fit=crop",
  "Startup Founders": "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&h=400&fit=crop",
  "Musicians": "https://images.unsplash.com/photo-1466428991269-6d6f08cca609?w=400&h=400&fit=crop",
  "Photographers": "https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?w=400&h=400&fit=crop",
  "Parents of Toddlers": "https://images.unsplash.com/photo-1484665754824-3d0dfe3895c3?w=400&h=400&fit=crop",
  "Digital Nomads": "https://images.unsplash.com/photo-1501555088652-42146b2400e4?w=400&h=400&fit=crop",
  "Mental Health Advocates": "https://images.unsplash.com/photo-1549490100-9a3b6d31b0d2?w=400&h=400&fit=crop",
  "Coders Guild": "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&h=400&fit=crop",
  "Writers Corner": "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=400&fit=crop",
  "Language Exchange (Spanish)": "https://images.unsplash.com/photo-1516302752635-f0b563c1d4a3?w=400&h=400&fit=crop",
  "Meditation Circle": "https://images.unsplash.com/photo-1474418397713-7ede21d49118?w=400&h=400&fit=crop",
  "Cooking Fans": "https://images.unsplash.com/photo-1490645935967-10de6ba1a033?w=400&h=400&fit=crop",
  "Fitness Buddies": "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop",
  "Study Group": "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?w=400&h=400&fit=crop",
  "Run Club": "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop",
  "Design Pods": "https://images.unsplash.com/photo-1552581234-26160f608093?w=400&h=400&fit=crop",
});

export const USER_IMG = Object.freeze({
  "Alex": "https://randomuser.me/api/portraits/men/15.jpg",
  "Sara": "https://randomuser.me/api/portraits/women/47.jpg",
  "Jon": "https://randomuser.me/api/portraits/men/23.jpg",
  "Lia": "https://randomuser.me/api/portraits/women/51.jpg",
  "Tom": "https://randomuser.me/api/portraits/men/30.jpg",
  "Nina": "https://randomuser.me/api/portraits/women/14.jpg",
  "Mike": "https://randomuser.me/api/portraits/men/32.jpg",
  "Chloe": "https://randomuser.me/api/portraits/women/22.jpg",
  "David": "https://randomuser.me/api/portraits/men/45.jpg",
  "Emily": "https://randomuser.me/api/portraits/women/65.jpg",
  "Ryan": "https://randomuser.me/api/portraits/men/50.jpg",
  "Olivia": "https://randomuser.me/api/portraits/women/70.jpg",
  "Miyzen": "https://randomuser.me/api/portraits/men/41.jpg",
});

export const imageFor = (title) =>
  GROUP_IMG[title] || USER_IMG[title] || `https://picsum.photos/seed/${encodeURIComponent(title)}/400/400`;

export const EXPLORE_CATEGORIES = Object.freeze([
  { title: "Creative & Arts", icon: "🎨" },{ title: "Tech & Learning", icon: "💻" },
  { title: "Wellness & Sport", icon: "🧘" },{ title: "Local Communities", icon: "🏘️" },
  { title: "Parenting & Family", icon: "👨‍👩‍👧" },{ title: "Career & Business", icon: "📈" },
  { title: "Jobs & Opportunities", icon: "💼" },
  { title: "Volunteering", icon: "🤝" },{ title: "Languages", icon: "🗣️" },
  { title: "Gaming & Fun", icon: "🎮" },{ title: "Food & Cooking", icon: "🍳" },
  { title: "Outdoors", icon: "🥾" },{ title: "Faith & Values", icon: "🕊️" },
  { title: "Mindfulness", icon: "🧠" },{ title: "Travel", icon: "✈️" },
  { title: "Social Impact", icon: "🌍" },{ title: "Groups", icon: "🗂️" },
  { title: "Nearby", icon: "📍" },
  { title: "Science", icon: "🔬" }, { title: "Finance", icon: "💰" },
  { title: "Pets", icon: "🐶" }, { title: "Automotive", icon: "🚗" },
  { title: "History", icon: "🏛️" }, { title: "Music", icon: "🎵" },
  { title: "Film", icon: "🎬" }, { title: "Fashion", icon: "👗" }
]);

export const DEMO_MEMBERS = Object.freeze([
  { name: "Alex", img: "https://randomuser.me/api/portraits/men/15.jpg", intent: "Start Study Circle" },
  { name: "Sara", img: "https://randomuser.me/api/portraits/women/47.jpg", intent: "Join Run Club" },
  { name: "Jon", img: "https://randomuser.me/api/portraits/men/23.jpg", intent: "Join Writing Circle" },
  { name: "Lia", img: "https://randomuser.me/api/portraits/women/51.jpg", intent: "Start Wellness Group" },
  { name: "Tom", img: "https://randomuser.me/api/portraits/men/30.jpg", intent: "Join Tech Learners" },
  { name: "Nina", img: "https://randomuser.me/api/portraits/women/14.jpg", intent: "Start Local Neighbors" },
  { name: "Mike", img: "https://randomuser.me/api/portraits/men/32.jpg", intent: "Find Hiking Buddy" },
  { name: "Chloe", img: "https://randomuser.me/api/portraits/women/22.jpg", intent: "Start Book Club" },
  { name: "David", img: "https://randomuser.me/api/portraits/men/45.jpg", intent: "Join AI Developers" },
  { name: "Emily", img: "https://randomuser.me/api/portraits/women/65.jpg", intent: "Start Gardeners Group" },
  { name: "Ryan", img: "https://randomuser.me/api/portraits/men/50.jpg", intent: "Join Startup Founders" },
  { name: "Olivia", img: "https://randomuser.me/api/portraits/women/70.jpg", intent: "Find Musicians" },
]);

export const USER_PROFILE_PIC = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop"; 

export const DEMO_GROUP_UPDATES = Object.freeze([
  { id: "u1", name: "Add Update", img: USER_PROFILE_PIC, isSelf: true, text: "Share an update with your groups...", isNew: false, isLive: false },
  { id: "g1", name: "AI Developers", img: GROUP_IMG["AI Developers"], text: "Posted a new link about GPT-5.", isNew: true, isLive: true },
  { id: "g2", name: "Students", img: GROUP_IMG["Students"], text: "New study session scheduled for tonight!", isNew: true, isLive: true },
  { id: "g3", name: "Hiking Enthusiasts", img: GROUP_IMG["Hiking Enthusiasts"], text: "Mike shared photos from the weekend hike.", isNew: false, isLive: false },
  { id: "g4", name: "Writers Corner", img: GROUP_IMG["Writers Corner"], text: "Jon just shared a new short story.", isNew: true, isLive: false },
  { id: "g5", name: "Local Gardeners", img: GROUP_IMG["Local Gardeners"], text: "Emily is asking for advice on tomatoes.", isNew: false, isLive: true },
  { id: "g6", name: "Startup Founders", img: GROUP_IMG["Startup Founders"], text: "Luna shared a new pitch deck template.", isNew: false, isLive: false },
]);

export const DEMO_POSTS = [];
export const DEMO_GROUP_POSTS = {};
export const getGroupPosts = (groupName) => {
  return [];
}

export const DEMO_ACCOUNT_NOTIFICATIONS = Object.freeze([
  { id: 'n1', icon: '❤️', text: 'Lia and 3 others liked your post in "Wellness Group".', time: '10m ago' },
  { id: 'n2', icon: '💬', text: 'David replied to your comment: "Great point, I agree!"', time: '45m ago' },
  { id: 'n3', icon: '👥', text: 'Sara accepted your invitation to join "Run Club".', time: '2h ago' },
]);

export const DEMO_GENERAL_NOTIFICATIONS = Object.freeze([
  { id: 'n4', icon: '🗓️', text: 'Event Reminder: "Study sprint" is starting in 1 hour.', time: '4:00 PM' },
  { id: 'n5', icon: '🧭', text: 'AI Suggestion: A new group "React Native Devs" matches your interests.', time: '1d ago' },
  { id: 'n6', icon: '🏅', text: 'New Badge Unlocked: "Community Builder"! Keep up the great work.', time: '2d ago' },
]);

export const DEMO_MESSAGES = Object.freeze([
  { id: 'm1', type: 'text', sender: 'Study Group', body: 'Meeting link pinned. Be on time.', time: '10:20 AM', unread: 1 },
  { id: 'm2', type: 'text', sender: 'Lia', body: 'Thanks for the chat this morning!', time: '9:05 AM', unread: 0 },
  { id: 'm3', type: 'text', sender: 'Design Pods', body: 'Can you review this new mockup?', time: 'Yesterday', unread: 3 },
  { id: 'm4', type: 'text', sender: 'Jon', body: 'That idea for the story is great!', time: '2d ago', unread: 0 },
]);
export const DEMO_VOICE_NOTES = Object.freeze([
  { id: 'v1', type: 'voice', sender: 'Mike', body: 'Voice message (0:45)', time: '1:15 PM', unread: 1 },
  { id: 'v2', type: 'voice', sender: 'Hiking Enthusiasts', body: 'Voice message (1:30) - Trail update', time: 'Yesterday', unread: 0 },
]);
export const DEMO_CALL_LOG = Object.freeze([
  { id: 'c1', type: 'call-missed', sender: 'Sara', body: 'Missed video call', time: '1:30 PM', unread: 0 },
  { id: 'c2', type: 'call-in', sender: 'AI Developers', body: 'Group call (12:05)', time: '12:05 PM', unread: 0 },
  { id: 'c3', type: 'call-out', sender: 'Alex', body: 'Outgoing call (8:00 AM)', time: '8:00 AM', unread: 0 },
  { id: 'c4', type: 'call-missed', sender: 'David', body: 'Missed call', time: 'Yesterday', unread: 0 },
]);