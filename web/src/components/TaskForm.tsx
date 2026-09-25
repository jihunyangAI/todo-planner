import { CATEGORIES, PRIORITIES, TITLE_MAX, MEMO_MAX, type Category, type Priority } from '@todo/shared';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CATEGORY_LABEL, PRIORITY_LABEL } from '../domain/selectors';
import { validateTaskForm, type TaskFormValues } from '../domain/validation';

export const EMPTY_FORM: TaskFormValues = {
  title: '',
  memo: '',
  plannedDate: null,
  dueDate: null,
  priority: 'medium',
  category: null,
};

interface Props {
  heading: string;
  initial: TaskFormValues;
  onSubmit: (values: TaskFormValues) => void;
  onCancel: () => void;
}

/** 추가·수정 모달 */
export function TaskForm({ heading, initial, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const { errors, warnings } = validateTaskForm(values);
  const showErrors = submitted ? errors : {};

  useEffect(() => {
    ref.current?.showModal();
    titleRef.current?.focus();
  }, []);

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length === 0) onSubmit({ ...values, title: values.title.trim() });
  };

  const id = (name: string) => `${uid}-${name}`;

  return (
    <dialog
      ref={ref}
      className="dialog dialog--form"
      aria-labelledby={id('heading')}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <form onSubmit={submit} noValidate>
        <h2 id={id('heading')} className="dialog__title">
          {heading}
        </h2>

        <div className="field">
          <label htmlFor={id('title')}>제목 (필수)</label>
          <input
            ref={titleRef}
            id={id('title')}
            value={values.title}
            maxLength={TITLE_MAX}
            aria-invalid={Boolean(showErrors.title)}
            aria-describedby={`${id('title-count')}${showErrors.title ? ` ${id('title-error')}` : ''}`}
            onChange={(e) => set('title', e.target.value)}
          />
          <span id={id('title-count')} className="field__hint">
            {values.title.length}/{TITLE_MAX}
          </span>
          {showErrors.title && (
            <span id={id('title-error')} className="field__error" role="alert">
              {showErrors.title}
            </span>
          )}
        </div>

        <div className="field">
          <label htmlFor={id('memo')}>메모</label>
          <textarea
            id={id('memo')}
            value={values.memo}
            maxLength={MEMO_MAX}
            rows={3}
            aria-describedby={id('memo-count')}
            onChange={(e) => set('memo', e.target.value)}
          />
          <span id={id('memo-count')} className="field__hint">
            {values.memo.length}/{MEMO_MAX}
          </span>
        </div>

        <div className="field-row">
          <DateField
            id={id('planned')}
            label="실행 예정일"
            value={values.plannedDate}
            onChange={(v) => set('plannedDate', v)}
            warning={warnings.plannedDate}
            warningId={id('planned-warning')}
          />
          <DateField id={id('due')} label="마감일" value={values.dueDate} onChange={(v) => set('dueDate', v)} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor={id('priority')}>우선순위</label>
            <select
              id={id('priority')}
              value={values.priority}
              onChange={(e) => set('priority', e.target.value as Priority)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={id('category')}>카테고리</label>
            <select
              id={id('category')}
              value={values.category ?? ''}
              onChange={(e) => set('category', (e.target.value || null) as Category | null)}
            >
              <option value="">미지정</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="dialog__actions">
          <button type="button" className="button" onClick={onCancel}>
            취소
          </button>
          <button type="submit" className="button button--primary">
            저장
          </button>
        </div>
      </form>
    </dialog>
  );
}

function DateField(props: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  warning?: string;
  warningId?: string;
}) {
  const { id, label, value, onChange, warning, warningId } = props;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="date-input">
        <input
          id={id}
          type="date"
          value={value ?? ''}
          aria-describedby={warning ? warningId : undefined}
          onChange={(e) => onChange(e.target.value || null)}
        />
        <button type="button" className="button button--small" disabled={!value} onClick={() => onChange(null)}>
          {label} 해제
        </button>
      </div>
      {warning && (
        <span id={warningId} className="field__warning">
          {warning}
        </span>
      )}
    </div>
  );
}
