// Русское склонение существительных по числу.
// forms = [одна, две, пять], например ['запись', 'записи', 'записей'].

/**
 * Возвращает нужную форму существительного для числа n.
 * Классическая формула по остаткам от деления на 100 и 10.
 * @param n количество (может быть отрицательным)
 * @param forms три формы: [для 1, для 2–4, для 5–20]
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const lastDigit = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (lastDigit > 1 && lastDigit < 5) return forms[1];
  if (lastDigit === 1) return forms[0];
  return forms[2];
}

/**
 * То же, что plural, но возвращает число вместе со словом: `${n} ${форма}`.
 * @param n количество
 * @param forms три формы: [для 1, для 2–4, для 5–20]
 */
export function pluralWithNumber(n: number, forms: [string, string, string]): string {
  return `${n} ${plural(n, forms)}`;
}
