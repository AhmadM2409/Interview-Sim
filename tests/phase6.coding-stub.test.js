import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/api/server.js';
import { createNewDBInstance, destroyDBInstance } from '../src/api/db.js';
import { generateMockAuthToken } from './helpers/auth-mock.js';

beforeEach(async () => {
  await createNewDBInstance();
});

afterEach(async () => {
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
});
