PROJECT INTAKE & SCOPE DEFINITION

Project Type: AI-Driven Mock Interview Pipeline (Voice-Native).

Core User Goal: Complete an end-to-end, role-specific spoken mock interview with real-time AI voice generation, contextual questions, and automated scoring.

MVP Scope (LOCKED):

Server API Foundation (endpoints for generation, retrieval, STT/TTS, scoring).

Tavily Integration (role-to-search mapping, context shaping, caching).

Question Generation (4-6 role-specific sequenced questions, strictly validated, persisted to DB).

ElevenLabs TTS (single interviewer persona, stream audio, playback state).

Speech-to-Text (mic permissions, audio capture, transcription, preview/confirm).

Interview Orchestration (state loop).

Scoring & Feedback (per-question evaluation, session total, summary).

Frontend State Binding (wire orchestration hook to existing locked UI).

Data Persistence (write progression to Supabase, atomic concurrency checks).

Error Fallbacks & Resilience (strict retry policies, degraded execution paths).

Strict Code Isolation: Absolute segregation of new logic into dedicated feature modules. Zero business logic injected into existing UI files.

Non-Goals: UI redesign, routing changes, adding new pages, supporting multiple voice personas, complex branching narratives, or coding/terminal implementation.

Tech Stack: React (TanStack Start), Supabase (Auth + DB), Node.js server functions, Tavily API, ElevenLabs API, LLM API, Browser Web Audio API.

Critical Path: API boundaries & CI checks -> Resilience Wrappers -> Tavily Retrieval -> LLM Generation -> DB Persistence -> UI State Machine -> STT/TTS loop -> Scoring & DB Persistence.

Data Model Usage (Schema Extension):

interview_sessions: id, user_id, job_role, status, total_score, summary_feedback, completed_at, is_degraded (Boolean, default false).

interview_questions: interview_session_id, question_index, question_text, answer_text, score, feedback.