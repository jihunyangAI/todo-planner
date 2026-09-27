import { Writable } from 'node:stream';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { avatarOf, createFakeGithub } from '../../test/fakeGithub.js';
import { createTestApp, loginAs } from '../../test/testApp.js';
import { openTestDatabase } from '../../test/testDb.js';
import type { GithubClient } from '../github.js';
import { createLogger } from '../logger.js';

describe('GitHub OAuth 로그인', () => {
  let ctx: Awaited<ReturnType<typeof openTestDatabase>>;
  let fake: ReturnType<typeof createFakeGithub>;
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    ctx = await openTestDatabase();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await Promise.all([ctx.database.users.deleteMany({}), ctx.database.db.collection('sessions').deleteMany({})]);
    fake = createFakeGithub();
    app = createTestApp(ctx.database, { github: fake.client });
  });

  it('GET /auth/github 는 state를 붙여 GitHub authorize로 보낸다', async () => {
    const res = await request(app).get('/auth/github');
    expect(res.status).toBe(302);
    const url = new URL(res.headers.location as string);
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/auth/github/callback');
    expect(url.searchParams.get('scope')).toBe('read:user');
    expect(url.searchParams.get('state')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('callback: state가 없거나 다르면 400이고 로그인되지 않는다', async () => {
    const agent = request.agent(app);
    await agent.get('/auth/github');
    expect((await agent.get('/auth/github/callback?code=alice')).status).toBe(400);
    await agent.get('/auth/github');
    expect((await agent.get('/auth/github/callback?code=alice&state=wrong')).status).toBe(400);
    // /auth/github 없이 바로 콜백
    expect((await request(app).get('/auth/github/callback?code=alice&state=x')).status).toBe(400);
    expect((await agent.get('/api/me')).status).toBe(401);
    expect(await ctx.database.users.countDocuments()).toBe(0);
  });

  it('callback: state를 한 번만 쓸 수 있다(같은 state로 다시 오면 400)', async () => {
    const agent = request.agent(app);
    const start = await agent.get('/auth/github');
    const state = new URL(start.headers.location as string).searchParams.get('state');
    expect((await agent.get(`/auth/github/callback?code=alice&state=${state}`)).status).toBe(302);
    expect((await agent.get(`/auth/github/callback?code=alice&state=${state}`)).status).toBe(400);
  });

  it('callback: 로그인하면 username·avatarUrl을 users에 저장하고 / 로 보낸다. /api/me가 사용자를 돌려준다', async () => {
    const agent = request.agent(app);
    const start = await agent.get('/auth/github');
    const state = new URL(start.headers.location as string).searchParams.get('state');
    const res = await agent.get(`/auth/github/callback?code=octocat&state=${state}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');

    const doc = await ctx.database.users.findOne({ username: 'octocat' });
    expect(doc).toMatchObject({ username: 'octocat', avatarUrl: avatarOf('octocat'), githubId: expect.any(Number) });
    const me = await agent.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ id: doc!._id.toHexString(), username: 'octocat', avatarUrl: avatarOf('octocat') });
  });

  it('로그인 전 세션 ID를 이어 쓰지 않는다(로그인하면 세션 쿠키가 바뀐다)', async () => {
    const agent = request.agent(app);
    const start = await agent.get('/auth/github');
    const before = (start.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0];
    const state = new URL(start.headers.location as string).searchParams.get('state');
    const res = await agent.get(`/auth/github/callback?code=alice&state=${state}`);
    const after = (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0];
    expect(after).not.toBe(before);
  });

  it('같은 GitHub 사용자가 다시 로그인하면 문서는 하나이고 이름·아바타가 최신 값으로 바뀐다', async () => {
    await loginAs(app, 'octocat');
    const first = await ctx.database.users.findOne({ username: 'octocat' });
    fake.setProfile('octocat', { login: 'octocat-renamed', avatar_url: 'https://avatars.githubusercontent.com/u/9' });
    await loginAs(app, 'octocat');
    expect(await ctx.database.users.countDocuments()).toBe(1);
    const updated = await ctx.database.users.findOne({ githubId: first!.githubId });
    expect(updated).toMatchObject({ username: 'octocat-renamed', avatarUrl: 'https://avatars.githubusercontent.com/u/9' });
    expect(updated!.createdAt).toEqual(first!.createdAt);
  });

  it('비로그인 상태의 /api/me 는 401', async () => {
    expect((await request(app).get('/api/me')).status).toBe(401);
  });

  it('GitHub가 허락 거부로 돌려보내면(error=access_denied) 로그인하지 않고 / 로 보낸다', async () => {
    const agent = request.agent(app);
    const start = await agent.get('/auth/github');
    const state = new URL(start.headers.location as string).searchParams.get('state');
    const res = await agent.get(`/auth/github/callback?error=access_denied&state=${state}`);
    expect(res.status).toBe(302);
    expect((await agent.get('/api/me')).status).toBe(401);
  });

  it('GitHub 호출이 실패하면 502이고 로그인되지 않는다', async () => {
    const failing: GithubClient = {
      ...fake.client,
      exchangeCode: async () => {
        throw new Error('network');
      },
    };
    const failingApp = createTestApp(ctx.database, { github: failing });
    const agent = request.agent(failingApp);
    const start = await agent.get('/auth/github');
    const state = new URL(start.headers.location as string).searchParams.get('state');
    expect((await agent.get(`/auth/github/callback?code=alice&state=${state}`)).status).toBe(502);
    expect((await agent.get('/api/me')).status).toBe(401);
  });

  it('로그아웃하면 세션 저장소에서 세션이 지워지고 쿠키가 삭제되며, 같은 쿠키로는 401', async () => {
    const alice = await loginAs(app, 'alice');
    const sessions = ctx.database.db.collection('sessions');
    expect(await sessions.countDocuments()).toBe(1);
    const cookieBefore = (await alice.get('/api/me')).status;
    expect(cookieBefore).toBe(200);

    const res = await alice.post('/auth/logout');
    expect(res.status).toBe(204);
    expect(await sessions.countDocuments()).toBe(0);
    const cleared = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('todo.sid='));
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await alice.get('/api/me')).status).toBe(401);
    expect((await alice.get('/api/tasks')).status).toBe(401);
  });

  it('X-Requested-With 없는 로그아웃 요청은 403 (CSRF)', async () => {
    const alice = await loginAs(app, 'alice');
    expect((await alice.agent.post('/auth/logout')).status).toBe(403);
    expect((await alice.get('/api/me')).status).toBe(200);
  });

  it('세션 쿠키는 HttpOnly·SameSite=Lax이다', async () => {
    const res = await request(app).get('/auth/github');
    const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/^todo\.sid=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('로그인 사용자가 삭제되면 /api/me 는 401이고 세션과 쿠키를 지운다', async () => {
    const alice = await loginAs(app, 'alice');
    await ctx.database.users.deleteMany({});
    const res = await alice.get('/api/me');
    expect(res.status).toBe(401);
    const cleared = ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).find((c) => c.startsWith('todo.sid='));
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(await ctx.database.db.collection('sessions').countDocuments()).toBe(0);
    expect((await alice.get('/api/me')).status).toBe(401);
  });

  it('OAuth code·state는 요청 로그에 남지 않는다', async () => {
    const lines: string[] = [];
    const destination = new Writable({
      write(chunk, _enc, cb) {
        lines.push(String(chunk));
        cb();
      },
    });
    const logged = createTestApp(ctx.database, { github: fake.client, logger: createLogger({ level: 'info', destination }) });
    const agent = request.agent(logged);
    const start = await agent.get('/auth/github');
    const state = new URL(start.headers.location as string).searchParams.get('state')!;
    await agent.get(`/auth/github/callback?code=secret-code-123&state=${state}`);
    const log = lines.join('');
    expect(log).toContain('/auth/github/callback');
    expect(log).not.toContain('secret-code-123');
    expect(log).not.toContain(state);
  });
});
