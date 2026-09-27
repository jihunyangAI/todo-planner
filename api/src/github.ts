export interface GithubUser {
  id: number;
  login: string;
  avatar_url: string;
}

/** GitHub OAuth 호출. 테스트와 E2E에서는 가짜 구현을 주입한다. */
export interface GithubClient {
  authorizeUrl(params: { state: string; redirectUri: string }): string;
  exchangeCode(code: string, redirectUri: string): Promise<string>;
  getUser(accessToken: string): Promise<GithubUser>;
}

export class GithubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GithubError';
  }
}

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';
/** 공개 프로필(아이디·이름·아바타)만 읽는다 */
const SCOPE = 'read:user';

export function createGithubClient(
  { clientId, clientSecret }: { clientId: string; clientSecret: string },
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
): GithubClient {
  return {
    authorizeUrl({ state, redirectUri }) {
      const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: SCOPE, state });
      return `${AUTHORIZE_URL}?${query}`;
    },

    async exchangeCode(code, redirectUri) {
      const res = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
      });
      const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
      if (!res.ok || !body.access_token) {
        throw new GithubError(`토큰 교환 실패: ${body.error ?? res.status}`);
      }
      return body.access_token;
    },

    async getUser(accessToken) {
      const res = await fetchImpl(USER_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'todo-planner',
        },
      });
      if (!res.ok) throw new GithubError(`사용자 조회 실패: ${res.status}`);
      const user = (await res.json()) as Partial<GithubUser>;
      if (typeof user.id !== 'number' || typeof user.login !== 'string') {
        throw new GithubError('사용자 정보 형식이 올바르지 않습니다');
      }
      return { id: user.id, login: user.login, avatar_url: user.avatar_url ?? '' };
    },
  };
}
