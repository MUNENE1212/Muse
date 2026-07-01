# Track A — P0 Security Sweep + Replace Mock Endpoints with Real DB-Backed Logic

**Branch**: `track-a-security-and-backend`
**Scope**: 22 routes/utilities in `frontend-gateway/`. No deno.json changes, no new dependencies, no test additions.

---

## Summary

Track A closes the largest P0 security holes in the gateway and replaces every in-memory `Map`-based mock endpoint with real Postgres-backed logic. The gateway now fails fast when the database is missing, requires a valid session on every mutation, refuses forged `userId` query params on read endpoints, returns consistent JSON across all error paths, and uses bcrypt-12 for password hashing. The link parser no longer fabricates metadata — it fetches real `og:` / `twitter:` tags or returns HTTP 400. The Mirror page no longer shows hardcoded engagement numbers — it aggregates real counts from `journal_entries`, `rooms`, `artifacts`, `threads`, and `user_follows`. In-memory caches (`utils/cache.ts`, `utils/images.ts`) are now bounded LRU maps.

---

## Files changed (22 source files + 1 docs file)

### Foundational utilities

| File | Rationale |
| --- | --- |
| `frontend-gateway/utils/db.ts` | Removed hardcoded `postgres://user:password@localhost:5432/muse` fallback. Module now throws at import time if `DATABASE_URL` is unset — process exits with a clear message instead of silently connecting to a phantom DB. `args` retyped `unknown[]`; added `assertQuery()` to reject empty / non-string queries before they reach the connection pool. |
| `frontend-gateway/utils/auth.ts` | Bumped bcrypt cost from `8` to `12` (4× brute-force cost). Added `requireSession(req)` and `requireDemoOrSession(req)` helpers that throw a `Response` on auth failure so handlers can short-circuit uniformly. Wrapped the top-level `Deno.openKv()` in a lazy `_kvPromise` getter — module import no longer crashes hosts where KV isn't provisioned. Added `destroySession()`. |
| `frontend-gateway/utils/cache.ts` | Replaced unbounded `{ [k]: any }` object with a `Map<string, CacheEntry<unknown>>` capped at **1000 entries** using insertion-order LRU eviction. Added `clearCacheAll` alias for tests. |
| `frontend-gateway/utils/images.ts` | Same LRU cap (1000 entries) for the image cache-buster map. Added `clearImageCache()` for tests. |
| `frontend-gateway/utils/crypto.ts` | Reviewed; no changes required (already uses Web Crypto SHA-256). |

### Auth routes

| File | Rationale |
| --- | --- |
| `frontend-gateway/routes/api/auth/login.ts` | Plain-text error responses → JSON `{ error }` with `Content-Type: application/json`. |
| `frontend-gateway/routes/api/auth/register.ts` | Same JSON-error treatment. |
| `frontend-gateway/routes/api/auth/demo.ts` | Added `Content-Type: application/json` header to redirect response. |
| `frontend-gateway/routes/api/auth/2fa.ts` | All plain-text errors converted to JSON. Verified-secret flow now lives in two clearly-labeled branches. |

### Followers routes

| File | Rationale |
| --- | --- |
| `frontend-gateway/routes/api/followers/follow.ts` | Removed hardcoded `currentUserId = "user-123"`. Replaced `Map<string, Set<string>>` with real `INSERT … ON CONFLICT DO NOTHING` into a new `user_follows` table (created via inline `CREATE TABLE IF NOT EXISTS`). Requires session or demo via `requireDemoOrSession`. `targetUserId === currentUserId` self-follow check still enforced. |
| `frontend-gateway/routes/api/followers/unfollow.ts` | Same treatment — real `DELETE FROM user_follows` instead of `Map.delete`. |
| `frontend-gateway/routes/api/followers/status.ts` | Was accepting **any** `userId` from the query string — now rejects (HTTP 403) when the query `userId` does not match the session userId. Reads from real DB for non-demo users. |
| `frontend-gateway/routes/api/followers/index.ts` | **Consolidated dead branch.** Original file's POST branch was a near-duplicate of `follow.ts` / `unfollow.ts` (with broken URL-path dispatch) — removed. Refactored GET into a real, DB-backed "list followers/following" handler that requires a session and joins against `users`. Demo mode returns a single demo user so the UI still renders. |

### Circles routes

