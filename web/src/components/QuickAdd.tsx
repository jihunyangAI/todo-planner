import type { ISODate } from '@todo/shared';
import { useId, useState, type FormEvent } from 'react';
import { validateTaskForm } from '../domain/validation';
import { useEngine } from '../store/TaskStore';
import { EMPTY_FORM, TaskForm } from './TaskForm';

/** 제목만 입력하고 Enter로 추가한다. [자세히]는 전체 입력 폼을 연다. */
export function QuickAdd({ plannedDate, label }: { plannedDate: ISODate | null; label: string }) {
  const engine = useEngine();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const inputId = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const { errors } = validateTaskForm({ ...EMPTY_FORM, title, plannedDate });
    if (errors.title) {
      setError(errors.title);
      return;
    }
    engine.create({ title, plannedDate });
    setTitle('');
    setError(null);
  };

  return (
    <>
      <form className="quick-add" onSubmit={submit} noValidate>
        <label htmlFor={inputId} className="visually-hidden">
          {label}
        </label>
        <input
          id={inputId}
          className="quick-add__input"
          placeholder={label}
          value={title}
          maxLength={100}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
        />
        <button type="submit" className="button button--primary">
          추가
        </button>
        <button type="button" className="button" onClick={() => setDetailOpen(true)}>
          자세히
        </button>
        {error && (
          <span id={`${inputId}-error`} className="field__error" role="alert">
            {error}
          </span>
        )}
      </form>
      {/* 폼 안에 폼을 두면 안쪽 submit 이벤트가 바깥 폼으로 전파되므로 밖에 렌더링한다 */}
      {detailOpen && (
        <TaskForm
          heading="새 할 일"
          initial={{ ...EMPTY_FORM, title, plannedDate }}
          onCancel={() => setDetailOpen(false)}
          onSubmit={(values) => {
            engine.create(values);
            setTitle('');
            setDetailOpen(false);
          }}
        />
      )}
    </>
  );
}
