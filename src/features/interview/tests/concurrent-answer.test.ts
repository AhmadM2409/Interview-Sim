/**
 * TDD-03: Concurrent answer lock — exactly one wins, other gets CONFLICT
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { atomicWriteAnswer, insertQuestions } from '../utils/supabase';

describe('TDD-03: Concurrent answer lock', () => {
  afterEach(() => vi.restoreAllMocks());

  it('only one concurrent write succeeds when answer_text was null', async () => {
    const sessionId = `concurrency-sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    await insertQuestions([
      {
        interview_session_id: sessionId,
        question_index: 0,
        question_text: 'Concurrency question',
      },
    ]);

    // Simulate two concurrent writes
    const [result1, result2] = await Promise.all([
      atomicWriteAnswer(sessionId, 0, 'First answer'),
      atomicWriteAnswer(sessionId, 0, 'Second answer'),
    ]);

    const successes = [result1, result2].filter(Boolean);
    const conflicts = [result1, result2].filter((r) => !r);

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
  });
});
