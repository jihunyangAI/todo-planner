import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

const REQUIRED = {
  GITHUB_CLIENT_ID: 'id',
  GITHUB_CLIENT_SECRET: 'secret',
  SESSION_SECRET: 's'.repeat(32),
};

describe('readConfig', () => {
  it('환경 변수를 읽는다', () => {
    expect(
      readConfig({
        ...REQUIRED,
        TRUST_PROXY: '1',
        RATE_LIMIT_DISABLED: 'true',
        PUBLIC_URL: 'https://todo.example.com/',
        SERVE_WEB: 'true',
      }),
    ).toEqual({
      trustProxy: 1,
      rateLimitDisabled: true,
      publicUrl: 'https://todo.example.com',
      github: { clientId: 'id', clientSecret: 'secret' },
      sessionSecret: 's'.repeat(32),
      cookieSecure: true,
      serveWeb: true,
    });
  });

  it('GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET이 없으면 시작하지 않는다', () => {
    for (const name of Object.keys(REQUIRED)) {
      expect(() => readConfig({ ...REQUIRED, [name]: '' })).toThrow(name);
    }
  });

  it('SESSION_SECRET이 32자보다 짧으면 시작하지 않는다', () => {
    expect(() => readConfig({ ...REQUIRED, SESSION_SECRET: 'short' })).toThrow(/32자/);
  });

  it('PUBLIC_URL이 없으면 RENDER_EXTERNAL_URL, 그것도 없으면 로컬 주소. http면 Secure 쿠키를 쓰지 않는다', () => {
    expect(readConfig({ ...REQUIRED, TRUST_PROXY: '1', RENDER_EXTERNAL_URL: 'https://todo.onrender.com' }).publicUrl).toBe(
      'https://todo.onrender.com',
    );
    const local = readConfig(REQUIRED);
    expect(local.publicUrl).toBe('http://localhost:5173');
    expect(local.cookieSecure).toBe(false);
    expect(local.serveWeb).toBe(false);
  });

  it('https 주소인데 TRUST_PROXY가 0이면 시작하지 않는다(Secure 쿠키가 발급되지 않아 로그인이 반복됨)', () => {
    expect(() => readConfig({ ...REQUIRED, PUBLIC_URL: 'https://todo.example.com' })).toThrow(/TRUST_PROXY/);
    expect(() => readConfig({ ...REQUIRED, PUBLIC_URL: 'https://todo.example.com', TRUST_PROXY: '1' })).not.toThrow();
  });

  it('TRUST_PROXY가 0 이상의 정수가 아니면 시작하지 않는다', () => {
    for (const bad of ['true', '-1', '1.5', 'abc']) {
      expect(() => readConfig({ ...REQUIRED, TRUST_PROXY: bad })).toThrow(/TRUST_PROXY/);
    }
  });
});
