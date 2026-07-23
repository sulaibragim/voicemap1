import { describe, it, expect } from 'vitest';
import { plural, pluralWithNumber } from '../lib/plural';

const REC: [string, string, string] = ['запись', 'записи', 'записей'];

// ─── plural ───────────────────────────────────────────────────────────────

describe('plural', () => {
  it('1 → форма для одного (запись)', () => {
    expect(plural(1, REC)).toBe('запись');
  });

  it('2, 3, 4 → форма для нескольких (записи)', () => {
    expect(plural(2, REC)).toBe('записи');
    expect(plural(3, REC)).toBe('записи');
    expect(plural(4, REC)).toBe('записи');
  });

  it('5–20 → форма для многих (записей)', () => {
    expect(plural(5, REC)).toBe('записей');
    expect(plural(11, REC)).toBe('записей');
    expect(plural(19, REC)).toBe('записей');
    expect(plural(20, REC)).toBe('записей');
  });

  it('0 → форма для многих (записей)', () => {
    expect(plural(0, REC)).toBe('записей');
  });

  it('21 → запись (проверка бага «21 записей»)', () => {
    expect(plural(21, REC)).toBe('запись');
  });

  it('22, 23, 24 → записи', () => {
    expect(plural(22, REC)).toBe('записи');
    expect(plural(24, REC)).toBe('записи');
  });

  it('25 → записей', () => {
    expect(plural(25, REC)).toBe('записей');
  });

  it('исключение 11–14 → всегда записей', () => {
    expect(plural(11, REC)).toBe('записей');
    expect(plural(12, REC)).toBe('записей');
    expect(plural(13, REC)).toBe('записей');
    expect(plural(14, REC)).toBe('записей');
    expect(plural(111, REC)).toBe('записей');
    expect(plural(112, REC)).toBe('записей');
  });

  it('101 → запись, 102 → записи', () => {
    expect(plural(101, REC)).toBe('запись');
    expect(plural(102, REC)).toBe('записи');
  });

  it('корректно работает с отрицательными', () => {
    expect(plural(-1, REC)).toBe('запись');
    expect(plural(-5, REC)).toBe('записей');
  });
});

// ─── pluralWithNumber ───────────────────────────────────────────────────────

describe('pluralWithNumber', () => {
  it('добавляет число перед словом', () => {
    expect(pluralWithNumber(1, REC)).toBe('1 запись');
    expect(pluralWithNumber(3, REC)).toBe('3 записи');
    expect(pluralWithNumber(21, REC)).toBe('21 запись');
    expect(pluralWithNumber(5, REC)).toBe('5 записей');
  });
});
