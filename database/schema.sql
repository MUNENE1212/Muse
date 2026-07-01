-- ==========================================
-- MUSE OS: CORE DATABASE SCHEMA
-- Hybrid Structure: Relational + JSONB Unstructured
-- Target Engine: PostgreSQL
-- ==========================================

-- Enable UUID + crypto extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- Generic updated_at trigger function.
-- Applied to every table that carries an updated_at column.
-- ==========================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. USERS TABLE
-- Structured data representing identity and global metrics.
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    username VARCHAR(255) UNIQUE NOT NULL,
    wallet_address VARCHAR(255) UNIQUE,
    resonance_score INTEGER DEFAULT 0 CHECK (resonance_score >= 0),
    current_streak INTEGER DEFAULT 0 CHECK (current_streak >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. ROOMS TABLE
-- Sovereign spaces for knowledge organization.
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    theme_color VARCHAR(50) DEFAULT '#ffffff' CHECK (theme_color ~ '^#[0-9a-fA-F]{6}$'),
    tags VARCHAR(255)[] NOT NULL DEFAULT '{}',
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER trg_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. ARTIFACTS TABLE (The Hybrid Layer)
-- Stores the metadata, but dumps massive scraped text/data into JSONB.
CREATE TABLE artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE ON UPDATE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('pdf','url','youtube','text','docx','image','audio','video')),
    source_url TEXT,
    unstructured_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER trg_artifacts_updated_at
    BEFORE UPDATE ON artifacts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. THREADS TABLE
-- AI-generated blueprints and themes extracted from artifacts.
-- Note: artifact references live in the thread_artifacts join table (not an array)
-- so we can keep referential integrity, ordering, and per-join metadata.
CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE ON UPDATE CASCADE,
    ai_blueprint JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER trg_threads_updated_at
    BEFORE UPDATE ON threads
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4b. THREAD_ARTIFACTS (join table, replaces the old threads.artifact_ids array)
CREATE TABLE thread_artifacts (
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE ON UPDATE CASCADE,
    artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE ON UPDATE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (thread_id, artifact_id),
    UNIQUE (thread_id, position)
);
CREATE TRIGGER trg_thread_artifacts_updated_at
    BEFORE UPDATE ON thread_artifacts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. JOURNAL ENTRIES TABLE
-- The raw, captured thoughts of the user. Links off-chain data to on-chain proof.
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    thread_id UUID REFERENCES threads(id) ON DELETE SET NULL ON UPDATE CASCADE,
    raw_thought TEXT NOT NULL,
    blockchain_hash VARCHAR(255),
    is_broadcasted BOOLEAN NOT NULL DEFAULT false,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (blockchain_hash IS NULL OR length(blockchain_hash) BETWEEN 32 AND 255)
);
CREATE TRIGGER trg_journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 6. USER_FOLLOWS TABLE
-- Asymmetric social graph: a user can follow many users without reciprocal consent.
CREATE TABLE user_follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    followed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followed_id),
    CHECK (follower_id != followed_id)
);
CREATE TRIGGER trg_user_follows_updated_at
    BEFORE UPDATE ON user_follows
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. CIRCLES TABLE
-- Public or private groups of users, owned by a single founder.
CREATE TABLE circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    founder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    member_count INTEGER NOT NULL DEFAULT 1 CHECK (member_count >= 0),
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER trg_circles_updated_at
    BEFORE UPDATE ON circles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 8. CIRCLE_MEMBERS TABLE
-- Membership roles within a circle.
CREATE TABLE circle_members (
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE ON UPDATE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('member','moderator','founder')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (circle_id, user_id)
);
CREATE TRIGGER trg_circle_members_updated_at
    BEFORE UPDATE ON circle_members
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================
-- INDEXES
-- ==========================================

-- GIN: full-text search inside JSONB artifacts
CREATE INDEX idx_artifacts_unstructured ON artifacts USING GIN (unstructured_data);

-- GIN: array-tag containment search on rooms.tags
CREATE INDEX idx_rooms_tags ON rooms USING GIN (tags);

-- Composite lookups ordered by recency
CREATE INDEX idx_rooms_user_created     ON rooms(user_id, created_at DESC);
CREATE INDEX idx_artifacts_room_created ON artifacts(room_id, created_at DESC);
CREATE INDEX idx_threads_room_created   ON threads(room_id, created_at DESC);

-- Case-insensitive uniqueness on room titles per user
CREATE UNIQUE INDEX idx_rooms_user_title ON rooms(user_id, lower(title));

-- Journal query patterns
CREATE INDEX idx_journal_user_id        ON journal_entries(user_id);
CREATE INDEX idx_journal_thread_id      ON journal_entries(thread_id);
CREATE INDEX idx_journal_user_created   ON journal_entries(user_id, created_at DESC);
CREATE INDEX idx_journal_user_public    ON journal_entries(user_id, is_public) WHERE is_public = true;
CREATE INDEX idx_journal_is_broadcasted ON journal_entries(is_broadcasted) WHERE is_broadcasted = false;

-- Social graph lookups
CREATE INDEX idx_user_follows_followed  ON user_follows(followed_id);
CREATE INDEX idx_circle_members_user    ON circle_members(user_id);
