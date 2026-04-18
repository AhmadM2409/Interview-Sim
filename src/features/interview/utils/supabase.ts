import type { InterviewQuestion, InterviewSession } from '../types';

// Local interview persistence (replaces Supabase dependency).
// Uses browser localStorage when available and an in-memory fallback otherwise.

const INTERVIEW_SESSIONS_KEY = 'ai_interview_sessions';
const INTERVIEW_QUESTIONS_KEY = 'ai_interview_questions';
const memoryStorage = new Map<string, string>();

type StoredInterviewSession = {
  id: string;
  user_id: string;
  job_role: string;
  status: InterviewSession['status'];
  total_score: number | null;
  summary_feedback: string | null;
  completed_at: string | null;
  is_degraded: boolean;
  created_at: string;
  started_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    }
  } catch {
    // Fall through to memory fallback.
  }

  try {
    const raw = memoryStorage.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T): void {
  const serialized = JSON.stringify(value);
  memoryStorage.set(key, serialized);

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, serialized);
    }
  } catch {
    // Keep in-memory value as fallback.
  }
}

function toInterviewStatus(value: unknown): InterviewSession['status'] {
  if (value === 'active' || value === 'completed' || value === 'abandoned') return value;
  return 'created';
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function makeStoredSession(
  session: Partial<StoredInterviewSession> & {
    id: string;
    user_id: string;
    job_role: string;
  },
): StoredInterviewSession {
  const createdAt =
    typeof session.created_at === 'string'
      ? session.created_at
      : typeof session.started_at === 'string'
        ? session.started_at
        : nowIso();

  return {
    id: session.id,
    user_id: session.user_id,
    job_role: session.job_role,
    status: toInterviewStatus(session.status),
    total_score: toNumberOrNull(session.total_score),
    summary_feedback: typeof session.summary_feedback === 'string' ? session.summary_feedback : null,
    completed_at: typeof session.completed_at === 'string' ? session.completed_at : null,
    is_degraded: Boolean(session.is_degraded),
    created_at: createdAt,
    started_at:
      typeof session.started_at === 'string'
        ? session.started_at
        : createdAt,
  };
}

function toInterviewSession(session: StoredInterviewSession): InterviewSession {
  return {
    id: session.id,
    user_id: session.user_id,
    job_role: session.job_role,
    status: session.status,
    total_score: session.total_score,
    summary_feedback: session.summary_feedback,
    completed_at: session.completed_at,
    is_degraded: session.is_degraded,
    created_at: session.created_at,
  };
}

function getStoredSessions(): StoredInterviewSession[] {
  const raw = safeReadJson<Array<Partial<StoredInterviewSession> & { id: string; user_id: string; job_role: string }>>(
    INTERVIEW_SESSIONS_KEY,
    [],
  );

  return raw
    .filter((row) => typeof row.id === 'string' && typeof row.user_id === 'string' && typeof row.job_role === 'string')
    .map((row) => makeStoredSession(row));
}

function setStoredSessions(sessions: StoredInterviewSession[]): void {
  safeWriteJson(INTERVIEW_SESSIONS_KEY, sessions);
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeQuestion(
  question: Partial<InterviewQuestion> & {
    interview_session_id: string;
    question_index: number;
    question_text: string;
  },
): InterviewQuestion {
  return {
    id: typeof question.id === 'string' ? question.id : generateId(),
    interview_session_id: question.interview_session_id,
    question_index: question.question_index,
    question_text: question.question_text,
    answer_text: typeof question.answer_text === 'string' ? question.answer_text : null,
    score: toNumberOrNull(question.score),
    feedback: typeof question.feedback === 'string' ? question.feedback : null,
    evaluated_at: typeof question.evaluated_at === 'string' ? question.evaluated_at : null,
    created_at:
      typeof question.created_at === 'string'
        ? question.created_at
        : nowIso(),
  };
}

function getStoredQuestions(): InterviewQuestion[] {
  const raw = safeReadJson<Array<Partial<InterviewQuestion>>>(INTERVIEW_QUESTIONS_KEY, []);
  return raw
    .filter(
      (row) =>
        typeof row.interview_session_id === 'string' &&
        typeof row.question_text === 'string' &&
        typeof row.question_index === 'number',
    )
    .map((row) =>
      makeQuestion({
        interview_session_id: row.interview_session_id as string,
        question_index: row.question_index as number,
        question_text: row.question_text as string,
        ...row,
      }),
    );
}

function setStoredQuestions(questions: InterviewQuestion[]): void {
  safeWriteJson(INTERVIEW_QUESTIONS_KEY, questions);
}

// ── Sessions ───────────────────────────────────────────────────────────────────

export async function getSession(
  sessionId: string,
  userId: string,
): Promise<InterviewSession | null> {
  const sessions = getStoredSessions();
  const row = sessions.find((session) => session.id === sessionId && session.user_id === userId);
  return row ? toInterviewSession(row) : null;
}

/** Upsert a local session row for interview engine persistence. */
export async function upsertSession(
  sessionId: string,
  userId: string,
  jobRole: string,
): Promise<void> {
  const sessions = getStoredSessions();
  const index = sessions.findIndex((session) => session.id === sessionId);

  if (index === -1) {
    sessions.push(
      makeStoredSession({
        id: sessionId,
        user_id: userId,
        job_role: jobRole,
        status: 'created',
        total_score: null,
        summary_feedback: null,
        completed_at: null,
        is_degraded: false,
        started_at: nowIso(),
        created_at: nowIso(),
      }),
    );
  } else {
    sessions[index] = makeStoredSession({
      ...sessions[index],
      id: sessionId,
      user_id: userId,
      job_role: jobRole,
    });
  }

  setStoredSessions(sessions);
}

export async function updateSession(
  sessionId: string,
  userId: string,
  patch: Partial<InterviewSession>,
): Promise<void> {
  const sessions = getStoredSessions();
  const index = sessions.findIndex((session) => session.id === sessionId && session.user_id === userId);
  if (index === -1) return;

  sessions[index] = makeStoredSession({
    ...sessions[index],
    ...patch,
    id: sessions[index].id,
    user_id: sessions[index].user_id,
    job_role: typeof patch.job_role === 'string' ? patch.job_role : sessions[index].job_role,
  });

  setStoredSessions(sessions);
}

// ── Questions ──────────────────────────────────────────────────────────────────

export async function getQuestions(sessionId: string): Promise<InterviewQuestion[]> {
  return getStoredQuestions()
    .filter((question) => question.interview_session_id === sessionId)
    .sort((a, b) => a.question_index - b.question_index);
}

export async function insertQuestions(
  questions: Array<{
    interview_session_id: string;
    question_index: number;
    question_text: string;
  }>,
): Promise<InterviewQuestion[]> {
  const existing = getStoredQuestions();
  const inserted: InterviewQuestion[] = [];

  for (const question of questions) {
    const duplicate = existing.some(
      (row) =>
        row.interview_session_id === question.interview_session_id &&
        row.question_index === question.question_index,
    );

    if (duplicate) continue;

    const created = makeQuestion({
      interview_session_id: question.interview_session_id,
      question_index: question.question_index,
      question_text: question.question_text,
      answer_text: null,
      score: null,
      feedback: null,
      evaluated_at: null,
      created_at: nowIso(),
    });

    existing.push(created);
    inserted.push(created);
  }

  setStoredQuestions(existing);
  return inserted;
}

export async function getQuestion(
  sessionId: string,
  questionIndex: number,
): Promise<InterviewQuestion | null> {
  const row = getStoredQuestions().find(
    (question) =>
      question.interview_session_id === sessionId && question.question_index === questionIndex,
  );
  return row ?? null;
}

/** Atomic write: only updates if answer_text IS NULL (prevents overwrite). Returns false on conflict. */
export async function atomicWriteAnswer(
  sessionId: string,
  questionIndex: number,
  answerText: string,
): Promise<boolean> {
  const questions = getStoredQuestions();
  const index = questions.findIndex(
    (question) =>
      question.interview_session_id === sessionId &&
      question.question_index === questionIndex &&
      question.answer_text === null,
  );

  if (index === -1) return false;

  questions[index] = {
    ...questions[index],
    answer_text: answerText,
  };

  setStoredQuestions(questions);
  return true;
}

export async function writeEvaluation(
  sessionId: string,
  questionIndex: number,
  score: number,
  feedback: string,
): Promise<void> {
  const questions = getStoredQuestions();
  const index = questions.findIndex(
    (question) =>
      question.interview_session_id === sessionId && question.question_index === questionIndex,
  );
  if (index === -1) return;

  questions[index] = {
    ...questions[index],
    score,
    feedback,
    evaluated_at: nowIso(),
  };

  setStoredQuestions(questions);
}
