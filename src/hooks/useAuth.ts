import { useState, useEffect } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  browserPopupRedirectResolver,
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
      // browserPopupRedirectResolver форсирует настоящий popup без конвертации в redirect
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      return;
    }

    // Веб: сначала popup, при блокировке — redirect
    try {
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      if (POPUP_BLOCKED_CODES.includes(code)) {
        await signInWithRedirect(auth, provider, browserPopupRedirectResolver);
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
