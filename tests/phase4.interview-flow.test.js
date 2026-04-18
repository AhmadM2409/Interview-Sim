import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/api/server.js';
import { createNewDBInstance, destroyDBInstance } from '../src/api/db.js';
import { seedActiveSession } from './helpers/db-seed.js';
import { generateMockAuthToken } from './helpers/auth-mock.js';
import * as llmProvider from '../src/api/services/llm-provider.js';
import * as tavilyProvider from '../src/api/services/tavily-provider.js';

beforeEach(async () => {
  await createNewDBInstance();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await destroyDBInstance();
});

describe('Phase 4 interview flow', () => {
  const token = generateMockAuthToken();

  it('fetches current question for active session', async () => {
    const { sessionId, questionId } = await seedActiveSession('Frontend Engineer');

    const response = await request(app)
      .get(`/api/interview/${sessionId}/question/current`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      questionId,
    });
  });

  it('releases lock after forced internal error so next call can proceed', async () => {
    const { sessionId } = await seedActiveSession('Backend Engineer');
    vi.spyOn(tavilyProvider, 'fetchRoleContext').mockResolvedValue({
      results: [{ content: 'Mocked context' }],
    });
    vi.spyOn(llmProvider, 'generateQuestion').mockResolvedValue({
      questionText: 'Mocked follow-up question.',
    });

    const first = await request(app)
      .post(`/api/interview/${sessionId}/question/next`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-test-force-internal-error', 'true')
      .send();

    expect(first.status).toBe(500);

    const second = await request(app)
      .post(`/api/interview/${sessionId}/question/next`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(second.status).toBe(200);
  });

  it('completes idempotently without regenerating summary', async () => {
    const { sessionId } = await seedActiveSession('Data Analyst');
    const summarySpy = vi.spyOn(llmProvider, 'generateSummary').mockResolvedValue({
      overallScore: 82,
      strengths: ['Clear communication'],
      improvements: ['Add more quantitative impact'],
    });

    const first = await request(app)
      .post(`/api/interview/${sessionId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('COMPLETED');

    const second = await request(app)
      .post(`/api/interview/${sessionId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(second.status).toBe(200);
    expect(second.body.data.summary).toStrictEqual(first.body.data.summary);
    expect(summarySpy).toHaveBeenCalledTimes(1);
  });

  it('returns summary only for completed sessions', async () => {
    const activeSeed = await seedActiveSession('Data Analyst');
    const activeResponse = await request(app)
      .get(`/api/interview/${activeSeed.sessionId}/summary`)
      .set('Authorization', `Bearer ${token}`);

    expect(activeResponse.status).toBe(409);

    const completedSeed = await seedActiveSession('Data Analyst', {
      status: 'COMPLETED',
      summaryJson: JSON.stringify({
        overallScore: 88,
        strengths: ['Communication'],
        improvements: ['Depth'],
      }),
    });

    const completedResponse = await request(app)
      .get(`/api/interview/${completedSeed.sessionId}/summary`)
      .set('Authorization', `Bearer ${token}`);

    expect(completedResponse.status).toBe(200);
    expect(completedResponse.body.success).toBe(true);
    expect(completedResponse.body.data.summary).toMatchObject({
      overallScore: 88,
    });
  });
});
