# KliqTap — Strategic Roadmap to World-Class

A practical, prioritized plan for evolving KliqTap from "feature-complete prototype" to a product that holds its own next to Instagram, Telegram, and Discord on quality. Written in execution order — each phase is shippable on its own.

---

## Phase 0 — Stop the bleeding (this week)

These are the items from the audit that block a safe production launch. None of them require new tech; they just need to be done.

| # | Action | Files | Effort |
|---|---|---|---|
| 1 | Replace all `http://192.168.1.60:3000` with `fetchAPI` | `AlertsScreen.js`, `AdminNoticeScreen.js` | 2 hours |
| 2 | Move admin authentication server-side; remove client PIN | `AdminNoticeScreen.js` + server | 1 day |
| 3 | Fix `handlePurgeTokens` (use real `expo-secure-store` import) | `AuthScreen.js` | 10 minutes |
| 4 | Apply per-attempt timeout in `api.ts` | `api.ts` | already done — see refactored file |
| 5 | Strip console statements in production builds | `babel.config.js` | 5 minutes (add `transform-remove-console`) |
| 6 | Move `webClientId` and `API_BASE_URL` into `.env` | `app.config.ts`, `api.ts`, `authSlice.js` | 1 hour |

**Acceptance check:** `grep -r "192\.168\|http://" client/src/` returns zero results, and `react-native bundle --dev false` produces a bundle with no `console.*` calls remaining.

---

## Phase 1 — Performance foundation (week 2)

Goal: app feels native-fast on a mid-tier Android device (Samsung A24, ~$200 USD).

### 1.1 Convert all screens to optimized selectors

Use the patterns from `storeSelectors.js`. Target: zero `useAppStore()` without arguments anywhere except the slice files themselves.

**Measurable goal:** in React DevTools Profiler, sending one chat message should re-render fewer than 5 components total. (Currently it re-renders every screen subscribed to the store.)

### 1.2 Introduce TanStack Query for server state

Right now `useAppStore` carries 8+ `is*Loading` flags and ad-hoc cache fields (`posts`, `groups`, `notifications`, `leaderboard`, `radarResults`, `featuredCards`, `liveZones`, `trendingTopics`, `trendingCommunities`). All of these are **server state**, and Zustand is the wrong tool for them.

**Migration path:**

```ts
// Before — in useAppStore:
fetchPosts: async (reset, feed) => { /* 30 lines of state juggling */ }

// After — in useExploreFeed.ts:
export const useExploreFeed = () =>
  useInfiniteQuery({
    queryKey: ['posts', 'foryou'],
    queryFn: ({ pageParam = 1 }) => fetchAPI(`/posts?page=${pageParam}`),
    getNextPageParam: (last) => last.hasMore ? last.nextPage : undefined,
    staleTime: 60_000, // don't refetch within 60s
  });
```

You get for free: request deduplication, background refetch, retry with exponential backoff, optimistic updates, infinite scroll, cache invalidation, devtools.

**Order to migrate:** posts → notifications → groups → leaderboard → explore. Keep Zustand for genuine client state (auth, settings, draft text, modal open/closed).

### 1.3 Image performance

Replace `<Image>` with `react-native-fast-image` for remote URLs (memory cache, less GC pressure on scroll). For local assets, keep `Image`. Single line per replacement.

### 1.4 List performance audits

Run `react-native-flash-list` benchmarks on the 3 longest lists: `MessagesScreen`, `AlertsScreen`, `ExploreScreen`. FlashList typically yields 2–3× the FPS of FlatList on long lists with heterogeneous rows. If migration is heavy, at minimum:

* `getItemLayout` where rows have fixed heights
* `removeClippedSubviews={true}` on Android
* `windowSize={5}` (already done in some places — propagate)

### 1.5 Bundle splitting

The admin screen (`AdminNoticeScreen.js`, 530 lines + admin-only assets) ships in every bundle. Lazy-load it:

```ts
const AdminNoticeScreen = lazy(() => import('./screens/AdminNoticeScreen'));
```

Estimated bundle reduction: 30–50 KB gzipped, plus the admin code is no longer publicly readable until role-gated.

---

## Phase 2 — Architectural maturity (weeks 3–4)

### 2.1 TypeScript everywhere

Currently only `api.ts` is TypeScript. Migrate file-by-file. Order:

1. **Types module first** — `types/api.d.ts` describing the response shapes from the server. Even one file of typed responses immediately catches a class of bugs (e.g. `metadata.isDM` vs `metadata.is_dm`).
2. **Store slices next** — they're the integrity layer.
3. **Services next** — `pulse.service`, `authService`.
4. **Screens last** — leaf components, lower risk.

