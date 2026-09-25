import type { ISODate } from '@todo/shared';

const pad = (n: number) => String(n).padStart(2, '0');

/** 기기 현지 날짜를 'YYYY-MM-DD'로 만든다. toISOString은 UTC라서 쓰지 않는다. */
export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocal(now: Date = new Date()): ISODate {
  return toISODate(now);
}

/** 'YYYY-MM-DD'를 현지 시각 자정의 Date로 바꾼다. */
export function parseISODate(value: ISODate): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function addDays(value: ISODate, days: number): ISODate {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** 그 날짜가 속한 주의 월요일. */
export function weekStart(value: ISODate): ISODate {
  const day = parseISODate(value).getDay(); // 0=일요일
  return addDays(value, -((day + 6) % 7));
}

export function weekDays(start: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 다음 현지 자정까지 남은 밀리초. */
export function msUntilNextMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** 예: '9/25 (목)' */
export function formatShortDate(value: ISODate): string {
  const date = parseISODate(value);
  return `${date.getMonth() + 1}/${date.getDate()} (${WEEKDAY_LABELS[date.getDay()]})`;
}
