import { useState, useRef } from 'react';
import type * as React from 'react';
import { Trash2 } from 'lucide-react';

interface SwipeCardProps {
  onSwipeDelete: () => void;
  children: React.ReactNode;
}

export const SwipeCard = ({ onSwipeDelete, children }: SwipeCardProps) => {
  const startX = useRef<number>(0);
  const [offsetX, setOffsetX] = useState(0);
  const isDragging = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientX - startX.current;
    if (delta < 0) setOffsetX(Math.max(delta, -120));
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (offsetX <= -80) {
      onSwipeDelete();
    }
    setOffsetX(0);
  };

  const showDelete = offsetX <= -40;
  // Читаем ref вне JSX — управляет анимацией transition при свайпе (должно быть синхронно)
  // eslint-disable-next-line react-hooks/refs
  const draggingTransition = isDragging.current ? 'none' : 'transform 0.25s ease';

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Red delete zone */}
      <div
        className={`absolute inset-y-0 right-0 flex items-center justify-center w-20 bg-red-500 transition-opacity duration-150 ${showDelete ? 'opacity-100' : 'opacity-0'}`}
      >
        <Trash2 className="w-5 h-5 text-white" />
      </div>
      {/* Card content */}
      <div
        style={{ transform: `translateX(${offsetX}px)`, transition: draggingTransition }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};
