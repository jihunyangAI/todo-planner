import type { ISODate, Task } from '@todo/shared';
import { EmptyState } from './EmptyState';
import { TaskItem } from './TaskItem';

interface Props {
  tasks: Task[];
  today: ISODate;
  empty: string;
  label: string;
  onToggle?: (task: Task) => void;
}

export function TaskList({ tasks, today, empty, label, onToggle }: Props) {
  if (tasks.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <ul className="task-list" aria-label={label}>
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} today={today} onToggle={onToggle} />
      ))}
    </ul>
  );
}
