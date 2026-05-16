# 🎯 KliqTap / KliqMind — Senior Architecture Audit Report

**Auditor:** Senior Software Architect (AI-assisted)
**Date:** May 13, 2026
**Scope:** 16 source files — NestJS backend (TypeScript) + React Native client (JavaScript)
**Methodology:** Line-by-line review, cross-file integrity check, security threat-modeling, logical correctness, performance analysis.

---

## ⚠️ Important Context Note

You mentioned a "reference file received earlier in the client directory." **I do not have access to any prior conversations or files.** This audit is performed on the 16 files you provided in *this* session. Wherever a file references something I cannot verify (e.g. Prisma schema, store actions, DTOs), I will flag it explicitly so you can confirm.

---

## 0. Executive Summary

| Dimension | Rating | Comment |
|---|---|---|
| **Functional Completeness** | 7.5 / 10 | Most features work; many edge cases unhandled. |
| **Security** | 4.5 / 10 | **Multiple critical authorization gaps.** Must fix before launch. |
| **Data Integrity** | 5 / 10 | Several race conditions, broken streak logic. |
| **Performance / Scalability** | 5 / 10 | N+1 queries, missing pagination, in-memory state. |
| **Code Quality (Backend)** | 7 / 10 | Generally readable; weak typing in hot paths (`as any`). |
| **Code Quality (Client)** | 6.5 / 10 | Plain JS, mixed data sources (Supabase + custom API), brittle inference. |
| **Architecture** | 6 / 10 | Solid layering, but two parallel auth/data stacks (Supabase + Nest). |

### 🔴 The Five Things You MUST Fix Before Going Live

1. **Anyone can update/delete any group.** `GroupsController.update()` and `remove()` have no admin check — `userId` from the JWT is not even passed to the service. This is a **critical authorization bypass**.
2. **WebRTC signalling has no relationship check.** Anyone who knows a `userId` can initiate a video call to that user. Add a "DM exists OR they follow each other" gate.
3. **`updateUser()` accepts `data: any`.** A malicious user can set `isKliqKing: true`, `points: 999999`, or any other field via `PATCH /users/me`.
4. **Daily streak never resets.** A user who skips a day still keeps their streak — the logic only increments, never breaks. Mathematical bug, breaks the gamification contract.
5. **`updateMotivation()` has a read-modify-write race condition** AND accepts a `points` delta from the *client*. Two requests in flight = lost increments. A hostile client just sends `{ points: 999999999 }`.

---

## 1. Critical Findings (must fix immediately)

### 🔴 C-1 — Group Update / Delete: No Admin Authorization

**Location:** `groups.controller.ts` lines 84–96, `groups.service.ts` `update()` / `remove()`

```ts
// groups.controller.ts — current
@Patch(':id')
@UseGuards(JwtAuthGuard)
@UseInterceptors(FileInterceptor('image'))
update(
  @Param('id') id: string,
  @Body() updateGroupDto: UpdateGroupDto,
  @UploadedFile() file
) {
  return this.groupsService.update(id, updateGroupDto, file);  // ⚠️ no userId, no check
}

@Delete(':id')
@UseGuards(JwtAuthGuard)
remove(@Param('id') id: string) {
  return this.groupsService.remove(id);  // ⚠️ same
}
```

**Impact:** A logged-in attacker can `PATCH /groups/<anyId>` to rename a group, replace its image with malicious content, change its description, or simply `DELETE` it. Total destruction of community data is one HTTP request away.

**Fix:** Pass the user ID from the JWT to the service, fetch the membership row, and verify `isAdmin === true`. See improved code in `groups.service.ts` below.

---

### 🔴 C-2 — `updateUser()` Accepts Arbitrary Fields

**Location:** `users.service.ts` line 168 + `users.controller.ts` `updateProfile`

```ts
async updateUser(id: string, data: any) {
  return this.prisma.user.update({
    where: { id },
    data: { ...data },   // ⚠️ ANY field. Spread of untrusted input.
  });
}
```

