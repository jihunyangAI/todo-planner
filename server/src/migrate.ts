import type { Database } from './db.js';

/**
 * 로그인 도입 전 문서를 새 스키마로 바꾼다. 여러 번 실행해도 결과가 같다.
 * - userId가 없는 문서: userId = null (아직 주인 없음)
 * - ownerId(익명 클라이언트 ID)는 legacyClientId로 이름을 바꿔, 로그인 뒤 claim으로 가져올 수 있게 둔다
 */
export async function migrateTasks({ tasks }: Database): Promise<number> {
  const result = await tasks.updateMany({ userId: { $exists: false } }, [
    { $set: { userId: null, legacyClientId: '$ownerId' } },
    { $unset: 'ownerId' },
  ]);
  return result.modifiedCount;
}
