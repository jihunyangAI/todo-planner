import type { Task } from '@todo/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '../api/client';
import { FakeApi, apiError, flush } from '../test/fakeApi';
import { makeTask } from '../test/factory';
import { TaskEngine } from './syncQueue';

function setup() {
  const api = new FakeApi();
  const engine = new TaskEngine({ api });
  return { api, engine };
}

async function ready(tasks: Task[] = []) {
  const ctx = setup();
  void ctx.engine.load();
  ctx.api.take('list').resolve(tasks);
  await flush();
  expect(ctx.engine.getSnapshot().status).toBe('ready');
  return ctx;
}

const byId = (engine: TaskEngine, id: string) => engine.getSnapshot().tasks.find((t) => t.id === id);

describe('동기화 큐', () => {
  it('일시적 실패는 그 작업만 되돌리고 잠근다. 다시 시도하면 다시 반영된다 (AC13)', async () => {
    const a = makeTask({ title: 'A' });
    const b = makeTask({ title: 'B' });
    const { api, engine } = await ready([a, b]);

    engine.update(a.id, { completed: true });
    engine.update(b.id, { title: 'B2' });
    api.take('patch').reject(apiError('transient'));
    api.take('patch').resolve({ ...b, title: 'B2' });
    await flush();

    const snap = engine.getSnapshot();
    expect(byId(engine, a.id)?.completed).toBe(false); // A는 확정 상태로
    expect(byId(engine, b.id)?.title).toBe('B2'); // B의 성공한 변경은 유지
    expect(snap.failedCount).toBe(1);
    expect(snap.lockedIds.has(a.id)).toBe(true);
    expect(engine.update(a.id, { title: '잠김' })).toBe(false); // 잠긴 작업은 편집 불가
    expect(engine.remove(a.id)).toBe(false);

    engine.retry();
    expect(byId(engine, a.id)?.completed).toBe(true);
    expect(engine.getSnapshot().failedCount).toBe(0);
    const resent = api.take('patch');
    expect(resent.args).toEqual([a.id, { completed: true }]);
    resent.resolve({ ...a, completed: true, completedAt: '2026-09-25T00:00:00.000Z' });
    await flush();
    expect(byId(engine, a.id)?.completed).toBe(true);
    expect(engine.canEdit(a.id)).toBe(true);
  });

  it('[버리기]는 실패 목록을 비우고 목록을 다시 받아 서버 값을 보여 준다 (AC13)', async () => {
    const a = makeTask({ title: 'A' });
    const { api, engine } = await ready([a]);
    engine.update(a.id, { title: 'A2' });
    api.take('patch').reject(apiError('transient'));
    await flush();

    engine.discard();
    expect(engine.getSnapshot().failedCount).toBe(0);
    // 시간 초과됐던 요청이 실제로는 서버에 저장된 경우
    api.take('list').resolve([{ ...a, title: 'A2' }]);
    await flush();
    expect(byId(engine, a.id)?.title).toBe('A2');
  });

  it('같은 작업의 요청은 차례대로 보내고, 첫 응답이 와도 두 번째 클릭 값을 유지한다 (AC33)', async () => {
    const a = makeTask();
    const { api, engine } = await ready([a]);
    engine.update(a.id, { completed: true });
    engine.update(a.id, { completed: false });
    expect(api.pending('patch')).toHaveLength(1); // 두 번째는 아직 보내지 않음

    api.take('patch').resolve({ ...a, completed: true, completedAt: 'x' });
    await flush();
    expect(byId(engine, a.id)?.completed).toBe(false); // 화면은 마지막 클릭 결과
    const second = api.take('patch');
    expect(second.args).toEqual([a.id, { completed: false }]);
    second.resolve({ ...a, completed: false });
    await flush();
    expect(byId(engine, a.id)?.completed).toBe(false);
  });

  it('400은 되돌리고 오류 알림을 띄우며 뒤에 기다리던 요청도 버린다. 실패 목록에는 넣지 않는다 (AC31)', async () => {
    const a = makeTask({ title: 'A' });
    const { api, engine } = await ready([a]);
    engine.update(a.id, { title: '첫 번째' });
    engine.update(a.id, { title: '두 번째' });
    api.take('patch').reject(apiError('rejected', '제목을 입력하세요'));
    await flush();
    expect(byId(engine, a.id)?.title).toBe('A');
    expect(api.pending('patch')).toHaveLength(0);
    expect(engine.getSnapshot().failedCount).toBe(0);
    expect(engine.getSnapshot().notices.map((n) => n.text)).toContain('제목을 입력하세요');
  });

  it('PATCH 404는 목록에서 없애고 알린다. DELETE 404는 성공으로 처리한다 (AC31)', async () => {
    const a = makeTask();
    const b = makeTask();
    const { api, engine } = await ready([a, b]);
    engine.update(a.id, { title: 'x' });
    api.take('patch').reject(apiError('notFound'));
    engine.remove(b.id);
    api.take('remove').reject(apiError('notFound'));
    await flush();
    const snap = engine.getSnapshot();
    expect(snap.tasks).toEqual([]);
    expect(snap.notices.map((n) => n.text)).toEqual(['다른 곳에서 삭제된 작업입니다']);
    expect(snap.failedCount).toBe(0);
  });

  it('새 작업의 POST가 일시적으로 실패하면 목록에서 빠지고, 다시 시도하면 같은 id로 다시 보낸다 (AC32)', async () => {
    const { api, engine } = await ready();
    const task = engine.create({ title: '새 작업' })!;
    const first = api.take('create');
    first.reject(apiError('transient', '시간 초과'));
    await flush();
    expect(engine.getSnapshot().tasks).toEqual([]);
    expect(engine.getSnapshot().failedCount).toBe(1);

    engine.retry();
    expect(byId(engine, task.id)?.title).toBe('새 작업');
    const second = api.take('create');
    expect((second.args[0] as { id: string }).id).toBe(task.id); // 같은 id → 서버가 중복을 만들지 않음
    second.resolve(task);
    await flush();
    expect(engine.getSnapshot().tasks).toHaveLength(1);
  });

  it('삭제가 실패하면 작업이 다시 나타나고 잠긴다', async () => {
    const a = makeTask();
    const { api, engine } = await ready([a]);
    engine.remove(a.id);
    expect(byId(engine, a.id)).toBeUndefined();
    api.take('remove').reject(apiError('transient'));
    await flush();
    expect(byId(engine, a.id)).toBeDefined();
    expect(engine.getSnapshot().lockedIds.has(a.id)).toBe(true);
  });
});

