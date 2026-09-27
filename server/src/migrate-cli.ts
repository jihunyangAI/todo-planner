import { connect } from './db.js';
import { migrateTasks } from './migrate.js';

// npm run migrate -w api : .env의 MONGODB_URI에 마이그레이션을 적용한다
const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/todo-planner';
const { client, database } = await connect(uri);
try {
  const migrated = await migrateTasks(database);
  console.log(`tasks 마이그레이션 완료: ${migrated}건 변경 (DB: ${database.db.databaseName})`);
} finally {
  await client.close();
}
