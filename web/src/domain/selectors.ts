import type { Category, ISODate, Priority, Task } from '@todo/shared';

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export const PRIORITY_LABEL: Record<Priority, string> = { high: '높음', medium: '보통', low: '낮음' };
export const CATEGORY_LABEL: Record<Category, string> = { work: '업무', personal: '개인', study: '공부' };

/** 미완료 먼저, 우선순위 높은 순, 마감일 빠른 순(없으면 뒤), 등록 순. */
function compareTasks(a: Task, b: Task): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

export function sortTasks(tasks: readonly Task[]): Task[] {
  return [...tasks].sort(compareTasks);
}

export type DueStatus = 'overdue' | 'dueToday' | null;

export function dueStatus(task: Task, today: ISODate): DueStatus {
  if (task.completed || task.dueDate === null) return null;
  if (task.dueDate < today) return 'overdue';
  if (task.dueDate === today) return 'dueToday';
  return null;
}

export interface TodaySections {
  planned: Task[];
  overdue: Task[];
  dueAlerts: Task[];
}

/** 각 작업은 오늘 예정 → 지난 미완료 → 마감 알림 순으로 처음 해당하는 섹션 한 곳에만 들어간다. */
export function selectToday(tasks: readonly Task[], today: ISODate): TodaySections {
  const planned: Task[] = [];
  const overdue: Task[] = [];
  const dueAlerts: Task[] = [];
  for (const task of tasks) {
    if (task.plannedDate === today) planned.push(task);
    else if (task.plannedDate !== null && task.plannedDate < today && !task.completed) overdue.push(task);
    else if (task.dueDate !== null && task.dueDate <= today && !task.completed) dueAlerts.push(task);
  }
  return { planned: sortTasks(planned), overdue: sortTasks(overdue), dueAlerts: sortTasks(dueAlerts) };
}

export interface Progress {
  done: number;
  total: number;
  percent: number;
}

/** 실행 예정일이 [from, to] 안에 있는 작업 중 완료한 비율. 미계획 작업은 빠진다. */
export function progress(tasks: readonly Task[], from: ISODate, to: ISODate = from): Progress {
  let total = 0;
  let done = 0;
  for (const task of tasks) {
    if (task.plannedDate === null || task.plannedDate < from || task.plannedDate > to) continue;
    total += 1;
    if (task.completed) done += 1;
  }
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function formatProgress({ done, total, percent }: Progress): string {
  return total === 0 ? '계획 없음' : `${done}/${total} 완료 (${percent}%)`;
}

export type StatusFilter = 'all' | 'active' | 'done';
export type CategoryFilter = 'all' | 'none' | Category;

export interface TaskFilter {
  query: string;
  status: StatusFilter;
  category: CategoryFilter;
  unplannedOnly: boolean;
}

export const EMPTY_FILTER: TaskFilter = { query: '', status: 'all', category: 'all', unplannedOnly: false };

export function filterTasks(tasks: readonly Task[], filter: TaskFilter): Task[] {
  const query = filter.query.trim().toLowerCase();
  return tasks.filter((task) => {
    if (query && !task.title.toLowerCase().includes(query)) return false;
    if (filter.status === 'active' && task.completed) return false;
    if (filter.status === 'done' && !task.completed) return false;
    if (filter.category === 'none' && task.category !== null) return false;
    if (filter.category !== 'all' && filter.category !== 'none' && task.category !== filter.category) return false;
    if (filter.unplannedOnly && task.plannedDate !== null) return false;
    return true;
  });
}

export function isFilterActive(filter: TaskFilter): boolean {
  return (
    filter.query.trim() !== '' || filter.status !== 'all' || filter.category !== 'all' || filter.unplannedOnly
  );
}
