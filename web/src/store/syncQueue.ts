import { isUuidV4, type Task, type TaskCreateInput, type TaskPatch } from '@todo/shared';
import { ApiError, type ApiClient } from '../api/client';
import { normalizeClientId, type ClientIdStore } from '../api/clientId';
import { generateUuid } from '../lib/uuid';
import { applyMutation, type Mutation } from './reducer';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface Notice {
  id: number;
  tone: 'info' | 'error';
  text: string;
}

export interface EngineSnapshot {
  status: LoadStatus;
  /** 첫 로드가 3초 넘게 걸리는 중 */
  slow: boolean;
  tasks: Task[];
  /** 실패 목록에 요청이 있어 잠긴 작업 */
  lockedIds: ReadonlySet<string>;
  /** "저장하지 못한 변경 N건"의 N (작업 수) */
  failedCount: number;
  notices: Notice[];
  clientId: string;
  previousClientId: string | null;
  persistentClientId: boolean;
}

export type SwitchResult =
  | { ok: true; changed: boolean }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'unsaved'; count: number };

export interface Timers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

const defaultTimers: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const SLOW_NOTICE_MS = 3_000;
const FIRST_LOAD_DEADLINE_MS = 60_000;
const FIRST_LOAD_RETRY_DELAYS_MS = [2_000, 4_000, 8_000];

export type NewTaskInput = Omit<TaskCreateInput, 'id'>;

interface EngineDeps {
  api: ApiClient;
  clientIds: ClientIdStore;
  timers?: Timers;
  now?: () => Date;
}

/**
 * 작업 목록의 단일 저장소이자 서버 동기화 큐.
 * - 변경은 화면에 먼저 반영하고, 작업 ID별로 차례대로 보낸다.
 * - 작업마다 서버가 마지막으로 확인해 준 확정 상태를 보관한다.
 * - 실패한 작업만 확정 상태로 되돌린다.
 */
export class TaskEngine {
  private display = new Map<string, Task>();
  private confirmed = new Map<string, Task>();
  private queues = new Map<string, Mutation[]>();
  private inFlight = new Set<string>();
  private failed = new Map<string, Mutation[]>();
  private status: LoadStatus = 'loading';
  private slow = false;
  /** ID가 바뀔 때마다 올린다. 이전 세대의 응답은 버린다. */
  private generation = 0;
  /** 큐에 변경이 들어올 때마다 올린다. 받아 오는 중 변경이 생겼는지 판단한다. */
  private mutationCounter = 0;
  private loadToken = 0;
  private refreshWanted = false;
  private notices: Notice[] = [];
  private noticeSeq = 0;
  private listeners = new Set<() => void>();
  private snapshot: EngineSnapshot;
  private readonly timers: Timers;
  private readonly now: () => Date;

  constructor(private readonly deps: EngineDeps) {
    this.timers = deps.timers ?? defaultTimers;
    this.now = deps.now ?? (() => new Date());
    this.snapshot = this.buildSnapshot();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): EngineSnapshot => this.snapshot;

  private emit() {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }

  private buildSnapshot(): EngineSnapshot {
    const { clientIds } = this.deps;
    return {
      status: this.status,
      slow: this.slow,
      tasks: [...this.display.values()],
      lockedIds: new Set(this.failed.keys()),
      failedCount: this.failed.size,
      notices: this.notices,
      clientId: clientIds.current,
      previousClientId: clientIds.previous,
      persistentClientId: clientIds.persistent,
    };
  }

  // ─── 알림 ────────────────────────────────────────────────

  dismissNotice(id: number): void {
    this.notices = this.notices.filter((n) => n.id !== id);
    this.emit();
  }

  // ─── 목록 불러오기 ────────────────────────────────────────

