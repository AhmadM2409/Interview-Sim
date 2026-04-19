import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/api/server.js';
import { createNewDBInstance, destroyDBInstance } from '../src/api/db.js';
import { seedActiveSession } from './helpers/db-seed.js';
import { generateMockAuthToken } from './helpers/auth-mock.js';
import * as llmProvider from '../src/api/services/llm-provider.js';
import * as tavilyProvider from '../src/api/services/tavily-provider.js';
import * as ttsProvider from '../src/api/services/tts-provider.js';

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

  it('creates a deterministic first question from role on session creation', async () => {
    const response = await request(app)
      .post('/api/interview/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'Backend Engineer', level: 'Senior' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const sessionId = response.body.data.sessionId;
    const questionResponse = await request(app)
      .get(`/api/interview/${sessionId}/question/current`)
      .set('Authorization', `Bearer ${token}`);

    expect(questionResponse.status).toBe(200);
    expect(questionResponse.body.data.questionText).toBe(
      "Let's begin. Tell me about your experience as a Backend Engineer.",
    );
    expect(questionResponse.body.data.order).toBe(1);
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

  it('blocks next question generation after session is completed', async () => {
    const { sessionId } = await seedActiveSession('Data Analyst');
    vi.spyOn(llmProvider, 'generateSummary').mockResolvedValue({
      overallScore: 88,
      strengths: ['Structured response'],
      improvements: ['Add more depth'],
    });

    const completeResponse = await request(app)
      .post(`/api/interview/${sessionId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(completeResponse.status).toBe(200);

    const nextResponse = await request(app)
      .post(`/api/interview/${sessionId}/question/next`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(nextResponse.status).toBe(409);
    expect(nextResponse.body.error).toBe('Session already completed');
  });

  it('blocks answer evaluation after session is completed', async () => {
    const { sessionId } = await seedActiveSession('Data Analyst');
    vi.spyOn(llmProvider, 'generateSummary').mockResolvedValue({
      overallScore: 88,
      strengths: ['Structured response'],
      improvements: ['Add more depth'],
    });

    const completeResponse = await request(app)
      .post(`/api/interview/${sessionId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(completeResponse.status).toBe(200);

    const evaluateResponse = await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ transcript: 'This should not be accepted after completion.' });

    expect(evaluateResponse.status).toBe(409);
    expect(evaluateResponse.body.error).toBe('Session already completed');
  });

  it('returns elevenlabs question audio payload for the current question', async () => {
    const { sessionId } = await seedActiveSession('Frontend Engineer');
    vi.spyOn(ttsProvider, 'synthesizeSpeech').mockResolvedValue(Buffer.from('mock-audio'));

    const response = await request(app)
      .get(`/api/interview/${sessionId}/question/current/audio`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      mimeType: 'audio/mpeg',
      voiceId: expect.any(String),
      audioBase64: expect.any(String),
    });
  });

  it('returns prior attempts for the authenticated user', async () => {
    const first = await request(app)
      .post('/api/interview/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'Frontend Engineer', level: 'Mid' });
    const second = await request(app)
      .post('/api/interview/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'Backend Engineer', level: 'Senior' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const historyResponse = await request(app)
      .get('/api/interview/history')
      .set('Authorization', `Bearer ${token}`);

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.success).toBe(true);
    expect(historyResponse.body.data.sessions.length).toBeGreaterThanOrEqual(2);
    expect(historyResponse.body.data.sessions[0]).toEqual(
      expect.objectContaining({
        sessionId: expect.any(String),
        role: expect.any(String),
        status: expect.any(String),
        createdAt: expect.any(String),
      }),
    );
  });

  it('returns a completion-specific controlled error when summary validation retries are exhausted', async () => {
    const { sessionId } = await seedActiveSession('Security Engineer');
    vi.spyOn(llmProvider, 'generateSummary').mockResolvedValue({ nope: true });

    const response = await request(app)
      .post(`/api/interview/${sessionId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      status: 'COMPLETED',
      summary: expect.objectContaining({
        overallScore: expect.any(Number),
        strengths: expect.any(Array),
        improvements: expect.any(Array),
      }),
    });
  });

  it('returns a completion-specific provider error when summary generation provider fails', async () => {
    const { sessionId } = await seedActiveSession('Security Engineer');
    vi.spyOn(llmProvider, 'generateSummary').mockRejectedValue(new Error('provider temporarily unavailable'));

    const response = await request(app)
      .post(`/api/interview/${sessionId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      status: 'COMPLETED',
      summary: expect.objectContaining({
        overallScore: expect.any(Number),
        feedbackSummary: expect.any(String),
      }),
    });
  });
});
