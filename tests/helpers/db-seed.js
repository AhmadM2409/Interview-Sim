import crypto from 'node:crypto';
import { run } from '../../src/api/db.js';

const now = () => new Date().toISOString();

export const seedActiveSession = async (role, options = {}) => {
  const sessionId = options.sessionId ?? crypto.randomUUID();
  const questionId = options.questionId ?? crypto.randomUUID();
  const createdAt = now();
  const status = options.status ?? 'ACTIVE';
  const level = options.level ?? 'Mid';
  const isProcessing = options.isProcessing ? 1 : 0;
  const userSub = options.userSub ?? 'google-oauth2|mock-user';

  await run(
    `INSERT INTO sessions (id, user_sub, role, level, status, is_processing, summary_json, current_question_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      userSub,
      role,
      level,
      status,
      isProcessing,
      options.summaryJson ?? null,
      questionId,
      createdAt,
      createdAt,
    ],
  );

  await run(
    `INSERT INTO questions (id, session_id, question_text, question_type, language, order_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      questionId,
      sessionId,
      options.questionText ?? 'Tell me about a recent project.',
      options.questionType ?? 'verbal',
      options.language ?? null,
      options.orderIndex ?? 1,
      createdAt,
    ],
  );

  return { sessionId, questionId };
};
