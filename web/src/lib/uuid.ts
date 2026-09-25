type CryptoLike = Pick<Crypto, 'getRandomValues'> & { randomUUID?: () => string };

/**
 * UUID v4를 만든다. `crypto.randomUUID`는 보안 컨텍스트(HTTPS·localhost)에서만 있으므로,
 * HTTP로 접속한 휴대폰처럼 없는 환경에서는 `getRandomValues`로 직접 만든다. Math.random은 쓰지 않는다.
 */
export function generateUuid(cryptoImpl: CryptoLike = globalThis.crypto): string {
  if (typeof cryptoImpl.randomUUID === 'function') return cryptoImpl.randomUUID();
  const bytes = cryptoImpl.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
