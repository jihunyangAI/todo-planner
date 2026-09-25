import { createApp } from './app.js';
import { readConfig } from './config.js';
import { connect } from './db.js';
import { createLogger } from './logger.js';

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

const server = createApp({ database: connection.database, config, logger }).listen(port, () => {
  logger.info(`api listening on :${port}`);
});

function shutdown() {
  server.close(() => {
    void connection.client.close().then(() => process.exit(0));
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
