# Track D: Database Schema Upgrade

> Production-grade, idempotent upgrade of the MUSE OS core schema. Adds
> integrity guarantees, performance indexes, audit columns, and three
> new social primitives (`user_follows`, `circles`, `circle_members`)
> while staying fully backward-compatible with existing data.

## Spirit

This contribution is built on the **Ubuntu** principle: collaborative,
transparent, well-documented. Every change is idempotent, every new
column has a default, every destructive step is guarded, and the
migration script can be re-applied without error.

## Files in this change

| File | Purpose |
| --- | --- |
| `database/schema.sql` | New authoritative schema. Source of truth for fresh installs. |
| `database/migrations/001_initial_robust_schema.sql` | Forward-compatible upgrade for existing databases. |
| `database/seed.sql` | Deterministic dev fixtures (DEV ONLY). |
| `docs/contributions/track-d-database-schema.md` | This document. |

## Summary of changes

### 1. NOT NULL + DEFAULTs

| Table.Column | New definition |
| --- | --- |
| `rooms.is_public` | `BOOLEAN NOT NULL DEFAULT false` |
| `rooms.tags` | `VARCHAR(255)[] NOT NULL DEFAULT '{}'` |
| `artifacts.unstructured_data` | `JSONB NOT NULL DEFAULT '{}'::jsonb` |
| `journal_entries.is_broadcasted` | `BOOLEAN NOT NULL DEFAULT false` |
| `threads.ai_blueprint` | `JSONB NOT NULL DEFAULT '{}'::jsonb` |

Existing NULLs are backfilled in the migration (step 4) before the
NOT NULL is applied, so the upgrade is safe on populated databases.

### 2. CHECK constraints

| Constraint | Predicate |
| --- | --- |
| `users_resonance_score_check` | `resonance_score >= 0` |
| `users_current_streak_check` | `current_streak >= 0` |
| `artifacts_type_check` | `type IN ('pdf','url','youtube','text','docx','image','audio','video')` |
| `rooms_theme_color_check` | `theme_color ~ '^#[0-9a-fA-F]{6}$'` |
| `journal_entries_blockchain_hash_check` | `blockchain_hash IS NULL OR length(blockchain_hash) BETWEEN 32 AND 255` |
| `user_follows` | `follower_id != followed_id` |
| `circles_member_count_check` | `member_count >= 0` |
| `circle_members_role_check` | `role IN ('member','moderator','founder')` |

The artifact-type constraint replaces the previous freeform `VARCHAR(50)`,
which had no validation. The theme-color regex enforces 6-digit hex.
The hash-length check guarantees that any non-NULL `blockchain_hash` is
between 32 and 255 characters (i.e. SHA-256 hex or longer).

### 3. Indexes

| Index | Purpose |
| --- | --- |
| `idx_journal_thread_id` | Join journal entries to their thread. |
| `idx_journal_is_broadcasted` (partial, `WHERE is_broadcasted = false`) | Cheap query for "pending broadcast" queue. |
| `idx_rooms_user_created` | Room list per user, newest first. |
| `idx_artifacts_room_created` | Artifact list per room, newest first. |
| `idx_threads_room_created` | Thread list per room, newest first. |
| `idx_journal_user_created` | Journal list per user, newest first. |
| `idx_journal_user_public` (partial, `WHERE is_public = true`) | Public journal feed. |
| `idx_rooms_user_title` (unique, functional on `lower(title)`) | Case-insensitive uniqueness on room titles per user. |
| `idx_rooms_tags` (GIN) | Fast array-containment search on room tags. |
| `idx_user_follows_followed` | Reverse lookup: "who follows X?". |
| `idx_circle_members_user` | "Which circles am I in?" lookup. |

### 4. `updated_at` audit columns + generic trigger

Every table now carries `updated_at TIMESTAMP WITH TIME ZONE DEFAULT
CURRENT_TIMESTAMP`. A single trigger function `set_updated_at()`
populates the column on every `UPDATE`:

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

A `BEFORE UPDATE` trigger named `trg_<table>_updated_at` is attached to
every table (`users`, `rooms`, `artifacts`, `threads`,
`thread_artifacts`, `journal_entries`, `user_follows`, `circles`,
`circle_members`).

### 5. `ON UPDATE CASCADE` on all foreign keys

Every FK in the schema now explicitly declares `ON UPDATE CASCADE` so
that any future UUID regeneration propagates cleanly. The migration
script (step 7) idempotently drops and recreates the five pre-existing
FKs by their default names.

### 6. `user_follows` table

Asymmetric social graph. Composite primary key
`(follower_id, followed_id)`, with a self-`CHECK` preventing users from
following themselves.

### 7. `circles` + `circle_members`

Two-table model. `circles` carries metadata (name, founder, public
flag, denormalized `member_count`). `circle_members` is the join table
with a `role` enum-like check (`'member' | 'moderator' | 'founder'`)
and a `(circle_id, user_id)` primary key.

### 8. `threads.artifact_ids` array → `thread_artifacts` join table

**Destructive.** The old `UUID[]` column had no FK enforcement, no
ordering guarantees, and no room for per-join metadata. It is replaced
by a proper join table:

