import request from 'supertest';
import type { Logger } from 'pino';
import { createApp } from '../src/app.js';
import type { AppConfig } from '../src/config.js';
import type { Database } from '../src/db.js';
import type { GithubClient } from '../src/github.js';
import { createLogger } from '../src/logger.js';
import { createFakeGithub } from './fakeGithub.js';

const TEST_CONFIG: AppConfig = {
  trustProxy: 0,
  rateLimitDisabled: true,
  publicUrl: 'http://localhost:5173',
  github: { clientId: 'test-client-id', clientSecret: 'test-client-secret' },
  sessionSecret: 'test-session-secret-test-session-secret',
  cookieSecure: false,
  serveWeb: false,
};

export function createTestApp(
  database: Database,
  overrides: { github?: GithubClient; logger?: Logger; config?: Partial<AppConfig>; webDist?: string } = {},
) {
  return createApp({
    database,
    config: { ...TEST_CONFIG, ...overrides.config },
    github: overrides.github ?? createFakeGithub().client,
    logger: overrides.logger ?? createLogger({ level: 'silent' }),
    webDist: overrides.webDist,
  });
}

type App = ReturnType<typeof createApp>;

/** 쿠키를 유지하는 에이전트. 상태 변경 요청에는 X-Requested-With를 붙인다. */
export function client(agent: ReturnType<typeof request.agent>) {
  const csrf = { 'X-Requested-With': 'fetch' };
  return {
    agent,
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => agent.post(url).set(csrf).send(body),
    patch: (url: string, body: object) => agent.patch(url).set(csrf).send(body),
    del: (url: string) => agent.delete(url).set(csrf),
  };
}

/** 가짜 GitHub로 OAuth 흐름을 끝까지 거쳐 로그인한 에이전트를 돌려준다. */
export async function loginAs(app: App, login: string) {
  const agent = request.agent(app);
  const start = await agent.get('/auth/github');
  const state = new URL(start.headers.location as string).searchParams.get('state');
  const callback = await agent.get(`/auth/github/callback?code=${encodeURIComponent(login)}&state=${state}`);
  if (callback.status !== 302) throw new Error(`로그인 실패: ${callback.status} ${callback.text}`);
  return client(agent);
}
