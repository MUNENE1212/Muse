-- ==========================================
-- DEV ONLY — do not run in production.
-- Minimal, deterministic seed data for local development and tests.
-- UUIDs are hand-picked so fixtures are reproducible across runs.
-- ==========================================

-- 1. Demo user
INSERT INTO users (
    id, email, google_id, password_hash, username, wallet_address,
    resonance_score, current_streak
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'demo@muse.local',
    NULL,
    NULL,
    'demo',
    NULL,
    0,
    0
) ON CONFLICT (id) DO NOTHING;

-- 2. Two demo rooms
INSERT INTO rooms (id, user_id, title, description, theme_color, tags, is_public) VALUES
    (
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000001',
        'Stoicism',
        'Notes on Marcus Aurelius and Epictetus.',
        '#1f6feb',
        ARRAY['stoicism', 'philosophy'],
        true
    ),
    (
        '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000001',
        'Private Drafts',
        'Personal scratchpad — not for public consumption.',
        '#222831',
        ARRAY['draft'],
        false
    )
ON CONFLICT (id) DO NOTHING;

-- 3. Three demo artifacts across both rooms
INSERT INTO artifacts (id, room_id, type, source_url, unstructured_data) VALUES
    (
        '00000000-0000-0000-0000-000000000020',
        '00000000-0000-0000-0000-000000000010',
        'text',
        NULL,
        '{"raw_text":"Meditations, Book I.","author":"Marcus Aurelius","reading_time":4}'::jsonb
    ),
    (
        '00000000-0000-0000-0000-000000000021',
        '00000000-0000-0000-0000-000000000010',
        'url',
        'https://example.com/epictetus-handbook',
        '{"raw_text":"The Enchiridion excerpt.","author":"Epictetus","reading_time":6}'::jsonb
    ),
    (
        '00000000-0000-0000-0000-000000000022',
        '00000000-0000-0000-0000-000000000011',
        'pdf',
        NULL,
        '{"raw_text":"Working draft of a personal essay.","author":"Demo","reading_time":3}'::jsonb
    )
ON CONFLICT (id) DO NOTHING;

-- 4. One demo thread that synthesizes two artifacts
INSERT INTO threads (id, room_id, ai_blueprint) VALUES
    (
        '00000000-0000-0000-0000-000000000030',
        '00000000-0000-0000-0000-000000000010',
        '{"theme":"Duty and discipline","socratic_questions":["What is in our control?"],"summary":"Stoic primer."}'::jsonb
    )
ON CONFLICT (id) DO NOTHING;

-- 4b. thread_artifacts join rows
INSERT INTO thread_artifacts (thread_id, artifact_id, position) VALUES
    ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000020', 0),
    ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000021', 1)
ON CONFLICT (thread_id, artifact_id) DO NOTHING;

-- 5. One demo journal entry tied to the thread
INSERT INTO journal_entries (
    id, user_id, thread_id, raw_thought, blockchain_hash, is_broadcasted, is_public
) VALUES (
    '00000000-0000-0000-0000-000000000040',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000030',
    'Today I noticed I was angry about traffic. Epictetus would not approve.',
    NULL,
    false,
    false
) ON CONFLICT (id) DO NOTHING;
