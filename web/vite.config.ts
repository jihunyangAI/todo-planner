import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 웹과 API를 같은 출처로 맞춰 세션 쿠키가 1st-party로 동작하게 한다.
// dev(5173)와 preview(4173) 모두 /api·/auth를 API 서버로 전달한다(preview.proxy는 server.proxy를 그대로 쓴다).
const target = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target },
      '/auth': { target },
    },
  },
});
