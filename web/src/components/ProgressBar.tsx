import { formatProgress, type Progress } from '../domain/selectors';

export function ProgressBar({ label, value }: { label: string; value: Progress }) {
  const text = formatProgress(value);
  return (
    <div className="progress">
      <span className="progress__label">{label}</span>
      {value.total > 0 && (
        <progress className="progress__bar" max={value.total} value={value.done} aria-label={`${label} ${text}`} />
      )}
      <span className="progress__text" data-testid={`progress-${label}`}>
        {text}
      </span>
    </div>
  );
}
