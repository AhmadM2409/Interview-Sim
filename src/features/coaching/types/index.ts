// ── Coaching session types ─────────────────────────────────────────────────────

export type CoachingPhase =
  | 'IDLE'
  | 'ACTIVE'
  | 'STREAMING'
  | 'PROCESSING'
  | 'RESPONDING'
  | 'ERROR';

export interface CoachingState {
  phase: CoachingPhase;
  sessionId: string | null;
  inputBuffer: string;
  pendingChunks: string[];
  coachResponse: string | null;
  error: string | null;
}

// ── Terminal entry interfaces ──────────────────────────────────────────────────
// These are the extension points a future terminal UI implementation will plug into.

export interface TerminalEntryPoint {
  /** Called character-by-character or word-by-word as the user types */
  onInputChunk(chunk: string): void;

  /** Called with the full current buffer state after each chunk */
  onBufferUpdate(buffer: string): void;

  /** Push a typing delta (for streaming/collaborative mode) */
  pushTypingDelta(delta: string, cursorPosition: number): void;

  /** Called when the user finalizes their submission (e.g., presses Enter) */
  finalizeSubmission(text: string): Promise<void>;

  /** Reset the input buffer without submitting */
  clearBuffer(): void;

  /** Get the current buffer contents */
  getBuffer(): string;
}

export interface CoachingMessage {
  role: 'user' | 'coach';
  content: string;
  timestamp: string;
}

export interface CoachingSession {
  id: string;
  userId: string;
  problemContext: string;
  messages: CoachingMessage[];
  createdAt: string;
}
