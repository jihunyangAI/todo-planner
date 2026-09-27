import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openTestDatabase } from '../test/testDb.js';
import { migrateTasks } from './migrate.js';

describe('migrateTasks', () => {
  let ctx: Awaited<ReturnType<typeof openTestDatabase>>;
  beforeAll(async () => {
    ctx = await openTestDatabase();
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('userId 없는 문서에 userId:null을 넣고 ownerId를 legacyClientId로 바꾼다. 두 번 실행해도 같다', async () => {
    const raw = ctx.database.db.collection('tasks');
    const now = new Date();
    await raw.insertMany([
      { _id: 'old-1' as never, ownerId: 'client-a', title: '옛 작업', createdAt: now },
      { _id: 'new-1' as never, userId: 'user-1', title: '새 작업', createdAt: now },
    ]);

    expect(await migrateTasks(ctx.database)).toBe(1);
    const old = await raw.findOne({ _id: 'old-1' as never });
    expect(old).toMatchObject({ userId: null, legacyClientId: 'client-a', title: '옛 작업' });
    expect(old).not.toHaveProperty('ownerId');
    expect(await raw.findOne({ _id: 'new-1' as never })).toMatchObject({ userId: 'user-1' });

    expect(await migrateTasks(ctx.database)).toBe(0);
    expect(await raw.findOne({ _id: 'old-1' as never })).toEqual(old);
  });
});
