/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, UserCircle, Mic, AudioLines, FileEdit, Lightbulb, Check,
  Brain, Bell, Plus, Folder, CheckCircle2, Circle, ArrowRight,
  PlayCircle, FolderOpen, Target, Settings, Pin, Clock,
  ArrowLeft, Keyboard, FileText, ListTodo, MessageSquare, Users, Calendar, Play, Pause, Volume2, X, Loader2, Trash2, Square
} from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

// Types
export interface Task {
  description: string;
  assignee?: string;
  deadline?: string;
}

export interface TranscriptItem {
  speaker: string;
  timestamp: string;
  text: string;
}

export interface Note {
  id: string;
  type: string;
  content: string;
  date: string;
}

export interface Recording {
  id: string;
  title: string;
  date: string;
  duration: string;
  tags: string[];
  summary: string;
  transcript: TranscriptItem[];
  keyMoments?: string[];
  audioUrl?: string;
  mood?: string;
  ideas?: string[];
  actionItems?: string[];
  mentions?: string[];
}

// Mock initial data
const initialRecordings: Recording[] = [
  {
    id: '1',
    title: 'Идея для нового проекта: Умный блокнот',
    date: 'Вчера, 10:00',
    duration: '05:15',
    tags: ['#Идеи', '#Проект'],
    summary: 'Размышлял о том, как было бы круто иметь голосовой блокнот, который не просто записывает текст, но и понимает контекст. Чтобы можно было надиктовать мысли на ходу, а он сам разложил их по полочкам: выделил задачи, идеи и настроение.',
    actionItems: [
      'Набросать дизайн-макет главного экрана',
      'Посмотреть API для распознавания речи'
    ],
    ideas: [
      'Добавить функцию "Спросить ИИ о записи", чтобы можно было общаться со своими же мыслями',
      'Сделать анализ настроения по голосу'
    ],
    mentions: ['Notion', 'Google AI Studio'],
    mood: 'Вдохновленное ✨',
    transcript: [
      { speaker: 'Я', timestamp: '00:00', text: 'Так, пришла в голову классная идея. Что если сделать персональный голосовой блокнот? Не для бизнеса, а именно для себя.' },
      { speaker: 'Я', timestamp: '00:15', text: 'Часто бывает, что идешь по улице, пришла мысль, а записать неудобно. Хочется просто нажать кнопку, наговорить поток сознания, а ИИ потом сам все структурирует.' },
      { speaker: 'Я', timestamp: '00:42', text: 'Надо будет посмотреть, как это можно интегрировать с Google AI Studio. И еще набросать дизайн-макет главного экрана на выходных.' },
      { speaker: 'Я', timestamp: '01:05', text: 'Кстати, было бы круто, если бы он еще и настроение отслеживал. Типа, сегодня я был уставший, а вчера прям на подъеме.' }
    ],
    keyMoments: ['Идея персонального голосового блокнота', 'Структурирование потока сознания с помощью ИИ', 'Отслеживание настроения']
  }
];

const Header = ({ currentView, setCurrentView, onLogout, onReset }: { currentView: string, setCurrentView: (view: string) => void, onLogout: () => void, onReset: () => void }) => (
  <header className="w-full top-0 sticky bg-[#0e0e11] z-[100]">
    <div className="flex justify-between items-center px-8 py-6 max-w-full bg-[#1c1c21]">
      <div className="text-2xl font-black tracking-tighter text-[#7B61FF] uppercase font-headline cursor-pointer" onClick={() => setCurrentView('dashboard')}>
        VOICEMAP
      </div>
      <div className="flex items-center gap-6">
        <div className="hidden md:flex gap-8 font-label text-slate-400 text-xs font-bold tracking-widest uppercase">
          <button onClick={() => setCurrentView('gallery')} className={`${currentView === 'gallery' ? 'text-[#7B61FF]' : 'hover:text-white transition-colors'} cursor-pointer`}>Архив</button>
          <button onClick={() => setCurrentView('recording_session')} className={`${currentView === 'recording_session' ? 'text-[#7B61FF]' : 'hover:text-white transition-colors'} cursor-pointer`}>Запись</button>
          <button onClick={() => setCurrentView('analytics')} className={`${currentView === 'analytics' ? 'text-[#7B61FF]' : 'hover:text-white transition-colors'} cursor-pointer`}>Аналитика</button>
          <button onClick={() => setCurrentView('focus')} className={`${currentView === 'focus' ? 'text-[#7B61FF]' : 'hover:text-white transition-colors'} cursor-pointer`}>Фокус</button>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onReset} className="text-xs font-bold text-slate-400 hover:text-white bg-white/5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
            Сбросить демо
          </button>
          <Search className="text-slate-400 cursor-pointer hover:text-white transition-colors w-6 h-6" onClick={() => setCurrentView('library')} />
          <button onClick={onLogout} title="Выйти" className="cursor-pointer">
            <UserCircle className="text-[#7B61FF] w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  </header>
);

