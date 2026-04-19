import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/api/server.js';
import { createNewDBInstance, destroyDBInstance, get } from '../src/api/db.js';
import { generateMockAuthToken } from './helpers/auth-mock.js';
import { seedActiveSession } from './helpers/db-seed.js';
import * as llmProvider from '../src/api/services/llm-provider.js';
import * as tavilyProvider from '../src/api/services/tavily-provider.js';

beforeEach(async () => {
  await createNewDBInstance();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await destroyDBInstance();
});

describe('Phase 6 coding mode stub', () => {
  it('rejects unauthorized coding setup calls', async () => {
    const response = await request(app).post('/api/coding/setup').send({ language: 'javascript' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: 'Unauthorized',
    });
  });

  it('returns scaffold response for authorized coding setup', async () => {
    const token = generateMockAuthToken();

    const response = await request(app)
      .post('/api/coding/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'javascript' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        mode: 'coding',
        status: 'stub',
        message: 'Coding setup scaffold ready for UI integration.',
      },
      error: null,
    });
  });

  it('returns coding questions with a coding type and language', async () => {
    const token = generateMockAuthToken();
    const { sessionId } = await seedActiveSession('Frontend Engineer');
    vi.spyOn(tavilyProvider, 'fetchRoleContext').mockResolvedValue({
      results: [{ content: 'Mocked context' }],
    });
    vi.spyOn(llmProvider, 'generateQuestion').mockResolvedValue({
      questionText: 'Write a JavaScript function that reverses a string.',
      type: 'coding',
      language: 'javascript',
    });

    const response = await request(app)
      .post(`/api/interview/${sessionId}/question/next`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      questionText: 'Write a JavaScript function that reverses a string.',
      type: 'coding',
      language: 'javascript',
    });
  });

  it('evaluates coding answers through the coding path and persists the code answer', async () => {
    const token = generateMockAuthToken();
    const { sessionId } = await seedActiveSession('Frontend Engineer', {
      questionText: 'Write a JavaScript function that reverses a string.',
      questionType: 'coding',
      language: 'javascript',
    });

    const response = await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: 'function reverseString(value) { return value.split(\"\").reverse().join(\"\"); }',
        language: 'javascript',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.scores).toEqual({
      technicalScore: expect.any(Number),
      communicationScore: expect.any(Number),
      feedback: expect.any(String),
    });

    const row = await get(
      'SELECT answer_text, answer_type, language FROM responses WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
      [sessionId],
    );

    expect(row).toEqual(
      expect.objectContaining({
        answer_text: expect.stringContaining('reverseString'),
        answer_type: 'coding',
        language: 'javascript',
      }),
    );
  });
});
