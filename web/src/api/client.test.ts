import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, createAuthApi } from './client';

function clientWith(fetchImpl: typeof fetch, timeoutMs?: number) {
  return createApiClient({ baseUrl: 'http://api', fetchImpl, timeoutMs });
}

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('예외가 발생하지 않았습니다');
}

describe('createApiClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('X-Requested-With 헤더와 JSON 본문을 보내고, X-Client-Id는 보내지 않는다. 쿠키는 같은 출처로 보낸다', async () => {
    const fetchImpl = vi.fn(() => json(200, { id: 'x' }));
    await clientWith(fetchImpl).patch('abc', { title: 't' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api/api/tasks/abc',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'fetch', 'Content-Type': 'application/json' },
        body: '{"title":"t"}',
      }),
    );
  });

  it('기본 주소는 같은 출처(상대 경로)다', async () => {
    const fetchImpl = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) => json(200, []));
    await createApiClient({ fetchImpl }).list();
    expect(fetchImpl.mock.calls[0]![0]).toBe('/api/tasks');
  });

  it('401은 unauthorized', async () => {
    expect((await errorOf(clientWith(() => json(401, { error: '로그인이 필요합니다' })).list())).kind).toBe('unauthorized');
  });

  it('응답 종류를 나눈다: 5xx·429·네트워크 오류는 일시적, 400·409는 거부, 404는 없음', async () => {
    expect((await errorOf(clientWith(() => json(500, {})).list())).kind).toBe('transient');
    expect((await errorOf(clientWith(() => json(429, {})).list())).kind).toBe('transient');
    expect((await errorOf(clientWith(() => Promise.reject(new TypeError('fail'))).list())).kind).toBe('transient');
    const rejected = await errorOf(clientWith(() => json(400, { errors: { title: '제목을 입력하세요' } })).list());
    expect(rejected).toMatchObject({ kind: 'rejected', message: '제목을 입력하세요' });
    expect((await errorOf(clientWith(() => json(409, { error: 'dup' })).list())).kind).toBe('rejected');
    expect((await errorOf(clientWith(() => json(404, {})).remove('x'))).kind).toBe('notFound');
  });

  it('DELETE 204는 본문 없이 끝난다', async () => {
    await expect(clientWith(() => Promise.resolve(new Response(null, { status: 204 }))).remove('x')).resolves.toBeUndefined();
  });

  it('헤더가 온 뒤 본문 읽기가 멈춰도 20초가 지나면 일시적 실패로 처리한다', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      const body = new ReadableStream({
        start(controller) {
          init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')));
        },
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    });
    const promise = errorOf(createApiClient({ fetchImpl }).list());
    await vi.advanceTimersByTimeAsync(20_000);
    expect((await promise).kind).toBe('transient');
  });

  it('모든 요청은 20초가 지나면 끊고 일시적 실패로 처리한다', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const promise = errorOf(createApiClient({ fetchImpl }).list());
    await vi.advanceTimersByTimeAsync(19_999);
    expect(fetchImpl.mock.calls[0]![1]!.signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await promise).kind).toBe('transient');
  });
});

describe('createAuthApi', () => {
  it('me는 GET /api/me, logout은 POST /auth/logout, claim은 POST /api/tasks/claim {clientId}', async () => {
    const fetchImpl = vi.fn((url: RequestInfo | URL, _init?: RequestInit) =>
      url === '/auth/logout' ? Promise.resolve(new Response(null, { status: 204 })) : json(200, { ok: true }),
    );
    const auth = createAuthApi({ fetchImpl });
    await auth.me();
    await auth.logout();
    await auth.claim('11111111-1111-4111-8111-111111111111');
    expect(fetchImpl.mock.calls.map(([url, init]) => [url, init?.method, init?.body])).toEqual([
      ['/api/me', 'GET', undefined],
      ['/auth/logout', 'POST', undefined],
      ['/api/tasks/claim', 'POST', '{"clientId":"11111111-1111-4111-8111-111111111111"}'],
    ]);
  });
});
