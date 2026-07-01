# Muse Database Architecture

> **Canonical reference** (regenerated from `database/schema.sql` + `database/migrations/001_initial_robust_schema.sql` on the `deploy` branch).
>
> This document is the source of truth. If you find a discrepancy between this file and the SQL, the SQL wins.

## 1. Overview

Muse is built on **PostgreSQL** with JSONB support for unstructured content. The schema is intentionally narrow: 9 tables in `schema.sql` plus 4 added by the migration in track-d (`thread_artifacts`, `user_follows`, `circles`, `circle_members`) — for a total of **9 tables** (the migration adds the latter 3, and `thread_artifacts` already lived in `schema.sql`).

> **Note on the prior junior-authored version of this document:** that draft described a 18-table schema including `items`, `item_annotations`, `entanglements`, `streak_entanglements`, `streak_events`, `streak_sparks`, `spark_reactions`, `spark_comments`, `room_collaborators`, and `artifact_nlp_metadata`. Those tables are **not part of the deployed schema**. The current schema uses **`artifacts`** as the unified primitive (one row per captured resource, with `unstructured_data JSONB` for the payload). Items-style annotations and engagement signals are tracked in **client-side signals** and not yet modeled in the database.

## 2. Tables (canonical, deployed)

| # | Table | Purpose | Owner | Notes |
|---|---|---|---|---|
| 1 | `users` | Identity, auth, social handles | self | Holds `password_hash`, optional `google_id` / `wallet_address`. |
| 2 | `rooms` | User-owned workspaces | `users.id` | Cascade delete. `tags` is `varchar[]` GIN-indexed. |
| 3 | `artifacts` | Captured resources (pdf, url, youtube, text, docx, image, audio, video) | `rooms.id` | The unified content primitive. `unstructured_data JSONB` GIN-indexed. `type` is constrained. |
| 4 | `threads` | Synthesis objects over artifacts | `rooms.id` | `ai_blueprint JSONB` holds synthesized structure. |
| 5 | `thread_artifacts` | Join table replacing the old `threads.artifact_ids[]` array | `threads.id` + `artifacts.id` | `position INTEGER` for ordering, unique per thread. |
| 6 | `journal_entries` | Raw thoughts, optionally linked to a thread | `users.id` | Optional `thread_id` (SET NULL on delete). Public/broadcasted flags. `blockchain_hash` optional (32–255 chars). |
| 7 | `user_follows` | Asymmetric follow graph | `users.id` | CHECK `follower_id != followed_id`. |
| 8 | `circles` | Public/private groups | `users.id` (founder) | `member_count` maintained on the circle row. |
| 9 | `circle_members` | Membership roles | `circles.id` + `users.id` | Role CHECK: `member`, `moderator`, `founder`. |

## 3. Field-level reference

### 3.1 `users`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | `uuid_generate_v4()` |
| `email` | varchar(255) UNIQUE NOT NULL | |
| `username` | varchar(255) UNIQUE NOT NULL | |
| `google_id` | varchar(255) UNIQUE | OAuth fallback |
| `password_hash` | varchar(255) | bcrypt cost 12 (track-a) |
| `wallet_address` | varchar(255) UNIQUE | Optional wallet auth |
| `resonance_score` | int | `>= 0`, gamification |
| `current_streak` | int | `>= 0` |
| `created_at` / `updated_at` | timestamptz | `updated_at` trigger |

### 3.2 `rooms`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → `users.id` | CASCADE |
| `title` | varchar(255) NOT NULL | Case-insensitive unique per user (functional index) |
| `description` | text | |
| `theme_color` | varchar(50) | CHECK regex `^#[0-9a-fA-F]{6}$` |
| `tags` | varchar(255)[] DEFAULT `{}` | GIN-indexed |
| `is_public` | bool NOT NULL DEFAULT false | |
| `created_at` / `updated_at` | timestamptz | |

### 3.3 `artifacts`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `room_id` | UUID FK → `rooms.id` NOT NULL | CASCADE |
| `type` | varchar(50) NOT NULL | CHECK in (`pdf`,`url`,`youtube`,`text`,`docx`,`image`,`audio`,`video`) |
| `source_url` | text | Optional origin URL |
| `unstructured_data` | JSONB NOT NULL DEFAULT `{}` | GIN-indexed |
| `created_at` / `updated_at` | timestamptz | |

### 3.4 `threads`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `room_id` | UUID FK → `rooms.id` NOT NULL | CASCADE |
| `ai_blueprint` | JSONB NOT NULL DEFAULT `{}` | Synthesized structure from artifacts |
| `created_at` / `updated_at` | timestamptz | |

