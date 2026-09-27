import type { NextFunction, Request, Response } from 'express';

type Handler = (req: Request, res: Response) => Promise<void>;

/** Express 4는 async 핸들러의 거부를 잡지 않으므로 오류 처리기로 넘긴다. */
export const handle = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch(next);
};
