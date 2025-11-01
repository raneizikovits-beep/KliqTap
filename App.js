/* App.js - AllKind prototype with deeper sheets
   Scope of this update only:
   - Add more categories and links on third and fourth level
   - Add a new fifth level sheet and wire icons to open it
   - Keep everything else exactly the same
*/

import * as React from "react";
import { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Image
} from "react-native";

/* ---------- Palette and constants ---------- */
const brand = {
  bg: "#FFF9F2",
  header: "#F7EFE6",
  headerBorder: "#E7DED3",
  ink: "#202224",
  soft: "#6B6A6A",
  active: "#1F2328",
  blue: "#2962FF",
  green: "#20B86A",
  red: "#D44B3E",
  yellow: "#F7C11F",
  sky: "#BBD6FF"
};

const ABOUT_TITLE = "About AllKind";
const ABOUT_BODY =
  "AllKind is a community app designed to help people find supportive groups, share practical knowledge and connect kindly. Created by Ran Eizikovich. Mission: reduce isolation, make it easy to discover safe small groups, and give quick tools for chat, calls, video and events. Values: empathy, privacy, accessibility, and usefulness.";

/* ---------- Small brand mark ---------- */
const PeopleHeartLogo = () => (
  <View style={{ flexDirection: "row", alignItems: "center" }}>
    <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: "#FFB27E", transform: [{ rotate: "45deg" }] }} />
    <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: "#FF7F7A", transform: [{ rotate: "45deg" }], marginLeft: -12 }} />
  </View>
);

/* ---------- Header (kept as in previous version) ---------- */
function Header({ openAI, openCreate, openSettings, openSearch }) {
  return (
    <SafeAreaView style={{ backgroundColor: brand.header }}>
      <View style={[styles.headerRow, { paddingTop: 10, height: 96 }]}>
        <View style={styles.brandRow}>
          <PeopleHeartLogo />
          <Text style={styles.brandTitle}>AllKind</Text>
        </View>
        <View style={styles.headRight}>
          <TouchableOpacity onPress={openAI} style={styles.aiChip} activeOpacity={0.85}>
            <Text style={{ color: "#fff", fontWeight: "900" }}>AI</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openCreate} style={styles.addBtn} activeOpacity={0.85}>
            <Text style={{ color: "#111", fontWeight: "900" }}>＋</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openSearch} style={styles.headBtn} activeOpacity={0.9}>
            <Text style={{ fontSize: 18 }}>🔭</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openSettings} style={styles.headBtn} activeOpacity={0.8}>
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ height: 10 }} />
    </SafeAreaView>
  );
}

/* ---------- Tab icons ---------- */
const TabIcon = ({ type }) => {
  switch (type) {
    case "home": return <Text style={{ fontSize: 20 }}>🏠</Text>;
    case "explore": return <Text style={{ fontSize: 20 }}>🧭</Text>;
    case "support": return <Text style={{ fontSize: 20 }}>🧠</Text>;
    case "messages": return <Text style={{ fontSize: 20 }}>💬</Text>;
    case "events": return <Text style={{ fontSize: 20 }}>📅</Text>;
    case "profile": return <Text style={{ fontSize: 20 }}>👤</Text>;
    default: return <Text>⬜</Text>;
  }
};
const TabBtn = ({ label, active, onPress, onExtra, type }) => (
  <TouchableOpacity onPress={onPress} onLongPress={onExtra} style={styles.tabBtn}>
    <View style={[styles.tabIconWrap, active && { backgroundColor: "rgba(0,0,0,0.06)" }]}>
      <TabIcon type={type} />
    </View>
    <Text style={[styles.tabLabel, active && { color: brand.active }]}>{label}</Text>
  </TouchableOpacity>
);

/* ---------- Home groups list ---------- */
const HOME_GROUPS_EN = [
  "Students","Young Professionals","Professionals","Remote Workers","Freelancers",
  "Adults 45-65","Hobbies","Health","Older Adults 50-80","Under 30 Singles",
  "Low Income","Solo Employees","Minorities","LGBT","Immigrants",
  "People With Disabilities","Disabled","Regional Communities","Neighborhood"
];

/* Group images */
const GROUP_IMG = {
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
  "Neighborhood": "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400&h=400&fit=crop"
};
const imageFor = (title) =>
  GROUP_IMG[title] || `https://picsum.photos/seed/${encodeURIComponent(title)}/400/400`;

/* ---------- Explore categories ---------- */
const EXPLORE_CATEGORIES = [
  { title: "Creative & Arts", icon: "🎨" },{ title: "Tech & Learning", icon: "💻" },
  { title: "Wellness & Sport", icon: "🧘" },{ title: "Local Communities", icon: "🏘️" },
  { title: "Parenting & Family", icon: "👨‍👩‍👧" },{ title: "Career & Business", icon: "📈" },
  { title: "Volunteering", icon: "🤝" },{ title: "Languages", icon: "🗣️" },
  { title: "Gaming & Fun", icon: "🎮" },{ title: "Food & Cooking", icon: "🍳" },
  { title: "Outdoors", icon: "🥾" },{ title: "Faith & Values", icon: "🕊️" },
  { title: "Mindfulness", icon: "🧠" },{ title: "Travel", icon: "✈️" },
  { title: "Social Impact", icon: "🌍" },{ title: "Groups", icon: "🗂️" },
  { title: "Nearby", icon: "📍" }
];

/* ---------- Demo members ---------- */
const DEMO_MEMBERS = [
  { name: "Alex", img: "https://randomuser.me/api/portraits/men/15.jpg", intent: "Start Study Circle" },
  { name: "Sara", img: "https://randomuser.me/api/portraits/women/47.jpg", intent: "Join Run Club" },
  { name: "Jon", img: "https://randomuser.me/api/portraits/men/23.jpg", intent: "Join Writing Circle" },
  { name: "Lia", img: "https://randomuser.me/api/portraits/women/51.jpg", intent: "Start Wellness Group" },
  { name: "Tom", img: "https://randomuser.me/api/portraits/men/30.jpg", intent: "Join Tech Learners" },
  { name: "Nina", img: "https://randomuser.me/api/portraits/women/14.jpg", intent: "Start Local Neighbors" }
];

