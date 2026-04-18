LOCKED FRONTEND INTEGRATION BINDINGS (INTEGRATION ONLY)

CRITICAL CONSTRAINT: No DOM structures will be altered. No business logic may be added to existing UI component files. We strictly map the state and methods from the isolated useInterviewEngine hook to the existing UI presentational components.

1. Dashboard (Role Selection)

Target: Job Role Dropdown & "Start Interview" Button.

Strict Integration: Add an onClick handler to "Start Interview" that extracts the role value, calls the hook's initialization method (which calls /init), receives session_id, and navigates the router to /interview/[session_id]. Zero backend logic is written in this file.

2. Mock Interview Session Page (The Stub)

Target: Microphone Button.

onClick Binding:

If state === 'AWAITING_MIC', trigger startRecording().

If state === 'RECORDING', trigger stopRecording().

disabled Binding: Evaluates to true if state is PLAYING_AUDIO, PROCESSING_STT, FETCHING_CONTEXT, EVALUATING, or COMPLETING.

Target: Status Indicator / Banner.

Strict Integration: Map the hook's state strings directly to the UI's text prop: Initializing..., Interviewer Speaking..., Listening..., Transcribing..., Evaluating....

Target: Transcript Preview Area.

Strict Integration: Map the transcriptPreview string to the text container.

Bind "Submit/Confirm" button to confirmTranscript().

Bind "Retry" button to retryAnswer().

3. Results / Completion State

Target: Dashboard History or Post-Interview Summary View.

Strict Integration:

Subscribe to the session state. Pull total_score and summary_feedback from interview_sessions.

Conditionally render a visual warning flag (e.g., "Note: Generated via fallback mode") if the is_degraded boolean is true.

Render the mapped list of interview_questions joining question_text, answer_text, score, and feedback by passing the array to the existing list component.