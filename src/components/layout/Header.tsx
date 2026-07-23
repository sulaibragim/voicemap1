import { AudioLines, Mic, FolderOpen, Brain, Target, Settings, Search, LogOut, Bell } from 'lucide-react';

interface HeaderProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onLogout: () => void;
  onReset: () => void;
  user?: { displayName: string; photoURL: string | null; email: string };
}

const NAV_ITEMS = [
  { view: 'library',          label: 'Библиотека', icon: AudioLines },
  { view: 'gallery',          label: 'Архив',      icon: FolderOpen },
  { view: 'recording_session',label: 'Запись',     icon: Mic,        filled: true },
  { view: 'analytics',        label: 'Аналитика',  icon: Brain },
  { view: 'focus',            label: 'Фокус',      icon: Target },
  { view: 'reminders',        label: 'Напоминания', icon: Bell },
];

export const Header = ({ currentView, setCurrentView, onLogout, onReset: _onReset, user }: HeaderProps) => (
  <header className="hidden md:block w-full sticky top-0 z-[100] bg-[#0e0e11]/60 backdrop-blur-xl border-b border-white/[0.04]">
    <div className="flex items-center justify-between px-6 lg:px-10 py-3 max-w-full">

      {/* Logo */}
      <button
        onClick={() => setCurrentView('dashboard')}
        className="text-lg lg:text-xl font-black tracking-tighter text-[#7B61FF] uppercase font-headline cursor-pointer flex-shrink-0 hover:text-[#AF9CFF] transition-colors"
      >
        VOICEMAP
      </button>

      {/* Floating Island */}
      <nav
        className="flex items-center gap-1 px-2 py-2 rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {NAV_ITEMS.map(({ view, label, icon: Icon, filled }) => {
          const active = currentView === view;
          return (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-label text-xs font-bold tracking-widest uppercase transition-all duration-200 cursor-pointer flex-shrink-0"
              style={{
                background: active ? 'rgba(123,97,255,0.18)' : 'transparent',
                color: active ? '#AF9CFF' : 'rgba(255,255,255,0.4)',
                border: active ? '1px solid rgba(123,97,255,0.3)' : '1px solid transparent',
                boxShadow: active ? '0 0 12px rgba(123,97,255,0.15)' : 'none',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
            >
              <Icon
                className="w-3.5 h-3.5 flex-shrink-0"
                fill={filled && active ? 'currentColor' : 'none'}
              />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => setCurrentView('library')}
          aria-label="Поиск"
          className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-white/[0.06]"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          onClick={() => setCurrentView('settings')}
          aria-label="Настройки"
          className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-white/[0.06]"
        >
          <Settings className="w-4 h-4" />
        </button>
        {/* User avatar + logout */}
        {user && (
          <div className="flex items-center gap-2 ml-1 pl-3 border-l border-white/[0.08]">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-black text-white">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs text-on-surface-variant font-bold hidden lg:block max-w-[100px] truncate">
              {user.displayName}
            </span>
            <button
              onClick={onLogout}
              className="text-slate-500 hover:text-error transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-error/10"
              title="Выйти"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

    </div>
  </header>
);
