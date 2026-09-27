import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createApiClient, createAuthApi } from './api/client';
import { AuthGate } from './auth/AuthGate';
import './styles/global.css';

// 웹과 API는 같은 출처다(운영: API가 웹을 서빙, 로컬: Vite 프록시)
const api = createApiClient();
const authApi = createAuthApi();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate authApi={authApi} api={api}>
      <App />
    </AuthGate>
  </StrictMode>,
);
