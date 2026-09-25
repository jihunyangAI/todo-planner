import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

describe('readConfig', () => {
  it('WEB_ORIGIN, TRUST_PROXY, RATE_LIMIT_DISABLED를 읽는다', () => {
    expect(
      readConfig({ WEB_ORIGIN: 'https://todo.example', TRUST_PROXY: '1', RATE_LIMIT_DISABLED: 'true' }),
    ).toEqual({ webOrigin: 'https://todo.example', trustProxy: 1, rateLimitDisabled: true });
  });

  it('WEB_ORIGIN에 스킴이 없으면 https://를 붙인다 (Render Blueprint)', () => {
    expect(readConfig({ WEB_ORIGIN: 'todo-planner-web.onrender.com' }).webOrigin).toBe(
      'https://todo-planner-web.onrender.com',
    );
  });

  it('TRUST_PROXY가 0 이상의 정수가 아니면 시작하지 않는다', () => {
    for (const bad of ['true', '-1', '1.5', 'abc']) {
      expect(() => readConfig({ TRUST_PROXY: bad })).toThrow(/TRUST_PROXY/);
    }
  });

  it('기본값: 프록시 신뢰 안 함, 요청 수 제한 켬', () => {
    expect(readConfig({})).toEqual({ webOrigin: 'http://localhost:5173', trustProxy: 0, rateLimitDisabled: false });
  });
});
