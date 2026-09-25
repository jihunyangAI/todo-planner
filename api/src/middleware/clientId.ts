import type { NextFunction, Request, Response } from 'express';
import { isUuidV4 } from '@todo/shared';

/** X-Client-Id 헤더를 검사해 res.locals.ownerId에 넣는다. */
export function requireClientId(req: Request, res: Response, next: NextFunction) {
  const clientId = req.get('X-Client-Id');
  if (!clientId || !isUuidV4(clientId)) {
    res.status(400).json({ error: 'X-Client-Id 헤더가 없거나 UUID v4 형식이 아닙니다' });
    return;
  }
  res.locals.ownerId = clientId;
  next();
}
