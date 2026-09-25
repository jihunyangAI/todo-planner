import { useEffect, useRef, type ReactNode } from 'react';
import { useEngine, useTaskState } from '../store/TaskStore';

const TOAST_MS = 5_000;

/** 5초 뒤 스스로 닫힌다. 다시 렌더링되어도 타이머는 처음부터 다시 세지 않는다. */
export function Toast({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), TOAST_MS);
    return () => clearTimeout(timer);
  }, []);
  return <div className="toast">{children}</div>;
}

/** 엔진이 보낸 안내·오류 알림 */
export function Notices() {
  const engine = useEngine();
  const { notices } = useTaskState();
  return (
    <>
      {notices.map((notice) => (
        <Toast key={notice.id} onClose={() => engine.dismissNotice(notice.id)}>
          <span className={notice.tone === 'error' ? 'toast__error' : undefined}>{notice.text}</span>
          <button
            type="button"
            className="button button--small"
            aria-label="알림 닫기"
            onClick={() => engine.dismissNotice(notice.id)}
          >
            닫기
          </button>
        </Toast>
      ))}
    </>
  );
}
