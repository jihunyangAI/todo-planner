import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { AppConfig } from './config.js';
import type { Database } from './db.js';
import { createLogger } from './logger.js';
import { errorHandler } from './middleware/errors.js';
import { tasksRouter } from './routes/tasks.js';

export interface AppDeps {
  database: Database;
  config: AppConfig;
  logger?: Logger;
}

export function createApp({ database, config, logger = createLogger() }: AppDeps) {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(
    cors({
      origin: config.webOrigin,
      allowedHeaders: ['Content-Type', 'X-Client-Id'],
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    }),
  );
  app.use(pinoHttp({ logger }));
  if (!config.rateLimitDisabled) {
    app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
  }
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await database.db.command({ ping: 1 });
      res.json({ db: 'ok' });
    } catch {
      res.status(503).json({ db: 'unavailable' });
    }
  });

  app.use('/api/tasks', tasksRouter(database));
  app.use(errorHandler);
  return app;
}
