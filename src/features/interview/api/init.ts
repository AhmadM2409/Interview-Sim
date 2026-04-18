import { createServerFn } from '@tanstack/react-start';
import { generateInterviewQuestions } from '../services/llm-interview';
import { fetchJobContext } from '../services/tavily';
import { getQuestions, getSession, insertQuestions, updateSession, upsertSession } from '../utils/supabase';
import { initRequestSchema } from '../schemas';
import type { InitResult } from '../types';

export const initInterviewFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => initRequestSchema.parse(data))
  .handler(async ({ data }): Promise<InitResult> => {
    const { sessionId, jobRole, userId } = data;

    // Ensure session exists in local interview persistence.
    let session = await getSession(sessionId, userId);
    if (!session) {
      await upsertSession(sessionId, userId, jobRole);
      session = await getSession(sessionId, userId);
    }
    if (!session) {
      throw new Error('NOT_FOUND');
    }

    // Idempotency: if questions already exist, return them with resume pointer
    const existing = await getQuestions(sessionId);
    if (existing.length > 0) {
      const activeQuestionIndex = existing.findIndex((q) => q.answer_text === null);
      return {
        questions: existing.map((q) => ({
          question_index: q.question_index,
          question_text: q.question_text,
        })),
        isDegraded: session.is_degraded,
        activeQuestionIndex,
      };
    }

    // Fetch context with Tavily (degrades gracefully)
    const { context, isDegraded } = await fetchJobContext(jobRole);

    // Generate questions via LLM (validates schema, retries 3×)
    const generated = await generateInterviewQuestions(jobRole, context);

    // Write questions to DB
    await insertQuestions(
      generated.map((q) => ({
        interview_session_id: sessionId,
        question_index: q.question_index,
        question_text: q.question_text,
      })),
    );

    // Update session status + degraded flag
    await updateSession(sessionId, userId, {
      status: 'active',
      is_degraded: isDegraded,
    });

    return {
      questions: generated.map((q) => ({
        question_index: q.question_index,
        question_text: q.question_text,
      })),
      isDegraded,
      activeQuestionIndex: 0,
    };
  });
