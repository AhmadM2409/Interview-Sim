import crypto from 'node:crypto';
import { get, run } from '../db.js';
import { HttpError } from '../errors.js';
import { fetchRoleContext } from './tavily-provider.js';
import {
  evaluateAnswerWithRetry,
  generateQuestionWithRetry,
  generateSummaryWithRetry,
} from './llm-retry.js';
import { summarySchema } from '../schemas.js';
import logger from '../logger.js';

const now = () => new Date().toISOString();

export const getSessionById = async (sessionId) => get('SELECT * FROM sessions WHERE id = ?', [sessionId]);

export const getCurrentQuestionForSession = async (sessionId) =>
  get(
    `SELECT q.*
     FROM questions q
     INNER JOIN sessions s ON s.current_question_id = q.id
     WHERE s.id = ?`,
    [sessionId],
  );

const parseSummary = (rawSummary) => {
  try {
    const parsed = typeof rawSummary === 'string' ? JSON.parse(rawSummary) : rawSummary;
    return summarySchema.parse(parsed);
  } catch (_error) {
    throw new HttpError(500, 'Stored summary is invalid');
  }
};

export const createSession = async ({ role, level }) => {
  const sessionId = crypto.randomUUID();
  const questionId = crypto.randomUUID();
  const createdAt = now();

  await run(
    `INSERT INTO sessions (id, role, level, status, is_processing, summary_json, current_question_id, created_at, updated_at)
     VALUES (?, ?, ?, 'ACTIVE', 0, NULL, ?, ?, ?)`,
    [sessionId, role, level, questionId, createdAt, createdAt],
  );

  await run(
    `INSERT INTO questions (id, session_id, question_text, order_index, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [questionId, sessionId, `Let's begin. Tell me about your experience as a ${role}.`, 1, createdAt],
  );

  return {
    sessionId,
    role,
    level,
    status: 'ACTIVE',
    currentQuestionId: questionId,
  };
};

const getNextQuestionOrder = async (sessionId) => {
  const row = await get('SELECT COALESCE(MAX(order_index), 0) AS max_order FROM questions WHERE session_id = ?', [sessionId]);
  return Number(row?.max_order ?? 0) + 1;
};

