import { AudioLines, Mic, Brain, Target, FolderOpen, Settings } from 'lucide-react';

interface BottomNavProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const BottomNav = ({ currentView, setCurrentView }: BottomNavProps) => (
  <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-2 pb-6 pt-3 bg-[#0e0e11]/80 backdrop-blur-xl border-t border-white/5 z-50 rounded-t-3xl shadow-[0_-8px_32px_rgba(123,97,255,0.06)]">
    <div onClick={() => setCurrentView('library')} className={`flex flex-col items-center justify-center px-2 py-1.5 transition-all cursor-pointer ${currentView === 'library' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl' : 'text-slate-500 hover:bg-white/5'}`}>
      <AudioLines className="mb-1 w-5 h-5" />
      <span className="font-label text-[10px] font-bold tracking-widest uppercase">Карта</span>
    </div>
    <div onClick={() => setCurrentView('gallery')} className={`flex flex-col items-center justify-center px-2 py-1.5 transition-all cursor-pointer ${currentView === 'gallery' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl' : 'text-slate-500 hover:bg-white/5'}`}>
      <FolderOpen className="mb-1 w-5 h-5" />
      <span className="font-label text-[10px] font-bold tracking-widest uppercase">Архив</span>
    </div>
    <div onClick={() => setCurrentView('recording_session')} className={`flex flex-col items-center justify-center px-2 py-1.5 transition-all cursor-pointer ${currentView === 'recording_session' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl scale-95' : 'text-slate-500 hover:bg-white/5'}`}>
      <Mic className="mb-1 w-5 h-5" fill="currentColor" />
      <span className="font-label text-[10px] font-bold tracking-widest uppercase">Запись</span>
    </div>
    <div onClick={() => setCurrentView('analytics')} className={`flex flex-col items-center justify-center px-2 py-1.5 transition-all cursor-pointer ${currentView === 'analytics' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl' : 'text-slate-500 hover:bg-white/5'}`}>
      <Brain className="mb-1 w-5 h-5" />
      <span className="font-label text-[10px] font-bold tracking-widest uppercase">Инсайты</span>
    </div>
    <div onClick={() => setCurrentView('focus')} className={`flex flex-col items-center justify-center px-2 py-1.5 transition-all cursor-pointer ${currentView === 'focus' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl' : 'text-slate-500 hover:bg-white/5'}`}>
      <Target className="mb-1 w-5 h-5" />
      <span className="font-label text-[10px] font-bold tracking-widest uppercase">Фокус</span>
    </div>
    <div onClick={() => setCurrentView('settings')} className={`flex flex-col items-center justify-center px-2 py-1.5 transition-all cursor-pointer ${currentView === 'settings' ? 'bg-[#7B61FF]/10 text-[#7B61FF] rounded-xl' : 'text-slate-500 hover:bg-white/5'}`}>
      <Settings className="mb-1 w-5 h-5" />
      <span className="font-label text-[10px] font-bold tracking-widest uppercase">Настройки</span>
    </div>
  </nav>
);
