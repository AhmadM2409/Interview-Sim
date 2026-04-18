-- ============================================================
-- Migration: Interview Engine Tables
-- Run once against your Supabase project.
-- ============================================================

-- 1. interview_sessions
-- Extends or replaces the localStorage-based session model.
CREATE TABLE IF NOT EXISTS interview_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  job_role         TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'created'
                     CHECK (status IN ('created', 'active', 'completed', 'abandoned')),
  total_score      NUMERIC(4, 1),
  summary_feedback TEXT,
  completed_at     TIMESTAMPTZ,
  is_degraded      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Required by spec: add is_degraded if table already exists without it
ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS is_degraded BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. interview_questions
CREATE TABLE IF NOT EXISTS interview_questions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_session_id  UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_index        INTEGER NOT NULL,
  question_text         TEXT NOT NULL,
  answer_text           TEXT,           -- NULL until answered
  score                 INTEGER CHECK (score >= 0 AND score <= 10),
  feedback              TEXT,
  evaluated_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (interview_session_id, question_index)
);

-- 3. Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id
  ON interview_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_interview_questions_session_id
  ON interview_questions(interview_session_id);

-- ============================================================
-- Row-Level Security (enable when using Supabase JWT auth)
-- ============================================================
-- Uncomment these blocks once real Supabase JWT auth replaces
-- the current localStorage auth system.

-- ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users own their sessions"
--   ON interview_sessions
--   FOR ALL USING (user_id = auth.uid()::text);

-- CREATE POLICY "Users own their questions via session"
--   ON interview_questions
--   FOR ALL USING (
--     interview_session_id IN (
--       SELECT id FROM interview_sessions WHERE user_id = auth.uid()::text
--     )
--   );
