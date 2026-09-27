import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, type ApiClient, type AuthApi, type User } from '../api/client';
import { clearLegacyClientId, readLegacyClientId } from '../api/legacyClientId';
import { TaskStoreProvider } from '../store/TaskStore';
import { TaskEngine } from '../store/syncQueue';
import { LoginView } from './LoginView';

interface AuthContextValue {
  user: User;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthGate 안에서만 쓸 수 있습니다');
  return value;
}

/** 테스트에서 로그인된 상태를 만들 때 쓴다. */
export const AuthProvider = AuthContext.Provider;

type AuthState =
  | { kind: 'checking' }
  | { kind: 'anonymous' }
  | { kind: 'error' }
  | { kind: 'signedIn'; user: User };

interface Props {
  authApi: AuthApi;
  api: ApiClient;
  children: ReactNode;
}

/**
 * 로그인 여부를 확인한다. 로그인하지 않았으면 로그인 화면을, 로그인했으면 할 일 앱을 보여 준다.
 * 로그인 직후 이 브라우저에 옛 익명 ID가 남아 있으면 그 작업을 계정으로 가져온다.
 */
export function AuthGate({ authApi, api, children }: Props) {
  const [state, setState] = useState<AuthState>({ kind: 'checking' });

  const check = useCallback(async () => {
    setState({ kind: 'checking' });
    let user: User;
    try {
      user = await authApi.me();
    } catch (error) {
      setState({ kind: error instanceof ApiError && error.kind === 'unauthorized' ? 'anonymous' : 'error' });
      return;
    }
    const legacy = readLegacyClientId();
    if (legacy) {
      try {
        await authApi.claim(legacy);
        clearLegacyClientId();
      } catch {
        // 실패하면 키를 남겨 두고 다음 로그인 때 다시 시도한다
      }
    }
    setState({ kind: 'signedIn', user });
  }, [authApi]);

  useEffect(() => {
    void check();
  }, [check]);

  const user = state.kind === 'signedIn' ? state.user : null;
  // 사용자가 바뀌면 이전 사용자의 작업이 남지 않도록 엔진을 새로 만든다
  const engine = useMemo(() => (user ? new TaskEngine({ api }) : null), [user, api]);
  /** 서버 세션이 실제로 지워졌을 때만 로그인 화면으로 바꾼다. 실패하면 예외를 그대로 던진다. */
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // 401: 이미 세션이 없다 → 로그아웃된 것과 같다
      if (!(error instanceof ApiError && error.kind === 'unauthorized')) throw error;
    }
    setState({ kind: 'anonymous' });
  }, [authApi]);

  if (state.kind === 'signedIn' && engine) {
    return (
      <AuthContext.Provider value={{ user: state.user, logout }}>
        <TaskStoreProvider key={state.user.id} engine={engine}>
          {children}
        </TaskStoreProvider>
      </AuthContext.Provider>
    );
  }
  return <LoginView status={state.kind === 'signedIn' ? 'checking' : state.kind} onRetry={() => void check()} />;
}
