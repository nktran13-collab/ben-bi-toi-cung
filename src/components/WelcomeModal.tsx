import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Flame,
  Clock,
  Shield,
  Cloud,
  Headphones,
  Moon,
  ArrowRight,
  BookmarkCheck,
  RotateCcw,
} from 'lucide-react';
import { useI18n } from '../utils/useI18n';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
  onOpenQuickStart?: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose, onOpenQuickStart }) => {
  const { t } = useI18n();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleStartNow = () => {
    onClose(dontShowAgain);
    if (onOpenQuickStart) {
      onOpenQuickStart();
    }
  };

  const handleRemindLater = () => {
    // Explicitly keep showing next time
    onClose(false);
  };

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-800 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        {/* Header Banner */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-r from-[#1E3A5F] via-[#2A4D7A] to-[#FF6B00] p-5 text-white sm:p-6 [@media(max-height:520px)]:p-3.5">
          {/* Subtle decorative circles */}
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute right-16 -bottom-10 w-24 h-24 rounded-full bg-[#FCC934]/20 blur-lg pointer-events-none" />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#FCC934] shadow-inner shrink-0">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-[#FCC934] text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">
                  <span>{t('welcome.badge')}</span>
                  <span>•</span>
                  <span>{t('welcome.ucl')}</span>
                </div>
                <h2 className="text-lg sm:text-2xl font-extrabold text-white leading-tight">{t('welcome.brand')}</h2>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRemindLater}
              aria-label={t('common.close')}
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="mt-3 text-xs sm:text-sm text-[#E8F0FE]/90 leading-relaxed font-normal [@media(max-height:520px)]:hidden">
            {t('welcome.tagline')}
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6 [@media(max-height:520px)]:space-y-3 [@media(max-height:520px)]:p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Habit Mode */}
            <div className="bg-orange-50/70 dark:bg-orange-950/20 p-3.5 rounded-2xl border border-orange-200/80 dark:border-orange-900/40 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center shrink-0 shadow-xs shadow-orange-500/30">
                <Flame className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{t('welcome.habitTitle')}</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t('welcome.habitDescPrefix')} <strong>{t('welcome.habitDescStrong')}</strong>{' '}
                  {t('welcome.habitDescSuffix')}
                </p>
              </div>
            </div>

            {/* 2. Khiên Bền Bỉ */}
            <div className="bg-amber-50/70 dark:bg-amber-950/20 p-3.5 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FCC934] text-amber-950 flex items-center justify-center shrink-0 shadow-xs">
                <Shield className="w-5 h-5 fill-amber-950" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{t('welcome.shieldTitle')}</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t('welcome.shieldDescPrefix')} <strong>{t('welcome.shieldDescStrong')}</strong>{' '}
                  {t('welcome.shieldDescSuffix')}
                </p>
              </div>
            </div>

            {/* 3. Project Mode */}
            <div className="bg-blue-50/70 dark:bg-blue-950/20 p-3.5 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1E3A5F] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Clock className="w-5 h-5 text-[#FCC934]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{t('welcome.projectTitle')}</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t('welcome.projectDescPrefix')} <strong>{t('welcome.projectDescStrong')}</strong>{' '}
                  {t('welcome.projectDescSuffix')}
                </p>
              </div>
            </div>

            {/* 4. Configurable Rollover & Cloud Sync */}
            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{t('welcome.cloudTitle')}</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t('welcome.cloudDescPrefix')} <strong>{t('welcome.cloudDescStrong')}</strong>{' '}
                  {t('welcome.cloudDescMiddle')} <strong>{t('welcome.cloudDescSettings')}</strong>
                  {t('welcome.cloudDescSuffix')}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Bonus Pill Highlights */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1 font-medium">
              <Headphones className="w-3.5 h-3.5 text-[#FF6B00]" />
              {t('welcome.zen')}
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
            <span className="flex items-center gap-1 font-medium">
              <Moon className="w-3.5 h-3.5 text-[#1E3A5F] dark:text-[#FCC934]" />
              {t('welcome.darkMode')}
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
            <span className="flex items-center gap-1 font-medium">
              <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
              {t('welcome.offline')}
            </span>
          </div>

          {/* Re-show preference checkbox */}
          <div className="pt-1 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-[#FF6B00] focus:ring-[#FF6B00] accent-[#FF6B00] cursor-pointer"
              />
              <span>{t('welcome.dontShow')}</span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex shrink-0 flex-col-reverse items-center justify-between gap-2.5 border-t border-slate-200 bg-[#F8FAFC] px-5 py-3.5 sm:flex-row sm:px-6 sm:py-4 dark:border-slate-700 dark:bg-slate-800/80 [@media(max-height:520px)]:py-2">
          <button
            type="button"
            onClick={handleRemindLater}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('welcome.later')}</span>
          </button>

          <button
            type="button"
            onClick={handleStartNow}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#FF6B00] to-[#E65100] hover:from-[#E65100] hover:to-[#D84315] active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{t('welcome.start')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
