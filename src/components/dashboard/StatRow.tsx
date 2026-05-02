import type * as React from 'react';
import { ChevronRight } from 'lucide-react';

export interface StatRowProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  children: React.ReactNode;
  onClick?: () => void;
  expandIcon?: React.ReactNode;
}

// Строка статистики с иконкой в цветном круге
export const StatRow = ({ icon, iconBg, iconColor, children, onClick, expandIcon }: StatRowProps) => {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 py-3 lg:py-4 rounded-xl px-2 -mx-2 hover:bg-white/5 transition-colors cursor-pointer group"
      >
        <div className={`w-7 h-7 rounded-full ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div className="flex items-center flex-wrap gap-x-0.5 min-w-0 flex-1">{children}</div>
        {expandIcon ?? (
          <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/30 group-hover:text-primary transition-colors ml-auto flex-shrink-0" />
        )}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 py-3 lg:py-4">
      <div className={`w-7 h-7 rounded-full ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex items-center flex-wrap gap-x-0.5 min-w-0">{children}</div>
    </div>
  );
};

export const Divider = () => <div className="border-t border-white/5" />;