const BottomNav = ({ currentView, setCurrentView }: { currentView: string, setCurrentView: (view: string) => void }) => (
  <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-6 pb-8 pt-4 bg-[#0e0e11]/80 backdrop-blur-xl border-t border-white/5 z-50 rounded-t-3xl shadow-[0_-8px_32px_rgba(123,97,255,0.06)]">
    <div onClick={() => setCurrentView('gallery')} className={`flex flex-col items-center justify-center px-6 py-2 transition-all cursor-pointer ${currentView === 'gallery' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl' : 'text-slate-500 hover:bg-white/5'}`}>
      <FolderOpen className="mb-1 w-6 h-6" />
      <span className="font-label text-[10px] font-bold tracking-widest uppercase">Архив</span>
    </div>
    <div onClick={() => setCurrentView('recording_session')} className={`flex flex-col items-center justify-center px-6 py-2 transition-all cursor-pointer ${currentView === 'recording_session' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl scale-95' : 'text-slate-500 hover:bg-white/5'}`}>
      <Mic className="mb-1 w-6 h-6" fill="currentColor" />
      <span className="font-label text-[10px] font-bold tracking-widest uppercase">Запись</span>
    </div>
    <div onClick={() => setCurrentView('analytics')} className={`flex flex-col items-center justify-center px-6 py-2 transition-all cursor-pointer ${currentView === 'analytics' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl' : 'text-slate-500 hover:bg-white/5'}`}>
      <Brain className="mb-1 w-6 h-6" />
      <span className="font-label text-[10px] font-bold tracking-widest uppercase">Инсайты</span>
    </div>
    <div onClick={() => setCurrentView('focus')} className={`flex flex-col items-center justify-center px-6 py-2 transition-all cursor-pointer ${currentView === 'focus' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl' : 'text-slate-500 hover:bg-white/5'}`}>
      <Target className="mb-1 w-6 h-6" />
      <span className="font-label text-[10px] font-bold tracking-widest uppercase">Фокус</span>
    </div>
  </nav>
);

const LiveSessionCard = ({ onStartRecording }: { onStartRecording: () => void }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="col-span-12 lg:col-span-7 bg-surface-container rounded-3xl p-10 relative overflow-hidden group"
  >
    <div className="relative z-10">
      <p className="font-label text-secondary text-xs font-extrabold tracking-[0.3em] mb-4">ЖИВАЯ СЕССИЯ</p>
      <h1 className="font-headline text-5xl lg:text-7xl font-black tracking-tighter mb-8 max-w-md leading-[0.9]">ГОТОВЫ К ЗАПИСИ?</h1>
      <div className="flex items-center gap-6">
        <button onClick={onStartRecording} className="bg-gradient-to-br from-primary to-primary-dim p-6 rounded-full shadow-[0_0_40px_rgba(175,162,255,0.3)] hover:scale-105 transition-transform cursor-pointer">
          <Mic className="text-on-primary-fixed w-10 h-10" fill="currentColor" />
        </button>
        <div>
          <p className="font-body text-on-surface-variant text-sm">Нажмите, чтобы начать<br/>интеллектуальное архивирование</p>
        </div>
      </div>
    </div>
    <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-primary/10 rounded-full blur-[100px] group-hover:bg-primary/20 transition-all duration-700"></div>
    <div className="absolute right-12 top-12 opacity-20">
      <AudioLines className="w-[120px] h-[120px] text-primary" />
    </div>
  </motion.div>
);

const QuickNoteCard = ({ onQuickNote }: { onQuickNote: (type: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="col-span-12 lg:col-span-5 bg-surface-container-high rounded-3xl p-10 flex flex-col justify-center items-center border border-white/5 relative overflow-hidden"
    >
      <div className="absolute top-8 left-8">
        <FileEdit className="text-tertiary mb-4 w-6 h-6" />
        <h2 className="font-headline text-3xl font-bold">Быстрая заметка</h2>
      </div>

      <div className="flex-grow flex flex-col items-center justify-center relative w-full h-full mt-16">
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex flex-wrap justify-center items-center gap-4 bg-surface-container-high/95 backdrop-blur z-10 rounded-3xl"
            >
              {[
                { icon: Lightbulb, label: 'Идея', color: 'text-primary', border: 'border-primary/20', hoverBg: 'hover:bg-primary', hoverText: 'hover:text-on-primary' },
                { icon: Check, label: 'Задача', color: 'text-secondary', border: 'border-secondary/20', hoverBg: 'hover:bg-secondary', hoverText: 'hover:text-on-secondary' },
                { icon: Brain, label: 'Мысль', color: 'text-tertiary', border: 'border-tertiary/20', hoverBg: 'hover:bg-tertiary', hoverText: 'hover:text-on-tertiary' },
                { icon: Bell, label: 'Напоминание', color: 'text-error', border: 'border-error/20', hoverBg: 'hover:bg-error', hoverText: 'hover:text-on-error' }
              ].map((item, i) => (
                <div key={i} onClick={() => { onQuickNote(item.label); setIsOpen(false); }} className="flex flex-col items-center gap-2 group cursor-pointer">
                  <div className={`w-14 h-14 rounded-full bg-surface-container-highest flex items-center justify-center ${item.color} border ${item.border} ${item.hoverBg} ${item.hoverText} transition-all shadow-lg`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{item.label}</span>
                </div>
              ))}
              <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 p-2 text-on-surface-variant hover:text-white cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!isOpen && (
          <button onClick={() => setIsOpen(true)} className="w-32 h-32 rounded-full bg-primary text-on-primary-fixed shadow-[0_0_40px_rgba(175,162,255,0.4)] flex flex-col items-center justify-center hover:scale-105 transition-transform active:scale-95 group cursor-pointer">
            <Mic className="w-10 h-10 mb-2" />
            <span className="font-bold text-sm tracking-wider uppercase">Запись</span>
          </button>
        )}
      </div>
    </motion.div>
  );
};

const FocusTodayCard = ({ recordings }: { recordings: Recording[] }) => {
  const allTasks = recordings.flatMap(r => r.actionItems || []).slice(0, 3);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="col-span-12 lg:col-span-4 bg-surface-container-low p-8 rounded-3xl border border-outline-variant/10"
    >
      <h3 className="font-label text-on-surface-variant text-[10px] font-black tracking-[0.2em] mb-6 uppercase">Фокус на сегодня</h3>
      <div className="space-y-8">
        {allTasks.length > 0 ? allTasks.map((task, i) => (
          <div key={i} className={`relative pl-6 border-l-2 ${i === 0 ? 'border-secondary' : 'border-outline-variant'}`}>
            <h4 className={`font-headline text-xl leading-tight ${i !== 0 ? 'text-on-surface/60' : ''}`}>{task}</h4>
          </div>
        )) : (
          <div className="text-on-surface-variant text-sm">Нет задач на сегодня.</div>
        )}
      </div>
    </motion.div>
  );
};

const IdeasCard = ({ recordings }: { recordings: Recording[] }) => {
  const allIdeas = recordings.flatMap(r => r.ideas || []).slice(0, 4);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="col-span-12 lg:col-span-8 bg-surface-container p-10 rounded-3xl overflow-hidden relative"
    >
      <div className="flex justify-between items-start mb-10">
        <h3 className="font-headline text-4xl font-bold">Идеи & Инсайты</h3>
        <span className="px-4 py-1 rounded-full bg-tertiary/10 text-tertiary font-bold text-[10px] tracking-widest uppercase">{allIdeas.length} Новых</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {allIdeas.length > 0 ? allIdeas.map((idea, i) => (
          <div key={i} className="bg-surface-container-highest p-6 rounded-2xl flex items-start gap-4 hover:translate-y-[-4px] transition-transform">
            <Brain className="text-secondary w-6 h-6 flex-shrink-0" />
            <div>
              <p className="font-body text-sm font-bold">{idea}</p>
            </div>
          </div>
        )) : (
          <div className="col-span-2 text-on-surface-variant text-sm">Нет новых идей.</div>
        )}
      </div>
    </motion.div>
  );
};

const AITipCard = ({ dailyTip, isGeneratingTip }: { dailyTip: { title: string, text: string } | null, isGeneratingTip: boolean }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.4 }}
    className="col-span-12 lg:col-span-5 relative"
  >
    <div className="bg-tertiary text-on-tertiary-container p-12 rounded-[40px] h-full flex flex-col justify-end editorial-shadow relative overflow-hidden">
      {isGeneratingTip ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-tertiary/80 backdrop-blur-sm z-10">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <span className="text-sm font-bold tracking-widest uppercase">Генерация совета...</span>
        </div>
      ) : null}
      <Lightbulb className="w-16 h-16 mb-6 opacity-30" />
      <h3 className="font-headline text-xs font-black tracking-[0.3em] uppercase mb-4 text-on-tertiary-fixed">{dailyTip?.title || 'Совет дня от AI'}</h3>
      <p className="font-headline text-3xl font-extrabold leading-tight italic">"{dailyTip?.text || 'Записывайте свои мысли чаще, чтобы ИИ мог давать более точные советы.'}"</p>
    </div>
  </motion.div>
);

