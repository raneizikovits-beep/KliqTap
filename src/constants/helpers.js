/* Helper: deep items generator for 3rd, 4th, 5th */
export function deepItems(kind, arg) {
  const target = arg?.target || "Group";
  const targetId = arg?.targetId || "";

  switch (kind) {
    case "messageAction":
      return [
        { i: "🧷", t: "Pin message", body: "Pinned to the top.", next: "fourth" },
        { i: "📞", t: "Start Voice Call", body: `Start a voice call in ${target}.`, next: "fifth:Call", actionType: 'StartVoiceCall', targetId: target + "_VOICE" },
        { i: "🎥", t: "Start Video Chat", body: `Start a video session in ${target}.`, next: "fifth:Video", actionType: 'StartVideoCall', targetId: target + "_VIDEO" },
        { i: "👥", t: "Open members", body: "See members in this thread.", next: "fourth" },
        { i: "🗂️", t: "Folders", body: "Organize chats into folders.", next: "fourth" },
        { i: "🔒", t: "Privacy options", body: "Read receipts, last seen, typing.", next: "fourth" },
        { i: "🛟", t: "Report issue", body: "Flag a problem to moderators.", next: "fifth:ReportIssue" }
      ];
    case "eventAction":
      return [
        { i: "🗓️", t: "Add to calendar", body: "Added to your device calendar.", next: "fourth" },
        { i: "🚕", t: "Directions", body: "Open maps and route.", next: "fourth" },
        { i: "🔔", t: "Extra reminder", body: "Set an extra reminder.", next: "fourth" },
        { i: "🤝", t: "Find a buddy", body: "Pair with someone to attend together.", next: "fifth" },
        { i: "📸", t: "Event gallery", body: "Photos and recaps after the event.", next: "fifth" }
      ];
    case "alertAction":
      return [
        { i: "✅", t: "Mark as Read", body: "Notification marked as read.", next: "fourth" },
        { i: "🔇", t: "Mute this type", body: "Mute similar notifications.", next: "fourth" },
        { i: "⚙️", t: "Settings", body: "Open notification settings.", next: "fifth" },
      ];
    case "profileLink":
      return [
        { i: "🧪", t: "Security check", body: "Protect account with 2FA.", next: "fourth" },
        { i: "📜", t: "Permissions", body: "What access is requested.", next: "fourth" },
        { i: "🧹", t: "Disconnect", body: "Remove this linked account.", next: "fifth" },
        { i: "🗑️", t: "Delete Account", body: "Permanently erase all data (GDPR compliant).", next: "fifth:DeleteAccount" }
      ];
    case "aiQuick":
      return [
        { i: "🧭", t: "Suggest group", body: "AI suggests a relevant group.", next: "fourth" },
        { i: "🧩", t: "Refine request", body: "Choose time and topics.", next: "fourth" },
        { i: "🗂️", t: "Templates", body: "Open message or invite templates.", next: "fifth" },
        { i: "📈", t: "Success tips", body: "Tips to get quick responses.", next: "fifth" }
      ];
    case "about":
      return [
        { i: "🎯", t: "Mission", body: "Kind connections at human scale.", next: "fourth" },
        { i: "🧩", t: "How it works", body: "Small groups, quick tools, privacy first.", next: "fourth" },
        { i: "👤", t: "Creator", body: "Built by Ran Eizikovich.", next: "fifth" },
        { i: "🛡️", t: "Safety", body: "Community rules and reporting.", next: "fifth" }
      ];
    case "third":
      return [
        { i: "📌", t: "Shortcuts & Widgets", body: "Handy deep shortcuts for this area.", next: "fourth" },
        { i: "🧭", t: "Advanced Explore", body: "Open related tools and filters.", next: "fourth" },
        { i: "🧱", t: "Customize Blocks", body: "Add/remove content blocks to your page.", next: "fifth" },
        { i: "🧰", t: "Utilities Toolkit", body: "Useful quick utilities here (e.g., timer, notes).", next: "fifth" },
        { i: "🔑", t: "Session Key", body: "Request temporary access key.", next: "fifth:SessionKey", requiresRole: 'admin' },
        { i: "🖨️", t: "Print View", body: "Optimize content for printing/PDF.", next: "fifth" },
        { i: "💡", t: "Smart Tips", body: "Contextual advice based on current view.", next: "fifth" },
        { i: "🔄", t: "Sync Data", body: "Force data synchronization.", next: "fifth" },
      ];
    case "fourth":
      return [
        { i: "🗃️", t: "Archive Options", body: "Send to archive with retention policy.", next: "fifth" },
        { i: "🪪", t: "Membership Status", body: "Membership details and renewal.", next: "fifth:Membership" },
        { i: "🧭", t: "Quick Navigate", body: "Go to a related area.", next: "fifth" },
        { i: "📝", t: "Feedback Loop", body: "Send private feedback to the team.", next: "fifth" },
        { i: "📊", t: "Usage Stats", body: "View your activity dashboard.", next: "fifth" },
        { i: "💸", t: "Billing & Plans", body: "Manage subscription details.", next: "fifth" },
        { i: "🧑‍💻", t: "Dev Tools", body: "Open developer console (hidden feature).", next: "fifth:DevTools", requiresRole: 'admin' },
        { i: "🔗", t: "External Links", body: "Links to Privacy/Terms pages.", next: "fifth" },
      ];
    case "call":
      return [
        { i: "📝", t: "Notes", body: "Take quick notes during call.", next: "fourth" },
        { i: "👥", t: "Add participant", body: "Turn into a group call.", next: "fifth:Call", actionType: 'StartVoiceCall', targetId: targetId + "_GROUP" }
      ];
    case "video":
      return [
        { i: "🎬", t: "Record", body: "Record this session.", next: "fourth" },
        { i: "🖼️", t: "Background", body: "Choose a virtual background.", next: "fifth:Video", actionType: 'StartVideoCall', targetId: targetId + "_VIDEO" }
      ];
    case "invite":
      return [
        { i: "🧑‍🤝‍🧑", t: "Invite 3 friends", body: "Send invites now.", next: "fourth" },
        { i: "🔗", t: "Copy link", body: "Share a quick invite link.", next: "fifth" }
      ];
    case "fifth:Call":
      return [{ i: "📞", t: "Start Voice Call Now", body: `Confirm call with ${targetId}.`, actionType: 'StartVoiceCall', targetId: targetId }];
    case "fifth:Video":
      return [{ i: "🎥", t: "Start Video Call Now", body: `Confirm video call with ${targetId}.`, actionType: 'StartVideoCall', targetId: targetId }];
    case "fifth:DeleteAccount":
      return [{ i: "🚨", t: "I'm Sure - Delete Now", body: "This action is permanent and irreversible. We are sorry to see you go.", actionType: 'DeleteAccount', targetId: 'user_data' }];
    case "fifth:ReportIssue":
      return [{ i: "✉️", t: "Submit Report", body: "Submitting report to the Moderation Team.", actionType: 'SubmitReport', targetId: 'moderation_system' }];
    case "fifth:Membership":
      return [{ i: "💳", t: "Upgrade Plan", body: "View and upgrade membership options.", actionType: 'UpgradePlan', targetId: 'billing_page' }];
    case "fifth:DevTools":
      return [{ i: "🐛", t: "Open Debug Console", body: "Accessing development and debug logs.", actionType: 'OpenDevConsole', targetId: 'dev_logs', requiresRole: 'admin' }];
    case "fifth:SessionKey":
      return [{ i: "🔒", t: "Generate One-Time Key", body: "Generate a secure, short-lived session key for external login.", actionType: 'GenerateSessionKey', targetId: 'api_key_gen', requiresRole: 'admin' }];
    case "fifth:AISummary":
      return [{ i: "🤖", t: "Start AI Summary", body: "AI is processing the latest activity...", actionType: 'StartAISummary', targetId: arg?.t }];
    default:
      return [];
  }
}

/* Second level title helper */
const TITLE_MAP = {
  "Search": "Search tools",
  "Settings": "Settings",
  "Groups": "All groups",
  "Nearby": "People nearby",
  "SupportPeers": "Peer Circles",
  "SupportTools": "Coping Tools",
  "SupportPro": "Find a Counselor",
  "SupportAnxiety": "Anxiety Support",
  "SupportDepression": "Depression Support",
  "SupportSleep": "Sleep Hygiene",
  "SupportCrisis": "Crisis Resources",
  "Alerts": "Notification Settings"
};

export function secondTitle(src, group) {
  if (!src) return "";
  if (TITLE_MAP[src]) return TITLE_MAP[src];
  if (src === "GroupMembers") return group?.name || "Group";
  if (src?.startsWith("Explore:")) return src.replace("Explore:", "") + " options";
  
  return `${src} panel`;
}