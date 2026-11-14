import React from 'react';
import { Sparkles } from 'lucide-react';

interface ToastBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export const ToastBanner: React.FC<ToastBannerProps> = ({ message, onDismiss }) => {
  if (!message) return null;
  return (
    <div className="sticky top-[var(--app-header-h,64px)] z-40 max-w-xl mx-auto w-full px-4 mt-2">
      <div className="bg-[#1E3A5F] text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-[#3B6998] flex items-center justify-between gap-3 animate-fade-in">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#FCC934] shrink-0" />
          <span>{message}</span>
        </div>
        <button type="button" onClick={onDismiss} className="text-white/70 hover:text-white font-bold cursor-pointer">
          ✕
        </button>
      </div>
    </div>
  );
};
