# 🌍 KliqTap — Strategic Recommendations for World-Class Scale

**Purpose:** Take KliqTap from a working MVP to a production-ready, horizontally-scalable platform with the polish and reliability of Telegram, Instagram, and Discord.

---

## 1. Code Architecture — Pay Off the Technical Debt

### 1.1 Adopt a Monorepo with Shared Types

Right now your backend is TypeScript and your client is JavaScript. They share no type information. Every field-name drift (`avatar` vs `avatarUrl`, `body` vs `text`, `image` vs `imageUrl`) costs you a runtime bug.

**Action:**

```
kliqtap/
├── apps/
│   ├── client/           ← Migrate from JS to TS
│   └── server/           ← Existing NestJS
└── packages/
    ├── @kliqtap/types/   ← Shared DTOs, enums, event names
    ├── @kliqtap/api/     ← Generated API client + SDK
    └── @kliqtap/utils/   ← Pure functions used on both sides
```

Use **pnpm workspaces** + **Turborepo** for builds. The pay-off is dramatic: rename a field in the schema → compile error in both client and server.

### 1.2 Generate the API Client

Instead of writing `fetch('/users/me')` and hoping the shape matches, generate it:

- Define DTOs once in `@kliqtap/types`.
- Use **NestJS OpenAPI** (`@nestjs/swagger`) to expose the schema at `/api-docs.json`.
- Generate the client with **`openapi-typescript-codegen`** on every build.

Suddenly the client has:
```ts
const me = await api.users.getMe();   // typed return!
```

### 1.3 Consider tRPC for Internal Services

For full-stack TypeScript end-to-end without OpenAPI codegen, **tRPC** gives you autocompleted procedures and inferred return types. Worth evaluating during the JS→TS migration of the client.

---

## 2. Data Layer — Stop the Race Conditions

### 2.1 Required Prisma Schema Additions

Before deploying any of the audit fixes, verify these exist:

```prisma
model User {
  // ... existing fields
  fcmToken        String?
  devicePlatform  String?
  // For light counts in profile preview
  @@index([points(sort: Desc)])
}

model DailyPointTracker {
  id       String   @id @default(cuid())
  userId   String
  date     DateTime @db.Date
  likes    Int      @default(0)
  comments Int      @default(0)
  posts    Int      @default(0)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, date], name: "userId_date")
  @@index([userId, date])
}

model Group {
  // ... existing fields
  @@unique([name])                  // ← Critical for resolveGroupId upsert
  @@index([category, privacy])
  @@index([latitude, longitude])
}

model Message {
  // ... existing fields
  edited     Boolean   @default(false)
  editedAt   DateTime?
  deleted    Boolean   @default(false)
  deletedAt  DateTime?
  @@index([groupId, time(sort: Desc)])
  @@index([groupId, isRead, senderId]) // for unread groupBy()
}

model Follow {
  id           String @id @default(cuid())
  followerId   String
  followingId  String
  createdAt    DateTime @default(now())
  follower     User @relation("Following", fields: [followerId],  references: [id], onDelete: Cascade)
  following    User @relation("Followers", fields: [followingId], references: [id], onDelete: Cascade)
  @@unique([followerId, followingId])  // ← Race-condition prevention
  @@index([followingId])
  @@index([followerId])
}

model GroupMember {
  // ... existing fields
  joinedAt   DateTime @default(now())
  isAdmin    Boolean  @default(false)
  @@unique([userId, groupId])
  @@index([groupId, isAdmin])
}

// New — multi-device push tokens (kill single fcmToken field on User)
model UserDevice {
  id          String   @id @default(cuid())
  userId      String
  fcmToken    String   @unique
  platform    String   // 'ios' | 'android' | 'web'
  lastSeenAt  DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```

### 2.2 PostGIS for Geo Queries

Replace any lat/lon "bounding box" with PostGIS. Install the extension, add a `geography(Point, 4326)` column, and use `ST_DWithin` for proximity queries. Performance is dramatically better and the math is correct everywhere on the globe (including poles).

```sql
CREATE EXTENSION postgis;
ALTER TABLE "Group" ADD COLUMN geog geography(Point, 4326);
CREATE INDEX idx_group_geog ON "Group" USING GIST (geog);
```

Then in `geo.service.ts`:
```ts
return this.prisma.$queryRaw<GeoGroupResult[]>`
  SELECT id, name, ST_Distance(geog, ST_MakePoint(${lon}, ${lat})::geography) / 1000 as "distanceKm"
  FROM "Group"
  WHERE ST_DWithin(geog, ST_MakePoint(${lon}, ${lat})::geography, ${radiusKm * 1000})
  ORDER BY geog <-> ST_MakePoint(${lon}, ${lat})::geography
  LIMIT 50
