import { pino, type Logger } from 'pino';

/** 클라이언트 ID는 사실상 비밀번호이므로 로그에 남기지 않는다. 요청 본문도 기록하지 않는다. */
const REDACT_PATHS = ['req.headers["x-client-id"]', 'req.body', 'req.headers.cookie'];

export function createLogger(options: { level?: string; destination?: NodeJS.WritableStream } = {}): Logger {
  return pino(
    { level: options.level ?? process.env.LOG_LEVEL ?? 'info', redact: { paths: REDACT_PATHS, remove: true } },
    options.destination ?? process.stdout,
  );
}
