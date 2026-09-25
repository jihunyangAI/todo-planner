import { describe, expect, it } from 'vitest';
import { toOrigin } from './url.js';

describe('toOrigin', () => {
  it('스킴이 없으면 https://를 붙인다', () => {
    expect(toOrigin('todo-api.onrender.com')).toBe('https://todo-api.onrender.com');
  });

  it('스킴이 있으면 그대로 두고 끝의 /만 뗀다', () => {
    expect(toOrigin('http://localhost:4000')).toBe('http://localhost:4000');
    expect(toOrigin('https://todo.example.com/')).toBe('https://todo.example.com');
  });
});
