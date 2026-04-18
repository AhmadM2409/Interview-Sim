00-AI-KICKOFF

1. Deterministic Execution & CI Enforcement (STRICT)

No Live External Calls in Tests: Testing against live LLM, Tavily, or ElevenLabs APIs is strictly prohibited. You must use deterministic mocking for all external boundaries.

CI as the ONLY Source of Truth: Agent-provided terminal outputs or self-written summaries are strictly rejected as state proof. The automated CI pipeline (GitHub Actions) is the sole authority.

No Visual Verification: System correctness is evaluated entirely by executable validation.

2. RED → GREEN TDD Validation

The CI pipeline is the verifiable record of test states. To prove RED → GREEN progression:

The agent must write the failing test and commit.

The CI pipeline MUST run and log a FAILURE (RED).

The agent must write the implementation code and commit.

The CI pipeline MUST run and log a PASS (GREEN).
The agent must link to the sequential automated CI logs to prove execution status per commit.

3. State Proof Rules

The agent cannot fabricate state. Proof of execution is strictly defined as the verifiable log output from the GitHub Actions CI pipeline.

If the CI environment is unavailable or fails to trigger:
→ HALT with: [BLOCKER] No CI executable environment available

4. Circuit Breaker Mechanism

If the CI pipeline fails on the same phase 3 consecutive times:
→ HALT with [BLOCKER]