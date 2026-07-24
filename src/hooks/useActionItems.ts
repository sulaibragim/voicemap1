import { useCallback, useState } from 'react';
import type { RichActionItem } from '../types';

/**
 * Правка списка задач: сам текст плюс «богатые» поля — ответственные и дедлайн.
 *
 * Задачи живут в двух параллельных массивах: items (строки, что показывает
 * интерфейс) и richItems (структура от AI с ответственными и сроками).
 * Синхронизировать их нельзя по индексу — модель не гарантирует одинаковый
 * порядок, — поэтому rich-поля правятся отдельно и по своему индексу.
 */

/** Кого редактируем прямо сейчас: какую задачу, какое поле, какого ответственного */
export interface RichEditTarget {
  idx: number;
  field: 'assignee' | 'deadline';
  /** Не задан — добавляем нового ответственного, задан — правим существующего */
  assigneeIdx?: number;
}

interface UseActionItemsOptions {
  items: string[];
  onUpdate: (items: string[]) => void;
  richItems?: RichActionItem[];
  onUpdateRichItems?: (items: RichActionItem[]) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

/** Ответственные: новое поле assignees, со старым одиночным assignee для совместимости */
export function getAssignees(item: { assignees?: string[]; assignee?: string }): string[] {
  if (item.assignees && item.assignees.length > 0) return item.assignees;
  if (item.assignee) return [item.assignee];
  return [];
}

export function useActionItems({
  items, onUpdate, richItems, onUpdateRichItems, showToast,
}: UseActionItemsOptions) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [editingRich, setEditingRich] = useState<RichEditTarget | null>(null);
  const [editingRichValue, setEditingRichValue] = useState('');

  /** Записывает rich-поля задачи, попутно убирая старое одиночное assignee */
  const patchRichItem = useCallback((taskIdx: number, patch: Partial<RichActionItem>) => {
    if (!richItems || !onUpdateRichItems) return;
    onUpdateRichItems(richItems.map((item, i) => i === taskIdx ? { ...item, ...patch } : item));
  }, [richItems, onUpdateRichItems]);

  const saveAssignee = useCallback(() => {
    if (!editingRich || editingRich.field !== 'assignee' || !richItems) return;

    const current = getAssignees(richItems[editingRich.idx]);
    const value = editingRichValue.trim();
    let next: string[];

    if (editingRich.assigneeIdx === undefined) {
      next = value ? [...current, value] : current;
    } else if (!value) {
      // Стёрли имя — значит убрали ответственного
      next = current.filter((_, i) => i !== editingRich.assigneeIdx);
    } else {
      next = current.map((name, i) => i === editingRich.assigneeIdx ? value : name);
    }

    patchRichItem(editingRich.idx, {
      assignees: next.length ? next : undefined,
      assignee: undefined,
    });
    setEditingRich(null);
  }, [editingRich, editingRichValue, richItems, patchRichItem]);

  const removeAssignee = useCallback((taskIdx: number, assigneeIdx: number) => {
    if (!richItems) return;
    const next = getAssignees(richItems[taskIdx]).filter((_, i) => i !== assigneeIdx);
    patchRichItem(taskIdx, {
      assignees: next.length ? next : undefined,
      assignee: undefined,
    });
  }, [richItems, patchRichItem]);

  const setDeadline = useCallback((taskIdx: number, date: string) => {
    patchRichItem(taskIdx, { deadline: date });
  }, [patchRichItem]);

  const saveEdit = useCallback(() => {
    if (editingIdx === null) return;
    const updated = [...items];
    updated[editingIdx] = editingText.trim();
    // filter(Boolean) заодно выбрасывает задачу, у которой стёрли весь текст
    onUpdate(updated.filter(Boolean));
    setEditingIdx(null);
  }, [editingIdx, editingText, items, onUpdate]);

  const deleteTask = useCallback((idx: number) => {
    onUpdate(items.filter((_, i) => i !== idx));
  }, [items, onUpdate]);

  const addTask = useCallback(() => {
    const text = newTaskText.trim();
    if (!text) return;
    onUpdate([...items, text]);
    setNewTaskText('');
    setIsAdding(false);
    showToast('Задача добавлена', 'success');
  }, [newTaskText, items, onUpdate, showToast]);

  const openAdd = useCallback(() => {
    setIsAdding(true);
    setNewTaskText('');
  }, []);

  return {
    editingIdx, setEditingIdx,
    editingText, setEditingText,
    isAdding, setIsAdding,
    newTaskText, setNewTaskText,
    editingRich, setEditingRich,
    editingRichValue, setEditingRichValue,
    saveAssignee, removeAssignee, setDeadline,
    saveEdit, deleteTask, addTask, openAdd,
  };
}
