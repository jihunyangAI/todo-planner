import { isUuidV4 } from '@todo/shared';
import { generateUuid } from '../lib/uuid';

export const CLIENT_ID_KEY = 'todo-planner:clientId';
export const PREVIOUS_CLIENT_ID_KEY = 'todo-planner:previousClientId';

/** 붙여 넣은 값에서 앞뒤 공백을 지우고 소문자로 바꾼다. */
export function normalizeClientId(raw: string): string {
  return raw.trim().toLowerCase();
}

function safeStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    const probe = '__todo-planner-probe__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/**
 * 클라이언트 ID를 보관한다. 앱이 시작될 때 한 번 읽어 메모리에 두고, 모든 요청은 메모리 값을 쓴다.
 * localStorage를 쓸 수 없으면 메모리에만 둔다(persistent=false).
 */
export class ClientIdStore {
  current: string;
  previous: string | null;
  readonly persistent: boolean;

  constructor(
    private readonly storage: Storage | null = safeStorage(),
    makeId: () => string = generateUuid,
  ) {
    this.persistent = storage !== null;
    const stored = storage?.getItem(CLIENT_ID_KEY);
    const previous = storage?.getItem(PREVIOUS_CLIENT_ID_KEY);
    this.previous = previous && isUuidV4(previous) ? previous : null;
    if (stored && isUuidV4(stored)) {
      this.current = stored;
    } else {
      this.current = makeId();
      storage?.setItem(CLIENT_ID_KEY, this.current);
    }
  }

  /** 새 ID로 바꾸고 현재 ID를 이전 ID로 저장한다. */
  set(next: string): void {
    this.previous = this.current;
    this.current = next;
    this.storage?.setItem(PREVIOUS_CLIENT_ID_KEY, this.previous);
    this.storage?.setItem(CLIENT_ID_KEY, next);
  }

  /** 다른 탭이 이미 저장한 ID를 따라간다(저장소에는 쓰지 않는다). */
  adopt(next: string): void {
    this.current = next;
    const previous = this.storage?.getItem(PREVIOUS_CLIENT_ID_KEY);
    this.previous = previous && isUuidV4(previous) ? previous : this.previous;
  }

  /** 다른 탭에서 ID가 바뀌면 알린다. 해제 함수를 돌려준다. */
  subscribeExternal(onChange: (next: string) => void, target: Window = window): () => void {
    const listener = (event: StorageEvent) => {
      if (event.key !== CLIENT_ID_KEY || !event.newValue) return;
      if (!isUuidV4(event.newValue) || event.newValue === this.current) return;
      onChange(event.newValue);
    };
    target.addEventListener('storage', listener);
    return () => target.removeEventListener('storage', listener);
  }
}
