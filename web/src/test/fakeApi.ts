import type { Task, TaskCreate, TaskPatch } from '@todo/shared';
import { ApiError, type ApiClient, type ApiErrorKind } from '../api/client';

export interface PendingCall {
  method: 'list' | 'create' | 'patch' | 'remove';
  args: unknown[];
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

/** 응답 시점을 테스트가 직접 정하는 가짜 API. 각 호출은 resolve/reject될 때까지 대기한다. */
export class FakeApi implements ApiClient {
  calls: PendingCall[] = [];

  private record<T>(method: PendingCall['method'], args: unknown[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.calls.push({
        method,
        args,
        resolve: resolve as (v: unknown) => void,
        reject,
      });
    });
  }

  list = () => this.record<Task[]>('list', []);
  create = (task: TaskCreate) => this.record<Task>('create', [task]);
  patch = (id: string, patch: TaskPatch) => this.record<Task>('patch', [id, patch]);
  remove = (id: string) => this.record<void>('remove', [id]);

  /** 아직 응답하지 않은 호출 중 method가 같은 첫 호출 */
  take(method: PendingCall['method']): PendingCall {
    const index = this.calls.findIndex((c) => c.method === method);
    if (index < 0) throw new Error(`대기 중인 ${method} 호출이 없습니다 (${this.calls.map((c) => c.method).join(',')})`);
    return this.calls.splice(index, 1)[0]!;
  }

  pending(method?: PendingCall['method']): PendingCall[] {
    return method ? this.calls.filter((c) => c.method === method) : this.calls;
  }
}

export const apiError = (kind: ApiErrorKind, message: string = kind) => new ApiError(kind, message);

/** 대기 중인 마이크로태스크를 모두 흘려보낸다. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}
