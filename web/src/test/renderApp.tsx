import type { Task } from '@todo/shared';
import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { ClientIdStore } from '../api/clientId';
import { TaskStoreProvider } from '../store/TaskStore';
import { TaskEngine } from '../store/syncQueue';
import { FakeApi, flush } from './fakeApi';

/** 가짜 API로 앱 전체를 렌더링하고 첫 목록을 채운다. */
export async function renderApp(
  tasks: Task[] = [],
  { hash = '#/today', load = true }: { hash?: string; load?: boolean } = {},
) {
  window.history.replaceState(null, '', hash);
  const clientIds = new ClientIdStore(localStorage);
  const api = new FakeApi(() => clientIds.current);
  const engine = new TaskEngine({ api, clientIds });
  const user = userEvent.setup();
  const utils = render(
    <TaskStoreProvider engine={engine}>
      <App />
    </TaskStoreProvider>,
  );
  if (load) {
    await act(async () => {
      api.take('list').resolve(tasks);
      await flush();
    });
  }
  return { ...utils, api, engine, clientIds, user };
}

/** 가짜 API 응답을 흘려보내고 화면 갱신을 기다린다. */
export async function settle() {
  await act(async () => {
    await flush();
  });
}
