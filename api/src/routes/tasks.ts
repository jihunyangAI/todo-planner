import { Router, type NextFunction, type Request, type Response } from 'express';
import { TaskCreateSchema, TaskPatchSchema, isUuidV4, toFieldErrors } from '@todo/shared';
import type { Database } from '../db.js';
import { requireClientId } from '../middleware/clientId.js';
import { taskRepo } from '../repo/taskRepo.js';

type Handler = (req: Request, res: Response) => Promise<void>;

/** Express 4는 async 핸들러의 거부를 잡지 않으므로 오류 처리기로 넘긴다. */
const handle = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
  fn(req, res).catch(next);
};

function requireTaskId(req: Request, res: Response, next: NextFunction) {
  if (!isUuidV4(req.params.id ?? '')) {
    res.status(400).json({ error: '작업 ID가 UUID v4 형식이 아닙니다' });
    return;
  }
  next();
}

export function tasksRouter(database: Database) {
  const repo = taskRepo(database);
  const router = Router();
  router.use(requireClientId);

  router.get(
    '/',
    handle(async (_req, res) => {
      res.json(await repo.list(res.locals.ownerId));
    }),
  );

  router.post(
    '/',
    handle(async (req, res) => {
      const parsed = TaskCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ errors: toFieldErrors(parsed.error) });
        return;
      }
      const result = await repo.create(res.locals.ownerId, parsed.data);
      if (result.status === 'conflict') {
        res.status(409).json({ error: '이미 사용 중인 작업 ID입니다' });
        return;
      }
      res.status(result.status === 'created' ? 201 : 200).json(result.task);
    }),
  );

  router.patch(
    '/:id',
    requireTaskId,
    handle(async (req, res) => {
      const parsed = TaskPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ errors: toFieldErrors(parsed.error) });
        return;
      }
      const task = await repo.update(res.locals.ownerId, req.params.id!, parsed.data);
      if (!task) {
        res.status(404).json({ error: '작업을 찾을 수 없습니다' });
        return;
      }
      res.json(task);
    }),
  );

  router.delete(
    '/:id',
    requireTaskId,
    handle(async (req, res) => {
      const removed = await repo.remove(res.locals.ownerId, req.params.id!);
      if (!removed) {
        res.status(404).json({ error: '작업을 찾을 수 없습니다' });
        return;
      }
      res.status(204).end();
    }),
  );

  return router;
}
