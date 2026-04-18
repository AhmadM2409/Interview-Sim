import { createServerFn } from '@tanstack/react-start';
import { evaluateAnswer } from '../services/llm-interview';
import { getQuestion, getSession, writeEvaluation } from '../utils/supabase';
import { evaluateRequestSchema } from '../schemas';
import type { EvaluateResult } from '../types';

export const evaluateFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => evaluateRequestSchema.parse(data))
  .handler(async ({ data }): Promise<EvaluateResult> => {
    const { sessionId, questionIndex, userId } = data;

    // Auth isolation
    const session = await getSession(sessionId, userId);
    if (!session) throw new Error('NOT_FOUND');

    const question = await getQuestion(sessionId, questionIndex);
    if (!question) throw new Error('NOT_FOUND');

    // Idempotency: if already evaluated, return existing score
    if (question.score !== null && question.feedback !== null) {
      return { score: question.score, feedback: question.feedback };
    }

    if (!question.answer_text) {
      throw new Error('ANSWER_MISSING');
    }

    // Evaluate via LLM (validates schema, retries 3×)
    const result = await evaluateAnswer(
      session.job_role,
      question.question_text,
      question.answer_text,
    );

    // Persist evaluation
    await writeEvaluation(sessionId, questionIndex, result.score, result.feedback);

    return { score: result.score, feedback: result.feedback };
  });