/* ---------- Online status avatars ---------- */
const AVATARS_ONLINE = [
  { img: "https://randomuser.me/api/portraits/thumb/men/5.jpg", name: "Noah", intent: "Join Study Group" },
  { img: "https://randomuser.me/api/portraits/thumb/women/12.jpg", name: "Mia", intent: "Start Art Club" },
  { img: "https://randomuser.me/api/portraits/thumb/men/7.jpg", name: "Leo", intent: "Join Run Club" },
  { img: "https://randomuser.me/api/portraits/thumb/women/18.jpg", name: "Sofia", intent: "Start Language Exchange" },
  { img: "https://randomuser.me/api/portraits/thumb/men/33.jpg", name: "Ethan", intent: "Join Wellness Group" },
  { img: "https://randomuser.me/api/portraits/thumb/women/44.jpg", name: "Luna", intent: "Start Founders Pod" }
];
const AVATARS_OFFLINE = [
  { img: "https://randomuser.me/api/portraits/thumb/men/23.jpg", name: "Jack", intent: "Join Gaming Night" },
  { img: "https://randomuser.me/api/portraits/thumb/women/41.jpg", name: "Ava", intent: "Start Book Club" },
  { img: "https://randomuser.me/api/portraits/thumb/men/28.jpg", name: "Kai", intent: "Join Coffee Chats" },
  { img: "https://randomuser.me/api/portraits/thumb/women/52.jpg", name: "Zoe", intent: "Start Mindfulness" }
];

