import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'api',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./test/globalSetup.ts'],
    // mongodb-memory-server는 처음 실행할 때 MongoDB 실행 파일을 내려받는다
    hookTimeout: 120_000,
    testTimeout: 20_000,
  },
});