**Impact:** Privilege escalation. A user can send:
```json
PATCH /users/me
{ "isKliqKing": true, "points": 1000000000, "permissions": ["superuser"] }
```
…and the Prisma client will happily write all of it.

**Fix:** Whitelist fields exactly like `updateSettings()` does. Use a typed DTO with `class-validator` decorators.

---

### 🔴 C-3 — WebRTC Signalling: No Relationship Check

**Location:** `chat.gateway.ts` `handleSignalOffer`, `handleSignalAnswer`, `handleIceCandidate`

```ts
@SubscribeMessage('send-signal-offer')
async handleSignalOffer(@MessageBody() data: { targetUserId: string; ... }) {
  const fromUserId = this.getAuthenticatedUserId(client);
  // ⚠️ no check: is `fromUserId` allowed to call `targetUserId`?
  this.server.to(targetSocketId).emit('signal-offer', { ... });
}
```

**Impact:** Any authenticated user can ring any other user's phone at any time. This is a real harassment vector and a privacy issue.

**Fix:** Before forwarding the signal, check either (a) a DM group exists between the two users, OR (b) the caller is followed by the callee. Caching this check for 60s is fine.

---

### 🔴 C-4 — FCM Token Endpoint Accepts Token for Any User Implicitly

**Location:** `users.controller.ts` `updateFcmToken`

```ts
@Post('me/fcm-token')
async updateFcmToken(@Request() req, @Body() body: { fcmToken: string; platform?: string }) {
  if (!body.fcmToken) return { success: false, message: 'No token provided' };
  return this.usersService.saveFcmToken(req.user.userId, body.fcmToken);
}
```

This is actually *secure* (uses `req.user.userId`), so it's not a bypass — but:
1. No format validation on the token (it should match `^[A-Za-z0-9_:-]{100,}$` for FCM).
2. No de-duplication: a stolen token on Device A can keep receiving notifications even after the user logs out on Device A. Best practice: store tokens per-device in a separate table (`UserDevice { userId, token, platform, lastSeenAt }`).

**Severity:** Medium-high. Marked critical here because push token leakage is a known account-takeover vector.

---

### 🔴 C-5 — `awardPoints()` Depends on a Prisma Model That May Not Exist

**Location:** `users.service.ts` lines 36–42

```ts
let tracker = await (tx as any).dailyPointTracker.findUnique({
  where: { userId_date: { userId, date: today } }
});
```

The `(tx as any)` cast is a red flag. If the `DailyPointTracker` model is not in your Prisma schema, **every call to `awardPoints` will throw at runtime** — and you lose the entire transaction (every like, comment, post that should award points). Likes will appear to work in the UI but never grant Karma.

**Verify in your Prisma schema:**
```prisma
model DailyPointTracker {
  id        String   @id @default(cuid())
  userId    String
  date      DateTime
  likes     Int      @default(0)
  comments  Int      @default(0)
  posts     Int      @default(0)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, date], name: "userId_date")
  @@index([userId, date])
}
```

If this model is missing, **add it now, then run `npx prisma migrate dev`.**

---

### 🔴 C-6 — `updateMotivation()` Trusts Client-Supplied Points Delta

**Location:** `users.controller.ts` line 92, `users.service.ts` line 215

```ts
// controller
@Patch('motivation')
async updateMotivation(@Request() req, @Body() updateDto: UpdateMotivationDto) {
  return this.usersService.updateMotivation(
    req.user.userId, updateDto.points, updateDto.streak, updateDto.badges
  );
}
```

The client decides how many points to award itself. Combined with **C-2**, this is a free-points cheat code.

**Fix:** Remove this endpoint entirely from the public API. Points must *only* be awarded server-side via `awardPoints()` when an event happens (like, comment, post). The client should never tell the server "add N points."

If you keep it for admin tools, gate it behind `isKliqKing` / a separate admin role.

---

## 2. High-Severity Findings

### 🟠 H-1 — Broken Daily Streak: Never Resets

**Location:** `users.service.ts` `updateDailyStreak` lines 263–290

