import { MongoClient, type Collection, type Db, type ObjectId } from 'mongodb';
import type { Category, Priority } from '@todo/shared';

export interface TaskDocument {
  _id: string;
  /** 소유자(users._id 문자열). 마이그레이션 전 익명 작업은 null */
  userId: string | null;
  /** 로그인 도입 전 익명 클라이언트 ID. claim으로 사용자에게 귀속되면 지운다 */
  legacyClientId?: string;
  title: string;
  memo: string;
  plannedDate: string | null;
  dueDate: string | null;
  priority: Priority;
  category: Category | null;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserDocument {
  _id: ObjectId;
  githubId: number;
  username: string;
  avatarUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Database {
  client: MongoClient;
  db: Db;
  tasks: Collection<TaskDocument>;
  users: Collection<UserDocument>;
}

export async function openDatabase(client: MongoClient, dbName?: string): Promise<Database> {
  const db = client.db(dbName);
  const tasks = db.collection<TaskDocument>('tasks');
  const users = db.collection<UserDocument>('users');
  await Promise.all([
    tasks.createIndex({ userId: 1, plannedDate: 1 }),
    tasks.createIndex({ legacyClientId: 1 }, { sparse: true }),
    users.createIndex({ githubId: 1 }, { unique: true }),
  ]);
  return { client, db, tasks, users };
}

export async function connect(uri: string): Promise<{ client: MongoClient; database: Database }> {
  const client = new MongoClient(uri, { maxPoolSize: 10 });
  await client.connect();
  return { client, database: await openDatabase(client) };
}
