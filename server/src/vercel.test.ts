import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createLazyApp } from './vercel.js';

describe('createLazyApp (Vercel 진입점)', () => {
  const inner = () => {
    const app = express();
    app.get('/api/ping', (_req, res) => {
      res.json({ ok: true });
    });
    return app;
  };

  it('첫 요청 때 한 번만 초기화하고, 이후 요청은 같은 앱을 쓴다', async () => {
    const init = vi.fn(async () => inner());
    const app = createLazyApp(init);
    expect((await request(app).get('/api/ping')).body).toEqual({ ok: true });
    expect((await request(app).get('/api/ping')).body).toEqual({ ok: true });
    expect(init).toHaveBeenCalledOnce();
  });

  it('초기화가 실패하면 503을 돌려주고 다음 요청에서 다시 시도한다', async () => {
    const onError = vi.fn();
    const init = vi.fn().mockRejectedValueOnce(new Error('DB down')).mockResolvedValue(inner());
    const app = createLazyApp(init, onError);
    const failed = await request(app).get('/api/ping');
    expect(failed.status).toBe(503);
    expect(onError).toHaveBeenCalledOnce();
    expect((await request(app).get('/api/ping')).body).toEqual({ ok: true });
    expect(init).toHaveBeenCalledTimes(2);
  });
});
