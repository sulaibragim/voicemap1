import { useState, useEffect } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase';

export interface AuthUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
}

interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

function toAuthUser(u: User): AuthUser {
  return {
    uid: u.uid,
    displayName: u.displayName || 'Пользователь',
    email: u.email || '',
    photoURL: u.photoURL,
  };
}

// Определяем Capacitor — в нём redirect теряет sessionStorage
const isCapacitor = typeof window !== 'undefined' &&
  !!(window as unknown as { Capacitor?: unknown }).Capacitor;

const POPUP_BLOCKED_CODES = [
  'auth/popup-blocked',
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
];

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isCapacitor) {
      getRedirectResult(auth).catch(e => console.warn('Redirect result error:', e));
    }

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ? toAuthUser(firebaseUser) : null);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    if (isCapacitor) {
      // В Capacitor WebView redirect ломает sessionStorage — используем только popup.
      // Если popup заблокирован — открываем системный браузер телефона.
      try {
        await signInWithPopup(auth, provider);
      } catch (e: unknown) {
        const code = (e as { code?: string }).code ?? '';
        if (POPUP_BLOCKED_CODES.includes(code)) {
          // Fallback: открываем OAuth в системном браузере через window.open
          const authUrl = `https://voicemap1-production.up.railway.app/__/auth/handler`;
          window.open(authUrl, '_system');
          throw new Error('Войдите через браузер, который только что открылся');
        }
        throw e;
      }
      return;
    }

    // Веб: сначала popup, при блокировке — redirect
    try {
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      if (POPUP_BLOCKED_CODES.includes(code)) {
        await signInWithRedirect(auth, provider);
      } else {
        throw e;
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const getIdToken = async (): Promise<string | null> => {
    const current = auth.currentUser;
    if (!current) return null;
    return current.getIdToken();
  };

  return { user, loading, signInWithGoogle, logout, getIdToken };
}
