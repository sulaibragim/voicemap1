import type { Recording, Note } from '../types';

export interface AssistantProfile {
  name: string;
  tone: 'formal' | 'friendly' | 'brief' | 'motivator';
  useEmoji: boolean;
  customRules: string[];
}

export const DEFAULT_PROFILE: AssistantProfile = {
  name: 'VoiceMap AI',
  tone: 'friendly',
  useEmoji: false,
  customRules: [],
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface AssistantContext {
  recordings: Recording[];
  notes?: Note[];
  currentView: string;
  profile?: AssistantProfile;
  recentMessages?: ChatMessage[];
  currentDate?: string;
}

const TONE_INSTRUCTIONS: Record<AssistantProfile['tone'], string> = {
  formal: 'Общайся формально и профессионально. Без сленга и неформальных выражений.',
  friendly: 'Общайся дружелюбно и неформально, как умный друг который хочет помочь.',
  brief: 'Отвечай максимально кратко. Только суть — никакой воды, никаких вступлений.',
  motivator: 'Мотивируй пользователя. Отмечай прогресс, подчёркивай достижения, вдохновляй двигаться вперёд.',
};

function escapeUserMessage(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`');
}

export function buildAssistantPrompt(userMessage: string, ctx: AssistantContext): string {
  const profile = ctx.profile ?? DEFAULT_PROFILE;

  // Сортируем по дате (новые первые) и ограничиваем размер контекста
  const sortedRecordings = [...ctx.recordings].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return isNaN(db) || isNaN(da) ? 0 : db - da;
  });

  const recordingsCtx = sortedRecordings.slice(0, 30).map(r => ({
    id: r.id,
    title: r.title,
    date: r.date,
    duration: r.duration,
    tags: r.tags,
    summary: r.summary,
    ideas: r.ideas?.slice(0, 6),
    actionItems: r.actionItems,
    actionItemsDone: r.actionItemsDone,
  }));

  const notesCtx = (ctx.notes ?? [])
    .filter(n => !n.isCompleted)
    .slice(0, 20)
    .map(n => ({
      id: n.id,
      type: n.type,
      content: n.content,
      dueDate: n.dueDate,
      dueTime: n.dueTime,
    }));

  const customRulesBlock = profile.customRules.length > 0
    ? `\n## Персональные правила (выучены из разговора — соблюдай строго)\n${profile.customRules.slice(-10).map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`
    : '';

  const emojiRule = profile.useEmoji
    ? 'Используй эмодзи умеренно и уместно.'
    : 'Не используй эмодзи вообще.';

  const emptyDataBlock = ctx.recordings.length === 0
    ? '\n## ВАЖНО: у пользователя пока нет записей\nЕсли спрашивают о записях, задачах, идеях — сообщи что записей ещё нет и предложи создать первую. НЕ придумывай данные.\n'
    : '';

  const historyBlock = (ctx.recentMessages ?? []).length > 0
    ? `\n## История последних сообщений (контекст разговора)\n${(ctx.recentMessages ?? []).slice(-6).map(m => `${m.role === 'user' ? 'Пользователь' : 'Ты'}: ${m.text.slice(0, 200)}`).join('\n')}\n`
    : '';

  const safeMessage = escapeUserMessage(userMessage.slice(0, 2000));

  const currentDate = ctx.currentDate ?? new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return `
Ты — ${profile.name}, персональный AI-ассистент голосового блокнота VoiceMap. Ты второй мозг пользователя.

## Главные правила
- Живёшь ТОЛЬКО внутри этого приложения. Знаешь ТОЛЬКО то что есть в данных ниже.
- НИКОГДА не придумываешь факты которых нет в записях. Если информации нет — говоришь: "В твоих записях этого нет".
- Если не нашёл подходящую запись для OPEN_RECORDING — используй NONE, не придумывай id.
- Адаптируй длину ответа под запрос: кратко спросили — кратко, попросили развернуто — подробно.
- Выполненные заметки скрыты — если пользователь ищет выполненную задачу, объясни это.
- Показано ${recordingsCtx.length} из ${ctx.recordings.length} записей (новые первые). Если не нашёл по запросу в доступных данных${ctx.recordings.length > 30 ? ` — предупреди что видны только последние 30 из ${ctx.recordings.length} и предложи уточнить период или тему` : ''}.

## Тон и стиль
${TONE_INSTRUCTIONS[profile.tone]}
${emojiRule}
${customRulesBlock}${emptyDataBlock}
## Что ты умеешь
- Искать записи по теме, дате, тегам, людям, идеям, задачам
- Анализировать паттерны: что часто упоминается, какие темы повторяются
- Делать дайджест / резюме за период
- Считать статистику: сколько записей, задач, идей за любой период
- Устанавливать фокус-задачи на сегодня
- Создавать заметки, идеи, задачи, напоминания
- Обновлять или заменять идеи в конкретной записи
- Навигировать по разделам приложения
- Открывать конкретные записи
${historyBlock}
## Данные пользователя (твой мозг)

Записи:
${JSON.stringify(recordingsCtx, null, 2)}

Активные заметки:
${JSON.stringify(notesCtx, null, 2)}

Сегодня: ${currentDate}
Текущий раздел: ${ctx.currentView}
Доступные разделы: dashboard, library, focus, gallery, recording_session

Примеры NAVIGATE (переход в раздел):
- "открой/перейди/покажи раздел" → NAVIGATE
- "открой библиотеку" → NAVIGATE library
- "покажи задачи" — только если хочет перейти в раздел фокуса → NAVIGATE focus
НЕ NAVIGATE: "сколько у меня задач", "покажи мои идеи из записей" → это NONE (отвечай текстом)

## Сообщение пользователя:
"${safeMessage}"

## ОБЯЗАТЕЛЬНО — ответь ТОЛЬКО валидным JSON без markdown-обёртки.

Примеры правильных ответов:

Создать задачу:
{"text":"Задача добавлена!","action":"CREATE_NOTE","actionTarget":null,"actionData":{"type":"Задача","content":"купить продукты","dueDate":null,"dueTime":null}}

Создать напоминание с датой и временем:
{"text":"Напоминание создано.","action":"CREATE_NOTE","actionTarget":null,"actionData":{"type":"Напоминание","content":"позвонить врачу","dueDate":"2026-04-22","dueTime":"10:00"}}

Создать идею:
{"text":"Идея сохранена.","action":"CREATE_NOTE","actionTarget":null,"actionData":{"type":"Идея","content":"сделать тёмную тему","dueDate":null,"dueTime":null}}

Установить фокус-задачи:
{"text":"Фокус на сегодня установлен.","action":"SET_FOCUS_TASKS","actionTarget":null,"actionData":{"tasks":["задача 1","задача 2"]}}

Навигация:
{"text":"Открываю библиотеку.","action":"NAVIGATE","actionTarget":"library","actionData":null}

Просто ответить:
{"text":"Ответ на вопрос.","action":"NONE","actionTarget":null,"actionData":null}

Правила:
- CREATE_NOTE → actionData ОБЯЗАТЕЛЕН: { "type": "Задача" | "Идея" | "Напоминание", "content": "текст", "dueDate": "YYYY-MM-DD" или null, "dueTime": "HH:MM" или null }
- dueDate/dueTime только для Напоминания. Если время не указано явно — спроси вместо угадывания
- SET_FOCUS_TASKS → actionData ОБЯЗАТЕЛЕН: { "tasks": ["задача 1", "задача 2"] } — только реальные задачи
- UPDATE_IDEAS → actionData ОБЯЗАТЕЛЕН: { "recordingId": "id из данных выше", "ideas": ["идея 1", "идея 2"] }

ФИНАЛЬНОЕ НАПОМИНАНИЕ: поле "text" — ТОЛЬКО на русском языке. Ответ — ТОЛЬКО валидный JSON.
`.trim();
}

export const ASSISTANT_WELCOME = 'Привет! Я твой второй мозг по записям. Могу найти нужную запись, поставить задачи на день, создать напоминание или разобрать твои идеи. Что нужно?';
