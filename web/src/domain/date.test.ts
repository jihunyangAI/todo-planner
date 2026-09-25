import { describe, expect, it } from 'vitest';
import { addDays, formatShortDate, msUntilNextMidnight, todayLocal, weekDays, weekStart } from './date';

describe('date', () => {
  it('현지 날짜를 쓴다: 현지 23:59와 00:00은 서로 다른 날이다', () => {
    expect(todayLocal(new Date(2026, 8, 25, 23, 59, 59))).toBe('2026-09-25');
    expect(todayLocal(new Date(2026, 8, 26, 0, 0, 0))).toBe('2026-09-26');
  });

  it('연말과 윤년 경계를 넘는다', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('주는 월요일에 시작한다 (AC9)', () => {
    expect(weekStart('2026-09-27')).toBe('2026-09-21'); // 일요일 → 그 주 월요일
    expect(weekStart('2026-09-28')).toBe('2026-09-28'); // 월요일
    expect(weekStart('2027-01-01')).toBe('2026-12-28'); // 연말을 걸친 주
    expect(weekDays('2026-09-21')).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
  });

  it('다음 자정까지 남은 시간을 계산한다', () => {
    expect(msUntilNextMidnight(new Date(2026, 8, 25, 23, 59, 0))).toBe(60_000);
  });

  it('짧은 날짜 표시', () => {
    expect(formatShortDate('2026-09-25')).toBe('9/25 (금)');
  });
});
