import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToday } from './useToday';

describe('useToday (AC16)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('자정을 넘기면 다음 날로 바뀐다', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date(2026, 8, 25, 23, 59, 0));
    const { result } = renderHook(() => useToday());
    expect(result.current).toBe('2026-09-25');
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(result.current).toBe('2026-09-26');
  });

  it('날짜가 바뀐 뒤 앱이 다시 활성화되면 바뀐다', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 25, 10, 0, 0));
    const { result } = renderHook(() => useToday());
    vi.setSystemTime(new Date(2026, 8, 27, 9, 0, 0)); // 절전 등으로 타이머가 돌지 않은 경우
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('2026-09-27');
  });
});