  /** 첫 로드(ID 전환 뒤 포함): 최대 4회, 2·4·8초 간격, 60초 상한. 받기 전에는 쓰기를 막는다. */
  async load(): Promise<void> {
    const token = ++this.loadToken;
    const generation = this.generation;
    const isCurrent = () => token === this.loadToken && generation === this.generation;
    this.status = 'loading';
    this.slow = false;
    this.emit();

    const slowTimer = this.timers.setTimeout(() => {
      if (isCurrent() && this.status === 'loading') {
        this.slow = true;
        this.emit();
      }
    }, SLOW_NOTICE_MS);
    const deadline = this.timers.setTimeout(() => {
      if (isCurrent() && this.status === 'loading') {
        this.loadToken += 1; // 진행 중인 시도의 늦은 응답은 버린다
        this.fail();
      }
    }, FIRST_LOAD_DEADLINE_MS);
    const finish = () => {
      this.timers.clearTimeout(slowTimer);
      this.timers.clearTimeout(deadline);
    };

    for (let attempt = 0; attempt <= FIRST_LOAD_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const tasks = await this.deps.api.list();
        if (!isCurrent()) return;
        finish();
        this.replaceAll(tasks);
        this.status = 'ready';
        this.slow = false;
        this.emit();
        return;
      } catch {
        if (!isCurrent()) return;
        const delay = FIRST_LOAD_RETRY_DELAYS_MS[attempt];
        if (delay === undefined) break;
        await new Promise<void>((resolve) => this.timers.setTimeout(resolve, delay));
        if (!isCurrent()) return;
      }
    }
    finish();
    this.fail();
  }

  private fail() {
    this.status = 'error';
    this.slow = false;
    this.emit();
  }

  private replaceAll(tasks: Task[]) {
    this.display = new Map(tasks.map((t) => [t.id, t]));
    this.confirmed = new Map(tasks.map((t) => [t.id, t]));
  }

  private hasActiveRequests(): boolean {
    return this.inFlight.size > 0 || this.queues.size > 0;
  }

  /**
   * 창이 다시 활성화될 때(또는 [버리기] 뒤) 목록을 다시 받아 온다.
   * - 첫 로드가 성공한 뒤에만 동작한다.
   * - 전송 중인 요청이 있으면 모두 끝난 뒤로 미룬다.
   * - 한 번만 시도하고, 실패하면 조용히 넘어간다.
   * - GET을 보낸 뒤 변경이 하나라도 생기면 응답을 통째로 버린다.
   */
  async refresh(): Promise<void> {
    if (this.status !== 'ready') return;
    if (this.hasActiveRequests()) {
      this.refreshWanted = true;
      return;
    }
    this.refreshWanted = false;
    const generation = this.generation;
    const counter = this.mutationCounter;
    let tasks: Task[];
    try {
      tasks = await this.deps.api.list();
    } catch {
      return;
    }
    if (generation !== this.generation || counter !== this.mutationCounter) return;
    const locked = this.failed;
    const nextDisplay = new Map<string, Task>();
    const nextConfirmed = new Map<string, Task>();
    for (const task of tasks) {
      nextConfirmed.set(task.id, task);
      if (!locked.has(task.id)) nextDisplay.set(task.id, task);
    }
    for (const id of locked.keys()) {
      const local = this.display.get(id);
      if (local) nextDisplay.set(id, local);
    }
    this.display = nextDisplay;
    this.confirmed = nextConfirmed;
    this.emit();
  }

  private maybeRefresh() {
    if (this.refreshWanted && !this.hasActiveRequests()) void this.refresh();
  }

  // ─── 변경 ────────────────────────────────────────────────

  canEdit(id: string): boolean {
    return this.status === 'ready' && !this.failed.has(id);
  }

  create(input: NewTaskInput): Task | null {
    if (this.status !== 'ready') return null;
    const now = this.now().toISOString();
    const task: Task = {
      id: generateUuid(),
      title: input.title.trim(),
      memo: input.memo ?? '',
      plannedDate: input.plannedDate ?? null,
      dueDate: input.dueDate ?? null,
      priority: input.priority ?? 'medium',
      category: input.category ?? null,
      completed: input.completed ?? false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.enqueue({ kind: 'create', task });
    return task;
  }

  update(id: string, patch: TaskPatch): boolean {
    if (!this.canEdit(id) || !this.display.has(id)) return false;
    this.enqueue({ kind: 'patch', id, patch });
    return true;
  }

  remove(id: string): boolean {
    if (!this.canEdit(id) || !this.display.has(id)) return false;
    this.enqueue({ kind: 'delete', id });
    return true;
  }

  private enqueue(mutation: Mutation) {
    const id = mutation.kind === 'create' ? mutation.task.id : mutation.id;
    this.applyToDisplay(id, mutation);
    const queue = this.queues.get(id) ?? [];
    queue.push(mutation);
    this.queues.set(id, queue);
    this.mutationCounter += 1;
    this.emit();
    this.pump(id);
  }

  private applyToDisplay(id: string, mutation: Mutation) {
    const next = applyMutation(this.display.get(id), mutation, this.now());
    if (next) this.display.set(id, next);
    else this.display.delete(id);
  }

  private send(mutation: Mutation): Promise<Task | null> {
    const { api } = this.deps;
    switch (mutation.kind) {
      case 'create': {
        const { id, title, memo, plannedDate, dueDate, priority, category, completed } = mutation.task;
        return api.create({ id, title, memo, plannedDate, dueDate, priority, category, completed });
      }
      case 'patch':
        return api.patch(mutation.id, mutation.patch);
      case 'delete':
        return api.remove(mutation.id).then(() => null);
    }
  }

  /** 작업 ID별로 차례대로 보낸다. 앞 요청이 끝나기 전에는 다음 요청을 보내지 않는다. */
  private pump(id: string) {
    if (this.inFlight.has(id)) return;
    const mutation = this.queues.get(id)?.[0];
    if (!mutation) return;
    this.inFlight.add(id);
    const generation = this.generation;
    this.send(mutation).then(
      (task) => {
        if (generation === this.generation) this.onSuccess(id, task);
      },
      (error: unknown) => {
        if (generation !== this.generation) return;
        const apiError = error instanceof ApiError ? error : new ApiError('transient', String(error));
        this.onError(id, mutation, apiError);
      },
    );
  }

  private onSuccess(id: string, task: Task | null) {
    this.inFlight.delete(id);
    const queue = this.queues.get(id) ?? [];
    queue.shift();
    if (task) this.confirmed.set(id, task);
    else this.confirmed.delete(id);
    if (queue.length === 0) {
      this.queues.delete(id);
      // 대기 중인 요청이 더 없을 때만 화면 값을 서버 응답으로 바꾼다
      if (task) this.display.set(id, task);
      else this.display.delete(id);
    }
    this.emit();
    this.pump(id);
    this.maybeRefresh();
  }

  private onError(id: string, mutation: Mutation, error: ApiError) {
    if (error.kind === 'notFound' && mutation.kind === 'delete') {
      this.onSuccess(id, null); // 이미 지워졌다
      return;
    }
    this.inFlight.delete(id);
    const pending = this.queues.get(id) ?? [];
    this.queues.delete(id);
    if (error.kind === 'transient') {
      this.failed.set(id, [...(this.failed.get(id) ?? []), ...pending]);
      this.rollback(id);
    } else if (error.kind === 'rejected') {
      this.rollback(id);
      this.pushNotice(error.message, 'error');
    } else {
      this.confirmed.delete(id);
      this.display.delete(id);
      this.pushNotice('다른 곳에서 삭제된 작업입니다', 'info');
    }
    this.emit();
    this.maybeRefresh();
  }

  private pushNotice(text: string, tone: Notice['tone']) {
    this.notices = [...this.notices, { id: ++this.noticeSeq, tone, text }];
  }

  private rollback(id: string) {
    const confirmed = this.confirmed.get(id);
    if (confirmed) this.display.set(id, confirmed);
    else this.display.delete(id);
  }

  /** 실패 목록의 요청을 원래 순서대로 화면에 다시 반영하고 다시 보낸다. */
  retry(): void {
    const entries = [...this.failed.entries()];
    this.failed.clear();
    for (const [id, mutations] of entries) {
      let task = this.confirmed.get(id);
      for (const mutation of mutations) task = applyMutation(task, mutation, this.now());
      if (task) this.display.set(id, task);
      else this.display.delete(id);
      this.queues.set(id, [...mutations]);
      this.mutationCounter += 1;
    }
    this.emit();
    for (const [id] of entries) this.pump(id);
  }

  /** 실패 목록을 비우고 서버의 실제 값으로 맞춘다. */
  discard(): void {
    for (const id of this.failed.keys()) this.rollback(id);
    this.failed.clear();
    this.emit();
    void this.refresh();
  }

  // ─── 클라이언트 ID ────────────────────────────────────────

  /** 전송 중·대기 중·실패 목록에 있는 변경의 작업 수 */
  unsavedTaskCount(): number {
    return new Set([...this.queues.keys(), ...this.inFlight, ...this.failed.keys()]).size;
  }

  switchClientId(raw: string): SwitchResult {
    const next = normalizeClientId(raw);
    if (!isUuidV4(next)) return { ok: false, reason: 'invalid' };
    if (next === this.deps.clientIds.current) return { ok: true, changed: false };
    const count = this.unsavedTaskCount();
    if (count > 0) return { ok: false, reason: 'unsaved', count };
    this.deps.clientIds.set(next);
    this.resetForNewClient();
    return { ok: true, changed: true };
  }

  revertClientId(): SwitchResult {
    const previous = this.deps.clientIds.previous;
    if (!previous) return { ok: false, reason: 'invalid' };
    return this.switchClientId(previous);
  }

  /** 다른 탭에서 ID가 바뀌었다. 대기·실패 요청은 새 ID로 보내지 않고 버린다. */
  handleExternalClientIdChange(next: string): void {
    const dropped = this.unsavedTaskCount();
    this.deps.clientIds.adopt(next);
    this.resetForNewClient();
    this.pushNotice(
      dropped > 0
        ? `다른 탭에서 ID가 바뀌어 목록을 다시 불러왔습니다. 저장하지 못한 변경 ${dropped}건은 버려졌습니다.`
        : '다른 탭에서 ID가 바뀌어 목록을 다시 불러왔습니다.',
      'info',
    );
    this.emit();
  }

  private resetForNewClient() {
    this.generation += 1;
    this.display.clear();
    this.confirmed.clear();
    this.queues.clear();
    this.inFlight.clear();
    this.failed.clear();
    this.refreshWanted = false;
    void this.load();
  }
}
