import type { Participant } from '../types';

/** Убирает ведущие решётки и пробелы: "#Карл Юнг" → "Карл Юнг" */
export const normalizeTag = (tag: string): string => tag.replace(/^#+/, '').trim();

/** Слово начинается с заглавной (кириллица или латиница) */
const startsCapital = (word: string): boolean => /^[А-ЯЁA-Z]/.test(word);

/**
 * Собирает названные сущности записи: mentions + участники.
 * Это не только люди — AI кладёт в mentions и компании с продуктами ("Elbrus", "Notion").
 * Всё в нижнем регистре — сравнение регистронезависимое.
 */
export const collectKnownEntities = (mentions?: string[], participants?: Participant[]): string[] => {
  const names: string[] = [];
  mentions?.forEach(m => { const n = normalizeTag(m).toLowerCase(); if (n) names.push(n); });
  participants?.forEach(p => { const n = normalizeTag(p.name).toLowerCase(); if (n) names.push(n); });
  return names;
};

/**
 * Тег указывает на конкретную сущность (человека, компанию, продукт), а не на тему?
 * Приоритет — совпадение с упоминаниями записи (тег "Пенроуз" ↔ упоминание "Роджер Пенроуз").
 * Если упоминаний нет вообще, работает запасная эвристика: несколько слов,
 * каждое с заглавной буквы ("Карл Юнг"). Одиночные слова в неё не попадают —
 * "Сознание" и "Пенроуз" неразличимы без контекста, и ошибиться в сторону темы дешевле.
 */
export const isEntityTag = (tag: string, knownEntities: string[]): boolean => {
  const clean = normalizeTag(tag).toLowerCase();
  if (!clean) return false;

  if (knownEntities.length > 0) {
    return knownEntities.some(name => {
      if (name === clean) return true;
      // Фамилия как отдельное слово внутри полного имени и наоборот
      const words = name.split(/\s+/);
      if (words.includes(clean)) return true;
      return clean.split(/\s+/).includes(name);
    });
  }

  const words = normalizeTag(tag).split(/\s+/);
  return words.length >= 2 && words.every(startsCapital);
};

export interface GroupedTags {
  topics: string[];
  entities: string[];
}

/** Делит теги на темы и упоминания, сохраняя исходный порядок внутри групп */
export const groupTags = (tags: string[], mentions?: string[], participants?: Participant[]): GroupedTags => {
  const known = collectKnownEntities(mentions, participants);
  const topics: string[] = [];
  const entities: string[] = [];
  tags.forEach(tag => (isEntityTag(tag, known) ? entities : topics).push(tag));
  return { topics, entities };
};
