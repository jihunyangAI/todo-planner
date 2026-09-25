import { CATEGORIES, type ISODate } from '@todo/shared';
import { EmptyState } from '../components/EmptyState';
import { QuickAdd } from '../components/QuickAdd';
import { TaskList } from '../components/TaskList';
import {
  CATEGORY_LABEL,
  EMPTY_FILTER,
  filterTasks,
  isFilterActive,
  sortTasks,
  type CategoryFilter,
  type StatusFilter,
  type TaskFilter,
} from '../domain/selectors';
import { useTaskState } from '../store/TaskStore';

const STATUS_VALUES: StatusFilter[] = ['all', 'active', 'done'];
const CATEGORY_VALUES: CategoryFilter[] = ['all', 'none', ...CATEGORIES];

/** URL 해시 쿼리(#/all?q=…&status=…&category=…&unplanned=1) ↔ 필터 */
export function filterFromQuery(query: URLSearchParams): TaskFilter {
  const status = query.get('status') as StatusFilter;
  const category = query.get('category') as CategoryFilter;
  return {
    query: query.get('q') ?? '',
    status: STATUS_VALUES.includes(status) ? status : 'all',
    category: CATEGORY_VALUES.includes(category) ? category : 'all',
    unplannedOnly: query.get('unplanned') === '1',
  };
}

export function filterToQuery(filter: TaskFilter): URLSearchParams {
  const query = new URLSearchParams();
  if (filter.query) query.set('q', filter.query);
  if (filter.status !== 'all') query.set('status', filter.status);
  if (filter.category !== 'all') query.set('category', filter.category);
  if (filter.unplannedOnly) query.set('unplanned', '1');
  return query;
}

interface Props {
  today: ISODate;
  query: URLSearchParams;
  onQueryChange: (query: URLSearchParams) => void;
}

export function AllTasksView({ today, query, onQueryChange }: Props) {
  const { tasks } = useTaskState();
  const filter = filterFromQuery(query);
  const visible = sortTasks(filterTasks(tasks, filter));
  const update = (next: Partial<TaskFilter>) => onQueryChange(filterToQuery({ ...filter, ...next }));

  return (
    <section aria-labelledby="all-heading">
      <header className="view-header">
        <h1 id="all-heading">전체 할 일</h1>
      </header>
      <QuickAdd plannedDate={null} label="할 일 추가 (날짜 없이)" />

      <div className="filters" role="search">
        <label className="field field--inline">
          <span>제목 검색</span>
          <input type="search" value={filter.query} onChange={(e) => update({ query: e.target.value })} />
        </label>
        <label className="field field--inline">
          <span>상태</span>
          <select value={filter.status} onChange={(e) => update({ status: e.target.value as StatusFilter })}>
            <option value="all">전체</option>
            <option value="active">미완료</option>
            <option value="done">완료</option>
          </select>
        </label>
        <label className="field field--inline">
          <span>카테고리</span>
          <select value={filter.category} onChange={(e) => update({ category: e.target.value as CategoryFilter })}>
            <option value="all">전체</option>
            <option value="none">미지정</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="field field--check">
          <input
            type="checkbox"
            checked={filter.unplannedOnly}
            onChange={(e) => update({ unplannedOnly: e.target.checked })}
          />
          <span>미계획만</span>
        </label>
      </div>

      {tasks.length === 0 ? (
        <EmptyState>아직 할 일이 없습니다.</EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState
          action={
            isFilterActive(filter) && (
              <button type="button" className="button" onClick={() => update(EMPTY_FILTER)}>
                필터 초기화
              </button>
            )
          }
        >
          검색 결과 없음
        </EmptyState>
      ) : (
        <TaskList tasks={visible} today={today} label="전체 할 일" empty="" />
      )}
    </section>
  );
}
