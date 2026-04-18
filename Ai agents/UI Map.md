05-UI-MAP

Page List

/ (Home / Dashboard)

/interview/setup

/interview/session/:sessionId

/interview/summary/:sessionId

/coding/setup

Page Responsibilities & API Binding

/interview/setup:

Form to select target job role.

Triggers POST /api/interview/session.

/interview/session/:sessionId:

The core interactive view.

Mounts and fetches GET /api/interview/:sessionId/question/current.

Submits voice transcript via POST /api/interview/:sessionId/evaluate.

Requests next prompt via POST /api/interview/:sessionId/question/next.

Ends session via POST /api/interview/:sessionId/complete.

/interview/summary/:sessionId:

Fetches GET /api/interview/:sessionId/summary to display the final parsed Zod-compliant performance report.

/coding/setup (Stub):

Scaffolds the UI for language/problem selection prior to terminal implementation.

State Management & Concurrency Handling

Global State: Managed via Auth0 context.

Server State: Managed via TanStack Query (caching summary/metrics).

Concurrency UI State: When an API request is pending, the frontend MUST disable the microphone, transcription confirmation, and skip buttons to visually reflect the backend's isProcessing lock.

Component Breakdown

TranscriptionBox: UI showing live STT text. Emits payload to the evaluation API. Listens to lock state.

FeedbackCard: Strict receiver of validated { technicalScore, communicationScore }.

AudioPlayer: Manages the ElevenLabs TTS playback state.

Error Handling UX (Resilient Design)

Payload/Zod Errors (400): Displayed as field-level errors or inline non-blocking toast notifications indicating malformed input.

Concurrent Lock Error (409): If a 409 status is returned, the UI intercepts it globally and ignores the duplicate request silently to maintain visual flow and prevent screen flickering.

Unstructured LLM Error (Post-Retry): If the backend exhausts its 2 validation retries and returns a 500 envelope, the UI gracefully displays "The interviewer lost their train of thought. Let's try that again." and reveals a retry button without crashing the active session flow.

Timeouts: If API duration exceeds limits, the UI displays a non-blocking toast warning and aborts the ongoing fetch cleanly, resetting the interactive state to allow the user to try again.