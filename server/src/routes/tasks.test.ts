import { Writable } from 'node:stream';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../logger.js';
import { createTestApp, loginAs } from '../../test/testApp.js';
import { openTestDatabase } from '../../test/testDb.js';

const LEGACY_CLIENT = '11111111-1111-4111-8111-111111111111';
const TASK_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TASK_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('/api/tasks', () => {
  let ctx: Awaited<ReturnType<typeof openTestDatabase>>;
  let app: ReturnType<typeof createTestApp>;
  let logLines: string[];
  /** 로그인한 두 사용자 */
  let A: Awaited<ReturnType<typeof loginAs>>;
  let B: Awaited<ReturnType<typeof loginAs>>;

  beforeAll(async () => {
    ctx = await openTestDatabase();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await Promise.all([ctx.database.tasks.deleteMany({}), ctx.database.users.deleteMany({})]);
    logLines = [];
    const destination = new Writable({
      write(chunk, _enc, cb) {
        logLines.push(String(chunk));
        cb();
      },
    });
    app = createTestApp(ctx.database, { logger: createLogger({ level: 'info', destination }) });
    A = await loginAs(app, 'alice');
    B = await loginAs(app, 'bob');
  });

  describe('로그인하지 않은 요청', () => {
    it('목록 조회·추가·수정·삭제 모두 401', async () => {
      const csrf = { 'X-Requested-With': 'fetch' };
      expect((await request(app).get('/api/tasks')).status).toBe(401);
      expect((await request(app).post('/api/tasks').set(csrf).send({ id: TASK_1, title: 't' })).status).toBe(401);
      expect((await request(app).patch(`/api/tasks/${TASK_1}`).set(csrf).send({ title: 't' })).status).toBe(401);
      expect((await request(app).delete(`/api/tasks/${TASK_1}`).set(csrf)).status).toBe(401);
    });
  });

  describe('CSRF', () => {
    it('X-Requested-With 헤더 없는 상태 변경 요청은 403', async () => {
      expect((await A.agent.post('/api/tasks').send({ id: TASK_1, title: 't' })).status).toBe(403);
      expect((await A.agent.patch(`/api/tasks/${TASK_1}`).send({ title: 't' })).status).toBe(403);
      expect((await A.agent.delete(`/api/tasks/${TASK_1}`)).status).toBe(403);
      expect(await ctx.database.tasks.countDocuments()).toBe(0);
    });
  });

  describe('POST', () => {
    it('201로 만들고 기본값을 채운다', async () => {
      const res = await A.post('/api/tasks', { id: TASK_1, title: '  장보기 ' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: TASK_1,
        title: '장보기',
        memo: '',
        priority: 'medium',
        category: null,
        plannedDate: null,
        dueDate: null,
        completed: false,
        completedAt: null,
      });
      expect(res.body).not.toHaveProperty('ownerId');
      expect(res.body).not.toHaveProperty('userId');
    });

    it('작업 문서에 로그인 사용자의 userId가 저장된다', async () => {
      await A.post('/api/tasks', { id: TASK_1, title: 't' });
      const alice = await ctx.database.users.findOne({ username: 'alice' });
      const doc = await ctx.database.tasks.findOne({ _id: TASK_1 });
      expect(doc?.userId).toBe(alice!._id.toHexString());
    });

    it('공백 제목은 400 (AC1)', async () => {
      const res = await A.post('/api/tasks', { id: TASK_1, title: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.errors.title).toBe('제목을 입력하세요');
    });

    it('101자 제목과 2,001자 메모는 400 (AC2)', async () => {
      expect((await A.post('/api/tasks', { id: TASK_1, title: 'a'.repeat(101) })).status).toBe(400);
      expect(
        (await A.post('/api/tasks', { id: TASK_1, title: 'a', memo: 'm'.repeat(2001) })).status,
      ).toBe(400);
    });

    it('실행 예정일이 마감일보다 늦어도 201 (AC4)', async () => {
      const res = await A.post('/api/tasks', {
        id: TASK_1,
        title: 't',
        plannedDate: '2026-09-30',
        dueDate: '2026-09-25',
      });
      expect(res.status).toBe(201);
    });

    it('같은 id로 두 번 보내면 문서는 하나이고 두 번째는 200 (AC32)', async () => {
      const first = await A.post('/api/tasks', { id: TASK_1, title: '한 번' });
      const second = await A.post('/api/tasks', { id: TASK_1, title: '한 번' });
      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
      expect(await ctx.database.tasks.countDocuments({ _id: TASK_1 })).toBe(1);
    });

    it('다른 소유자가 같은 id를 쓰고 있으면 409', async () => {
      await A.post('/api/tasks', { id: TASK_1, title: 'A' });
      expect((await B.post('/api/tasks', { id: TASK_1, title: 'B' })).status).toBe(409);
    });

    it('날짜는 "YYYY-MM-DD" 문자열로 저장된다 (AC20)', async () => {
      await A.post('/api/tasks', { id: TASK_1, title: 't', plannedDate: '2026-09-25', dueDate: '2026-12-31' });
      const doc = await ctx.database.tasks.findOne({ _id: TASK_1 });
      expect(doc?.plannedDate).toBe('2026-09-25');
      expect(doc?.dueDate).toBe('2026-12-31');
      expect((await A.get('/api/tasks')).body[0].plannedDate).toBe('2026-09-25');
    });
  });

  describe('PATCH', () => {
    beforeEach(async () => {
      await A.post('/api/tasks', { id: TASK_1, title: 't', plannedDate: '2026-09-25', dueDate: '2026-09-30' });
    });

    it('plannedDate만 바꿔도 dueDate는 그대로 (AC5)', async () => {
      const res = await A.patch(`/api/tasks/${TASK_1}`, { plannedDate: '2026-09-27' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ plannedDate: '2026-09-27', dueDate: '2026-09-30' });
    });

    it('날짜를 null로 해제한다 (AC27)', async () => {
      const res = await A.patch(`/api/tasks/${TASK_1}`, { plannedDate: null, dueDate: null });
      expect(res.body).toMatchObject({ plannedDate: null, dueDate: null });
    });

    it('완료하면 completedAt이 채워지고, 다시 보내도 바뀌지 않으며, 완료 취소하면 null (AC26)', async () => {
      const done = await A.patch(`/api/tasks/${TASK_1}`, { completed: true });
      expect(done.body.completed).toBe(true);
      expect(done.body.completedAt).toEqual(expect.any(String));
      const again = await A.patch(`/api/tasks/${TASK_1}`, { completed: true });
      expect(again.body.completedAt).toBe(done.body.completedAt);
      const undone = await A.patch(`/api/tasks/${TASK_1}`, { completed: false });
      expect(undone.body).toMatchObject({ completed: false, completedAt: null });
    });

    it("'$'로 시작하는 제목도 글자 그대로 저장한다", async () => {
      const res = await A.patch(`/api/tasks/${TASK_1}`, { title: '$completed' });
      expect(res.body.title).toBe('$completed');
    });

    it('서버 관리 필드와 잘못된 값은 400', async () => {
      expect((await A.patch(`/api/tasks/${TASK_1}`, { completedAt: 'x' })).status).toBe(400);
      expect((await A.patch(`/api/tasks/${TASK_1}`, { title: ' ' })).status).toBe(400);
      expect((await A.patch(`/api/tasks/${TASK_1}`, {})).status).toBe(400);
    });

    it('없는 작업은 404', async () => {
      expect((await A.patch(`/api/tasks/${TASK_2}`, { title: 'x' })).status).toBe(404);
    });
  });

  describe('DELETE', () => {
    it('실제로 지우고 204, 없으면 404', async () => {
      await A.post('/api/tasks', { id: TASK_1, title: 't' });
      expect((await A.del(`/api/tasks/${TASK_1}`)).status).toBe(204);
      expect(await ctx.database.tasks.countDocuments({})).toBe(0);
      expect((await A.del(`/api/tasks/${TASK_1}`)).status).toBe(404);
    });
  });

  describe('잘못된 :id (AC36)', () => {
    it('UUID 형식이 아니면 PATCH·DELETE가 400', async () => {
      expect((await A.patch('/api/tasks/not-a-uuid', { title: 'x' })).status).toBe(400);
      expect((await A.del('/api/tasks/not-a-uuid')).status).toBe(400);
    });
  });

  describe('소유자 격리 (AC14)', () => {
    it('각자 자기 작업만 목록에 나온다', async () => {
      await A.post('/api/tasks', { id: TASK_1, title: 'A의 작업' });
      await B.post('/api/tasks', { id: TASK_2, title: 'B의 작업' });
      expect((await A.get('/api/tasks')).body.map((t: { title: string }) => t.title)).toEqual(['A의 작업']);
      expect((await B.get('/api/tasks')).body.map((t: { title: string }) => t.title)).toEqual(['B의 작업']);
    });

    it('B는 A의 작업을 조회·수정·삭제할 수 없다', async () => {
      await A.post('/api/tasks', { id: TASK_1, title: 'A의 작업' });
      expect((await B.get('/api/tasks')).body).toEqual([]);
      expect((await B.patch(`/api/tasks/${TASK_1}`, { title: '탈취' })).status).toBe(404);
      expect((await B.del(`/api/tasks/${TASK_1}`)).status).toBe(404);
      expect((await A.get('/api/tasks')).body[0].title).toBe('A의 작업');
    });
  });

  describe('로그 (AC37)', () => {
    it('요청 로그에 세션 쿠키와 요청 본문이 나오지 않는다', async () => {
      await A.post('/api/tasks', { id: TASK_1, title: '비밀 제목' });
      await A.get('/api/tasks');
      const log = logLines.join('');
      expect(logLines.length).toBeGreaterThan(0);
      expect(log).not.toContain('todo.sid');
      expect(log).not.toContain('비밀 제목');
    });
  });

  describe('익명 작업 가져오기 (claim)', () => {
    it('legacyClientId가 같고 주인이 없는 작업만 로그인 사용자에게 귀속한다', async () => {
      const now = new Date();
      const base = { memo: '', plannedDate: null, dueDate: null, priority: 'medium' as const, category: null, completed: false, completedAt: null, createdAt: now, updatedAt: now };
      await ctx.database.tasks.insertMany([
        { _id: TASK_1, userId: null, legacyClientId: LEGACY_CLIENT, title: '익명 1', ...base },
        { _id: TASK_2, userId: null, legacyClientId: '99999999-9999-4999-8999-999999999999', title: '다른 브라우저', ...base },
      ]);
      const res = await A.post('/api/tasks/claim', { clientId: LEGACY_CLIENT });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ claimed: 1 });
      expect((await A.get('/api/tasks')).body.map((t: { title: string }) => t.title)).toEqual(['익명 1']);
      expect((await ctx.database.tasks.findOne({ _id: TASK_1 }))?.legacyClientId).toBeUndefined();
      // 이미 귀속된 작업은 다른 사용자가 다시 가져갈 수 없다
      expect((await B.post('/api/tasks/claim', { clientId: LEGACY_CLIENT })).body).toEqual({ claimed: 0 });
      expect((await B.get('/api/tasks')).body).toEqual([]);
    });

    it('clientId가 UUID v4가 아니면 400, 로그인하지 않으면 401', async () => {
      expect((await A.post('/api/tasks/claim', { clientId: 'nope' })).status).toBe(400);
      expect(
        (await request(app).post('/api/tasks/claim').set('X-Requested-With', 'fetch').send({ clientId: LEGACY_CLIENT })).status,
      ).toBe(401);
    });
  });

  describe('본문 오류', () => {
    it('깨진 JSON은 400, 16KB 초과는 413', async () => {
      const broken = await A.agent
        .post('/api/tasks')
        .set('X-Requested-With', 'fetch')
        .set('Content-Type', 'application/json')
        .send('{"id":');
      expect(broken.status).toBe(400);
      const big = await A.post('/api/tasks', { id: TASK_1, title: 't', memo: 'm'.repeat(17_000) });
      expect(big.status).toBe(413);
    });
  });
});
