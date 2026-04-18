01-SYSTEM-SPEC

1. Dependency Whitelist & Tech Stack

Frontend: React, TanStack Start

Authentication: Auth0

Backend Validation: zod (MANDATORY for all request schemas, response schemas, and LLM outputs)

Testing: Vitest, Supertest

External APIs: Tavily, ElevenLabs, LLM Provider (OpenAI/Gemini)

Database: SQLite

Logging: pino (Strictly locked for structured backend logging).

Rule: NO additions to this dependency whitelist allowed.

2. File Whitelist & Strict Directory Structure

.github/workflows/test.yml (CI Pipeline Definition)

src/routes/ (TanStack Start routing)

src/modules/ (Isolated feature modules)

src/api/ (Backend service logic, schemas, controllers)

src/api/types.ts (Explicitly typed seed data contracts and Zod inferences)

tests/ (Vitest suites with deterministic mocks)

3. API Contract & Robust Recovery

Response Envelope: All endpoints must strictly return:
{ "success": boolean, "data": object | null, "error": string | null }

LLM Schema Validation, Logging, & Retry Protocol:
All LLM text responses must be parsed through zod. To prevent complete failure from a single bad LLM output, a retry loop with structured logging is strictly enforced:

let attempt = 0;
while (attempt < 2) {
  try { 
    return validateZodSchema(schema, rawResponse); 
  } catch (error) { 
    attempt++; 
    logger.warn('LLM Schema Validation Failed', { attempt, error });
    if (attempt >= 2) throw new Error("LLM Schema Validation Failed after max retries");
  }
}


4. Concurrency Control (Lock Safety & Idempotency)

Session Lock Requirement: To prevent race conditions, all session-mutating endpoints (/evaluate, /question/next) must check and set an isProcessing flag in SQLite.

Lock Release Safety (finally): If isProcessing === true, the API must immediately throw a 409 Conflict. Locks MUST be released using try/finally blocks to prevent dead sessions.

if (session.isProcessing) return res.status(409).json({ success: false, error: 'Concurrent request locked', data: null });
await lockSession(sessionId);
try {
  // LLM & DB Logic
} finally {
  await unlockSession(sessionId);
}


Idempotency on Completion: /complete must be idempotent. If a session is already completed, it must return 200 OK with the existing summary, preventing duplicate processing.

5. State Isolation Mechanism

Runtime architecture uses a standard SQLite file/connection pool.

Testing architecture strictly separates execution: shared database instances across tests are forbidden. Each Vitest test block must instantiate a completely fresh SQLite in-memory instance (createNewDBInstance()) in beforeEach and tear it down in afterEach.