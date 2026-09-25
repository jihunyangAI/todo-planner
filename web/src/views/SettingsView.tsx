import { isUuidV4 } from '@todo/shared';
import { useId, useRef, useState } from 'react';
import { normalizeClientId } from '../api/clientId';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useEngine, useTaskState } from '../store/TaskStore';

export const DATA_NOTICE =
  '데이터는 서버에 저장되며 이 브라우저에 보관된 ID로 접근합니다. 브라우저 데이터를 지우면 ID가 사라져 데이터에 접근할 수 없으니 ID를 복사해 두세요. 민감한 정보는 저장하지 마세요.';

type Pending = { kind: 'switch'; value: string } | { kind: 'revert' };

export function SettingsView() {
  const engine = useEngine();
  const { clientId, previousClientId } = useTaskState();
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const copy = async () => {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(clientId);
      setCopyMessage('복사했습니다');
    } catch {
      // HTTP로 접속한 개발 환경 등: 사용자가 직접 복사하게 한다
      idRef.current?.focus();
      idRef.current?.select();
      setCopyMessage('직접 복사하세요(Ctrl+C)');
    }
  };

  const unsavedMessage = (count: number) =>
    `저장하지 못한 변경 ${count}건이 있습니다. 다시 시도하거나 버린 뒤 전환하세요.`;

  /** 형식 검사 → 저장하지 못한 변경이 있으면 차단 → 두 검사를 통과해야 확인 대화상자를 연다. */
  const request = (next: Pending) => {
    setMessage(null);
    const count = engine.unsavedTaskCount();
    if (count > 0) {
      setMessage(unsavedMessage(count));
      return;
    }
    setPending(next);
  };

  const requestSwitch = () => {
    const value = normalizeClientId(input);
    if (!isUuidV4(value)) {
      setMessage('UUID 형식의 ID가 아닙니다.');
      return;
    }
    if (value === clientId) {
      setMessage('현재 ID와 같습니다.');
      return;
    }
    request({ kind: 'switch', value });
  };

  const confirm = () => {
    if (!pending) return;
    const result = pending.kind === 'switch' ? engine.switchClientId(pending.value) : engine.revertClientId();
    setPending(null);
    if (result.ok) {
      setInput('');
      setMessage(result.changed ? 'ID를 바꾸고 목록을 다시 불러왔습니다.' : null);
    } else if (result.reason === 'invalid') {
      setMessage('UUID 형식의 ID가 아닙니다.');
    } else {
      setMessage(unsavedMessage(result.count));
    }
  };

  return (
    <section aria-labelledby="settings-heading">
      <header className="view-header">
        <h1 id="settings-heading">설정</h1>
      </header>

      <p className="notice">{DATA_NOTICE}</p>

      <div className="field">
        <label htmlFor={`${uid}-current`}>현재 ID</label>
        <div className="id-row">
          <input ref={idRef} id={`${uid}-current`} readOnly value={clientId} className="mono" />
          <button type="button" className="button" onClick={copy}>
            복사
          </button>
        </div>
        {copyMessage && (
          <span className="field__hint" role="status">
            {copyMessage}
          </span>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${uid}-restore`}>다른 브라우저에서 복사한 ID로 전환</label>
        <div className="id-row">
          <input
            id={`${uid}-restore`}
            className="mono"
            value={input}
            placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx"
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="button" className="button" onClick={requestSwitch} disabled={input.trim() === ''}>
            전환
          </button>
        </div>
      </div>

      {previousClientId && (
        <div className="field">
          <span>이전 ID: <code className="mono">{previousClientId}</code></span>
          <button type="button" className="button" onClick={() => request({ kind: 'revert' })}>
            이전 ID로 되돌리기
          </button>
        </div>
      )}

      {message && (
        <p className="field__hint" role="status">
          {message}
        </p>
      )}

      <ConfirmDialog
        open={pending !== null}
        title="ID를 바꿀까요?"
        confirmLabel="전환"
        onCancel={() => setPending(null)}
        onConfirm={confirm}
      >
        <p>
          현재 ID: <code className="mono">{clientId}</code>
        </p>
        <p>현재 ID를 복사해 두지 않으면 지금 데이터에 다시 접근할 수 없습니다.</p>
      </ConfirmDialog>
    </section>
  );
}
