import { AudioLines, Mic, Target, FolderOpen, Settings } from 'lucide-react';
import { useT } from '../../i18n';

interface BottomNavProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const BottomNav = ({ currentView, setCurrentView }: BottomNavProps) => {
  const t = useT();
  return (
  <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-1 pb-6 pt-3 bg-[#0e0e11]/80 backdrop-blur-xl border-t border-white/5 z-50 rounded-t-3xl shadow-[0_-8px_32px_rgba(123,97,255,0.06)]">
    <button type="button" onClick={() => setCurrentView('library')} aria-current={currentView === 'library' ? 'page' : undefined} aria-label={t('nav.library')} className={`flex-1 min-w-0 flex flex-col items-center justify-center px-0.5 py-1.5 transition-all cursor-pointer ${currentView === 'library' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl' : 'text-slate-500 hover:bg-white/5'}`}>
      <AudioLines className="mb-1 w-5 h-5" />
      <span className="font-label text-[9px] font-bold tracking-tight uppercase truncate max-w-full">{t('nav.library')}</span>
    </button>
    <button type="button" onClick={() => setCurrentView('gallery')} aria-current={currentView === 'gallery' ? 'page' : undefined} aria-label={t('nav.archive')} className={`flex-1 min-w-0 flex flex-col items-center justify-center px-0.5 py-1.5 transition-all cursor-pointer ${currentView === 'gallery' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl' : 'text-slate-500 hover:bg-white/5'}`}>
      <FolderOpen className="mb-1 w-5 h-5" />
      <span className="font-label text-[9px] font-bold tracking-tight uppercase truncate max-w-full">{t('nav.archive')}</span>
    </button>
    <button type="button" onClick={() => setCurrentView('recording_session')} aria-current={currentView === 'recording_session' ? 'page' : undefined} aria-label={t('nav.record')} className={`flex-1 min-w-0 flex flex-col items-center justify-center px-0.5 py-1.5 transition-all cursor-pointer ${currentView === 'recording_session' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl scale-95' : 'text-slate-500 hover:bg-white/5'}`}>
      <Mic className="mb-1 w-5 h-5" fill="currentColor" />
      <span className="font-label text-[9px] font-bold tracking-tight uppercase truncate max-w-full">{t('nav.record')}</span>
    </button>
    <button type="button" onClick={() => setCurrentView('focus')} aria-current={currentView === 'focus' ? 'page' : undefined} aria-label={t('nav.focus')} className={`flex-1 min-w-0 flex flex-col items-center justify-center px-0.5 py-1.5 transition-all cursor-pointer ${currentView === 'focus' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl' : 'text-slate-500 hover:bg-white/5'}`}>
      <Target className="mb-1 w-5 h-5" />
      <span className="font-label text-[9px] font-bold tracking-tight uppercase truncate max-w-full">{t('nav.focus')}</span>
    </button>
    <button type="button" onClick={() => setCurrentView('settings')} aria-current={currentView === 'settings' ? 'page' : undefined} aria-label={t('nav.settings')} className={`flex-1 min-w-0 flex flex-col items-center justify-center px-0.5 py-1.5 transition-all cursor-pointer ${currentView === 'settings' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl' : 'text-slate-500 hover:bg-white/5'}`}>
      <Settings className="mb-1 w-5 h-5" />
      <span className="font-label text-[9px] font-bold tracking-tight uppercase truncate max-w-full">{t('nav.settings')}</span>
    </button>
  </nav>
  );
};