const ActivityChartCard = ({ recordings }: { recordings: Recording[] }) => {
  // Calculate total minutes
  const totalSeconds = recordings.reduce((acc, r) => {
    if (!r.duration) return acc;
    const [m, s] = r.duration.split(':').map(Number);
    return acc + (m * 60) + (s || 0);
  }, 0);
  const totalMinutes = Math.round(totalSeconds / 60);

  // Simple mock distribution if we have recordings, otherwise empty
  const data = recordings.length > 0 ? [
    { name: 'ПН', value: Math.round(totalMinutes * 0.2) },
    { name: 'ВТ', value: Math.round(totalMinutes * 0.3) },
    { name: 'СР', value: Math.round(totalMinutes * 0.1) },
    { name: 'ЧТ', value: Math.round(totalMinutes * 0.25) },
    { name: 'ПТ', value: Math.round(totalMinutes * 0.15) },
    { name: 'СБ', value: 0 },
    { name: 'ВС', value: 0 },
  ] : [
    { name: 'ПН', value: 0 },
    { name: 'ВТ', value: 0 },
    { name: 'СР', value: 0 },
    { name: 'ЧТ', value: 0 },
    { name: 'ПТ', value: 0 },
    { name: 'СБ', value: 0 },
    { name: 'ВС', value: 0 },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="col-span-12 lg:col-span-7 bg-surface-container rounded-3xl p-10 flex flex-col"
    >
      <div className="flex justify-between items-end mb-8">
        <div>
          <h3 className="font-headline text-3xl font-bold mb-1">Активность записей</h3>
          <p className="text-sm text-on-surface-variant font-body">Время общения в минутах по дням недели</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-headline font-black text-primary">{totalMinutes}</p>
          <p className="text-[10px] font-label font-bold text-outline tracking-widest uppercase">Минут за неделю</p>
        </div>
      </div>
      <div className="flex-grow w-full h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8E9299', fontSize: 10, fontWeight: 'bold' }} dy={10} />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{ backgroundColor: '#1c1c21', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
              itemStyle={{ color: '#afa2ff', fontWeight: 'bold' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#afa2ff' : 'rgba(175, 162, 255, 0.3)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

const WeeklyGoalsCard = ({ recordings }: { recordings: Recording[] }) => {
  const goalRecordings = 10;
  const currentRecordings = recordings.length;
  const percentRecordings = Math.min(100, Math.round((currentRecordings / goalRecordings) * 100));

  const goalTasks = 5;
  const currentTasks = recordings.reduce((acc, r) => acc + (r.actionItems?.length || 0), 0);
  const percentTasks = Math.min(100, Math.round((currentTasks / goalTasks) * 100));

  return (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.6 }}
    className="col-span-12 lg:col-span-4 space-y-8"
  >
    <div className="bg-surface-container-high p-8 rounded-3xl border border-white/5">
      <h3 className="font-headline text-xl font-bold mb-6">Цели недели</h3>
      <div className="space-y-6">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-bold">{goalRecordings} записей</span>
            <span className="text-sm text-secondary">{percentRecordings}%</span>
          </div>
          <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-secondary shadow-[0_0_10px_#4af8e3]" style={{ width: `${percentRecordings}%` }}></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm font-bold">{goalTasks} задач из записей</span>
            <span className="text-sm text-primary">{percentTasks}%</span>
          </div>
          <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-primary shadow-[0_0_10px_#afa2ff]" style={{ width: `${percentTasks}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  </motion.div>
  );
};

const WeeklyDigestCard = ({ recordings, setCurrentView }: { recordings: Recording[], setCurrentView: (view: string) => void }) => {
  const totalSeconds = recordings.reduce((acc, r) => {
    if (!r.duration) return acc;
    const [m, s] = r.duration.split(':').map(Number);
    return acc + (m * 60) + (s || 0);
  }, 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const totalTasks = recordings.reduce((acc, r) => acc + (r.actionItems?.length || 0), 0);
  const totalIdeas = recordings.reduce((acc, r) => acc + (r.ideas?.length || 0), 0);

  return (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.7 }}
    className="col-span-12 lg:col-span-8 bg-surface-bright p-1 rounded-3xl overflow-hidden shadow-2xl"
  >
    <div className="bg-surface-container p-10 rounded-[22px] h-full">
      <div className="flex flex-col md:flex-row justify-between gap-8">
        <div className="md:w-1/2">
          <h3 className="font-headline text-4xl font-black mb-4 leading-none">Недельный Дайджест</h3>
          <p className="font-body text-on-surface-variant mb-6 italic">
            {recordings.length > 0 
              ? `Вы сделали ${recordings.length} записей. ИИ выделил ${totalTasks} задач и ${totalIdeas} идей.` 
              : 'У вас пока нет записей на этой неделе. Начните записывать встречи, чтобы ИИ собрал дайджест.'}
          </p>
          <button onClick={() => setCurrentView('analytics')} className="flex items-center gap-2 text-primary font-bold font-label text-xs tracking-widest uppercase hover:gap-4 transition-all cursor-pointer">
            Читать полный отчет <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="md:w-1/2 grid grid-cols-2 gap-4">
          {[
            { label: 'Всего минут', value: totalMinutes.toString() },
            { label: 'Транскриптов', value: recordings.length.toString() },
            { label: 'Задач', value: totalTasks.toString() },
            { label: 'Идей', value: totalIdeas.toString() }
          ].map((stat, i) => (
            <div key={i} className="bg-surface-container-low p-4 rounded-xl border border-white/5">
              <p className="text-xs text-outline mb-1">{stat.label}</p>
              <p className="text-2xl font-headline font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </motion.div>
  );
};

const RecentRecordings = ({ recordings, onOpenLibrary, onOpenDetail }: { recordings: Recording[], onOpenLibrary: () => void, onOpenDetail: (id: string) => void }) => {
  const recent = recordings.slice(0, 4);

  return (
  <motion.section 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.8 }}
    className="mb-20"
  >
    <div className="flex items-end justify-between mb-10">
      <h2 className="font-headline text-5xl font-black tracking-tighter">Недавнее</h2>
      <div className="flex gap-4 items-center">
        <button onClick={onOpenLibrary} className="ml-4 text-primary font-bold text-sm hover:underline">Все записи</button>
      </div>
    </div>
    
    {recent.length === 0 ? (
      <div className="bg-surface-container rounded-3xl p-12 text-center border border-white/5">
        <div className="w-20 h-20 rounded-full bg-surface-container-highest flex items-center justify-center mx-auto mb-6 text-on-surface-variant">
          <AudioLines className="w-10 h-10" />
        </div>
        <h3 className="font-headline text-2xl font-bold mb-2">Нет записей</h3>
        <p className="text-on-surface-variant">Нажмите на кнопку микрофона, чтобы начать первую запись.</p>
      </div>
    ) : (
      <div className="grid grid-cols-12 gap-8">
        {recent[0] && (
          <div className="col-span-12 lg:col-span-8 group cursor-pointer" onClick={() => onOpenDetail(recent[0].id)}>
            <div className="relative rounded-[40px] overflow-hidden aspect-[16/9] mb-6 bg-surface-container-high border border-white/5 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-tertiary/20 opacity-50 group-hover:opacity-80 transition-opacity duration-700"></div>
              <AudioLines className="w-32 h-32 text-primary/30 group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end">
                <div>
                  <span className="bg-primary text-on-primary-fixed px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 inline-block">Последняя</span>
                  <h3 className="font-headline text-4xl font-bold text-white">{recent[0].title}</h3>
                </div>
                <div className="flex items-center gap-4 text-white">
                  <PlayCircle className="w-10 h-10" />
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              {(recent[0].tags || []).map((tag, i) => (
                <span key={i} className="px-3 py-1 bg-surface-container-highest rounded-lg text-xs font-medium text-on-surface-variant">{tag}</span>
              ))}
            </div>
          </div>
        )}
        
        <div className="col-span-12 lg:col-span-4 space-y-8">
          {recent.slice(1).map((item, i) => (
            <div key={item.id} onClick={() => onOpenDetail(item.id)} className="flex gap-6 group cursor-pointer bg-surface-container p-4 rounded-2xl border border-transparent hover:border-white/10 transition-colors">
              <div className="w-24 h-24 flex-shrink-0 rounded-2xl overflow-hidden bg-surface-container-highest flex items-center justify-center">
                <AudioLines className="w-10 h-10 text-on-surface-variant group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-label font-bold text-primary tracking-widest uppercase mb-1`}>{item.date}</p>
                <h4 className={`font-headline text-lg font-bold group-hover:text-primary transition-colors leading-tight truncate`}>{item.title}</h4>
                <p className="text-sm text-on-surface-variant mt-2 line-clamp-2">{item.summary}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </motion.section>
  );
};

const NotesGallery = ({ notes, onBack, setCurrentView, onLogout, onDeleteNote }: { notes: Note[], onBack: () => void, setCurrentView: (view: string) => void, onLogout: () => void, onDeleteNote: (id: string) => void }) => {
  return (
    <div className="min-h-screen bg-background text-on-surface flex font-body selection:bg-primary/30 w-full">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-container-low border-r border-white/5 flex-col hidden md:flex">
        <div className="p-8 cursor-pointer" onClick={onBack}>
          <h1 className="text-2xl font-black tracking-tighter text-primary uppercase font-headline">The Archivist</h1>
          <p className="text-[10px] text-on-surface-variant tracking-widest mt-1">V0.1.4-BETA</p>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <div onClick={() => setCurrentView('gallery')} className="flex items-center gap-4 px-4 py-3 bg-surface-container-highest border-l-2 border-primary rounded-r-lg text-primary cursor-pointer">
            <FolderOpen className="w-5 h-5" />
            <span className="font-bold text-xs tracking-widest uppercase">Archive</span>
          </div>
          <div onClick={() => setCurrentView('analytics')} className="flex items-center gap-4 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
            <AudioLines className="w-5 h-5" />
            <span className="font-bold text-xs tracking-widest uppercase">Analytics</span>
          </div>
          <div onClick={() => setCurrentView('tags')} className="flex items-center gap-4 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
            <Target className="w-5 h-5" />
            <span className="font-bold text-xs tracking-widest uppercase">Tags</span>
          </div>
          <div onClick={() => setCurrentView('settings')} className="flex items-center gap-4 px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
            <Settings className="w-5 h-5" />
            <span className="font-bold text-xs tracking-widest uppercase">Settings</span>
          </div>
        </nav>
        <div className="p-6">
          <button onClick={() => setCurrentView('recording_session')} className="w-full py-4 bg-primary text-on-primary-fixed rounded-xl font-bold text-sm hover:scale-105 transition-transform shadow-[0_0_20px_rgba(175,162,255,0.2)] cursor-pointer">
            New Recording
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background">
         {/* Top Nav */}
         <header className="flex justify-between items-center px-6 md:px-12 py-8">
           <div className="flex items-center gap-4">
             <button onClick={onBack} className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container hover:bg-white/10 transition-colors text-on-surface-variant hover:text-white">
               <ArrowLeft className="w-5 h-5" />
             </button>
             <div className="md:hidden text-2xl font-black tracking-tighter text-primary uppercase font-headline cursor-pointer" onClick={onBack}>
               ARCHIVIST
             </div>
           </div>
           <div className="hidden md:flex gap-8 font-label text-slate-400 text-xs font-bold tracking-widest uppercase ml-auto mr-12">
             <span onClick={() => setCurrentView('gallery')} className="text-primary cursor-pointer">Archive</span>
             <span onClick={() => setCurrentView('analytics')} className="hover:text-white transition-colors cursor-pointer">Analytics</span>
             <span onClick={() => setCurrentView('tags')} className="hover:text-white transition-colors cursor-pointer">Tags</span>
           </div>
           <div className="flex items-center gap-6">
             <Settings onClick={() => setCurrentView('settings')} className="text-slate-400 cursor-pointer hover:text-white transition-colors w-5 h-5" />
             <button onClick={onLogout} title="Выйти" className="cursor-pointer">
               <UserCircle className="text-slate-400 hover:text-white transition-colors w-6 h-6" />
             </button>
           </div>
         </header>

         <div className="px-6 md:px-12 pb-20 max-w-6xl mx-auto">
           {/* Header */}
           <div className="mb-12">
             <h1 className="font-headline text-5xl md:text-6xl font-black tracking-tighter mb-4">
               Архив <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">быстрых мыслей</span>
             </h1>
             <p className="text-on-surface-variant text-lg max-w-2xl">
               Ваши моментальные инсайты, организованные ИИ. Каждая заметка — это цифровой артефакт вашего сознания.
             </p>
           </div>

           {/* Category Cards */}
           <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
             <div className="bg-gradient-to-br from-surface-container-highest to-surface-container p-6 rounded-3xl border border-white/5 relative overflow-hidden group cursor-pointer hover:border-primary/30 transition-colors">
               <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
                 <Lightbulb className="w-6 h-6" />
               </div>
               <h3 className="font-headline text-xl font-bold mb-2">Идеи</h3>
               <div className="flex justify-between items-end">
                 <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Collection</span>
                 <span className="font-headline text-2xl font-black text-primary">{notes.filter(n => n.type === 'Идея').length}</span>
               </div>
             </div>
             <div className="bg-gradient-to-br from-surface-container-highest to-surface-container p-6 rounded-3xl border border-white/5 relative overflow-hidden group cursor-pointer hover:border-secondary/30 transition-colors">
               <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mb-6">
                 <CheckCircle2 className="w-6 h-6" />
               </div>
               <h3 className="font-headline text-xl font-bold mb-2">Задачи</h3>
               <div className="flex justify-between items-end">
                 <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Urgent</span>
                 <span className="font-headline text-2xl font-black text-secondary">{notes.filter(n => n.type === 'Задача').length}</span>
               </div>
             </div>
             <div className="bg-gradient-to-br from-surface-container-highest to-surface-container p-6 rounded-3xl border border-white/5 relative overflow-hidden group cursor-pointer hover:border-tertiary/30 transition-colors">
               <div className="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center text-tertiary mb-6">
                 <Brain className="w-6 h-6" />
               </div>
               <h3 className="font-headline text-xl font-bold mb-2">Мысли</h3>
               <div className="flex justify-between items-end">
                 <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Stream</span>
                 <span className="font-headline text-2xl font-black text-tertiary">{notes.filter(n => n.type === 'Мысль').length}</span>
               </div>
             </div>
             <div className="bg-gradient-to-br from-surface-container-highest to-surface-container p-6 rounded-3xl border border-white/5 relative overflow-hidden group cursor-pointer hover:border-error/30 transition-colors">
               <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error mb-6">
                 <Bell className="w-6 h-6" />
               </div>
               <h3 className="font-headline text-xl font-bold mb-2">Напоминания</h3>
               <div className="flex justify-between items-end">
                 <span className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Active</span>
                 <span className="font-headline text-2xl font-black text-error">{notes.filter(n => n.type === 'Напоминание').length}</span>
               </div>
             </div>
           </div>

           {/* Search */}
           <div className="bg-surface-container-high border border-white/5 rounded-2xl p-4 flex items-center gap-4 mb-12 focus-within:border-primary/50 transition-colors shadow-lg">
             <Search className="w-6 h-6 text-on-surface-variant" />
             <input 
               type="text" 
               placeholder="Поиск по архиву мыслей..." 
               className="bg-transparent border-none outline-none flex-1 text-on-surface placeholder:text-on-surface-variant font-body"
             />
             <div className="flex gap-1">
               <kbd className="bg-surface-container-highest px-2 py-1 rounded text-xs font-mono text-on-surface-variant border border-white/10">⌘</kbd>
               <kbd className="bg-surface-container-highest px-2 py-1 rounded text-xs font-mono text-on-surface-variant border border-white/10">K</kbd>
             </div>
           </div>

           {/* Grid */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {notes.length === 0 ? (
               <div className="col-span-3 text-center py-20 text-on-surface-variant">
                 <p>У вас пока нет быстрых заметок.</p>
               </div>
             ) : (
               notes.map(note => (
                 <div key={note.id} className="bg-surface-container-high rounded-[32px] p-8 border border-white/5 flex flex-col justify-between group cursor-pointer hover:bg-surface-container-highest transition-colors relative">
                   <div className="mb-6">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 ${
                       note.type === 'Идея' ? 'bg-primary/10 text-primary' :
                       note.type === 'Задача' ? 'bg-secondary/10 text-secondary' :
                       note.type === 'Мысль' ? 'bg-tertiary/10 text-tertiary' :
                       'bg-error/10 text-error'
                     }`}>
                       {note.type === 'Идея' && <Lightbulb className="w-5 h-5" fill="currentColor" />}
                       {note.type === 'Задача' && <CheckCircle2 className="w-5 h-5" fill="currentColor" />}
                       {note.type === 'Мысль' && <Brain className="w-5 h-5" fill="currentColor" />}
                       {note.type === 'Напоминание' && <Bell className="w-5 h-5" fill="currentColor" />}
                     </div>
                     <h4 className="font-headline text-xl font-bold mb-2">{note.type}</h4>
                     <p className="text-sm text-on-surface-variant line-clamp-3">{note.content}</p>
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">
                     <Clock className="w-3 h-3" /> {note.date}
                   </div>
                   <button 
                     onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
                     className="absolute top-6 right-6 p-2 text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                     title="Удалить заметку"
                   >
                     <Trash2 className="w-5 h-5" />
                   </button>
                 </div>
               ))
             )}
           </div>
         </div>
      </main>
    </div>
  );
};

const QuickNoteModal = ({ type, onClose, onSave, showToast }: { type: string, onClose: () => void, onSave: (note: Note) => void, showToast: (msg: string, type: 'success' | 'error' | 'info') => void }) => {
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    // Automatically start recording when the modal opens
    startRecording();
    
    // Cleanup on unmount
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processAudio(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      showToast("Не удалось получить доступ к микрофону.", 'error');
      onClose();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Audio = await base64Promise;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: blob.type || 'audio/webm'
            }
          },
          `Please transcribe this short audio note. It is a "${type}". Transcribe the audio EXACTLY in the language it was spoken. If the audio is empty, silent, or contains no speech, return strictly "[Тишина]". Do not invent or hallucinate speech. Return only the transcribed text.`
        ]
      });

      const transcribedText = response.text || '';
      
      const newNote: Note = {
        id: Date.now().toString(),
        type,
        content: transcribedText,
        date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      };
      onSave(newNote);
      onClose();
    } catch (err) {
      console.warn("Error processing audio note:", err);
      showToast("Ошибка ИИ. Заметка сохранена как аудио.", 'error');
      
      const fallbackNote: Note = {
        id: Date.now().toString(),
        type,
        content: "[Аудиозапись не распознана из-за ошибки сети или квоты]",
        date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      };
      onSave(fallbackNote);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-surface-container-high border border-white/10 rounded-[32px] p-8 max-w-md w-full relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-on-surface-variant hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
        <div className="text-center mb-6">
          <h3 className="font-headline text-2xl font-bold mb-2">Новая {type.toLowerCase()}</h3>
          <p className="text-on-surface-variant text-sm">Скажите вашу мысль</p>
        </div>

        <div className="flex flex-col items-center gap-6 py-4">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-on-surface-variant text-sm animate-pulse">Обработка аудио ИИ...</p>
            </div>
          ) : (
            <>
              <div className="text-4xl font-mono font-light text-primary">
                {formatTime(duration)}
              </div>
              
              <button 
                onClick={stopRecording}
                className="w-20 h-20 rounded-full bg-surface-container-highest border border-white/10 text-error flex items-center justify-center hover:scale-105 transition-transform cursor-pointer relative"
              >
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }} 
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute w-full h-full rounded-full bg-error/20"
                />
                <Square className="w-8 h-8" fill="currentColor" />
              </button>
              <p className="text-xs text-on-surface-variant">
                Нажмите для остановки и сохранения
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const RecordingsLibrary = ({ recordings, onBack, onOpenDetail, onDeleteRecording }: { recordings: Recording[], onBack: () => void, onOpenDetail: (id: string) => void, onDeleteRecording: (id: string) => void }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredRecordings = recordings.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
    r.transcript.some(t => t.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body selection:bg-primary/30 w-full">
      <header className="flex items-center px-6 md:px-12 py-8 border-b border-white/5 bg-surface-container-low sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors mr-8 cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-xs tracking-widest uppercase">Назад</span>
        </button>
        <h1 className="text-2xl font-black tracking-tighter text-primary uppercase font-headline">Библиотека записей</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-6 md:p-12 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-end mb-10">
          <div>
             <h2 className="font-headline text-4xl font-bold mb-2">Все встречи и интервью</h2>
             <p className="text-on-surface-variant">Длинные записи с транскрипцией и AI-анализом</p>
          </div>
          <div className="bg-surface-container-high border border-white/5 rounded-2xl p-3 flex items-center gap-3 w-72">
             <Search className="w-5 h-5 text-on-surface-variant" />
             <input 
               type="text" 
               placeholder="Поиск по записям..." 
               className="bg-transparent border-none outline-none flex-1 text-sm text-on-surface"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>
        </div>

        <div className="space-y-4">
          {filteredRecordings.map((item, i) => (
            <div key={item.id} onClick={() => onOpenDetail(item.id)} className="bg-surface-container p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer hover:bg-surface-container-high transition-colors group">
              <div className="flex items-center gap-6">
                <div className={`w-14 h-14 rounded-full bg-surface-container-highest flex items-center justify-center text-primary group-hover:scale-110 transition-transform`}>
                  <PlayCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-headline text-xl font-bold mb-1">{item.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {item.date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {item.duration}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="flex gap-2">
                  {item.tags.map(tag => <span key={tag} className="px-3 py-1 bg-surface-container-highest rounded-lg text-xs font-medium text-on-surface-variant">{tag}</span>)}
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteRecording(item.id); }}
                  className="text-on-surface-variant hover:text-error transition-colors p-2"
                  title="Удалить запись"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button className="text-on-surface-variant group-hover:text-white transition-colors">
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredRecordings.length === 0 && (
          <div className="text-center py-20">
            <div className="w-24 h-24 rounded-full bg-surface-container-highest flex items-center justify-center mx-auto mb-6 text-on-surface-variant">
              <AudioLines className="w-10 h-10" />
            </div>
            <h3 className="font-headline text-2xl font-bold mb-2">Записей не найдено</h3>
            <p className="text-on-surface-variant max-w-md mx-auto">У вас пока нет записей или по вашему запросу ничего не найдено.</p>
          </div>
        )}
      </main>
    </div>
  );
};

const RecordingSession = ({ onFinish, onCancel, showToast }: { onFinish: (blob: Blob, duration: number) => void, onCancel: () => void, showToast: (msg: string, type: 'success' | 'error' | 'info') => void }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setDuration(d => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onFinish(blob, duration);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      showToast("Не удалось получить доступ к микрофону.", 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col items-center justify-center font-body selection:bg-primary/30 w-full relative">
      <div className="absolute top-8 left-8">
        <button onClick={onCancel} className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-xs tracking-widest uppercase">Отмена</span>
        </button>
      </div>
      
      <div className="text-center mb-12">
        <h2 className="font-headline text-4xl font-bold mb-4">Живая сессия</h2>
        <p className="text-on-surface-variant">Запись встречи или интервью</p>
      </div>

      <div className="relative flex items-center justify-center mb-16">
        {isRecording && (
          <>
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }} 
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute w-64 h-64 rounded-full bg-error/20 blur-xl"
            />
            <motion.div 
              animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2] }} 
              transition={{ repeat: Infinity, duration: 2, delay: 0.2 }}
              className="absolute w-64 h-64 rounded-full bg-error/10 blur-2xl"
            />
          </>
        )}
        <div className="w-48 h-48 rounded-full bg-surface-container-high border-4 border-surface-container flex items-center justify-center z-10 relative shadow-2xl">
          <div className="text-5xl font-mono font-bold text-white tracking-wider">
            {formatTime(duration)}
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {!isRecording ? (
          <button onClick={startRecording} className="w-20 h-20 rounded-full bg-error text-white flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,84,73,0.4)] cursor-pointer">
            <Mic className="w-8 h-8" fill="currentColor" />
          </button>
        ) : (
          <button onClick={stopRecording} className="w-20 h-20 rounded-full bg-surface-container-highest text-error flex items-center justify-center hover:scale-105 transition-transform border border-error/30 cursor-pointer">
            <div className="w-6 h-6 rounded bg-error"></div>
          </button>
        )}
      </div>
    </div>
  );
};

const RecordingDetail = ({ recording, onBack, onDelete, onUpdate, showToast }: { recording: Recording, onBack: () => void, onDelete: () => void, onUpdate: (r: Recording) => void, showToast: (msg: string, type: 'success' | 'error' | 'info') => void }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeTab, setActiveTab] = useState<'transcript' | 'keyMoments'>('transcript');
  const [isAppending, setIsAppending] = useState(false);
  const [appendQuery, setAppendQuery] = useState('');
  const [isProcessingAppend, setIsProcessingAppend] = useState(false);

  const handleAppend = async () => {
    if (!appendQuery.trim()) return;
    setIsProcessingAppend(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
        You are an AI assistant helping to update a personal voice notepad recording.
        Current Recording:
        Title: ${recording.title}
        Summary: ${recording.summary}
        Ideas: ${JSON.stringify(recording.ideas || [])}
        Action Items: ${JSON.stringify(recording.actionItems || [])}
        
        The user wants to add the following thought/idea/task: "${appendQuery}"
        
        Update the recording's data. If it's an idea, add it to ideas. If it's a task, add it to actionItems. If it's general info, update the summary.
        Return the updated JSON object with fields: "summary", "ideas" (array of strings), "actionItems" (array of strings).
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              ideas: { type: Type.ARRAY, items: { type: Type.STRING } },
              actionItems: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['summary', 'ideas', 'actionItems']
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      const updatedRecording = {
        ...recording,
        summary: result.summary || recording.summary,
        ideas: result.ideas || recording.ideas,
        actionItems: result.actionItems || recording.actionItems
      };
      
      onUpdate(updatedRecording);
      setIsAppending(false);
      setAppendQuery('');
      showToast('Запись успешно дополнена', 'success');
    } catch (error) {
      console.error('Error appending to recording:', error);
      showToast('Ошибка при дополнении записи', 'error');
    } finally {
      setIsProcessingAppend(false);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      const setAudioData = () => {
        setDuration(audio.duration);
      };
      const setAudioTime = () => setCurrentTime(audio.currentTime);
      const handleEnded = () => setIsPlaying(false);

      audio.addEventListener('loadeddata', setAudioData);
      audio.addEventListener('timeupdate', setAudioTime);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.removeEventListener('loadeddata', setAudioData);
        audio.removeEventListener('timeupdate', setAudioTime);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimestampClick = (timestamp: string) => {
    if (audioRef.current) {
      const parts = timestamp.split(':');
      let timeInSeconds = 0;
      if (parts.length === 3) {
        timeInSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
      } else if (parts.length === 2) {
        timeInSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      }
      
      audioRef.current.currentTime = timeInSeconds;
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: recording.title,
          text: recording.summary,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(`${recording.title}\n\n${recording.summary}`);
        showToast('Ссылка скопирована в буфер обмена', 'success');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleExport = () => {
    const text = `Название: ${recording.title}\nДата: ${recording.date}\nДлительность: ${recording.duration}\nНастроение: ${recording.mood || 'Неизвестно'}\n\nСаммари:\n${recording.summary}\n\nИдеи:\n${(recording.ideas || []).map(i => `- ${i}`).join('\n')}\n\nЗадачи:\n${(recording.actionItems || []).map(t => `- ${t}`).join('\n')}\n\nТранскрипт:\n${recording.transcript.map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recording.title}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseTimestamp = (timestamp: string) => {
    const parts = timestamp.split(':');
    let timeInSeconds = 0;
    if (parts.length === 3) {
      timeInSeconds = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    } else if (parts.length === 2) {
      timeInSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return timeInSeconds;
  };

  const getActiveTranscriptIndex = () => {
    if (!recording.transcript || recording.transcript.length === 0) return -1;
    for (let i = recording.transcript.length - 1; i >= 0; i--) {
      if (currentTime >= parseTimestamp(recording.transcript[i].timestamp)) {
        return i;
      }
    }
    return 0;
  };

  const activeTranscriptIndex = getActiveTranscriptIndex();

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body selection:bg-primary/30 w-full">
      <header className="flex items-center justify-between px-6 md:px-12 py-6 border-b border-white/5 bg-surface-container-low sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container hover:bg-white/10 transition-colors text-on-surface-variant hover:text-white cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold font-headline">{recording.title}</h1>
            <p className="text-xs text-on-surface-variant">{recording.date} • {recording.duration}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleShare} className="px-4 py-2 bg-surface-container rounded-lg text-sm font-bold hover:bg-white/10 transition-colors cursor-pointer">Поделиться</button>
          <button onClick={handleExport} className="px-4 py-2 bg-primary text-on-primary-fixed rounded-lg text-sm font-bold hover:scale-105 transition-transform cursor-pointer">Экспорт</button>
          <button onClick={onDelete} className="px-4 py-2 bg-error/10 text-error rounded-lg text-sm font-bold hover:bg-error/20 transition-colors cursor-pointer flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Удалить
          </button>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto p-6 md:p-12 max-w-[1440px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Player & AI Summary */}
        <div className="lg:col-span-5 space-y-8">
          {/* Audio Player */}
          <div className="bg-surface-container p-8 rounded-[32px] border border-white/5">
            {recording.audioUrl && (
              <audio ref={audioRef} src={recording.audioUrl} className="hidden" />
            )}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="w-14 h-14 rounded-full bg-primary text-on-primary-fixed flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_20px_rgba(175,162,255,0.3)] cursor-pointer">
                  {isPlaying ? <Pause className="w-6 h-6" fill="currentColor" /> : <Play className="w-6 h-6 ml-1" fill="currentColor" />}
                </button>
                <div>
                  <p className="font-bold text-lg">{formatTime(currentTime)} / {recording.audioUrl ? formatTime(duration) : recording.duration}</p>
                  <p className="text-xs text-on-surface-variant">Оригинальная аудиозапись</p>
                </div>
              </div>
              <Volume2 className="text-on-surface-variant w-5 h-5" />
            </div>
            <div className="h-2 w-full bg-surface-container-highest rounded-full mb-2 relative cursor-pointer" onClick={(e) => {
              if (audioRef.current && duration > 0) {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                audioRef.current.currentTime = pos * duration;
              }
            }}>
              <div className="h-full bg-primary transition-all duration-100 rounded-full" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}></div>
              {duration > 0 && recording.transcript.map((t, i) => {
                const time = parseTimestamp(t.timestamp);
                const left = (time / duration) * 100;
                return (
                  <div 
                    key={i} 
                    className="absolute top-1/2 -translate-y-1/2 w-1 h-1 bg-white rounded-full shadow-sm"
                    style={{ left: `${left}%` }}
                    title={t.text.substring(0, 50) + '...'}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-on-surface-variant font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>{recording.audioUrl ? formatTime(duration) : recording.duration}</span>
            </div>
          </div>

          {/* AI Summary */}
          <div className="bg-surface-container-high p-8 rounded-[32px] border border-white/5">
            <div className="flex items-center gap-3 mb-6">
              <Brain className="w-6 h-6 text-tertiary" />
              <h2 className="font-headline text-2xl font-bold">AI Саммари</h2>
            </div>
            
            {recording.mood && (
              <div className="mb-6">
                <h3 className="flex items-center gap-2 font-bold text-sm mb-3 text-on-surface">
                  <span className="text-xl">✨</span> Настроение
                </h3>
                <div className="inline-block px-4 py-2 bg-surface-container rounded-xl text-sm font-bold text-primary">
                  {recording.mood}
                </div>
              </div>
            )}

            {recording.mentions && recording.mentions.length > 0 && (
              <div className="mb-6">
                <h3 className="flex items-center gap-2 font-bold text-sm mb-3 text-on-surface">
                  <Target className="w-4 h-4 text-tertiary" /> Упоминания
                </h3>
                <div className="flex flex-wrap gap-2">
                  {recording.mentions.map((m, i) => (
                    <span key={i} className="px-3 py-1 bg-tertiary/10 text-tertiary rounded-full text-xs font-bold">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              <h3 className="font-bold text-sm mb-3 text-on-surface">Краткое содержание</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {recording.summary}
              </p>
            </div>
            
            <div className="space-y-6">
              {recording.ideas && recording.ideas.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 font-bold text-sm mb-3 text-primary">
                    <Brain className="w-4 h-4" /> Идеи и инсайты
                  </h3>
                  <ul className="space-y-2">
                    {recording.ideas.map((idea, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
                        <span>{idea}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {recording.actionItems && recording.actionItems.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 font-bold text-sm mb-3 text-secondary">
                    <ListTodo className="w-4 h-4" /> Задачи / Что сделать
                  </h3>
                  <ul className="space-y-2">
                    {recording.actionItems.map((task, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant bg-surface-container p-3 rounded-xl">
                        <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-1.5 flex-shrink-0"></div>
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Transcript */}
        <div className="lg:col-span-7 bg-surface-container p-8 rounded-[32px] border border-white/5 flex flex-col h-[800px]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-primary" />
              <h2 className="font-headline text-2xl font-bold">Транскрипт</h2>
            </div>
            <div className="bg-surface-container-highest rounded-lg p-1 flex text-xs font-bold">
              <button 
                onClick={() => setActiveTab('transcript')}
                className={`px-4 py-1.5 rounded transition-colors ${activeTab === 'transcript' ? 'bg-surface-container-low shadow text-white' : 'text-on-surface-variant hover:text-white'}`}>
                Текст
              </button>
              <button 
                onClick={() => setActiveTab('keyMoments')}
                className={`px-4 py-1.5 rounded transition-colors ${activeTab === 'keyMoments' ? 'bg-surface-container-low shadow text-white' : 'text-on-surface-variant hover:text-white'}`}>
                Ключевые моменты
              </button>
            </div>
          </div>
          
          {activeTab === 'transcript' ? (
            <div className="flex-1 overflow-y-auto pr-4 space-y-8">
              {recording.transcript.map((item, i) => {
                const isActive = i === activeTranscriptIndex;
                return (
                <div key={i} className={`flex gap-4 p-4 rounded-2xl transition-colors ${isActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-surface-container-highest'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 mt-1 ${isActive ? 'bg-primary text-on-primary-fixed' : 'bg-primary/20 text-primary'}`}>
                    {item.speaker.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className={`font-bold text-base ${isActive ? 'text-primary' : ''}`}>{item.speaker}</span>
                      <button 
                        onClick={() => handleTimestampClick(item.timestamp)}
                        className={`text-xs font-mono hover:underline cursor-pointer px-1.5 py-0.5 rounded transition-colors ${isActive ? 'bg-primary text-on-primary-fixed' : 'text-primary bg-primary/10'}`}
                        title="Воспроизвести с этого момента"
                      >
                        {item.timestamp}
                      </button>
                    </div>
                    <p className={`text-base leading-relaxed text-justify ${isActive ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                      {item.text}
                    </p>
                  </div>
                </div>
              )})}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-4 space-y-4">
              {recording.keyMoments && recording.keyMoments.length > 0 ? (
                <ul className="space-y-4">
                  {recording.keyMoments.map((moment, i) => (
                    <li key={i} className="flex items-start gap-3 text-base text-on-surface-variant bg-surface-container-high p-4 rounded-2xl border border-white/5">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                      <span className="leading-relaxed">{moment}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-20 text-on-surface-variant">
                  <p>Ключевые моменты не найдены.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Append UI */}
      <AnimatePresence>
        {isAppending && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-0 left-0 w-full bg-surface-container-high border-t border-white/5 p-6 z-50 shadow-[0_-20px_40px_rgba(0,0,0,0.5)]"
          >
            <div className="max-w-3xl mx-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-headline font-bold text-lg">Дополнить запись</h3>
                <button onClick={() => setIsAppending(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex gap-4">
                <input 
                  type="text"
                  value={appendQuery}
                  onChange={(e) => setAppendQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAppend()}
                  placeholder="Например: Добавь задачу 'Купить билеты' или идею 'Сделать редизайн'"
                  className="flex-1 bg-surface-container border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-colors"
                  disabled={isProcessingAppend}
                />
                <button 
                  onClick={handleAppend}
                  disabled={!appendQuery.trim() || isProcessingAppend}
                  className="bg-primary text-on-primary-fixed px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isProcessingAppend ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  Добавить
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isAppending && (
        <button 
          onClick={() => setIsAppending(true)}
          className="fixed bottom-8 right-8 bg-surface-container-high border border-white/10 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 hover:bg-surface-container-highest transition-colors z-40 font-bold"
        >
          <Plus className="w-5 h-5 text-primary" /> Дополнить
        </button>
      )}
    </div>
  );
};

const AnalyticsView = ({ recordings, onBack }: { recordings: Recording[], onBack: () => void }) => {
  const totalSeconds = recordings.reduce((acc, r) => {
    if (!r.duration) return acc;
    const [m, s] = r.duration.split(':').map(Number);
    return acc + (m * 60) + (s || 0);
  }, 0);
  const totalMinutes = Math.round(totalSeconds / 60);

  const activityData = recordings.length > 0 ? [
    { name: 'ПН', value: Math.round(totalMinutes * 0.2) },
    { name: 'ВТ', value: Math.round(totalMinutes * 0.3) },
    { name: 'СР', value: Math.round(totalMinutes * 0.1) },
    { name: 'ЧТ', value: Math.round(totalMinutes * 0.25) },
    { name: 'ПТ', value: Math.round(totalMinutes * 0.15) },
    { name: 'СБ', value: 0 },
    { name: 'ВС', value: 0 },
  ] : [
    { name: 'ПН', value: 0 },
    { name: 'ВТ', value: 0 },
    { name: 'СР', value: 0 },
    { name: 'ЧТ', value: 0 },
    { name: 'ПТ', value: 0 },
    { name: 'СБ', value: 0 },
    { name: 'ВС', value: 0 },
  ];

  const tagCounts: Record<string, number> = {};
  recordings.forEach(r => {
    r.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const colors = ['#7B61FF', '#4af8e3', '#FF61A6', '#FFB061', '#54C5FF'];
  const topicsData = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value], index) => ({
      name,
      value,
      fill: colors[index % colors.length]
    }));

  if (topicsData.length === 0) {
    topicsData.push({ name: 'Нет данных', value: 1, fill: '#333' });
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body selection:bg-primary/30 w-full">
      <header className="flex items-center px-6 md:px-12 py-8 border-b border-white/5 bg-surface-container-low sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors mr-8 cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-xs tracking-widest uppercase">Назад</span>
        </button>
        <h1 className="text-2xl font-black tracking-tighter text-primary uppercase font-headline">Аналитика</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-6 md:p-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-12 gap-8 mb-8">
          <div className="col-span-12 lg:col-span-8 bg-surface-container p-8 rounded-3xl border border-white/5">
            <h3 className="font-headline text-2xl font-bold mb-6">Активность по дням</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#8E9299', fontSize: 10, fontWeight: 'bold' }} dy={10} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: '#1c1c21', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#afa2ff', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {activityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.value > 80 ? '#afa2ff' : 'rgba(175, 162, 255, 0.3)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4 bg-surface-container p-8 rounded-3xl border border-white/5">
            <h3 className="font-headline text-2xl font-bold mb-6">Темы</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topicsData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} stroke="none">
                    {topicsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1c1c21', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#8E9299' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 bg-surface-container p-8 rounded-3xl border border-white/5">
            <h3 className="font-headline text-2xl font-bold mb-6">Ключевые инсайты</h3>
            <div className="space-y-4">
              {recordings.length > 0 ? (
                <>
                  <div className="bg-surface-container-high p-4 rounded-xl border border-white/5">
                    <p className="text-on-surface-variant text-sm">Вы записали {recordings.length} сессий общей длительностью {totalMinutes} минут.</p>
                  </div>
                  {topicsData.length > 0 && topicsData[0].name !== 'Нет данных' && (
                    <div className="bg-surface-container-high p-4 rounded-xl border border-white/5">
                      <p className="text-on-surface-variant text-sm">Самая популярная тема ваших записей: "{topicsData[0].name}".</p>
                    </div>
                  )}
                  <div className="bg-surface-container-high p-4 rounded-xl border border-white/5">
                    <p className="text-on-surface-variant text-sm">ИИ выделил {recordings.reduce((acc, r) => acc + (r.actionItems?.length || 0), 0)} задач из ваших разговоров.</p>
                  </div>
                </>
              ) : (
                <div className="bg-surface-container-high p-4 rounded-xl border border-white/5">
                  <p className="text-on-surface-variant text-sm">У вас пока нет записей для формирования инсайтов.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const FocusView = ({ recordings, onBack }: { recordings: Recording[], onBack: () => void }) => {
  const allTasks = recordings.flatMap(r => (r.actionItems || []).map(t => ({ description: t, recordingTitle: r.title, recordingId: r.id })));

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body selection:bg-primary/30 w-full">
      <header className="flex items-center px-6 md:px-12 py-8 border-b border-white/5 bg-surface-container-low sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors mr-8 cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-xs tracking-widest uppercase">Назад</span>
        </button>
        <h1 className="text-2xl font-black tracking-tighter text-primary uppercase font-headline">Фокус</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-6 md:p-12 max-w-7xl mx-auto w-full">
        <div className="mb-10">
          <h2 className="font-headline text-4xl font-bold mb-2">Все задачи</h2>
          <p className="text-on-surface-variant">Задачи, извлеченные из ваших записей</p>
        </div>
        <div className="space-y-4">
          {allTasks.length > 0 ? allTasks.map((task, i) => (
            <div key={i} className="bg-surface-container p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-surface-container-high transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full border-2 border-outline-variant flex-shrink-0 mt-1 cursor-pointer hover:border-primary transition-colors"></div>
                <div>
                  <h3 className="font-headline text-xl font-bold mb-1">{task.description}</h3>
                  <p className="text-xs text-on-surface-variant">Из записи: <span className="text-primary cursor-pointer hover:underline">{task.recordingTitle}</span></p>
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-20 text-on-surface-variant">
              <Target className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>У вас пока нет задач.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const TagsView = ({ recordings, onBack }: { recordings: Recording[], onBack: () => void }) => {
  const allTags = Array.from(new Set(recordings.flatMap(r => r.tags || [])));

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body selection:bg-primary/30 w-full">
      <header className="flex items-center px-6 md:px-12 py-8 border-b border-white/5 bg-surface-container-low sticky top-0 z-10">
        <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors mr-8 cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-bold text-xs tracking-widest uppercase">Назад</span>
        </button>
        <h1 className="text-2xl font-black tracking-tighter text-primary uppercase font-headline">Теги</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-6 md:p-12 max-w-7xl mx-auto w-full">
        <div className="mb-10">
          <h2 className="font-headline text-4xl font-bold mb-2">Управление тегами</h2>
          <p className="text-on-surface-variant">Организуйте ваши записи по темам</p>
        </div>
        <div className="flex flex-wrap gap-4">
          {allTags.length > 0 ? allTags.map((tag, i) => (
            <div key={i} className="bg-surface-container px-6 py-4 rounded-2xl border border-white/5 flex items-center gap-3 cursor-pointer hover:bg-surface-container-high transition-colors">
              <span className="text-primary font-bold">#</span>
              <span className="font-headline text-lg">{tag.replace('#', '')}</span>
              <span className="ml-2 text-xs text-on-surface-variant bg-surface-container-highest px-2 py-1 rounded-full">
                {recordings.filter(r => r.tags.includes(tag)).length}
              </span>
            </div>
          )) : (
            <div className="text-center py-20 text-on-surface-variant w-full">
              <Folder className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>У вас пока нет тегов.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const PlaceholderView = ({ title, onBack }: { title: string, onBack: () => void }) => (
  <div className="min-h-screen bg-background text-on-surface flex flex-col font-body selection:bg-primary/30 w-full">
    <header className="flex items-center px-6 md:px-12 py-8 border-b border-white/5 bg-surface-container-low sticky top-0 z-10">
      <button onClick={onBack} className="flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors mr-8 cursor-pointer">
        <ArrowLeft className="w-5 h-5" />
        <span className="font-bold text-xs tracking-widest uppercase">Назад</span>
      </button>
      <h1 className="text-2xl font-black tracking-tighter text-primary uppercase font-headline">{title}</h1>
    </header>
    <main className="flex-1 flex items-center justify-center p-6 md:p-12">
      <div className="text-center">
        <h2 className="font-headline text-4xl font-bold mb-4">В разработке</h2>
        <p className="text-on-surface-variant">Этот раздел появится в следующих обновлениях.</p>
      </div>
    </main>
  </div>
);

import { ChatSidebar } from './components/ChatSidebar';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [quickNoteType, setQuickNoteType] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>(() => {
    const saved = localStorage.getItem('voicemap_recordings');
    return saved ? JSON.parse(saved) : initialRecordings;
  });
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('voicemap_notes');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<any>({ uid: 'local-user', displayName: 'Пользователь', email: 'user@example.com' });

  // Toast State
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Daily AI Tip State
  const [dailyTip, setDailyTip] = useState<{title: string, text: string} | null>(null);
  const [isGeneratingTip, setIsGeneratingTip] = useState(false);

  useEffect(() => {
    localStorage.setItem('voicemap_recordings', JSON.stringify(recordings));
  }, [recordings]);

  useEffect(() => {
    localStorage.setItem('voicemap_notes', JSON.stringify(notes));
  }, [notes]);

  const handleLogin = async () => {
    // No-op for now
  };

  const handleLogout = async () => {
    // No-op for now
  };

  useEffect(() => {
    const fetchTip = async () => {
      if (dailyTip || isGeneratingTip || recordings.length === 0) return;
      
      setIsGeneratingTip(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const context = recordings.slice(0, 3).map(r => `Title: ${r.title}\nSummary: ${r.summary}`).join('\n\n');
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Based on the following recent recordings context, generate a short, personalized daily advice for the user to improve their productivity, communication, or well-being. Return JSON with 'title' (short uppercase category like 'ПРОДУКТИВНОСТЬ') and 'text' (the advice itself, 1-2 sentences).\n\nContext:\n${context}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                text: { type: Type.STRING }
              }
            }
          }
        });
        const result = JSON.parse(response.text || '{}');
        if (result.title && result.text) {
          setDailyTip(result);
        } else {
          setDailyTip({
            title: "ПРОДУКТИВНОСТЬ",
            text: "Регулярно просматривайте свои записи, чтобы не упустить важные детали."
          });
        }
      } catch (err) {
        // Silently handle quota errors for daily tips to avoid interrupting the user
        setDailyTip({
          title: "СОВЕТ ДНЯ",
          text: "Используйте быстрые заметки, чтобы моментально фиксировать идеи и задачи."
        });
      } finally {
        setIsGeneratingTip(false);
      }
    };

    fetchTip();
  }, [recordings, dailyTip, isGeneratingTip]);

  const handleFinishRecording = async (blob: Blob, durationSeconds: number) => {
    setCurrentView('dashboard');
    setIsProcessing(true);
    
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Audio = await base64Promise;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              data: base64Audio,
              mimeType: blob.type || 'audio/webm'
            }
          },
          "Please analyze this personal audio note or voice journal. " +
          "CRITICAL: If the audio is empty, silent, or contains no speech, you MUST return a JSON object with title '[Тишина]' and empty fields. Do not invent or hallucinate speech. " +
          "1. Transcribe the audio EXACTLY in the language it was spoken. " +
          "2. Group the transcript into neat, readable paragraphs. " +
          "3. Provide a short, warm summary of the entry. " +
          "4. Extract 3-5 key thoughts or moments. " +
          "5. List any personal action items or to-dos mentioned. " +
          "6. Identify the overall mood or emotional tone (e.g., Inspired, Tired, Reflective, Excited). " +
          "7. Extract any creative ideas, 'shower thoughts', or insights. " +
          "8. List any specific mentions (books, movies, people, places, tools). " +
          "Return the response in JSON format."
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "A short, catchy title for the recording" },
              summary: { type: Type.STRING, description: "A short summary of what the conversation is about" },
              keyMoments: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3-5 key moments or main ideas from the conversation"
              },
              actionItems: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              },
              mood: { type: Type.STRING },
              ideas: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              },
              mentions: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              },
              transcript: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speaker: { type: Type.STRING, description: "Speaker name or identifier (e.g., Speaker 1)" },
                    timestamp: { type: Type.STRING, description: "Approximate timestamp (e.g., 00:15)" },
                    text: { type: Type.STRING, description: "The transcribed text, grouped into large, readable paragraphs" }
                  }
                }
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      const m = Math.floor(durationSeconds / 60).toString().padStart(2, '0');
      const s = Math.floor(durationSeconds % 60).toString().padStart(2, '0');
      
      const newRecording: Recording = {
        id: Date.now().toString(),
        title: result.title || 'Новая запись',
        date: new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
        duration: `${m}:${s}`,
        tags: result.tags || [],
        summary: result.summary || '',
        actionItems: result.actionItems || [],
        mood: result.mood || 'Нейтральное',
        ideas: result.ideas || [],
        mentions: result.mentions || [],
        transcript: result.transcript || [],
        keyMoments: result.keyMoments || [],
        audioUrl: URL.createObjectURL(blob),
      };

      setRecordings(prev => [newRecording, ...prev]);

      setSelectedRecordingId(newRecording.id);
      setCurrentView('recording_detail');
    } catch (err) {
      // Log as warning to avoid red error box in UI for quota limits
      console.warn("AI processing failed, falling back to local save:", err);
      showToast("Ошибка при обработке записи ИИ. Запись сохранена локально.", 'error');
      
      const m = Math.floor(durationSeconds / 60).toString().padStart(2, '0');
      const s = Math.floor(durationSeconds % 60).toString().padStart(2, '0');
      
      const fallbackRecording: Recording = {
        id: Date.now().toString(),
        title: 'Новая запись (Без ИИ)',
        date: new Date().toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
        duration: `${m}:${s}`,
        tags: ['#Без_ИИ'],
        summary: 'Не удалось обработать запись с помощью ИИ из-за превышения квоты или ошибки сети.',
        actionItems: [],
        ideas: [],
        mentions: [],
        mood: 'Неизвестно',
        transcript: [],
        keyMoments: [],
        audioUrl: URL.createObjectURL(blob),
      };
      
      setRecordings(prev => [fallbackRecording, ...prev]);
      setSelectedRecordingId(fallbackRecording.id);
      setCurrentView('recording_detail');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetDemo = () => {
    localStorage.removeItem('voicemap_recordings');
    localStorage.removeItem('voicemap_notes');
    setRecordings(initialRecordings);
    setNotes([]);
    showToast('Демо-данные сброшены', 'success');
  };

  const renderView = () => {
    if (currentView === 'gallery') {
      return <NotesGallery notes={notes} onBack={() => setCurrentView('dashboard')} setCurrentView={setCurrentView} onLogout={handleLogout} onDeleteNote={(id) => {
        setNotes(prev => prev.filter(n => n.id !== id));
        showToast('Заметка удалена', 'success');
      }} />;
    }

    if (currentView === 'library') {
      return <RecordingsLibrary recordings={recordings} onBack={() => setCurrentView('dashboard')} onOpenDetail={(id) => { setSelectedRecordingId(id); setCurrentView('recording_detail'); }} onDeleteRecording={(id) => {
        setRecordings(prev => prev.filter(r => r.id !== id));
        showToast('Запись удалена', 'success');
      }} />;
    }

    if (currentView === 'recording_detail' && selectedRecordingId) {
      const rec = recordings.find(r => r.id === selectedRecordingId);
      if (rec) {
        return <RecordingDetail recording={rec} onBack={() => setCurrentView('library')} onDelete={() => {
          setRecordings(prev => prev.filter(r => r.id !== rec.id));
          setCurrentView('library');
          showToast('Запись удалена', 'success');
        }} onUpdate={(updatedRec) => {
          setRecordings(prev => prev.map(r => r.id === updatedRec.id ? updatedRec : r));
        }} showToast={showToast} />;
      }
    }

    if (currentView === 'recording_session') {
      return <RecordingSession onFinish={handleFinishRecording} onCancel={() => setCurrentView('dashboard')} showToast={showToast} />;
    }

    if (currentView === 'analytics') {
      return <AnalyticsView recordings={recordings} onBack={() => setCurrentView('dashboard')} />;
    }

    if (currentView === 'focus') {
      return <FocusView recordings={recordings} onBack={() => setCurrentView('dashboard')} />;
    }

    if (currentView === 'tags') {
      return <TagsView recordings={recordings} onBack={() => setCurrentView('dashboard')} />;
    }

    if (currentView === 'settings') {
      return <PlaceholderView title="Настройки" onBack={() => setCurrentView('dashboard')} />;
    }

    return (
      <div className="min-h-screen bg-background text-on-surface pb-32 font-body selection:bg-primary/30 relative">
        <Header currentView={currentView} setCurrentView={setCurrentView} onLogout={handleLogout} onReset={handleResetDemo} />
        <main className="max-w-[1440px] mx-auto px-8 pt-12">
          <div className="grid grid-cols-12 gap-8 mb-12">
            <LiveSessionCard onStartRecording={() => setCurrentView('recording_session')} />
            <QuickNoteCard onQuickNote={(type) => setQuickNoteType(type)} />
          </div>
          <div className="grid grid-cols-12 gap-8 mb-12">
            <FocusTodayCard recordings={recordings} />
            <IdeasCard recordings={recordings} />
          </div>
          <div className="grid grid-cols-12 gap-8 mb-12 items-stretch">
            <AITipCard dailyTip={dailyTip} isGeneratingTip={isGeneratingTip} />
            <ActivityChartCard recordings={recordings} />
          </div>
          <div className="grid grid-cols-12 gap-8 mb-12">
            <WeeklyGoalsCard recordings={recordings} />
            <WeeklyDigestCard recordings={recordings} setCurrentView={setCurrentView} />
          </div>
          <RecentRecordings recordings={recordings} onOpenLibrary={() => setCurrentView('library')} onOpenDetail={(id) => { setSelectedRecordingId(id); setCurrentView('recording_detail'); }} />
        </main>
        <BottomNav currentView={currentView} setCurrentView={setCurrentView} />
        
        {quickNoteType && (
          <QuickNoteModal 
            type={quickNoteType} 
            onClose={() => setQuickNoteType(null)} 
            onSave={(note) => {
              setNotes(prev => [note, ...prev]);
              showToast('Заметка сохранена', 'success');
            }}
            showToast={showToast}
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div 
        className="relative h-full transition-all duration-300 ease-in-out w-full"
      >
        <div className="h-full w-full overflow-y-auto">
          {renderView()}
        </div>
        
        {/* Floating AI Assistant Button */}
        <button
          onClick={() => setIsAssistantOpen(true)}
          className={`fixed bottom-24 md:bottom-32 right-4 md:right-8 w-14 h-14 bg-primary text-on-primary-fixed rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(175,162,255,0.4)] hover:scale-110 transition-transform z-[150] cursor-pointer ${isAssistantOpen ? 'hidden' : ''}`}
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
        onOpenRecording={(id) => {
          setSelectedRecordingId(id);
          setCurrentView('recording_detail');
        }}
        currentView={currentView}
        setCurrentView={setCurrentView}
      />

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
