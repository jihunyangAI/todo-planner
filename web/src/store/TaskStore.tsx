import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { EngineSnapshot, TaskEngine } from './syncQueue';

const EngineContext = createContext<TaskEngine | null>(null);

/** 엔진을 화면에 연결한다: 첫 로드, 창이 다시 활성화될 때 다시 받아 오기. */
export function TaskStoreProvider({ engine, children }: { engine: TaskEngine; children: ReactNode }) {
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
