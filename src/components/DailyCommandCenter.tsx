import React from 'react';
import { CheckCircle2, Clock, Flame, RotateCcw, TrendingUp } from 'lucide-react';

interface DailyCommandCenterProps {
  darkMode: boolean;
  completedHabitsToday: number;
  habitCount: number;
  dailyHabitProgressPercent: number;
  totalFocusedTodayMinutes: number;
  highestStreak: number;
  totalActiveStreaks: number;
  hoursUntilRollover: number;
  minsUntilRollover: number;
  onOpenResetOptions: () => void;
}

export const DailyCommandCenter: React.FC<DailyCommandCenterProps> = ({
  darkMode,
  completedHabitsToday,
  habitCount,
  dailyHabitProgressPercent,
  totalFocusedTodayMinutes,
  highestStreak,
  totalActiveStreaks,
  hoursUntilRollover,
  minsUntilRollover,
  onOpenResetOptions,
}) => {
  const cardClass = `p-3 sm:p-3.5 rounded-xl border ${
    darkMode ? 'bg-slate-800/70 border-slate-700/80' : 'bg-[#F4F7FA] border-slate-200/70'
  }`;

  return (
    <section
      aria-label="Tổng quan tiến độ kỷ luật hôm nay"
      className={`mb-6 rounded-2xl p-3 sm:p-5 border shadow-xs transition-colors ${
        darkMode
          ? 'bg-slate-900/90 border-slate-800 text-slate-100'
          : 'bg-white border-slate-200/90 text-slate-800'
      }`}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Metric 1: Daily Habit Progress */}
        <div className={cardClass}>
          <div className="flex items-center gap-1.5 text-xs font-semibold leading-tight text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#81C995]" />
            <span className="sm:hidden">Thói quen</span>
            <span className="hidden sm:inline">Thói quen hôm nay</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="text-xl sm:text-2xl font-black font-mono tabular-nums">
              {completedHabitsToday}/{habitCount}
            </span>
            <span className="font-mono text-sm font-bold text-[#FF6B00]">
              {dailyHabitProgressPercent}%
            </span>
          </div>
          <div className="mt-2 w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF6B00] to-[#81C995] transition-all duration-500"
              style={{ width: `${dailyHabitProgressPercent}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Total Focused Time Today */}
        <div className={cardClass}>
          <div className="flex items-center gap-1.5 text-xs font-semibold leading-tight text-slate-500 dark:text-slate-400">
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[#3B6998]" />
            <span>Tập trung hôm nay</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono tabular-nums">
              {totalFocusedTodayMinutes}
            </span>
            <span className="text-xs font-semibold text-slate-400">phút</span>
          </div>
          <div className="mt-1 text-[11px] leading-tight text-slate-400">
            {(totalFocusedTodayMinutes / 60).toFixed(1)} giờ tích lũy
          </div>
        </div>

        {/* Metric 3: Highest Active Streak */}
        <div className={cardClass}>
          <div className="flex items-center gap-1.5 text-xs font-semibold leading-tight text-slate-500 dark:text-slate-400">
            <Flame className="h-3.5 w-3.5 shrink-0 text-[#FF6B00] fill-[#FF6B00]" />
            <span>Chuỗi dẫn đầu</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[#FF6B00]">
              {highestStreak}
            </span>
            <span className="text-xs font-semibold text-slate-400">ngày liên tiếp</span>
          </div>
          <div className="mt-1 text-[11px] leading-tight text-slate-400 flex items-center justify-between gap-1">
            <span>Đang duy trì {totalActiveStreaks} chuỗi</span>
            {highestStreak > 0 && (
              <button
                type="button"
                onClick={onOpenResetOptions}
                className="text-[#3B6998] dark:text-sky-400 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                title="Đặt lại về Ngày 0 hoặc Sao lưu dữ liệu"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Đặt lại</span>
              </button>
            )}
          </div>
        </div>

        {/* Metric 4: Biological Rollover Countdown (04:00 AM) */}
        <div className={cardClass}>
          <div className="flex items-center gap-1.5 text-xs font-semibold leading-tight text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5 shrink-0 text-[#FCC934]" />
            <span>Quỹ thời gian</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black font-mono tabular-nums">
              {hoursUntilRollover}g {String(minsUntilRollover).padStart(2, '0')}p
            </span>
          </div>
          <div className="mt-1 text-[11px] leading-tight text-slate-400">Mốc 04:00 sáng</div>
        </div>
      </div>
    </section>
  );
};
