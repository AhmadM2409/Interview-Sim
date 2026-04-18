03-TEST-SUITE

1. Absolute State Isolation (Phase 0)

import { beforeEach, afterEach } from 'vitest';
import { createNewDBInstance, destroyDBInstance } from '../src/api/db';

beforeEach(async () => {
  await createNewDBInstance();
});

afterEach(async () => {
  await destroyDBInstance();
});


2. Authentication & Request Validation Contracts (Phase 1 & 2)

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/api/server';
import { generateMockAuthToken } from '../helpers/auth-mock';

describe('API Security & Zod Payload Validation', () => {
  it('must reject requests without Auth0 token returning 401', async () => {
    const res = await request(app).post('/api/interview/session').send({ role: 'Dev' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('must reject malformed session creation payloads via Zod returning 400', async () => {
    const token = generateMockAuthToken();
    const res = await request(app)
      .post('/api/interview/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: '' }); // Invalid: empty string

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Validation error');
  });

  it('must create a session and return the exact required JSON envelope', async () => {
    const token = generateMockAuthToken();
    const res = await request(app)
      .post('/api/interview/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'Frontend Engineer', level: 'Mid' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('sessionId');
    expect(res.body.error).toBeNull();
  });
});


3. Core Endpoint Contracts & Idempotency (Phase 4)

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/api/server';
import { seedActiveSession } from '../helpers/db-seed';
import { generateMockAuthToken } from '../helpers/auth-mock';

describe('Primary Flow Endpoints & Idempotency', () => {
  const token = generateMockAuthToken();

  it('must fetch the current question for an active session', async () => {
    const { sessionId, questionId } = await seedActiveSession('Frontend Engineer');
    
    const res = await request(app)
      .get(`/api/interview/${sessionId}/question/current`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('questionId', questionId);
  });

  it('must process /complete idempotently, returning 200 and existing data on subsequent calls', async () => {
    const { sessionId } = await seedActiveSession('Data Analyst');
    
    const res1 = await request(app).post(`/api/interview/${sessionId}/complete`).set('Authorization', `Bearer ${token}`).send();
    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe('COMPLETED');

    const res2 = await request(app).post(`/api/interview/${sessionId}/complete`).set('Authorization', `Bearer ${token}`).send();
    expect(res2.status).toBe(200);
    expect(res2.body.data.summary).toStrictEqual(res1.body.data.summary);
  });

  it('must fetch the summary only for a completed session', async () => {
    const { sessionId } = await seedActiveSession('Data Analyst', { status: 'COMPLETED' });
    const res = await request(app).get(`/api/interview/${sessionId}/summary`).set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('summary');
  });
});


4. Concurrency & Lock Safety Validation (Phase 4)

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/api/server';
import { seedActiveSession } from '../helpers/db-seed';
import { generateMockAuthToken } from '../helpers/auth-mock';

describe('Session Concurrency & Lock Release Safety', () => {
  const token = generateMockAuthToken();

  it('must reject concurrent requests to the same session with a 409 status', async () => {
    const { sessionId } = await seedActiveSession('Frontend Engineer', { isProcessing: true });
    
    const response = await request(app)
      .post(`/api/interview/${sessionId}/question/next`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('Concurrent request locked');
  });

  it('must cleanly unlock the session even if an internal error is thrown (finally block safety)', async () => {
    const { sessionId } = await seedActiveSession('Backend Engineer', { isProcessing: false });
    
    await request(app)
      .post(`/api/interview/${sessionId}/question/next`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-test-force-internal-error', 'true')
      .send();
    
    // The lock MUST be released via try/finally, allowing this subsequent request
    const response = await request(app)
      .post(`/api/interview/${sessionId}/question/next`)
      .set('Authorization', `Bearer ${token}`)
      .send();
    
    expect(response.status).not.toBe(409);
  });
});


5. Deterministic LLM Mocking, Logging, & Schema Retries (Phase 3 & 5)

import { describe, it, expect, vi } from 'vitest';
import * as LlmProvider from '../../src/api/services/llmProvider';
import { generateQuestionWithRetry } from '../../src/api/controllers/questionController';
import logger from '../../src/api/logger';

describe('LLM Schema Retry Protocol & Zod Boundaries', () => {
  it('must log a warning, retry upon malformed output, and succeed on the second attempt', async () => {
    const loggerSpy = vi.spyOn(logger, 'warn');
    let attempts = 0;
    
    vi.spyOn(LlmProvider, 'generateQuestion').mockImplementation(async () => {
      attempts++;
      if (attempts === 1) return { invalidKey: "missing text" }; 
      return { questionText: "Valid question structure." }; 
    });

    const result = await generateQuestionWithRetry('Frontend', 'session-123');
    
    expect(attempts).toBe(2);
    expect(loggerSpy).toHaveBeenCalledWith('LLM Schema Validation Failed', expect.any(Object));
    expect(result.questionText).toBe("Valid question structure.");
  });
});
