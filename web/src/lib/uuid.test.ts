import { isUuidV4 } from '@todo/shared';
import { describe, expect, it } from 'vitest';
import { generateUuid } from './uuid';

describe('generateUuid', () => {
  it('crypto.randomUUID가 없는 환경에서도 UUID v4를 만든다 (AC38)', () => {
    const insecure = { getRandomValues: <T extends ArrayBufferView>(a: T) => globalThis.crypto.getRandomValues(a) };
    const ids = new Set(Array.from({ length: 50 }, () => generateUuid(insecure)));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(isUuidV4(id)).toBe(true);
  });

  it('crypto.randomUUID가 있으면 그것을 쓴다', () => {
    expect(isUuidV4(generateUuid())).toBe(true);
  });
});
