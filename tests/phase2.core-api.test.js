import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/api/server.js';
import { createNewDBInstance, destroyDBInstance, get } from '../src/api/db.js';
import { generateMockAuthToken } from './helpers/auth-mock.js';
import { seedActiveSession } from './helpers/db-seed.js';

beforeEach(async () => {
  await createNewDBInstance();
});

afterEach(async () => {
  await destroyDBInstance();
});

describe('Phase 2 routing + core API', () => {
  it('rejects missing authorization on session creation', async () => {
    const response = await request(app).post('/api/interview/session').send({ role: 'Dev', level: 'Mid' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: 'Unauthorized',
    });
  });

  it('rejects malformed payload with zod validation error', async () => {
    const token = generateMockAuthToken();

    const response = await request(app)
      .post('/api/interview/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: '', level: '' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Validation error');
    expect(response.body.data).toBeNull();
  });

  it('creates interview session with expected envelope and default lock state', async () => {
    const token = generateMockAuthToken();

    const response = await request(app)
      .post('/api/interview/session')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'Frontend Engineer', level: 'Mid' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.error).toBeNull();
    expect(response.body.data).toMatchObject({
      status: 'ACTIVE',
      role: 'Frontend Engineer',
      level: 'Mid',
    });

    const session = await get(
      'SELECT id, role, level, status, is_processing FROM sessions WHERE id = ?',
      [response.body.data.sessionId],
    );

    expect(session).toMatchObject({
      role: 'Frontend Engineer',
      level: 'Mid',
      status: 'ACTIVE',
      is_processing: 0,
    });
  });

  it('rejects concurrent mutating call when lock is active', async () => {
    const token = generateMockAuthToken();
    const { sessionId } = await seedActiveSession('Backend Engineer', { isProcessing: true });

    const response = await request(app)
      .post(`/api/interview/${sessionId}/question/next`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      data: null,
      error: 'Concurrent request locked',
    });
  });
});