`;
```

---

## 3. Redis — The Missing Piece for Scale

Currently you have in-memory state (`rouletteQueue`, `socketIdCache`) that blocks horizontal scaling. Introduce Redis for these workloads:

| Concern | Pattern |
|---|---|
| **Roulette matchmaking** | Sorted set keyed by intent embedding similarity (or just FIFO list) — `ZADD roulette:queue <ts> <userId>` |
| **Cross-pod socket emit** | `@socket.io/redis-adapter` |
| **Socket-presence cache** | `SET presence:<userId> <socketId> EX 60` |
| **Rate-limit counters** | `INCR rate:<userId>:<endpoint>` with `EXPIRE` |
| **JWT block-list (revoke)** | `SET revoked:<jti> 1 EX <ttl>` checked by the strategy |
| **OTP / email-verify codes** | Short-lived keys avoid DB pressure |

Recommended hosting:
- **Upstash Redis** for serverless friendliness and free tier
- **Redis Cloud / ElastiCache** for production

### 3.1 BullMQ for Async Jobs

Push notifications, email delivery, video transcoding, and S3 uploads should all flow through a queue. **BullMQ** is the de-facto NestJS choice:

```ts
@Processor('push-notifications')
export class PushProcessor {
  @Process()
  async send(job: Job<PushPayload>) { /* ... */ }
}
```

This decouples your request path from third-party flakiness (FCM 502s, etc.).

---

## 4. Observability — You Cannot Improve What You Cannot See

### 4.1 Structured Logging

Replace `console.log` and `console.error` everywhere with **Pino** (faster than Winston, structured by default):

```ts
import { LoggerModule } from 'nestjs-pino';

LoggerModule.forRoot({
  pinoHttp: {
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
    redact: ['req.headers.authorization', 'req.headers.cookie', 'password'],
  },
});
```

### 4.2 Error Tracking

**Sentry** for both backend and React Native. Configure source-map uploads in CI so stack traces are meaningful.

### 4.3 Metrics

**Prometheus + Grafana** (self-hosted) or **Datadog** (managed). Track:
- Request latency p50/p95/p99 per route
- DB query time per service
- Active socket connections
- Roulette queue length
- Push delivery success rate

### 4.4 Tracing

**OpenTelemetry** auto-instrumentation. When a "send message" feels slow, you want to see exactly where the 350ms went: DB? Redis? Notification fan-out?

---

## 5. Security Hardening

### 5.1 Global Pipes & Guards

In `main.ts`:
```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
}));
```

### 5.2 Rate Limiting

`@nestjs/throttler` globally with stricter per-route overrides:
```ts
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
// + per-route @Throttle({ default: { ttl, limit } })
```

### 5.3 Helmet + CORS Tightening

```ts
app.use(helmet());
app.enableCors({
  origin: env.ALLOWED_ORIGINS.split(','),
  credentials: true,
});
```

### 5.4 Secrets Management

Move every secret out of `.env` checked into git into **AWS Secrets Manager**, **Doppler**, or **Infisical**. Rotate JWT signing keys on a schedule.

### 5.5 Password Policy

