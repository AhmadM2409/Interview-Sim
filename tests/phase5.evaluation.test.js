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
  vi.unstubAllGlobals();
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
      .send({ type: 'verbal', transcript: 'I improved query performance by 60 percent through indexing and batching.' });

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

  it('does not classify a non-empty answer as missing even if the provider does', async () => {
    const { sessionId } = await seedActiveSession('Frontend Engineer');
    vi.spyOn(tavilyProvider, 'fetchRoleContext').mockResolvedValue({
      results: [{ content: 'Mocked context' }],
    });
    vi.spyOn(llmProvider, 'evaluateAnswer').mockResolvedValue({
      technicalScore: 0,
      communicationScore: 0,
      feedback: 'No response provided for evaluation.',
    });

    const response = await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'verbal', transcript: 'WTRF' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.scores).toEqual({
      technicalScore: expect.any(Number),
      communicationScore: expect.any(Number),
      feedback: 'A response was provided, but it did not clearly answer the question. Add more technical detail or explain your reasoning step by step.',
    });
    expect(response.body.data.scores.technicalScore).toBeGreaterThanOrEqual(1);
    expect(response.body.data.scores.communicationScore).toBeGreaterThanOrEqual(1);
  });

  it('supports forced timeout failure injection for evaluation', async () => {
    const { sessionId } = await seedActiveSession('Frontend Engineer');

    const response = await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-test-force-tavily-timeout', 'true')
      .send({ type: 'verbal', transcript: 'test' });

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

  it('produces technical and communication summary breakdown from mixed answer quality', async () => {
    const { sessionId } = await seedActiveSession('Backend Engineer');
    vi.spyOn(tavilyProvider, 'fetchRoleContext').mockResolvedValue({
      results: [{ content: 'Mocked context' }],
    });

    vi.spyOn(llmProvider, 'evaluateAnswer').mockImplementation(async ({ transcript }) => {
      const normalized = transcript.toLowerCase();

      if (normalized.includes('offensive')) {
        return {
          technicalScore: 18,
          communicationScore: 20,
          feedback: 'Response was off-topic and unprofessional.',
        };
      }

      if (normalized.length < 16) {
        return {
          technicalScore: 30,
          communicationScore: 35,
          feedback: 'Too brief and lacking specifics.',
        };
      }

      return {
        technicalScore: 90,
        communicationScore: 84,
        feedback: 'Strong, specific, and structured answer.',
      };
    });

    vi.spyOn(llmProvider, 'generateSummary').mockResolvedValue({
      overallScore: 72,
      strengths: ['Clear examples'],
      improvements: ['Keep tone professional'],
    });

    await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'verbal',
        transcript: 'I redesigned our caching and API pagination strategy and cut p95 latency by 40 percent.',
      });

    await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'verbal', transcript: 'ok' });

    await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'verbal', transcript: 'offensive irrelevant answer' });

    const complete = await request(app)
      .post(`/api/interview/${sessionId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(complete.status).toBe(200);
    expect(complete.body.data.summary.technicalScore).toBeTypeOf('number');
    expect(complete.body.data.summary.communicationScore).toBeTypeOf('number');
    expect(complete.body.data.summary.feedbackSummary).toBeTypeOf('string');

    const summary = await request(app)
      .get(`/api/interview/${sessionId}/summary`)
      .set('Authorization', `Bearer ${token}`);

    expect(summary.status).toBe(200);
    expect(summary.body.data.summary.technicalScore).toBeGreaterThanOrEqual(0);
    expect(summary.body.data.summary.communicationScore).toBeGreaterThanOrEqual(0);
  });

  it('keeps summary breakdown nullable for incomplete sessions with no responses', async () => {
    const { sessionId } = await seedActiveSession('Data Engineer');

    vi.spyOn(llmProvider, 'generateSummary').mockResolvedValue({
      overallScore: 50,
      strengths: ['Started the interview'],
      improvements: ['Add concrete technical examples'],
    });

    const complete = await request(app)
      .post(`/api/interview/${sessionId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(complete.status).toBe(200);
    expect(complete.body.data.summary).toMatchObject({
      technicalScore: null,
      communicationScore: null,
    });
  });

  it('passes real session answers and feedback into summary generation', async () => {
    const { sessionId } = await seedActiveSession('Platform Engineer');
    vi.spyOn(tavilyProvider, 'fetchRoleContext').mockResolvedValue({
      results: [{ content: 'Mocked context' }],
    });

    vi.spyOn(llmProvider, 'evaluateAnswer')
      .mockResolvedValueOnce({
        technicalScore: 92,
        communicationScore: 88,
        feedback: 'Excellent technical depth.',
      })
      .mockResolvedValueOnce({
        technicalScore: 28,
        communicationScore: 32,
        feedback: 'Too vague and did not answer the question.',
      });

    const summarySpy = vi.spyOn(llmProvider, 'generateSummary').mockResolvedValue({
      overallScore: 64,
      technicalScore: 60,
      communicationScore: 58,
      feedbackSummary: 'Mixed interview performance.',
      strengths: ['Strong first answer'],
      improvements: ['Second answer lacked detail'],
    });

    await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'verbal',
        transcript: 'I led a zero-downtime migration and reduced release rollback risk with staged rollouts.',
      });

    await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'verbal',
        transcript: "I don't know.",
      });

    const complete = await request(app)
      .post(`/api/interview/${sessionId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(complete.status).toBe(200);
    expect(summarySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId,
        role: 'Platform Engineer',
        responses: expect.objectContaining({
          responseCount: 2,
          responses: expect.arrayContaining([
            expect.objectContaining({
              answerText: expect.stringContaining('zero-downtime migration'),
              feedback: 'Excellent technical depth.',
            }),
            expect.objectContaining({
              answerText: "I don't know.",
              feedback: 'Too vague and did not answer the question.',
            }),
          ]),
        }),
        attempt: 1,
      }),
    );
  });

  it('produces materially different fallback summaries for strong, weak, offensive, and incomplete sessions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Non-JSON provider summary',
              },
            },
          ],
        }),
      }),
    );

    const strongSummary = await llmProvider.generateSummary({
      sessionId: 'strong-session',
      role: 'Backend Engineer',
      attempt: 1,
      responses: {
        responseCount: 1,
        technicalAverage: 91,
        communicationAverage: 86,
        feedbackSnippets: ['Excellent technical depth.'],
        responses: [
          {
            order: 1,
            questionText: 'Tell me about a system you scaled.',
            answerText: 'I redesigned our event pipeline and reduced p95 latency by 42 percent.',
            technicalScore: 91,
            communicationScore: 86,
            feedback: 'Excellent technical depth.',
          },
        ],
      },
    });

    const weakSummary = await llmProvider.generateSummary({
      sessionId: 'weak-session',
      role: 'Backend Engineer',
      attempt: 1,
      responses: {
        responseCount: 1,
        technicalAverage: 28,
        communicationAverage: 31,
        feedbackSnippets: ['Too vague and lacked detail.'],
        responses: [
          {
            order: 1,
            questionText: 'Tell me about a system you scaled.',
            answerText: "I don't know.",
            technicalScore: 28,
            communicationScore: 31,
            feedback: 'Too vague and lacked detail.',
          },
        ],
      },
    });

    const offensiveSummary = await llmProvider.generateSummary({
      sessionId: 'offensive-session',
      role: 'Backend Engineer',
      attempt: 1,
      responses: {
        responseCount: 1,
        technicalAverage: 24,
        communicationAverage: 20,
        feedbackSnippets: ['Response was unprofessional and off-topic.'],
        responses: [
          {
            order: 1,
            questionText: 'Tell me about a system you scaled.',
            answerText: 'This is an offensive irrelevant answer.',
            technicalScore: 24,
            communicationScore: 20,
            feedback: 'Response was unprofessional and off-topic.',
          },
        ],
      },
    });

    const incompleteSummary = await llmProvider.generateSummary({
      sessionId: 'incomplete-session',
      role: 'Backend Engineer',
      attempt: 1,
      responses: {
        responseCount: 0,
        technicalAverage: null,
        communicationAverage: null,
        feedbackSnippets: [],
        responses: [],
      },
    });

    expect(strongSummary.overallScore).toBeGreaterThan(weakSummary.overallScore);
    expect(offensiveSummary.improvements.join(' ')).toContain('professional');
    expect(weakSummary.improvements.join(' ')).toContain('I do not know');
    expect(incompleteSummary.feedbackSummary).toContain('before enough answer data was captured');
    expect(strongSummary.strengths).not.toEqual(weakSummary.strengths);
  });

  it('rejects coding payloads that do not match the current verbal question type', async () => {
    const { sessionId } = await seedActiveSession('Frontend Engineer');

    const response = await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'coding',
        code: 'function solve() {}',
        language: 'javascript',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: 'Answer type coding does not match current verbal question',
    });
  });
});