Use `strict: true` and `noUncheckedIndexedAccess: true` for genuinely safe types.

### 2.2 Extract `userSettings` into its own slice

```
store/
├── auth.slice.ts        # user, token, login/logout
├── settings.slice.ts    # userSettings, updateSetting, fetchSettings
├── social.slice.ts
├── chat.slice.ts
├── pulse.slice.ts
└── useAppStore.ts       # composes the slices
```

Settings should not be reset on logout (keeping darkMode is better UX), but auth state should. Today `set(initialGlobalState)` resets both.

### 2.3 Centralized error handling

Add a top-level `<ErrorBoundary>` in `AppRoot` and per-screen boundaries in `MainNavigator`. Capture to Sentry (or a self-hosted GlitchTip). On crash, show a friendly fallback that lets the user reload or navigate home.

### 2.4 Logger abstraction

Replace `console.*` with a logger module:

```ts
// utils/logger.ts
export const log = {
  info: (...a) => __DEV__ && console.log('[KQ]', ...a),
  warn: (...a) => __DEV__ && console.warn('[KQ]', ...a),
  error: (msg, err) => {
    if (__DEV__) console.error('[KQ]', msg, err);
    Sentry.captureException(err, { extra: { msg } });
  },
};
```

### 2.5 Form validation layer

Currently `AuthScreen` does field validation by hand (`if (!email || !password)`). Adopt Zod + react-hook-form:

```ts
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(64),
});
```

Eliminates an entire class of "I forgot to validate that field on the client" bugs.

---

## Phase 3 — Design system & UX polish (month 2)

### 3.1 Design tokens

Brand values are scattered across `Data.brand.blue`, hardcoded `'#3F51B5'`, `'#102A43'`, `Data.brand.red + '40'`, etc. Consolidate:

```ts
// theme/tokens.ts
export const tokens = {
  color: {
    primary: { 50: '#EAF2FF', ... 900: '#0A2A5C' },
    accent:  { ... },
    semantic: { success: '#10B981', warning: '#F59E0B', danger: '#EF4444' },
    surface: { light: '#FFFFFF', dark: '#1C1C1E' },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32 },
  radius:  { sm: 8, md: 12, lg: 16, xl: 20, full: 9999 },
  type: {
    display: { fontSize: 28, fontWeight: '900', lineHeight: 34 },
    h1: { ... }, h2: { ... }, body: { ... }, caption: { ... },
  },
};
```

This is a precondition for any serious dark-mode contrast audit.

### 3.2 Skeleton screens

Replace `<ActivityIndicator size="large" />` with content-shaped skeletons. For a feed, that's a stack of grey rectangles in roughly post-card geometry. Perceived load time drops ~30% at no real cost. Library: `react-native-skeleton-placeholder`.

### 3.3 Haptics & micro-interactions

* Tap → `Haptics.selectionAsync()` on key buttons (Speed Dial, send message)
* Pull-to-refresh complete → `Haptics.notificationAsync(Success)`
* Long-press to delete → `Haptics.impactAsync(Medium)`

These are 10-second additions that make the app feel like Instagram, not like a hackathon project.

### 3.4 Empty states

Every empty state currently is "📭 No messages" or "No tribes found". Upgrade to illustrative empty states: a small illustration, a one-sentence empathetic copy, and a clear primary action. Especially valuable on first run when *every* screen is empty.

### 3.5 Onboarding redesign

`OnboardingScreen` asks one open-ended question. Conversion would improve dramatically with a 3-step flow:

1. Pick 3 interests (visual chips)
2. Set vibe / mood
3. Optional location grant with clear value-prop ("see groups within walking distance")

Each step shows progress, each step is skippable. The free-text intent box stays as a final optional step for power users.

---

## Phase 4 — Scalability & production resilience (month 3)

### 4.1 Observability

* **Crash reporting:** Sentry (free tier covers a startup).
* **Performance:** Sentry Performance for React Native — gives you a frame-by-frame view of janky screens.
* **Server:** structured logs with request IDs, traced through to client (return `X-Request-Id` from API and surface it in Sentry context).

### 4.2 Feature flags

LaunchDarkly is overkill at this stage; use a simple server-driven JSON:

```ts
const flags = useFlags();
if (flags.vibeRoulette) { /* show button */ }
```

Lets you turn features off in production without an app-store roundtrip.

### 4.3 Push notifications properly

Current `notifications` boolean in settings probably doesn't yet wire to APNs/FCM. When you do:

* Use Expo's push service (free, abstracts both platforms).
* Server should track `expo_push_token` per device, with revocation on logout.
* Respect quiet hours (ties into existing `motoReminders`/`suppReminders` UX).

