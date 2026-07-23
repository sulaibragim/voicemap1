import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ru, type TKey } from './ru';
import { en } from './en';

// Свой мини-i18n вместо react-i18next: языка два, ключей несколько сотен,
// а библиотека утянула бы в бандл десятки килобайт ради того же самого.
// Проект держит бандл маленьким (см. ROADMAP), поэтому обходимся словарём.

export type Lang = 'ru' | 'en';

const DICTIONARIES: Record<Lang, Record<TKey, string>> = { ru, en };

// Язык дублируется в localStorage: настройки пользователя лежат в Firestore и
// доступны только после входа, а экран входа надо показать на правильном языке уже сейчас.
const STORAGE_KEY = 'voicemap_lang';

export function readStoredLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ru';
  } catch {
    return 'ru';
  }
}

export function storeLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Приватный режим или заблокированное хранилище — не критично, язык возьмётся из настроек
  }
}

export type TranslateVars = Record<string, string | number>;

/** Подставляет {name} значениями. Отсутствующий ключ оставляем как есть — заметно в интерфейсе. */
function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function translate(lang: Lang, key: TKey, vars?: TranslateVars): string {
  // Фолбэк на русский: если английский словарь по какой-то причине неполон
  // в рантайме (например, устаревший кэш), лучше показать русский, чем ключ.
  const template = DICTIONARIES[lang]?.[key] ?? ru[key] ?? key;
  return interpolate(template, vars);
}

export type TranslateFn = (key: TKey, vars?: TranslateVars) => string;

interface LangContextValue {
  lang: Lang;
  t: TranslateFn;
}

const LangContext = createContext<LangContextValue>({
  lang: 'ru',
  t: (key, vars) => translate('ru', key, vars),
});

export const LangProvider = ({ lang, children }: { lang: Lang; children: ReactNode }) => {
  const value = useMemo<LangContextValue>(() => ({
    lang,
    t: (key, vars) => translate(lang, key, vars),
  }), [lang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
};

/** Хук перевода. `const t = useT()` → `t('nav.library')`. */
export function useT(): TranslateFn {
  return useContext(LangContext).t;
}

/** Текущий язык — нужен там, где формат зависит от языка, а не только строка. */
export function useLang(): Lang {
  return useContext(LangContext).lang;
}

export type { TKey };
