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
      // 메모리 DB로 API를 띄운다
      command: 'npm run e2e -w api',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { PORT: String(API_PORT), WEB_ORIGIN: `http://localhost:${WEB_PORT}`, RATE_LIMIT_DISABLED: 'true' },
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'npm run build -w web && npm run preview -w web',
      url: `http://localhost:${WEB_PORT}`,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
