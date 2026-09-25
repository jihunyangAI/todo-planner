import { MongoClient, type Collection, type Db } from 'mongodb';
import type { Category, Priority } from '@todo/shared';

export interface TaskDocument {
  _id: string;
  ownerId: string;
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

export interface Database {
  db: Db;
  tasks: Collection<TaskDocument>;
}

export async function openDatabase(client: MongoClient, dbName?: string): Promise<Database> {
  const db = client.db(dbName);
  const tasks = db.collection<TaskDocument>('tasks');
  await tasks.createIndex({ ownerId: 1, plannedDate: 1 });
  return { db, tasks };
}

export async function connect(uri: string): Promise<{ client: MongoClient; database: Database }> {
  const client = new MongoClient(uri, { maxPoolSize: 10 });
  await client.connect();
  return { client, database: await openDatabase(client) };
}
