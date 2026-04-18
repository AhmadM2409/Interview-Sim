export type InterviewStatus = 'created' | 'active' | 'completed' | 'abandoned';

export interface InterviewSession {
  id: string;
  user_id: string;
  job_role: string;
  status: InterviewStatus;
  total_score: number | null;
  summary_feedback: string | null;
  completed_at: string | null;
  is_degraded: boolean;
  created_at: string;
}

export interface InterviewQuestion {
  id: string;
  interview_session_id: string;
  question_index: number;
  question_text: string;
  answer_text: string | null;
  score: number | null;
  feedback: string | null;
  evaluated_at: string | null;
  created_at: string;
}

// ── State machine ──────────────────────────────────────────────────────────────

export type InterviewPhase =
  | 'IDLE'
  | 'FETCHING_CONTEXT'
  | 'PLAYING_AUDIO'
  | 'AWAITING_MIC'
  | 'RECORDING'
  | 'PROCESSING_STT'
  | 'REVIEWING_TRANSCRIPT'
  | 'EVALUATING'
  | 'COMPLETING'
  | 'FINISHED'
  | 'ERROR'
  | 'DEGRADED';

export interface EngineState {
  phase: InterviewPhase;
  sessionId: string | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestionText: string | null;
  transcriptPreview: string | null;
  audioUrl: string | null;
  isPlaying: boolean;
  isRecording: boolean;
  isDegraded: boolean;
  error: string | null;
  scores: Array<{ index: number; score: number; feedback: string }>;
  finalScore: number | null;
  summaryFeedback: string | null;
}

// ── API payloads ───────────────────────────────────────────────────────────────

export interface InitInterviewPayload {
  sessionId: string;
  jobRole: string;
  userId: string;
}

export interface AnswerPayload {
  sessionId: string;
  questionIndex: number;
  answerText: string;
  userId: string;
}

export interface EvaluatePayload {
  sessionId: string;
  questionIndex: number;
  userId: string;
}

export interface CompletePayload {
  sessionId: string;
  userId: string;
}

export interface TTSPayload {
  text: string;
  voiceId?: string;
}

export interface STTPayload {
  audioBase64: string;
  mimeType?: string;
}

// ── API responses ──────────────────────────────────────────────────────────────

export interface InitResult {
  questions: Pick<InterviewQuestion, 'question_index' | 'question_text'>[];
  isDegraded: boolean;
  /** Index of the first unanswered question; -1 means all answered */
  activeQuestionIndex: number;
}

export interface TTSResult {
  audioBase64: string;
}

export interface STTResult {
  transcript: string;
}

export interface AnswerResult {
  ok: true;
  conflict: boolean;
}

export interface EvaluateResult {
  score: number;
  feedback: string;
}

export interface CompleteResult {
  totalScore: number;
  summaryFeedback: string;
  isDegraded: boolean;
}