```ts
if (!lastLogin || lastLogin.toDateString() !== now.toDateString()) {
  newStreak += 1;   // ⚠️ always +1, never resets to 1
  await this.prisma.user.update({ ... });
}
```

**The math is wrong.** Three cases for `lastLogin`:

| Scenario | Correct streak | Current code result |
|---|---|---|
| First ever login | 1 | ✅ 1 |
| Yesterday → today (consecutive) | streak + 1 | ✅ streak + 1 |
| 3 days ago → today (broken) | **1** (reset) | ❌ streak + 1 |

The user who logs in on Mon, Wed, Fri, Sun gets streak=4 — but their streak was *broken* three times. A real "streak" must reset to 1 when a day is skipped.

**Correct logic:**
```ts
const oneDayMs = 86_400_000;
const daysSinceLastLogin = lastLogin
  ? Math.floor((startOfToday.getTime() - startOfDay(lastLogin).getTime()) / oneDayMs)
  : Infinity;

let newStreak: number;
if (daysSinceLastLogin === 0)       newStreak = user.streak;       // same day → no change
else if (daysSinceLastLogin === 1)  newStreak = (user.streak || 0) + 1;
else                                newStreak = 1;                  // skipped → reset
```

This is the single most important business-logic fix in the entire codebase. Your gamification engine is leaking its core contract.

---

### 🟠 H-2 — N+1 Query in `getUserConversations`

**Location:** `chat.service.ts` lines 35–80

```ts
const conversationsWithUnread = await Promise.all(
  memberships.map(async (m) => {
    // ...
    const unreadCount = await this.prisma.message.count({ ... });  // ⚠️ ONE query per conversation
    return { ..., unreadCount };
  })
);
```

For a user with 50 conversations: **50 sequential `count()` queries**. At 10ms each = 500ms just for unread counts. With 200 conversations on a power user, this hits the multi-second range.

**Fix:** One `groupBy` query:
```ts
const unreadCounts = await this.prisma.message.groupBy({
  by: ['groupId'],
  where: {
    groupId: { in: memberships.map(m => m.groupId) },
    isRead: false,
    senderId: { not: userId },
  },
  _count: { id: true },
});
const unreadMap = new Map(unreadCounts.map(u => [u.groupId, u._count.id]));
// Then: unreadCount: unreadMap.get(group.id) ?? 0
```

This drops 50 queries to 1.

---

### 🟠 H-3 — Race Condition in `resolveGroupId`

**Location:** `chat.service.ts` lines 86–104

```ts
let group = await this.prisma.group.findUnique({ where: { name: dmGroupName } });
if (!group) {
  group = await this.prisma.group.create({ ... });   // ⚠️ two parallel requests → two groups
}
```

