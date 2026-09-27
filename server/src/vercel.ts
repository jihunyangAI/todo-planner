import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { connect } from './db.js';
import { createGithubClient } from './github.js';
import { createLogger } from './logger.js';
import { migrateTasks } from './migrate.js';

/**
 * 첫 요청 때 init을 한 번만 실행하고, 이후 요청은 만들어 둔 앱으로 넘긴다.
 * init이 실패하면 503을 돌려주고 다음 요청에서 다시 시도한다.
 * Vercel 함수는 인스턴스가 살아 있는 동안 모듈 상태(여기서는 DB 연결)를 재사용한다.
 */
export function createLazyApp(init: () => Promise<Express>, onError: (err: unknown) => void = () => {}): Express {
  let ready: Promise<Express> | null = null;
  const app = express();
  app.use((req: Request, res: Response, next: NextFunction) => {
    ready ??= init().catch((err: unknown) => {
      ready = null;
      throw err;
    });
    ready.then(
      (inner) => inner(req, res, next),
      (err: unknown) => {
        onError(err);
        res.status(503).json({ error: '서버를 시작하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' });
      },
    );
  });
  return app;
}

const logger = createLogger();

async function init(): Promise<Express> {
  // Express 프리셋은 빌드 중에 만든 정적 파일을 CDN으로 서빙하지 않으므로,
  // 함수에 web/dist를 포함하고(vercel.json includeFiles) Express가 직접 서빙한다
  const config = { ...readConfig(), serveWeb: true };
  const { database } = await connect(process.env.MONGODB_URI ?? 'mongodb://localhost:27017/todo-planner');
  const migrated = await migrateTasks(database);
  if (migrated > 0) logger.info(`tasks 마이그레이션: ${migrated}건`);
  return createApp({ database, config, github: createGithubClient(config.github), logger });
}

/** Vercel 진입점(루트 app.ts)이 default export로 내보낸다. */
export default createLazyApp(init, (err) => logger.fatal({ err }, '서버 시작 실패'));
