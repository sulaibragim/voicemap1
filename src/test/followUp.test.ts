import { describe, it, expect } from 'vitest';
import { collectFollowUps, parseDeadline, formatAge, formatDeadline } from '../lib/followUp';
import type { Recording } from '../types';

const NOW = new Date(2026, 6, 23, 12, 0, 0); // 23 июля 2026, полдень

function rec(patch: Partial<Recording> & { id: string; date: string }): Recording {
  return {
    title: 'Планёрка',
    duration: '10:00',
    tags: [],
    summary: '',
    transcript: [],
    ...patch,
  } as Recording;
}

describe('collectFollowUps — что попадает в долги', () => {
  it('берёт невыполненные задачи из старых записей', () => {
    const items = collectFollowUps([
      rec({ id: 'r1', date: '10 июля 2026', actionItems: ['позвонить инвестору'] }),
    ], NOW);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ recordingId: 'r1', taskIndex: 0, text: 'позвонить инвестору', ageDays: 13 });
  });

  it('не трогает свежие обещания — данное сегодня ещё не долг', () => {
    const items = collectFollowUps([
      rec({ id: 'r1', date: '22 июля 2026', actionItems: ['починить билд'] }),
    ], NOW);
    expect(items).toHaveLength(0);
  });

  it('выполненные задачи не показывает', () => {
    const items = collectFollowUps([
      rec({
        id: 'r1', date: '1 июля 2026',
        actionItems: ['сделано', 'не сделано'],
        actionItemsDone: [true, false],
      }),
    ], NOW);

    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('не сделано');
    expect(items[0].taskIndex).toBe(1);
  });

  it('пропускает записи с неразобранной датой — без возраста «протухло ли» не решить', () => {
    const items = collectFollowUps([
      rec({ id: 'r1', date: 'какая-то ерунда', actionItems: ['задача'] }),
    ], NOW);
    expect(items).toHaveLength(0);
  });

  it('пустые задачи и записи без задач игнорирует', () => {
    const items = collectFollowUps([
      rec({ id: 'r1', date: '1 июля 2026', actionItems: ['   ', ''] }),
      rec({ id: 'r2', date: '1 июля 2026' }),
    ], NOW);
    expect(items).toHaveLength(0);
  });
});

describe('collectFollowUps — просроченный дедлайн', () => {
  it('свежая задача с прошедшим дедлайном всё равно долг', () => {
    // Запись вчерашняя (моложе порога), но обещано было на позавчера
    const items = collectFollowUps([
      rec({
        id: 'r1', date: '22 июля 2026',
        actionItems: ['отправить договор'],
        richActionItems: [{ text: 'отправить договор', deadline: '21 июля 2026' }],
      }),
    ], NOW);

    expect(items).toHaveLength(1);
    expect(items[0].isOverdue).toBe(true);
  });

  it('дедлайн сегодня ещё не просрочен — считается до конца дня', () => {
    const items = collectFollowUps([
      rec({
        id: 'r1', date: '1 июля 2026',
        actionItems: ['задача'],
        richActionItems: [{ text: 'задача', deadline: 'сегодня' }],
      }),
    ], NOW);

    expect(items[0].isOverdue).toBe(false);
  });

  it('просроченные идут первыми, потом самые старые', () => {
    const items = collectFollowUps([
      rec({ id: 'old', date: '1 июня 2026', actionItems: ['очень старая'] }),
      rec({ id: 'mid', date: '10 июля 2026', actionItems: ['средняя'] }),
      rec({
        id: 'late', date: '20 июля 2026',
        actionItems: ['просроченная'],
        richActionItems: [{ text: 'просроченная', deadline: '21 июля 2026' }],
      }),
    ], NOW);

    expect(items.map(i => i.text)).toEqual(['просроченная', 'очень старая', 'средняя']);
  });
});

