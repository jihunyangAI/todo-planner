import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';
import { inject } from 'vitest';
import { openDatabase, type Database } from '../src/db.js';

/** 테스트 파일마다 이름이 다른 DB를 만든다. 파일끼리 데이터가 섞이지 않는다. */
export async function openTestDatabase(): Promise<{ database: Database; close: () => Promise<void> }> {
  const client = new MongoClient(inject('mongoUri'));
  await client.connect();
  const database = await openDatabase(client, `test-${randomUUID()}`);
  return {
    database,
    close: async () => {
      await database.db.dropDatabase();
      await client.close();
    },
  };
}
