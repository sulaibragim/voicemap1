/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Brain, Loader2 } from 'lucide-react';
import { fetchDailyTip, transcribeRecording, retranscribeFromUrl, uploadAudioToR2, deleteAudioFromR2 } from './lib/api';

import type { Note, NoteType, Recording, Space, AppSettings } from './types';
import { defaultAppSettings } from './types';
import { useReminders } from './hooks/useReminders';
import { usePeople } from './lib/usePeople';
import { useAuth } from './hooks/useAuth';
import { useFirestoreData } from './hooks/useFirestoreData';
import { LoginScreen } from './components/auth/LoginScreen';

import { Header } from './components/layout/Header';
import { BottomNav } from './components/layout/BottomNav';

import { LiveSessionCard } from './components/dashboard/LiveSessionCard';
import { QuickNoteCard } from './components/dashboard/QuickNoteCard';
import { FocusTodayCard } from './components/dashboard/FocusTodayCard';
import { IdeasCard } from './components/dashboard/IdeasCard';
import { AITipCard } from './components/dashboard/AITipCard';
import { ActivityChartCard } from './components/dashboard/ActivityChartCard';
import { BrainStatsCard } from './components/dashboard/WeeklyGoalsCard';
import { WeeklyDigestCard } from './components/dashboard/WeeklyDigestCard';
import { RecentRecordings } from './components/dashboard/RecentRecordings';

import { NotesGallery } from './components/notes/NotesGallery';
import { QuickNoteModal } from './components/notes/QuickNoteModal';

import { RecordingsLibrary } from './components/recording/RecordingsLibrary';
import { LibraryMap } from './components/recording/LibraryMap';
import { SpacesLibrary } from './components/recording/SpacesLibrary';
import { SpacePickerModal } from './components/recording/SpacePickerModal';
import { RecordingSession } from './components/recording/RecordingSession';
import { RecordingDetail } from './components/recording/RecordingDetail';

import { AnalyticsView } from './components/analytics/AnalyticsView';
import { FocusView } from './components/analytics/FocusView';
import { TagsView } from './components/analytics/TagsView';
import { SettingsView } from './components/analytics/SettingsView';
import { RemindersView } from './components/reminders/RemindersView';

import { ChatSidebar } from './components/ChatSidebar';

