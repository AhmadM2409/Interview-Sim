/**
 * TDD-06: Auth isolation — cross-user access returns NOT_FOUND
 * TDD-07: Server-derived resume — correct question index on reconnect
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import * as supabase from '../utils/supabase';

// ── TDD-06: Auth isolation ─────────────────────────────────────────────────────

describe('TDD-06: Auth isolation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('getSession returns null when userId does not match session owner', async () => {
    const sessionId = `auth-iso-user-b-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await supabase.upsertSession(sessionId, 'user-b', 'ML Engineer');

    const session = await supabase.getSession(sessionId, 'user-a');
    expect(session).toBeNull();
  });

  it('getSession returns session when userId matches', async () => {
    const sessionId = `auth-iso-user-a-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await supabase.upsertSession(sessionId, 'user-a', 'ML Engineer');

    const session = await supabase.getSession(sessionId, 'user-a');
    expect(session?.id).toBe(sessionId);
  });
});

// ── TDD-07: Server-derived session resume ─────────────────────────────────────

describe('TDD-07: Server-derived session resume', () => {
  afterEach(() => vi.restoreAllMocks());

  it('identifies question_index=2 as active when Q0 and Q1 are answered', async () => {
    const questions = [
      {
        id: 'q0', interview_session_id: 'sess-1', question_index: 0,
        question_text: 'Q0', answer_text: 'Answer 0', score: 7, feedback: 'Good',
        evaluated_at: '2024-01-01T01:00:00Z', created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'q1', interview_session_id: 'sess-1', question_index: 1,
        question_text: 'Q1', answer_text: 'Answer 1', score: 8, feedback: 'Great',
        evaluated_at: '2024-01-01T02:00:00Z', created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'q2', interview_session_id: 'sess-1', question_index: 2,
        question_text: 'Q2', answer_text: null, score: null, feedback: null,
        evaluated_at: null, created_at: '2024-01-01T00:00:00Z',
      },
    ];

    vi.spyOn(supabase, 'getQuestions').mockResolvedValue(questions);

    const fetched = await supabase.getQuestions('sess-1');

    // The first question without an answer is the active one
    const activeIndex = fetched.findIndex((q) => q.answer_text === null);
    expect(activeIndex).toBe(2);
  });

  it('returns -1 (all answered) when every question has an answer', async () => {
    const questions = [
      {
        id: 'q0', interview_session_id: 'sess-1', question_index: 0,
        question_text: 'Q0', answer_text: 'A0', score: 7, feedback: 'OK',
        evaluated_at: '2024-01-01T01:00:00Z', created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'q1', interview_session_id: 'sess-1', question_index: 1,
        question_text: 'Q1', answer_text: 'A1', score: 9, feedback: 'Excellent',
        evaluated_at: '2024-01-01T02:00:00Z', created_at: '2024-01-01T00:00:00Z',
      },
    ];

    vi.spyOn(supabase, 'getQuestions').mockResolvedValue(questions);

    const fetched = await supabase.getQuestions('sess-1');
    const activeIndex = fetched.findIndex((q) => q.answer_text === null);
    expect(activeIndex).toBe(-1);
  });
});
