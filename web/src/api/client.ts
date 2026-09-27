import type { Task, TaskCreate, TaskPatch } from '@todo/shared';

/**
 * - transient: 네트워크 오류·시간 초과·5xx·429. 다시 시도할 수 있다.
 * - rejected: 400·403·409·413. 다시 보내도 같은 결과다.
 * - notFound: 404.
 * - unauthorized: 401. 로그인이 없거나 만료됐다.
 */
export type ApiErrorKind = 'transient' | 'rejected' | 'notFound' | 'unauthorized';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClient {
  list(): Promise<Task[]>;
  create(task: TaskCreate): Promise<Task>;
  patch(id: string, patch: TaskPatch): Promise<Task>;
  remove(id: string): Promise<void>;
}

export interface User {
  id: string;
  username: string;
  avatarUrl: string;
}

export interface AuthApi {
  me(): Promise<User>;
  logout(): Promise<void>;
  /** 로그인 전 익명 클라이언트 ID로 만든 작업을 현재 사용자에게 가져온다 */
  claim(clientId: string): Promise<{ claimed: number }>;
}

const REQUEST_TIMEOUT_MS = 20_000;

interface ClientOptions {
  /** 기본값 '': 웹과 API가 같은 출처(운영은 API가 웹을 서빙, 로컬은 Vite 프록시) */
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const { error, errors } = body as { error?: unknown; errors?: Record<string, unknown> };
    if (typeof error === 'string') return error;
    if (errors) {
      const first = Object.values(errors).find((v) => typeof v === 'string');
      if (typeof first === 'string') return first;
    }
  }
  return fallback;
}

type Request = <T>(method: string, path: string, body?: unknown) => Promise<T>;

function createRequest({
  baseUrl = '',
  timeoutMs = REQUEST_TIMEOUT_MS,
  fetchImpl = (...args) => globalThis.fetch(...args),
}: ClientOptions): Request {
  return async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    let data: unknown = null;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        // 세션 쿠키는 같은 출처라 자동으로 붙는다. X-Requested-With는 서버의 CSRF 검사용
        credentials: 'same-origin',
        headers: {
          'X-Requested-With': 'fetch',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      // 본문 읽기도 시간 초과에 포함한다
      if (res.status !== 204) data = await res.json().catch(() => null);
      if (controller.signal.aborted) throw new Error('timeout');
    } catch {
      throw new ApiError('transient', '서버에 연결하지 못했습니다');
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 204) return undefined as T;
    if (res.ok) return data as T;
    if (res.status === 401) throw new ApiError('unauthorized', errorMessage(data, '로그인이 필요합니다'), 401);
    if (res.status === 404) throw new ApiError('notFound', errorMessage(data, '작업을 찾을 수 없습니다'), 404);
    if (res.status >= 500 || res.status === 429) {
      throw new ApiError('transient', errorMessage(data, '서버 오류가 발생했습니다'), res.status);
    }
    throw new ApiError('rejected', errorMessage(data, '요청이 거부되었습니다'), res.status);
  };
}

export function createApiClient(options: ClientOptions = {}): ApiClient {
  const request = createRequest(options);
  return {
    list: () => request<Task[]>('GET', '/api/tasks'),
    create: (task) => request<Task>('POST', '/api/tasks', task),
    patch: (id, patch) => request<Task>('PATCH', `/api/tasks/${id}`, patch),
    remove: (id) => request<void>('DELETE', `/api/tasks/${id}`),
  };
}

export function createAuthApi(options: ClientOptions = {}): AuthApi {
  const request = createRequest(options);
  return {
    me: () => request<User>('GET', '/api/me'),
    logout: () => request<void>('POST', '/auth/logout'),
    claim: (clientId) => request<{ claimed: number }>('POST', '/api/tasks/claim', { clientId }),
  };
}
