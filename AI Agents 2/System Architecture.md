# ------------------------------------------------------------------------------
# 04-SYSTEM-ARCHITECTURE.md
# ------------------------------------------------------------------------------
cat << 'DOCEOF' > docs/04-SYSTEM-ARCHITECTURE.md
# STRICT MODULE BOUNDARIES, STATE, & RESILIENCE FLOW

## 1. Strict File System & Module Boundaries

To enforce the locked frontend constraint, ALL new code must reside within a dedicated feature module.

```text
src/
 ├── pages/                   <-- LOCKED: Only allows import of useInterviewEngine hook
 │    ├── Dashboard.tsx
 │    └── MockInterview.tsx
 │
 ├── features/
 │    └── interview/          <-- NEW: All logic lives strictly here
 │         ├── api/           <-- Server endpoints (/init, /answer, /complete, etc.)
 │         ├── services/      <-- Tavily search, LLM prompts, Orchestration logic
 │         ├── hooks/         <-- useInterviewEngine.ts (The ONLY export UI can use)
 │         ├── schemas/       <-- Zod/JSON schemas for LLM validation
 │         └── tests/         <-- Invariant & boundary tests
 │
 └── shared/
      └── lib/
           └── resilience.ts  <-- Retry wrappers with exponential backoff
```

## 2. Component Architecture & Resilience Wrappers

* **UI Layer:** Renders standard state. Holds NO business logic.

* **Hook Layer:** Enforces valid transitions. Broadcasts state to UI.

* **API Layer:** Handles auth isolation, atomic DB writes, idempotency checks.

* **Resilience Layer:** Wraps external calls (2 max retries + exponential backoff).

* **Service Layer:** Shapes context, handles external integrations.

## 3. Enforceable State Machine (Frontend Hook)

The `useInterviewEngine` hook utilizes a strict transition table. Illegal transitions will throw a client-side error and force a sync with the backend database state.

| Current State | Allowed Action | Next State | Backend Action Required? | 
| ----- | ----- | ----- | ----- | 
| `IDLE` | `init_session` | `FETCHING_CONTEXT` | Call `/init` | 
| `FETCHING_CONTEXT` | `context_ready` | `PLAYING_AUDIO` | Fetch Q1, Call `/tts` | 
| `PLAYING_AUDIO` | `audio_finished` | `AWAITING_MIC` | None | 
| `AWAITING_MIC` | `start_recording` | `RECORDING` | None | 
| `RECORDING` | `stop_recording` | `PROCESSING_STT` | Call `/stt` | 
| `PROCESSING_STT` | `transcript_ready` | `REVIEWING_TRANSCRIPT` | None | 
| `REVIEWING_TRANSCRIPT` | `retry_answer` | `AWAITING_MIC` | None | 
| `REVIEWING_TRANSCRIPT` | `confirm_transcript` | `EVALUATING` | Call `/answer` -> `/evaluate` | 
| `EVALUATING` | `eval_complete` | `PLAYING_AUDIO` | Fetch Next Q, Call `/tts` | 
| `EVALUATING` | `eval_complete` | `COMPLETING` | (If 0 Qs left) Call `/complete` | 
| `COMPLETING` | `session_finalized` | `FINISHED` | Fetch final DB results | 
DOCEOF
echo "Generated docs/04-SYSTEM-ARCHITECTURE.md"