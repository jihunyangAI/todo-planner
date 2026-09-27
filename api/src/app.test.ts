import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../test/testApp.js';
import { openTestDatabase } from '../test/testDb.js';

describe('앱 구성', () => {
  let ctx: Awaited<ReturnType<typeof openTestDatabase>>;
  beforeAll(async () => {
    ctx = await openTestDatabase();
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('SERVE_WEB이면 / 에서 web/dist의 index.html과 정적 파일을 돌려준다', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'web-dist-'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>할 일</title>');
    writeFileSync(join(dist, 'app.js'), 'console.log(1)');
    const app = createTestApp(ctx.database, { config: { serveWeb: true }, webDist: dist });
    const index = await request(app).get('/');
    expect(index.status).toBe(200);
    expect(index.text).toContain('<title>할 일</title>');
    expect((await request(app).get('/app.js')).text).toBe('console.log(1)');
    // API는 그대로 동작한다
    expect((await request(app).get('/api/me')).status).toBe(401);
  });

  it('SERVE_WEB이 아니면 / 는 404', async () => {
    expect((await request(createTestApp(ctx.database)).get('/')).status).toBe(404);
  });

  it('웹 빌드 결과가 없는데 SERVE_WEB이면 시작하지 않는다', () => {
    expect(() =>
      createTestApp(ctx.database, { config: { serveWeb: true }, webDist: join(tmpdir(), 'no-such-dist') }),
    ).toThrow(/웹 빌드 결과가 없습니다/);
  });

  it('CSP img-src에 GitHub 아바타 도메인이 있고, http일 때는 upgrade-insecure-requests가 없다', async () => {
    const csp = (await request(createTestApp(ctx.database)).get('/api/health')).headers['content-security-policy'] as string;
    expect(csp).toMatch(/img-src 'self' data: https:\/\/avatars\.githubusercontent\.com/);
    expect(csp).not.toContain('upgrade-insecure-requests');
    const secure = createTestApp(ctx.database, { config: { cookieSecure: true } });
    expect((await request(secure).get('/api/health')).headers['content-security-policy']).toContain(
      'upgrade-insecure-requests',
    );
  });
});
