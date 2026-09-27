import type { Express } from 'express';
import { createGithubClient, type GithubClient, type GithubUser } from '../src/github.js';

/** 로그인 이름으로 항상 같은 GitHub 사용자 id를 만든다. */
function githubIdOf(login: string): number {
  let hash = 0;
  for (const char of login) hash = (hash * 31 + char.charCodeAt(0)) % 1_000_000_007;
  return hash + 1;
}

/** 외부 요청 없이 쓰는 1×1 아바타 */
export const avatarOf = (login: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><title>${login}</title></svg>`)}`;

/**
 * 가짜 GitHub. code는 로그인 이름 그대로이고, 토큰은 `token-<이름>`이다.
 * - authorize: 'real'이면 실제 GitHub authorize 주소를 만들고(라우트 테스트용),
 *   'e2e'면 같은 서버의 가짜 authorize 화면으로 보낸다.
 */
export function createFakeGithub({ authorize = 'real' }: { authorize?: 'real' | 'e2e' } = {}) {
  const real = createGithubClient({ clientId: 'test-client-id', clientSecret: 'test-client-secret' });
  const profiles = new Map<string, Partial<GithubUser>>();
  const client: GithubClient = {
    authorizeUrl: (params) =>
      authorize === 'real'
        ? real.authorizeUrl(params)
        : `/auth/__e2e/github/authorize?${new URLSearchParams({ state: params.state, redirect_uri: params.redirectUri })}`,
    exchangeCode: async (code) => `token-${code}`,
    getUser: async (token) => {
      const login = token.slice('token-'.length);
      return { id: githubIdOf(login), login, avatar_url: avatarOf(login), ...profiles.get(login) };
    },
  };
  return {
    client,
    /** 다음 로그인 때 GitHub가 돌려줄 값을 바꾼다(이름·아바타 변경 시나리오) */
    setProfile: (login: string, profile: Partial<GithubUser>) => profiles.set(login, profile),
  };
}

/** E2E용 가짜 GitHub 로그인 화면: 사용자 이름을 입력하면 콜백으로 돌아간다. */
export function mountFakeGithubAuthorize(app: Express) {
  app.get('/auth/__e2e/github/authorize', (req, res) => {
    const state = String(req.query.state ?? '');
    const redirectUri = String(req.query.redirect_uri ?? '');
    const escape = (s: string) => s.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
    res.type('html').send(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>가짜 GitHub 로그인</title></head>
<body><h1>가짜 GitHub 로그인</h1>
<form method="get" action="${escape(redirectUri)}">
<input type="hidden" name="state" value="${escape(state)}">
<label>GitHub 사용자 이름 <input name="code" required></label>
<button type="submit">Authorize</button>
</form></body></html>`);
  });
}
