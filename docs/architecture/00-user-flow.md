# Muse User Flow & System Overview

> **Canonical reference** (regenerated to align with `docs/architecture/01-database.md`, `02-frontend-gateway.md`, `03-ai-engine.md`).

A page-to-page walkthrough of every authenticated route, what the user sees, and what happens behind the scenes when they interact with it.

## 1. Overview

A typical Muse session moves through four loose phases:

1. **Arrival** — auth, dashboard.
2. **Capture** — rooms, items, artifacts.
3. **Synthesis & reflection** — threads, journal.
4. **Review** — mirror, streaks, profile.

Community (`/connections`, `/journal-community`) and settings (`/settings`) sit alongside these as supporting flows.

## 2. Page-by-page reference

### 2.1 Entry & home

| Route | Page | What the user sees | Key actions |
|---|---|---|---|
| `/` | Landing | Pre-auth landing with cinematic hero, demo CTA | Sign up, log in, watch demo video |
| `/dashboard` | PulseHome | Community pulse strip + personal activity overview | Jump to any feature area |

### 2.2 Capture: rooms, items, artifacts

| Route | Page | What the user sees | Key actions |
|---|---|---|---|
| `/rooms` | RoomsGallery | All workspaces | Create room (`addRoom()` → `POST /api/rooms/create`); open existing |
| `/rooms/[id]` | RoomInside | One workspace: artifacts, threads, mood, theme, vault settings | `ArtifactUploader` (`addItem()` → `POST /api/artifacts/{ingest-url,upload-document}`); `SynthesisTrigger` |

> **Schema note.** Items and item-annotations in the prior spec are consolidated in `artifacts` (with `unstructured_data JSONB` holding annotation layers client-side).

### 2.3 Synthesis: threads

| Route | Page | What the user sees | Key actions |
|---|---|---|---|
| `/threads` | ThreadsGallery | All threads, filterable by search, mood, visibility | Open thread; filter |
| `/threads/[id]` | ThreadInside | Dialogue layers for one thread | Add dialogue layers; toggle privacy |

Under the hood: `addThread()` writes to `threads`; artifact references go in `thread_artifacts` (the join table that replaced the old `threads.artifact_ids[]` array).

### 2.4 Reflection: journal

| Route | Page | What the user sees | Key actions |
|---|---|---|---|
| `/journal` | JournalGallery | Raw thoughts, filterable by mood, visibility, type, favorites | Write entry (`addEntry()` → `POST /api/journal/capture`); favorite/delete |

Entries marked `is_public` surface in `/journal-community` and feed `/mirror`.

### 2.5 Momentum: streaks

| Route | Page | What the user sees | Key actions |
|---|---|---|---|
| `/streaks` | StreakHub | Current streak, longest, momentum feed | Extend/start via content actions |

Streak state lives on `users.current_streak`; `journalEntries` actions increment it server-side.

### 2.6 Review: mirror

| Route | Page | What the user sees | Key actions |
|---|---|---|---|
| `/mirror` | MirrorDashboard | Charts, heatmap, top themes, engagement KPIs | Read-only |

Backend computes `mirrorSignal` via aggregation across `journal_entries`, `rooms`, `threads`, `users`. The dashboard reads from `mirrorSignal` (track-a replaced the hardcoded `1250/342/89` numbers with real `COUNT(*)` queries).

### 2.7 Identity: profile and settings

| Route | Page | What the user sees | Key actions |
|---|---|---|---|
| `/profile` | ProfilePage | Own profile, aggregated counts | Edit profile (`updateProfile()`) |
| `/profile/[userId]` | PublicProfile | Another user's public activity | View |
| `/settings` | Settings | Appearance, notifications, privacy | Change theme/accent/font; persists to `localStorage` (key: `muse-fresh-settings`) + backend |

### 2.8 Social: community and connections

| Route | Page | What the user sees | Key actions |
|---|---|---|---|
| `/connections` | ConnectionsHub | Circles, collaborators, community stream | Browse; manage connection requests |
| `/journal-community` | CommunityPage | Public journal entries across the community | Browse |

## 3. Three journeys end-to-end

### 3.1 Capture and synthesize
1. User visits `/rooms` → creates room → `addRoom()` posts to `/api/rooms/create` → `roomsSignal` updates.
2. Inside the room, `ArtifactUploader` captures content → `addItem()` → row in `artifacts` (with `unstructured_data` carrying the payload).
3. `SynthesisTrigger` → `POST /api/threads/synthesize` → ai-engine `synthesize_artifacts()` → LLM call → `save_threads()` writes to `threads` + `thread_artifacts`.
4. Thread renders at `/threads/[id]`.

### 3.2 Reflect and track momentum
1. User visits `/journal` → writes entry → `addEntry()` → `journal_entries` row + `users.current_streak` update.
2. If `is_public = true`, entry surfaces in `/journal-community`.
3. `/streaks` reflects updated streak via `streaksSignal`.
4. `/mirror` recomputes KPIs on next load.

### 3.3 Connect and go social
1. User visits `/connections` → `ConnectionsHub` loads `/api/community/stream`, `/api/community/circles`, `/api/community/collaborators`.
2. Follow → `POST /api/followers/follow` → `user_follows` row.
3. Join circle → `POST /api/circles/join` → `circle_members` row.
4. Solo Mode (`soloModeSignal`) toggles feed rendering client-side only (not yet persisted).

## 4. Cross-cutting behavior

### 4.1 Offline & sync resilience
Every mutating call goes through `safeFetch` (utils/safeFetch.ts). Failed writes (POST/PUT/DELETE/PATCH) queue via `pushToQueue()`; `safeFetch` returns synthetic `202` so the UI stays optimistic. `registerIdSwapCallback()` lets the client reconcile local IDs with backend IDs after sync.

### 4.2 Demo mode
`/api/auth/demo` issues a session that API routes detect via `isDemoUser()`. In demo mode:
- `/api/community/*` returns hard-coded `DEMO_*` arrays.
- Frontend falls back to `localStorage` for rooms/threads/items/journal/streak metadata.

### 4.3 Theming
`appThemeSignal`, `appAccentSignal`, `appFontSizeSignal`, `customAccentHexSignal` write CSS variables on `:root`. Persisted under `muse-fresh-settings`.

## 5. Where this sits in the full system

Every page in this document is a thin client surface. The frontend-gateway calls backend APIs in `routes/api/`, which forward scraping and synthesis to the **ai-engine** (FastAPI on a separate port). The ai-engine persists synthesis results into the PostgreSQL schema described in `01-database.md`.

The **blockchain-security** workspace is a Rust tooling module; it is **not wired into the live request path** in `deploy`.

## 6. Three user roles (deployed)

| Role | Auth | Data scope |
|---|---|---|
| Anonymous | None | Landing only; `localStorage` for theme |
| Authenticated | Session cookie (`/api/auth/login`, `/register`) | Full DB-backed API |
| Demo | `/api/auth/demo` session | `localStorage` + `DEMO_*` arrays |

(2FA is available for authenticated users via `/api/auth/2fa`.)