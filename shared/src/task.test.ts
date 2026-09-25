import { describe, expect, it } from 'vitest';
import { TaskCreateSchema, TaskPatchSchema, isUuidV4, isValidISODate, toFieldErrors } from './task.js';

const ID = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

describe('TaskCreateSchema', () => {
  it('기본값을 채운다 (우선순위 보통, 날짜·카테고리 없음, 미완료)', () => {
    const parsed = TaskCreateSchema.parse({ id: ID, title: '  장보기  ' });
    expect(parsed).toEqual({
      id: ID,
      title: '장보기',
      memo: '',
      plannedDate: null,
      dueDate: null,
      priority: 'medium',
      category: null,
      completed: false,
    });
  });

  it('공백뿐인 제목을 거부한다', () => {
    const result = TaskCreateSchema.safeParse({ id: ID, title: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) expect(toFieldErrors(result.error).title).toBe('제목을 입력하세요');
  });

  it('100자 제목은 받고 101자 제목은 거부한다', () => {
    expect(TaskCreateSchema.safeParse({ id: ID, title: 'a'.repeat(100) }).success).toBe(true);
    expect(TaskCreateSchema.safeParse({ id: ID, title: 'a'.repeat(101) }).success).toBe(false);
  });

  it('2,000자 메모는 받고 2,001자 메모는 거부한다', () => {
    expect(TaskCreateSchema.safeParse({ id: ID, title: 't', memo: 'm'.repeat(2000) }).success).toBe(true);
    expect(TaskCreateSchema.safeParse({ id: ID, title: 't', memo: 'm'.repeat(2001) }).success).toBe(false);
  });

  it('존재하지 않는 날짜와 형식이 틀린 날짜를 거부한다', () => {
    for (const bad of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-9-5', '2026-09-25T00:00:00Z']) {
      expect(TaskCreateSchema.safeParse({ id: ID, title: 't', plannedDate: bad }).success).toBe(false);
    }
    expect(TaskCreateSchema.safeParse({ id: ID, title: 't', plannedDate: '2028-02-29' }).success).toBe(true);
  });

  it('UUID v4가 아닌 id를 거부한다', () => {
    for (const bad of ['abc', ID.toUpperCase(), '3f1c2d4e-5a6b-1c7d-8e9f-0a1b2c3d4e5f']) {
      expect(TaskCreateSchema.safeParse({ id: bad, title: 't' }).success).toBe(false);
    }
  });

  it('알 수 없는 필드를 거부한다', () => {
    expect(TaskCreateSchema.safeParse({ id: ID, title: 't', ownerId: ID }).success).toBe(false);
  });
});

describe('TaskPatchSchema', () => {
  it('서버가 관리하는 필드를 거부한다', () => {
    for (const key of ['id', 'ownerId', 'completedAt', 'createdAt', 'updatedAt']) {
      expect(TaskPatchSchema.safeParse({ [key]: 'x' }).success).toBe(false);
    }
  });

  it('빈 PATCH를 거부하고 날짜 해제(null)는 받는다', () => {
    expect(TaskPatchSchema.safeParse({}).success).toBe(false);
    expect(TaskPatchSchema.parse({ plannedDate: null, dueDate: null })).toEqual({ plannedDate: null, dueDate: null });
  });
});

describe('isUuidV4 / isValidISODate', () => {
  it('소문자 UUID v4만 참이다', () => {
    expect(isUuidV4(ID)).toBe(true);
    expect(isUuidV4(ID.toUpperCase())).toBe(false);
  });

  it('윤년 2월 29일을 구분한다', () => {
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('2100-02-29')).toBe(false);
  });
});
