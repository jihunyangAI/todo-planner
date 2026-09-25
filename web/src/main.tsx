import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createApiClient } from './api/client';
import { ClientIdStore } from './api/clientId';
import { TaskStoreProvider } from './store/TaskStore';
import { TaskEngine } from './store/syncQueue';
import './styles/global.css';

const clientIds = new ClientIdStore();
const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  getClientId: () => clientIds.current,
});
const engine = new TaskEngine({ api, clientIds });
const subscribeExternalClientId = (onChange: (id: string) => void) => clientIds.subscribeExternal(onChange);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TaskStoreProvider engine={engine} subscribeExternalClientId={subscribeExternalClientId}>
      <App />
    </TaskStoreProvider>
  </StrictMode>,
);