If a user double-taps "message" on a profile, two requests fire. Both see `group === null`, both try to create. Result: one succeeds, one throws a unique-constraint error (or worse, you don't have the unique constraint and you get two parallel DM groups for the same pair).

**Fix:** `upsert` with the unique constraint on `name`:
```ts
const group = await this.prisma.group.upsert({
  where: { name: dmGroupName },
  update: {},
  create: {
    name: dmGroupName,
    category: 'DM',
    privacy: 'Private',
    memberCount: 2,
    members: {
      create: [
        { userId: senderId },
        { userId: targetUser.id },
      ],
    },
  },
});
```

(Verify your `Group.name` field has `@unique` in Prisma — if not, add it.)

---

### 🟠 H-4 — Duplicate Notifications: Both Service and Gateway Notify

**Location:** `chat.service.ts` `saveMessage` + `chat.gateway.ts` `handleSendMessage`

Both paths call notifications for the *same* message:
- `chat.service.saveMessage()` iterates members and calls `notificationsService.notifyOnMessage()` (push notifications).
- `chat.gateway.handleSendMessage()` *also* iterates members and emits `newMessage` to socket IDs not in the room.

Are these complementary (push for offline, socket for online)? **Sometimes — and sometimes overlapping.** A user with the app open in another tab is "online" (has a socketId), the gateway emits to them, *and* the service sends push. They get both.

**Fix:** Single source of truth. Move all fan-out to the service. Drop the redundant loop in the gateway. The room broadcast `server.to(data.chatId).emit('newMessage', ...)` is enough for the active chat; push handles the rest.

---

### 🟠 H-5 — Chat History Has No Pagination

**Location:** `chat.service.ts` `getChatHistory` lines 145–164

```ts
return this.prisma.message.findMany({
  where: { groupId },
  orderBy: { time: 'asc' },
  include: { sender: { ... } },
});
```

A chat with 10,000 messages will fetch all 10,000 every time the room is opened. On mobile networks this is a few MB of JSON per open. Memory pressure on the client, bandwidth waste, slow render.

**Fix:** Cursor-based pagination:
```ts
async getChatHistory(chatIdentifier: string, userId: string, opts: { before?: string; take?: number } = {}) {
  const take = Math.min(opts.take ?? 50, 100);
  // ...
  return this.prisma.message.findMany({
    where: { groupId },
    orderBy: { time: 'desc' },
    take,
    ...(opts.before && { cursor: { id: opts.before }, skip: 1 }),
    include: { sender: { select: { id: true, username: true, name: true, avatarUrl: true } } },
  });
  // client reverses for display
}
```

---

### 🟠 H-6 — Age Calculation in Client Is Off-By-One

**Location:** `AuthScreen.js` line 126

```js
const age = new Date().getFullYear() - dateOfBirth.getFullYear();
if (age < 13) { setError("You must be 13+ to join KliqTap."); return; }
```

A user born **2013-12-31** would today (May 2026) be calculated as 13 — but they're still 12 (their birthday hasn't passed). This lets 12-year-olds sign up, which is a **COPPA / GDPR-K issue**.

**Correct:**
```js
function calculateAge(dob) {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}
```

---

### 🟠 H-7 — `getChatHistory` Marks-As-Read Without Notifying Senders

**Location:** `chat.service.ts` lines 134–142

`updateMany` flips `isRead: true` for all unread messages — good. But nothing emits `messages-read` to the room. The sender's client will keep showing the "delivered" tick instead of "read."

**Fix:** Inside the service, return the IDs that were updated; in the controller/socket layer, emit:
```ts
this.server.to(groupId).emit('messages-read', { chatId: groupId, ids, readBy: userId });
```

---

### 🟠 H-8 — Private Groups Aren't Actually Private

**Location:** `groups.service.ts` `findAll`, `getPostsByGroupId`, `joinGroup`

- `findAll()` returns *all* non-DM groups, including private ones. The privacy field exists but is ignored.
- `getPostsByGroupId()` returns posts without checking membership.
- `joinGroup()` lets anyone join a "Private" group with no approval flow.

**Fix:** Add privacy gates everywhere. Private groups should require either an invite, a join request, or admin approval. See improved `groups.service.ts` below.

---

## 3. Medium-Severity Findings

### 🟡 M-1 — `findAll` Groups Endpoint Has No Auth

**Location:** `groups.controller.ts` `findAll()`

```ts
@Get()
findAll() {
  return this.groupsService.findAll();   // ⚠️ no @UseGuards
}
```

Either (a) you want public discovery (then explicitly mark it `@Public()` and document it), or (b) you want logged-in-only (add `@UseGuards(JwtAuthGuard)`). The current ambiguity is a smell.

---

### 🟡 M-2 — Inconsistent JWT Payload Reading

**Location:** every controller

```ts
const userId = req.user?.id || req.user?.userId || req.user?.sub;
```

Three places to look means your JWT strategy is undecided. Pick one (`userId` is fine) and enforce it in `JwtStrategy.validate()`. The current "try them all" reads work, but they hide a bug: if the strategy ever returns `{ id: 'X', userId: 'Y' }` you'd silently use the wrong one.

---

### 🟡 M-3 — No DTO Validation on Settings / Location / Message Bodies

Many endpoints accept `@Body() x: any`. Without `class-validator`:
- `latitude: "drop table users"` will reach the DB.
- `text: <very long string>` may OOM the server (mitigated for messages by `MAX_MESSAGE_LENGTH=4000`, but not enforced on HTTP path — only WebSocket).