describe('다시 받아 오기 (AC22)', () => {
  it('저장 요청이 끝나지 않았으면 받아 오기를 미루고, 방금 바꾼 값이 돌아가지 않는다', async () => {
    const a = makeTask({ title: 'A' });
    const { api, engine } = await ready([a]);
    engine.update(a.id, { title: 'A2' });
    void engine.refresh();
    expect(api.pending('list')).toHaveLength(0);
    expect(byId(engine, a.id)?.title).toBe('A2');

    api.take('patch').resolve({ ...a, title: 'A2' });
    await flush();
    const list = api.take('list'); // 요청이 끝난 뒤 받아 온다
    list.resolve([{ ...a, title: 'A2' }]);
    await flush();
    expect(byId(engine, a.id)?.title).toBe('A2');
  });

  it('GET 도중 추가·삭제·체크가 먼저 성공해도 GET 응답을 버려서 변경이 유지된다', async () => {
    const a = makeTask({ title: 'A' });
    const b = makeTask({ title: 'B' });
    const { api, engine } = await ready([a, b]);
    void engine.refresh();
    const staleList = api.take('list');

    const created = engine.create({ title: '새 작업' })!;
    engine.remove(b.id);
    engine.update(a.id, { completed: true });
    api.take('create').resolve(created);
    api.take('remove').resolve(undefined);
    api.take('patch').resolve({ ...a, completed: true });
    await flush();

    staleList.resolve([a, b]); // 변경 전 서버 상태
    await flush();
    const titles = engine.getSnapshot().tasks.map((t) => t.title).sort();
    expect(titles).toEqual(['A', '새 작업']);
    expect(byId(engine, a.id)?.completed).toBe(true);
  });

  it('변경이 없으면 서버 값을 반영한다(다른 기기에서 바뀐 내용·삭제된 작업)', async () => {
    const a = makeTask({ title: 'A' });
    const b = makeTask({ title: 'B' });
    const { api, engine } = await ready([a, b]);
    void engine.refresh();
    api.take('list').resolve([{ ...a, title: '다른 기기에서 수정' }]);
    await flush();
    expect(engine.getSnapshot().tasks.map((t) => t.title)).toEqual(['다른 기기에서 수정']);
  });

  it('받아 오기가 실패하면 조용히 넘어가고 편집 상태를 유지한다 (AC35)', async () => {
    const a = makeTask();
    const { api, engine } = await ready([a]);
    void engine.refresh();
    api.take('list').reject(apiError('transient'));
    await flush();
    const snap = engine.getSnapshot();
    expect(snap.status).toBe('ready');
    expect(snap.notices).toEqual([]);
    expect(snap.failedCount).toBe(0);
    expect(engine.canEdit(a.id)).toBe(true);
  });

  it('첫 로드가 끝나기 전에는 받아 오기를 하지 않는다', async () => {
    const { api, engine } = setup();
    void engine.load();
    api.take('list');
    void engine.refresh();
    expect(api.pending('list')).toHaveLength(0);
  });
});

