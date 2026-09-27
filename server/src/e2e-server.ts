import { MongoMemoryServer } from 'mongodb-memory-server';
import { createFakeGithub, mountFakeGithubAuthorize } from '../test/fakeGithub.js';
import { createApp } from './app.js';
import { connect } from './db.js';
import { createLogger } from './logger.js';

// E2E 전용: 메모리 DB와 가짜 GitHub로 API를 띄운다. Playwright webServer가 실행한다.
const mongo = await MongoMemoryServer.create();
const { database } = await connect(mongo.getUri('e2e'));
const port = Number(process.env.PORT ?? 4100);

const app = createApp({
  database,
  config: {
    trustProxy: 0,
    rateLimitDisabled: true,
    // 브라우저는 Vite preview(4173)로 접속하고, preview가 /api·/auth를 이 서버로 전달한다
    publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:4173',
    github: { clientId: 'e2e', clientSecret: 'e2e' },
    sessionSecret: 'e2e-session-secret-e2e-session-secret',
    cookieSecure: false,
    serveWeb: false,
  },
  github: createFakeGithub({ authorize: 'e2e' }).client,
  logger: createLogger({ level: 'warn' }),
});
mountFakeGithubAuthorize(app);
app.listen(port, () => {
  console.log(`e2e api listening on :${port}`);
});