describe('collectFollowUps — ответственные и лимит', () => {
  it('подтягивает ответственных из assignees', () => {
    const items = collectFollowUps([
      rec({
        id: 'r1', date: '1 июля 2026',
        actionItems: ['подготовить смету'],
        richActionItems: [{ text: 'подготовить смету', assignees: ['Максим', 'Алина'] }],
      }),
    ], NOW);

    expect(items[0].assignees).toEqual(['Максим', 'Алина']);
  });

  it('понимает старое одиночное поле assignee', () => {
    const items = collectFollowUps([
      rec({
        id: 'r1', date: '1 июля 2026',
        actionItems: ['задача'],
        richActionItems: [{ text: 'задача', assignee: 'Пётр' }],
      }),
    ], NOW);

    expect(items[0].assignees).toEqual(['Пётр']);
  });

  it('rich-версия ищется по тексту, а не по индексу — порядок массивов не совпадает', () => {
    const items = collectFollowUps([
      rec({
        id: 'r1', date: '1 июля 2026',
        actionItems: ['первая', 'вторая'],
        richActionItems: [{ text: 'вторая', assignee: 'Максим' }],
      }),
    ], NOW);

    const second = items.find(i => i.text === 'вторая');
    expect(second?.assignees).toEqual(['Максим']);
    expect(items.find(i => i.text === 'первая')?.assignees).toEqual([]);
  });

  it('режет выдачу по лимиту', () => {
    const items = collectFollowUps([
      rec({ id: 'r1', date: '1 июля 2026', actionItems: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }),
    ], NOW, { limit: 3 });
    expect(items).toHaveLength(3);
  });
});

describe('parseDeadline', () => {
  it('понимает «сегодня» и «завтра» как конец дня', () => {
    const today = parseDeadline('сегодня', NOW);
    expect(today?.getDate()).toBe(23);
    expect(today?.getHours()).toBe(23);

    expect(parseDeadline('завтра', NOW)?.getDate()).toBe(24);
  });

  it('разбирает русские даты', () => {
    const d = parseDeadline('30 июля 2026', NOW);
    expect(d?.getDate()).toBe(30);
    expect(d?.getMonth()).toBe(6);
  });

  it('ISO-дату читает как локальную, а не UTC — иначе срок съезжает на сутки', () => {
    // new Date('2026-04-27') — это UTC-полночь, западнее Гринвича уже 26-е.
    // Поэтому разбираем вручную: день обязан остаться 27-м в любом часовом поясе.
    const d = parseDeadline('2026-04-27', NOW);
    expect(d?.getDate()).toBe(27);
    expect(d?.getMonth()).toBe(3);
    expect(d?.getFullYear()).toBe(2026);
  });

  it('свободный текст не выдумывает', () => {
    expect(parseDeadline('когда-нибудь потом', NOW)).toBeUndefined();
    expect(parseDeadline(undefined, NOW)).toBeUndefined();
    expect(parseDeadline('   ', NOW)).toBeUndefined();
  });
});

describe('formatDeadline', () => {
  it('превращает ISO-дату в человеческую', () => {
    expect(formatDeadline('2026-04-27', NOW)).toBe('27 апреля');
  });

  it('для другого года дописывает год', () => {
    expect(formatDeadline('2025-12-01', NOW)).toBe('1 декабря 2025');
  });

  it('неразобранный текст показывает как есть — дату сочинять нельзя', () => {
    expect(formatDeadline('на следующей неделе', NOW)).toBe('на следующей неделе');
  });

  it('пустой дедлайн даёт пустую строку', () => {
    expect(formatDeadline(undefined, NOW)).toBe('');
    expect(formatDeadline('   ', NOW)).toBe('');
  });
});

describe('formatAge', () => {
  it('склоняет дни по-русски', () => {
    expect(formatAge(0)).toBe('сегодня');
    expect(formatAge(1)).toBe('вчера');
    expect(formatAge(2)).toBe('2 дня назад');
    expect(formatAge(5)).toBe('5 дней назад');
  });

  it('склоняет недели и месяцы', () => {
    expect(formatAge(7)).toBe('неделю назад');
    expect(formatAge(14)).toBe('2 недели назад');
    expect(formatAge(28)).toBe('4 недели назад');
    expect(formatAge(70)).toBe('2 месяца назад');
  });
});
