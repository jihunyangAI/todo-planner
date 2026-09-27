import { toOrigin } from '@todo/shared';

export interface AppConfig {
  /** Express `trust proxy` 값. 프록시 뒤에서는 1. */
  trustProxy: number;
  rateLimitDisabled: boolean;
  /** 사용자가 접속하는 주소. OAuth 콜백 주소를 만들 때 쓴다 (예: http://localhost:5173) */
  publicUrl: string;
  github: { clientId: string; clientSecret: string };
  sessionSecret: string;
  /** publicUrl이 https면 세션 쿠키에 Secure를 붙인다 */
  cookieSecure: boolean;
  /** true면 API가 web/dist를 함께 서빙한다(운영: 같은 출처로 세션 쿠키를 쓰기 위해) */
  serveWeb: boolean;
}

const SESSION_SECRET_MIN_LENGTH = 32;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} 환경 변수가 필요합니다`);
  return value;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Vercel은 항상 프록시 뒤에서 실행된다
  const trustProxy = Number(env.TRUST_PROXY ?? (env.VERCEL ? 1 : 0));
  // 잘못된 값이 조용히 무시되면 모든 사용자가 한 IP로 묶여 요청 수 제한에 걸린다
  if (!Number.isInteger(trustProxy) || trustProxy < 0) {
    throw new Error(`TRUST_PROXY는 0 이상의 정수여야 합니다: ${env.TRUST_PROXY}`);
  }
  const sessionSecret = required(env, 'SESSION_SECRET');
  if (sessionSecret.length < SESSION_SECRET_MIN_LENGTH) {
    throw new Error(`SESSION_SECRET은 ${SESSION_SECRET_MIN_LENGTH}자 이상이어야 합니다`);
  }
  // Vercel은 운영 도메인을 VERCEL_PROJECT_PRODUCTION_URL(도메인만), Render는 RENDER_EXTERNAL_URL로 제공한다
  const publicUrl = toOrigin(
    env.PUBLIC_URL ?? env.VERCEL_PROJECT_PRODUCTION_URL ?? env.RENDER_EXTERNAL_URL ?? 'http://localhost:5173',
  );
  // https는 TLS를 끝내는 프록시 뒤에서 서빙된다. 프록시를 신뢰하지 않으면 Secure 세션 쿠키를 보내지 않는다
  if (publicUrl.startsWith('https://') && trustProxy === 0) {
    throw new Error('https 주소(PUBLIC_URL)로 서빙할 때는 TRUST_PROXY를 1 이상으로 설정해야 합니다');
  }
  return {
    trustProxy,
    rateLimitDisabled: env.RATE_LIMIT_DISABLED === 'true',
    publicUrl,
    github: { clientId: required(env, 'GITHUB_CLIENT_ID'), clientSecret: required(env, 'GITHUB_CLIENT_SECRET') },
    sessionSecret,
    cookieSecure: publicUrl.startsWith('https://'),
    serveWeb: env.SERVE_WEB === 'true',
  };
}
