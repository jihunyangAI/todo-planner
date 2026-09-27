import { useEffect, useState } from 'react';

export const LOGIN_URL = '/auth/github';
const SLOW_NOTICE_MS = 3_000;

interface Props {
  status: 'checking' | 'anonymous' | 'error' | 'expired';
  onRetry?: () => void;
}

/** 로그인 확인 중·로그인 필요·서버 연결 실패·로그인 만료 화면 */
export function LoginView({ status, onRetry }: Props) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (status !== 'checking') return;
    const timer = setTimeout(() => setSlow(true), SLOW_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [status]);

  if (status === 'checking') {
    return (
      <main className="login" role="status" aria-live="polite">
        <p>{slow ? '서버에 연결하는 중입니다. 처음 연결은 최대 1분 걸릴 수 있습니다.' : '로그인 상태를 확인하는 중…'}</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="login" role="alert">
        <h1>서버에 연결하지 못했습니다</h1>
        <p>네트워크 연결을 확인하거나 잠시 뒤 다시 시도해 주세요.</p>
        <button type="button" className="button button--primary" onClick={onRetry}>
          다시 시도
        </button>
      </main>
    );
  }

  return (
    <main className="login">
      <h1>할 일 + 계획</h1>
      <p>
        {status === 'expired'
          ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
          : 'GitHub 계정으로 로그인하면 어느 기기에서나 내 할 일을 볼 수 있습니다.'}
      </p>
      <a className="button button--primary login__button" href={LOGIN_URL}>
        GitHub로 로그인
      </a>
    </main>
  );
}
