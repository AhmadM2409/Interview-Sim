ARCHITECTURE CI, INVARIANT, & RESILIENCE TEST CONTRACTS

Beyond happy-path mocking, the CI pipeline MUST pass these exact architectural and invariant checks to prevent silent failures, codebase pollution, and hallucinated correctness.

1. Architectural Boundaries & Code Isolation (CI Gates)

TDD-00 (Strict Module Isolation Check): Execute a dependency-cruiser or ESLint script in the CI pipeline asserting that:

Files in src/pages/ or existing UI folders do NOT import from src/features/interview/services/ or src/features/interview/api/.

Files in src/pages/ ONLY import the useInterviewEngine hook and TypeScript interfaces.

Failure triggers a hard CI block.

2. Resilience & Validation Tests

TDD-01 (LLM Schema Validation & Retry): Mock the LLM to return malformed JSON on the first two calls, and valid JSON on the third. Assert that the /init endpoint successfully retries internally and eventually writes the valid structured questions to the DB.

TDD-02 (External API Exhaustion): Mock Tavily to timeout 3 consecutive times. Assert that the system aborts the context fetch, switches to the generic fallback prompt, generates questions, and correctly sets is_degraded = true on the interview_sessions row.

3. Concurrency & Idempotency Tests

TDD-03 (Concurrent Answer Lock): Fire two simultaneous POST /api/interview/answer requests for the same question_id using Promise.all. Assert that exactly one request returns 200 OK and the other returns 409 Conflict, proving the atomic WHERE answer_text IS NULL lock works.

TDD-04 (Duplicate Init/Evaluate): Assert that sending duplicate /init requests returns the exact same initial payload without writing new rows. Assert duplicate /evaluate requests bypass the LLM and return the existing DB score.

4. State & Completion Invariants

TDD-05 (Premature Completion Reject): Assert /complete returns 422 Unprocessable Entity if 1 out of the generated questions has score = null or answer_text = null.

TDD-06 (Auth Isolation): Assert that User A passing User B's session_id to /init, /answer, or /complete returns 404 Not Found (enforcing row-level JWT ownership matching).

TDD-07 (Server-Derived Resume): Assert that initializing a session hook with an existing session_id correctly identifies question_index = 3 as the active_question when questions 1 and 2 already have answer_text populated in the DB.