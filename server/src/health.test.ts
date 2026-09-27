import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openTestDatabase } from '../test/testDb.js';
import { createTestApp } from '../test/testApp.js';

describe('GET /api/health', () => {
  let ctx: Awaited<ReturnType<typeof openTestDatabase>>;
  beforeAll(async () => {
    ctx = await openTestDatabase();
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('DB에 연결되어 있으면 200 {db:"ok"}를 반환하고 로그인이 필요 없다', async () => {
    const res = await request(createTestApp(ctx.database)).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ db: 'ok' });
  });
});
