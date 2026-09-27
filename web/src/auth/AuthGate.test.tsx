import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import type { AuthApi, User } from '../api/client';
import { LEGACY_CLIENT_ID_KEY } from '../api/legacyClientId';
import { FakeApi, apiError, flush } from '../test/fakeApi';
import { AuthGate } from './AuthGate';

const USER: User = { id: '64b000000000000000000001', username: 'octocat', avatarUrl: 'https://avatars.githubusercontent.com/u/1' };
const LEGACY = '11111111-1111-4111-8111-111111111111';

function fakeAuth(overrides: Partial<AuthApi> = {}): AuthApi & { [K in keyof AuthApi]: ReturnType<typeof vi.fn> } {
  return {
    me: vi.fn(async () => USER),
    logout: vi.fn(async () => {}),
    claim: vi.fn(async () => ({ claimed: 0 })),
    ...overrides,
  } as never;
}

async function renderGate(authApi: AuthApi, api = new FakeApi()) {
  window.history.replaceState(null, '', '#/settings');
  render(
    <AuthGate authApi={authApi} api={api}>
      <App />
    </AuthGate>,
  );
  await act(async () => {
    await flush();
  });
  return api;
}

describe('AuthGate', () => {
  it('로그인하지 않았으면(/api/me 401) GitHub 로그인 화면만 보인다', async () => {
    await renderGate(fakeAuth({ me: vi.fn(async () => Promise.reject(apiError('unauthorized'))) }));
    expect(screen.getByRole('link', { name: 'GitHub로 로그인' })).toHaveAttribute('href', '/auth/github');
    expect(screen.queryByRole('navigation', { name: '주요 화면' })).not.toBeInTheDocument();
  });

  it('서버에 연결하지 못하면 오류와 [다시 시도]를 보여 주고, 다시 시도하면 확인한다', async () => {
    const me = vi.fn().mockRejectedValueOnce(apiError('transient')).mockResolvedValue(USER);
    await renderGate(fakeAuth({ me }));
    expect(screen.getByRole('heading', { name: '서버에 연결하지 못했습니다' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await act(async () => {
      await flush();
    });
    expect(screen.getByText('octocat')).toBeInTheDocument();
  });

  it('로그인했으면 앱과 계정 정보가 보이고, 로그아웃하면 로그인 화면으로 돌아간다', async () => {
    const auth = fakeAuth();
    await renderGate(auth);
    expect(screen.getByRole('navigation', { name: '주요 화면' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'octocat 프로필 사진' })).toHaveAttribute('src', USER.avatarUrl);

    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    await act(async () => {
      await flush();
    });
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'GitHub로 로그인' })).toBeInTheDocument();
  });

  it('로그아웃 요청이 실패하면 로그인 화면으로 바꾸지 않는다(서버 세션이 남아 있으므로)', async () => {
    const auth = fakeAuth({ logout: vi.fn(async () => Promise.reject(apiError('transient'))) });
    await renderGate(auth);
    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    await act(async () => {
      await flush();
    });
    expect(screen.queryByRole('link', { name: 'GitHub로 로그인' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('로그아웃하지 못했습니다');
  });

  it('로그아웃 응답이 401이면(이미 세션 없음) 로그인 화면으로 바꾼다', async () => {
    await renderGate(fakeAuth({ logout: vi.fn(async () => Promise.reject(apiError('unauthorized'))) }));
    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    await act(async () => {
      await flush();
    });
    expect(screen.getByRole('link', { name: 'GitHub로 로그인' })).toBeInTheDocument();
  });

  it('옛 익명 ID가 남아 있으면 로그인 직후 한 번 claim하고 키를 지운 뒤 목록을 불러온다', async () => {
    localStorage.setItem(LEGACY_CLIENT_ID_KEY, LEGACY);
    const auth = fakeAuth({ claim: vi.fn(async () => ({ claimed: 2 })) });
    const api = await renderGate(auth);
    expect(auth.claim).toHaveBeenCalledExactlyOnceWith(LEGACY);
    expect(localStorage.getItem(LEGACY_CLIENT_ID_KEY)).toBeNull();
    expect(api.pending('list')).toHaveLength(1); // claim이 끝난 뒤 목록을 불러온다
  });

  it('claim이 실패하면 키를 남겨 두고(다음 로그인 때 다시 시도) 앱은 그대로 연다', async () => {
    localStorage.setItem(LEGACY_CLIENT_ID_KEY, LEGACY);
    await renderGate(fakeAuth({ claim: vi.fn(async () => Promise.reject(apiError('transient'))) }));
    expect(localStorage.getItem(LEGACY_CLIENT_ID_KEY)).toBe(LEGACY);
    expect(screen.getByText('octocat')).toBeInTheDocument();
  });

  it('옛 익명 ID가 없으면 claim을 호출하지 않는다', async () => {
    const auth = fakeAuth();
    await renderGate(auth);
    expect(auth.claim).not.toHaveBeenCalled();
  });
});
