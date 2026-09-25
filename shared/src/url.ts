/**
 * 주소에 스킴이 없으면 https://를 붙이고 끝의 /를 뗀다.
 * Render Blueprint는 다른 서비스의 주소를 도메인만(예: todo-api.onrender.com) 넘겨주기 때문이다.
 */
export function toOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
