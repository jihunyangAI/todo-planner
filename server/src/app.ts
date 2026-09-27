import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { AppConfig } from './config.js';
import type { Database } from './db.js';
import type { GithubClient } from './github.js';
import { createLogger, stripQuery } from './logger.js';
import { requireRequestedWith } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import { authRouter, meRouter } from './routes/auth.js';
import { tasksRouter } from './routes/tasks.js';
import { sessionMiddleware } from './session.js';

/** api/src 또는 api/dist 기준 ../../web/dist */
const DEFAULT_WEB_DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');

export interface AppDeps {
  database: Database;
  config: AppConfig;
  github: GithubClient;
  logger?: Logger;
  webDist?: string;
}

export function createApp({ database, config, github, logger = createLogger(), webDist = DEFAULT_WEB_DIST }: AppDeps) {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'https://avatars.githubusercontent.com'],
          // http로 서빙할 때(로컬) 하위 리소스를 https로 바꾸면 깨지므로 https일 때만 켠다
          'upgrade-insecure-requests': config.cookieSecure ? [] : null,
        },
      },
    }),
  );
  app.use(pinoHttp({ logger, serializers: { req: stripQuery } }));
  if (!config.rateLimitDisabled) {
    const limiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });
    app.use(['/api', '/auth'], limiter);
  }
  app.use(express.json({ limit: '16kb' }));
  app.use(sessionMiddleware(config, database));

  app.get('/api/health', async (_req, res) => {
    try {
      await database.db.command({ ping: 1 });
      res.json({ db: 'ok' });
    } catch {
      res.status(503).json({ db: 'unavailable' });
    }
  });

  app.use('/auth', authRouter({ config, database, github }));
  app.use('/api', requireRequestedWith);
  app.use('/api/me', meRouter({ config, database }));
  app.use('/api/tasks', tasksRouter(database));

  // 운영: 웹과 API를 같은 출처로 서빙해 세션 쿠키가 1st-party로 동작하게 한다
  if (config.serveWeb) {
    if (!existsSync(webDist)) throw new Error(`웹 빌드 결과가 없습니다: ${webDist}`);
    app.use(express.static(webDist));
  }

  app.use(errorHandler);
  return app;
}