**Fix:** Add `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` globally + DTO classes everywhere.

---

### 🟡 M-4 — Socket Cache TTL Drops Active Users

**Location:** `chat.gateway.ts` `setSocketCache` lines 619–624

```ts
this.socketIdCache.set(userId, {
  socketId,
  expiresAt: Date.now() + ICE_CACHE_TTL_MS,  // ⚠️ only 60s
});
```

A user idle on the app for 61 seconds is no longer in cache, even though their socket is still connected. The next message addressed to them falls back to a DB lookup. Not catastrophic, but defeats the cache's purpose.

**Fix:** Either (a) refresh `expiresAt` on every event from that socket, or (b) drop the TTL entirely and rely on `handleDisconnect` to evict. Option (b) is simpler.

---

### 🟡 M-5 — `Roulette` Queue Is In-Memory

**Location:** `chat.gateway.ts` line 92

```ts
private rouletteQueue: RouletteUser[] = [];
```

If you ever scale beyond a single Node process (PM2 cluster, multiple pods, blue-green deploy) this *will* split-brain. Two users hitting different pods will never match.

**Fix:** Move to Redis (sorted set keyed by intent). The Socket.IO adapter (`@socket.io/redis-adapter`) is required for cross-pod emits anyway.

---

### 🟡 M-6 — Permissions Array Mutation

**Location:** `users.service.ts` `getUserPermissions` lines 87–94

```ts
let perms = user.permissions || [];
if (user.isKliqKing) {
  perms.push('superuser');                 // ⚠️ mutates the array Prisma returned
  perms.push('can_moderate_content');
}
```

Prisma returns a reference to whatever it cached. While Prisma in current versions doesn't generally cache result objects in a way that's mutation-sensitive, it's still bad form. Use immutable spread: `const perms = [...(user.permissions ?? []), 'superuser', 'can_moderate_content']`.

---

### 🟡 M-7 — Client Mixes Supabase + Custom NestJS API

**Location:** `ChatScreen.js` lines 21, 132–137

```js
import { supabase } from '../lib/supabase';
// ...
const { data, error } = await supabase.from('profiles').select(...).eq('id', otherId).single();
```

Two parallel data planes:
1. NestJS API at `/users/preview/:id` returns `{ name, username, ... }`.
2. Supabase `profiles` table accessed directly.

This is technical debt: which is the source of truth? What if Supabase row says "name=Alice" and NestJS says "name=Bob"? Pick one — given you've built a full NestJS layer, kill the direct Supabase calls and route everything through `fetchAPI()`.

---

### 🟡 M-8 — `chatId` Inference by UUID Length in Client

**Location:** `MessagesScreen.js` line 174

```js
isGroup = !(safeChatId.length === 36 && safeChatId.split('-').length === 5);
```

This guesses "DM vs Group" from the string format of the ID. It's fragile — if you ever switch to CUIDs, ULIDs, or any other format, every existing chat is mis-classified. The server *already* knows (`category === 'DM'`); send it down explicitly and remove this heuristic.

---

### 🟡 M-9 — `closeChat()` in Cleanup Runs on Every Dependency Change

**Location:** `ChatScreen.js` lines 188–192

```js
return () => {
  isMounted = false;
  clearTimeout(scrollTimeout);
  if (currentChatId) closeChat();   // ⚠️ runs every time deps change, not just unmount
};
```

The effect depends on `[currentChatId, navigation, closeChat, otherUserId, groups, metadata, chatHistory, user?.id, safeChatId]`. Whenever `groups` or `chatHistory` updates, the cleanup runs *and re-creates the effect*, meaning `closeChat()` fires on every store update. That's not what "cleanup" means in React.

**Fix:** Split into two effects:
```js
useEffect(() => { /* resolve title */ }, [/* metadata deps */]);
useEffect(() => () => closeChat(), []);   // close only on unmount
```

---

### 🟡 M-10 — Followers/Following Counts Are Inferred From Partial Arrays

