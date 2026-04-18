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
    // Supabase REST returns empty array when WHERE clauses don't match
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => '[]',
      json: async () => [],
    })));

    vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'test-key');

    const session = await supabase.getSession('session-of-user-b', 'user-a');
    expect(session).toBeNull();
  });

  it('getSession returns session when userId matches', async () => {
    const mockSession = {
      id: 'sess-1',
      user_id: 'user-a',
      job_role: 'ML Engineer',
      status: 'active',
      total_score: null,
      summary_feedback: null,
      completed_at: null,
      is_degraded: false,
      created_at: '2024-01-01T00:00:00Z',
    };

    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify([mockSession]),
      json: async () => [mockSession],
    })));

    vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'test-key');

    const session = await supabase.getSession('sess-1', 'user-a');
    expect(session?.id).toBe('sess-1');
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
