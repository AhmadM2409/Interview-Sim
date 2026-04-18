ARCHITECTURE, API CONTRACTS, & IMPLEMENTATION STRATEGY

1. Implementation File Strategy & Module Boundaries (STRICT)

To prevent codebase pollution and enforce the "Locked Frontend" constraint, the implementation MUST adhere to a strict module boundary and dependency direction.

Rule 1 (New Logic = New Files): All backend logic, state machines, and resilience wrappers must live in a dedicated features/interview/ directory.

Rule 2 (UI = Integration Only): Existing UI files may ONLY be modified to import and consume the useInterviewEngine hook. Zero direct API calls, business logic, or state management may be added to existing UI component files.

Dependency Direction (Strictly Enforced):

UI Components → can ONLY import Hooks

Hooks → can ONLY call API Endpoints

API Endpoints → can ONLY import Services & Schemas

Services → can ONLY call External APIs (via Resilience Layer)

2. Resilience & Validation Standards

External API Retry Policy: All external calls (Tavily, ElevenLabs, STT, LLM) route through a resilience wrapper enforcing exactly 2 retries with exponential backoff (e.g., 500ms, 2000ms) before triggering fallback paths.

LLM Runtime Validation: All LLM outputs (generation, evaluation) must be validated against a strict JSON Schema (e.g., Zod). If validation fails, the system automatically rejects and retries the prompt (max 3 times). Unvalidated data is NEVER written to DB.

Schema Migration: Execution of ALTER TABLE interview_sessions ADD COLUMN is_degraded BOOLEAN DEFAULT false; is required before deployment.

3. Server Functions (API Layer)

All endpoints append AND user_id = auth.uid() to Supabase queries.

POST /api/interview/init:

Action: Fetches Tavily context -> Generates questions via LLM -> Writes to DB.

Idempotency: Returns existing questions if interview_questions already populated for session_id.

POST /api/interview/tts & POST /api/interview/stt:

Action: Bridges to external voice APIs. Inherits 2-retry policy.

POST /api/interview/answer:

Action: Writes answer_text to DB.

Concurrency: Uses atomic conditional update: UPDATE interview_questions SET answer_text = ? WHERE question_id = ? AND answer_text IS NULL AND user_id = auth.uid(). Returns 409 Conflict on 0 rows affected.

POST /api/interview/evaluate:

Action: Evaluates answer_text via LLM -> updates DB.

Idempotency: Bypasses LLM and returns existing score if score IS NOT NULL.

POST /api/interview/complete:

Precondition: Rejects (422) if ANY question row has score IS NULL or answer_text IS NULL.

Action: Calculates mean total_score -> generates summary_feedback -> updates status = 'completed', completed_at = NOW(). Sets is_degraded = true if fallbacks occurred.