/* =======================================================
   App
======================================================= */
export default function App() {
  /* AI modal state */
  const [aiOpen, setAiOpen] = useState(false);
  const [aiThread, setAiThread] = useState([{ role: "system", text: "Hi, I am AllKind AI. How can I help you connect today?" }]);
  const [aiInput, setAiInput] = useState("");

  /* create, sheets */
  const [createOpen, setCreateOpen] = useState(false);
  const [secondSheet, setSecondSheet] = useState(null);
  const [thirdSheet, setThirdSheet] = useState(null);
  const [fourthSheet, setFourthSheet] = useState(null);
  const [fifthSheet, setFifthSheet] = useState(null); // new level

  /* tabs */
  const [tab, setTab] = useState("Home");
  const [profilePeek, setProfilePeek] = useState(null);
  const [dockRight, setDockRight] = useState(true);

  /* Motivation system */
  const [points, setPoints] = useState(120);
  const [streak, setStreak] = useState(3);
  const [badges, setBadges] = useState(["Starter", "First Join"]);

  const award = (reason) => {
    let delta = 0;
    if (reason === "Join") delta = 15;
    else if (reason === "Reminder") delta = 8;
    else if (reason === "Invite") delta = 12;
    else if (reason === "Open chat" || reason === "Start chat") delta = 6;
    else if (reason === "Call" || reason === "Start call") delta = 10;
    else if (reason === "Video" || reason === "Start video") delta = 12;
    else if (reason === "Send message") delta = 5;
    if (delta > 0) {
      const next = points + delta;
      setPoints(next);
      if (next >= 150 && !badges.includes("Connector")) setBadges([...badges, "Connector"]);
      if (next >= 220 && !badges.includes("Community Builder")) setBadges([...badges, "Community Builder"]);
    }
  };

  /* stats for header tiles */
  const onlineCount = 28, offlineCount = 12;
  const total = Math.max(onlineCount + offlineCount, 1);
  const onlinePct = Math.round((onlineCount / total) * 100);
  const offlinePct = 100 - onlinePct;

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      <View style={styles.appFrame}>
        <Header
          openAI={() => setAiOpen(true)}
          openCreate={() => setCreateOpen(true)}
          openSettings={() => setSecondSheet({ source: "Settings" })}
          openSearch={() => setSecondSheet({ source: "Search" })}
        />

        {/* status boxes */}
        <View style={styles.ratioRow}>
          <TouchableOpacity activeOpacity={0.9} style={styles.ratioTileLeft} onPress={() => setSecondSheet({ source: "Online" })}>
            <View style={styles.tileHead}>
              <Text style={styles.tileIcon}>🟢</Text>
              <Text style={styles.tileTitle}>Online</Text>
              <View style={styles.tilePctPill}><Text style={styles.tilePctText}>{onlinePct}%</Text></View>
            </View>
            <View style={styles.tileBarWrap}><View style={[styles.tileBarFillGreen, { width: `${onlinePct}%` }]} /></View>
            <View style={styles.avatarRowClip}>
              {AVATARS_ONLINE.map((u, i) => (
                <TouchableOpacity key={"on" + i} onPress={() => setProfilePeek(u)}>
                  <Image source={{ uri: u.img }} style={[styles.avatarStack, i > 0 && styles.avatarOverlap]} />
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.9} style={styles.ratioTileRight} onPress={() => setSecondSheet({ source: "Offline" })}>
            <View style={styles.tileHead}>
              <Text style={styles.tileIcon}>🔴</Text>
              <Text style={styles.tileTitle}>Offline</Text>
              <View style={[styles.tilePctPill, { backgroundColor: "rgba(212,75,62,0.15)", borderColor: "rgba(212,75,62,0.45)" }]}>
                <Text style={[styles.tilePctText, { color: brand.red }]}>{offlinePct}%</Text>
              </View>
            </View>
            <View style={styles.tileBarWrap}><View style={[styles.tileBarFillRed, { width: `${offlinePct}%` }]} /></View>
            <View style={styles.avatarRowClip}>
              {AVATARS_OFFLINE.map((u, i) => (
                <TouchableOpacity key={"off" + i} onPress={() => setProfilePeek(u)}>
                  <Image source={{ uri: u.img }} style={[styles.avatarStack, i > 0 && styles.avatarOverlap]} />
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </View>

        {/* tabs content */}
        {tab === "Home" && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
            <View style={{ height: 6 }} />
            <Text style={styles.h1}>Suggested for You</Text>
            <Text style={styles.sub}>AI personalized group suggestions</Text>

            <TouchableOpacity
              style={styles.gpsChipInline}
              onPress={() => setSecondSheet({ source: "Nearby" })}
              activeOpacity={0.9}
            >
              <Text style={{ fontSize: 16, marginRight: 6 }}>📍</Text>
              <Text style={{ fontWeight: "800", color: brand.ink }}>Find nearby</Text>
            </TouchableOpacity>

            <View style={{ height: 8 }} />
            {HOME_GROUPS_EN.map((name, i) => (
              <GroupCard
                key={name + i}
                title={name}
                openMembers={() => setSecondSheet({ source: "GroupMembers", group: name })}
              />
            ))}
          </ScrollView>
        )}

        {tab === "Explore" && (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
            <Text style={styles.h1}>Explore</Text>
            <Text style={styles.sub}>Browse categories, trends, nearby and groups</Text>
            <View style={[styles.iconGrid, { justifyContent: "center" }]}>
              {EXPLORE_CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.title}
                  style={styles.iconTile}
                  onPress={() => {
                    if (c.title === "Groups") setSecondSheet({ source: "Groups" });
                    else if (c.title === "Nearby") setSecondSheet({ source: "Nearby" });
                    else setSecondSheet({ source: "Explore:" + c.title });
                  }}>
                  <Text style={{ fontSize: 22 }}>{c.icon}</Text>
                  <Text style={{ marginTop: 6, fontWeight: "700", color: brand.ink, textAlign: "center" }}>{c.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {tab === "Support" && (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
            <Text style={styles.h1}>Support</Text>
            <Text style={styles.sub}>Mental wellness, coping tools, peer groups</Text>
            <SupportCard title="Peer circles" desc="Talk with kind peers in small groups." onPress={() => setSecondSheet({ source: "SupportPeers" })} />
            <SupportCard title="Coping tools" desc="Breathing, journaling, grounding." onPress={() => setSecondSheet({ source: "SupportTools" })} />
            <SupportCard title="Find a counselor" desc="Guidance to professional help." onPress={() => setSecondSheet({ source: "SupportPro" })} />
            <SupportCard title="Anxiety support" desc="Skills for worry and stress." onPress={() => setSecondSheet({ source: "SupportAnxiety" })} />
            <SupportCard title="Depression support" desc="Gentle routines and check ins." onPress={() => setSecondSheet({ source: "SupportDepression" })} />
            <SupportCard title="Sleep hygiene" desc="Winds down and better rest." onPress={() => setSecondSheet({ source: "SupportSleep" })} />
            <SupportCard title="Crisis resources" desc="Emergency information and hotlines." onPress={() => setSecondSheet({ source: "SupportCrisis" })} />
          </ScrollView>
        )}

        {tab === "Messages" && (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
            <Text style={styles.h1}>Messages & Calls</Text>
            <Text style={styles.sub}>Chats, voice and video</Text>

            {[
              ["Study Group","Meeting link pinned. Be on time."],
              ["Run Club","Call starts in 10 minutes."],
              ["Design Pods","Join the video session."],
              ["AI tip","New match in Neighborhood."]
            ].map(([title, body]) => (
              <MessageBlock
                key={title}
                title={title}
                body={body}
                actions={[
                  { label: "Open", icon: "💬" },
                  { label: "Call", icon: "📞" },
                  { label: "Video", icon: "🎥" }
                ]}
                onAction={(l) => {
                  award(l);
                  // open third level with deeper links
                  setThirdSheet({
                    title: title + " - " + l,
                    body: "Action executed.",
                    items: deepItems("messageAction", l)
                  });
                }}
              />
            ))}
          </ScrollView>
        )}

        {tab === "Events" && (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
            <Text style={styles.h1}>Events</Text>
            <Text style={styles.sub}>Meetups and sessions with reminders</Text>
            {[
              ["Study sprint","Today 5:00 PM  •  Online"],
              ["Run club jog","Tomorrow 7:00 AM  •  Riverside Park"],
              ["Founders demo","Fri 8:00 PM  •  Hub A"]
            ].map(([title, details]) => (
              <EventBlock
                key={title}
                title={title}
                details={details}
                actions={[
                  { label: "Join", icon: "✅" },
                  { label: "Reminder", icon: "⏰" },
                  { label: "Share", icon: "🔗" }
                ]}
                onAction={(l) => {
                  award(l);
                  setThirdSheet({
                    title: title + " - " + l,
                    body: "Saved.",
                    items: deepItems("eventAction", l)
                  });
                }}
              />
            ))}
          </ScrollView>
        )}

        {tab === "Profile" && (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
            <Text style={styles.h1}>Profile</Text>
            <Text style={styles.sub}>Ran Eizikovich, from Israel</Text>
            <View style={styles.profileCard}>
              <Text style={styles.p}>Interests: Writing, fitness, study buddies</Text>
              <Text style={styles.p}>Availability: Evenings and weekends</Text>
              <Text style={styles.p}>Preferred groups: Study, wellness, local community</Text>

              <View style={{ height: 10 }} />
              <Text style={styles.h2}>Sign up or link accounts</Text>
              <View style={styles.actionsRow}>
                {[
                  ["Email", "✉️", "Enter your email to create or link your account."],
                  ["Google", "🟢", "Link Google account for fast sign in."],
                  ["Facebook", "🔵", "Link Facebook to find friends and groups."],
                  ["Apple", "⚫", "Use Sign in with Apple."],
                  ["LinkedIn", "🔗", "Connect professional profile."],
                  ["X", "✖️", "Link X for interests."],
                  ["GitHub", "🐙", "Show projects and repos."],
                  ["Instagram", "📸", "Link Instagram to share moments."],
                  ["TikTok", "🎵", "Link TikTok profile."],
                  ["Telegram", "📨", "Link Telegram for fast messaging."],
                  ["WhatsApp", "🟢", "Link WhatsApp number."],
                  ["Pinterest", "📌", "Link boards and ideas."]
                ].map(([label, icon, body]) => (
                  <IconChip
                    key={label}
                    label={label}
                    icon={icon}
                    onPress={() =>
                      setThirdSheet({
                        title: label,
                        body,
                        items: deepItems("profileLink", label)
                      })
                    }
                  />
                ))}
              </View>

              <View style={{ height: 10 }} />
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setSecondSheet({ source: "Profile" })}>
                <Text style={{ color: "#fff", fontWeight: "800" }}>Edit profile</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* floating add and AI */}
        <TouchableOpacity
          style={[styles.fab, { bottom: 88, right: dockRight ? 76 : 16, opacity: 0.82 }]}
          onPress={() => setCreateOpen(true)}
          onLongPress={() => setDockRight(!dockRight)}
        >
          <Text style={{ fontSize: 26, fontWeight: "900", color: "#111" }}>＋</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickAI, { bottom: 88, right: dockRight ? 16 : 76, opacity: 0.82 }]}
          onPress={() => setAiOpen(true)}
          onLongPress={() => setDockRight(!dockRight)}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>⚡</Text>
        </TouchableOpacity>

        {/* bottom tabs */}
        <View style={styles.tabs}>
          <TabBtn label="Home" type="home" active={tab === "Home"} onPress={() => setTab("Home")} onExtra={() => setSecondSheet({ source: "Home" })} />
          <TabBtn label="Explore" type="explore" active={tab === "Explore"} onPress={() => setTab("Explore")} onExtra={() => setSecondSheet({ source: "Explore" })} />
          <TabBtn label="Support" type="support" active={tab === "Support"} onPress={() => setTab("Support")} onExtra={() => setSecondSheet({ source: "Support" })} />
          <TabBtn label="Messages" type="messages" active={tab === "Messages"} onPress={() => setTab("Messages")} onExtra={() => setSecondSheet({ source: "Messages" })} />
          <TabBtn label="Events" type="events" active={tab === "Events"} onPress={() => setTab("Events")} onExtra={() => setSecondSheet({ source: "Events" })} />
          <TabBtn label="Profile" type="profile" active={tab === "Profile"} onPress={() => setTab("Profile")} onExtra={() => setSecondSheet({ source: "Profile" })} />
        </View>
      </View>

      {/* AI modal */}
      <Modal visible={aiOpen} transparent animationType="slide" onRequestClose={() => setAiOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.cardModal}>
            <Text style={styles.h1}>AllKind AI</Text>
            <Text style={styles.p}>Ask for matches, start a chat, call or video.</Text>
            <View style={{ height: 8 }} />
            <ScrollView style={{ maxHeight: 220 }}>
              {aiThread.map((m, i) => (
                <View key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", backgroundColor: m.role === "user" ? brand.sky : "#F2F2F2", padding: 8, borderRadius: 10, marginBottom: 6, maxWidth: "90%" }}>
                  <Text style={{ color: brand.ink, lineHeight: 18 }}>{m.text}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.aiGrid}>
              {[
                ["Start chat", "💬", "Opening AI assisted chat..."],
                ["Start call", "📞", "Starting voice call with AI assist..."],
                ["Send message", "✉️", "Sending a quick message through AI routing..."],
                ["Start video", "🎥", "Starting video room with AI assist..."],
                ["Send file", "📎", "Attach and send a file to your group."],
                ["Voice note", "🎙️", "Record and send a voice note."],
                ["Schedule call", "🗓️", "Pick a time and invite members."],
                ["Find nearby", "📍", "Show nearby members and groups."]
              ].map(([label, icon, body]) => (
                <IconChip
                  key={label}
                  label={label}
                  icon={icon}
                  onPress={() => {
                    award(label);
                    setThirdSheet({
                      title: label,
                      body,
                      items: deepItems("aiQuick", label)
                    });
                  }}
                />
              ))}
            </View>

            <TextInput
              placeholder="Type a message for AI"
              placeholderTextColor="#888"
              style={[styles.input, { lineHeight: 18 }]}
              value={aiInput}
              onChangeText={setAiInput}
              onSubmitEditing={() => {
                if (!aiInput.trim()) return;
                const next = [...aiThread, { role: "user", text: aiInput.trim() }, { role: "assistant", text: "Got it. I suggest a Study Buddies group and a Writers Circle this evening." }];
                setAiThread(next);
                setAiInput("");
                award("Send message");
              }}
            />
            <TouchableOpacity onPress={() => setAiOpen(false)} style={{ paddingTop: 8 }}>
              <Text style={{ color: brand.soft, textAlign: "center" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create group */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.cardModal}>
            <Text style={styles.h1}>Create a Group</Text>
            <TextInput placeholder="Group name" placeholderTextColor="#888" style={styles.input} />
            <TextInput placeholder="Purpose" placeholderTextColor="#888" style={styles.input} />
            <TextInput placeholder="Location" placeholderTextColor="#888" style={styles.input} />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setCreateOpen(false)}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCreateOpen(false)} style={{ paddingTop: 8 }}>
              <Text style={{ color: brand.soft, textAlign: "center" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Second level */}
      <Modal visible={!!secondSheet} transparent animationType="fade" onRequestClose={() => setSecondSheet(null)}>
        <View style={styles.overlay}>
          <View style={styles.cardModal}>
            <Text style={styles.h1}>{secondTitle(secondSheet?.source, secondSheet?.group)}</Text>
            <Text style={styles.p}>Quick actions and shortcuts</Text>

            {secondSheet?.source === "GroupMembers" && (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.h2, { marginBottom: 8 }]}>{secondSheet.group}</Text>
                <View style={styles.membersGrid}>
                  {DEMO_MEMBERS.map((m, idx) => (
                    <MemberTile
                      key={idx}
                      user={m}
                      onOpenProfile={() => setProfilePeek(m)}
                      onAdd={() => {
                        award("Invite");
                        setFourthSheet({ title: "Added", body: m.name + " added to your custom group." });
                      }}
                      onRemove={() => setFourthSheet({ title: "Skipped", body: m.name + " was not added." })}
                    />
                  ))}
                </View>
              </View>
            )}

            <View style={[styles.iconGrid, { justifyContent: "center" }]}>
              {secondIcons(secondSheet?.source, { points, streak, badges }).map((it) => (
                <TouchableOpacity
                  key={it.t}
                  style={styles.iconTile}
                  onPress={() => {
                    if (it.t === ABOUT_TITLE) setThirdSheet({ title: ABOUT_TITLE, body: ABOUT_BODY, items: deepItems("about", "") });
                    else if (it.next === "fourth") setFourthSheet({ title: it.t, body: it.body, items: deepItems("fourth", it.t) });
                    else if (it.next === "fifth") setFifthSheet({ title: it.t, body: it.body });
                    else setThirdSheet({ title: it.t, body: it.body, items: deepItems("third", it.t) });
                  }}>
                  <Text style={{ fontSize: 22 }}>{it.i}</Text>
                  <Text style={{ marginTop: 6, fontWeight: "700", color: brand.ink, textAlign: "center" }}>{it.t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={() => setSecondSheet(null)} style={{ paddingTop: 6 }}>
              <Text style={{ color: brand.soft, textAlign: "center" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Third level with expandable items */}
      <Modal visible={!!thirdSheet} transparent animationType="fade" onRequestClose={() => setThirdSheet(null)}>
        <View style={styles.overlay}>
          <View style={styles.cardModal}>
            <Text style={styles.h1}>{thirdSheet?.title || ""}</Text>
            <Text style={styles.p}>{thirdSheet?.body || ""}</Text>

            {!!thirdSheet?.items?.length && (
              <View style={[styles.iconGrid, { justifyContent: "center", marginTop: 12 }]}>
                {thirdSheet.items.map((it) => (
                  <TouchableOpacity
                    key={it.t}
                    style={styles.iconTile}
                    onPress={() => {
                      if (it.next === "fourth") setFourthSheet({ title: it.t, body: it.body, items: deepItems("fourth", it.t) });
                      else if (it.next === "fifth") setFifthSheet({ title: it.t, body: it.body });
                      else setFourthSheet({ title: it.t, body: it.body });
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{it.i}</Text>
                    <Text style={{ marginTop: 6, fontWeight: "700", color: brand.ink, textAlign: "center" }}>{it.t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ height: 8 }} />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setThirdSheet(null)}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>OK</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setThirdSheet(null)} style={{ paddingTop: 8 }}>
              <Text style={{ color: brand.soft, textAlign: "center" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Fourth level, can branch to fifth */}
      <Modal visible={!!fourthSheet} transparent animationType="fade" onRequestClose={() => setFourthSheet(null)}>
        <View style={styles.overlay}>
          <View style={styles.cardModal}>
            <Text style={styles.h1}>{fourthSheet?.title || ""}</Text>
            <Text style={styles.p}>{fourthSheet?.body || ""}</Text>

            {!!fourthSheet?.items?.length && (
              <View style={[styles.iconGrid, { justifyContent: "center", marginTop: 12 }]}>
                {fourthSheet.items.map((it) => (
                  <TouchableOpacity
                    key={it.t}
                    style={styles.iconTile}
                    onPress={() => {
                      if (it.next === "fifth") setFifthSheet({ title: it.t, body: it.body });
                      else setFifthSheet({ title: it.t, body: it.body }); // default to fifth for deeper link
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{it.i}</Text>
                    <Text style={{ marginTop: 6, fontWeight: "700", color: brand.ink, textAlign: "center" }}>{it.t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ height: 8 }} />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setFourthSheet(null)}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Done</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFourthSheet(null)} style={{ paddingTop: 8 }}>
              <Text style={{ color: brand.soft, textAlign: "center" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Fifth level - final leaf sheet */}
      <Modal visible={!!fifthSheet} transparent animationType="fade" onRequestClose={() => setFifthSheet(null)}>
        <View style={styles.overlay}>
          <View style={styles.cardModal}>
            <Text style={styles.h1}>{fifthSheet?.title || "Details"}</Text>
            <Text style={styles.p}>{fifthSheet?.body || "Opened a deep link."}</Text>
            <View style={{ height: 8 }} />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setFifthSheet(null)}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Profile peek */}
      <Modal visible={!!profilePeek} transparent animationType="fade" onRequestClose={() => setProfilePeek(null)}>
        <View style={styles.overlay}>
          <View style={styles.cardModal}>
            <View style={{ alignItems: "center" }}>
              <Image source={{ uri: profilePeek?.img }} style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 8 }} />
            </View>
            <Text style={styles.h2}>{profilePeek?.name || "Member"}</Text>
            <Text style={styles.p}>Intent: {profilePeek?.intent || "Join a friendly group."}</Text>
            <Text style={[styles.p, { marginTop: 6 }]}>Profile: short community bio and the type of group they want to start or join.</Text>
            <View style={[styles.actionsRow, { marginTop: 10 }]}>
              <IconChip label="Open chat" icon="💬" onPress={() => { award("Open chat"); setThirdSheet({ title: "Chat", body: "Starting a 1 to 1 chat.", items: deepItems("chat", "") }); }} />
              <IconChip label="Call" icon="📞" onPress={() => { award("Call"); setThirdSheet({ title: "Call", body: "Starting a voice call.", items: deepItems("call", "") }); }} />
              <IconChip label="Video" icon="🎥" onPress={() => { award("Video"); setThirdSheet({ title: "Video", body: "Starting a video call.", items: deepItems("video", "") }); }} />
              <IconChip label="Invite" icon="🧑‍🤝‍🧑" onPress={() => { award("Invite"); setThirdSheet({ title: "Invite", body: "Sent a group invite.", items: deepItems("invite", "") }); }} />
            </View>
            <TouchableOpacity onPress={() => setProfilePeek(null)} style={{ paddingTop: 8 }}>
              <Text style={{ color: brand.soft, textAlign: "center" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---------- Helper: deep items generator for 3rd, 4th, 5th ---------- */
function deepItems(kind, arg) {
  // returns arrays of {i,t,body,next?} to populate deeper sheets
  if (kind === "messageAction") {
    return [
      { i: "🧷", t: "Pin message", body: "Pinned to the top.", next: "fourth" },
      { i: "👥", t: "Open members", body: "See members in this thread.", next: "fourth" },
      { i: "🗂️", t: "Folders", body: "Organize chats into folders.", next: "fourth" },
      { i: "🔒", t: "Privacy options", body: "Read receipts, last seen, typing." , next: "fourth" },
      { i: "🛟", t: "Report issue", body: "Flag a problem to moderators.", next: "fifth" }
    ];
  }
  if (kind === "eventAction") {
    return [
      { i: "🗓️", t: "Add to calendar", body: "Added to your device calendar.", next: "fourth" },
      { i: "🚕", t: "Directions", body: "Open maps and route.", next: "fourth" },
      { i: "🔔", t: "Extra reminder", body: "Set an extra reminder.", next: "fourth" },
      { i: "🤝", t: "Find a buddy", body: "Pair with someone to attend together.", next: "fifth" },
      { i: "📸", t: "Event gallery", body: "Photos and recaps after the event.", next: "fifth" }
    ];
  }
  if (kind === "profileLink") {
    return [
      { i: "🧪", t: "Security check", body: "Protect account with 2FA.", next: "fourth" },
      { i: "📜", t: "Permissions", body: "What access is requested.", next: "fourth" },
      { i: "🧹", t: "Disconnect", body: "Remove this linked account.", next: "fifth" }
    ];
  }
  if (kind === "aiQuick") {
    return [
      { i: "🧭", t: "Suggest group", body: "AI suggests a relevant group.", next: "fourth" },
      { i: "🧩", t: "Refine request", body: "Choose time and topics.", next: "fourth" },
      { i: "🗂️", t: "Templates", body: "Open message or invite templates.", next: "fifth" },
      { i: "📈", t: "Success tips", body: "Tips to get quick responses.", next: "fifth" }
    ];
  }
  if (kind === "about") {
    return [
      { i: "🎯", t: "Mission", body: "Kind connections at human scale.", next: "fourth" },
      { i: "🧩", t: "How it works", body: "Small groups, quick tools, privacy first.", next: "fourth" },
      { i: "👤", t: "Creator", body: "Built by Ran Eizikovich.", next: "fifth" },
      { i: "🛡️", t: "Safety", body: "Community rules and reporting.", next: "fifth" }
    ];
  }
  if (kind === "third") {
    return [
      { i: "📌", t: "Shortcuts", body: "Handy deep shortcuts for this area.", next: "fourth" },
      { i: "🧭", t: "Explore more", body: "Open related tools and filters.", next: "fourth" },
      { i: "🧱", t: "Blocks", body: "Add blocks to your page.", next: "fifth" },
      { i: "🧰", t: "Toolkit", body: "Useful utilities here.", next: "fifth" }
    ];
  }
  if (kind === "fourth") {
    return [
      { i: "🗃️", t: "Archive", body: "Send to archive.", next: "fifth" },
      { i: "🪪", t: "Membership", body: "Membership details.", next: "fifth" },
      { i: "🧭", t: "Navigate", body: "Go to a related area.", next: "fifth" }
    ];
  }
  if (kind === "chat") {
    return [
      { i: "🔖", t: "Labels", body: "Tag this chat for later.", next: "fourth" },
      { i: "📤", t: "Forward", body: "Forward this conversation.", next: "fourth" },
      { i: "🔕", t: "Mute", body: "Mute notifications.", next: "fifth" }
    ];
  }
  if (kind === "call") {
    return [
      { i: "📝", t: "Notes", body: "Take quick notes during call.", next: "fourth" },
      { i: "👥", t: "Add participant", body: "Turn into a group call.", next: "fifth" }
    ];
  }
  if (kind === "video") {
    return [
      { i: "🎬", t: "Record", body: "Record this session.", next: "fourth" },
      { i: "🖼️", t: "Background", body: "Choose a virtual background.", next: "fifth" }
    ];
  }
  if (kind === "invite") {
    return [
      { i: "🧑‍🤝‍🧑", t: "Invite 3 friends", body: "Send invites now.", next: "fourth" },
      { i: "🔗", t: "Copy link", body: "Share a quick invite link.", next: "fifth" }
    ];
  }
  return [];
}

/* ---------- Blocks & tiles ---------- */
function MessageBlock({ title, body, actions, onAction }) {
  return (
    <View style={styles.blockCard}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.p}>{body}</Text>
      <View style={[styles.actionsRow, { marginTop: 8 }]}>
        {actions.map((a, i) => (
          <IconChip key={i} label={a.label} icon={a.icon} onPress={() => onAction(a.label)} />
        ))}
      </View>
    </View>
  );
}

function EventBlock({ title, details, actions, onAction }) {
  return (
    <View style={styles.blockCard}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.p}>{details}</Text>
      <View style={[styles.actionsRow, { marginTop: 8 }]}>
        {actions.map((a, i) => (
          <IconChip key={i} label={a.label} icon={a.icon} onPress={() => onAction(a.label)} />
        ))}
      </View>
    </View>
  );
}

function GroupCard({ title, openMembers }) {
  const uri = imageFor(title);
  return (
    <TouchableOpacity onPress={openMembers} style={styles.groupCard}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <Image source={{ uri }} style={styles.groupImg} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.h2} numberOfLines={1}>{title}</Text>
          <Text style={styles.p} numberOfLines={1}>Community group</Text>
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <TouchableOpacity onPress={openMembers} style={styles.joinPill}>
          <Text style={styles.joinLabel}>Join</Text>
        </TouchableOpacity>
        <Text style={[styles.p, { fontSize: 11, marginTop: 4 }]}>goin</Text>
      </View>
    </TouchableOpacity>
  );
}

function MemberTile({ user, onOpenProfile, onAdd, onRemove }) {
  return (
    <View style={styles.memberTile}>
      <TouchableOpacity onPress={onRemove} style={[styles.sideActionAbs, { left: 10 }]}>
        <View style={[styles.badge, { backgroundColor: brand.red }]}>
          <Text style={styles.badgeText}>✕</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={onOpenProfile} style={styles.memberCenter}>
        <Image source={{ uri: user.img }} style={styles.memberAvatar} />
        <Text style={[styles.p, { marginTop: 6 }]} numberOfLines={1}>{user.name}</Text>
        <Text style={[styles.p, { fontSize: 11 }]} numberOfLines={1}>{user.intent}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onAdd} style={[styles.sideActionAbs, { right: 10 }]}>
        <View style={[styles.badge, { backgroundColor: brand.green }]}>
          <Text style={styles.badgeText}>✓</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function SupportCard({ title, desc, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.groupCard}>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={styles.h2} numberOfLines={1}>{title}</Text>
        <Text style={styles.p} numberOfLines={1}>{desc}</Text>
      </View>
      <IconChip label="Open" icon="➡️" onPress={onPress} />
    </TouchableOpacity>
  );
}

function IconChip({ label, icon, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.iconChip}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <Text style={styles.iconChipText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------- Second level title helper ---------- */
function secondTitle(src, group) {
  if (!src) return "";
  if (src === "Search") return "Search tools";
  if (src === "Settings") return "Settings";
  if (src === "Groups") return "All groups";
  if (src === "Nearby") return "People nearby";
  if (src === "GroupMembers") return group + " members";
  if (src?.startsWith("Explore:")) return src.replace("Explore:", "") + " options";
  return src + " panel";
}

/* ---------- Expanded second level icons with deeper links ---------- */
function secondIcons(src, stats) {
  if (!src) return [];

  if (src === "Groups" || src === "GroupMembers") return [];

  if (src === "Nearby") {
    return [
      { i: "📍", t: "Map preview", body: "Show close by members.", next: "third" },
      { i: "🧲", t: "Smart match", body: "Suggest nearby people with shared goals.", next: "third" },
      { i: "🗺️", t: "Areas", body: "Choose neighborhoods to include.", next: "third" },
      { i: "🔔", t: "Alerts", body: "Notify when friends are within 1 km.", next: "fourth" },
      { i: "🛡️", t: "Safety tips", body: "Stay safe and meet in public places.", next: "fifth" },
      { i: "🏅", t: "Motivation", body: `Points: ${stats.points}, streak: ${stats.streak}`, next: "third" }
    ];
  }

  if (src?.startsWith("Explore:")) {
    const topic = src.replace("Explore:", "");
    return [
      { i: "✨", t: topic + " ideas", body: "Curated shortcuts to start fast.", next: "third" },
      { i: "🧭", t: "Deep explore", body: "Dive into " + topic + " and filter.", next: "third" },
      { i: "🏷️", t: "Tags", body: "Popular tags inside " + topic + ".", next: "third" },
      { i: "⏱️", t: "Trending now", body: "Hot groups in this topic.", next: "fourth" },
      { i: "🗂️", t: "Collections", body: "Starter sets to follow.", next: "fourth" },
      { i: "🏅", t: "Motivation", body: `Earn points when you post in ${topic}.`, next: "fifth" }
    ];
  }

  if (src === "Online" || src === "Offline") {
    return [
      { i: "📣", t: "Announcements", body: "What is live right now.", next: "third" },
      { i: "🧑‍🤝‍🧑", t: "Active rooms", body: "Join ongoing sessions.", next: "third" },
      { i: "🎧", t: "Audio rooms", body: "Listen in or request to speak.", next: "fourth" },
      { i: "🎥", t: "Video rooms", body: "Drop in to say hi.", next: "fourth" },
      { i: "🎯", t: "Focus pods", body: "Quiet co-working timers.", next: "fifth" },
      { i: "🔔", t: "Notify me", body: "Ping when friends go live.", next: "fifth" }
    ];
  }

  if (src === "Search") {
    return [
      { i: "🔎", t: "Global search", body: "Groups, people, events, messages.", next: "third" },
      { i: "🧩", t: "Filters", body: "By time, mood, purpose, distance.", next: "third" },
      { i: "📚", t: "Knowledge", body: "How the app works and FAQs.", next: "fourth" },
      { i: "🗂️", t: "Index", body: "All categories and tags in one place.", next: "fourth" },
      { i: "⭐", t: "Saved searches", body: "Re run your favorite filters.", next: "fifth" },
      { i: "⏰", t: "Search alerts", body: "Create alerts for new results.", next: "fifth" },
      { i: "ℹ️", t: ABOUT_TITLE, body: ABOUT_BODY, next: "third" }
    ];
  }

  if (src === "Settings") {
    return [
      { i: "👤", t: "Account", body: "Name, email, language.", next: "third" },
      { i: "🔒", t: "Privacy", body: "Visibility and data controls.", next: "third" },
      { i: "🔔", t: "Notifications", body: "Push, email, quiet hours.", next: "third" },
      { i: "♿", t: "Accessibility", body: "Contrast, font size, motion.", next: "fourth" },
      { i: "🎨", t: "Appearance", body: "Theme, icon size, density.", next: "fourth" },
      { i: "🌐", t: "Language", body: "Choose your preferred language.", next: "fourth" },
      { i: "🧭", t: "Navigation", body: "Bottom bar order and shortcuts.", next: "fifth" },
      { i: "🧾", t: "Data export", body: "Download a copy of your data.", next: "fifth" },
      { i: "🛡️", t: "Safety", body: "Report, block, and community rules.", next: "fifth" },
      { i: "🛟", t: "Help", body: "Support center and common issues.", next: "fifth" },
      { i: "🧪", t: "Advanced", body: "Beta features and labs.", next: "fifth" },
      { i: "ℹ️", t: ABOUT_TITLE, body: ABOUT_BODY, next: "third" }
    ];
  }

  if (src === "Home" || src === "Explore" || src === "Support" || src === "Messages" || src === "Events" || src === "Profile") {
    return [
      { i: "ℹ️", t: ABOUT_TITLE, body: ABOUT_BODY, next: "third" },
      { i: "📋", t: "Shortcuts", body: "Handy links for this section.", next: "third" },
      { i: "⭐", t: "Tips", body: "Ways to get more from this page.", next: "fourth" },
      { i: "❓", t: "FAQ", body: "Frequent questions and quick answers.", next: "fourth" },
      { i: "📣", t: "What is new", body: "Latest improvements and fixes.", next: "fifth" },
      { i: "🏅", t: "Motivation", body: "Track your progress and earn badges.", next: "fifth" }
    ];
  }

  return [];
}

/* ---------- Styles (unchanged) ---------- */
const styles = StyleSheet.create({
  appFrame: { flex: 1, margin: 8, borderRadius: 16, borderWidth: 2, borderColor: "#E8E1D8", overflow: "hidden", backgroundColor: brand.bg },
  headerRow: { paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: brand.header, borderBottomWidth: 1, borderBottomColor: brand.headerBorder },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brandTitle: { fontSize: 22, fontWeight: "900", marginLeft: 6, color: brand.active },
  headRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  headBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  aiChip: { backgroundColor: brand.blue, paddingHorizontal: 10, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  addBtn: { backgroundColor: brand.yellow, width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  ratioRow: { flexDirection: "row", gap: 8, paddingHorizontal: 10, paddingTop: 6 },
  ratioTileLeft: { flex: 1, backgroundColor: "#F1FBF6", borderWidth: 2, borderColor: "rgba(32,184,106,0.35)", borderRadius: 14, padding: 10, overflow: "hidden" },
  ratioTileRight:{ flex:1, backgroundColor:"#FEF1EF", borderWidth:2, borderColor:"rgba(212,75,62,0.35)", borderRadius:14, padding:10, overflow:"hidden" },
  tileHead: { flexDirection: "row", alignItems: "center" },
  tileIcon: { fontSize: 14, marginRight: 6 },
  tileTitle: { fontWeight: "900", color: brand.active, marginRight: 8 },
  tilePctPill:{ paddingHorizontal:8, height:22, borderRadius:11, backgroundColor:"rgba(32,184,106,0.12)", borderWidth:1, borderColor:"rgba(32,184,106,0.4)", alignItems:"center", justifyContent:"center" },
  tilePctText:{ fontWeight:"900", color:brand.green, fontSize:12 },
  tileBarWrap:{ height:8, backgroundColor:"#FFFFFF", borderRadius:6, marginTop:8, overflow:"hidden", borderWidth:1, borderColor:"#E6E6E6" },
  tileBarFillGreen:{ height:"100%", backgroundColor:brand.green },
  tileBarFillRed:{ height:"100%", backgroundColor:brand.red },
  avatarRowClip:{ flexDirection:"row", marginTop:8, paddingRight:6, paddingLeft:2 },
  avatarStack:{ width:28, height:28, borderRadius:14, borderWidth:2, borderColor:"#fff" },
  avatarOverlap:{ marginLeft:-8 },

  h1:{ fontSize:24, fontWeight:"900", color:brand.ink },
  h2:{ fontSize:18, fontWeight:"900", color:brand.ink },
  p:{ color:brand.soft, lineHeight:18 },
  sub:{ color:brand.soft, marginBottom:6 },

  gpsChipInline:{ alignSelf:"flex-start", flexDirection:"row", alignItems:"center", paddingHorizontal:12, height:34, borderRadius:17, backgroundColor:"rgba(255,255,255,0.55)", borderWidth:1, borderColor:"#E0E0E0" },

  groupCard:{ flexDirection:"row", backgroundColor:"#fff", padding:10, borderRadius:14, marginBottom:10, alignItems:"center", borderWidth:1, borderColor:"#EFE8DE", justifyContent:"space-between" },
  groupImg:{ width:60, height:60, borderRadius:12 },
  joinPill:{ height:36, paddingHorizontal:16, backgroundColor:"#111", borderRadius:14, alignItems:"center", justifyContent:"center" },
  joinLabel:{ color:"#fff", fontWeight:"900" },

  blockCard:{ backgroundColor:"#fff", borderRadius:14, borderWidth:1, borderColor:"#EFE8DE", padding:12, marginBottom:10 },

  profileCard:{ backgroundColor:"#fff", borderRadius:14, borderWidth:1, borderColor:"#EFE8DE", padding:12, marginTop:8 },

  primaryBtn:{ backgroundColor:brand.active, height:44, borderRadius:12, alignItems:"center", justifyContent:"center" },
  iconChip:{ flexDirection:"row", alignItems:"center", gap:6, paddingHorizontal:12, height:32, borderRadius:16, backgroundColor:"#F6F6F6", borderWidth:1, borderColor:"#E7E7E7", marginRight:8, marginBottom:8 },
  iconChipText:{ fontWeight:"800", color:"#0F1720", fontSize:12 },
  actionsRow:{ flexDirection:"row", flexWrap:"wrap", alignItems:"center" },

  tabs:{ position:"absolute", bottom:0, left:0, right:0, height:78, backgroundColor:"#FAF7F3", borderTopWidth:1, borderTopColor:"#E8E1D8", flexDirection:"row", justifyContent:"space-around", alignItems:"center" },
  tabBtn:{ alignItems:"center" },
  tabIconWrap:{ width:44, height:34, borderRadius:10, alignItems:"center", justifyContent:"center" },
  tabLabel:{ fontSize:12, color:brand.soft, marginTop:2 },

  overlay:{ flex:1, backgroundColor:"rgba(0,0,0,0.35)", alignItems:"center", justifyContent:"center", padding:16 },
  cardModal:{ width:"92%", backgroundColor:"#fff", borderRadius:18, padding:16 },
  input:{ height:44, borderRadius:10, borderWidth:1, borderColor:"#E0E0E0", paddingHorizontal:12, backgroundColor:"#FFFFFF", marginBottom:8 },

  iconGrid:{ flexDirection:"row", flexWrap:"wrap", gap:12, marginTop:12 },
  iconTile:{ width:110, paddingVertical:12, borderRadius:12, alignItems:"center", justifyContent:"center", backgroundColor:"#FAFAFA", borderWidth:1, borderColor:"#E9E9E9", marginHorizontal:6 },

  aiGrid:{ flexDirection:"row", flexWrap:"wrap", gap:8, justifyContent:"space-between", marginBottom:8 },

  membersGrid:{ flexDirection:"row", flexWrap:"wrap", gap:10, marginTop:6 },

  memberTile:{ width:"47%", backgroundColor:"#FFFFFF", borderWidth:1, borderColor:"#EDE7DE", borderRadius:14, paddingVertical:8, paddingHorizontal:48, position:"relative", alignItems:"center", justifyContent:"center", overflow:"hidden" },
  sideActionAbs:{ position:"absolute", top:"50%", marginTop:-14, width:28, height:28, alignItems:"center", justifyContent:"center" },
  badge:{ width:28, height:28, borderRadius:14, alignItems:"center", justifyContent:"center", borderWidth:2, borderColor:"#FFFFFF" },
  badgeText:{ color:"#FFFFFF", fontWeight:"900", fontSize:16 },
  memberCenter:{ alignItems:"center" },
  memberAvatar:{ width:48, height:48, borderRadius:24 },

  fab:{ position:"absolute", width:54, height:54, borderRadius:27, backgroundColor:brand.yellow, alignItems:"center", justifyContent:"center" },
  quickAI:{ position:"absolute", width:54, height:54, borderRadius:27, backgroundColor:brand.blue, alignItems:"center", justifyContent:"center" }
});
