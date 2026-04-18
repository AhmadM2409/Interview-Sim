import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/api/server.js';
import { createNewDBInstance, destroyDBInstance, get, all } from '../src/api/db.js';
import { seedActiveSession } from './helpers/db-seed.js';

beforeEach(async () => {
  await createNewDBInstance();
});

afterEach(async () => {
  await destroyDBInstance();
});

describe('Phase 1 test infrastructure', () => {
  it('creates required schema in a fresh in-memory database', async () => {
    const tables = await all("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    expect(tables.map((row) => row.name)).toEqual(['questions', 'responses', 'sessions']);
  });

  it('supports deterministic seed helpers with explicit contract', async () => {
    const seeded = await seedActiveSession('Frontend Engineer');

    expect(seeded).toHaveProperty('sessionId');
    expect(seeded).toHaveProperty('questionId');

    const session = await get('SELECT id, role, status, is_processing FROM sessions WHERE id = ?', [seeded.sessionId]);

    expect(session.role).toBe('Frontend Engineer');
    expect(session.status).toBe('ACTIVE');
    expect(session.is_processing).toBe(0);
  });

  it('boots an express app that supertest can call', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { ok: true },
      error: null,
    });
  });
});
