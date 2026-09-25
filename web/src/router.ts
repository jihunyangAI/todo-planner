export const VIEWS = ['today', 'all', 'week', 'settings'] as const;
export type View = (typeof VIEWS)[number];

export interface Route {
  view: View;
  query: URLSearchParams;
  /** 해시가 없거나 알 수 없는 경로라서 #/today로 바꿔야 한다. */
  redirected: boolean;
}

/** 해시의 경로 부분(? 앞)만 비교한다. 쿼리가 붙은 주소는 쿼리를 그대로 둔다. */
export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [path = '', search = ''] = raw.split('?', 2);
  const name = path.replace(/^\/+|\/+$/g, '');
  const view = (VIEWS as readonly string[]).includes(name) ? (name as View) : null;
  if (!view) return { view: 'today', query: new URLSearchParams(), redirected: true };
  return { view, query: new URLSearchParams(search), redirected: false };
}

export function toHash(view: View, query?: URLSearchParams): string {
  const search = query?.toString();
  return `#/${view}${search ? `?${search}` : ''}`;
}
