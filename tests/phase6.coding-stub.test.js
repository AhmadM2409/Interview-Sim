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
        type: 'coding',
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

  it('rejects empty coding answers instead of treating them like missing transcripts', async () => {
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
        type: 'coding',
        code: '   ',
        language: 'javascript',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toMatch(/code/i);
  });

  it('completes successfully after mixed verbal and coding answers and keeps coding data in summary input', async () => {
    const token = generateMockAuthToken();
    const { sessionId, questionId } = await seedActiveSession('Frontend Engineer');
    vi.spyOn(tavilyProvider, 'fetchRoleContext').mockResolvedValue({
      results: [{ content: 'Mocked context' }],
    });
    vi.spyOn(llmProvider, 'evaluateAnswer').mockResolvedValue({
      technicalScore: 78,
      communicationScore: 74,
      feedback: 'Clear verbal explanation.',
    });
    vi.spyOn(llmProvider, 'generateQuestion').mockResolvedValue({
      questionText: 'Write a JavaScript function that reverses a string.',
      type: 'coding',
      language: 'javascript',
    });
    const summarySpy = vi.spyOn(llmProvider, 'generateSummary').mockResolvedValue({
      overallScore: 73,
      technicalScore: 75,
      communicationScore: 70,
      feedbackSummary: 'Strong interview with a solid coding answer.',
      strengths: ['Handled both verbal and coding questions'],
      improvements: ['Explain edge cases more explicitly'],
    });

    const verbalResponse = await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'verbal',
        transcript: 'I improved our React rendering performance by memoizing expensive list items.',
      });

    expect(verbalResponse.status).toBe(200);
    expect(verbalResponse.body.data.questionId).toBe(questionId);

    const nextQuestion = await request(app)
      .post(`/api/interview/${sessionId}/question/next`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(nextQuestion.status).toBe(200);
    expect(nextQuestion.body.data).toMatchObject({
      type: 'coding',
      language: 'javascript',
    });

    const codingResponse = await request(app)
      .post(`/api/interview/${sessionId}/evaluate`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'coding',
        code: 'function reverseString(value) { return value.split(\"\").reverse().join(\"\"); }',
        language: 'javascript',
      });

    expect(codingResponse.status).toBe(200);
    expect(codingResponse.body.data.scores.feedback).not.toContain('missing transcript');

    const complete = await request(app)
      .post(`/api/interview/${sessionId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(complete.status).toBe(200);
    expect(complete.body.success).toBe(true);
    expect(complete.body.data.summary).toMatchObject({
      overallScore: 73,
      technicalScore: 75,
      communicationScore: 70,
    });

    expect(summarySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        responses: expect.objectContaining({
          responseCount: 2,
          responses: expect.arrayContaining([
            expect.objectContaining({
              answerType: 'verbal',
              answerText: expect.stringContaining('React rendering performance'),
            }),
            expect.objectContaining({
              questionType: 'coding',
              answerType: 'coding',
              answerLanguage: 'javascript',
              answerText: expect.stringContaining('reverseString'),
            }),
          ]),
        }),
      }),
    );
  });
});