// Mock initial data
const initialRecordings: Recording[] = [
  {
    id: '1',
    title: 'Стратегический митинг: Запуск VoiceMap Pro',
    date: 'Сегодня, 10:30',
    duration: '38:47',
    tags: ['#Митинг', '#Стартап'],
    summary: 'Обсуждали план запуска платной версии VoiceMap Pro. Максим представил технический стек для новых фич — командные пространства и шаринг записей. Алина показала обновлённый дизайн онбординга, который сокращает time-to-value с 5 минут до 90 секунд. Договорились о дате мягкого запуска — 15 мая, с ограниченным бета-доступом для первых 500 пользователей.',
    actionItems: ['Подготовить лендинг для Pro-версии', 'Настроить Stripe для приёма платежей', 'Провести нагрузочное тестирование перед запуском', 'Написать письмо существующим пользователям о бете Pro'],
    ideas: ['Annual Plan со скидкой 40% для ранних пользователей', 'Командный тариф с общим пространством и аналитикой', 'Реферальная программа: приведи друга — получи месяц бесплатно'],
    mentions: ['Максим', 'Алина', 'Stripe', 'Product Hunt'],
    mood: 'Энергичное 🚀',
    transcript: [
      { speaker: 'Я', timestamp: '00:00', text: 'Начнём. Сегодня финально согласуем план запуска Pro. Максим, расскажи про готовность с технической стороны.' },
      { speaker: 'Максим', timestamp: '00:45', text: 'Бэкенд готов на 85%. Основные фичи — командные пространства и шаринг — работают в стейджинге. Нагрузочное тестирование ещё не делали, нужна неделя.' },
      { speaker: 'Алина', timestamp: '03:20', text: 'Дизайн онбординга я переделала полностью. Новый флоу: три шага вместо восьми. По нашим тестам time-to-value падает с пяти минут до полутора.' },
      { speaker: 'Я', timestamp: '07:10', text: 'Это огромно. Алина, можешь к пятнице сделать финальные макеты в Figma, чтобы Максим мог сразу начать вёрстку?' },
      { speaker: 'Алина', timestamp: '07:30', text: 'Да, в пятницу сдам. Осталось только анимации доработать на экране записи.' },
      { speaker: 'Максим', timestamp: '12:00', text: 'По Stripe — нужно решить, какую модель берём. Фиксированная подписка или pay-per-use? От этого зависит архитектура биллинга.' },
      { speaker: 'Я', timestamp: '13:45', text: 'Берём подписку. Две ступени: Personal Pro за 9 долларов, Team за 29. Антон из фонда именно такую модель и советовал.' },
      { speaker: 'Максим', timestamp: '15:20', text: 'Окей, тогда мне нужно ещё три дня на интеграцию Stripe Billing. К 28-му будет готово.' },
      { speaker: 'Я', timestamp: '28:00', text: 'Итого: мягкий запуск 15 мая, первые 500 пользователей по приглашениям, затем открытый доступ. Все согласны?' },
      { speaker: 'Алина', timestamp: '28:20', text: 'Да, звучит реалистично.' },
      { speaker: 'Максим', timestamp: '28:35', text: 'Согласен. Главное — нагрузочный тест успеть до 10 мая.' },
    ],
    keyMoments: ['Мягкий запуск Pro — 15 мая', 'Онбординг сокращён с 5 мин до 90 сек', 'Подписка Personal $9 / Team $29', 'Нагрузочный тест до 10 мая'],
    participants: [
      { name: 'Максим', speakerLabel: 'Максим', role: 'CTO' },
      { name: 'Алина', speakerLabel: 'Алина', role: 'Lead Designer' },
    ],
    richActionItems: [
      { text: 'Подготовить лендинг для Pro-версии', assignees: ['Я'], deadline: '2026-05-01' },
      { text: 'Настроить Stripe для приёма платежей', assignees: ['Максим'], deadline: '2026-04-28' },
      { text: 'Провести нагрузочное тестирование перед запуском', assignees: ['Максим', 'Я'], deadline: '2026-05-10' },
      { text: 'Финальные макеты онбординга в Figma', assignees: ['Алина'], deadline: '2026-04-25' },
    ],
    openQuestions: [
      'Делаем ли триальный период 14 дней для Pro?',
      'Как обрабатываем пользователей которые превысили лимит бесплатного плана?',
      'Нужна ли отдельная страница с changelog для Pro-фич?',
    ],
    bigQuestions: [
      'Как балансировать между ростом free-пользователей и конверсией в Pro?',
      'Стоит ли выходить на Product Hunt в день запуска или подождать?',
    ],
  },
  {
    id: '2',
    title: 'Звонок с инвестором: Seed Round — Дмитрий Волков',
    date: 'Вчера, 15:00',
    duration: '24:18',
    tags: ['#Стартап', '#Инвестиции'],
    summary: 'Питч-колл с Дмитрием Волковым из фонда Elbrus. Реакция на продукт очень позитивная — Дмитрий сам ведёт голосовые заметки и сразу понял ценность. Главные вопросы: unit economics, retention на 90 день и конкуренция с Otter.ai. Попросил прислать data room до конца недели, следующий шаг — встреча с партнёрами фонда.',
    actionItems: ['Собрать data room: метрики, финмодель, кэп-таблица', 'Подготовить ответ на вопрос про Otter.ai и дифференциацию', 'Написать Дмитрию письмо с резюме и ссылкой на data room'],
    ideas: ['Показать в питче кейс "запись → задачи → трекинг" как замену Notion + Asana', 'Добавить слайд про командное использование — там самый высокий LTV'],
    mentions: ['Дмитрий', 'Elbrus', 'Otter.ai', 'Notion', 'Y Combinator'],
    mood: 'Воодушевлённое 🌟',
    transcript: [
      { speaker: 'Дмитрий', timestamp: '00:00', text: 'Привет. Я посмотрел демо — честно говоря, сам пользуюсь голосовыми заметками, поэтому сразу понял о чём вы.' },
      { speaker: 'Я', timestamp: '00:30', text: 'Отлично. Тогда вы точно чувствуете боль — наговорил идею, а потом она теряется где-то в заметках и никогда не реализуется.' },
      { speaker: 'Дмитрий', timestamp: '01:15', text: 'Именно. Покажите мне цифры. Retention, DAU, стоимость привлечения.' },
      { speaker: 'Я', timestamp: '02:00', text: 'Сейчас 1400 активных пользователей. Retention на 30 день — 41%, на 90 день пока 28%. DAU/MAU 0.34. CAC через контент — около 2 долларов.' },
      { speaker: 'Дмитрий', timestamp: '04:30', text: 'Retention на 90 день можно улучшить. Что говорят пользователи которые уходят?' },
      { speaker: 'Я', timestamp: '05:10', text: 'Основная причина — "забывают открывать приложение". Мы как раз делаем push-напоминания и виджет на главном экране.' },
      { speaker: 'Дмитрий', timestamp: '08:45', text: 'Как вы позиционируете себя против Otter.ai? У них огромная база и транскрипция лучше.' },
      { speaker: 'Я', timestamp: '09:20', text: 'Otter — инструмент для встреч и расшифровки. Мы — персональный AI-ассистент мышления. Разные сценарии использования. Наш пользователь не хочет просто транскрипт, он хочет чтобы мысли превращались в действия.' },
      { speaker: 'Дмитрий', timestamp: '15:00', text: 'Понятно. Какой раунд, сколько, на что?' },
      { speaker: 'Я', timestamp: '15:30', text: 'Seed, 800К долларов. 12 месяцев runway. Команда 3 человека фуллтайм, найм двух разработчиков и маркетолога.' },
      { speaker: 'Дмитрий', timestamp: '18:20', text: 'Хорошо. Пришлите data room до конца недели. Если всё сойдётся — приглашу вас на встречу с партнёрами.' },
    ],
    keyMoments: ['Retention 30д — 41%, 90д — 28%', 'CAC $2 через контент', 'Seed $800K — 12 месяцев runway', 'Следующий шаг — встреча с партнёрами Elbrus'],
    participants: [
      { name: 'Дмитрий', speakerLabel: 'Дмитрий', role: 'Партнёр Elbrus Fund' },
    ],
    richActionItems: [
      { text: 'Собрать data room: метрики, финмодель, кэп-таблица', assignees: ['Я'], deadline: '2026-04-27' },
      { text: 'Подготовить ответ на вопрос про Otter.ai', assignees: ['Я'], deadline: '2026-04-26' },
      { text: 'Написать Дмитрию письмо с резюме и data room', assignees: ['Я'], deadline: '2026-04-27' },
    ],
    openQuestions: [
      'Принимают ли они конвертируемые займы или только equity?',
      'Есть ли у фонда портфельные компании с синергией — чтобы предложить партнёрства?',
    ],
    bigQuestions: [
      'Брать ли деньги от одного инвестора или делать синдикат?',
      'Как не потерять продуктовый фокус после получения финансирования?',
    ],
  },
  {
    id: '3',
    title: 'Планирование спринта: апрель — финальные две недели',
    date: '21 апреля, 09:15',
    duration: '31:05',
    tags: ['#Митинг', '#Планирование'],
    summary: 'Спринт-планирование на финальные две недели апреля. Приоритет номер один — завершить Pro-фичи и пройти внутреннее QA. Максим взял на себя Stripe и командные пространства, Алина — финальный дизайн и тесты на мобилке. Также договорились убрать из беклога три фичи которые откладывали уже третий спринт подряд — либо делаем сейчас, либо удаляем.',
    actionItems: ['Закрыть все P0-баги до 28 апреля', 'Провести внутреннее QA-ревью Pro-фич', 'Обновить беклог: удалить залежавшиеся задачи', 'Написать release notes для Pro'],
    ideas: ['Сделать внутренний TestFlight-билд для команды чтобы тестировать ежедневно', 'Changelog-страница в приложении — пользователи любят видеть что меняется'],
    mentions: ['Максим', 'Алина', 'Jira', 'TestFlight', 'Stripe'],
    mood: 'Деловое 💼',
    transcript: [
      { speaker: 'Я', timestamp: '00:00', text: 'Итак, последние две недели апреля. Цель одна — всё готово к мягкому запуску 15 мая. Максим, что у тебя на руках?' },
      { speaker: 'Максим', timestamp: '00:40', text: 'Stripe интеграция — три дня. Командные пространства — пять дней. Плюс баги из прошлого спринта, там штук семь P1.' },
      { speaker: 'Я', timestamp: '02:10', text: 'P1 нужно закрыть до 28-го. Это жёсткий дедлайн. Алина, у тебя?' },
      { speaker: 'Алина', timestamp: '02:30', text: 'Финальные макеты в пятницу, как договорились. Потом мобильное тестирование — у нас на iOS 15 есть баги с анимациями. И release notes написать надо.' },
      { speaker: 'Я', timestamp: '05:00', text: 'Давайте ещё беклог почистим. У нас три задачи которые перекочевывают из спринта в спринт уже три месяца.' },
      { speaker: 'Максим', timestamp: '05:25', text: 'Оффлайн-режим, экспорт в PDF и интеграция с Google Calendar. Честно — первые два можно двигать на Q3, третье вообще удалить, у нас никто не просил.' },
      { speaker: 'Алина', timestamp: '06:50', text: 'Согласна. Лучше меньше фич, но качественно доделанных, чем куча полуфабрикатов.' },
      { speaker: 'Я', timestamp: '08:00', text: 'Принято. Удаляем Google Calendar из беклога, оффлайн и PDF двигаем на Q3.' },
      { speaker: 'Максим', timestamp: '22:00', text: 'Ещё предлагаю сделать ежедневный TestFlight-билд чтобы самим пользоваться приложением. Лучший QA.' },
      { speaker: 'Я', timestamp: '22:30', text: 'Отличная идея. Настрой автосборку через GitHub Actions.' },
    ],
    keyMoments: ['P1-баги закрыть до 28 апреля', 'Оффлайн и PDF экспорт — Q3', 'Google Calendar — удалить из беклога', 'Ежедневный TestFlight-билд'],
    participants: [
      { name: 'Максим', speakerLabel: 'Максим', role: 'CTO' },
      { name: 'Алина', speakerLabel: 'Алина', role: 'Lead Designer' },
    ],
    richActionItems: [
      { text: 'Закрыть все P0-баги', assignees: ['Максим'], deadline: '2026-04-28' },
      { text: 'Stripe интеграция', assignees: ['Максим'], deadline: '2026-04-26' },
      { text: 'Финальный дизайн и мобильные баги', assignees: ['Алина'], deadline: '2026-04-25' },
      { text: 'Настроить ежедневный TestFlight билд через GitHub Actions', assignees: ['Максим', 'Алина'], deadline: '2026-04-24' },
      { text: 'Обновить беклог — удалить залежавшиеся задачи', assignees: ['Я'], deadline: '2026-04-23' },
    ],
    openQuestions: [
      'Успеем ли сделать оффлайн-режим до конца Q2 или реально Q3?',
      'Нужен ли отдельный QA-специалист или справляемся своими силами?',
    ],
    bigQuestions: [
      'Как приоритизировать фичи когда каждая кажется важной — нужен чёткий фреймворк.',
      'Когда нанимать первого полноценного QA инженера?',
    ],
  },
  {
    id: '4',
    title: 'Брейншторм: монетизация и growth-каналы',
    date: '18 апреля, 20:00',
    duration: '17:33',
    tags: ['#Идеи', '#Стартап'],
    summary: 'Вечерний сольный брейншторм по монетизации и каналам роста. Думал о том, что у нас уже есть сильный органический рост через контент, но мы не масштабируем его системно. Главная идея: сделать VoiceMap "видимым" продуктом — чтобы каждая публичная запись или дайджест тащила новых пользователей. Записал несколько неочевидных гипотез для тестирования.',
    actionItems: ['Запустить A/B тест онбординга с 2 и 4 шагами', 'Создать шаблон для публичного дайджеста', 'Написать пост в LinkedIn про "думать голосом"'],
    ideas: [
      'Публичные дайджесты — пользователь публикует выжимку недели, каждый пост тащит новую аудиторию',
      'Viral loop: "Создано в VoiceMap" watermark на шаренных записях',
      'Embeddable виджет — вставить голосовую запись в любой блог или сайт',
      'API для разработчиков — платный доступ к транскрипции и AI-анализу',
      'Integromat/Zapier коннектор — автоматически отправлять задачи из записей в Todoist или Notion',
    ],
    mentions: ['LinkedIn', 'Twitter', 'Zapier', 'Notion', 'Ali Abdaal', 'Andrew Huberman'],
    mood: 'Творческое 🎨',
    transcript: [
      { speaker: 'Я', timestamp: '00:00', text: 'Окей, вечер, тихо, давай думать про рост. У нас 1400 пользователей, CAC два доллара через контент — это круто, но хочу понять как это масштабировать.' },
      { speaker: 'Я', timestamp: '01:30', text: 'Основная проблема — продукт невидимый. Пользователь пишет заметки для себя и никто снаружи это не видит. Нет вирального механизма.' },
      { speaker: 'Я', timestamp: '03:00', text: 'Идея первая: публичные дайджесты. Пользователь может в конце недели опубликовать выжимку своих мыслей — как newsletter, но автоматически из записей.' },
      { speaker: 'Я', timestamp: '05:20', text: 'Это двойная ценность: пользователю — структурированное резюме, нам — вирусность. Каждый пост в LinkedIn или Twitter это реклама.' },
      { speaker: 'Я', timestamp: '07:45', text: 'Вторая идея — embeddable плеер. Вставил запись в блог, и там стоит бейджик "Записано в VoiceMap". Работает как у Spotify.' },
      { speaker: 'Я', timestamp: '10:10', text: 'API — это вообще отдельный рынок. Разработчики платят за транскрипцию, мы получаем B2B выручку и word of mouth среди технарей.' },
      { speaker: 'Я', timestamp: '13:00', text: 'Zapier интеграция — кажется быстрой победой. Люди постоянно просят "как отправить задачи из записи в Todoist". Если это будет в один клик, retention вырастет.' },
      { speaker: 'Я', timestamp: '15:30', text: 'Итого три приоритета на тест: публичные дайджесты, Zapier коннектор, A/B онбординга. Всё остальное — позже.' },
    ],
    keyMoments: ['Продукт невидимый — нет вирального механизма', 'Публичные дайджесты как viral loop', 'API для разработчиков — отдельный рынок', 'Zapier коннектор — быстрая победа для retention'],
    richActionItems: [
      { text: 'Запустить A/B тест онбординга (2 vs 4 шага)', assignees: ['Я'], deadline: '2026-04-30' },
      { text: 'Сделать MVP публичных дайджестов', assignees: ['Максим'], deadline: '2026-05-07' },
      { text: 'Написать пост в LinkedIn "Как я думаю голосом"', assignees: ['Я'], deadline: '2026-04-25' },
    ],
    openQuestions: [
      'Как монетизировать API — по количеству запросов или по объёму аудио?',
      'Нужна ли отдельная команда для B2B или один менеджер справится?',
    ],
    bigQuestions: [
      'Строить ли PLG-движок или делать ставку на контент и SEO?',
      'Когда правильный момент для запуска публичного API?',
    ],
  },
  {
    id: '5',
    title: '1:1 с Максимом: состояние команды и выгорание',
    date: '16 апреля, 14:00',
    duration: '22:10',
    tags: ['#Митинг', '#Личное'],
    summary: 'Откровенный разговор с Максимом. Признался что последние две недели чувствует усталость — слишком много параллельных задач. Договорились пересмотреть его нагрузку: убрать его из нескольких встреч и сфокусировать на двух ключевых задачах. Также обсудили его долю в компании — Максим хочет прозрачности по вестингу.',
    actionItems: ['Пересмотреть нагрузку Максима — убрать лишние встречи', 'Подготовить и подписать вестинг-соглашение с Максимом', 'Ввести правило "два фокусных дня" без встреч'],
    ideas: ['No-meeting среда и пятница для глубокой работы', 'Квартальные 1:1 с каждым членом команды по карьере и целям'],
    mentions: ['Максим', 'Алина'],
    mood: 'Вдумчивое 🤔',
    transcript: [
      { speaker: 'Я', timestamp: '00:00', text: 'Как ты в целом? Не как по задачам, а именно как человек.' },
      { speaker: 'Максим', timestamp: '00:20', text: 'Честно? Устал. Последние две недели каждый день в 9 встреча, потом задачи, потом снова встреча. Нет времени на нормальный deep work.' },
      { speaker: 'Я', timestamp: '01:30', text: 'Это моя ответственность. Я втащил тебя в слишком много процессов. Давай пересмотрим.' },
      { speaker: 'Максим', timestamp: '02:00', text: 'Я хочу фокусироваться на двух вещах: архитектура и код-ревью. Всё остальное — статусы, маркетинговые встречи, обсуждения дизайна — меня не должно касаться.' },
      { speaker: 'Я', timestamp: '04:10', text: 'Согласен. Убираю тебя из всех встреч где не нужно техническое решение. Это будет среда и пятница — твои дни без встреч.' },
      { speaker: 'Максим', timestamp: '07:00', text: 'И ещё один вопрос — по доле. Я три месяца в компании, хочу понять как работает вестинг, что я реально получу.' },
      { speaker: 'Я', timestamp: '07:45', text: 'Абсолютно справедливо. Стандартный вестинг 4 года, клиф один год. Твоя доля 8%. Давай на этой неделе подпишем нормальное соглашение, не просто слова.' },
      { speaker: 'Максим', timestamp: '10:20', text: 'Отлично. Это важно для меня — не сумма, а прозрачность.' },
    ],
    keyMoments: ['Максим устал от перегруза встречами', 'Вводим no-meeting среду и пятницу', 'Доля Максима 8%, вестинг 4 года клиф 1 год', 'Нужно подписать вестинг-соглашение'],
    participants: [
      { name: 'Максим', speakerLabel: 'Максим', role: 'CTO' },
    ],
    richActionItems: [
      { text: 'Убрать Максима из нерелевантных встреч', assignees: ['Я'], deadline: '2026-04-24' },
      { text: 'Подготовить вестинг-соглашение с Максимом', assignees: ['Я'], deadline: '2026-04-28' },
      { text: 'Ввести no-meeting среду и пятницу для команды', assignees: ['Я', 'Максим'], deadline: '2026-04-24' },
    ],
    openQuestions: [
      'Нужен ли юрист для оформления вестинга или можно через стандартный шаблон?',
      'Как Алина относится к текущей нагрузке — стоит тоже провести 1:1?',
    ],
    bigQuestions: [
      'Как масштабировать команду не потеряв культуру и скорость?',
      'Когда переходить от "все делают всё" к чётким ролям и зонам ответственности?',
    ],
  },
];