### 3.5 `thread_artifacts`
| Field | Type | Notes |
|---|---|---|
| `thread_id` | UUID FK → `threads.id` | CASCADE, part of PK |
| `artifact_id` | UUID FK → `artifacts.id` | CASCADE, part of PK |
| `position` | INTEGER NOT NULL DEFAULT 0 | Unique per thread |
| `created_at` / `updated_at` | timestamptz | |

### 3.6 `journal_entries`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → `users.id` | CASCADE |
| `thread_id` | UUID FK → `threads.id` | SET NULL on delete |
| `raw_thought` | text NOT NULL | |
| `blockchain_hash` | varchar(255) | CHECK length 32–255 if set |
| `is_broadcasted` | bool DEFAULT false | Partial index when false |
| `is_public` | bool DEFAULT false | Partial index when true |
| `created_at` / `updated_at` | timestamptz | |

### 3.7 `user_follows`
| Field | Type | Notes |
|---|---|---|
| `follower_id` | UUID FK → `users.id` | CASCADE, part of PK |
| `followed_id` | UUID FK → `users.id` | CASCADE, part of PK |
| CHECK | — | `follower_id != followed_id` |
| `created_at` / `updated_at` | timestamptz | |

### 3.8 `circles`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | varchar(255) NOT NULL | |
| `description` | text | |
| `founder_id` | UUID FK → `users.id` | CASCADE |
| `member_count` | int NOT NULL DEFAULT 1 | `>= 0` |
| `is_public` | bool NOT NULL DEFAULT true | |
| `created_at` / `updated_at` | timestamptz | |

### 3.9 `circle_members`
| Field | Type | Notes |
|---|---|---|
| `circle_id` | UUID FK → `circles.id` | CASCADE, part of PK |
| `user_id` | UUID FK → `users.id` | CASCADE, part of PK |
| `role` | varchar(50) DEFAULT `member` | CHECK in (`member`,`moderator`,`founder`) |
| `joined_at` | timestamptz | |
| `updated_at` | timestamptz | |

## 4. Relationships

| Relationship | Cardinality | Key | Delete behavior |
|---|---|---|---|
| `users` → `rooms` | 1:N | `rooms.user_id` | CASCADE |
| `users` → `journal_entries` | 1:N | `journal_entries.user_id` | CASCADE |
| `rooms` → `artifacts` | 1:N | `artifacts.room_id` | CASCADE |
| `rooms` → `threads` | 1:N | `threads.room_id` | CASCADE |
| `threads` ↔ `artifacts` | N:N | `thread_artifacts` | CASCADE |
| `threads` → `journal_entries` | 1:N (optional) | `journal_entries.thread_id` | SET NULL |
| `users` ↔ `users` (follow) | N:N | `user_follows` | CASCADE, no self-follow |
| `users` → `circles` | 1:N (founder) | `circles.founder_id` | CASCADE |
| `circles` ↔ `users` (membership) | N:N | `circle_members` | CASCADE |

## 5. Indexes

- GIN on `artifacts.unstructured_data` (JSONB full-text).
- GIN on `rooms.tags` (array containment).
- Composite recency: `(rooms.user_id, created_at DESC)`, `(artifacts.room_id, created_at DESC)`, `(threads.room_id, created_at DESC)`.
- Functional unique: `(rooms.user_id, lower(title))`.
- Journal: `user_id`, `thread_id`, `(user_id, created_at DESC)`, partial on `is_public`, partial on `is_broadcasted`.
- Social: `user_follows(followed_id)`, `circle_members(user_id)`.

## 6. Triggers

- Generic `set_updated_at()` function applied to every table that carries an `updated_at` column (`users`, `rooms`, `artifacts`, `threads`, `thread_artifacts`, `journal_entries`, `user_follows`, `circles`, `circle_members`).

## 7. Migrations

- `database/migrations/001_initial_robust_schema.sql` — idempotent (`CREATE TABLE IF NOT EXISTS`), adds `thread_artifacts`, `user_follows`, `circles`, `circle_members` along with all constraints, indexes, and triggers.
- `database/seed.sql` — deterministic seed for dev (1 user, 2 rooms, 3 artifacts, 1 thread, 1 journal).

## 8. Not in this schema (deferred or client-only)

These were in the prior junior-authored spec but are **not** in `deploy`:
- `items`, `item_annotations` → consolidated into `artifacts` (with `unstructured_data` carrying annotation layers client-side).
- `entanglements`, `streak_entanglements` → social graph modeled as `user_follows` only.
- `streak_events`, `streak_sparks`, `spark_reactions`, `spark_comments` → streak state lives on `users.current_streak`; reactions/comments are client-side state.
- `room_collaborators` → circle membership covers collaboration; room ownership remains single-user.
- `artifact_nlp_metadata` → NLP results, when present, are embedded inline in `artifacts.unstructured_data` (key: `nlp_analysis`) rather than in a dedicated table.

A future migration can introduce any of these if product scope requires it; they are intentionally **out of scope for v1 deploy**.