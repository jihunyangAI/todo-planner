import { LOGIN_URL } from '../auth/LoginView';
import { useEngine, useTaskState } from '../store/TaskStore';

/** 로그인 만료 안내와 저장 실패 배너 */
export function StatusBanner() {
  const engine = useEngine();
  const { failedCount, authExpired } = useTaskState();
  return (
    <>
      {authExpired && (
        <div className="banner banner--warning" role="alert">
          <span>로그인이 만료되었습니다. 다시 로그인하면 저장하지 못한 변경은 사라집니다.</span>
          <a className="button button--small" href={LOGIN_URL}>
            다시 로그인
          </a>
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
