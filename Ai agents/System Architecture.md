04-SYSTEM-ARCHITECTURE

High-Level Architecture

Client (React/TanStack Start) ↔ Server (Node/Express API) ↔ DB (SQLite)
External Services: Auth0 (Identity), Tavily (Search), LLM (Reasoning), ElevenLabs (TTS), STT (Speech).
Note: Runtime architecture uses standard SQLite connections. Testing architecture uses strictly isolated per-test in-memory instances.

GitHub Actions CI Enforcement (.github/workflows/test.yml)

The CI pipeline is the verifiable record of RED/GREEN execution state.

name: CI Enforcement Pipeline
on: [push, pull_request]
jobs:
  test-enforcement:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test:phase0
      - run: npm run test:phase1
      - run: npm run test:phase2
      - run: npm run test:phase3
      - run: npm run test:phase4
      - run: npm run test:phase5
      - run: npm run test:phase6


Backend Flow & Strict Validation Boundaries

Route → Auth0 Middleware → Controller → isProcessing Lock Check → try → Zod Input Payload Validation → Internal Paths Execute Real DB Logic → External Providers Mocked in Tests → Zod Output Validator (with 2-Max Retry Loop + pino Logging) → DB → finally → Unlock isProcessing → Response Envelope

Data Flow (ASCII)

User Speech (Mic) 
  → [Client] STT Layer (Blob -> Text)
    → [Client] POST /api/interview/:id/evaluate (Bearer Token)
      → [API] Auth Middleware Validates Token
        → [API] Controller applies Lock (`isProcessing = true`)
          → [try]
            → [API] Zod validates incoming payload
              → [Logic] LLM Provider / External API
                → [API] Zod validates LLM output (Loop: max 2 retries on failure, emits pino warn)
                  → [DB] Save Metrics
          → [finally]
            → [API] Unlock (`isProcessing = false`)
          → [API] Response Envelope { success: true, data: { scores } }


Critical Paths

Session Init: POST /api/interview/session → Validate Auth & Payload → Create DB Record → Prefetch context (Zod validated).

Question Delivery: GET /api/interview/:sessionId/question/current → Retrieve active question.

Evaluation: POST /api/interview/:sessionId/evaluate → Lock → LLM assesses → Zod validates → Unlock via finally.

Progression: POST /api/interview/:sessionId/question/next → Lock → Generates next prompt → Zod validates → Unlock via finally.

Completion: POST /api/interview/:sessionId/complete → Idempotency check → Locks session permanently → GET .../summary (Zod validated).

Failure Points & Active Mitigation

Failure: LLM hallucination results in missing JSON keys.

Mitigation: zod validation boundary intercepts the output. Triggers a background retry automatically and outputs pino structured warning. Defaults to a 500 error if max retries are hit, preventing DB corruption.

Failure: Internal API Exception during LLM generation.

Mitigation: The try/finally block guarantees the isProcessing flag is reset to false even if the route throws an unhandled exception, preventing session deadlocks.

Failure: User double-clicks "Submit" or network lag causes multiple requests.

Mitigation: The isProcessing database lock rejects subsequent requests with a 409 status code.