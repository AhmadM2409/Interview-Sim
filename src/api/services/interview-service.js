import crypto from 'node:crypto';
import { all, get, run } from '../db.js';
import { HttpError } from '../errors.js';
import { fetchRoleContext } from './tavily-provider.js';
import {
  evaluateAnswerWithRetry,
  generateQuestionWithRetry,
  generateSummaryWithRetry,
} from './llm-retry.js';
import { summarySchema } from '../schemas.js';
import logger from '../logger.js';
import { synthesizeSpeech } from './tts-provider.js';
import { config } from '../config.js';
import { buildFallbackSummary } from './llm-provider.js';

const now = () => new Date().toISOString();

const deterministicOpeningQuestion = (role) => `Let's begin. Tell me about your experience as a ${role}.`;

const roundScore = (value) => Math.round(Number(value));
const normalizeTranscript = (value) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
const normalizeCode = (value) =>
  typeof value === 'string' ? value.replace(/\r\n/g, '\n').trimEnd() : '';
const missingResponsePattern = /no response provided/i;
const clampScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

const buildLowSignalVerbalEvaluation = () => ({
  technicalScore: 5,
  communicationScore: 12,
  feedback:
    'A response was provided, but it did not clearly answer the question. Add more technical detail or explain your reasoning step by step.',
});

const normalizeVerbalEvaluation = (transcript, scores) => {
  const normalizedTranscript = normalizeTranscript(transcript);

  if (!normalizedTranscript) {
    return scores;
  }

  if (missingResponsePattern.test(scores?.feedback ?? '')) {
    return buildLowSignalVerbalEvaluation();
  }

  return scores;
};

