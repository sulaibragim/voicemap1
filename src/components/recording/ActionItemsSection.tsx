import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ListTodo, Plus, Pencil, Trash2, Check, X, Square, CheckSquare } from 'lucide-react';
import { TaskReminderButton } from './TaskReminderButton';
import { DatePicker } from '../ui/DatePicker';
import { VoiceInput } from '../ui/VoiceInput';
import { formatDeadlineDisplay, toIsoDate } from '../../lib/recordingUtils';
import type { RichActionItem } from '../../types';

interface TaskReminder {
  date: string;
  time: string;
  notified?: boolean;
}

interface ActionItemsSectionProps {
  items: string[];
  done?: boolean[];
  onUpdate: (items: string[]) => void;
  onToggleDone?: (idx: number) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  taskReminders?: Record<number, TaskReminder>;
  onSetReminder?: (idx: number, date: string, time: string) => void;
  richItems?: RichActionItem[];
  onUpdateRichItems?: (items: RichActionItem[]) => void;
}

export const ActionItemsSection = ({ items, done, onUpdate, onToggleDone, showToast, taskReminders, onSetReminder, richItems, onUpdateRichItems }: ActionItemsSectionProps) => {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [editingRich, setEditingRich] = useState<{ idx: number; field: 'assignee' | 'deadline'; assigneeIdx?: number } | null>(null);
  const [editingRichValue, setEditingRichValue] = useState('');
  const deadlineAnchorRef = useRef<HTMLButtonElement | null>(null);

  // Get assignees array (supports legacy single assignee field)
  const getAssignees = (item: { assignees?: string[]; assignee?: string }): string[] => {
    if (item.assignees && item.assignees.length > 0) return item.assignees;
    if (item.assignee) return [item.assignee];
    return [];
  };

  const saveAssignee = () => {
    if (!editingRich || editingRich.field !== 'assignee' || !richItems || !onUpdateRichItems) return;
    const item = richItems[editingRich.idx];
    const current = getAssignees(item);
    const val = editingRichValue.trim();
    let next: string[];
    if (editingRich.assigneeIdx === undefined) {
      // Adding new
      next = val ? [...current, val] : current;
    } else {
      // Editing existing
      if (!val) {
        next = current.filter((_, i) => i !== editingRich.assigneeIdx);
      } else {
        next = current.map((a, i) => i === editingRich.assigneeIdx ? val : a);
      }
    }
    onUpdateRichItems(richItems.map((r, i) =>
      i === editingRich.idx ? { ...r, assignees: next.length ? next : undefined, assignee: undefined } : r
    ));
    setEditingRich(null);
  };

  const removeAssignee = (taskIdx: number, assigneeIdx: number) => {
    if (!richItems || !onUpdateRichItems) return;
    const current = getAssignees(richItems[taskIdx]);
    const next = current.filter((_, i) => i !== assigneeIdx);
    onUpdateRichItems(richItems.map((r, i) =>
      i === taskIdx ? { ...r, assignees: next.length ? next : undefined, assignee: undefined } : r
    ));
  };

  const _saveRichField = () => {
    if (!editingRich || !richItems || !onUpdateRichItems) return;
    if (editingRich.field === 'assignee') { saveAssignee(); return; }
    const updated = richItems.map((r, i) =>
      i === editingRich.idx ? { ...r, [editingRich.field]: editingRichValue.trim() || undefined } : r
    );
    onUpdateRichItems(updated);
    setEditingRich(null);
  };

  const saveEdit = () => {
    if (editingIdx === null) return;
    const updated = [...items];
    updated[editingIdx] = editingText.trim();
    onUpdate(updated.filter(Boolean));
    setEditingIdx(null);
  };

  const deleteTask = (idx: number) => {
    onUpdate(items.filter((_, i) => i !== idx));
  };

  const addTask = () => {
    if (!newTaskText.trim()) return;
    onUpdate([...items, newTaskText.trim()]);
    setNewTaskText('');
    setIsAdding(false);
    showToast('Задача добавлена', 'success');
  };

  const openAdd = () => {
    setIsAdding(true);
    setNewTaskText('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 font-bold text-sm text-secondary">
          <ListTodo className="w-4 h-4" /> Задачи / Что сделать
        </h3>
        {!isAdding && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/10 text-secondary text-xs font-bold hover:bg-secondary/20 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Добавить
          </button>
        )}
      </div>

      {/* Add input with voice */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="flex gap-2">
              <VoiceInput
                autoFocus
                value={newTaskText}
                onChange={setNewTaskText}
                onKeyDown={(e) => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setIsAdding(false); }}
                placeholder="Описание задачи или нажмите микрофон..."
                showToast={showToast}
              />
              <button
                onClick={addTask}
                disabled={!newTaskText.trim()}
                className="p-2 bg-secondary/20 text-secondary rounded-xl hover:bg-secondary/30 transition-colors disabled:opacity-40 cursor-pointer flex-shrink-0"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="p-2 bg-surface-container-highest text-on-surface-variant rounded-xl hover:text-white transition-colors cursor-pointer flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tasks list */}
      <ul className="space-y-2">
        {items.length === 0 && !isAdding && (
          <li className="text-sm text-on-surface-variant/50 text-center py-3">Нет задач — добавьте текстом или голосом</li>
        )}
        {items.map((task, i) => {
          const isDone = done?.[i] === true;
          const hasCheckbox = onToggleDone !== undefined;
          return (
            <li key={i} className="flex items-start gap-2 bg-surface-container p-3 rounded-xl group">
              {hasCheckbox ? (
                <button
                  onClick={() => onToggleDone!(i)}
                  className={`mt-0.5 flex-shrink-0 transition-colors cursor-pointer ${isDone ? 'text-secondary' : 'text-on-surface-variant/30 hover:text-on-surface-variant/60'}`}
                  title={isDone ? 'Отметить невыполненной' : 'Отметить выполненной'}
                >
                  {isDone
                    ? <CheckSquare className="w-4 h-4" />
                    : <Square className="w-4 h-4" />
                  }
                </button>
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-2 flex-shrink-0" />
              )}
              {editingIdx === i ? (
                <div className="flex-1 flex gap-2">
                  <VoiceInput
                    autoFocus
                    value={editingText}
                    onChange={setEditingText}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingIdx(null); }}
                    placeholder="Текст задачи..."
                    showToast={showToast}
                  />
                  <button onClick={saveEdit} className="text-secondary hover:text-white transition-colors cursor-pointer flex-shrink-0">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingIdx(null)} className="text-on-surface-variant hover:text-white transition-colors cursor-pointer flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  {/* Task text — always full width, never truncated by badges */}
                  <span className={`text-sm leading-relaxed transition-all ${isDone && hasCheckbox ? 'line-through opacity-50 text-on-surface-variant' : 'text-on-surface-variant'}`}>{task}</span>
                  {/* Badges row below the text */}
                  <div className="flex flex-wrap items-center gap-1">
                    {/* Assignee badges — multiple supported */}
                    {richItems && richItems[i] && getAssignees(richItems[i]).map((name, ai) => (
                      editingRich?.idx === i && editingRich.field === 'assignee' && editingRich.assigneeIdx === ai ? (
                        <input
                          key={`edit-${ai}`}
                          autoFocus
                          value={editingRichValue}
                          onChange={e => setEditingRichValue(e.target.value)}
                          onBlur={saveAssignee}
                          onKeyDown={e => { if (e.key === 'Enter') saveAssignee(); if (e.key === 'Escape') setEditingRich(null); }}
                          placeholder="Имя"
                          className="text-[10px] w-20 px-1.5 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/40 outline-none"
                        />
                      ) : (
                        <span key={`badge-${ai}`} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-bold bg-secondary/10 text-secondary">
                          <button
                            onClick={() => onUpdateRichItems && (setEditingRich({ idx: i, field: 'assignee', assigneeIdx: ai }), setEditingRichValue(name))}
                            className="hover:opacity-70 transition-opacity cursor-pointer"
                            title="Изменить"
                          >
                            👤 {name}
                          </button>
                          <button
                            onClick={() => removeAssignee(i, ai)}
                            className="ml-0.5 hover:text-error transition-colors cursor-pointer leading-none"
                            title="Удалить"
                          >
                            ×
                          </button>
                        </span>
                      )
                    ))}
                    {/* Add assignee button — always visible */}
                    {editingRich?.idx === i && editingRich.field === 'assignee' && editingRich.assigneeIdx === undefined ? (
                      <input
                        autoFocus
                        value={editingRichValue}
                        onChange={e => setEditingRichValue(e.target.value)}
                        onBlur={saveAssignee}
                        onKeyDown={e => { if (e.key === 'Enter') saveAssignee(); if (e.key === 'Escape') setEditingRich(null); }}
                        placeholder="Имя исполнителя"
                        className="text-[10px] w-24 px-1.5 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/40 outline-none"
                      />
                    ) : (
                      onUpdateRichItems && (
                        <button
                          onClick={() => { setEditingRich({ idx: i, field: 'assignee', assigneeIdx: undefined }); setEditingRichValue(''); }}
                          className="text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer bg-secondary/5 text-secondary/50 hover:bg-secondary/15 hover:text-secondary"
                          title="Добавить исполнителя"
                        >
                          👤 +
                        </button>
                      )
                    )}
                    {/* Deadline badge */}
                    <button
                      ref={editingRich?.idx === i && editingRich.field === 'deadline' ? deadlineAnchorRef : undefined}
                      onClick={(e) => {
                        if (!onUpdateRichItems || !richItems) return;
                        deadlineAnchorRef.current = e.currentTarget;
                        setEditingRich({ idx: i, field: 'deadline' });
                        setEditingRichValue(toIsoDate(richItems[i]?.deadline ?? ''));
                      }}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${richItems?.[i]?.deadline ? 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20' : 'opacity-0 group-hover:opacity-60 bg-amber-400/5 text-amber-400/60'}`}
                      title="Установить срок"
                    >
                      📅 {richItems?.[i]?.deadline ? formatDeadlineDisplay(richItems[i].deadline!) : '+'}
                    </button>
                    {/* Bell reminder */}
                    {onSetReminder && (
                      <div className={`${taskReminders?.[i] ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <TaskReminderButton
                          taskIndex={i}
                          reminder={taskReminders?.[i]}
                          onSave={onSetReminder}
                        />
                      </div>
                    )}
                    {/* Edit / Delete */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity items-center ml-auto">
                      <button
                        onClick={() => { setEditingIdx(i); setEditingText(task); }}
                        className="p-1 hover:text-secondary transition-colors cursor-pointer text-on-surface-variant"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteTask(i)}
                        className="p-1 hover:text-error transition-colors cursor-pointer text-on-surface-variant"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* DatePicker portal */}
                  <AnimatePresence>
                    {editingRich?.idx === i && editingRich.field === 'deadline' && (
                      <DatePicker
                        value={editingRichValue}
                        anchorRef={deadlineAnchorRef}
                        onChange={(date) => {
                          if (richItems && onUpdateRichItems) {
                            onUpdateRichItems(richItems.map((r, ri) => ri === i ? { ...r, deadline: date } : r));
                          }
                        }}
                        onClose={() => setEditingRich(null)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
