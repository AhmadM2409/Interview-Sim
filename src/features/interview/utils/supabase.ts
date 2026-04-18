import { env } from '../../../shared/lib/env';
import type { InterviewQuestion, InterviewSession } from '../types';

// Thin Supabase REST client — no SDK needed.

function headers(token?: string) {
  return {
    'Content-Type': 'application/json',
    apikey: env.supabaseKey,
    Authorization: `Bearer ${token ?? env.supabaseKey}`,
    Prefer: 'return=representation',
  };
}

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${env.supabaseUrl}/rest/v1${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase REST ${res.status}: ${text}`);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ([] as unknown as T);
}

// ── Sessions ───────────────────────────────────────────────────────────────────

export async function getSession(
  sessionId: string,
  userId: string,
): Promise<InterviewSession | null> {
  const rows = await rest<InterviewSession[]>(
    `/interview_sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
  );
  return rows[0] ?? null;
}

/** Upsert a session row — used when session exists in localStorage but not yet in Supabase. */
export async function upsertSession(
  sessionId: string,
  userId: string,
  jobRole: string,
): Promise<void> {
  await rest('/interview_sessions', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: sessionId,
      user_id: userId,
      job_role: jobRole,
      status: 'pending',
      is_degraded: false,
      started_at: new Date().toISOString(),
    }),
  });
}

export async function updateSession(
  sessionId: string,
  userId: string,
  patch: Partial<InterviewSession>,
): Promise<void> {
  await rest(
    `/interview_sessions?id=eq.${encodeURIComponent(sessionId)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  );
}

// ── Questions ──────────────────────────────────────────────────────────────────

export async function getQuestions(sessionId: string): Promise<InterviewQuestion[]> {
  return rest<InterviewQuestion[]>(
    `/interview_questions?interview_session_id=eq.${encodeURIComponent(sessionId)}&order=question_index.asc&select=*`,
  );
}

export async function insertQuestions(
  questions: Array<{
    interview_session_id: string;
    question_index: number;
    question_text: string;
  }>,
): Promise<InterviewQuestion[]> {
  return rest<InterviewQuestion[]>('/interview_questions', {
    method: 'POST',
    body: JSON.stringify(questions),
  });
}

export async function getQuestion(
  sessionId: string,
  questionIndex: number,
): Promise<InterviewQuestion | null> {
  const rows = await rest<InterviewQuestion[]>(
    `/interview_questions?interview_session_id=eq.${encodeURIComponent(sessionId)}&question_index=eq.${questionIndex}&select=*`,
  );
  return rows[0] ?? null;
}

/** Atomic write: only updates if answer_text IS NULL (prevents overwrite). Returns false on conflict. */
export async function atomicWriteAnswer(
  sessionId: string,
  questionIndex: number,
  answerText: string,
): Promise<boolean> {
  const res = await fetch(
    `${env.supabaseUrl}/rest/v1/interview_questions?interview_session_id=eq.${encodeURIComponent(sessionId)}&question_index=eq.${questionIndex}&answer_text=is.null`,
    {
      method: 'PATCH',
      headers: {
        ...headers(),
        Prefer: 'return=minimal,count=exact',
      },
      body: JSON.stringify({ answer_text: answerText }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase REST ${res.status}: ${text}`);
  }

  // Content-Range: 0-0/1 means 1 row updated
  const contentRange = res.headers.get('Content-Range') ?? '';
  const match = contentRange.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) > 0 : false;
}

export async function writeEvaluation(
  sessionId: string,
  questionIndex: number,
  score: number,
  feedback: string,
): Promise<void> {
  await rest(
    `/interview_questions?interview_session_id=eq.${encodeURIComponent(sessionId)}&question_index=eq.${questionIndex}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        score,
        feedback,
        evaluated_at: new Date().toISOString(),
      }),
    },
  );
}
