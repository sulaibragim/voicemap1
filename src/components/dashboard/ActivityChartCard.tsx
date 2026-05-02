import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronRight } from 'lucide-react';
import type { Recording, Note } from '../../types';
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { TooltipPayloadEntry } from 'recharts/types/state/tooltipSlice';
import { parseRecDate, toDateKey } from '../../lib/utils';

interface ActivityChartCardProps {
  recordings: Recording[];
  notes: Note[];
  onOpenRecording: (id: string) => void;
}

const RU_DAY_SHORT = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const RU_DAY_LONG = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const RU_MONTH_NAMES = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

interface ChartDataItem {
  name: string;
  // реальное кол-во для отображения в списке
  recordingsCount: number;
  notesCount: number;
  // значения для графика: запись = 1, заметка = 0.5
  recordingsValue: number;
  notesValue: number;
  dateKey: string;
  label: string;
}

const CustomTooltip = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
  if (!active || !payload || (payload as TooltipPayloadEntry[]).length === 0) return null;
  const data = (payload as TooltipPayloadEntry[])[0]?.payload as ChartDataItem | undefined;
  if (!data) return null;
  const hasActivity = data.recordingsCount > 0 || data.notesCount > 0;
  if (!hasActivity) return null;
  return (
    <div className="bg-surface-container-high border border-white/10 rounded-xl p-3 text-sm shadow-lg">
      <p className="font-bold text-on-surface mb-1.5">{data.label}</p>
      {data.recordingsCount > 0 && (
        <p style={{ color: '#afa2ff' }}>Записей: {data.recordingsCount}</p>
      )}
      {data.notesCount > 0 && (
        <p className="text-[#4FC3F7]">Заметок: {data.notesCount}</p>
      )}
    </div>
  );
};

