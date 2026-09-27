import { describe, expect, it, vi } from 'vitest';
import { GithubError, createGithubClient } from './github.js';

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('createGithubClient', () => {
  it('authorize 주소에 client_id, redirect_uri, scope, state를 붙인다', () => {
    const url = new URL(
      createGithubClient({ clientId: 'abc', clientSecret: 'shh' }).authorizeUrl({
        state: 'xyz',
        redirectUri: 'http://localhost:5173/auth/github/callback',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'abc',
      redirect_uri: 'http://localhost:5173/auth/github/callback',
      scope: 'read:user',
      state: 'xyz',
    });
    expect(url.search).not.toContain('shh'); // 비밀값은 브라우저 주소로 나가지 않는다
  });

  it('code를 access_token으로 교환한다 (client_secret은 서버에서만 보낸다)', async () => {
    const fetchImpl = vi.fn(() => json(200, { access_token: 'gho_token' }));
    const token = await createGithubClient({ clientId: 'abc', clientSecret: 'shh' }, fetchImpl).exchangeCode(
      'the-code',
      'http://cb',
    );
    expect(token).toBe('gho_token');
    expect(fetchImpl).toHaveBeenCalledWith('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: 'abc', client_secret: 'shh', code: 'the-code', redirect_uri: 'http://cb' }),
    });
  });

  it('교환이 거부되면 GithubError', async () => {
    const client = createGithubClient({ clientId: 'a', clientSecret: 'b' }, () => json(200, { error: 'bad_verification_code' }));
    await expect(client.exchangeCode('x', 'y')).rejects.toThrow(GithubError);
  });

  it('토큰으로 /user를 조회해 id, login, avatar_url을 돌려준다', async () => {
    const fetchImpl = vi.fn(() => json(200, { id: 42, login: 'octocat', avatar_url: 'https://avatars.githubusercontent.com/u/42', name: 'x' }));
    const user = await createGithubClient({ clientId: 'a', clientSecret: 'b' }, fetchImpl).getUser('gho_token');
    expect(user).toEqual({ id: 42, login: 'octocat', avatar_url: 'https://avatars.githubusercontent.com/u/42' });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.github.com/user', {
      headers: { Authorization: 'Bearer gho_token', Accept: 'application/vnd.github+json', 'User-Agent': 'todo-planner' },
    });
  });

  it('/user 조회가 실패하면 GithubError', async () => {
    const client = createGithubClient({ clientId: 'a', clientSecret: 'b' }, () => json(401, {}));
    await expect(client.getUser('bad')).rejects.toThrow(GithubError);
  });
});
