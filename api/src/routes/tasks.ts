import { Router, type NextFunction, type Request, type Response } from 'express';
import { TaskCreateSchema, TaskPatchSchema, isUuidV4, toFieldErrors } from '@todo/shared';
import type { Database } from '../db.js';
import { requireUser } from '../middleware/auth.js';
import { taskRepo } from '../repo/taskRepo.js';
import { handle } from './handle.js';

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
  router.use(requireUser);

  router.get(
    '/',
    handle(async (_req, res) => {
      res.json(await repo.list(res.locals.userId));
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
      const result = await repo.create(res.locals.userId, parsed.data);
      if (result.status === 'conflict') {
        res.status(409).json({ error: '이미 사용 중인 작업 ID입니다' });
        return;
      }
      res.status(result.status === 'created' ? 201 : 200).json(result.task);
    }),
  );

  router.post(
    '/claim',
    handle(async (req, res) => {
      const clientId = (req.body as { clientId?: unknown } | undefined)?.clientId;
      if (typeof clientId !== 'string' || !isUuidV4(clientId)) {
        res.status(400).json({ error: 'clientId가 UUID v4 형식이 아닙니다' });
        return;
      }
      res.json({ claimed: await repo.claim(res.locals.userId, clientId) });
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
      const task = await repo.update(res.locals.userId, req.params.id!, parsed.data);
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
      const removed = await repo.remove(res.locals.userId, req.params.id!);
      if (!removed) {
        res.status(404).json({ error: '작업을 찾을 수 없습니다' });
        return;
      }
      res.status(204).end();
    }),
  );

  return router;
}
