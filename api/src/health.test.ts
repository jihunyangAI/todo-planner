import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createLogger } from './logger.js';
import { openTestDatabase } from '../test/testDb.js';

describe('GET /api/health', () => {
  let ctx: Awaited<ReturnType<typeof openTestDatabase>>;
  beforeAll(async () => {
    ctx = await openTestDatabase();
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('DB에 연결되어 있으면 200 {db:"ok"}를 반환하고 X-Client-Id가 필요 없다', async () => {
    const app = createApp({
      database: ctx.database,
      config: { webOrigin: 'http://localhost', trustProxy: 0, rateLimitDisabled: true },
      logger: createLogger({ level: 'silent' }),
    });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ db: 'ok' });
  });
});