export const createNextQuestion = async (sessionId, options = {}) => {
  const session = await getSessionById(sessionId);

  if (!session) {
    throw new HttpError(404, 'Session not found');
  }

  const nextOrder = await getNextQuestionOrder(sessionId);
  const questionId = crypto.randomUUID();
  const context = await fetchRoleContext(session.role, {
    forceTimeout: options.forceTavilyTimeout,
  });
  const generated = await generateQuestionWithRetry(session.role, sessionId, context);
  const questionText = generated.questionText;
  const createdAt = now();

  await run(
    `INSERT INTO questions (id, session_id, question_text, order_index, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [questionId, sessionId, questionText, nextOrder, createdAt],
  );

  await run('UPDATE sessions SET current_question_id = ?, updated_at = ? WHERE id = ?', [questionId, createdAt, sessionId]);

  return {
    questionId,
    questionText,
    order: nextOrder,
  };
};

export const withSessionLock = async (sessionId, handler) => {
  const session = await getSessionById(sessionId);

  if (!session) {
    throw new HttpError(404, 'Session not found');
  }

  if (session.is_processing) {
    throw new HttpError(409, 'Concurrent request locked');
  }

  await run('UPDATE sessions SET is_processing = 1, updated_at = ? WHERE id = ?', [now(), sessionId]);

  try {
    return await handler();
  } finally {
    await run('UPDATE sessions SET is_processing = 0, updated_at = ? WHERE id = ?', [now(), sessionId]);
  }
};

export const getCurrentQuestion = async (sessionId) => {
  const session = await getSessionById(sessionId);

  if (!session) {
    throw new HttpError(404, 'Session not found');
  }

  const currentQuestion = await getCurrentQuestionForSession(sessionId);

  if (!currentQuestion) {
    throw new HttpError(404, 'Current question not found');
  }

  return {
    questionId: currentQuestion.id,
    questionText: currentQuestion.question_text,
    order: currentQuestion.order_index,
  };
};

export const completeSession = async (sessionId) => {
  const session = await getSessionById(sessionId);

  if (!session) {
    throw new HttpError(404, 'Session not found');
  }

  if (session.status === 'COMPLETED' && session.summary_json) {
    return {
      status: 'COMPLETED',
      summary: parseSummary(session.summary_json),
    };
  }

  return withSessionLock(sessionId, async () => {
    const lockedSession = await getSessionById(sessionId);

    if (lockedSession.status === 'COMPLETED' && lockedSession.summary_json) {
      return {
        status: 'COMPLETED',
        summary: parseSummary(lockedSession.summary_json),
      };
    }

    const responses = await get(
      'SELECT COUNT(*) AS count FROM responses WHERE session_id = ?',
      [sessionId],
    );
    const summary = await generateSummaryWithRetry(sessionId, lockedSession.role, {
      responseCount: Number(responses?.count ?? 0),
    });

    await run(
      `UPDATE sessions
       SET status = 'COMPLETED', summary_json = ?, updated_at = ?
       WHERE id = ?`,
      [JSON.stringify(summary), now(), sessionId],
    );

    return {
      status: 'COMPLETED',
      summary,
    };
  });
};

export const getSummary = async (sessionId) => {
  const session = await getSessionById(sessionId);

  if (!session) {
    throw new HttpError(404, 'Session not found');
  }

  if (session.status !== 'COMPLETED' || !session.summary_json) {
    throw new HttpError(409, 'Session is not completed');
  }

  return {
    status: session.status,
    summary: parseSummary(session.summary_json),
  };
};

export const evaluateSessionAnswer = async (sessionId, transcript, options = {}) =>
  withSessionLock(sessionId, async () => {
    const session = await getSessionById(sessionId);

    if (!session) {
      throw new HttpError(404, 'Session not found');
    }
    logger.info(
      { checkpoint: 'evaluate.session.found', sessionId, role: session.role },
      'Evaluate session found',
    );

    if (options.forceInternalError) {
      throw new HttpError(500, 'Forced internal error');
    }

    logger.info(
      { checkpoint: 'evaluate.provider.context.call', sessionId, role: session.role },
      'Evaluate Tavily provider call',
    );
    await fetchRoleContext(session.role, {
      forceTimeout: options.forceTavilyTimeout,
    });
    logger.info(
      { checkpoint: 'evaluate.provider.context.returned', sessionId },
      'Evaluate Tavily provider returned',
    );

    const currentQuestion = await getCurrentQuestionForSession(sessionId);

    if (!currentQuestion) {
      throw new HttpError(404, 'Current question not found');
    }
    logger.info(
      { checkpoint: 'evaluate.question.found', sessionId, questionId: currentQuestion.id },
      'Evaluate current question found',
    );

    logger.info(
      { checkpoint: 'evaluate.provider.llm.call', sessionId },
      'Evaluate LLM provider call',
    );
    const scores = await evaluateAnswerWithRetry(sessionId, transcript);
    logger.info(
      {
        checkpoint: 'evaluate.provider.llm.returned',
        sessionId,
        technicalScore: scores.technicalScore,
        communicationScore: scores.communicationScore,
      },
      'Evaluate LLM provider returned',
    );
    const responseId = crypto.randomUUID();

    await run(
      `INSERT INTO responses (id, session_id, question_id, answer_text, technical_score, communication_score, feedback, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        responseId,
        sessionId,
        currentQuestion.id,
        transcript,
        scores.technicalScore,
        scores.communicationScore,
        scores.feedback,
        now(),
      ],
    );
    logger.info(
      { checkpoint: 'evaluate.db.save.passed', sessionId, responseId },
      'Evaluate DB save passed',
    );

    return {
      questionId: currentQuestion.id,
      scores,
    };
  });