describe('첫 로드 (AC35)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('3초 넘게 걸리면 slow 표시, 받기 전에는 쓰기가 막힌다', async () => {
    const { api, engine } = setup();
    void engine.load();
    expect(engine.create({ title: 'x' })).toBeNull();
    await vi.advanceTimersByTimeAsync(3_001);
    expect(engine.getSnapshot()).toMatchObject({ status: 'loading', slow: true });
    api.take('list').resolve([]);
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getSnapshot()).toMatchObject({ status: 'ready', slow: false });
  });

  it('4회 모두 실패하면 오류 상태가 된다 (바로 실패하면 2+4+8=14초)', async () => {
    const { api, engine } = setup();
    void engine.load();
    for (const wait of [2_000, 4_000, 8_000]) {
      api.take('list').reject(apiError('transient'));
      await vi.advanceTimersByTimeAsync(wait);
      expect(engine.getSnapshot().status).toBe('loading');
    }
    api.take('list').reject(apiError('transient'));
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getSnapshot().status).toBe('error');
    expect(api.pending('list')).toHaveLength(0);
  });

  it('60초가 지나면 진행 중인 시도를 중단하고 늦은 응답은 버린다', async () => {
    const { api, engine } = setup();
    void engine.load();
    const hanging = api.take('list');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(engine.getSnapshot().status).toBe('error');
    hanging.resolve([makeTask()]);
    await vi.advanceTimersByTimeAsync(0);
    expect(engine.getSnapshot()).toMatchObject({ status: 'error', tasks: [] });
  });
});

describe('느린 저장 (AC35)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('저장 요청이 15초 걸려도 실패로 처리하지 않는다(시간 초과 20초)', async () => {
    vi.useFakeTimers();
    const a = makeTask({ title: 'A' });
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      const respond = () =>
        new Response(JSON.stringify(init?.method === 'GET' ? [a] : { ...a, completed: true }), { status: 200 });
      if (init?.method === 'GET') return Promise.resolve(respond());
      return new Promise<Response>((resolve) => setTimeout(() => resolve(respond()), 15_000));
    });
    const api = createApiClient({ fetchImpl });
    const engine = new TaskEngine({ api });
    void engine.load();
    await vi.advanceTimersByTimeAsync(0);
    engine.update(a.id, { completed: true });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(engine.getSnapshot().failedCount).toBe(0);
    expect(byId(engine, a.id)?.completed).toBe(true);
  });
});

describe('로그인 만료 (401)', () => {
  it('첫 로드가 401이면 다시 시도하지 않고 unauthorized 상태가 된다', async () => {
    const { api, engine } = setup();
    void engine.load();
    api.take('list').reject(apiError('unauthorized'));
    await flush();
    expect(engine.getSnapshot().status).toBe('unauthorized');
    expect(api.pending('list')).toHaveLength(0);
  });

  it('저장 중 401이면 변경을 실패 목록에 보관하고 authExpired를 켠다', async () => {
    const a = makeTask({ title: 'A' });
    const { api, engine } = await ready([a]);
    engine.update(a.id, { title: 'A2' });
    api.take('patch').reject(apiError('unauthorized'));
    await flush();
    const snap = engine.getSnapshot();
    expect(snap.authExpired).toBe(true);
    expect(snap.failedCount).toBe(1);
    expect(snap.lockedIds.has(a.id)).toBe(true);
    expect(byId(engine, a.id)?.title).toBe('A');
  });

  it('다시 받아 오기가 401이면 목록은 그대로 두고 authExpired를 켠다', async () => {
    const a = makeTask({ title: 'A' });
    const { api, engine } = await ready([a]);
    void engine.refresh();
    api.take('list').reject(apiError('unauthorized'));
    await flush();
    expect(engine.getSnapshot()).toMatchObject({ status: 'ready', authExpired: true });
    expect(byId(engine, a.id)?.title).toBe('A');
  });

  it('unsavedTaskCount는 전송 중·실패 목록의 작업 수를 센다', async () => {
    const a = makeTask();
    const b = makeTask();
    const { api, engine } = await ready([a, b]);
    expect(engine.unsavedTaskCount()).toBe(0);
    engine.update(a.id, { title: 'x' });
    engine.update(b.id, { title: 'y' });
    expect(engine.unsavedTaskCount()).toBe(2);
    api.take('patch').reject(apiError('transient'));
    api.take('patch').resolve({ ...b, title: 'y' });
    await flush();
    expect(engine.unsavedTaskCount()).toBe(1);
  });
});
