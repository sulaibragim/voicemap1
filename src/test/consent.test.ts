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
    expect(formatConsentStates(['Калифорния', 'Флорида', 'Иллинойс', 'Мэриленд']))
      .toBe('Калифорния, Флорида, Иллинойс и другие');
  });

  it('короткий список перечисляет целиком, без «и другие»', () => {
    expect(formatConsentStates(['Калифорния', 'Флорида'])).toBe('Калифорния, Флорида');
  });

  it('уважает заданное число видимых штатов', () => {
    expect(formatConsentStates(['А', 'Б', 'В', 'Г'], 2)).toBe('А, Б и другие');
  });

  it('пустой список не оставляет висящий хвост', () => {
    expect(formatConsentStates([])).toBe('');
    expect(formatConsentStates(['  ', ''])).toBe('');
  });

  it('по умолчанию берёт реальный список штатов', () => {
    const result = formatConsentStates();
    expect(result).toContain('Калифорния');
    expect(result).toContain('и другие');
    expect(ALL_PARTY_CONSENT_STATES.length).toBeGreaterThan(3);
  });
});
