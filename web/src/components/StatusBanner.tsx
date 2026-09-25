import { useEngine, useTaskState } from '../store/TaskStore';

/** 저장 실패 배너와 ID 저장 불가 경고 */
export function StatusBanner() {
  const engine = useEngine();
  const { failedCount, persistentClientId } = useTaskState();
  return (
    <>
      {!persistentClientId && (
        <div className="banner banner--warning" role="alert">
          이 브라우저에 ID를 저장할 수 없습니다. 이 창을 닫으면 데이터에 다시 접근할 수 없습니다.
        </div>
      )}
      {failedCount > 0 && (
        <div className="banner banner--error" role="alert">
          <span>저장하지 못한 변경 {failedCount}건</span>
          <button type="button" className="button button--small" onClick={() => engine.retry()}>
            다시 시도
          </button>
          <button type="button" className="button button--small" onClick={() => engine.discard()}>
            버리기
          </button>
        </div>
      )}
    </>
  );
}
