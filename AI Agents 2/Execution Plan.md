CI-DRIVEN IMPLEMENTATION PHASES

Phase 1: Foundation, Migrations & Isolation CI

Apply is_degraded schema migration. Set up environment variables.

CI Gate: Implement a dependency-cruiser or ESLint boundaries rule to strictly enforce: UI cannot import services or schemas directly. CI pipeline MUST fail if business logic leaks into the UI folder.

Implement API retry/backoff wrappers and strict LLM JSON schema validators.

Phase 2: Context Retrieval & Question Generation

Implement Tavily search mapping. Build prompt shaper inside services/.

Implement LLM question generation ensuring it successfully passes the validation wrapper.

Wire /init endpoint with idempotency checks.

Phase 3: Speech Pipeline (STT & TTS)

Implement TTS and STT endpoints wrapped in the standard retry policy. Define single ElevenLabs voice persona.

Phase 4: State Machine & UI Hooking

Build useInterviewEngine React hook with strict transition table in hooks/.

Wire existing UI buttons strictly using the hook's exported methods. Implement fallback UI states for degraded modes.

Phase 5: Evaluation & Session Completion

Implement per-question scoring logic with LLM schema validation.

Wire atomic /answer and idempotent /evaluate endpoints.

Implement session-level /complete endpoint with strict preconditions and mean-score aggregation.