const initialNotes: Note[] = [
  { id: 'n1', type: 'Идея', content: 'Сделать тёмную тему с акцентом на фиолетовый — как космос. Пользователи любят эстетику.', date: '13 апреля, 11:20', priority: 'high' },
  { id: 'n2', type: 'Задача', content: 'Написать документацию по API для партнёров. Без этого интеграции невозможны.', date: '13 апреля, 09:15', priority: 'high', isCompleted: false, kanbanStatus: 'in_progress' },
  { id: 'n3', type: 'Напоминание', content: 'Позвонить Антону насчёт pitch deck', date: '12 апреля, 18:00', dueDate: '2026-04-14', dueTime: '10:00' },
  { id: 'n4', type: 'Идея', content: 'Голосовой ввод снижает барьер для записи мыслей в 3 раза. Люди говорят быстрее, чем пишут.', date: '12 апреля, 16:45' },
  { id: 'n5', type: 'Идея', content: 'Интеграция с календарём — автоматически создавать события из action items записей.', date: '11 апреля, 14:30', priority: 'medium' },
  { id: 'n6', type: 'Задача', content: 'Обновить landing page — добавить новые скриншоты и testimonials от бета-пользователей.', date: '11 апреля, 10:00', priority: 'medium', isCompleted: false, kanbanStatus: 'new' },
  { id: 'n7', type: 'Напоминание', content: 'Оплатить подписку на Figma до конца месяца', date: '10 апреля, 09:00', dueDate: '2026-04-30', dueTime: '12:00' },
  { id: 'n8', type: 'Идея', content: 'Люди боятся звучать глупо на записи. Нужно убрать это психологическое барьер в UI — никакого "записываю" с красной кнопкой.', date: '10 апреля, 22:10' },
  { id: 'n9', type: 'Идея', content: 'Режим "Встреча" — автоматически разделяет спикеров, создаёт протокол и рассылает участникам.', date: '9 апреля, 13:20', priority: 'high' },
  { id: 'n10', type: 'Задача', content: 'Провести 5 пользовательских интервью по онбордингу. Нужно понять где люди теряются.', date: '9 апреля, 09:30', priority: 'high', isCompleted: true, kanbanStatus: 'done' },
  { id: 'n11', type: 'Напоминание', content: 'Встреча с командой в пятницу в 15:00 — подготовить демо новых фич', date: '8 апреля, 17:00', dueDate: '2026-04-18', dueTime: '15:00' },
  { id: 'n12', type: 'Идея', content: 'Самые крутые идеи приходят на пробежке. Нужен способ фиксировать их без остановки — AirPods + голос.', date: '8 апреля, 07:45' },
  { id: 'n13', type: 'Идея', content: 'Публичные "дайджесты" — пользователь может публично поделиться выжимкой своих мыслей за неделю.', date: '7 апреля, 20:00', priority: 'low' },
  { id: 'n14', type: 'Задача', content: 'Настроить аналитику событий в приложении — сейчас летим вслепую.', date: '7 апреля, 11:15', priority: 'high', isCompleted: false, kanbanStatus: 'new' },
  { id: 'n15', type: 'Напоминание', content: 'Дедлайн подачи заявки в акселератор ФРИИ', date: '6 апреля, 10:00', dueDate: '2026-04-20', dueTime: '23:59' },
  { id: 'n16', type: 'Идея', content: 'Retention важнее роста на ранних стадиях. Если люди уходят — не важно сколько пришло.', date: '6 апреля, 19:30' },
  { id: 'n17', type: 'Идея', content: 'Офлайн-режим с локальной моделью транскрипции — для людей которые боятся облака.', date: '5 апреля, 16:00', priority: 'medium' },
  { id: 'n18', type: 'Задача', content: 'Написать пост в LinkedIn о запуске беты VoiceMap. Пора заявить о себе публично.', date: '4 апреля, 12:00', priority: 'medium', isCompleted: true, kanbanStatus: 'done' },
  { id: 'n19', type: 'Напоминание', content: 'Забрать загранпаспорт из МФЦ', date: '3 апреля, 09:00', dueDate: '2026-04-16', dueTime: '14:00' },
  { id: 'n20', type: 'Идея', content: 'Голос — самый естественный интерфейс. Дети учатся говорить до того, как учатся писать. Мы просто возвращаемся к истокам.', date: '1 апреля, 23:00' },
];

