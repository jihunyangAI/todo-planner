import { describe, expect, it } from 'vitest';
import { makeTask } from '../test/factory';
import {
  EMPTY_FILTER,
  dueStatus,
  filterTasks,
  formatProgress,
  progress,
  selectToday,
  sortTasks,
} from './selectors';

const TODAY = '2026-09-25';
const YESTERDAY = '2026-09-24';
const TOMORROW = '2026-09-26';

describe('sortTasks (AC25)', () => {
  it('높음 → 보통 → 낮음, 같으면 마감일 빠른 순(없으면 뒤), 그다음 등록 순, 완료는 맨 아래', () => {
    const lowDue = makeTask({ title: 'low', priority: 'low', dueDate: '2026-09-01' });
    const done = makeTask({ title: 'done', priority: 'high', completed: true });
    const medNoDue = makeTask({ title: 'med-nodue' });
    const medLate = makeTask({ title: 'med-late', dueDate: '2026-10-10' });
    const medEarly = makeTask({ title: 'med-early', dueDate: '2026-10-01' });
    const medNoDue2 = makeTask({ title: 'med-nodue-2' });
    const high = makeTask({ title: 'high', priority: 'high' });
    expect(sortTasks([lowDue, done, medNoDue, medLate, medEarly, medNoDue2, high]).map((t) => t.title)).toEqual([
      'high',
      'med-early',
      'med-late',
      'med-nodue',
      'med-nodue-2',
      'low',
      'done',
    ]);
  });
});

describe('selectToday', () => {
  it('오늘 예정이면서 기한이 지난 작업은 오늘 예정 섹션에만 한 번 나온다 (AC6)', () => {
    const task = makeTask({ plannedDate: TODAY, dueDate: YESTERDAY });
    const s = selectToday([task], TODAY);
    expect(s.planned).toEqual([task]);
    expect(s.overdue).toEqual([]);
    expect(s.dueAlerts).toEqual([]);
  });

  it('실행 예정일이 어제인 미완료는 지난 미완료, 날짜 없이 마감일이 어제인 작업은 마감 알림 (AC24)', () => {
    const overdue = makeTask({ plannedDate: YESTERDAY });
    const dueOnly = makeTask({ dueDate: YESTERDAY });
    const s = selectToday([overdue, dueOnly], TODAY);
    expect(s.overdue).toEqual([overdue]);
    expect(s.dueAlerts).toEqual([dueOnly]);
  });

  it('지난 미완료가 마감도 지났으면 지난 미완료에만 나온다', () => {
    const task = makeTask({ plannedDate: YESTERDAY, dueDate: YESTERDAY });
    const s = selectToday([task], TODAY);
    expect(s.overdue).toEqual([task]);
    expect(s.dueAlerts).toEqual([]);
  });

  it('오늘 예정 섹션에는 완료 작업도 남고, 지난 미완료·마감 알림에서는 완료 작업이 빠진다', () => {
    const doneToday = makeTask({ plannedDate: TODAY, completed: true });
    const doneOverdue = makeTask({ plannedDate: YESTERDAY, completed: true });
    const doneDue = makeTask({ dueDate: TODAY, completed: true });
    const s = selectToday([doneToday, doneOverdue, doneDue], TODAY);
    expect(s.planned).toEqual([doneToday]);
    expect(s.overdue).toEqual([]);
    expect(s.dueAlerts).toEqual([]);
  });

  it('미래 예정 작업의 마감이 오늘이면 마감 알림에 나온다', () => {
    const task = makeTask({ plannedDate: TOMORROW, dueDate: TODAY });
    expect(selectToday([task], TODAY).dueAlerts).toEqual([task]);
  });
});

describe('dueStatus (AC8)', () => {
  it('오늘 마감·기한 지남을 구분하고 완료 작업은 null', () => {
    expect(dueStatus(makeTask({ dueDate: TODAY }), TODAY)).toBe('dueToday');
    expect(dueStatus(makeTask({ dueDate: YESTERDAY }), TODAY)).toBe('overdue');
    expect(dueStatus(makeTask({ dueDate: TOMORROW }), TODAY)).toBeNull();
    expect(dueStatus(makeTask({ dueDate: YESTERDAY, completed: true }), TODAY)).toBeNull();
  });
});

