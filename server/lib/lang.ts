// Язык вывода AI: на нём пишутся саммари, идеи, задачи, ответы поиска.
//
// Клиент передаёт только КОД языка из закрытого списка, а не кусок промпта —
// иначе эндпоинт снова превращается в открытый LLM-прокси (см. ROADMAP, раздел 6).
// Сам промпт по-прежнему целиком собирается на сервере.
//
// Язык РАСШИФРОВКИ этим не управляется: transcript.text всегда остаётся на языке,
// на котором реально говорили. Переводить речь мы не имеем права — это цитаты.

export type OutputLang = 'ru' | 'en';

const SUPPORTED: readonly string[] = ['ru', 'en'];

// По умолчанию русский — так продукт вёл себя до появления настройки,
// и смена дефолта не должна незаметно переключить существующего пользователя.
// ⚠️ Перед запуском на США дефолт меняем на 'en'.
const DEFAULT_LANG: OutputLang = 'ru';

/** Любое неизвестное значение сводим к дефолту — на вход приходит клиентский ввод. */
export function resolveLang(raw: unknown): OutputLang {
  return typeof raw === 'string' && SUPPORTED.includes(raw) ? (raw as OutputLang) : DEFAULT_LANG;
}

/** Название языка для подстановки в промпт. */
export function langName(lang: OutputLang): string {
  return lang === 'en' ? 'English' : 'Russian';
}

/** Жёсткая инструкция по языку — вставляется в промпты, где модель иначе уплывает. */
export function langRule(lang: OutputLang): string {
  return `Write ALL output text in ${langName(lang)} only. Do not mix languages.`;
}

/** Заглушка для пустого/беззвучного аудио — попадает в заголовок записи, поэтому переводится. */
export function silencePlaceholder(lang: OutputLang): string {
  return lang === 'en' ? '[Silence]' : '[Тишина]';
}
