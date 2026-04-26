import { motion } from 'motion/react';
import { Lightbulb, Loader2 } from 'lucide-react';

interface AITipCardProps {
  dailyTip: { title: string; text: string } | null;
  isGeneratingTip: boolean;
}

export const AITipCard = ({ dailyTip, isGeneratingTip }: AITipCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.4 }}
    className="col-span-12 lg:col-span-5 relative"
  >
    <div className="bg-tertiary text-on-tertiary-container p-4 lg:p-12 rounded-[40px] h-full flex flex-col justify-end editorial-shadow relative overflow-hidden">
      {isGeneratingTip ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-tertiary/80 backdrop-blur-sm z-10">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <span className="text-sm font-bold tracking-widest uppercase">Генерация совета...</span>
        </div>
      ) : null}
      <Lightbulb className="w-10 h-10 lg:w-16 lg:h-16 mb-3 lg:mb-6 opacity-30" />
      <h3 className="font-headline text-xs font-black tracking-[0.3em] uppercase mb-4 text-on-tertiary-fixed">{dailyTip?.title || 'Совет дня от AI'}</h3>
      <p className="font-headline text-xl lg:text-3xl font-extrabold leading-tight italic">"{dailyTip?.text || 'Записывайте свои мысли чаще, чтобы ИИ мог давать более точные советы.'}"</p>
    </div>
  </motion.div>
);
