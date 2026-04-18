import { createServerFn } from '@tanstack/react-start';
import { generateSummaryFeedback } from '../services/llm-interview';
import { getQuestions, getSession, updateSession } from '../utils/supabase';
import { completeRequestSchema } from '../schemas';
import type { CompleteResult } from '../types';

export const completeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => completeRequestSchema.parse(data))
  .handler(async ({ data }): Promise<CompleteResult> => {
    const { sessionId, userId } = data;

    // Auth isolation
    const session = await getSession(sessionId, userId);
    if (!session) throw new Error('NOT_FOUND');

    // Already completed — return idempotently
    if (session.status === 'completed') {
      return {
        totalScore: session.total_score ?? 0,
        summaryFeedback: session.summary_feedback ?? '',
        isDegraded: session.is_degraded,
      };
    }

    const questions = await getQuestions(sessionId);

    // 422 precondition: every question must have answer + score
    const incomplete = questions.filter((q) => q.answer_text === null || q.score === null);
    if (incomplete.length > 0) {
      throw new Error('INCOMPLETE');
    }

    const totalScore =
      questions.reduce((sum, q) => sum + (q.score ?? 0), 0) / questions.length;

    const summaryFeedback = await generateSummaryFeedback(
      session.job_role,
      questions.map((q) => ({
        question_text: q.question_text,
        answer_text: q.answer_text,
        score: q.score,
        feedback: q.feedback,
      })),
      totalScore,
    );

    await updateSession(sessionId, userId, {
      status: 'completed',
      total_score: Math.round(totalScore * 10) / 10,
      summary_feedback: summaryFeedback,
      completed_at: new Date().toISOString(),
    });

    return {
      totalScore: Math.round(totalScore * 10) / 10,
      summaryFeedback,
      isDegraded: session.is_degraded,
    };
  });
