import type { ISODate, Task, TaskPatch } from '@todo/shared';
import { useState } from 'react';
import { addDays, formatShortDate } from '../domain/date';
import { CATEGORY_LABEL, dueStatus } from '../domain/selectors';
import type { TaskFormValues } from '../domain/validation';
import { useEngine, useTaskState } from '../store/TaskStore';
import { CompletedBadge, DueBadge, LockedBadge, PriorityBadge } from './Badge';
import { ConfirmDialog } from './ConfirmDialog';
import { TaskForm } from './TaskForm';

interface Props {
  task: Task;
  today: ISODate;
  /** 체크 처리를 화면이 가로채야 할 때(오늘 화면의 완료 알림) */
  onToggle?: (task: Task) => void;
}

function toFormValues(task: Task): TaskFormValues {
  const { title, memo, plannedDate, dueDate, priority, category } = task;
  return { title, memo, plannedDate, dueDate, priority, category };
}

/** 바뀐 필드만 PATCH로 보낸다. */
function diff(task: Task, values: TaskFormValues): TaskPatch {
  const patch: TaskPatch = {};
  for (const key of Object.keys(values) as (keyof TaskFormValues)[]) {
    if (values[key] !== task[key]) Object.assign(patch, { [key]: values[key] });
  }
  return patch;
}

export function TaskItem({ task, today, onToggle }: Props) {
  const engine = useEngine();
  const { lockedIds } = useTaskState();
  const locked = lockedIds.has(task.id);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const checkboxId = `task-${task.id}`;

  const toggle = () => {
    if (onToggle) onToggle(task);
    else engine.update(task.id, { completed: !task.completed });
  };
  const reschedule = (plannedDate: ISODate | null) => {
    engine.update(task.id, { plannedDate });
    setScheduleOpen(false);
  };

  return (
    <li className={`task${task.completed ? ' task--done' : ''}${locked ? ' task--locked' : ''}`} data-task-id={task.id}>
      <div className="task__main">
        <input
          id={checkboxId}
          type="checkbox"
          className="task__check"
          checked={task.completed}
          disabled={locked}
          onChange={toggle}
        />
        <label htmlFor={checkboxId} className="task__title">
          {task.title}
        </label>
      </div>
      <div className="task__meta">
        <PriorityBadge priority={task.priority} />
        {task.category && <span className="badge badge--category">{CATEGORY_LABEL[task.category]}</span>}
        {task.plannedDate && <span className="task__date">예정 {formatShortDate(task.plannedDate)}</span>}
        {task.dueDate && <span className="task__date">마감 {formatShortDate(task.dueDate)}</span>}
        <DueBadge status={dueStatus(task, today)} />
        <CompletedBadge task={task} />
        {locked && <LockedBadge />}
      </div>
      <div className="task__actions">
        <button
          type="button"
          className="button button--small"
          aria-expanded={scheduleOpen}
          aria-label={`${task.title} 실행 예정일 변경`}
          disabled={locked}
          onClick={() => setScheduleOpen((o) => !o)}
        >
          일정
        </button>
        <button
          type="button"
          className="button button--small"
          aria-label={`${task.title} 수정`}
          disabled={locked}
          onClick={() => setEditing(true)}
        >
          수정
        </button>
        <button
          type="button"
          className="button button--small button--danger"
          aria-label={`${task.title} 삭제`}
          disabled={locked}
          onClick={() => setConfirmingDelete(true)}
        >
          삭제
        </button>
      </div>
      {scheduleOpen && !locked && (
        <div className="schedule-menu" role="group" aria-label="실행 예정일 변경">
          <button type="button" className="button button--small" onClick={() => reschedule(today)}>
            오늘
          </button>
          <button type="button" className="button button--small" onClick={() => reschedule(addDays(today, 1))}>
            내일
          </button>
          <label className="schedule-menu__pick">
            <span>날짜 선택</span>
            <input
              type="date"
              value={task.plannedDate ?? ''}
              onChange={(e) => e.target.value && reschedule(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="button button--small"
            disabled={task.plannedDate === null}
            onClick={() => reschedule(null)}
          >
            해제
          </button>
        </div>
      )}
      {editing && (
        <TaskForm
          heading="할 일 수정"
          initial={toFormValues(task)}
          onCancel={() => setEditing(false)}
          onSubmit={(values) => {
            const patch = diff(task, values);
            if (Object.keys(patch).length > 0) engine.update(task.id, patch);
            setEditing(false);
          }}
        />
      )}
      <ConfirmDialog
        open={confirmingDelete}
        title="할 일을 삭제할까요?"
        confirmLabel="삭제"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          engine.remove(task.id);
        }}
      >
        <p>“{task.title}”을(를) 삭제하면 되돌릴 수 없습니다.</p>
      </ConfirmDialog>
    </li>
  );
}
