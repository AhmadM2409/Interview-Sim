import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../src/api/server.js';
import { createNewDBInstance, destroyDBInstance } from '../src/api/db.js';
import { generateQuestionWithRetry } from '../src/api/services/llm-retry.js';
import * as llmProvider from '../src/api/services/llm-provider.js';
import logger from '../src/api/logger.js';
import { seedActiveSession } from './helpers/db-seed.js';
import { generateMockAuthToken } from './helpers/auth-mock.js';

beforeEach(async () => {
  await createNewDBInstance();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await destroyDBInstance();
});

describe('Phase 3 LLM and Tavily layer', () => {
  it('retries once after malformed LLM output, logs warning, and succeeds', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    let attempts = 0;

    vi.spyOn(llmProvider, 'generateQuestion').mockImplementation(async () => {
      attempts += 1;

      if (attempts === 1) {
        return { invalidKey: 'missing questionText' };
      }

      return { questionText: 'Describe a recent complex incident you resolved.' };
    });

    const result = await generateQuestionWithRetry('SRE', 'session-123');

    expect(attempts).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, checkpoint: 'evaluate.zod.parse.failed' }),
      'LLM Schema Validation Failed',
    );
    expect(result.questionText).toBe('Describe a recent complex incident you resolved.');
  });

  it('throws after max retries when LLM output never validates', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    vi.spyOn(llmProvider, 'generateQuestion').mockResolvedValue({ nope: true });

    await expect(generateQuestionWithRetry('SRE', 'session-234')).rejects.toThrow(
      'Evaluation failed after schema validation retries',
    );

    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('supports forcing Tavily timeout via test header', async () => {
    const token = generateMockAuthToken();
    const { sessionId } = await seedActiveSession('Frontend Engineer');

    const response = await request(app)
      .post(`/api/interview/${sessionId}/question/next`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-test-force-tavily-timeout', 'true')
      .send();

    expect(response.status).toBe(504);
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: 'Tavily timeout',
    });
  });
});
