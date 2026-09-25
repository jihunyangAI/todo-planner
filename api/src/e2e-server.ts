import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from './app.js';
import { connect } from './db.js';
import { createLogger } from './logger.js';

// E2E 전용: 메모리 DB로 API를 띄운다. Playwright webServer가 실행한다.
const mongo = await MongoMemoryServer.create();
const { database } = await connect(mongo.getUri('e2e'));
const port = Number(process.env.PORT ?? 4100);

createApp({
  database,
  config: {
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:4173',
    trustProxy: 0,
    rateLimitDisabled: true,
  },
  logger: createLogger({ level: 'warn' }),
}).listen(port, () => {
  console.log(`e2e api listening on :${port}`);
});
