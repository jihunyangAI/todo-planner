import type { Task, TaskPatch } from '@todo/shared';

export type Mutation =
  | { kind: 'create'; task: Task }
  | { kind: 'patch'; id: string; patch: TaskPatch }
  | { kind: 'delete'; id: string };

/** 변경 하나를 화면 값에 미리 반영한다(낙관적 업데이트). 삭제면 undefined. */
export function applyMutation(task: Task | undefined, mutation: Mutation, now: Date): Task | undefined {
  switch (mutation.kind) {
    case 'create':
      return mutation.task;
    case 'delete':
      return undefined;
    case 'patch': {
      if (!task) return undefined;
      const { patch } = mutation;
      let completedAt = task.completedAt;
      if (patch.completed !== undefined) {
        completedAt = patch.completed ? (task.completed ? task.completedAt : now.toISOString()) : null;
      }
      return { ...task, ...patch, completedAt, updatedAt: now.toISOString() };
    }
  }
}
