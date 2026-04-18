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

  await run(
    `INSERT INTO sessions (id, role, level, status, is_processing, summary_json, current_question_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
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
    `INSERT INTO questions (id, session_id, question_text, order_index, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [questionId, sessionId, options.questionText ?? 'Tell me about a recent project.', options.orderIndex ?? 1, createdAt],
  );

  return { sessionId, questionId };
};
