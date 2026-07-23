import type { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';

export type AuthRequest = Request & { uid: string };

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = authHeader.slice(7);
  const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (IS_PRODUCTION) {
    if (!hasServiceAccount) {
      console.error('[requireAuth] FATAL: no service account in production');
      res.status(500).json({ error: 'Server misconfigured' });
      return;
    }
    try {
      const decoded = await getAuth().verifyIdToken(token);
      (req as AuthRequest).uid = decoded.uid;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
    return;
  }

  // Dev с service account — полная верификация
  if (hasServiceAccount) {
    try {
      const decoded = await getAuth().verifyIdToken(token);
      (req as AuthRequest).uid = decoded.uid;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
    return;
  }

  // Dev без service account — декодирование JWT без проверки подписи разрешено
  // ТОЛЬКО при явном opt-in через ALLOW_INSECURE_DEV_AUTH=true. Без него — 401.
  if (process.env.ALLOW_INSECURE_DEV_AUTH !== 'true') {
    console.error('[requireAuth] no service account and ALLOW_INSECURE_DEV_AUTH not set — rejecting');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Bad JWT structure');
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
    if (!payload.sub && !payload.user_id) throw new Error('No uid in token');
    (req as AuthRequest).uid = payload.sub || payload.user_id;
    next();
  } catch (e) {
    console.error('[requireAuth dev] token decode failed:', e);
    res.status(401).json({ error: 'Invalid token format' });
  }
}
