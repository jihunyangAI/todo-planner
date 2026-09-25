import { useEffect, useState } from 'react';
import type { ISODate } from '@todo/shared';
import { msUntilNextMidnight, todayLocal } from '../domain/date';

/** 기기 현지 날짜. 자정이 지나거나 앱이 다시 활성화되면 갱신한다. */
export function useToday(): ISODate {
  const [today, setToday] = useState(() => todayLocal());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => setToday(todayLocal());
    const schedule = () => {
      timer = setTimeout(() => {
        update();
        schedule();
      }, msUntilNextMidnight() + 50);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        update();
        clearTimeout(timer);
        schedule();
      }
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  return today;
}
