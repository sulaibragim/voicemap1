import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { installStaleVersionRecovery } from './lib/staleVersion';
import './index.css';

// Браузер может держать старый index.html, ссылающийся на файлы, удалённые при
// деплое: экран не грузится, в консоли ошибки. Перехватываем это и обновляем
// приложение сами, чтобы пользователю не приходилось чистить кэш руками.
installStaleVersionRecovery();

// GoogleAuth.initialize вызывается в useAuth (только для Capacitor) — здесь дубль не нужен

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
