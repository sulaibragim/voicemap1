// Расшифровка аудио и учёт израсходованных минут.
//
// Все три роута здесь тратят деньги: аудио уходит в Gemini. Поэтому каждый
// проверяет месячный лимит ДО вызова модели и списывает фактический расход
// после (см. server/lib/quotaGuard.ts).
import { Router, type Request, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../../lib/auth';
import { getAI, uploadAudioToFileAPI, buildTranscribePayload, sanitizeKnownPeople } from '../../lib/gemini';
import { checkQuota, chargeUsage, sendQuotaExceeded } from '../../lib/quotaGuard';
import { getUsage, parseDurationToSeconds } from '../../lib/usage';
import { resolveLang, silencePlaceholder } from '../../lib/lang';

const router = Router();

// GET /api/ai/usage — сколько минут расшифровки израсходовано в этом месяце и каков лимит тарифа.
// Только чтение; счётчик пишет исключительно сервер при фактических расшифровках.
router.get('/usage', requireAuth, async (req: Request, res: Response) => {
  try {
    const { uid } = req as AuthRequest;
    res.json(await getUsage(uid));
  } catch (error) {
    console.error('[/ai/usage]', error);
    res.status(500).json({ error: 'Failed to load usage' });
  }
});

router.post('/transcribe', requireAuth, async (req, res) => {
  try {
    // Клиент передаёт ТОЛЬКО audio/mimeType/knownPeople/durationSeconds — prompt и config строятся
    // исключительно на сервере, чтобы исключить возможность превратить эндпоинт в открытый
    // LLM-прокси с произвольным промптом.
    const { audio, mimeType, knownPeople, durationSeconds, lang } = req.body;
    if (!audio || typeof audio !== 'string' || audio.length < 10) {
      return res.status(400).json({ error: 'Invalid or missing audio data' });
    }

    // Лимит месяца. Заявленная клиентом длительность нужна только для предпроверки —
    // списываем потом по фактическим токенам (см. chargeUsage).
    const { uid } = req as AuthRequest;
    const clientSeconds = parseDurationToSeconds(durationSeconds);
    const exceeded = await checkQuota(uid, clientSeconds);
    if (exceeded) {
      sendQuotaExceeded(res, exceeded);
      return;
    }

    const ai = getAI();

    let audioPart: Record<string, unknown>;
    if (audio.length > 20_000_000) {
      console.log(`[/ai/transcribe] Large audio (${Math.round(audio.length / 1_000_000)}MB), using File API`);
      const buffer = Buffer.from(audio, 'base64');
      const { fileUri, fileMimeType } = await uploadAudioToFileAPI(ai, buffer, mimeType || 'audio/webm');
      audioPart = { fileData: { fileUri, mimeType: fileMimeType } };
    } else {
      audioPart = { inlineData: { data: audio, mimeType: mimeType || 'audio/webm' } };
    }

    const { prompt, config } = buildTranscribePayload(sanitizeKnownPeople(knownPeople), resolveLang(lang));
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [audioPart, prompt],
      config,
    });
    await chargeUsage(uid, response.usageMetadata, clientSeconds);
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/transcribe]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/retranscribe', requireAuth, async (req, res) => {
  try {
    // Аналогично /transcribe: prompt/config клиент передать не может, только audioUrl/mimeType/knownPeople.
    const { audioUrl, mimeType, knownPeople, durationSeconds, lang } = req.body as {
      audioUrl: string; mimeType: string; knownPeople?: unknown; durationSeconds?: unknown; lang?: unknown;
    };
    if (!audioUrl || typeof audioUrl !== 'string') {
      res.status(400).json({ error: 'audioUrl is required' });
      return;
    }

    // Повтор расшифровки стоит столько же, сколько первая — лимит применяется и здесь.
    const { uid } = req as AuthRequest;
    const clientSeconds = parseDurationToSeconds(durationSeconds);
    const exceeded = await checkQuota(uid, clientSeconds);
    if (exceeded) {
      sendQuotaExceeded(res, exceeded);
      return;
    }

    console.log('[/ai/retranscribe] Fetching:', audioUrl);
    const fetchRes = await fetch(audioUrl);
    if (!fetchRes.ok) {
      res.status(502).json({ error: `Failed to fetch audio: ${fetchRes.status}` });
      return;
    }
    const buffer = Buffer.from(await fetchRes.arrayBuffer());
    console.log(`[/ai/retranscribe] ${Math.round(buffer.length / 1_000_000)}MB, uploading to File API`);

    const ai = getAI();
    const { fileUri, fileMimeType } = await uploadAudioToFileAPI(ai, buffer, mimeType || 'audio/mp4');
    const { prompt, config } = buildTranscribePayload(sanitizeKnownPeople(knownPeople), resolveLang(lang));
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ fileData: { fileUri, mimeType: fileMimeType } }, prompt],
      config,
    });
    await chargeUsage(uid, response.usageMetadata, clientSeconds);
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/retranscribe]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// Роут /chat удалён вместе с ассистентом-«действиями»: он принимал произвольный
// промпт от клиента (открытый LLM-прокси). Поиск по записям живёт в /search,
// где промпт строится на сервере.

router.post('/chat-voice', requireAuth, async (req, res) => {
  try {
    const { audio, mimeType, lang } = req.body;
    if (!audio || typeof audio !== 'string' || audio.length < 10) {
      return res.status(400).json({ error: 'Invalid or missing audio data' });
    }
    // Голосовой ввод НЕ переводим — расшифровка идёт на языке речи.
    // Локализуется только заглушка тишины: она показывается пользователю как есть.
    const silence = silencePlaceholder(resolveLang(lang));
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { data: audio, mimeType } },
          { text: `Transcribe this voice message EXACTLY in the language spoken (auto-detect). Do not translate. If the audio is empty, silent, or contains no speech, return strictly "${silence}". Do not invent or hallucinate speech.` },
        ],
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/chat-voice]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

export { router as transcribeRouter };
