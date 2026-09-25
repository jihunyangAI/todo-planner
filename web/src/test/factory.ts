import type { Task } from '@todo/shared';

let seq = 0;

/** 테스트용 작업. id는 UUID v4 형식을 지키고, createdAt은 만든 순서대로 커진다. */
export function makeTask(overrides: Partial<Task> = {}): Task {
  seq += 1;
  const n = String(seq).padStart(12, '0');
  const created = new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString();
  return {
    id: `00000000-0000-4000-8000-${n}`,
    title: `작업 ${seq}`,
    memo: '',
    plannedDate: null,
    dueDate: null,
    priority: 'medium',
    category: null,
    completed: false,
    completedAt: null,
    createdAt: created,
    updatedAt: created,
    ...overrides,
  };
}
