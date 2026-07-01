-- ==========================================
-- 001_initial_robust_schema.sql
-- Forward-compatible upgrade migration for MUSE OS.
--
-- Idempotent: every step uses IF NOT EXISTS / DO blocks so the file can be
-- re-applied without error. Safe to run on a fresh database (a no-op except
-- for enabling extensions, creating the trigger function, and creating the
-- new tables).
--
-- Destructive operations
-- ---------------------
-- The only destructive operation is dropping the legacy
-- `threads.artifact_ids` UUID[] column. Existing data must first be
-- backfilled into `thread_artifacts` (see BACKFILL section below).
-- Destructive steps are guarded by a session variable.
--
-- To run destructive parts in psql:
--     psql -v ON_ERROR_STOP=1 -d "$DATABASE_URL"
--     SET muse.migrate_destructive = '1';
--     \i database/migrations/001_initial_robust_schema.sql
--     (or: psql ... -c "SET muse.migrate_destructive='1';" -f ...)
--
-- To skip destructive parts (the default, safe for production):
--     \i database/migrations/001_initial_robust_schema.sql
--
-- Note: PostgreSQL 15+ requires custom GUC names to be dotted; the prefix
-- `muse.` namespaces this knob for the MUSE project.
-- ==========================================

-- ==========================================
-- 0. Extensions
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. Generic updated_at trigger function
-- ==========================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 2. Add updated_at columns to every existing table.
-- ==========================================
ALTER TABLE users           ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE rooms           ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE artifacts       ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE threads         ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- ==========================================
-- 3. Add is_public to journal_entries (needed for partial indexes).
-- ==========================================
ALTER TABLE journal_entries
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- ==========================================
-- 4. Backfill existing NULLs before applying NOT NULL.
-- ==========================================
UPDATE rooms           SET tags               = '{}'::varchar[] WHERE tags               IS NULL;
UPDATE rooms           SET is_public          = false           WHERE is_public          IS NULL;
UPDATE artifacts       SET unstructured_data  = '{}'::jsonb     WHERE unstructured_data  IS NULL;
UPDATE journal_entries SET is_broadcasted     = false           WHERE is_broadcasted     IS NULL;
UPDATE threads         SET ai_blueprint       = '{}'::jsonb     WHERE ai_blueprint       IS NULL;

-- ==========================================
-- 5. Apply NOT NULL + DEFAULTs to existing columns.
-- ==========================================
ALTER TABLE rooms           ALTER COLUMN tags               SET DEFAULT '{}';
ALTER TABLE rooms           ALTER COLUMN tags               SET NOT NULL;
ALTER TABLE rooms           ALTER COLUMN is_public          SET DEFAULT false;
ALTER TABLE rooms           ALTER COLUMN is_public          SET NOT NULL;
ALTER TABLE artifacts       ALTER COLUMN unstructured_data  SET DEFAULT '{}'::jsonb;
ALTER TABLE artifacts       ALTER COLUMN unstructured_data  SET NOT NULL;
ALTER TABLE journal_entries ALTER COLUMN is_broadcasted     SET DEFAULT false;
ALTER TABLE journal_entries ALTER COLUMN is_broadcasted     SET NOT NULL;
ALTER TABLE threads         ALTER COLUMN ai_blueprint       SET DEFAULT '{}'::jsonb;
ALTER TABLE threads         ALTER COLUMN ai_blueprint       SET NOT NULL;

-- ==========================================
-- 6. Add CHECK constraints.
--    PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS, so each
--    constraint is wrapped in a DO block that checks pg_constraint first.
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_resonance_score_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_resonance_score_check CHECK (resonance_score >= 0);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_current_streak_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_current_streak_check CHECK (current_streak >= 0);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'artifacts_type_check'
    ) THEN
        ALTER TABLE artifacts
            ADD CONSTRAINT artifacts_type_check
            CHECK (type IN ('pdf','url','youtube','text','docx','image','audio','video'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rooms_theme_color_check'
    ) THEN
        ALTER TABLE rooms
            ADD CONSTRAINT rooms_theme_color_check
            CHECK (theme_color ~ '^#[0-9a-fA-F]{6}$');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_blockchain_hash_check'
    ) THEN
        ALTER TABLE journal_entries
            ADD CONSTRAINT journal_entries_blockchain_hash_check
            CHECK (blockchain_hash IS NULL OR length(blockchain_hash) BETWEEN 32 AND 255);
    END IF;
END $$;

