import type * as React from 'react';
import { ChevronRight, Check } from 'lucide-react';

// Секция с заголовком и рамкой
export function Section({ title, danger = false, children }: {
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className={`text-xs font-bold uppercase tracking-widest mb-4 ${danger ? 'text-error/70' : 'text-on-surface-variant'}`}>{title}</h2>
      <div className={`bg-surface-container rounded-2xl border overflow-hidden ${danger ? 'border-error/15' : 'border-white/5'}`}>
        {children}
      </div>
    </section>
  );
}

// Горизонтальный разделитель
export function Divider() {
  return <div className="h-px bg-white/5" />;
}

// Строка с тогглом (вкл/выкл)
export function RowToggle({ icon: Icon, label, description, checked, onChange }: {
  icon: React.ElementType; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-on-surface">{label}</p>
          {description && <p className="text-xs text-on-surface-variant">{description}</p>}
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${checked ? 'bg-primary' : 'bg-surface-container-high'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

// Строка с набором кнопок-чипсов для выбора значения
export function RowChips<T extends string | number | null>({ icon: Icon, label, description, options, value, onChange }: {
  icon: React.ElementType; label: string; description?: string;
  options: { label: string; value: T }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-on-surface">{label}</p>
          {description && <p className="text-xs text-on-surface-variant">{description}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-12">
        {options.map(opt => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              value === opt.value
                ? 'bg-primary text-white'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {value === opt.value && <Check className="w-3 h-3 inline mr-1" />}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Строка-кнопка с иконкой и необязательным правым лейблом / стрелкой
export function RowAction({ icon: Icon, label, description, iconColor = 'text-primary', bgColor = 'bg-primary/10', onClick, rightLabel }: {
  icon: React.ElementType; label: string; description?: string;
  iconColor?: string; bgColor?: string; onClick: () => void; rightLabel?: string;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between p-5 hover:bg-white/[0.03] transition-colors cursor-pointer group">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl ${bgColor} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-on-surface">{label}</p>
          {description && <p className="text-xs text-on-surface-variant">{description}</p>}
        </div>
      </div>
      {rightLabel && <span className="text-xs text-primary font-bold opacity-0 group-hover:opacity-100 transition-opacity">{rightLabel}</span>}
      {!rightLabel && <ChevronRight className="w-4 h-4 text-on-surface-variant opacity-40" />}
    </button>
  );
}
