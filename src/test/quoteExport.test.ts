import { describe, it, expect } from 'vitest';
import { buildQuoteText, buildQuoteRange, buildQuoteFileName, type QuoteFragment } from '../lib/quoteExport';

const META = { title: 'Планёрка по проекту', date: '23 июля' };

function fragment(speaker: string, timestamp: string, text: string): QuoteFragment {
  return { speaker, timestamp, text };
}

describe('buildQuoteText — одна реплика', () => {
  it('оформляет кавычками с атрибуцией: спикер, таймкод, источник', () => {
    const result = buildQuoteText([fragment('Иван Петров', '12:34', 'Цену до конца года не поднимаем.')], META);
    expect(result).toBe('«Цену до конца года не поднимаем.»\n\n— Иван Петров · 12:34 · Планёрка по проекту, 23 июля');
  });

  it('без таймкода (дополнение) не оставляет пустой разделитель', () => {
    const result = buildQuoteText([fragment('Я', '--:--', 'Мысль вдогонку.')], META);
    expect(result).toBe('«Мысль вдогонку.»\n\n— Я · Планёрка по проекту, 23 июля');
    expect(result).not.toContain('· ·');
  });
});

describe('buildQuoteText — несколько реплик', () => {
  it('оформляет диалогом с таймкодами и одним источником в конце', () => {
    const result = buildQuoteText([
      fragment('Иван Петров', '12:34', 'Цену не поднимаем.'),
      fragment('Я', '12:51', 'Тогда пересчитаем маржу.'),
    ], META);

    expect(result).toBe(
      'Иван Петров [12:34]: Цену не поднимаем.\n'
      + 'Я [12:51]: Тогда пересчитаем маржу.\n\n'
      + '— Планёрка по проекту, 23 июля',
    );
  });

  it('сохраняет порядок реплик, как в транскрипте', () => {
    const result = buildQuoteText([
      fragment('А', '01:00', 'первая'),
      fragment('Б', '02:00', 'вторая'),
      fragment('В', '03:00', 'третья'),
    ], META);
    expect(result.indexOf('первая')).toBeLessThan(result.indexOf('вторая'));
    expect(result.indexOf('вторая')).toBeLessThan(result.indexOf('третья'));
  });
});

describe('buildQuoteText — мусор в выделении', () => {
  it('схлопывает переносы и двойные пробелы, которые тащит выделение мышью', () => {
    const result = buildQuoteText([fragment('Я', '00:10', '  Текст\n  с   переносами  ')], META);
    expect(result).toContain('«Текст с переносами»');
  });

  it('выбрасывает реплики, от которых осталась только пустота', () => {
    const result = buildQuoteText([
      fragment('А', '01:00', '   '),
      fragment('Б', '02:00', 'настоящий текст'),
    ], META);
    // Осталась одна значимая реплика — значит формат одиночной цитаты, а не диалога
    expect(result).toBe('«настоящий текст»\n\n— Б · 02:00 · Планёрка по проекту, 23 июля');
  });

  it('пустое выделение даёт пустую строку — на это опирается UI', () => {
    expect(buildQuoteText([], META)).toBe('');
    expect(buildQuoteText([fragment('А', '01:00', '  ')], META)).toBe('');
  });

  it('без заголовка и даты не оставляет висящее тире', () => {
    const result = buildQuoteText(
      [fragment('А', '01:00', 'раз'), fragment('Б', '02:00', 'два')],
      { title: '', date: '' },
    );
    expect(result).toBe('А [01:00]: раз\nБ [02:00]: два');
  });
});

describe('buildQuoteRange', () => {
  it('одна реплика — один таймкод', () => {
    expect(buildQuoteRange([fragment('А', '12:34', 'текст')])).toBe('12:34');
  });

  it('несколько реплик — диапазон от первой до последней', () => {
    expect(buildQuoteRange([
      fragment('А', '12:34', 'раз'),
      fragment('Б', '13:10', 'два'),
      fragment('В', '14:02', 'три'),
    ])).toBe('12:34 — 14:02');
  });

  it('без таймкодов возвращает пустую строку', () => {
    expect(buildQuoteRange([fragment('Я', '--:--', 'текст')])).toBe('');
    expect(buildQuoteRange([])).toBe('');
  });
});

describe('buildQuoteFileName', () => {
  it('строит имя из заголовка записи', () => {
    expect(buildQuoteFileName(META)).toBe('Планёрка по проекту — цитата.txt');
  });

  it('вырезает символы, запрещённые в именах файлов, но оставляет пробелы', () => {
    expect(buildQuoteFileName({ title: 'Интервью: Пётр / "Икс" *важно*', date: '' }))
      .toBe('Интервью Пётр  Икс важно — цитата.txt');
  });

  it('пустой или мусорный заголовок заменяет на «Запись»', () => {
    expect(buildQuoteFileName({ title: '', date: '' })).toBe('Запись — цитата.txt');
    expect(buildQuoteFileName({ title: '///', date: '' })).toBe('Запись — цитата.txt');
  });

  it('не оставляет имя, оканчивающееся точкой — Windows такое не сохраняет', () => {
    expect(buildQuoteFileName({ title: 'Планёрка...', date: '' })).toBe('Планёрка — цитата.txt');
  });

  it('обрезает слишком длинный заголовок', () => {
    const long = 'а'.repeat(200);
    const name = buildQuoteFileName({ title: long, date: '' });
    expect(name.length).toBeLessThan(long.length);
    expect(name.endsWith(' — цитата.txt')).toBe(true);
  });
});
