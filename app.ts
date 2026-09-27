// Vercel 진입 파일. Vercel은 루트의 app.ts에서 Express 앱(default export)을 찾아 함수 하나로 배포한다.
// 실제 구현은 server/src/vercel.ts이고, 여기서는 빌드 결과(server/dist)를 내보낸다.
// 웹(web/dist)은 vercel.json의 includeFiles로 함수에 포함되고 Express가 직접 서빙한다.
import 'express';

export { default } from './server/dist/vercel.js';