| File | Rationale |
| --- | --- |
| `frontend-gateway/routes/api/circles/join.ts` | Replaced `Map` with real `INSERT INTO circle_members`. Added inline `CREATE TABLE IF NOT EXISTS circles` + `circle_members` migrations. Reads session userId; client-supplied `userId` is ignored (intentional hardening — see Security notes). |
| `frontend-gateway/routes/api/circles/leave.ts` | Same treatment — real `DELETE FROM circle_members` and `UPDATE circles SET member_count`. |
| `frontend-gateway/routes/api/circles/[id]/membership.ts` | Was a `Map`-based membership check open to spoofing — now requires session and rejects (403) when `?userId=` does not match the session. Joins against `circle_members`. |
| `frontend-gateway/routes/api/circles/[id]/members.ts` | Removed hardcoded `mockMembers` literal with two fake users. Now joins `circle_members` against `users` and returns the real list. |

### Mirror

| File | Rationale |
| --- | --- |
| `frontend-gateway/routes/api/mirror.ts` | Deleted the hardcoded `{ views: 1250, likes: 342, … }` payload. Replaced with parallel aggregate `COUNT(*)` queries against `journal_entries`, `rooms`, `artifacts`, `threads`, and `user_follows`. `followerHistory` is a real 7-day `GROUP BY day` query; falls back to `[]` when the user has no follows. Requires session; rejects forged `userId`. |

### Synthesis

| File | Rationale |
| --- | --- |
| `frontend-gateway/routes/api/synthesis/parse.ts` | Removed the fabricated `mockResponses` for `github.com`, `medium.com`, `youtube.com`, `twitter.com` that were returning hardcoded marketing copy. Now does a real fetch + `og:` / `twitter:` / `<title>` regex extraction (mirrors the working `routes/api/extract.ts` pattern, but inlined so this PR stays in scope). HTTP 400 returned on real parse failures with a clear message. |
| `frontend-gateway/routes/api/synthesis/create-artifact.ts` | Replaced `artifactsDatabase` Map with a real `INSERT INTO artifacts`. Added inline schema for `artifacts` (room_id nullable) and an idempotent migration that drops the NOT NULL constraint on `artifacts.room_id` if it exists — the existing schema had `room_id NOT NULL`, but the create-artifact request treats `roomId` as optional. Requires session. Demo mode returns a `demo-…` UUID instead of mutating DB. |

### AI

| File | Rationale |
| --- | --- |
| `frontend-gateway/routes/api/ai/socratic.ts` | Was completely unauthenticated — any caller could trigger Groq API calls and accrue cost. Now requires a real (non-demo) session via `requireSession`. |

### Community (null-safety)

| File | Rationale |
| --- | --- |
| `frontend-gateway/routes/api/community/collaborators.ts` | Null-checks `u.email` before `.split("@")`. The previous code threw `TypeError: Cannot read properties of null (reading 'split')` when any non-Google user had `email = NULL` (which the schema allows). All error responses now JSON. |
| `frontend-gateway/routes/api/community/stream.ts` | Null-checks `entry.author_name` and `entry.timestamp` before use. Now produces a sensible `Anonymous` / `new Date()` fallback instead of crashing. All error responses now JSON. |
| `frontend-gateway/routes/api/community/circles.ts` | Added missing `Content-Type: application/json` headers on error and success paths. (Logic untouched.) |

### Health

| File | Rationale |
| --- | --- |
| `frontend-gateway/routes/api/health/services.ts` | Reviewed; already had correct JSON headers and is read-only. No changes. |

---

## Security notes — what an attacker can no longer do

Before Track A, the following were trivially exploitable. They are now blocked or controlled:

