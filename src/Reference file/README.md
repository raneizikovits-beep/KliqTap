# KLIQMIND — AUTH FIX README
# AUTH_EXPIRED Bug: Complete Solution Guide
# ═══════════════════════════════════════════════════════════════════

## ROOT CAUSE

The client was sending the NestJS JWT (api.kliqtap.com)
directly to the Python AI server (api.kliqmind.com:8000).
Python didn't share the JWT secret → returned 401 → client threw AUTH_EXPIRED.

```
Client ──JWT──▶ api.kliqmind.com:8000  ← Python says "who signed this? REJECT"
```

---

## SOLUTION A — Proxy via NestJS  ✅ RECOMMENDED

```
Client ──JWT──▶ api.kliqtap.com/ai/* ──internal──▶ localhost:8000
                    NestJS (trusts JWT)              Python (trusts NestJS)
```

### Files to deploy

| File | Action | Destination |
|------|--------|-------------|
| solution_A/ai.controller.ts | CREATE | server/src/ai/ai.controller.ts |
| solution_A/ai.module.ts | CREATE | server/src/ai/ai.module.ts |
| solution_A/app.module.PATCH.ts | MERGE | server/src/app.module.ts |
| solution_A/auth_middleware.py | REPLACE | server/ai_server/auth_middleware.py |
| solution_A/useAiStore.js | REPLACE | client/src/store/useAiStore.js |
| solution_A/.env.example | MERGE | server/.env AND server/ai_server/.env |

### Steps

1. Copy `ai.controller.ts` and `ai.module.ts` into `server/src/ai/`
2. In your `app.module.ts`: add `import { AiModule }` and add `AiModule` to the imports array
3. Add the two env vars to `server/.env`:
   ```
   AI_INTERNAL_URL=http://192.168.1.60:8000
   AI_INTERNAL_SECRET=<random 32-byte hex>
   ```
4. Add to `server/ai_server/.env`:
   ```
   AI_INTERNAL_SECRET=<same secret>
   ```
5. Replace `auth_middleware.py` in Python with the Solution A version
6. Replace `useAiStore.js` in the client with the Solution A version
7. Restart both servers

### Pros & Cons
- ✅ Python stays simple — no JWT logic at all
- ✅ Port 8000 stays private (never exposed to the internet)
- ✅ Only NestJS talks to Python — clean separation
- ⚠️  Adds one extra network hop (negligible on LAN)

---

## SOLUTION B — Shared JWT Secret

```
Client ──JWT──▶ api.kliqmind.com:8000
                    Python (now knows the NestJS JWT secret → can verify)
```

### Files to deploy

| File | Action | Destination |
|------|--------|-------------|
| solution_B/auth_middleware.py | REPLACE | server/ai_server/auth_middleware.py |
| solution_B/main.py.patch | PATCH | server/ai_server/main.py |
| solution_B/.env.example | MERGE | server/ai_server/.env |
| solution_B/useAiStore.js | NO CHANGE | (reference copy only) |

### Steps

1. Find `JWT_SECRET` in `server/.env`
2. Add it to `server/ai_server/.env`:
   ```
   JWT_SECRET=<exact same value>
   JWT_ALGORITHM=HS256
   ```
3. Replace `auth_middleware.py` with the Solution B version
4. In `main.py`, replace the old auth dependency with `get_current_user_id` from the new middleware (see `main.py.patch`)
5. Install PyJWT: `pip install PyJWT python-dotenv`
6. Restart the Python server

### Pros & Cons
- ✅ No changes to client or NestJS
- ✅ Fewer moving parts
- ⚠️  JWT_SECRET must be kept in sync between two servers
- ⚠️  Port 8000 is still exposed via Cloudflare Tunnel — anyone with a valid NestJS token can hit it directly

---

## QUICK DECISION

| | Solution A | Solution B |
|-|-----------|-----------|
| Client changes? | Yes (2 lines) | No |
| NestJS changes? | Yes (1 new module) | No |
| Python changes? | Yes (auth only) | Yes (auth only) |
| Security | ⭐⭐⭐ Best | ⭐⭐ Good |
| Simplicity | Medium | Simple |

**If in doubt → choose Solution A.** It's more secure and gives you a single entry point for all APIs.
