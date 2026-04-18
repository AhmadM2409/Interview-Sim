/**
 * TDD-03: Concurrent answer lock — exactly one wins, other gets CONFLICT
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { atomicWriteAnswer } from '../utils/supabase';

describe('TDD-03: Concurrent answer lock', () => {
  afterEach(() => vi.restoreAllMocks());

  it('only one concurrent write succeeds when answer_text was null', async () => {
    let firstCall = true;

    // Simulate Supabase's atomic WHERE answer_text IS NULL behavior:
    // First PATCH finds 1 row (null), second PATCH finds 0 rows (already set)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = init?.body ? String(init.body) : '';

        if (init?.method === 'PATCH' && body.includes('answer_text')) {
          const won = firstCall;
          firstCall = false;

          return {
            ok: true,
            headers: {
              get: (key: string) => (key === 'Content-Range' ? `0-0/${won ? 1 : 0}` : null),
            },
            text: async () => '',
          };
        }

        return { ok: true, text: async () => '[]', json: async () => [] };
      }),
    );

    // Simulate two concurrent writes
    const [result1, result2] = await Promise.all([
      atomicWriteAnswer('sess-abc', 0, 'First answer'),
      atomicWriteAnswer('sess-abc', 0, 'Second answer'),
    ]);

    const successes = [result1, result2].filter(Boolean);
    const conflicts = [result1, result2].filter((r) => !r);

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
  });
});