const scoreCodingAnswer = ({ code, language }) => {
  const normalizedCode = normalizeCode(code).trim();

  if (!normalizedCode) {
    return {
      technicalScore: 0,
      communicationScore: 0,
      feedback: 'No code provided for evaluation.',
    };
  }

  let technicalScore = 18;
  let communicationScore = 28;

  if (/function\s+\w+|\=\>\s*\{?/.test(normalizedCode)) {
    technicalScore += 20;
  }

  if (/\breturn\b/.test(normalizedCode)) {
    technicalScore += 18;
  }

  if (/\b(if|for|while|map|filter|reduce|try|catch)\b/.test(normalizedCode)) {
    technicalScore += 14;
  }

  if (/\bsplit\b|\bjoin\b|\bpush\b|\bpop\b|\bshift\b|\bunshift\b/.test(normalizedCode)) {
    technicalScore += 12;
  }

  if (normalizedCode.split('\n').length >= 3) {
    communicationScore += 15;
  }

  if (/\/\/|\/\*/.test(normalizedCode)) {
    communicationScore += 8;
  }

  if (/\bconst\b|\blet\b/.test(normalizedCode)) {
    communicationScore += 8;
  }

  const normalizedLanguage = normalizeTranscript(language) || 'javascript';
  const finalTechnical = clampScore(technicalScore);
  const finalCommunication = clampScore(communicationScore);
  const feedback =
    finalTechnical >= 65
      ? `Promising ${normalizedLanguage} solution. Keep checking edge cases and explain the tradeoffs behind your implementation choices.`
      : `Code was submitted, but the ${normalizedLanguage} solution needs more complete logic or clearer structure to show interview-ready problem solving.`;

  return {
    technicalScore: finalTechnical,
    communicationScore: finalCommunication,
    feedback,
  };
};

export const getSessionById = async (sessionId) => get('SELECT * FROM sessions WHERE id = ?', [sessionId]);

export const getCurrentQuestionForSession = async (sessionId) =>
  get(
    `SELECT q.*
     FROM questions q
     INNER JOIN sessions s ON s.current_question_id = q.id
     WHERE s.id = ?`,
    [sessionId],
  );

const getFirstQuestionForSession = async (sessionId) =>
  get(
    `SELECT *
     FROM questions
     WHERE session_id = ?
     ORDER BY order_index ASC, created_at ASC
     LIMIT 1`,
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

const buildSummaryInput = async (sessionId) => {
  const rows = await all(
    `SELECT r.answer_text, r.answer_type, r.language AS answer_language, r.technical_score, r.communication_score, r.feedback, q.question_text, q.question_type, q.language AS question_language, q.order_index
     FROM responses r
     INNER JOIN questions q ON q.id = r.question_id
     WHERE r.session_id = ?
     ORDER BY q.order_index ASC, r.created_at ASC`,
    [sessionId],
  );

  const scoredRows = rows.filter(
    (row) => typeof row.technical_score === 'number' && typeof row.communication_score === 'number',
  );

  const responseCount = rows.length;
  const technicalAverage =
    scoredRows.length > 0
      ? roundScore(scoredRows.reduce((total, row) => total + row.technical_score, 0) / scoredRows.length)
      : null;
  const communicationAverage =
    scoredRows.length > 0
      ? roundScore(scoredRows.reduce((total, row) => total + row.communication_score, 0) / scoredRows.length)
      : null;
  const feedbackSnippets = rows
    .map((row) => row.feedback)
    .filter((feedback) => typeof feedback === 'string' && feedback.trim().length > 0)
    .slice(0, 3);
  const responses = rows.map((row) => ({
    questionText: row.question_text,
    questionType: row.question_type,
    questionLanguage: row.question_language,
    answerText: row.answer_text,
    answerType: row.answer_type,
    answerLanguage: row.answer_language,
    technicalScore: row.technical_score,
    communicationScore: row.communication_score,
    feedback: row.feedback,
    order: row.order_index,
  }));

  return {
    responseCount,
    technicalAverage,
    communicationAverage,
    feedbackSnippets,
    responses,
  };
};

const enrichSummary = (summary, stats) => ({
  ...summary,
  technicalScore:
    typeof summary.technicalScore === 'number' ? summary.technicalScore : stats.technicalAverage,
  communicationScore:
    typeof summary.communicationScore === 'number'
      ? summary.communicationScore
      : stats.communicationAverage,
  feedbackSummary:
    typeof summary.feedbackSummary === 'string' && summary.feedbackSummary.trim().length > 0
      ? summary.feedbackSummary
      : (stats.feedbackSnippets[0] ?? null),
});

const getNextQuestionOrder = async (sessionId) => {
  const row = await get('SELECT COALESCE(MAX(order_index), 0) AS max_order FROM questions WHERE session_id = ?', [sessionId]);
  return Number(row?.max_order ?? 0) + 1;
};

export const createSession = async ({ role, level, userSub }) => {
  const sessionId = crypto.randomUUID();
  const questionId = crypto.randomUUID();
  const createdAt = now();
  const openingQuestion = deterministicOpeningQuestion(role);

  await run(
    `INSERT INTO sessions (id, user_sub, role, level, status, is_processing, summary_json, current_question_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'ACTIVE', 0, NULL, ?, ?, ?)`,
    [sessionId, userSub ?? 'google-oauth2|mock-user', role, level, questionId, createdAt, createdAt],
  );

  await run(
    `INSERT INTO questions (id, session_id, question_text, question_type, language, order_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [questionId, sessionId, openingQuestion, 'verbal', null, 1, createdAt],
  );

  return {
    sessionId,
    role,
    level,
    status: 'ACTIVE',
    currentQuestionId: questionId,
    currentQuestionText: openingQuestion,
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

  let currentQuestion = await getCurrentQuestionForSession(sessionId);

  if (!currentQuestion) {
    const firstQuestion = await getFirstQuestionForSession(sessionId);

    if (firstQuestion) {
      await run('UPDATE sessions SET current_question_id = ?, updated_at = ? WHERE id = ?', [
        firstQuestion.id,
        now(),
        sessionId,
      ]);
      currentQuestion = firstQuestion;
    } else {
      const questionId = crypto.randomUUID();
      const questionText = deterministicOpeningQuestion(session.role);
      await run(
        `INSERT INTO questions (id, session_id, question_text, question_type, language, order_index, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [questionId, sessionId, questionText, 'verbal', null, 1, now()],
      );
      await run('UPDATE sessions SET current_question_id = ?, updated_at = ? WHERE id = ?', [questionId, now(), sessionId]);
      currentQuestion = {
        id: questionId,
        question_text: questionText,
        question_type: 'verbal',
        language: null,
        order_index: 1,
      };
    }
  }

  return {
    questionId: currentQuestion.id,
    questionText: currentQuestion.question_text,
    type: currentQuestion.question_type ?? 'verbal',
    language: currentQuestion.language ?? null,
    order: currentQuestion.order_index,
  };
};

export const createNextQuestion = async (sessionId, options = {}) => {
  const session = await getSessionById(sessionId);

  if (!session) {
    throw new HttpError(404, 'Session not found');
  }

  if (session.status === 'COMPLETED') {
    throw new HttpError(409, 'Session already completed');
  }

  const nextOrder = await getNextQuestionOrder(sessionId);
  const questionId = crypto.randomUUID();
  const context = await fetchRoleContext(session.role, {
    forceTimeout: options.forceTavilyTimeout,
  });
  const generated = await generateQuestionWithRetry(session.role, sessionId, context);
  const questionText = generated.questionText;
  const questionType = generated.type ?? 'verbal';
  const language = questionType === 'coding' ? generated.language ?? 'javascript' : null;
  const createdAt = now();

  await run(
    `INSERT INTO questions (id, session_id, question_text, question_type, language, order_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [questionId, sessionId, questionText, questionType, language, nextOrder, createdAt],
  );

  await run('UPDATE sessions SET current_question_id = ?, updated_at = ? WHERE id = ?', [questionId, createdAt, sessionId]);

  return {
    questionId,
    questionText,
    type: questionType,
    language,
    order: nextOrder,
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
    logger.info(
      {
        checkpoint: 'complete.session.state',
        sessionId,
        status: lockedSession?.status,
      },
      'Completion session state loaded',
    );

    if (lockedSession.status === 'COMPLETED' && lockedSession.summary_json) {
      return {
        status: 'COMPLETED',
        summary: parseSummary(lockedSession.summary_json),
      };
    }

    const summaryInput = await buildSummaryInput(sessionId);
    logger.info(
      {
        checkpoint: 'complete.summary.input.prepared',
        sessionId,
        responseCount: summaryInput.responseCount,
      },
      'Completion summary input prepared',
    );
    let summary;

    try {
      logger.info(
        {
          checkpoint: 'complete.provider.call',
          sessionId,
        },
        'Completion summary provider call',
      );
      summary = await generateSummaryWithRetry(sessionId, lockedSession.role, summaryInput);
      logger.info(
        {
          checkpoint: 'complete.provider.returned',
          sessionId,
        },
        'Completion summary provider returned',
      );
    } catch (error) {
      logger.warn(
        {
          checkpoint: 'complete.summary.fallback.used',
          sessionId,
          errorMessage: error?.message,
          statusCode: error?.statusCode,
        },
        'Completion summary fell back to deterministic aggregation',
      );
      summary = buildFallbackSummary(lockedSession.role, summaryInput, null);
    }

    const enrichedSummary = enrichSummary(summary, summaryInput);

    await run(
      `UPDATE sessions
       SET status = 'COMPLETED', summary_json = ?, updated_at = ?
       WHERE id = ?`,
      [JSON.stringify(enrichedSummary), now(), sessionId],
    );
    logger.info(
      {
        checkpoint: 'complete.db.write.passed',
        sessionId,
      },
      'Completion summary saved',
    );

    return {
      status: 'COMPLETED',
      summary: enrichedSummary,
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

export const listSessionHistory = async (userSub) => {
  const rows = await all(
    `SELECT id, role, level, status, summary_json, created_at, updated_at
     FROM sessions
     WHERE user_sub = ?
     ORDER BY datetime(created_at) DESC`,
    [userSub],
  );

  logger.info(
    {
      checkpoint: 'history.sessions.loaded',
      userSub,
      sessionCount: rows.length,
    },
    'Interview history loaded',
  );

  return {
    sessions: rows.map((row) => {
      const parsedSummary = row.summary_json ? parseSummary(row.summary_json) : null;
      return {
        sessionId: row.id,
        role: row.role,
        level: row.level,
        status: row.status,
        finalScore: parsedSummary?.overallScore ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }),
  };
};

export const getCurrentQuestionAudio = async (sessionId) => {
  const currentQuestion = await getCurrentQuestion(sessionId);

  try {
    const audioBuffer = await synthesizeSpeech(currentQuestion.questionText, config.elevenLabsDefaultVoiceId);
    logger.info(
      {
        checkpoint: 'tts.audio.generated',
        sessionId,
        questionId: currentQuestion.questionId,
        voiceId: config.elevenLabsDefaultVoiceId,
      },
      'Question audio generated',
    );

    return {
      questionId: currentQuestion.questionId,
      voiceId: config.elevenLabsDefaultVoiceId,
      mimeType: 'audio/mpeg',
      audioBase64: audioBuffer.toString('base64'),
    };
  } catch (error) {
    logger.error(
      {
        checkpoint: 'tts.audio.generation.failed',
        sessionId,
        errorMessage: error?.message,
      },
      'Question audio generation failed',
    );
    throw new HttpError(502, 'Question audio generation failed');
  }
};

export const evaluateSessionAnswer = async (sessionId, payload, options = {}) =>
  withSessionLock(sessionId, async () => {
    const session = await getSessionById(sessionId);

    if (!session) {
      throw new HttpError(404, 'Session not found');
    }
    logger.info(
      { checkpoint: 'evaluate.session.found', sessionId, role: session.role },
      'Evaluate session found',
    );

    if (session.status === 'COMPLETED') {
      throw new HttpError(409, 'Session already completed');
    }

    if (options.forceInternalError) {
      throw new HttpError(500, 'Forced internal error');
    }

    const currentQuestion = await getCurrentQuestionForSession(sessionId);

    if (!currentQuestion) {
      throw new HttpError(404, 'Current question not found');
    }
    logger.info(
      { checkpoint: 'evaluate.question.found', sessionId, questionId: currentQuestion.id },
      'Evaluate current question found',
    );

    const questionType = currentQuestion.question_type ?? 'verbal';
    const normalizedTranscript = normalizeTranscript(payload?.transcript);
    const normalizedCode = normalizeCode(payload?.code);
    const answerLanguage =
      normalizeTranscript(payload?.language) || currentQuestion.language || 'javascript';

    logger.info(
      {
        checkpoint: 'evaluate.answer.received',
        sessionId,
        questionType,
        requestedAnswerType: payload?.type,
        transcriptLength: normalizedTranscript.length,
        codeLength: normalizedCode.length,
      },
      'Evaluate answer received',
    );

    if (payload?.type && payload.type !== questionType) {
      throw new HttpError(400, `Answer type ${payload.type} does not match current ${questionType} question`);
    }

    let scores;
    let answerTextToStore;
    let answerType;
    let languageToStore = null;

    if (questionType === 'coding') {
      if (!normalizedCode.trim()) {
        throw new HttpError(400, 'Code answer is required for coding questions');
      }

      logger.info(
        {
          checkpoint: 'evaluate.answer.normalized',
          sessionId,
          classificationPath: 'coding.provided',
          language: answerLanguage,
        },
        'Coding answer normalized',
      );

      scores = scoreCodingAnswer({
        code: normalizedCode,
        language: answerLanguage,
      });
      answerTextToStore = normalizedCode;
      answerType = 'coding';
      languageToStore = answerLanguage;
    } else {
      if (!normalizedTranscript) {
        throw new HttpError(400, 'Transcript is required for verbal questions');
      }

      logger.info(
        {
          checkpoint: 'evaluate.answer.normalized',
          sessionId,
          classificationPath: 'verbal.provided',
          normalizedTranscript,
        },
        'Verbal answer normalized',
      );

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

      logger.info(
        { checkpoint: 'evaluate.provider.llm.call', sessionId },
        'Evaluate LLM provider call',
      );
      scores = normalizeVerbalEvaluation(
        normalizedTranscript,
        await evaluateAnswerWithRetry(sessionId, normalizedTranscript),
      );
      logger.info(
        {
          checkpoint: 'evaluate.provider.llm.returned',
          sessionId,
          technicalScore: scores.technicalScore,
          communicationScore: scores.communicationScore,
        },
        'Evaluate LLM provider returned',
      );
      answerTextToStore = normalizedTranscript;
      answerType = 'verbal';
    }

    const responseId = crypto.randomUUID();

    await run(
      `INSERT INTO responses (id, session_id, question_id, answer_text, answer_type, language, technical_score, communication_score, feedback, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        responseId,
        sessionId,
        currentQuestion.id,
        answerTextToStore,
        answerType,
        languageToStore,
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
