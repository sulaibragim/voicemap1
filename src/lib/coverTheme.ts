// ─── Обложки записей ────────────────────────────────────────────────────────
// Шесть статичных текстур в палитре проекта лежат в public/covers/.
// Запись получает обложку по хешу своего id — детерминированно, поэтому
// одна и та же запись всегда выглядит одинаково на всех экранах и устройствах.
// Генерации в рантайме нет: файлы разовые, стоимость фиксированная.

export const COVERS = [
  '/covers/cover-1.jpg',
  '/covers/cover-2.jpg',
  '/covers/cover-3.jpg',
  '/covers/cover-4.jpg',
  '/covers/cover-5.jpg',
  '/covers/cover-6.jpg',
] as const;

/** FNV-1a — короткий стабильный хеш строки. Нужен только для равномерной раздачи обложек */
const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** Обложка записи по её id. Пустой id — первая текстура, чтобы не падать на черновиках */
export const getCoverForId = (id: string | undefined): string =>
  COVERS[id ? hashString(id) % COVERS.length : 0];