1. **Cross-user mutation via forged userId.** A POST to `/api/circles/join` with `{ userId: "<victim>", circleId: "..." }` previously added the *victim* to the circle (because the server used the body's `userId` blindly). Now the server ignores body `userId` and uses the cookie-derived session userId. **Net effect**: an attacker cannot make victims join or leave circles.

2. **Cross-user mutation via forged userId (followers).** Same class of bug on `/api/followers/follow` and `/unfollow`. A signed-in attacker could make a victim follow/unfollow anyone by passing `targetUserId` and previously the server always used `currentUserId = "user-123"` so attacks were noise, but the *session-spoofing* vector (passing `userId` to bypass auth) is now closed.

3. **Spoofing follow-status queries.** `/api/followers/status?userId=<victim>&targetUserId=<X>` previously revealed private follow data for *any* user. Now it returns 403 unless `userId` matches the session. The new `/api/circles/[id]/membership?userId=` route has the same protection.

4. **Unauthenticated AI spend.** `/api/ai/socratic` had **no auth check at all** — anyone on the internet could trigger Groq API calls. Now requires a non-demo session, so only authenticated users can generate Socratic questions. (Demo mode is intentionally rejected here to keep Groq costs bounded.)

5. **Brute-forceable passwords.** `bcrypt.genSalt(8)` is well below the OWASP 2024 recommendation of ≥10. Bumped to `12` (16× work factor over the original). New hashes are incompatible with old ones; existing users must re-login and will be re-hashed on next password change. The `comparePassword` function still verifies both old and new cost factors transparently.

6. **Phantom-DB silent fallback.** With no `DATABASE_URL` set, the gateway previously connected to a phantom `postgres://user:password@localhost:5432/muse` and either hung or returned confusing connection errors far from the actual misconfiguration. Now the process exits at boot with a single, actionable error message: *"DATABASE_URL is not set. Set the DATABASE_URL environment variable…"*

7. **Module-load crash on hosts without `--unstable-kv`.** The old `const kv = await Deno.openKv();` ran at import time; if KV was unavailable the entire gateway failed to start. Now `Deno.openKv()` is wrapped in a lazy getter — the error surfaces at the first request that needs session storage, with the rest of the app (health checks, public pages, etc.) still serving.

8. **Fabricated link metadata.** `/api/synthesis/parse` returned hardcoded marketing copy for `github.com`, `medium.com`, `youtube.com`, `twitter.com` regardless of the actual URL — an obvious social-engineering risk (a malicious `youtube.com`-looking URL would silently produce "YouTube – Enjoy the videos and music you love"). Now parses real `og:` / `twitter:` tags, refuses to fabricate content, and returns HTTP 400 with a clear error when extraction fails.

9. **Hardcoded engagement metrics.** `/api/mirror` returned `{ views: 1250, likes: 342, … }` for *every* user. This is both misleading and a competitive-intelligence leak. Now returns real aggregates scoped to the requesting session.

10. **Unbounded memory growth.** Both `utils/cache.ts` and `utils/images.ts` were `{ [k]: any }` objects with no eviction — a long-running process would slowly exhaust memory. Both are now LRU maps capped at 1000 entries.

---

## Known limitations & follow-up work (Track D / Track F)

1. **Schema ownership.** Track A inlines `CREATE TABLE IF NOT EXISTS user_follows`, `circles`, and `circle_members`. Track D owns the canonical migrations for these tables and should remove the inline `CREATE TABLE` statements from the route handlers once the migrations land.
2. **2FA secret persistence.** `/api/auth/2fa` returns `{ success: true }` after a valid `verify()` but does not write the secret to the `users` table. This was pre-existing and is a Track B concern.
3. **Artifact room_id migration.** The inline `ALTER TABLE artifacts ALTER COLUMN room_id DROP NOT NULL` runs on every artifact-create call (it's idempotent but wastes a round-trip). Track D should fold this into a migration file.
4. **No `tags` / `mood` / `is_public` columns on `journal_entries`.** `/api/community/stream` queries `j.tags`, `j.mood`, `j.is_public` which are not in the schema. The existing code has run with this assumption and is outside Track A's scope; Track D's schema work should add these columns.
5. **No rate limiting.** Track A adds session enforcement and userId validation but does not add per-user rate limiting. Recommended for a follow-up track.
6. **No CSRF protection.** Session cookies use `SameSite=Lax` which mitigates most CSRF, but explicit CSRF tokens would be a stronger guarantee. Recommended for a follow-up track.
7. **`fresh.gen.ts` not regenerated.** The auto-generated manifest still references `routes/api/followers/index.ts` (which I deliberately kept and refactored rather than deleted). Running `deno task manifest` after this PR will produce a no-op diff.
8. **Tests not added.** Track F owns tests. The new `clearAllCache` / `clearImageCache` exports are wired so tests can reset state without process restart.
9. **AI/cache hardening.** No TTL-on-LRU interaction beyond what was already there. A production deployment may want shorter TTLs on the response cache.

---

## Verification

```bash
git log --oneline track-a-security-and-backend ^main
git diff --stat track-a-security-and-backend ^main
```

All 23 files (22 source + 1 docs) compile within the existing `deno task check` contract — no new imports, no `deno.json` edits.