### 4.4 Offline-first queue

Right now if a user drafts a message in low signal, the send just fails. With TanStack Query + `react-native-mmkv`, you get:

* Drafts persist across app kills.
* Failed mutations queue and retry when connectivity returns.
* Optimistic UI is durable, not vibes-based.

### 4.5 i18n

`ChatScreen` hardcodes Hebrew locale (`'he-IL'`). The user base is Filipino and (presumably) Hebrew-speaking. Adopt `i18next` + `react-i18next`. Even if you only ship English at first, the discipline of pulling strings out into `en.json` makes the next language a 1-day task instead of a 1-month task.

---

## Phase 5 — Differentiation (month 4+)

This is where KliqTap stops resembling other apps.

### 5.1 Lean into the AI angle

`KliqMind AI` is mentioned everywhere. Make it real:

* **Conversational vibe-tagging.** Instead of picking from a fixed `STANDARD_VIBES` list, let the user say "feeling bittersweet about leaving Davao" and have the AI propose tags. Stored on the post; users can search by inferred vibe.
* **Tribes recommendation that explains itself.** "We suggest *Cebu Hikers* because 4 people you follow are members and you recently posted about Mt. Manunggal." That kind of reasoning is what TanStack Query's typed responses + an LLM-summary endpoint give you cheaply.
* **Multilingual empathy.** Given the brand's Bisaya/Tagalog/English heritage, AI replies that match the user's language register would be a real edge over Western-centric apps.

### 5.2 Stories that aren't just photos

The "Pulse" concept is more interesting than Instagram Stories — *if* you commit to it. Pulses could be:

* A 3-word vibe + a 5-second voice clip (Spotify-meets-BeReal).
* A live "I'm here" pin on the map for 1 hour.
* A pulse that decays over 24h but leaves a trace in your "year in review".

The UI for the first two is mostly there already (`pulse.service.js`, the camera, geolocation). The product moment is committing to "Pulses are the verb of this app".

### 5.3 Map as a first-class surface

Right now location is for "show on map" privacy toggles and GPS-based group discovery. A real differentiator: **the map IS the home screen as an option.** Tribes pinned where they meet. Live Pulses as floating dots. Filter by interest. This is what Snap Map became, but for community discovery.

### 5.4 Physical-world bridges

KliqTap is rooted in Cebu, in real travel, in real meetups. Lean into that:

* QR-code-based "tap to add" at meetups (the "Tap" in the brand is right there).
* Group "we're meeting at this café" with location + time, automatic check-in.
* Post-event AI summary ("12 people met, 4 new connections formed").

This is where the brand's actual story — connection across travel, language, culture — becomes the product, not just the marketing.

---

## Tech stack — final recommendation

| Layer | Today | Recommended | Rationale |
|---|---|---|---|
| Framework | Expo + RN | **Keep** | Right choice. Don't migrate. |
| Navigation | Custom tab + sheet system | Migrate to **React Navigation v7** | Industry standard; deep linking, back-button, accessibility for free. |
| State (client) | Zustand | **Keep** | Excellent for what it does. |
| State (server) | Zustand (incorrectly) | **TanStack Query v5** | Game-changing for fetch-heavy apps. |
| Forms | Hand-rolled | **react-hook-form + Zod** | Type-safe, less code, fewer bugs. |
| Lists | FlatList | **FlashList** for long ones | 2–3× perf on Android. |
| Images | Image | **expo-image** | Better caching, blurhash placeholders. |
| Crash reporting | None | **Sentry** | Non-negotiable in production. |
| Analytics | None | **PostHog** (open source, self-hostable) | Aligns with the "data sovereignty" brand. |
| i18n | Hardcoded Hebrew | **i18next** | English/Tagalog/Bisaya/Hebrew ready. |
| Backend (separate concern) | `https://api.kliqtap.com` | Continue, but: standardize on **OpenAPI spec → typed client** | Server schema becomes the contract; client types are generated. |
| Push | Not yet | **Expo Notifications** | Don't build APNs/FCM by hand. |
| Storage (offline) | None | **react-native-mmkv** + **TanStack Query persistence** | Truly offline-first chat & feed. |

---

## Closing thought

Most of this is not new code — it's *removing* code. The hardest version of "world-class" is the one where you delete things. The Zustand actions that should be TanStack queries. The console statements. The duplicate userSettings. The hardcoded admin PIN. The three different MIME-detection helpers. The 11 different ways screens subscribe to the store.

What remains after that pruning is genuinely good: a clean store, a real API client, a coherent design language, a brand that means something. The work to ship a world-class product from here is *less* than the work that's already gone in.
