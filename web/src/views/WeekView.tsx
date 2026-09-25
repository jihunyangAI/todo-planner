import type { ISODate } from '@todo/shared';
import { useState } from 'react';
import { ProgressBar } from '../components/ProgressBar';
import { TaskList } from '../components/TaskList';
import { addDays, formatShortDate, weekDays, weekStart } from '../domain/date';
import { progress, sortTasks } from '../domain/selectors';
import { useTaskState } from '../store/TaskStore';

/** 'current'면 오늘이 속한 주를 따라간다(날짜가 다음 주로 넘어가면 화면도 넘어간다). */
type WeekAnchor = 'current' | ISODate;

export function WeekView({ today }: { today: ISODate }) {
  const { tasks } = useTaskState();
  const [anchor, setAnchor] = useState<WeekAnchor>('current');
  const start = anchor === 'current' ? weekStart(today) : anchor;
  const days = weekDays(start);
  const end = days[6]!;
  const unplanned = sortTasks(tasks.filter((t) => t.plannedDate === null));
  const move = (delta: number) => {
    const next = addDays(start, delta * 7);
    setAnchor(next === weekStart(today) ? 'current' : next);
  };

  return (
    <section aria-labelledby="week-heading">
      <header className="view-header">
        <h1 id="week-heading">주간 계획</h1>
        <div className="week-nav">
          <button type="button" className="button" onClick={() => move(-1)}>
            이전 주
          </button>
          <button type="button" className="button" onClick={() => setAnchor('current')} disabled={anchor === 'current'}>
            이번 주
          </button>
          <button type="button" className="button" onClick={() => move(1)}>
            다음 주
          </button>
        </div>
        <p className="week-range" data-testid="week-range">
          {formatShortDate(start)} ~ {formatShortDate(end)}
        </p>
        <ProgressBar label="주간 진행률" value={progress(tasks, start, end)} />
      </header>

      <div className="week-grid">
        {days.map((day) => {
          const dayTasks = sortTasks(tasks.filter((t) => t.plannedDate === day));
          return (
            <section
              key={day}
              className={`week-day${day === today ? ' week-day--today' : ''}`}
              aria-label={`${formatShortDate(day)}${day === today ? ' 오늘' : ''}`}
              data-date={day}
            >
              <h2 className="week-day__title">
                {formatShortDate(day)}
                {day === today && <span className="badge badge--today">오늘</span>}
              </h2>
              <TaskList tasks={dayTasks} today={today} label={formatShortDate(day)} empty="계획 없음" />
            </section>
          );
        })}
      </div>

      <section className="unplanned" aria-labelledby="unplanned-heading">
        <h2 id="unplanned-heading" className="section-title">
          미계획
        </h2>
        <TaskList tasks={unplanned} today={today} label="미계획" empty="미계획 작업이 없습니다." />
      </section>
    </section>
  );
}