const initialSpaces: Space[] = [
  { id: 'space-startup', name: 'Стартап', emoji: '🚀', color: '#7B61FF', createdAt: '2026-04-01' },
  { id: 'space-meetings', name: 'Митинги', emoji: '💼', color: '#4FC3F7', createdAt: '2026-04-01' },
  { id: 'space-personal', name: 'Личное', emoji: '❤️', color: '#F06292', createdAt: '2026-04-01' },
  { id: 'space-ideas', name: 'Идеи', emoji: '💡', color: '#FFB74D', createdAt: '2026-04-01' },
];

const TAG_SPACE_MAP: Record<string, string> = {
  '#Митинг': 'space-meetings',
  '#Стартап': 'space-startup',
  '#Личное': 'space-personal',
  '#Идеи': 'space-ideas',
  '#Проект': 'space-ideas',
  '#HR': 'space-meetings',
  '#Дизайн': 'space-meetings',
};

function assignSpaceId(r: Recording): Recording {
  if (r.spaceId) return r;
  const match = Object.entries(TAG_SPACE_MAP).find(([tag]) => r.tags.includes(tag));
  return match ? { ...r, spaceId: match[1] } : r;
}

function suggestSpaceId(recording: Recording, spaces: Space[]): string | undefined {
  for (const space of spaces) {
    const nl = space.name.toLowerCase();
    if (recording.tags.some(t => t.toLowerCase().includes(nl) || nl.includes(t.replace('#', '').toLowerCase()))) return space.id;
    if (recording.title.toLowerCase().includes(nl) || recording.summary.toLowerCase().includes(nl)) return space.id;
  }
  return undefined;
}

