// Учёт и лимиты расшифровки.
//
// Считаем секунды аудио, отправленные в Gemini, по каждому пользователю за
// календарный месяц (UTC). Документ: users/{uid}/usage/{YYYY-MM}.
// Пишет его ТОЛЬКО сервер через Admin SDK; клиенту он доступен на чтение
// (см. firestore.rules) — иначе лимит обходился бы правкой документа.
//
// Тариф пользователя лежит в users/{uid}.plan. Отсутствует → 'free'.
// Безлимитных тарифов нет намеренно: добавлять лимит после запуска больно.

import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export const SECONDS_PER_MINUTE = 60;

export type PlanId = 'free' | 'pro' | 'team';

const PLAN_IDS: readonly string[] = ['free', 'pro', 'team'];

// Значения по умолчанию в минутах в месяц. Каждое переопределяется переменной
// окружения (PLAN_FREE_MINUTES, PLAN_PRO_MINUTES, PLAN_TEAM_MINUTES), чтобы
// менять лимиты на Railway без пересборки.
const DEFAULT_MINUTES: Record<PlanId, number> = {
  free: 120,   // 2 часа — бесплатная бета
  pro: 1200,   // 20 часов — тариф $15/мес (себестоимость ≈ $2.80, маржа ~81%)
  team: 3600,  // 60 часов
};

// Gemini тарифицирует аудио по фиксированной ставке токенов за секунду.
// Ставку держим в env на случай изменения тарификации.
const DEFAULT_AUDIO_TOKENS_PER_SEC = 32;

export interface UsageSnapshot {
  plan: PlanId;
  /** Календарный месяц в UTC, формат YYYY-MM */
  month: string;
  usedSeconds: number;
  limitSeconds: number;
  remainingSeconds: number;
}

/** Бросается ДО обращения к Gemini, когда лимит месяца уже выбран. */
export class QuotaExceededError extends Error {
  readonly usage: UsageSnapshot;

  constructor(usage: UsageSnapshot) {
    super('Transcription quota exceeded');
    this.name = 'QuotaExceededError';
    this.usage = usage;
  }
}

// ── Чистые хелперы (без Firestore, покрыты тестами) ─────────────────────────