```sql
CREATE TABLE thread_artifacts (
    thread_id   UUID NOT NULL REFERENCES threads(id)   ON DELETE CASCADE ON UPDATE CASCADE,
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (thread_id, artifact_id),
    UNIQUE (thread_id, position)
);
```

`position` preserves the original array order and is unique per thread.
The migration includes idempotent backfill SQL (step 9) that runs
**before** the column drop.

### 9. GIN on `rooms.tags`

`CREATE INDEX idx_rooms_tags ON rooms USING GIN (tags);` makes queries
like `WHERE tags @> ARRAY['stoicism']` index-only.

### 10. pgcrypto enabled

`CREATE EXTENSION IF NOT EXISTS pgcrypto;` is now run alongside
`uuid-ossp`. pgcrypto gives us `gen_random_uuid()`, `digest()`, and
`crypt()` for future security work (blockchain hashing, password
hashing) without an extra migration later.

## Migration: how to run it

```bash
# Non-destructive run (default): adds columns, constraints, indexes,
# new tables, backfills thread_artifacts. Does NOT drop the legacy
# threads.artifact_ids column.
psql -v ON_ERROR_STOP=1 \
     -d "$DATABASE_URL" \
     -f database/migrations/001_initial_robust_schema.sql
```

```bash
# Destructive run: same as above, plus drops threads.artifact_ids
# after backfill. Use this only after you have verified the
# thread_artifacts backfill produced the expected row counts.
psql -v ON_ERROR_STOP=1 \
     -d "$DATABASE_URL" \
     -c "SET muse.migrate_destructive='1';" \
     -f database/migrations/001_initial_robust_schema.sql
```

### Backfill procedure for `thread_artifacts`

The backfill lives in step 9 of the migration and is safe to re-run:

```sql
INSERT INTO thread_artifacts (thread_id, artifact_id, position)
SELECT t.id, aid, ord - 1
FROM threads t
CROSS JOIN LATERAL unnest(t.artifact_ids) WITH ORDINALITY AS u(aid, ord)
ON CONFLICT (thread_id, artifact_id) DO NOTHING;
```

Pre-flight check before the destructive drop:

```sql
-- Should be 0: any orphans the FK would block.
SELECT count(*) FROM (
    SELECT unnest(artifact_ids) AS aid FROM threads WHERE artifact_ids <> '{}'
) x
LEFT JOIN artifacts a ON a.id = x.aid
WHERE a.id IS NULL;

-- Should match the row count above.
SELECT count(*) FROM thread_artifacts;
```

### Idempotency notes

- `ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` are
  native PostgreSQL.
- `CREATE INDEX IF NOT EXISTS` is native.
- `ALTER TABLE ... ADD CONSTRAINT` is wrapped in a `DO` block that
  checks `pg_constraint` first because PostgreSQL has no
  `ADD CONSTRAINT IF NOT EXISTS`.
- `CREATE TRIGGER` is also wrapped in a `DO` block (no `IF NOT EXISTS`
  in any current PG version).
- The trigger function is `CREATE OR REPLACE FUNCTION`, which is a
  natural idempotent operation.

## Verification checklist

After running the migration, confirm:

```sql
-- 1. All updated_at columns exist.
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name = 'updated_at'
ORDER BY table_name;
-- Expect 9 rows: users, rooms, artifacts, threads, thread_artifacts,
-- journal_entries, user_follows, circles, circle_members.

-- 2. Triggers are attached.
SELECT tgname FROM pg_trigger
WHERE tgname LIKE 'trg_%_updated_at'
ORDER BY tgname;
-- Expect 9 triggers.

-- 3. updated_at moves on UPDATE.
UPDATE rooms SET description = description WHERE id IS NOT NULL;
SELECT updated_at > created_at FROM rooms;  -- should be true

-- 4. CHECK constraints reject bad data.
INSERT INTO users (email, username, resonance_score)
VALUES ('bad@muse.local', 'baduser', -1);
-- ERROR: new row for relation "users" violates check constraint
--        "users_resonance_score_check"

-- 5. ON UPDATE CASCADE works.
--    (Manual: UPDATE users SET id = gen_random_uuid() WHERE ...; the
--     cascades should fire.)

-- 6. New tables exist and FKs are wired.
SELECT count(*) FROM user_follows;
SELECT count(*) FROM circles;
SELECT count(*) FROM circle_members;
SELECT count(*) FROM thread_artifacts;
```

## Seed data

`database/seed.sql` is for **local development only**. It inserts one
user, two rooms, three artifacts, one thread (linked to two artifacts
via `thread_artifacts`), and one journal entry. All UUIDs are
deterministic so tests are reproducible:

- user    `00000000-0000-0000-0000-000000000001`
- rooms   `...0010`, `...0011`
- artifacts `...0020`, `...0021`, `...0022`
- thread  `...0030`
- journal `...0040`

## Out of scope / future work

- Row-Level Security (RLS) policies for multi-tenant isolation.
- Materialized views for the Community Hub feed.
- A `notifications` table — needs a separate contribution.
- Soft-delete columns (`deleted_at`) for GDPR-compliant erase.
- Backfill for `is_public` on `journal_entries` (defaults to `false`).
