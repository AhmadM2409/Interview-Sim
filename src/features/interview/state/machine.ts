import type { EngineState, InterviewPhase } from '../types';

// Allowed transitions per the architecture spec
const TRANSITIONS: Record<InterviewPhase, InterviewPhase[]> = {
  IDLE: ['FETCHING_CONTEXT', 'ERROR'],
  FETCHING_CONTEXT: ['PLAYING_AUDIO', 'ERROR', 'DEGRADED'],
  PLAYING_AUDIO: ['AWAITING_MIC', 'ERROR'],
  AWAITING_MIC: ['RECORDING', 'ERROR'],
  RECORDING: ['PROCESSING_STT', 'AWAITING_MIC', 'ERROR'],
  PROCESSING_STT: ['REVIEWING_TRANSCRIPT', 'ERROR'],
  REVIEWING_TRANSCRIPT: ['AWAITING_MIC', 'EVALUATING', 'ERROR'],
  EVALUATING: ['PLAYING_AUDIO', 'COMPLETING', 'ERROR'],
  COMPLETING: ['FINISHED', 'ERROR'],
  FINISHED: [],
  ERROR: ['IDLE', 'AWAITING_MIC'],
  DEGRADED: ['PLAYING_AUDIO', 'ERROR'],
};

export function assertTransition(from: InterviewPhase, to: InterviewPhase): void {
  if (!TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Illegal state transition: ${from} → ${to}`);
  }
}

export function canTransition(from: InterviewPhase, to: InterviewPhase): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const INITIAL_ENGINE_STATE: EngineState = {
  phase: 'IDLE',
  sessionId: null,
  currentQuestionIndex: 0,
  totalQuestions: 0,
  currentQuestionText: null,
  transcriptPreview: null,
  audioUrl: null,
  isPlaying: false,
  isRecording: false,
  isDegraded: false,
  error: null,
  scores: [],
  finalScore: null,
  summaryFeedback: null,
};

export function applyTransition(
  state: EngineState,
  to: InterviewPhase,
  patch: Partial<EngineState> = {},
): EngineState {
  assertTransition(state.phase, to);
  return { ...state, ...patch, phase: to, error: to === 'ERROR' ? (patch.error ?? state.error) : null };
}
