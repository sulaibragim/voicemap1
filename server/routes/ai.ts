import { Router } from 'express';
import { Type } from '@google/genai';
import { requireAuth } from '../lib/auth';
import { getAI, uploadAudioToFileAPI, buildTranscribePayload, sanitizeKnownPeople } from '../lib/gemini';

const router = Router();

router.post('/tip', requireAuth, async (req, res) => {
  try {
    const { context } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Based on the following recent recordings context, generate a short, personalized daily advice for the user to improve their productivity, communication, or well-being. Return JSON with 'title' (short uppercase category like 'ПРОДУКТИВНОСТЬ') and 'text' (the advice itself, 1-2 sentences).\n\nIMPORTANT: Write BOTH 'title' and 'text' in Russian language only. No English.\n\nContext:\n${context}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            text: { type: Type.STRING },
          },
        },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/tip]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/transcribe', requireAuth, async (req, res) => {
  try {
    // Клиент передаёт ТОЛЬКО audio/mimeType/knownPeople — prompt и config строятся исключительно на сервере,
    // чтобы исключить возможность превратить эндпоинт в открытый LLM-прокси с произвольным промптом.
    const { audio, mimeType, knownPeople } = req.body;
    if (!audio || typeof audio !== 'string' || audio.length < 10) {
      return res.status(400).json({ error: 'Invalid or missing audio data' });
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

    const { prompt, config } = buildTranscribePayload(sanitizeKnownPeople(knownPeople));
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [audioPart, prompt],
      config,
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/transcribe]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/retranscribe', requireAuth, async (req, res) => {
  try {
    // Аналогично /transcribe: prompt/config клиент передать не может, только audioUrl/mimeType/knownPeople.
    const { audioUrl, mimeType, knownPeople } = req.body as {
      audioUrl: string; mimeType: string; knownPeople?: unknown;
    };
    if (!audioUrl || typeof audioUrl !== 'string') {
      res.status(400).json({ error: 'audioUrl is required' });
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
    const { prompt, config } = buildTranscribePayload(sanitizeKnownPeople(knownPeople));
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ fileData: { fileUri, mimeType: fileMimeType } }, prompt],
      config,
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/retranscribe]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/chat', requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            action: { type: Type.STRING, enum: ['NAVIGATE', 'OPEN_RECORDING', 'SET_FOCUS_TASKS', 'CREATE_NOTE', 'UPDATE_IDEAS', 'NONE'] },
            actionTarget: { type: Type.STRING, nullable: true },
            actionData: {
              type: Type.OBJECT, nullable: true,
              properties: {
                type: { type: Type.STRING, nullable: true },
                content: { type: Type.STRING, nullable: true },
                dueDate: { type: Type.STRING, nullable: true },
                dueTime: { type: Type.STRING, nullable: true },
                tasks: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                recordingId: { type: Type.STRING, nullable: true },
                ideas: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
              },
              required: ['type', 'content'],
            },
          },
          required: ['text', 'action', 'actionTarget', 'actionData'],
        },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/chat]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/chat-voice', requireAuth, async (req, res) => {
  try {
    const { audio, mimeType } = req.body;
    if (!audio || typeof audio !== 'string' || audio.length < 10) {
      return res.status(400).json({ error: 'Invalid or missing audio data' });
    }
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { data: audio, mimeType } },
          { text: 'Transcribe this voice message EXACTLY in the language spoken (auto-detect Russian or English). Do not translate. If the audio is empty, silent, or contains no speech, return strictly "[Тишина]". Do not invent or hallucinate speech.' },
        ],
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/chat-voice]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/append', requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            ideas: { type: Type.ARRAY, items: { type: Type.STRING } },
            actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['summary', 'ideas', 'actionItems'],
        },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/append]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/parse-reminder', requireAuth, async (req, res) => {
  try {
    const { text, currentDate } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a date/time parser for a reminder app.

Current date/time context:
${currentDate}

CRITICAL: Use the ISO dates above for all calculations.
- "сегодня" / "today" → TODAY_ISO
- "завтра" / "tomorrow" → TOMORROW_ISO
- "послезавтра" → TODAY_ISO + 2 days
- "через N дней" → TODAY_ISO + N days
- "через час" / "через 30 минут" → TODAY_ISO + that duration from CURRENT_TIME
- Next weekday (e.g. "в пятницу") → find next occurrence of that weekday after TODAY_ISO

The user recorded this reminder: "${text}"

Extract the desired reminder date and time. Return JSON:
- "hasTime": boolean — whether the user specified when to be reminded
- "date": string in YYYY-MM-DD format based on TODAY_ISO/TOMORROW_ISO (null if hasTime is false)
- "time": string in HH:MM format (null if hasTime is false)
- "summary": short clean reminder text without time references (e.g. "купить молоко")`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasTime: { type: Type.BOOLEAN },
            date: { type: Type.STRING, nullable: true },
            time: { type: Type.STRING, nullable: true },
            summary: { type: Type.STRING },
          },
          required: ['hasTime', 'summary'],
        },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/parse-reminder]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/develop-idea', requireAuth, async (req, res) => {
  try {
    const { idea, recordingTitle } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a sharp, insightful thinking partner. The user had this idea/insight from a voice recording titled "${recordingTitle}":

"${idea}"

Develop this idea in 3-5 sentences. Be specific, practical, and thought-provoking. Connect it to real applications or deeper implications. Write in Russian. Don't start with "This idea..." or "Эта идея..." — dive straight into the substance.`,
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/develop-idea]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/condense-transcript', requireAuth, async (req, res) => {
  try {
    const { transcript } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert editor. Below is a raw voice transcript with filler words, repetitions, and off-topic talk.

Your task: rewrite it into a condensed version that keeps ONLY the meaningful content.
Rules:
- Remove filler words (ну, типа, вот, короче, как бы, э-э, мм, ладно, да-да, etc.)
- Remove repetitions and false starts
- Remove off-topic small talk
- Keep all important ideas, decisions, and facts
- Keep the original speaker names and approximate timestamps
- Keep the same language (Russian or English)
- If a speaker's paragraph has nothing meaningful, omit it entirely
- Each resulting item should be a complete, clean sentence

Return JSON array with same structure: [{speaker, timestamp, text}]

Transcript:
${JSON.stringify(transcript)}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              speaker: { type: Type.STRING },
              timestamp: { type: Type.STRING },
              text: { type: Type.STRING },
            },
            required: ['speaker', 'timestamp', 'text'],
          },
        },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/condense-transcript]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/parse-tasks', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Extract a list of action items / tasks from the following spoken text. Each task should be short (5-10 words), clear, and actionable. Remove filler words. If multiple tasks are mentioned, return each as a separate item. Write tasks in the same language as the input (Russian or English).\n\nSpoken text: "${text}"\n\nReturn a JSON array of strings.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/parse-tasks]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/weekly-review', requireAuth, async (req, res) => {
  try {
    const { recordings } = req.body as {
      recordings: Array<{ title: string; summary: string; ideas?: string[]; actionItems?: string[]; tags?: string[] }>;
    };
    const ai = getAI();
    const context = recordings.map(r =>
      `— ${r.title}: ${r.summary}${r.ideas?.length ? `. Идеи: ${r.ideas.join(', ')}` : ''}${r.actionItems?.length ? `. Задачи: ${r.actionItems.join(', ')}` : ''}`
    ).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Ты персональный AI-ассистент. Пользователь делал голосовые записи на этой неделе:\n\n${context}\n\nПроанализируй и верни:\n1. mainTheme — главная тема недели (2-5 слов)\n2. themeSummary — что объединяет все записи недели (2-3 предложения, по-русски)\n3. insight — один конкретный вывод о паттерне мышления или продуктивности (1 предложение)`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mainTheme: { type: Type.STRING },
            themeSummary: { type: Type.STRING },
            insight: { type: Type.STRING },
          },
          required: ['mainTheme', 'themeSummary', 'insight'],
        },
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/weekly-review]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

export { router as aiRouter, buildTranscribePayload };
