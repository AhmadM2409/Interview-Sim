import { createServerFn } from '@tanstack/react-start';
import { atomicWriteAnswer, getSession } from '../utils/supabase';
import { answerRequestSchema } from '../schemas';
import type { AnswerResult } from '../types';

export const answerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => answerRequestSchema.parse(data))
  .handler(async ({ data }): Promise<AnswerResult> => {
    const { sessionId, questionIndex, answerText, userId } = data;

    // Auth isolation
    const session = await getSession(sessionId, userId);
    if (!session) throw new Error('NOT_FOUND');

    // Atomic write: WHERE answer_text IS NULL prevents double-write
    // Returns conflict:true if already written — caller treats as idempotent success
    const updated = await atomicWriteAnswer(sessionId, questionIndex, answerText);
    return { ok: true, conflict: !updated };
  });
