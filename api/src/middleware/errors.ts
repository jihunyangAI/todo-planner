import type { NextFunction, Request, Response } from 'express';

interface HttpError extends Error {
  type?: string;
  status?: number;
}

export function errorHandler(err: HttpError, req: Request, res: Response, _next: NextFunction) {
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON 형식이 올바르지 않습니다' });
    return;
  }
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: '요청 본문이 너무 큽니다' });
    return;
  }
  req.log.error({ err }, 'unhandled error');
  res.status(500).json({ error: '서버 오류가 발생했습니다' });
}
