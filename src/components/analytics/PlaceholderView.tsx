import { ArrowLeft } from 'lucide-react';

interface PlaceholderViewProps {
  title: string;
  onBack: () => void;
}

export const PlaceholderView = ({ title, onBack }: PlaceholderViewProps) => (
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
