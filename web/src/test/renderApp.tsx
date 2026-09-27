import type { Task } from '@todo/shared';
import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { App } from '../App';
import type { User } from '../api/client';
import { AuthProvider } from '../auth/AuthGate';
import { TaskStoreProvider } from '../store/TaskStore';
import { TaskEngine } from '../store/syncQueue';
import { FakeApi, flush } from './fakeApi';

export const TEST_USER: User = {
  id: '64b000000000000000000001',
  username: 'octocat',
  avatarUrl: 'https://avatars.githubusercontent.com/u/1',
};

/** 로그인한 사용자로 가짜 API와 함께 앱 전체를 렌더링하고 첫 목록을 채운다. */
export async function renderApp(
  tasks: Task[] = [],
  { hash = '#/today', load = true }: { hash?: string; load?: boolean } = {},
) {
  window.history.replaceState(null, '', hash);
  const api = new FakeApi();
  const engine = new TaskEngine({ api });
  const logout = vi.fn(async () => {});
  const user = userEvent.setup();
  const utils = render(
    <AuthProvider value={{ user: TEST_USER, logout }}>
      <TaskStoreProvider engine={engine}>
        <App />
      </TaskStoreProvider>
    </AuthProvider>,
  );
  if (load) {
    await act(async () => {
      api.take('list').resolve(tasks);
      await flush();
    });
  }
  return { ...utils, api, engine, logout, user };
}

/** 가짜 API 응답을 흘려보내고 화면 갱신을 기다린다. */
export async function settle() {
  await act(async () => {
    await flush();
  });
}
