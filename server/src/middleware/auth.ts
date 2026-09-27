import type { NextFunction, Request, Response } from 'express';

/** 로그인한 사용자만 통과시킨다. res.locals.userId에 사용자 ID를 넣는다. */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: '로그인이 필요합니다' });
    return;
  }
  res.locals.userId = userId;
  next();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * 상태를 바꾸는 요청에는 X-Requested-With 헤더를 요구한다(CSRF 방어).
 * 다른 사이트는 CORS 허가 없이 이 헤더를 붙여 요청할 수 없다. SameSite=Lax 쿠키와 함께 쓴다.
 */
export function requireRequestedWith(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || req.get('X-Requested-With')) {
    next();
    return;
  }
  res.status(403).json({ error: 'X-Requested-With 헤더가 필요합니다' });
}