-- ==========================================
-- 7. Recreate FKs with ON UPDATE CASCADE.
--    The default constraint name pattern (used by schema.sql) is
--    `<table>_<column>_fkey` for auto-generated constraints, so we can
--    drop+re-add idempotently.
-- ==========================================
DO $$
BEGIN
    -- rooms.user_id -> users.id
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'rooms_user_id_fkey'
    ) THEN
        ALTER TABLE rooms DROP CONSTRAINT rooms_user_id_fkey;
    END IF;
    ALTER TABLE rooms
        ADD CONSTRAINT rooms_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

    -- artifacts.room_id -> rooms.id
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'artifacts_room_id_fkey'
    ) THEN
        ALTER TABLE artifacts DROP CONSTRAINT artifacts_room_id_fkey;
    END IF;
    ALTER TABLE artifacts
        ADD CONSTRAINT artifacts_room_id_fkey
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE ON UPDATE CASCADE;

    -- threads.room_id -> rooms.id
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'threads_room_id_fkey'
    ) THEN
        ALTER TABLE threads DROP CONSTRAINT threads_room_id_fkey;
    END IF;
    ALTER TABLE threads
        ADD CONSTRAINT threads_room_id_fkey
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE ON UPDATE CASCADE;

    -- journal_entries.user_id -> users.id
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_user_id_fkey'
    ) THEN
        ALTER TABLE journal_entries DROP CONSTRAINT journal_entries_user_id_fkey;
    END IF;
    ALTER TABLE journal_entries
        ADD CONSTRAINT journal_entries_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

    -- journal_entries.thread_id -> threads.id
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_thread_id_fkey'
    ) THEN
        ALTER TABLE journal_entries DROP CONSTRAINT journal_entries_thread_id_fkey;
    END IF;
    ALTER TABLE journal_entries
        ADD CONSTRAINT journal_entries_thread_id_fkey
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE SET NULL ON UPDATE CASCADE;
END $$;

-- ==========================================
-- 8. Create the new tables: user_follows, circles, circle_members,
--    thread_artifacts.
-- ==========================================
CREATE TABLE IF NOT EXISTS thread_artifacts (
    thread_id   UUID NOT NULL REFERENCES threads(id)   ON DELETE CASCADE ON UPDATE CASCADE,
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (thread_id, artifact_id),
    UNIQUE (thread_id, position)
);

CREATE TABLE IF NOT EXISTS user_follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    followed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followed_id),
    CHECK (follower_id != followed_id)
);

CREATE TABLE IF NOT EXISTS circles (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    founder_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    member_count INTEGER NOT NULL DEFAULT 1 CHECK (member_count >= 0),
    is_public    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS circle_members (
    circle_id  UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE ON UPDATE CASCADE,
    role       VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('member','moderator','founder')),
    joined_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (circle_id, user_id)
);

-- ==========================================
-- 9. Backfill thread_artifacts from threads.artifact_ids.
--    Idempotent: ON CONFLICT DO NOTHING skips already-migrated rows.
--    Safe to run multiple times. Also skipped automatically if the
--    legacy column has already been dropped by a prior destructive run.
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'threads' AND column_name = 'artifact_ids'
    ) THEN
        RAISE NOTICE 'Step 9 SKIPPED: threads.artifact_ids no longer exists (already migrated)';
        RETURN;
    END IF;

    INSERT INTO thread_artifacts (thread_id, artifact_id, position)
    SELECT t.id, aid, ord - 1
    FROM threads t
    CROSS JOIN LATERAL unnest(t.artifact_ids) WITH ORDINALITY AS u(aid, ord)
    ON CONFLICT (thread_id, artifact_id) DO NOTHING;
END $$;

-- ==========================================
-- 10. Attach set_updated_at triggers to every table that has updated_at.
--     CREATE TRIGGER has no IF NOT EXISTS in PostgreSQL, so guard with DO.
-- ==========================================
DO $$
DECLARE
    tbl TEXT;
    tables_to_watch TEXT[] := ARRAY[
        'users', 'rooms', 'artifacts', 'threads',
        'thread_artifacts', 'journal_entries',
        'user_follows', 'circles', 'circle_members'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_watch LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_' || tbl || '_updated_at'
              AND tgrelid = tbl::regclass
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
                 FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
                tbl, tbl
            );
        END IF;
    END LOOP;
END $$;

-- ==========================================
-- 11. Indexes (all CREATE INDEX IF NOT EXISTS).
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_artifacts_unstructured   ON artifacts USING GIN (unstructured_data);
CREATE INDEX IF NOT EXISTS idx_rooms_tags                ON rooms USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_rooms_user_created        ON rooms(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_room_created    ON artifacts(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_room_created      ON threads(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_user_id           ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_thread_id         ON journal_entries(thread_id);
CREATE INDEX IF NOT EXISTS idx_journal_user_created      ON journal_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_user_public       ON journal_entries(user_id, is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_journal_is_broadcasted    ON journal_entries(is_broadcasted) WHERE is_broadcasted = false;
CREATE INDEX IF NOT EXISTS idx_user_follows_followed     ON user_follows(followed_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user       ON circle_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_user_title    ON rooms(user_id, lower(title));

-- ==========================================
-- 12. DESTRUCTIVE: drop threads.artifact_ids.
--     Guarded by the muse.migrate_destructive session variable. Default
--     is skip. Always run the backfill in step 9 BEFORE this step.
-- ==========================================
DO $$
BEGIN
    IF coalesce(current_setting('muse.migrate_destructive', true), '0') <> '1' THEN
        RAISE NOTICE 'Step 12 SKIPPED: SET muse.migrate_destructive=''1'' to drop threads.artifact_ids';
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'threads' AND column_name = 'artifact_ids'
    ) THEN
        ALTER TABLE threads DROP COLUMN artifact_ids;
        RAISE NOTICE 'Dropped threads.artifact_ids';
    ELSE
        RAISE NOTICE 'threads.artifact_ids already absent, nothing to drop';
    END IF;
END $$;
