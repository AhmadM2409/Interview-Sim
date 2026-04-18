import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/api/server.js';
import { createNewDBInstance, destroyDBInstance, get } from '../src/api/db.js';
import { seedActiveSession } from './helpers/db-seed.js';
import { generateMockAuthToken } from './helpers/auth-mock.js';
import { evaluateAnswerWithRetry } from '../src/api/services/llm-retry.js';
import * as llmProvider from '../src/api/services/llm-provider.js';
import * as tavilyProvider from '../src/api/services/tavily-provider.js';
import logger from '../src/api/logger.js';

beforeEach(async () => {
  await createNewDBInstance();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await destroyDBInstance();
});

describe('Phase 5 evaluation engine', () => {
  const token = generateMockAuthToken();

  it('returns structured scores and persists evaluation response', async () => {
    const { sessionId, questionId } = await seedActiveSession('Frontend Engineer');
    vi.spyOn(tavilyProvider, 'fetchRoleContext').mockResolvedValue({
      results: [{ content: 'Mocked context' }],
    });
    vi.spyOn(llmProvider, 'evaluateAnswer').mockResolvedValue({
      technicalScore: 85,
      communicationScore: 78,
      feedback: 'Strong technical explanation with clear structure.',
    });

    const response = await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ transcript: 'I improved query performance by 60 percent through indexing and batching.' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      questionId,
      scores: {
        technicalScore: expect.any(Number),
        communicationScore: expect.any(Number),
        feedback: expect.any(String),
      },
    });

    const row = await get(
      'SELECT technical_score, communication_score, feedback FROM responses WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
      [sessionId],
    );

    expect(row).toBeTruthy();
    expect(row.technical_score).toBeTypeOf('number');
    expect(row.communication_score).toBeTypeOf('number');
  });

  it('supports forced timeout failure injection for evaluation', async () => {
    const { sessionId } = await seedActiveSession('Frontend Engineer');

    const response = await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-test-force-tavily-timeout', 'true')
      .send({ transcript: 'test' });

    expect(response.status).toBe(504);
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: 'Tavily timeout',
    });
  });

  it('retries evaluation validation once and succeeds on second attempt', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    let attempts = 0;

    vi.spyOn(llmProvider, 'evaluateAnswer').mockImplementation(async () => {
      attempts += 1;

      if (attempts === 1) {
        return { notValid: true };
      }

      return {
        technicalScore: 82,
        communicationScore: 76,
        feedback: 'Good structure with useful technical details.',
      };
    });

    const result = await evaluateAnswerWithRetry('session-abc', 'answer text');

    expect(attempts).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, checkpoint: 'evaluate.zod.parse.failed' }),
      'LLM Schema Validation Failed',
    );
    expect(result.technicalScore).toBe(82);
  });
});
