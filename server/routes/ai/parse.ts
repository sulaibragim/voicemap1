// AI-помощники, которые СТРУКТУРИРУЮТ уже сказанное: время напоминания из
// фразы, список задач из речи, сжатие транскрипта до сути.
// Общее у них — на выходе строгая схема, а не свободный текст.
import { Router } from 'express';
import { Type } from '@google/genai';
import { requireAuth } from '../../lib/auth';
import { getAI } from '../../lib/gemini';

const router = Router();

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

export { router as parseRouter };