/** Ключ месяца в UTC: '2026-07'. UTC, а не локаль сервера — иначе ключ поедет при смене региона Railway. */
export function monthKey(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Любое неизвестное/битое значение тарифа трактуем как самый строгий — 'free'. */
export function resolvePlan(raw: unknown): PlanId {
  return typeof raw === 'string' && PLAN_IDS.includes(raw) ? (raw as PlanId) : 'free';
}

/** Лимит тарифа в секундах. Читает env лениво: dotenv.config() выполняется после импортов. */
export function planLimitSeconds(plan: PlanId): number {
  const parsed = Number(process.env[`PLAN_${plan.toUpperCase()}_MINUTES`]);
  const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MINUTES[plan];
  return Math.round(minutes * SECONDS_PER_MINUTE);
}

/** Длительность вида '12:34' или '1:02:33' → секунды. Всё непонятное → 0. */
export function parseDurationToSeconds(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
  if (typeof raw !== 'string') return 0;

  const parts = raw.trim().split(':');
  if (parts.length < 2 || parts.length > 3) return 0;

  const nums = parts.map(Number);
  if (nums.some(n => !Number.isFinite(n) || n < 0)) return 0;

  const seconds = nums.length === 3
    ? nums[0] * 3600 + nums[1] * 60 + nums[2]
    : nums[0] * 60 + nums[1];
  return Math.round(seconds);
}

/**
 * Фактические секунды аудио из usageMetadata ответа Gemini.
 * Предпочитаем разбивку по модальностям (там чистое аудио без текста промпта);
 * если её нет — берём весь promptTokenCount, это даёт небольшой запас в большую сторону.
 */
export function audioSecondsFromUsage(meta: unknown): number {
  if (typeof meta !== 'object' || meta === null) return 0;
  const record = meta as Record<string, unknown>;

  const parsedRate = Number(process.env.GEMINI_AUDIO_TOKENS_PER_SEC);
  const tokensPerSec = Number.isFinite(parsedRate) && parsedRate > 0
    ? parsedRate
    : DEFAULT_AUDIO_TOKENS_PER_SEC;

  const details = record.promptTokensDetails;
  if (Array.isArray(details)) {
    for (const item of details) {
      if (typeof item !== 'object' || item === null) continue;
      const entry = item as Record<string, unknown>;
      const isAudio = typeof entry.modality === 'string' && entry.modality.toUpperCase() === 'AUDIO';
      if (isAudio && typeof entry.tokenCount === 'number' && Number.isFinite(entry.tokenCount)) {
        return Math.max(0, Math.round(entry.tokenCount / tokensPerSec));
      }
    }
  }

  const total = record.promptTokenCount;
  if (typeof total === 'number' && Number.isFinite(total) && total > 0) {
    return Math.round(total / tokensPerSec);
  }
  return 0;
}

/**
 * Сколько секунд списать. Клиент может занизить длительность, счётчик токенов — нет,
 * поэтому берём максимум: у честного клиента числа почти совпадают, у нечестного
 * побеждает серверное.
 */
export function billableSeconds(clientSeconds: number, tokenSeconds: number): number {
  const client = Number.isFinite(clientSeconds) && clientSeconds > 0 ? clientSeconds : 0;
  const token = Number.isFinite(tokenSeconds) && tokenSeconds > 0 ? tokenSeconds : 0;
  return Math.round(Math.max(client, token));
}

// ── Работа с Firestore ──────────────────────────────────────────────────────

function usageDocRef(uid: string, month: string) {
  return getFirestore().collection('users').doc(uid).collection('usage').doc(month);
}

/** Текущее состояние расхода пользователя за месяц. */
export async function getUsage(uid: string, now: Date = new Date()): Promise<UsageSnapshot> {
  const db = getFirestore();
  const month = monthKey(now);

  const [profileSnap, usageSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    usageDocRef(uid, month).get(),
  ]);

  const plan = resolvePlan(profileSnap.data()?.plan);
  const limitSeconds = planLimitSeconds(plan);

  const rawSeconds = usageSnap.data()?.seconds;
  const usedSeconds = typeof rawSeconds === 'number' && Number.isFinite(rawSeconds) && rawSeconds > 0
    ? Math.round(rawSeconds)
    : 0;

  return {
    plan,
    month,
    usedSeconds,
    limitSeconds,
    remainingSeconds: Math.max(0, limitSeconds - usedSeconds),
  };
}

/**
 * Предпроверка ПЕРЕД обращением к Gemini — чтобы не платить за запрос, который
 * всё равно за лимитом. estimatedSeconds — заявленная клиентом длительность;
 * ноль означает «неизвестна», тогда проверяем только остаток.
 *
 * Гонка возможна: две одновременные расшифровки могут пройти проверку и вместе
 * перебрать лимит. Осознанно: перебор ограничен длиной записи, а блокировка
 * ради этого стоила бы транзакции на каждый запрос.
 */
export async function assertQuota(uid: string, estimatedSeconds = 0): Promise<UsageSnapshot> {
  const usage = await getUsage(uid);
  const needed = Number.isFinite(estimatedSeconds) && estimatedSeconds > 0 ? estimatedSeconds : 0;

  if (usage.remainingSeconds <= 0 || needed > usage.remainingSeconds) {
    throw new QuotaExceededError(usage);
  }
  return usage;
}

/** Списание фактического расхода. Инкремент атомарный — параллельные расшифровки не затирают друг друга. */
export async function recordUsage(uid: string, seconds: number): Promise<void> {
  const billed = Math.round(seconds);
  if (!Number.isFinite(billed) || billed <= 0) return;

  const month = monthKey();
  await usageDocRef(uid, month).set({
    month,
    seconds: FieldValue.increment(billed),
    requests: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}
