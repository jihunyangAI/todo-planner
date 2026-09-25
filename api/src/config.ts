export interface AppConfig {
  webOrigin: string;
  /** Express `trust proxy` 값. 프록시 뒤에서는 1. */
  trustProxy: number;
  rateLimitDisabled: boolean;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const trustProxy = Number(env.TRUST_PROXY ?? 0);
  // 잘못된 값이 조용히 무시되면 모든 사용자가 한 IP로 묶여 요청 수 제한에 걸린다
  if (!Number.isInteger(trustProxy) || trustProxy < 0) {
    throw new Error(`TRUST_PROXY는 0 이상의 정수여야 합니다: ${env.TRUST_PROXY}`);
  }
  return {
    webOrigin: env.WEB_ORIGIN ?? 'http://localhost:5173',
    trustProxy,
    rateLimitDisabled: env.RATE_LIMIT_DISABLED === 'true',
  };
}
