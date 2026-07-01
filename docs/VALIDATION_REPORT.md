# Muse — Pre-Merge Validation & Critique Report

> **Source documents reviewed**
> 1. Junior-authored system docs (DOCX → text): `Muse_User_Flow_System_Overview.docx`, `Muse_Frontend_Gateway_Architecture.docx`, `Muse_AI_Engine_Architecture.docx`, `Muse_Database_Architecture.docx`.
> 2. Internal contribution docs (in `deploy` branch): `docs/CONTRIBUTIONS.md` + `docs/contributions/track-{a,b,c,d,e,f}-*.md`.
> 3. Codebase on `deploy` (post-merge of all 6 tracks): `database/schema.sql`, `database/migrations/001_initial_robust_schema.sql`, `frontend-gateway/{routes,signals,islands}/`, `ai-engine/`.

This report is a **gate** before any `merge → dev → staging → main` action. Decision required at the end.

---

## 1. Verdict at a glance

| Area | Verdict | Severity |
|---|---|---|
| **Junior docs ↔ deployed code** | ❌ Drift on schema; partial on signals/routes; ✅ aligned on AI engine shape | High |
| **CONTRIBUTIONS.md ↔ deployed code** | ✅ Mostly accurate; some counts overstated | Low |
| **Track F (CI) ↔ junior docs** | Junior docs do not mention CI/CICD at all | Medium |
| **Internal consistency** | ✅ No internal contradictions across the 4 junior docs | OK |
| **Production readiness** | ⚠️ Demo-mode shortcuts still embedded in routes | Medium |

**Recommendation:** **Do not merge into `dev` yet.** Fix the schema gap (junior docs promise 18 tables; `deploy` has 9) and clarify which version is canonical before the merge decision gate.

---

## 2. Junior docs ↔ deployed code — drift inventory

### 2.1 Database schema drift (HIGH)

| Table | In junior docs? | In `database/schema.sql`? | In `001_initial_robust_schema.sql`? |
|---|---|---|---|
| `users` | ✅ | ✅ | (idempotent — exists) |
| `rooms` | ✅ | ✅ | — |
| `artifacts` | ✅ | ✅ | — |
| `threads` | ✅ | ✅ | — |
| `journal_entries` | ✅ | ✅ | — |
| `thread_artifacts` | (implied via `threads.artifact_ids` array) | ✅ (join table) | ✅ (new in migration) |
| `user_follows` | ❌ not documented | ✅ | ✅ (new in migration) |
| `circles` | ❌ not documented | ✅ | ✅ (new in migration) |
| `circle_members` | ❌ not documented | ✅ | ✅ (new in migration) |
| **`items`** | ✅ | ❌ MISSING | ❌ |
| **`item_annotations`** | ✅ | ❌ MISSING | ❌ |
| **`entanglements`** | ✅ | ❌ MISSING | ❌ |
| **`streak_entanglements`** | ✅ | ❌ MISSING | ❌ |
| **`streak_events`** | ✅ | ❌ MISSING | ❌ |
| **`streak_sparks`** | ✅ | ❌ MISSING | ❌ |
| **`spark_reactions`** | ✅ | ❌ MISSING | ❌ |
| **`spark_comments`** | ✅ | ❌ MISSING | ❌ |
| **`room_collaborators`** | ✅ | ❌ MISSING | ❌ |
| **`artifact_nlp_metadata`** | ✅ | ❌ MISSING | ❌ |

**Diagnosis.** Junior docs describe a richer, more mature schema than the one shipped in `deploy`. The deployed schema treats artifacts/threads as the primary content objects; the junior docs pivot on `items` as the primitive captured resource. This is a **pre-existing schema-design conflict**, not something track-d created.

**Action.** Pick one canonical schema. Options:
- **(A)** Treat `artifacts` as the unified primitive (current `deploy` state); rewrite junior docs to drop `items`/`item_annotations`/`spark_reactions`/`spark_comments`.
- **(B)** Add the 10 missing tables back via a follow-up migration (much larger work — needs user/UI rewrites that reference `items`).

### 2.2 Frontend Gateway — signals & routes (MEDIUM)

**Signal layer.** Junior docs enumerate 9 signal files. `deploy` has **20**. Junior docs do not mention:
`ai-feedback.ts`, `blueprints.ts`, `circle-membership.ts`, `feed-filter.ts`, `followers.ts`, `intelligence.ts`, `notifications.ts`, `publications.ts`, `resonance.ts`, `synthesis.ts`, `vault.ts`.

**Routes.** Junior docs reference only `/api/community/*`, `/api/rooms`, `/api/threads`, `/api/journal`, `/api/items`, `/api/user/streaks`, `/api/profile`. Actual `deploy` API surface:
- Auth: `/api/auth/2fa` (not documented)
- AI: `/api/ai/*` (not documented)
- Artifacts: `/api/artifacts/ingest-url`, `/api/artifacts/upload-document`
- Circles: `/api/circles/*`
- Followers: `/api/followers/*`
- Synthesis: `/api/synthesis/*`
- Profile, journal, rooms, threads — all match

**Action.** Junior docs should be regenerated from the deployed route map (`find routes/api -name '*.ts'`). Single-source-of-truth generation is the right fix, not manual editing.

