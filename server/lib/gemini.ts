import { GoogleGenAI } from '@google/genai';

export function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey });
}

export async function uploadAudioToFileAPI(
  ai: GoogleGenAI,
  buffer: Buffer,
  mimeType: string,
): Promise<{ fileUri: string; fileMimeType: string }> {
  const fileBlob = new Blob([buffer], { type: mimeType });
  const uploaded = await ai.files.upload({
    file: fileBlob,
    config: { mimeType, displayName: 'recording' },
  });
  return { fileUri: uploaded.uri ?? '', fileMimeType: uploaded.mimeType ?? mimeType };
}

// Валидация knownPeople от клиента: только массив строк, максимум 50 элементов, до 100 символов каждая.
// Всё остальное (не-строки, лишние элементы, лишние символы) молча отбрасывается/обрезается.
export function sanitizeKnownPeople(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is string => typeof item === 'string')
    .slice(0, 50)
    .map(name => name.slice(0, 100));
}

export function buildTranscribePayload(knownPeople: string[] = []): { prompt: string; config: Record<string, unknown> } {
  const knownPeoplePrefix = knownPeople.length > 0
    ? `Known participants from previous recordings: ${knownPeople.join(', ')}. Use these names when identifying speakers. `
    : '';

  const prompt = knownPeoplePrefix +
    'Please analyze this personal audio note or voice journal. ' +
    'CRITICAL: If the audio is empty, silent, or contains no speech, return JSON with title \'[Тишина]\' and empty fields. ' +
    'LANGUAGE RULE: transcript.text must be in the EXACT language spoken. ALL other fields MUST be in Russian. ' +
    '1. Transcribe ALL speech verbatim, grouped by speaker turns. ' +
    'SPEAKER DIARIZATION: Listen for voice changes. Label as "Участник 1", "Участник 2" etc. Replace with actual name if heard. ' +
    'Each speaker change = new transcript item. Solo = "Я". ' +
    '2. Short Russian summary. 3. 3-5 key moments in Russian. 4. ALL action items in Russian. ' +
    '5. Creative ideas in Russian. 6. Mentions (names, tools, places). ' +
    '7. Open questions. 8. Map names to speaker labels. 9. Rich action items with assignee/deadline. ' +
    '10. Big strategic questions. Return JSON.';

  const config = {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        summary: { type: 'STRING' },
        keyMoments: { type: 'ARRAY', items: { type: 'STRING' } },
        actionItems: { type: 'ARRAY', items: { type: 'STRING' } },
        ideas: { type: 'ARRAY', items: { type: 'STRING' } },
        mentions: { type: 'ARRAY', items: { type: 'STRING' } },
        transcript: { type: 'ARRAY', items: { type: 'OBJECT', properties: { speaker: { type: 'STRING' }, timestamp: { type: 'STRING' }, text: { type: 'STRING' } } } },
        tags: { type: 'ARRAY', items: { type: 'STRING' } },
        openQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
        participants: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, speakerLabel: { type: 'STRING' }, role: { type: 'STRING' } } } },
        richActionItems: { type: 'ARRAY', items: { type: 'OBJECT', properties: { text: { type: 'STRING' }, assignee: { type: 'STRING' }, deadline: { type: 'STRING' } } } },
        bigQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['title', 'summary', 'transcript', 'actionItems', 'ideas', 'keyMoments', 'tags'],
    },
  };

  return { prompt, config };
}