export const ActivityChartCard = ({ recordings, notes, onOpenRecording }: ActivityChartCardProps) => {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Последние 7 дней включая сегодня
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return d;
  });

  // Группируем записи по dateKey
  const recsByDay: Record<string, Recording[]> = {};
  recordings.forEach(r => {
    const date = parseRecDate(r.date);
    if (!date) return;
    const key = toDateKey(date);
    if (!recsByDay[key]) recsByDay[key] = [];
    recsByDay[key].push(r);
  });

  // Группируем заметки по dateKey
  const notesByDay: Record<string, Note[]> = {};
  notes.forEach(n => {
    const date = parseRecDate(n.date);
    if (!date) return;
    const key = toDateKey(date);
    if (!notesByDay[key]) notesByDay[key] = [];
    notesByDay[key].push(n);
  });

  const data: ChartDataItem[] = days.map(d => {
    const key = toDateKey(d);
    const dayIndex = d.getDay();
    const rCount = (recsByDay[key] ?? []).length;
    const nCount = (notesByDay[key] ?? []).length;
    return {
      name: `${RU_DAY_SHORT[dayIndex]} ${d.getDate()}`,
      recordingsCount: rCount,
      notesCount: nCount,
      // запись = 1 единица, заметка = 0.5 единицы
      recordingsValue: rCount,
      notesValue: nCount * 0.5,
      dateKey: key,
      label: `${RU_DAY_LONG[dayIndex]}, ${d.getDate()} ${RU_MONTH_NAMES[d.getMonth()]}`,
    };
  });

  // Всего за 7 дней
  const weekTotal = data.reduce((acc, d) => acc + d.recordingsCount + d.notesCount, 0);

  // Клик на bar через onClick BarChart — тип из recharts
  const handleBarClick = (chartState: unknown) => {
    if (!chartState || typeof chartState !== 'object') return;
    const state = chartState as { activePayload?: Array<{ payload: ChartDataItem }> };
    if (!state.activePayload?.length) return;
    const item = state.activePayload[0]?.payload;
    if (!item) return;
    setSelectedDay(prev => prev === item.dateKey ? null : item.dateKey);
  };

  const selectedDayData = selectedDay ? data.find(d => d.dateKey === selectedDay) : null;
  const selectedDayRecs = selectedDay ? (recsByDay[selectedDay] ?? []) : [];
  const selectedDayNotes = selectedDay ? (notesByDay[selectedDay] ?? []) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="col-span-12 lg:col-span-7 bg-surface-container rounded-3xl p-4 lg:p-10 flex flex-col"
    >
      {/* Заголовок */}
      <div className="flex justify-between items-end mb-3 lg:mb-5">
        <div>
          <h3 className="font-headline text-xl lg:text-3xl font-bold mb-1">Активность записей</h3>
          <p className="text-sm text-on-surface-variant font-body">Последние 7 дней</p>
        </div>
        <div className="text-right">
          <p className="text-2xl lg:text-4xl font-headline font-black text-primary">{weekTotal}</p>
          <p className="text-[10px] font-label font-bold text-outline tracking-widest uppercase">За неделю</p>
        </div>
      </div>

      {/* Легенда */}
      <div className="flex items-center gap-4 text-xs text-on-surface-variant mb-4 lg:mb-6">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#afa2ff] flex-shrink-0" />
          запись
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#4FC3F7] flex-shrink-0" />
          быстрая заметка
        </span>
      </div>

      {/* График */}
      <div className="flex-grow w-full h-36 lg:h-48 min-h-[144px]">
        <ResponsiveContainer width="100%" height="100%" debounce={50}>
          <BarChart
            data={data}
            onClick={handleBarClick}
            style={{ cursor: 'pointer' }}
          >
            <YAxis domain={[0, 10]} hide />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8E9299', fontSize: 10, fontWeight: 'bold' }}
              dy={10}
              interval={0}
            />
            <Tooltip
              content={(props: TooltipContentProps<ValueType, NameType>) => <CustomTooltip {...props} />}
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            />
            {/* Нижний сегмент: полные записи (1 запись = 1 единица) */}
            <Bar dataKey="recordingsValue" stackId="a" name="Записи" radius={[0, 0, 0, 0]}>
              {data.map((entry, index) => {
                const isEmpty = entry.recordingsCount === 0 && entry.notesCount === 0;
                const onlyRec = entry.recordingsCount > 0 && entry.notesCount === 0;
                const isSelected = entry.dateKey === selectedDay;
                let fill = '#afa2ff';
                if (isEmpty) fill = 'rgba(175,162,255,0.12)';
                if (isSelected && !isEmpty) fill = '#c4baff';
                return (
                  <Cell
                    key={`rec-${index}`}
                    fill={fill}
                    // recharts тип Cell.radius неполный — реально принимает [tl, tr, br, bl]
                    radius={(onlyRec ? [4, 4, 0, 0] : [0, 0, 0, 0]) as unknown as number}
                  />
                );
              })}
            </Bar>
            {/* Верхний сегмент: быстрые заметки (1 заметка = 0.5 единицы) */}
            <Bar dataKey="notesValue" stackId="a" name="Быстрые заметки" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => {
                const isEmpty = entry.recordingsCount === 0 && entry.notesCount === 0;
                const isSelected = entry.dateKey === selectedDay;
                let fill = '#4FC3F7';
                if (isEmpty) fill = 'rgba(79,195,247,0.12)';
                if (isSelected && !isEmpty) fill = '#5dd4f5';
                return (
                  <Cell
                    key={`note-${index}`}
                    fill={fill}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Раскрываемый список записей выбранного дня */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-4"
          >
            <div className="border-t border-white/5 pt-4">
              <p className="text-xs font-bold text-on-surface-variant mb-3 uppercase tracking-wider">
                {selectedDayData?.label ?? ''} &mdash;{' '}
                {selectedDayRecs.length + selectedDayNotes.length}{' '}
                {(selectedDayRecs.length + selectedDayNotes.length) === 1 ? 'штука' : (selectedDayRecs.length + selectedDayNotes.length) < 5 ? 'штуки' : 'штук'}
              </p>
              <div className="space-y-2">
                {selectedDayRecs.length === 0 && selectedDayNotes.length === 0 ? (
                  <p className="text-sm text-on-surface-variant/50">Ничего нет</p>
                ) : (
                  <>
                    {selectedDayRecs.map(rec => (
                      <button
                        key={rec.id}
                        onClick={() => onOpenRecording(rec.id)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-surface-container-high rounded-xl hover:bg-surface-container-highest transition-colors cursor-pointer group text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-2 h-2 rounded-full bg-[#afa2ff] flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold line-clamp-1">{rec.title}</p>
                            <p className="text-[11px] text-on-surface-variant">
                              {rec.duration}{rec.mood ? ` · ${rec.mood}` : ''}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors flex-shrink-0" />
                      </button>
                    ))}
                    {selectedDayNotes.map(note => (
                      <div
                        key={note.id}
                        className="w-full flex items-center gap-3 px-3 py-2.5 bg-surface-container-high rounded-xl text-left"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#4FC3F7] flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold line-clamp-1">{note.content}</p>
                          <p className="text-[11px] text-on-surface-variant">{note.type}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
