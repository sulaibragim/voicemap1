import { initializeApp, cert, getApps } from 'firebase-admin/app';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export function initFirebase(): void {
  if (getApps().length) return;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const hasServiceAccount = !!serviceAccount && serviceAccount.includes('"private_key"');

  if (IS_PRODUCTION && !hasServiceAccount) {
    console.error('[Firebase] FATAL: FIREBASE_SERVICE_ACCOUNT_JSON is required in production');
    process.exit(1);
  }

  try {
    if (hasServiceAccount) {
      initializeApp({ credential: cert(JSON.parse(serviceAccount!)) });
      console.log('[Firebase] Initialized with service account');
    } else {
      initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0179752723' });
      console.warn('[Firebase] ⚠ No service account — DEV MODE ONLY');
    }
  } catch (e) {
    if (IS_PRODUCTION) {
      console.error('[Firebase] FATAL: Init failed in production:', e);
      process.exit(1);
    }
    console.warn('[Firebase] Init failed, continuing (dev only):', e);
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0179752723' });
  }
}
