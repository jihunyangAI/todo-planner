import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { EngineSnapshot, TaskEngine } from './syncQueue';

const EngineContext = createContext<TaskEngine | null>(null);

/**
 * 엔진을 화면에 연결한다: 첫 로드, 창 재활성화 때 다시 받아 오기, 다른 탭의 ID 변경 감지.
 */
export function TaskStoreProvider({
  engine,
  subscribeExternalClientId,
  children,
}: {
  engine: TaskEngine;
  subscribeExternalClientId?: (onChange: (id: string) => void) => () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    void engine.load();
  }, [engine]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void engine.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [engine]);

  useEffect(
    () => subscribeExternalClientId?.((id) => engine.handleExternalClientIdChange(id)),
    [engine, subscribeExternalClientId],
  );

  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>;
}

export function useEngine(): TaskEngine {
  const engine = useContext(EngineContext);
  if (!engine) throw new Error('TaskStoreProvider 안에서만 쓸 수 있습니다');
  return engine;
}

export function useTaskState(): EngineSnapshot {
  const engine = useEngine();
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot);
}
