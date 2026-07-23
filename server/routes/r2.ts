import { Router, type Request, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../lib/auth';
import { isValidRecordingId, isOwnedKey, resolveExt, uploadBuffer, deleteObject, R2_PUBLIC_URL } from '../lib/r2';

const router = Router();

router.post('/upload', requireAuth, async (req: Request, res: Response) => {
  try {
    const { uid } = req as AuthRequest;
    const { recordingId, contentType, audioBase64 } = req.body as {
      recordingId: string; contentType: string; audioBase64: string;
    };

    if (!isValidRecordingId(recordingId)) {
      res.status(400).json({ error: 'Invalid recordingId' });
      return;
    }
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'audioBase64 is required' });
      return;
    }
    const ext = resolveExt(contentType);
    if (!ext) {
      res.status(400).json({ error: 'Unsupported contentType' });
      return;
    }

    const key = `audio/${uid}/${recordingId}.${ext}`;
    const buffer = Buffer.from(audioBase64, 'base64');
    console.log(`[/r2/upload] key=${key} size=${buffer.length} bytes`);
    await uploadBuffer(key, buffer, contentType);
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    console.log('[/r2/upload] OK →', publicUrl);
    res.json({ publicUrl, key });
  } catch (error) {
    console.error('[/r2/upload]', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

router.delete('/delete', requireAuth, async (req: Request, res: Response) => {
  try {
    const { uid } = req as AuthRequest;
    const { key } = req.body as { key: string };

    if (!isOwnedKey(key, uid)) {
      console.warn(`[/r2/delete] forbidden key=${key} uid=${uid}`);
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await deleteObject(key);
    res.json({ ok: true });
  } catch (error) {
    console.error('[/r2/delete]', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export { router as r2Router };
