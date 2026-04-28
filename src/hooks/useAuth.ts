import { useState, useEffect } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
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

const isCapacitor = typeof window !== 'undefined' &&
  !!(window as unknown as { Capacitor?: unknown }).Capacitor;

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Инициализируем GoogleAuth плагин при старте (обязательно для Capacitor)
    if (isCapacitor) {
      GoogleAuth.initialize({
        clientId: '749077608006-9v747vu3klr3i3j494bj2v8sn4jutphb.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
      }).catch((e: unknown) => console.warn('[GoogleAuth] initialize failed:', e));
    }

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ? toAuthUser(firebaseUser) : null);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    if (isCapacitor) {
      // Нативный Google Sign-In — нет WebView редиректов, работает надёжно
      const googleUser = await GoogleAuth.signIn();
      const credential = GoogleAuthProvider.credential(
        googleUser.authentication.idToken
      );
      await signInWithCredential(auth, credential);
      return;
    }

    // Веб — стандартный popup
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    if (isCapacitor) {
      await GoogleAuth.signOut().catch(() => {});
    }
    await signOut(auth);
  };

  const getIdToken = async (): Promise<string | null> => {
    const current = auth.currentUser;
    if (!current) return null;
    return current.getIdToken();
  };

  return { user, loading, signInWithGoogle, logout, getIdToken };
}
