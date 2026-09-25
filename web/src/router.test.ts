import { describe, expect, it } from 'vitest';
import { parseHash, toHash } from './router';

describe('parseHash (AC23)', () => {
  it('해시가 없거나 알 수 없는 경로면 오늘 화면으로 보낸다', () => {
    for (const hash of ['', '#', '#/', '#/unknown', '#/unknown?status=done']) {
      expect(parseHash(hash)).toMatchObject({ view: 'today', redirected: true });
    }
  });

  it('쿼리가 붙은 주소는 경로만 비교하고 쿼리를 보존한다', () => {
    const route = parseHash('#/all?status=done&q=%EC%98%81%EC%96%B4');
    expect(route.view).toBe('all');
    expect(route.redirected).toBe(false);
    expect(route.query.get('status')).toBe('done');
    expect(route.query.get('q')).toBe('영어');
  });

  it('네 화면을 인식한다', () => {
    for (const view of ['today', 'all', 'week', 'settings'] as const) {
      expect(parseHash(`#/${view}`)).toMatchObject({ view, redirected: false });
    }
  });

  it('toHash는 쿼리가 비면 붙이지 않는다', () => {
    expect(toHash('all')).toBe('#/all');
    expect(toHash('all', new URLSearchParams({ status: 'done' }))).toBe('#/all?status=done');
  });
});
