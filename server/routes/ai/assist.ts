// AI-помощники, которые ПОРОЖДАЮТ новый текст: совет дня, развитие идеи,
// дополнение записи, недельный дайджест.
// Аудио не трогают, поэтому лимит расшифровки здесь не проверяется.
import { Router } from 'express';
import { Type } from '@google/genai';
import { requireAuth } from '../../lib/auth';
import { getAI } from '../../lib/gemini';
import { resolveLang, langRule } from '../../lib/lang';

const router = Router();

router.post('/tip', requireAuth, async (req, res) => {
  try {
    const { context, lang } = req.body;
    const outputLang = resolveLang(lang);
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Based on the following recent recordings context, generate a short, personalized daily advice for the user to improve their productivity, communication, or well-being. Return JSON with 'title' (a short uppercase category word, e.g. 'PRODUCTIVITY') and 'text' (the advice itself, 1-2 sentences).\n\nIMPORTANT: ${langRule(outputLang)}\n\nContext:\n${context}`,
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

router.post('/develop-idea', requireAuth, async (req, res) => {
  try {
    const { idea, recordingTitle, lang } = req.body;
    const outputLang = resolveLang(lang);
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a sharp, insightful thinking partner. The user had this idea/insight from a voice recording titled "${recordingTitle}":

"${idea}"

Develop this idea in 3-5 sentences. Be specific, practical, and thought-provoking. Connect it to real applications or deeper implications. ${langRule(outputLang)} Don't open with "This idea..." — dive straight into the substance.`,
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error('[/ai/develop-idea]', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

router.post('/weekly-review', requireAuth, async (req, res) => {
  try {
    const { recordings, lang } = req.body as {
      recordings: Array<{ title: string; summary: string; ideas?: string[]; actionItems?: string[]; tags?: string[] }>;
      lang?: unknown;
    };
    const outputLang = resolveLang(lang);
    const ai = getAI();
    const context = recordings.map(r =>
      `— ${r.title}: ${r.summary}${r.ideas?.length ? `. Ideas: ${r.ideas.join(', ')}` : ''}${r.actionItems?.length ? `. Tasks: ${r.actionItems.join(', ')}` : ''}`
    ).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a personal AI assistant. Here are the user's voice recordings from this week:\n\n${context}\n\nAnalyse them and return:\n1. mainTheme — the main theme of the week (2-5 words)\n2. themeSummary — what ties the week's recordings together (2-3 sentences)\n3. insight — one concrete observation about their thinking or productivity pattern (1 sentence)\n\n${langRule(outputLang)}`,
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

export { router as assistRouter };