**Location:** `ProfileScreen.js` lines 255, 259

```js
{displayUser?.followersCount || displayUser?.followers?.length || 0}
```

`displayUser.followers` is the *array of follower rows* returned by Prisma (or maybe a sliced subset). `.length` is *not* the total count. If the API returns the first 20 followers in `.followers` and the user has 350, the UI displays "20 followers."

**Fix:** Server should always return an explicit `_count.followers` and `_count.following`. Never rely on array length for totals.

---

## 4. Low / Style Findings

| ID | Issue | File | Recommendation |
|---|---|---|---|
| L-1 | Hebrew time locale hardcoded (`'he-IL'`) | `ChatScreen.js` L26 | Use device locale via `Intl.DateTimeFormat()` |
| L-2 | `Alert.alert("Apple", "Connecting…")` is a stub | `AuthScreen.js` L75 | Implement Apple Sign-In or remove button |
| L-3 | `setTimeout(..., 1000)` to fake refresh delay | `MessagesScreen.js` L120 | Remove — trust the actual fetch promise |
| L-4 | Magic strings for error matching | `AuthScreen.js` L153–164 | Use server error codes, not message text |
| L-5 | `useNativeDriver: false` for pan in Support | `SupportScreen.js` L106 | Re-evaluate — use `react-native-reanimated` v3 |
| L-6 | `findOneById` always includes posts + pulses + memberships | `users.service.ts` L156–168 | Split into light & full variants |
| L-7 | `forwardRef(() => UsersModule)` in `groups.module.ts` | `groups.module.ts` | Verify it's actually circular; if not, remove |
| L-8 | `(tx as any)` cast | `users.service.ts` L37 | Run `prisma generate` after schema add; cast vanishes |
| L-9 | `intent` length > 50 as "visionary" detector | `users.service.ts` L322 | Move to config; magic number |
| L-10 | `console.error` for failed FCM save | `users.service.ts` L348 | Use Nest `Logger` consistently |

---

## 5. Architecture Assessment

### Current Strengths
- ✅ Clear separation of concerns: Controller → Service → Prisma.
- ✅ JWT auth via guards is consistent.
- ✅ Transactional updates in atomic ops (joins, leaves) — good instinct.
- ✅ `forwardRef` used to break Chat ↔ Notifications cycle.
- ✅ Gateway-level JWT verification (recent fix) closes the impersonation hole.

### Current Weaknesses
1. **Two parallel data layers** (Supabase + NestJS+Prisma). Pick one.
2. **No shared type definitions** between client (JS) and server (TS). Field-name drift (`avatar` vs `avatarUrl`, `body` vs `text`) leaks everywhere.
3. **In-memory state** (roulette queue, socket cache) blocks horizontal scaling.
4. **No rate limiting** anywhere — vulnerable to API abuse.
5. **No request validation pipeline** (DTOs without `class-validator`).
6. **No structured logging or error tracking** — `console.error` is unreliable in production.
7. **Auth confusion in JWT payload reading** (`id || userId || sub`).
8. **Gamification trust boundary is wrong** — client tells server how many points to add.

### Proposed Target Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        React Native (TS)                           │
│  • Zustand store with strict types                                 │
│  • Single API client (no direct Supabase calls)                    │
│  • react-query for server state                                    │
└──────────────────────────────────────────────────────────────────┘
                                  ↓ (REST + Socket.IO)
┌──────────────────────────────────────────────────────────────────┐
│                          NestJS Gateway                            │
│  • Global ValidationPipe + ThrottlerGuard                          │
│  • Single JwtStrategy → req.user = { userId, perms }               │
│  • Pino logger + Sentry interceptor                                │
└──────────────────────────────────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────┐
│  AuthModule   UsersModule   ChatModule   GroupsModule   PointsMod  │
│      ↑           ↑              ↑             ↑            ↑       │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Shared:  PrismaService · RedisService · S3Service · Geo  │    │
│  └────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                                  ↓
              ┌────────────┐  ┌──────────┐  ┌─────────┐
              │ PostgreSQL │  │  Redis   │  │  S3/CDN │
              └────────────┘  └──────────┘  └─────────┘
