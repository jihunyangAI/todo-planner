import { useState } from 'react';
import { useAuth } from '../auth/AuthGate';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useEngine } from '../store/TaskStore';

export const DATA_NOTICE =
  '할 일은 GitHub 계정에 연결되어 서버에 저장됩니다. 다른 기기에서도 같은 GitHub 계정으로 로그인하면 볼 수 있습니다.';

export function SettingsView() {
  const engine = useEngine();
  const { user, logout } = useAuth();
  const [confirmUnsaved, setConfirmUnsaved] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  const doLogout = async () => {
    setConfirmUnsaved(null);
    setLogoutError(false);
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // 서버 세션이 남아 있으므로 로그아웃된 것처럼 보이면 안 된다
      setLoggingOut(false);
      setLogoutError(true);
    }
  };

  /** 저장하지 못한 변경이 있으면 사라진다고 먼저 알린다 */
  const requestLogout = () => {
    const unsaved = engine.unsavedTaskCount();
    if (unsaved > 0) setConfirmUnsaved(unsaved);
    else void doLogout();
  };

  return (
    <section aria-labelledby="settings-heading">
      <header className="view-header">
        <h1 id="settings-heading">설정</h1>
      </header>

      <p className="notice">{DATA_NOTICE}</p>

      <div className="account">
        <img className="account__avatar" src={user.avatarUrl} alt={`${user.username} 프로필 사진`} width={48} height={48} />
        <div>
          <p className="account__label">GitHub 계정</p>
          <p className="account__name">{user.username}</p>
        </div>
        <button type="button" className="button account__logout" onClick={requestLogout} disabled={loggingOut}>
          로그아웃
        </button>
      </div>
      {logoutError && (
        <p className="field__error" role="alert">
          로그아웃하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.
        </p>
      )}

      <ConfirmDialog
        open={confirmUnsaved !== null}
        title="로그아웃할까요?"
        confirmLabel="로그아웃"
        onCancel={() => setConfirmUnsaved(null)}
        onConfirm={() => void doLogout()}
      >
        <p>저장하지 못한 변경 {confirmUnsaved}건이 있습니다. 로그아웃하면 이 변경은 사라집니다.</p>
      </ConfirmDialog>
    </section>
  );
}
