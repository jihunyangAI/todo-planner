import { useEngine, useTaskState } from '../store/TaskStore';

export function LoadingView() {
  const { slow } = useTaskState();
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="skeleton" aria-hidden="true" />
      <div className="skeleton" aria-hidden="true" />
      <p>{slow ? '서버에 연결하는 중입니다. 처음 연결은 최대 1분 걸릴 수 있습니다.' : '불러오는 중…'}</p>
    </div>
  );
}

export function LoadErrorView() {
  const engine = useEngine();
  return (
    <div className="load-error" role="alert">
      <h1>서버에 연결하지 못했습니다</h1>
      <p>네트워크 연결을 확인하거나 잠시 뒤 다시 시도해 주세요.</p>
      <button type="button" className="button button--primary" onClick={() => void engine.load()}>
        다시 시도
      </button>
    </div>
  );
}
