import { Lightbulb, CheckCircle2, Bell } from 'lucide-react';
import type { NoteType } from '../types';

// ─── Единый источник цветов типов заметок ──────────────────────────────────
// hex-значения ДОЛЖНЫ совпадать с CSS-переменными --color-note-* в index.css.
// Все потребители (карта, дашборд, галерея, канбан) берут цвет ОТСЮДА,
// чтобы один и тот же тип заметки красился одинаково на всех экранах.

export const NOTE_HEX: Record<NoteType, string> = {
  'Идея': '#7B61FF',
  'Задача': '#4FC3F7',
  'Напоминание': '#FFB74D',
};

export interface NoteClassConfig {
  icon: typeof Lightbulb;
  label: string;
  text: string;         // цвет текста, напр. text-note-idea
  bg: string;            // фон 10%, напр. bg-note-idea/10
  stripe: string;        // сплошная заливка (полоска), напр. bg-note-idea
  border: string;        // цвет рамки, напр. border-note-idea
  gradientFrom: string;  // from-note-idea/8
  gradientTo: string;    // to-note-idea/3
  glow: string;          // shadow-note-idea/10
}

export const NOTE_CLASSES: Record<NoteType, NoteClassConfig> = {
  'Идея': {
    icon: Lightbulb,
    label: 'Идея',
    text: 'text-note-idea',
    bg: 'bg-note-idea/10',
    stripe: 'bg-note-idea',
    border: 'border-note-idea',
    gradientFrom: 'from-note-idea/8',
    gradientTo: 'to-note-idea/3',
    glow: 'shadow-note-idea/10',
  },
  'Задача': {
    icon: CheckCircle2,
    label: 'Задача',
    text: 'text-note-task',
    bg: 'bg-note-task/10',
    stripe: 'bg-note-task',
    border: 'border-note-task',
    gradientFrom: 'from-note-task/8',
    gradientTo: 'to-note-task/3',
    glow: 'shadow-note-task/10',
  },
  'Напоминание': {
    icon: Bell,
    label: 'Напоминание',
    text: 'text-note-reminder',
    bg: 'bg-note-reminder/10',
    stripe: 'bg-note-reminder',
    border: 'border-note-reminder',
    gradientFrom: 'from-note-reminder/8',
    gradientTo: 'to-note-reminder/3',
    glow: 'shadow-note-reminder/10',
  },
};
