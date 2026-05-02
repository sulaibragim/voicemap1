import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import App from './App.tsx';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import './index.css';

GoogleAuth.initialize({
  clientId: '749077608006-9v747vu3klr3i3j494bj2v8sn4jutphb.apps.googleusercontent.com',
  scopes: ['profile', 'email'],
  grantOfflineAccess: true,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