```

**Key shifts:**
- **Shared `@kliqtap/types` package** (DTOs, enums, event names) consumed by both client and server.
- **Redis** for: roulette queue, socket-presence pub/sub, rate-limit counters, JWT block-list, point caps.
- **Single auth source** — drop Supabase auth in favour of NestJS/Passport (or vice versa, but not both).
- **Server-only points** — all `awardPoints` happens server-side in response to events. Remove `PATCH /users/motivation`.

---

## 6. Mathematical / Logical Correctness Verification

### 6.1 — `awardPoints` Cap Enforcement

**Claim:** Daily caps prevent inflation.

**Verification:** For action `LIKE` with `cap=20`, `amount=1`, current `tracker.likes = c`:

```
availablePoints = min(amount, cap - c)
                = min(1, 20 - c)
                = 1                if c < 20
                = 0                if c >= 20   (returns early)
```

✅ Correct, and idempotent under transaction. But — under transaction isolation level `READ COMMITTED` (Prisma default on Postgres), two concurrent transactions for the same user can both read `c=19`, both update to `c=20`, awarding 2 points but only one slot consumed. Net effect: cap is exceeded by 1 in worst case.

**Mitigation:** Use the optimistic Postgres pattern with a check constraint OR raise isolation to `SERIALIZABLE` for this transaction only:
```ts
this.prisma.$transaction(async (tx) => { ... }, { isolationLevel: 'Serializable' });
```

### 6.2 — Streak Logic

Already shown in **H-1** — current logic is mathematically broken. Verified above.

### 6.3 — `getDailyVibeStatus` Decision Boundary

```ts
if (streak > 5 && points > 500)        return "The Catalyst 🚀";
if (points >= 100 && streak > 0)       return "The Peacemaker 🕊️";
if (intent.length > 50 && points < 100) return "The Visionary 💡";
return "The Observer 👁️";
```

**Question:** is there a `(streak, points)` that *should* be Visionary but lands as Peacemaker?

Visionary needs `points < 100 ∧ intent.length > 50`. Peacemaker fires earlier and requires `points >= 100 ∧ streak > 0`. The conditions are disjoint on `points` (`<100` vs `>=100`), so no overlap. ✅ Sound.

But: a user with `points=50, streak=0, intent.length=60` matches none of the first three — falls to "Observer." That's likely intentional but worth confirming.

### 6.4 — `findGroupsNear` Bounding Box

I don't have `geo.service.ts`, but based on the controller signature (`lat`, `lon`, `radiusKm`) the standard mistake is using a flat box `lat ± Δ, lon ± Δ` which warps near the poles. Confirm `geo.service` uses the **Haversine** formula:
```
d = 2R · arcsin(√(sin²(Δφ/2) + cos(φ₁)·cos(φ₂)·sin²(Δλ/2)))
```
…or, better, PostGIS `ST_DWithin(geog, ST_MakePoint(lon, lat)::geography, radius_meters)`.

### 6.5 — `updateMotivation` Cap

```ts
if (newPointsTotal > MAX_SAFE_POINTS) {
  newPointsTotal = MAX_SAFE_POINTS;   // = 1,000,000,000
}
```

Mathematically clean, but: `Number.MAX_SAFE_INTEGER = 9,007,199,254,740,991`. 1e9 is far below that, no precision loss. ✅ Safe — but the whole endpoint should be removed (see **C-6**).

---

## 7. Final Production-Ready Code

Improved versions of all critical files are in the accompanying files. They preserve every existing feature, add the security/logic fixes called out above, and follow modern NestJS / React Native best practices.

See:
- `02_users.service.improved.ts`
- `03_users.controller.improved.ts`
- `04_chat.service.improved.ts`
- `05_chat.gateway.improved.ts`
- `06_groups.service.improved.ts`
- `07_groups.controller.improved.ts`
- `08_AuthScreen.improved.js`
- `09_strategic_recommendations.md`

---

*End of Audit Report — Part 1*