describe('progress (AC7, AC3, AC27, AC28)', () => {
  const fiveToday = () => [
    makeTask({ plannedDate: TODAY, completed: true }),
    makeTask({ plannedDate: TODAY, completed: true }),
    makeTask({ plannedDate: TODAY, completed: true }),
    makeTask({ plannedDate: TODAY }),
    makeTask({ plannedDate: TODAY }),
  ];

  it('5개 중 3개 완료는 "3/5 완료 (60%)"', () => {
    expect(formatProgress(progress(fiveToday(), TODAY))).toBe('3/5 완료 (60%)');
  });

  it('3/5 상태에서 미완료 1개를 내일로 옮기면 3/4 (75%)', () => {
    const tasks = fiveToday();
    tasks[3] = { ...tasks[3]!, plannedDate: TOMORROW };
    expect(formatProgress(progress(tasks, TODAY))).toBe('3/4 완료 (75%)');
  });

  it('3/5 상태에서 완료 1개를 내일로 옮기면 2/4 (50%)', () => {
    const tasks = fiveToday();
    tasks[0] = { ...tasks[0]!, plannedDate: TOMORROW };
    expect(formatProgress(progress(tasks, TODAY))).toBe('2/4 완료 (50%)');
  });

  it('1/3은 33%로 반올림하고, 예정 작업이 없으면 "계획 없음"', () => {
    const tasks = [
      makeTask({ plannedDate: TODAY, completed: true }),
      makeTask({ plannedDate: TODAY }),
      makeTask({ plannedDate: TODAY }),
    ];
    expect(formatProgress(progress(tasks, TODAY))).toBe('1/3 완료 (33%)');
    expect(formatProgress(progress([], TODAY))).toBe('계획 없음');
  });

  it('미계획 작업(실행 예정일 해제 포함)은 분모에 들어가지 않는다', () => {
    const tasks = [makeTask({ plannedDate: TODAY }), makeTask({ plannedDate: null, completed: true })];
    expect(progress(tasks, TODAY)).toEqual({ done: 0, total: 1, percent: 0 });
  });

  it('주간 진행률은 [월, 일] 범위의 작업만 세고, 삭제하면 다시 계산된다', () => {
    const mon = makeTask({ plannedDate: '2026-09-21', completed: true });
    const sun = makeTask({ plannedDate: '2026-09-27' });
    const nextMon = makeTask({ plannedDate: '2026-09-28', completed: true });
    const tasks = [mon, sun, nextMon];
    expect(progress(tasks, '2026-09-21', '2026-09-27')).toEqual({ done: 1, total: 2, percent: 50 });
    expect(progress(tasks.filter((t) => t !== mon), '2026-09-21', '2026-09-27')).toEqual({
      done: 0,
      total: 1,
      percent: 0,
    });
  });
});

describe('filterTasks (AC10)', () => {
  const tasks = [
    makeTask({ title: '영어 단어 외우기', category: 'study' }),
    makeTask({ title: '영어 회의 준비', category: 'work', completed: true }),
    makeTask({ title: '수학 과제', category: 'study', plannedDate: TODAY }),
    makeTask({ title: '영어 일기', category: null }),
  ];
  const titles = (list: { title: string }[]) => list.map((t) => t.title);

  it('검색과 카테고리를 함께 걸면 둘 다 만족하는 작업만 남는다 (대소문자·앞뒤 공백 무시)', () => {
    expect(titles(filterTasks(tasks, { ...EMPTY_FILTER, query: '  영어 ', category: 'study' }))).toEqual([
      '영어 단어 외우기',
    ]);
  });

  it('상태 필터', () => {
    expect(titles(filterTasks(tasks, { ...EMPTY_FILTER, status: 'done' }))).toEqual(['영어 회의 준비']);
    expect(filterTasks(tasks, { ...EMPTY_FILTER, status: 'active' })).toHaveLength(3);
  });

  it('카테고리 미지정 필터', () => {
    expect(titles(filterTasks(tasks, { ...EMPTY_FILTER, category: 'none' }))).toEqual(['영어 일기']);
  });

  it('미계획 필터 (AC3)', () => {
    expect(titles(filterTasks(tasks, { ...EMPTY_FILTER, unplannedOnly: true }))).not.toContain('수학 과제');
  });

  it('영문 대소문자를 구분하지 않는다', () => {
    const list = [makeTask({ title: 'Buy MILK' })];
    expect(filterTasks(list, { ...EMPTY_FILTER, query: 'milk' })).toHaveLength(1);
  });
});