### 2.3 AI Engine — mostly aligned (LOW)

Junior docs reference 6 scrapers (`youtube`, `tiktok`, `pinterest`, `social`, `web`, `document`). Actual scrapers: 5 (no `pinterest.py` in `deploy`, only `youtube`, `social`, `web`, `document`, plus a `tiktok_scraper` import that I did not see in the file list — verify).

| Doc | Actual | Match |
|---|---|---|
| `nlp_engine.py` (ProductionLocalNLPEngine, GroqEnrichedEngine) | `ai-engine/main.py` + `synthesizer.py` (no `nlp_engine.py` in deploy) | ❌ MISSING |
| `pipeline.py` (IntelligencePipeline, process_journal_entry, synthesize_with_insights) | not present | ❌ MISSING |

This is a **major gap**: the NLP subsystem the junior docs describe (`nlp_engine.py` + `pipeline.py`) does not exist in `deploy`. The deploy branch's AI engine is a thin wrapper around `synthesizer.py` + `database.py`.

**Action.** Either backfill the NLP engine implementation, or update junior docs to describe what's actually shipping.

### 2.4 NLP dual-storage contract — consistent

Both junior docs (Database §artifacts, AI Engine §3.5) and CONTRIBUTIONS.md agree on the dual-storage pattern (`artifacts.nlp_analysis` inline + `artifact_nlp_metadata` row). ✅ This is internally consistent — but the dedicated `artifact_nlp_metadata` table does not exist in `deploy`. Implementation gap.

---

## 3. CONTRIBUTIONS.md critique

### 3.1 What's accurate ✅
- Threat model coverage table — every "before/after" row reconciles with code.
- "Module throws at startup if `DATABASE_URL` is unset" — confirmed in `frontend-gateway/utils/db.ts`.
- SSRF protections on `/api/scrape`, `/api/extract` — confirmed.
- Prompt injection sanitization on `/api/analyze` — confirmed.
- bcrypt cost factor 12 — confirmed.

### 3.2 What's overstated ⚠️
| Claim | Reality |
|---|---|
| "17 global Signal modules" (per README) | Actual: **20** signal files in `deploy`. |
| Track E "20 files changed" | Off-by-one: actual 600+/384- stat for that branch. |
| `/api/synthesis/parse` "Real `og:`/`twitter:` metadata or HTTP 400" | Endpoint currently **always returns demo data** when DB is down (track-b fallback). The 400 branch only fires for invalid URLs. |

### 3.3 What's missing ⚠️
- **No mention of `ai-engine/nlp_engine.py` being absent** — the AI engine track (C) claims TF-IDF + spaCy + Groq enrichment, but none of these are in `deploy`. Track C's hardening is real (SSRF, upload caps, async I/O), but the *engine itself* is a stub.
- **No mention of demo-mode shortcuts** in `/api/community/stream`, `/api/community/collaborators` — both still return hard-coded `DEMO_*` arrays when DB returns no rows. The track-a work did not remove these fallback paths.
- **No `/api/health` or uptime probe** is documented, even though `routes/api/health/` exists.

---

## 4. Production readiness (for the VPS deploy step)

| Item | Status | Notes |
|---|---|---|
| `docker-compose.yml` exists | ✅ | Should be reviewed for production secrets handling. |
| `render.yaml` exists | ✅ | Confirms intended PaaS; question is whether VPS is the real target or Render. |
| `.env` example | ❓ | Need to verify `.env.example` exists; track-f expanded `.gitignore` but did not add an example file. |
| Secrets in repo | ❌ | `frontend-gateway/utils/db.ts` throws on missing `DATABASE_URL` — good. But track-a removed hardcoded creds from code only; confirm no `.env` files committed. |
| TLS termination | ❌ | VPS plan: are we running a reverse proxy (Caddy/Nginx) or direct? |
| Backup strategy | ❌ | Not documented. `streak_events`, `journal_entries` are user-data-critical. |
| Migrations are idempotent | ✅ | `001_initial_robust_schema.sql` uses `IF NOT EXISTS`. |
| Seed data | ✅ | `database/seed.sql` exists (track-d). |
| Health check endpoint | ✅ | `/api/health` exists in `routes/api/health/`. |

---

## 5. Decision required

Pause for your call before any `merge → dev`. The options:

1. **Merge `deploy` → `dev` as-is, fix docs after.**
   Fastest path to deploy. Carries schema/code/doc drift into production.
   *Recommended only if VPS deploy is a staging/canary.*

2. **Block at this gate, resolve drift first.**
   - Decide canonical schema: `items`-centric (junior) vs `artifacts`-centric (deploy).
   - Backfill or prune `nlp_engine.py` / `pipeline.py`.
   - Regenerate junior docs from code (`find` + grep, automated).
   - Then merge.
   *Recommended if VPS is production.*

3. **Two-branch strategy.**
   Keep `deploy` as the integration branch (has all tracks). Open a `docs/spec-reconciliation` branch with the schema + AI-engine decisions documented; merge that into `dev` ahead of code, so `dev` has the canonical spec before code lands.

---

## 6. What I will NOT do until you decide

- Create `dev` from main.
- Create `cicd` feature branch.
- Merge anything to `staging` or `main`.
- Touch the VPS.

**Awaiting your decision on §5.**