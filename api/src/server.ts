import { createApp } from './app.js';
import { readConfig } from './config.js';
import { connect } from './db.js';
import { createGithubClient } from './github.js';
import { createLogger } from './logger.js';
import { migrateTasks } from './migrate.js';

const logger = createLogger();
let config: ReturnType<typeof readConfig>;
try {
  config = readConfig();
} catch (err) {
  logger.fatal({ err }, '환경 변수 오류');
  process.exit(1);
}
const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/todo-planner';
const port = Number(process.env.PORT ?? 4000);

let connection: Awaited<ReturnType<typeof connect>>;
try {
  connection = await connect(uri);
} catch (err) {
  logger.fatal({ err }, 'MongoDB 연결 실패');
  process.exit(1);
}
try {
  const migrated = await migrateTasks(connection.database);
  if (migrated > 0) logger.info(`tasks 마이그레이션: ${migrated}건`);
} catch (err) {
  logger.fatal({ err }, 'tasks 마이그레이션 실패');
  process.exit(1);
}

const app = createApp({
  database: connection.database,
  config,
  github: createGithubClient(config.github),
  logger,
});
const server = app.listen(port, () => {
  logger.info(`api listening on :${port}`);
});

function shutdown() {
  server.close(() => {
    void connection.client.close().then(() => process.exit(0));
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
