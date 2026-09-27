import { pino, type Logger } from 'pino';

/**
 * 세션 쿠키(로그인 자격), 요청 본문, 쿼리(OAuth code·state 포함)는 로그에 남기지 않는다.
 * 리다이렉트 Location도 지운다: /auth/github 응답은 state가 붙은 GitHub 주소로 보낸다.
 */
const REDACT_PATHS = ['req.headers.cookie', 'req.body', 'req.query', 'res.headers["set-cookie"]', 'res.headers.location'];

/** pino-http 요청 serializer: url에서 쿼리 문자열을 잘라 낸다. */
export function stripQuery<T extends { url?: string }>(req: T): T {
  if (req.url) req.url = req.url.split('?')[0];
  return req;
}

export function createLogger(options: { level?: string; destination?: NodeJS.WritableStream } = {}): Logger {
  return pino(
    { level: options.level ?? process.env.LOG_LEVEL ?? 'info', redact: { paths: REDACT_PATHS, remove: true } },
    options.destination ?? process.stdout,
  );
}
