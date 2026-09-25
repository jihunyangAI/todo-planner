import type { ISODate, Task } from '@todo/shared';
import { useCallback, useEffect, useState } from 'react';
import { ProgressBar } from '../components/ProgressBar';
import { QuickAdd } from '../components/QuickAdd';
import { TaskList } from '../components/TaskList';
import { Toast } from '../components/Toast';
import { progress, selectToday } from '../domain/selectors';
import { useEngine, useTaskState } from '../store/TaskStore';

export function TodayView({ today }: { today: ISODate }) {
  const engine = useEngine();
  const { tasks, lockedIds } = useTaskState();
  const sections = selectToday(tasks, today);
  // '지난 미완료'·'마감 알림'에서 완료하면 목록에서 빠지므로 되돌릴 수 있게 알린다
  const [justCompleted, setJustCompleted] = useState<Task | null>(null);
  const closeToast = useCallback(() => setJustCompleted(null), []);

  useEffect(() => {
    // 저장 실패로 잠긴 작업은 되돌리기를 막는다
    if (justCompleted && lockedIds.has(justCompleted.id)) setJustCompleted(null);
  }, [justCompleted, lockedIds]);

  const toggleWithUndo = (task: Task) => {
    const ok = engine.update(task.id, { completed: !task.completed });
    if (ok && !task.completed) setJustCompleted(task);
  };

  return (
    <section aria-labelledby="today-heading">
      <header className="view-header">
        <h1 id="today-heading">오늘</h1>
        <ProgressBar label="오늘 진행률" value={progress(tasks, today)} />
      </header>
      <QuickAdd plannedDate={today} label="오늘 할 일 추가" />

      <h2 className="section-title">오늘 예정</h2>
      <TaskList tasks={sections.planned} today={today} label="오늘 예정" empty="오늘 예정된 작업이 없습니다." />

      <h2 className="section-title">지난 미완료</h2>
      <TaskList
        tasks={sections.overdue}
        today={today}
        label="지난 미완료"
        empty="지난 미완료 작업이 없습니다."
        onToggle={toggleWithUndo}
      />

      <h2 className="section-title">마감 알림</h2>
      <TaskList
        tasks={sections.dueAlerts}
        today={today}
        label="마감 알림"
        empty="마감이 임박한 작업이 없습니다."
        onToggle={toggleWithUndo}
      />

      <div className="toasts" aria-live="polite">
        {justCompleted && (
          <Toast key={justCompleted.id} onClose={closeToast}>
            <span>“{justCompleted.title}” 완료했습니다</span>
            <button
              type="button"
              className="button button--small"
              onClick={() => {
                engine.update(justCompleted.id, { completed: false });
                setJustCompleted(null);
              }}
            >
              되돌리기
            </button>
          </Toast>
        )}
      </div>
    </section>
  );
}
