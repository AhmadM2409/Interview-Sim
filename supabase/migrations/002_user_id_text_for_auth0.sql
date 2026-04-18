-- ============================================================
-- Migration: Ensure Auth0 user IDs are stored as TEXT
-- ============================================================
-- Auth0 subject IDs (e.g. "google-oauth2|123...") are not UUIDs.
-- Convert interview_sessions.user_id from UUID -> TEXT when needed.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'interview_sessions'
      AND column_name = 'user_id'
      AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE public.interview_sessions
      ALTER COLUMN user_id TYPE TEXT
      USING user_id::TEXT;
  END IF;
END $$;
