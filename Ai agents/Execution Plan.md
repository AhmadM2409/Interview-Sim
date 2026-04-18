02-EXECUTION-PLAN

Phase 0: CI Enforcement & Isolation Setup

Tasks:

Define .github/workflows/test.yml to run the test suite per phase, including Phase 6.

Initialize Vitest and Supertest.

Configure true DB isolation (createNewDBInstance() and destroyDBInstance()).

Define typed seed data contracts in tests/helpers/db-seed.ts.

CI Gate: GitHub Actions workflow initialization.

Git Checkpoint: Post-GREEN CI log.

Phase 1: Authentication, Routing & Security Framework

Tasks:

Implement Auth0 wrapper.

Scaffold /interview and /coding routes.

Enforce Auth0 middleware on all API endpoints.

CI Gate: CI triggers npm run test:phase1

Git Checkpoint: Post-GREEN CI log.

Phase 2: Session Data, Validation Contracts, & Locks

Tasks:

Build SQLite schema (Sessions, Questions, Responses) including the isProcessing lock column.

Implement strict response envelope middleware and Zod request payload validation.

CI Gate: CI triggers npm run test:phase2

Git Checkpoint: Post-GREEN CI log.

Phase 3: External Context, LLM Retries & Schemas

Tasks:

Define zod schemas for QuestionGeneration.

Build LLM services with the 2-attempt retry loop and structured logging via pino.

Implement failure injection logic (req.headers['x-test-force-tavily-timeout']).

CI Gate: CI triggers npm run test:phase3

Git Checkpoint: Post-GREEN CI log.

Phase 4: Interview Progression, Concurrency & Idempotency

Tasks:

Implement GET /api/interview/:sessionId/question/current

Implement POST /api/interview/:sessionId/question/next with try/finally lock safety.

Implement POST /api/interview/:sessionId/complete with strict idempotency.

Implement GET /api/interview/:sessionId/summary.

CI Gate: CI triggers npm run test:phase4

Git Checkpoint: Post-GREEN CI log.

Phase 5: Evaluation Engine & Scoring

Tasks:

Define zod schemas for EvaluationMetrics.

Build the answer evaluation pipeline.

CI Gate: CI triggers npm run test:phase5

Git Checkpoint: Post-GREEN CI log.

Phase 6: Coding Mode Stub

Tasks: Scaffold /coding/setup UI routing.

CI Gate: CI triggers npm run test:phase6

Git Checkpoint: Post-GREEN CI log.