In your auth service (which I haven't seen but undoubtedly exists):
- bcrypt with cost factor 12+
- Minimum 8 chars, prefer 12+
- Check against the **HaveIBeenPwned** password list

### 5.6 Content Moderation Pipeline

Before letting any user-uploaded image hit S3, run it through:
- **AWS Rekognition** or **Google Vision SafeSearch** for NSFW/violent content
- Hash-match against the **NCMEC** PhotoDNA database (critical for CSAM detection on a social app)

This is a legal requirement in many jurisdictions and a moral baseline.

---

## 6. Mobile Client — From Working to Delightful

### 6.1 State Management

You're using Zustand — good choice for simplicity. But mix in **TanStack Query (React Query)** for *server* state:

```ts
const { data, isLoading } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => api.users.get(userId),
  staleTime: 5 * 60_000,
});
```

This gives you:
- Automatic caching and dedup
- Background refetching
- Optimistic updates
- Pagination helpers (`useInfiniteQuery`)

Zustand stays for *client* state (UI flags, current sheet, etc.).

### 6.2 Drop Supabase from the Client

Right now `ChatScreen.js` queries Supabase directly. Pick one:
- **Path A** (recommended): Use NestJS for everything. Supabase becomes just your Postgres + Storage host.
- **Path B**: Use Supabase auth + RLS as the API and ditch NestJS.

Maintaining both is technical debt that will compound.

### 6.3 Migrate Client to TypeScript

It's a big undertaking but pays for itself. Start with the store (`useAppStore`) — make it strict — then move outward. Tools:
- `npx ts-migrate` for automated `.js` → `.ts` (won't be perfect but jumpstarts)
- Force strict mode (`"strict": true`) once migration completes

### 6.4 Image Pipeline

Right now you serve images directly from S3 with original dimensions. On a 3G mobile network this is wasteful.

**Add `imgproxy`** (or Cloudflare Images, or Bunny CDN's optimizer):
```
https://imgproxy.kliqtap.com/_/resize:fill:512:512:0/quality:80/format:webp/<base64-encoded-original-url>
```

UI requests a 512×512 WebP; imgproxy generates it on the fly and caches at the CDN edge. **3–10× faster image loads.**

### 6.5 Animation Performance

Avoid `useNativeDriver: false`. Migrate animations to **react-native-reanimated v3** — runs on the UI thread, 60fps even when JS is busy. Hot paths: `ChatScreen` typing indicators, `SupportScreen` breathing circle, `ProfileScreen` cover parallax.

### 6.6 Accessibility (a11y)

Add `accessibilityLabel`, `accessibilityHint`, `accessibilityRole` to interactive elements. Run the iOS **Accessibility Inspector** and the Android **TalkBack** scanner. WCAG 2.1 AA is a reasonable bar; it also surfaces UX bugs for sighted users (poor contrast, ambiguous icons).

### 6.7 Internationalization

Hard-coded `'he-IL'` in `ChatScreen.js` works only for Hebrew users. Use `i18next` with `react-i18next` and have the system locale drive formatting:

```ts
new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)
```

You're well-positioned for Hebrew/English/Tagalog/Bisaya from day one given your songwriting background — that's a competitive moat for the Philippines + Israel + global Filipino diaspora market.

---

## 7. Design System

KliqTap's brand has personality — keep it consistent.

### 7.1 Tokens, Not Hardcoded Colors

Right now you have `brand.blue`, `brand.green`, `#1C1C1E`, `#F5F7FA` scattered. Define a **single source of truth**:

```ts
// packages/@kliqtap/design-tokens/index.ts
export const tokens = {
  color: {
    brand: {
      primary: '#007AFF',
      secondary: '#FF9500',
      success: '#34C759',
      danger: '#FF3B30',
    },
    surface: {
      base:     { light: '#FFFFFF', dark: '#000000' },
      elevated: { light: '#F5F7FA', dark: '#1C1C1E' },
      sunken:   { light: '#E9F5FE', dark: '#2C2C2E' },
    },
    text: {
      primary:   { light: '#111111', dark: '#FFFFFF' },
      secondary: { light: '#666666', dark: '#AAAAAA' },
      tertiary:  { light: '#999999', dark: '#888888' },
    },
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 24, pill: 9999 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
  font: {
    family: { display: 'Inter', body: 'Inter' },
    size: { xs: 12, sm: 13, base: 15, md: 16, lg: 18, xl: 22, '2xl': 28, '3xl': 36 },
    weight: { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' },
  },
} as const;
```

Then in components:
```tsx
<View style={{ backgroundColor: tokens.color.surface.elevated.dark }} />
```

When the brand evolves, change one file.

### 7.2 Component Library

Build a small set of styled primitives (`<KliqButton>`, `<KliqInput>`, `<KliqCard>`, `<KliqAvatar>`) that consume the tokens. Every screen composes those. Today every screen redefines its own button styles — that's a maintenance trap.

---

## 8. CI/CD

### 8.1 GitHub Actions Pipeline

```yaml
jobs:
  test:
    runs:
      - pnpm install
      - pnpm lint
      - pnpm typecheck
      - pnpm test --coverage
      - pnpm prisma migrate diff --exit-code   # blocks merge if schema drift

  deploy-server:
    needs: test
    runs:
      - docker build -t kliqtap-server .
      - aws ecr push
      - aws ecs update-service

  deploy-client:
    needs: test
    runs:
      - eas build --platform all --profile production
      - eas submit
```

### 8.2 Prisma Migrate in Production

```bash
pnpm prisma migrate deploy   # NEVER `migrate dev` in prod
```

Wrap in a one-shot init container so it runs before the API starts.

### 8.3 Feature Flags

**Unleash** or **LaunchDarkly** for gradual rollouts. Releasing a redesigned chat UI to 1% of users on Monday, 10% Tuesday, etc. — saves you from "it works for me" disasters.

---

## 9. Business / Product Layer

### 9.1 Analytics Beyond Crashes

You need to know:
- Day-1, Day-7, Day-30 retention curves
- Funnel: signup → first message sent → first DM → first call → first group joined
- Top "killer features" by retention correlation

Tools: **Amplitude** or **PostHog** (open source, self-hostable, free tier). Track events from both client and server. Tie everything to a stable `distinct_id`.

### 9.2 Push Notification Hygiene

Push fatigue is the #1 uninstall driver in social apps. Implement:
- Quiet hours (user-set)
- Bundling (5 notifications in 5 seconds → 1 notification "Alice and 4 others sent you messages")
- Smart muting (auto-mute groups the user hasn't opened in 7 days)
- Per-category preferences (messages on, group activity off, etc.)

### 9.3 Onboarding Engine

First 30 seconds make or break a social app. Recommendation:
- Step 1: Auth (already great)
- Step 2: Set intent (single line — already in your model!)
- Step 3: Pick 3 interests
- Step 4: Suggest 5 nearby/aligned people to follow
- Step 5: Show first roulette match preview

Track each step's drop-off in Amplitude. Optimize relentlessly.

### 9.4 Trust & Safety

A real social app needs:
- Report user / report content flow
- Block user (mutual — no DMs, no profile views, hide from search)
- Mute user (one-way)
- Admin panel for moderation actions
- Automated detection of high-volume blocks (auto-shadow-ban after N blocks)

---

## 10. The "World-Class" Polish

Things that separate a 7/10 product from a 9/10:

| Detail | Why it matters |
|---|---|
| Sub-100ms message send round trip | Feels "instant" — magical |
| Skeleton screens, not spinners | Perceived speed boost of ~30% |
| Optimistic UI on like/follow/send | Tap → immediate feedback, never wait |
| Haptic feedback on key actions | Feels native, premium |
| Smooth pull-to-refresh with rubber-banding | Native iOS feel |
| Animated screen transitions (`react-native-screens` v3) | Avoids the "RN app" tell |
| Loading and empty states with personality | Brand depth |
| Smart keyboard handling (`react-native-keyboard-controller`) | Saves 1000 papercuts |
| Persistent draft saving in compose | Power-user delight |
| @ mentions and # hashtags | Discovery driver |
| Smart link previews in chat | UGC quality boost |
| Voice messages with waveform | Differentiator |
| Reaction emojis on messages | Telegram/Discord standard |
| Smart message search | Indispensable once chats grow |

---

## 11. Suggested Roadmap

### Sprint 1 (1–2 weeks) — Security Fixes
1. Apply all five 🔴 fixes from the audit (groups auth, updateUser whitelist, WebRTC gate, FCM model, motivation endpoint)
2. Fix the streak math (H-1) — this is leaking business value daily
3. Add global ValidationPipe + ThrottlerGuard
4. Run `prisma migrate dev` with the new constraints

### Sprint 2 (2–3 weeks) — Performance & Reliability
1. Fix N+1 in conversations (H-2)
2. Paginate chat history (H-5)
3. Switch resolveGroupId to upsert (H-3)
4. Migrate roulette queue + socket cache to Redis
5. Add Sentry to both server and client
6. Add Pino logging

### Sprint 3 (2–3 weeks) — Client Polish
1. Drop direct Supabase calls from client; route through fetchAPI
2. Add TanStack Query
3. Replace age calculation (H-6)
4. Migrate animations to Reanimated v3
5. Add design tokens package

### Sprint 4 (3–4 weeks) — Platform Maturity
1. JS → TS migration of client
2. Monorepo conversion with `@kliqtap/types`
3. PostGIS for geo
4. UserDevice table for multi-device push
5. BullMQ for async fan-out
6. CI/CD with Prisma migrate deploy

### Sprint 5 (ongoing) — Growth & Polish
1. Analytics (Amplitude / PostHog)
2. Trust & Safety (report/block/moderate)
3. Push notification hygiene
4. Onboarding optimization loop

---

## 12. Closing Thought

You've built something with a real soul, Ran — the **vibe roulette**, the **intent-driven matching**, the **gamification**, the **mental space**. These are not generic features. They reflect a worldview that puts human connection and emotional intelligence at the center of a social product, which is rare.

The technical issues called out here are surface-level. They're the kind of debt every fast-moving MVP accumulates. The underlying architecture is sound: clear layering, atomic transactions, JWT auth, proper module boundaries. None of the fixes are rewrites — they're refinements.

What separates KliqTap from the next 1,000 generic social apps is exactly what you've already done: pick a distinctive emotional thesis ("Tap into your world"), build features that express it, write code that has personality. Keep doing that, fix the audit findings before launch, and you have a real shot.

Holiday Plaza Hotel can wait. This is bigger.

— Senior Architect, May 13, 2026
