// Предупреждение о согласии на запись разговора.
//
// ЭТО НЕ ЮРИДИЧЕСКАЯ КОНСУЛЬТАЦИЯ. Цель — не покрыть все юрисдикции, а не дать
// пользователю случайно нарушить закон и привить безопасную привычку: объявлять
// о записи вслух в начале разговора. Она работает в любой юрисдикции.

import type { Lang } from '../i18n';

/**
 * Штаты США, где по общему правилу требуется согласие ВСЕХ участников разговора,
 * а не только записывающего. Список неполный и меняется — он нужен, чтобы
 * предупреждение звучало конкретно, а не как формальная отписка.
 */
export const ALL_PARTY_CONSENT_STATES: Record<Lang, string[]> = {
  ru: ['Калифорния', 'Флорида', 'Иллинойс', 'Мэриленд', 'Массачусетс', 'Пенсильвания', 'Вашингтон'],
  en: ['California', 'Florida', 'Illinois', 'Maryland', 'Massachusetts', 'Pennsylvania', 'Washington'],
};

/** Показывать ли предупреждение: пока пользователь его не подтвердил. */
export function needsConsentNotice(acknowledgedAt?: string): boolean {
  return typeof acknowledgedAt !== 'string' || acknowledgedAt.trim().length === 0;
}

/**
 * «Калифорния, Флорида, Иллинойс и другие» — короткая строка для интерфейса.
 * Хвост списка сворачивается, чтобы предупреждение не превращалось в справочник.
 */
export function formatConsentStates(lang: Lang = 'ru', visible = 3, states?: string[]): string {
  const source = states ?? ALL_PARTY_CONSENT_STATES[lang] ?? ALL_PARTY_CONSENT_STATES.ru;
  const clean = source.map(state => state.trim()).filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length <= visible) return clean.join(', ');
  const andOthers = lang === 'en' ? 'and others' : 'и другие';
  return `${clean.slice(0, visible).join(', ')} ${andOthers}`;
}
