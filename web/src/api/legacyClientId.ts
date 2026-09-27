import { isUuidV4 } from '@todo/shared';

/** 로그인 도입 전, 익명 사용자를 구분하던 ID를 저장하던 키 */
export const LEGACY_CLIENT_ID_KEY = 'todo-planner:clientId';
const LEGACY_PREVIOUS_KEY = 'todo-planner:previousClientId';

/** 이 브라우저에 남아 있는 옛 익명 ID. 없거나 저장소를 쓸 수 없으면 null */
export function readLegacyClientId(storage: Storage | undefined = globalThis.localStorage): string | null {
  try {
    const value = storage?.getItem(LEGACY_CLIENT_ID_KEY);
    return value && isUuidV4(value) ? value : null;
  } catch {
    return null;
  }
}

/** 옛 익명 작업을 계정으로 가져온 뒤 호출한다. */
export function clearLegacyClientId(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.removeItem(LEGACY_CLIENT_ID_KEY);
    storage?.removeItem(LEGACY_PREVIOUS_KEY);
  } catch {
    // 저장소를 쓸 수 없는 환경: 지울 것도 없다
  }
}
