import type { Priority, Task } from '@todo/shared';
import { PRIORITY_LABEL, type DueStatus } from '../domain/selectors';

/** 색만으로 구분하지 않도록 항상 텍스트를 함께 표시한다. */
export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge badge--priority-${priority}`}>{PRIORITY_LABEL[priority]}</span>;
}

export function DueBadge({ status }: { status: DueStatus }) {
  if (status === 'overdue') return <span className="badge badge--overdue">기한 지남</span>;
  if (status === 'dueToday') return <span className="badge badge--due-today">오늘 마감</span>;
  return null;
}

export function CompletedBadge({ task }: { task: Task }) {
  return task.completed ? <span className="badge badge--done">완료</span> : null;
}

export function LockedBadge() {
  return <span className="badge badge--locked">저장 실패</span>;
}
