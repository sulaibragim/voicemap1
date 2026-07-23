import { describe, it, expect } from 'vitest';
import { normalizeTag, groupTags, isEntityTag, collectKnownEntities } from '../lib/tagUtils';

describe('normalizeTag', () => {
  it('убирает решётки и пробелы', () => {
    expect(normalizeTag('#Квантовая физика')).toBe('Квантовая физика');
    expect(normalizeTag('##Сознание ')).toBe('Сознание');
    expect(normalizeTag('Время')).toBe('Время');
  });
});

describe('collectKnownEntities', () => {
  it('складывает mentions и участников в нижнем регистре', () => {
    const result = collectKnownEntities(['#Дмитрий', 'Elbrus'], [{ name: 'Максим', speakerLabel: 'Участник 1' }]);
    expect(result).toEqual(['дмитрий', 'elbrus', 'максим']);
  });
});

describe('isEntityTag', () => {
  const known = ['роджер пенроуз', 'notion'];

  it('узнаёт тег по полному совпадению с упоминанием', () => {
    expect(isEntityTag('#Notion', known)).toBe(true);
  });

  it('узнаёт фамилию внутри полного имени', () => {
    expect(isEntityTag('Пенроуз', known)).toBe(true);
  });

  it('узнаёт полное имя, когда упомянута только его часть', () => {
    expect(isEntityTag('Роджер Пенроуз', ['пенроуз'])).toBe(true);
  });

  it('не считает сущностью обычную тему', () => {
    expect(isEntityTag('Квантовая физика', known)).toBe(false);
  });

  it('без упоминаний падает на эвристику «каждое слово с заглавной»', () => {
    expect(isEntityTag('Карл Юнг', [])).toBe(true);
    expect(isEntityTag('Квантовая физика', [])).toBe(false);
    // Одиночные слова не разобрать без контекста — уходят в темы
    expect(isEntityTag('Пенроуз', [])).toBe(false);
  });
});

describe('groupTags', () => {
  it('делит теги на темы и упоминания, сохраняя порядок', () => {
    const { topics, entities } = groupTags(
      ['Стартап', 'Дмитрий', 'Инвестиции', 'Notion'],
      ['Дмитрий', 'Elbrus', 'Notion'],
    );
    expect(topics).toEqual(['Стартап', 'Инвестиции']);
    expect(entities).toEqual(['Дмитрий', 'Notion']);
  });

  it('без упоминаний и участников всё уходит в темы, кроме имён из двух слов', () => {
    const { topics, entities } = groupTags(['Сознание', 'Карл Юнг', 'Личностный рост']);
    expect(topics).toEqual(['Сознание', 'Личностный рост']);
    expect(entities).toEqual(['Карл Юнг']);
  });

  it('пустой список тегов не ломает группировку', () => {
    expect(groupTags([], ['Максим'])).toEqual({ topics: [], entities: [] });
  });
});
