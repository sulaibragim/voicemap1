import { describe, it, expect } from 'vitest';
import { needsConsentNotice, formatConsentStates, ALL_PARTY_CONSENT_STATES } from '../lib/consent';

describe('needsConsentNotice', () => {
  it('показывает предупреждение, пока пользователь его не подтвердил', () => {
    expect(needsConsentNotice(undefined)).toBe(true);
    expect(needsConsentNotice('')).toBe(true);
    expect(needsConsentNotice('   ')).toBe(true);
  });

  it('после подтверждения больше не показывает', () => {
    expect(needsConsentNotice('2026-07-23T14:30:00.000Z')).toBe(false);
  });
});

describe('formatConsentStates', () => {
  it('сворачивает длинный список — предупреждение не должно быть справочником', () => {
    expect(formatConsentStates('ru', 3, ['Калифорния', 'Флорида', 'Иллинойс', 'Мэриленд']))
      .toBe('Калифорния, Флорида, Иллинойс и другие');
  });

  it('короткий список перечисляет целиком, без «и другие»', () => {
    expect(formatConsentStates('ru', 3, ['Калифорния', 'Флорида'])).toBe('Калифорния, Флорида');
  });

  it('уважает заданное число видимых штатов', () => {
    expect(formatConsentStates('ru', 2, ['А', 'Б', 'В', 'Г'])).toBe('А, Б и другие');
  });

  it('пустой список не оставляет висящий хвост', () => {
    expect(formatConsentStates('ru', 3, [])).toBe('');
    expect(formatConsentStates('ru', 3, ['  ', ''])).toBe('');
  });

  it('по умолчанию берёт русский список штатов', () => {
    const result = formatConsentStates();
    expect(result).toContain('Калифорния');
    expect(result).toContain('и другие');
    expect(ALL_PARTY_CONSENT_STATES.ru.length).toBeGreaterThan(3);
  });

  it('на английском отдаёт английские названия штатов', () => {
    const result = formatConsentStates('en');
    expect(result).toBe('California, Florida, Illinois and others');
    expect(result).not.toMatch(/[а-яА-Я]/);
  });
});
