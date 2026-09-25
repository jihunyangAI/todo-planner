import { Writable } from 'node:stream';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createLogger } from '../logger.js';
import { openTestDatabase } from '../../test/testDb.js';

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const TASK_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TASK_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('/api/tasks', () => {
  let ctx: Awaited<ReturnType<typeof openTestDatabase>>;
  let app: ReturnType<typeof createApp>;
  let logLines: string[];

  beforeAll(async () => {
    ctx = await openTestDatabase();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await ctx.database.tasks.deleteMany({});
    logLines = [];
    const destination = new Writable({
      write(chunk, _enc, cb) {
        logLines.push(String(chunk));
        cb();
      },
    });
    app = createApp({
      database: ctx.database,
      config: { webOrigin: 'http://localhost', trustProxy: 0, rateLimitDisabled: true },
      logger: createLogger({ level: 'info', destination }),
    });
  });

  const as = (owner: string) => ({
    get: (url: string) => request(app).get(url).set('X-Client-Id', owner),
    post: (url: string, body: object) => request(app).post(url).set('X-Client-Id', owner).send(body),
    patch: (url: string, body: object) => request(app).patch(url).set('X-Client-Id', owner).send(body),
    del: (url: string) => request(app).delete(url).set('X-Client-Id', owner),
  });

  describe('X-Client-Id (AC15)', () => {
    it('헤더가 없으면 400', async () => {
      expect((await request(app).get('/api/tasks')).status).toBe(400);
    });

    it('UUID v4 형식이 아니면 400', async () => {
      for (const bad of ['abc', TASK_1.toUpperCase(), '11111111-1111-1111-8111-111111111111']) {
        expect((await as(bad).get('/api/tasks')).status).toBe(400);
      }
    });
  });

  describe('POST', () => {
    it('201로 만들고 기본값을 채운다', async () => {
      const res = await as(OWNER_A).post('/api/tasks', { id: TASK_1, title: '  장보기 ' });
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
    });

    it('공백 제목은 400 (AC1)', async () => {
      const res = await as(OWNER_A).post('/api/tasks', { id: TASK_1, title: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.errors.title).toBe('제목을 입력하세요');
    });

    it('101자 제목과 2,001자 메모는 400 (AC2)', async () => {
      expect((await as(OWNER_A).post('/api/tasks', { id: TASK_1, title: 'a'.repeat(101) })).status).toBe(400);
      expect(
        (await as(OWNER_A).post('/api/tasks', { id: TASK_1, title: 'a', memo: 'm'.repeat(2001) })).status,
      ).toBe(400);
    });

    it('실행 예정일이 마감일보다 늦어도 201 (AC4)', async () => {
      const res = await as(OWNER_A).post('/api/tasks', {
        id: TASK_1,
        title: 't',
        plannedDate: '2026-09-30',
        dueDate: '2026-09-25',
      });
      expect(res.status).toBe(201);
    });

    it('같은 id로 두 번 보내면 문서는 하나이고 두 번째는 200 (AC32)', async () => {
      const first = await as(OWNER_A).post('/api/tasks', { id: TASK_1, title: '한 번' });
      const second = await as(OWNER_A).post('/api/tasks', { id: TASK_1, title: '한 번' });
      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
      expect(await ctx.database.tasks.countDocuments({ _id: TASK_1 })).toBe(1);
    });

    it('다른 소유자가 같은 id를 쓰고 있으면 409', async () => {
      await as(OWNER_A).post('/api/tasks', { id: TASK_1, title: 'A' });
      expect((await as(OWNER_B).post('/api/tasks', { id: TASK_1, title: 'B' })).status).toBe(409);
    });

    it('날짜는 "YYYY-MM-DD" 문자열로 저장된다 (AC20)', async () => {
      await as(OWNER_A).post('/api/tasks', { id: TASK_1, title: 't', plannedDate: '2026-09-25', dueDate: '2026-12-31' });
      const doc = await ctx.database.tasks.findOne({ _id: TASK_1 });
      expect(doc?.plannedDate).toBe('2026-09-25');
      expect(doc?.dueDate).toBe('2026-12-31');
      expect((await as(OWNER_A).get('/api/tasks')).body[0].plannedDate).toBe('2026-09-25');
    });
  });

  describe('PATCH', () => {
    beforeEach(async () => {
      await as(OWNER_A).post('/api/tasks', { id: TASK_1, title: 't', plannedDate: '2026-09-25', dueDate: '2026-09-30' });
    });

    it('plannedDate만 바꿔도 dueDate는 그대로 (AC5)', async () => {
      const res = await as(OWNER_A).patch(`/api/tasks/${TASK_1}`, { plannedDate: '2026-09-27' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ plannedDate: '2026-09-27', dueDate: '2026-09-30' });
    });

    it('날짜를 null로 해제한다 (AC27)', async () => {
      const res = await as(OWNER_A).patch(`/api/tasks/${TASK_1}`, { plannedDate: null, dueDate: null });
      expect(res.body).toMatchObject({ plannedDate: null, dueDate: null });
    });

    it('완료하면 completedAt이 채워지고, 다시 보내도 바뀌지 않으며, 완료 취소하면 null (AC26)', async () => {
      const done = await as(OWNER_A).patch(`/api/tasks/${TASK_1}`, { completed: true });
      expect(done.body.completed).toBe(true);
      expect(done.body.completedAt).toEqual(expect.any(String));
      const again = await as(OWNER_A).patch(`/api/tasks/${TASK_1}`, { completed: true });
      expect(again.body.completedAt).toBe(done.body.completedAt);
      const undone = await as(OWNER_A).patch(`/api/tasks/${TASK_1}`, { completed: false });
      expect(undone.body).toMatchObject({ completed: false, completedAt: null });
    });

    it("'$'로 시작하는 제목도 글자 그대로 저장한다", async () => {
      const res = await as(OWNER_A).patch(`/api/tasks/${TASK_1}`, { title: '$completed' });
      expect(res.body.title).toBe('$completed');
    });

    it('서버 관리 필드와 잘못된 값은 400', async () => {
      expect((await as(OWNER_A).patch(`/api/tasks/${TASK_1}`, { completedAt: 'x' })).status).toBe(400);
      expect((await as(OWNER_A).patch(`/api/tasks/${TASK_1}`, { title: ' ' })).status).toBe(400);
      expect((await as(OWNER_A).patch(`/api/tasks/${TASK_1}`, {})).status).toBe(400);
    });

    it('없는 작업은 404', async () => {
      expect((await as(OWNER_A).patch(`/api/tasks/${TASK_2}`, { title: 'x' })).status).toBe(404);
    });
  });

  describe('DELETE', () => {
    it('실제로 지우고 204, 없으면 404', async () => {
      await as(OWNER_A).post('/api/tasks', { id: TASK_1, title: 't' });
      expect((await as(OWNER_A).del(`/api/tasks/${TASK_1}`)).status).toBe(204);
      expect(await ctx.database.tasks.countDocuments({})).toBe(0);
      expect((await as(OWNER_A).del(`/api/tasks/${TASK_1}`)).status).toBe(404);
    });
  });

  describe('잘못된 :id (AC36)', () => {
    it('UUID 형식이 아니면 PATCH·DELETE가 400', async () => {
      expect((await as(OWNER_A).patch('/api/tasks/not-a-uuid', { title: 'x' })).status).toBe(400);
      expect((await as(OWNER_A).del('/api/tasks/not-a-uuid')).status).toBe(400);
    });
  });

  describe('소유자 격리 (AC14)', () => {
    it('B는 A의 작업을 조회·수정·삭제할 수 없다', async () => {
      await as(OWNER_A).post('/api/tasks', { id: TASK_1, title: 'A의 작업' });
      expect((await as(OWNER_B).get('/api/tasks')).body).toEqual([]);
      expect((await as(OWNER_B).patch(`/api/tasks/${TASK_1}`, { title: '탈취' })).status).toBe(404);
      expect((await as(OWNER_B).del(`/api/tasks/${TASK_1}`)).status).toBe(404);
      expect((await as(OWNER_A).get('/api/tasks')).body[0].title).toBe('A의 작업');
    });
  });

  describe('로그 (AC37)', () => {
    it('요청 로그에 X-Client-Id 값이 나오지 않는다', async () => {
      await as(OWNER_A).post('/api/tasks', { id: TASK_1, title: '비밀 제목' });
      await as(OWNER_A).get('/api/tasks');
      const log = logLines.join('');
      expect(logLines.length).toBeGreaterThan(0);
      expect(log).not.toContain(OWNER_A);
      expect(log).not.toContain('비밀 제목');
    });
  });

  describe('본문 오류', () => {
    it('깨진 JSON은 400, 16KB 초과는 413', async () => {
      const broken = await request(app)
        .post('/api/tasks')
        .set('X-Client-Id', OWNER_A)
        .set('Content-Type', 'application/json')
        .send('{"id":');
      expect(broken.status).toBe(400);
      const big = await as(OWNER_A).post('/api/tasks', { id: TASK_1, title: 't', memo: 'm'.repeat(17_000) });
      expect(big.status).toBe(413);
    });
  });
});