export default function App() {
  const { user: authUser, loading: authLoading, signInWithGoogle, logout } = useAuth();

  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('voicemap_settings');
      return saved ? { ...defaultAppSettings, ...JSON.parse(saved) } : defaultAppSettings;
    } catch { return defaultAppSettings; }
  });

  const updateSettings = (patch: Partial<AppSettings>) => {
    setAppSettings(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('voicemap_settings', JSON.stringify(next));
      return next;
    });
  };

  const {
    recordings, notes, spaces, loading: dataLoading,
    addRecording, updateRecordingItem, deleteRecordingItem, clearAllRecordings, setRecordingsLocal,
    addNote, updateNoteItem, deleteNoteItem, clearAllNotes, setNotesLocal,
    addSpace, updateSpaceItem, deleteSpaceItem,
  } = useFirestoreData(authUser?.uid ?? null);

  const [currentView, setCurrentView] = useState('dashboard');
  type NavEntry = { view: string; spaceMapActiveId?: string | null };
  const [navStack, setNavStack] = useState<NavEntry[]>([]);
  const [spaceMapActiveId, setSpaceMapActiveId] = useState<string | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [quickNoteType, setQuickNoteType] = useState<NoteType | null>(null);
  const [spacePickerRecordingId, setSpacePickerRecordingId] = useState<string | null>(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);

  // Если запись_detail открыта но запись не найдена — возвращаемся на дашборд
  // Проверяем только ПОСЛЕ завершения загрузки данных из Firestore
  useEffect(() => {
    if (currentView === 'recording_detail' && selectedRecordingId && !dataLoading) {
      const found = recordings.find(r => r.id === selectedRecordingId);
      if (!found) {
        setCurrentView('dashboard');
      }
    }
  }, [currentView, selectedRecordingId, recordings, dataLoading]);

  // Фокус-задачи от ассистента
  const [dailyFocus, setDailyFocus] = useState<Array<{ id: string; task: string; done: boolean }>>(() => {
    try { return JSON.parse(localStorage.getItem('voicemap_daily_focus') || '[]'); }
    catch { return []; }
  });

  // Профиль ассистента (имя, тон, правила)
  const [assistantProfile, setAssistantProfile] = useState<import('./lib/assistantPrompt').AssistantProfile>(() => {
    try {
      const saved = localStorage.getItem('voicemap_assistant_profile');
      return saved ? JSON.parse(saved) : { name: 'VoiceMap AI', tone: 'friendly', useEmoji: false, customRules: [] };
    } catch { return { name: 'VoiceMap AI', tone: 'friendly', useEmoji: false, customRules: [] }; }
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const user = authUser ?? { uid: 'local-user', displayName: 'Пользователь', email: '', photoURL: null };

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [dailyTip, setDailyTip] = useState<{ title: string; text: string } | null>(null);
  const [isGeneratingTip, setIsGeneratingTip] = useState(false);
  // Ref-флаг: предотвращает двойной вызов в React StrictMode и при пересчёте эффекта
  const tipFetchingRef = useRef(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useReminders({
    notes,
    onUpdateNote: (updated) => updateNoteItem(updated),
    showToast,
  });

  const { addFromRecording, getNames } = usePeople();

  useEffect(() => {
    localStorage.setItem('voicemap_daily_focus', JSON.stringify(dailyFocus));
  }, [dailyFocus]);

  useEffect(() => {
    localStorage.setItem('voicemap_assistant_profile', JSON.stringify(assistantProfile));
  }, [assistantProfile]);

  useEffect(() => {
    localStorage.setItem('voicemap_spaces', JSON.stringify(spaces));
  }, [spaces]);

  const handleLogout = async () => {
    await logout();
  };

  useEffect(() => {
    if (dailyTip || tipFetchingRef.current || recordings.length === 0) return;
    tipFetchingRef.current = true;
    setIsGeneratingTip(true);
    const context = recordings.slice(0, 3).map(r => `Title: ${r.title}\nSummary: ${r.summary}`).join('\n\n');
    fetchDailyTip(context)
      .then(result => {
        if (result.title && result.text) {
          setDailyTip(result);
        } else {
          setDailyTip({ title: "ПРОДУКТИВНОСТЬ", text: "Регулярно просматривайте свои записи, чтобы не упустить важные детали." });
        }
      })
      .catch(() => {
        setDailyTip({ title: "СОВЕТ ДНЯ", text: "Используйте быстрые заметки, чтобы моментально фиксировать идеи и задачи." });
      })
      .finally(() => {
        setIsGeneratingTip(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordings]);

  // Открыть запись с сохранением откуда пришли (для кнопки «Назад»)
  const openRecording = (id: string) => {
    setNavStack(prev => [...prev, { view: currentView, spaceMapActiveId }]);
    setSelectedRecordingId(id);
    setCurrentView('recording_detail');
  };

  const goBack = () => {
    const entry = navStack[navStack.length - 1];
    if (entry) {
      setNavStack(prev => prev.slice(0, -1));
      setCurrentView(entry.view);
      if (entry.spaceMapActiveId !== undefined) setSpaceMapActiveId(entry.spaceMapActiveId);
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleFinishRecording = async (blob: Blob, durationSeconds: number) => {
    setCurrentView('dashboard');
    setIsProcessing(true);

    // Временный blob URL — только для воспроизведения пока идёт загрузка в R2
    const localBlobUrl = URL.createObjectURL(blob);
    const recordingId = Date.now().toString();
    const m = Math.floor(durationSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(durationSeconds % 60).toString().padStart(2, '0');

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Audio = await base64Promise;

      // Транскрипция и загрузка в R2 идут ПАРАЛЛЕЛЬНО — экономим время
      const [transcribeResult, r2Result] = await Promise.allSettled([
        transcribeRecording(base64Audio, blob.type || 'audio/webm', getNames()),
        uploadAudioToR2(blob, recordingId),
      ]);

      // Если R2 готов — используем постоянный URL, иначе blob (до следующей попытки)
      const audioUrl = r2Result.status === 'fulfilled' ? r2Result.value.publicUrl : localBlobUrl;
      const r2Key   = r2Result.status === 'fulfilled' ? r2Result.value.r2Key : undefined;
      if (r2Result.status === 'rejected') {
        console.warn('R2 upload failed:', r2Result.reason);
      }

      const result = transcribeResult.status === 'fulfilled' ? transcribeResult.value : null;
      if (transcribeResult.status === 'rejected') {
        console.warn('Transcription failed:', transcribeResult.reason);
        showToast('Ошибка AI-обработки. Запись сохранена без транскрипта.', 'error');
      }

      const newRecording: Recording = {
        id: recordingId,
        title: result?.title || 'Новая запись',
        date: new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
        duration: `${m}:${s}`,
        tags: result?.tags || [],
        summary: result?.summary || '',
        actionItems: result?.actionItems || [],
        mood: result?.mood || 'Нейтральное',
        ideas: result?.ideas || [],
        mentions: result?.mentions || [],
        transcript: result?.transcript || [],
        keyMoments: result?.keyMoments || [],
        openQuestions: result?.openQuestions || [],
        participants: result?.participants || [],
        richActionItems: (result?.richActionItems || []).map(item => ({
          text: item.text,
          assignees: Array.isArray(item.assignees) && item.assignees.length > 0
            ? item.assignees
            : item.assignee ? [item.assignee] : [],
          deadline: item.deadline,
        })),
        bigQuestions: result?.bigQuestions || [],
        audioUrl,  // R2 URL или blob — сразу правильный
        r2Key,
      };

      // Сохраняем в Firestore уже с R2 URL (не blob!)
      addRecording(newRecording);
      addFromRecording(newRecording);
      setNavStack(prev => [...prev, { view: 'dashboard', spaceMapActiveId: null }]);
      setSelectedRecordingId(newRecording.id);
      setSpacePickerRecordingId(newRecording.id);

      // Если R2 не успел — пробуем в фоне ещё раз и обновляем запись
      if (r2Result.status === 'rejected') {
        uploadAudioToR2(blob, recordingId).then(({ publicUrl, r2Key: key }) => {
          updateRecordingItem({ ...newRecording, audioUrl: publicUrl, r2Key: key });
        }).catch(err => console.warn('R2 retry failed:', err));
      }

    } catch (err) {
      console.warn('handleFinishRecording unexpected error:', err);
      showToast('Ошибка при сохранении записи.', 'error');

      // Fallback: сохраняем без AI и без R2 (blob URL)
      const fallbackRecording: Recording = {
        id: recordingId,
        title: 'Новая запись (Без ИИ)',
        date: new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
        duration: `${m}:${s}`,
        tags: ['#Без_ИИ'],
        summary: 'Не удалось обработать запись.',
        actionItems: [], ideas: [], mentions: [],
        mood: 'Неизвестно', transcript: [], keyMoments: [],
        audioUrl: localBlobUrl,
      };

      addRecording(fallbackRecording);
      setNavStack(prev => [...prev, { view: 'dashboard', spaceMapActiveId: null }]);
      setSelectedRecordingId(fallbackRecording.id);
      setCurrentView('recording_detail');

      uploadAudioToR2(blob, recordingId).then(({ publicUrl, r2Key }) => {
        updateRecordingItem({ ...fallbackRecording, audioUrl: publicUrl, r2Key });
      }).catch(e => console.warn('R2 upload failed for fallback:', e));

    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetDemo = () => {
    localStorage.removeItem('voicemap_recordings');
    localStorage.removeItem('voicemap_notes');
    setRecordingsLocal(initialRecordings);
    setNotesLocal(initialNotes);
    showToast('Демо-данные сброшены', 'success');
  };

  const renderView = () => {
    if (currentView === 'gallery') {
      return <NotesGallery notes={notes} onBack={() => setCurrentView('dashboard')} setCurrentView={setCurrentView} onDeleteNote={(id) => {
        deleteNoteItem(id);
        showToast('Заметка удалена', 'success');
      }} onUpdateNote={(updated) => {
        updateNoteItem(updated);
      }} showToast={showToast} />;
    }

    if (currentView === 'library') {
      const openDetail = (id: string) => openRecording(id);
      const deleteRecording = (id: string) => {
        const target = recordings.find(r => r.id === id);
        if (target?.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(target.audioUrl);
        target?.appendAudios?.forEach(a => {
          if (a.url?.startsWith('blob:')) URL.revokeObjectURL(a.url);
        });
        // Удаляем аудио из R2 если есть ключ
        if (target?.r2Key) {
          deleteAudioFromR2(target.r2Key).catch(err => console.warn('R2 delete failed:', err));
        }
        deleteRecordingItem(id);
        showToast('Запись удалена', 'success');
      };
      return (
        <>
          {/* Desktop: interactive map */}
          <div className="hidden md:flex h-screen w-full">
            <LibraryMap
              recordings={recordings}
              notes={notes}
              onOpenDetail={openDetail}
              onBack={() => setCurrentView('dashboard')}
              onOpenNotes={() => setCurrentView('gallery')}
              onOpenSpaces={() => setCurrentView('library_spaces')}
              onUpdateNote={(updated) => updateNoteItem(updated)}
            />
          </div>
          {/* Mobile: classic list */}
          <div className="flex md:hidden w-full">
            <RecordingsLibrary
              recordings={recordings}
              onBack={() => setCurrentView('dashboard')}
              onOpenDetail={openDetail}
              onDeleteRecording={deleteRecording}
              onUpdateRecording={(updated) => updateRecordingItem(updated)}
            />
          </div>
        </>
      );
    }

    if (currentView === 'library_spaces') {
      return (
        <div className="flex h-screen w-full">
          <SpacesLibrary
            recordings={recordings}
            spaces={spaces}
            onBack={() => setCurrentView('library')}
            onOpenDetail={openRecording}
            activeSpaceId={spaceMapActiveId}
            onSetActiveSpaceId={setSpaceMapActiveId}
            onUpdateSpace={(updated) => updateSpaceItem(updated)}
            onDeleteRecording={(id) => {
              const target = recordings.find(r => r.id === id);
              if (target?.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(target.audioUrl);
              deleteRecordingItem(id);
              showToast('Запись удалена', 'success');
            }}
            onUpdateRecording={(updated) => updateRecordingItem(updated)}
            onCreateSpace={(data) => {
              const newSpace: Space = { ...data, id: 'space-' + Date.now(), createdAt: new Date().toISOString() };
              addSpace(newSpace);
            }}
            onDeleteSpace={(id) => deleteSpaceItem(id)}
            onMoveRecording={(recId, spaceId) => { const rec = recordings.find(r => r.id === recId); if (rec) updateRecordingItem({ ...rec, spaceId: spaceId ?? undefined }); }}
          />
        </div>
      );
    }

    if (currentView === 'recording_detail' && selectedRecordingId) {
      const rec = recordings.find(r => r.id === selectedRecordingId);
      if (rec) {
        return <RecordingDetail recording={rec} onBack={goBack} onDelete={() => {
          if (rec.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(rec.audioUrl);
          rec.appendAudios?.forEach(a => {
            if (a.url?.startsWith('blob:')) URL.revokeObjectURL(a.url);
          });
          if (rec.r2Key) {
            deleteAudioFromR2(rec.r2Key).catch(err => console.warn('R2 delete failed:', err));
          }
          deleteRecordingItem(rec.id);
          goBack();
          showToast('Запись удалена', 'success');
        }} onUpdate={(updatedRec) => {
          updateRecordingItem(updatedRec);
        }} showToast={showToast} allRecordings={recordings} onOpenRecording={(id) => openRecording(id)} onRetranscribe={async () => {
          // Повторная транскрипция: фетчим аудио с R2 через сервер и обрабатываем Gemini File API
          const recording = recordings.find(r => r.id === selectedRecordingId);
          if (!recording?.audioUrl) {
            showToast('Нет аудиофайла для транскрипции', 'error');
            return;
          }
          // Определяем mimeType по URL или ключу R2
          const url = recording.audioUrl;
          const mimeType = url.includes('.webm') ? 'audio/webm'
            : url.includes('.ogg') ? 'audio/ogg'
            : 'audio/mp4';
          try {
            const result = await retranscribeFromUrl(url, mimeType, getNames());
            updateRecordingItem({ ...recording, ...result, title: result.title || recording.title });
            showToast('Транскрипция готова ✓', 'success');
          } catch (err) {
            console.error('[retranscribe] failed:', err);
            showToast('Ошибка повторной транскрипции', 'error');
          }
        }} />;
      }
      // Запись ещё грузится из Firestore — показываем спиннер
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      );
    }

    if (currentView === 'recording_session') {
      return <RecordingSession onFinish={handleFinishRecording} onCancel={() => setCurrentView('dashboard')} showToast={showToast} autoStopMinutes={appSettings.autoStopMinutes} />;
    }

    if (currentView === 'analytics') {
      return <AnalyticsView recordings={recordings} onBack={() => setCurrentView('dashboard')} />;
    }

    if (currentView === 'focus') {
      return <FocusView
        recordings={recordings}
        notes={notes}
        onBack={() => setCurrentView('dashboard')}
        onOpenRecording={openRecording}
        onUpdateNote={(updated) => updateNoteItem(updated)}
        onToggleDone={(recId, taskIdx) => {
          const rec = recordings.find(r => r.id === recId);
          if (rec) {
            const cur = rec.actionItemsDone || new Array(rec.actionItems?.length ?? 0).fill(false);
            const next = [...cur];
            while (next.length < (rec.actionItems?.length ?? 0)) next.push(false);
            next[taskIdx] = !next[taskIdx];
            updateRecordingItem({ ...rec, actionItemsDone: next });
          }
        }}
      />;
    }

    if (currentView === 'tags') {
      return <TagsView recordings={recordings} onBack={() => setCurrentView('dashboard')} onOpenRecording={openRecording} />;
    }

    if (currentView === 'reminders') {
      return <RemindersView
        recordings={recordings}
        notes={notes}
        onUpdateRecording={(updated) => updateRecordingItem(updated)}
        onUpdateNote={(updated) => updateNoteItem(updated)}
        onDeleteNote={(id) => deleteNoteItem(id)}
        onOpenRecording={(id) => { openRecording(id); }}
        onBack={() => setCurrentView('dashboard')}
      />;
    }

    if (currentView === 'settings') {
      return <SettingsView
        recordings={recordings}
        notes={notes}
        onBack={() => setCurrentView('dashboard')}
        onResetDemo={handleResetDemo}
        onClearRecordings={() => clearAllRecordings()}
        onClearNotes={() => clearAllNotes()}
        showToast={showToast}
        settings={appSettings}
        onSettingsChange={updateSettings}
      />;
    }

    // Dashboard
    return (
      <div className="min-h-screen bg-background text-on-surface pb-32 font-body selection:bg-primary/30 relative">
        <Header currentView={currentView} setCurrentView={setCurrentView} onLogout={handleLogout} onReset={handleResetDemo} user={authUser ?? undefined} />
        <main className="max-w-[1440px] mx-auto px-4 pt-6 lg:px-8 lg:pt-12">
          <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12">
            <LiveSessionCard onStartRecording={() => setCurrentView('recording_session')} />
            <QuickNoteCard onQuickNote={(type) => setQuickNoteType(type)} />
          </div>
          <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12">
            <FocusTodayCard
              recordings={recordings}
              notes={notes}
              assistantTasks={dailyFocus}
              onToggleAssistantTask={(id) => setDailyFocus(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))}
              onOpenRecording={openRecording}
              onToggleDone={(recId, taskIdx) => {
                const rec = recordings.find(r => r.id === recId);
                if (rec) {
                  const cur = rec.actionItemsDone || new Array(rec.actionItems?.length ?? 0).fill(false);
                  const next = [...cur];
                  while (next.length < (rec.actionItems?.length ?? 0)) next.push(false);
                  next[taskIdx] = !next[taskIdx];
                  updateRecordingItem({ ...rec, actionItemsDone: next });
                }
              }}
              onToggleNoteTask={(noteId) => {
                const note = notes.find(n => n.id === noteId);
                if (note) updateNoteItem({ ...note, isCompleted: true });
              }}
            />
            <IdeasCard recordings={recordings} notes={notes} onOpenRecording={openRecording} />
          </div>
          <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12 items-stretch">
            <AITipCard dailyTip={dailyTip} isGeneratingTip={isGeneratingTip} />
            <ActivityChartCard recordings={recordings} notes={notes} onOpenRecording={openRecording} />
          </div>
          <div className="grid grid-cols-12 gap-4 lg:gap-8 mb-6 lg:mb-12">
            <BrainStatsCard recordings={recordings} notes={notes} onNavigate={setCurrentView} onUpdateNote={note => updateNoteItem(note)} onUpdateRecording={(updated) => updateRecordingItem(updated)} onOpenRecording={openRecording} />
            <WeeklyDigestCard recordings={recordings} setCurrentView={setCurrentView} />
          </div>
          <RecentRecordings recordings={recordings} onOpenLibrary={() => setCurrentView('library')} onOpenDetail={openRecording} />
        </main>
        <BottomNav currentView={currentView} setCurrentView={setCurrentView} />

        {quickNoteType && (
          <QuickNoteModal
            type={quickNoteType}
            onClose={() => setQuickNoteType(null)}
            onSave={(note) => {
              addNote(note);
              showToast('Заметка сохранена', 'success');
            }}
            showToast={showToast}
          />
        )}
      </div>
    );
  };

  // Пока Firebase проверяет сессию — показываем сплеш
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Не авторизован — показываем экран входа
  if (!authUser) {
    return <LoginScreen onGoogleSignIn={signInWithGoogle} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className="relative h-full transition-all duration-300 ease-in-out w-full">
        <div className="h-full w-full overflow-y-auto">
          {renderView()}
        </div>

        {/* Floating AI Assistant Button */}
        <button
          onClick={() => setIsAssistantOpen(true)}
          className={`fixed bottom-24 md:bottom-32 right-4 md:right-8 w-14 h-14 bg-primary text-on-primary-fixed rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(175,162,255,0.4)] hover:scale-110 transition-transform z-[150] cursor-pointer ${isAssistantOpen ? 'hidden' : currentView === 'recording_detail' ? 'hidden md:flex' : ''}`}
        >
          <Brain className="w-6 h-6" />
        </button>

        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 50, x: '-50%' }}
              className={`fixed bottom-8 left-1/2 z-[500] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold text-sm ${
                toast.type === 'error' ? 'bg-error text-white' :
                toast.type === 'success' ? 'bg-secondary text-on-secondary' :
                'bg-surface-container-highest text-white'
              }`}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ChatSidebar
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        recordings={recordings}
        notes={notes}
        spaces={spaces}
        profile={assistantProfile}
        onOpenRecording={openRecording}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onSetFocusTasks={(tasks) => {
          const newTasks = tasks.map(task => ({ id: `${Date.now()}-${Math.random()}`, task, done: false }));
          setDailyFocus(prev => [...newTasks, ...prev]);
          showToast(`Добавлено ${tasks.length} фокус-задач`, 'success');
        }}
        onCreateNote={(data) => {
          const note: import('./types').Note = {
            id: Date.now().toString(),
            type: data.type as import('./types').NoteType,
            content: data.content,
            date: new Date().toLocaleDateString('ru-RU'),
            isCompleted: false,
            dueDate: data.dueDate,
            dueTime: data.dueTime,
          };
          addNote(note);
          showToast('Заметка создана', 'success');
        }}
        onUpdateRecording={(id, updates) => {
          const rec = recordings.find(r => r.id === id);
          if (rec) updateRecordingItem({ ...rec, ...updates });
          showToast('Запись обновлена', 'success');
        }}
        onLearnRule={(rule) => {
          setAssistantProfile(prev => ({
            ...prev,
            customRules: [...prev.customRules.slice(-9), rule],
          }));
        }}
      />

      {spacePickerRecordingId && (() => {
        const rec = recordings.find(r => r.id === spacePickerRecordingId);
        if (!rec) return null;
        return (
          <SpacePickerModal
            recording={rec}
            spaces={spaces}
            suggestedSpaceId={suggestSpaceId(rec, spaces)}
            onAssign={(spaceId) => {
              if (spaceId) { const rec = recordings.find(r => r.id === spacePickerRecordingId); if (rec) updateRecordingItem({ ...rec, spaceId }); }
              setSpacePickerRecordingId(null);
              setCurrentView('recording_detail');
            }}
            onCreateAndAssign={(data) => {
              const id = 'space-' + Date.now();
              addSpace({ ...data, id, createdAt: new Date().toISOString() });
              return id;
            }}
          />
        );
      })()}

      {isProcessing && (
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
          <h2 className="text-2xl font-headline font-bold mb-2">AI обрабатывает запись...</h2>
          <p className="text-on-surface-variant">Транскрибация, выделение задач и инсайтов</p>
        </div>
      )}
    </div>
  );
}
