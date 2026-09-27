import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4100;
const WEB_PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    {
      // 메모리 DB와 가짜 GitHub로 API를 띄운다. OAuth 콜백은 브라우저가 접속하는 preview 주소로 돌아온다
      command: 'npm run e2e -w server',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { PORT: String(API_PORT), PUBLIC_URL: `http://localhost:${WEB_PORT}` },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'npm run build -w web && npm run preview -w web',
      url: `http://localhost:${WEB_PORT}`,
      // preview가 /api·/auth를 API로 전달해 웹과 API가 같은 출처가 된다(세션 쿠키)
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
