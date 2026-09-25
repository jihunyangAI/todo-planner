import { describe, expect, it } from 'vitest';
import { validateTaskForm, type TaskFormValues } from './validation';

const base: TaskFormValues = {
  title: '보고서',
  memo: '',
  plannedDate: null,
  dueDate: null,
  priority: 'medium',
  category: null,
};

describe('validateTaskForm', () => {
  it('공백 제목은 오류 (AC1)', () => {
    expect(validateTaskForm({ ...base, title: '  ' }).errors.title).toBe('제목을 입력하세요');
  });

  it('실행 예정일이 마감일보다 늦으면 오류가 아니라 경고 (AC4)', () => {
    const result = validateTaskForm({ ...base, plannedDate: '2026-09-30', dueDate: '2026-09-25' });
    expect(result.errors).toEqual({});
    expect(result.warnings.plannedDate).toMatch(/마감일보다 늦습니다/);
  });

  it('같은 날이면 경고하지 않는다', () => {
    expect(validateTaskForm({ ...base, plannedDate: '2026-09-25', dueDate: '2026-09-25' }).warnings).toEqual({});
  });
});
