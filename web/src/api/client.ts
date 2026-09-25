import type { Task, TaskCreate, TaskPatch } from '@todo/shared';

/**
 * - transient: 네트워크 오류·시간 초과·5xx·429. 다시 시도할 수 있다.
 * - rejected: 400·409·413. 다시 보내도 같은 결과다.
 * - notFound: 404.
 */
export type ApiErrorKind = 'transient' | 'rejected' | 'notFound';

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

const REQUEST_TIMEOUT_MS = 20_000;

interface ClientOptions {
  baseUrl: string;
  getClientId: () => string;
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

export function createApiClient({
  baseUrl,
  getClientId,
  timeoutMs = REQUEST_TIMEOUT_MS,
  fetchImpl = (...args) => globalThis.fetch(...args),
}: ClientOptions): ApiClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    let data: unknown = null;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          'X-Client-Id': getClientId(),
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
    if (res.status === 404) throw new ApiError('notFound', errorMessage(data, '작업을 찾을 수 없습니다'), 404);
    if (res.status >= 500 || res.status === 429) {
      throw new ApiError('transient', errorMessage(data, '서버 오류가 발생했습니다'), res.status);
    }
    throw new ApiError('rejected', errorMessage(data, '요청이 거부되었습니다'), res.status);
  }

  return {
    list: () => request<Task[]>('GET', '/api/tasks'),
    create: (task) => request<Task>('POST', '/api/tasks', task),
    patch: (id, patch) => request<Task>('PATCH', `/api/tasks/${id}`, patch),
    remove: (id) => request<void>('DELETE', `/api/tasks/${id}`),
  };
}
