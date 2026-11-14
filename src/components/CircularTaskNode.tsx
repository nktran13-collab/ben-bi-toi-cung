import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  BarChart2,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Calendar,
  Shield,
  Zap,
  BookOpen,
  Briefcase,
  HeartPulse,
  Sparkles,
  Bell,
  Check,
  Maximize2,
  Pencil,
} from 'lucide-react';
import {
  TaskItem,
  calculateHabitRemaining,
  calculateProjectProgress,
  formatDuration,
  formatClockTime,
  calculateExpectedEndTimestamp,
  getEffectiveTargetDurationMs,
} from '../utils/engine';

interface CircularTaskNodeProps {
  task: TaskItem;
  currentTimeMs: number;
  devModeEnabled?: boolean;
  darkMode?: boolean;
  onToggleTimer: (taskId: string) => void;
  onResetTimer: (taskId: string) => void;
  onConfirmHabit: (taskId: string) => void;
  onCompleteSprintSession?: (taskId: string) => void;
  onOpenProjectStats: (taskId: string) => void;
  onOpenEditTask?: (task: TaskItem) => void;
  onOpenZenFocus?: (taskId: string) => void;
  onSimulateBreakStreak: (taskId: string) => void;
  onFastForward5s: (taskId: string) => void;
}

export const CircularTaskNode: React.FC<CircularTaskNodeProps> = ({
  task,
  currentTimeMs,
  devModeEnabled = false,
  darkMode = false,
  onToggleTimer,
  onResetTimer,
  onConfirmHabit,
  onCompleteSprintSession,
  onOpenProjectStats,
  onOpenEditTask,
  onOpenZenFocus,
  onSimulateBreakStreak,
  onFastForward5s,
}) => {
  const isRunning = task.status === 'running';
  const isHabit = task.mode === 'habit';
  const isCompleted = task.status === 'completed_today';
  const isPendingConfirmation = task.status === 'pending_confirmation';
  const effectiveTargetMs = getEffectiveTargetDurationMs(task);

  const size = 172;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let displayTime = '';
  let progressRatio = 0;
  let strokeColor = '#3B6998';
  let expectedEndFormatted = '';

  if (isHabit) {
    const { remainingMs, progressRatio: ratio } = calculateHabitRemaining(
      effectiveTargetMs,
      task.startedAtMs,
      task.accumulatedMs,
      currentTimeMs
    );
    progressRatio = isCompleted ? 1 : ratio;
    displayTime = formatDuration(isCompleted ? effectiveTargetMs : remainingMs);

    if (isRunning && task.startedAtMs) {
      const expectedEnd = calculateExpectedEndTimestamp(
        task.startedAtMs,
        effectiveTargetMs,
        task.accumulatedMs
      );
      expectedEndFormatted = formatClockTime(expectedEnd);
    }

    if (isCompleted) {
      strokeColor = '#81C995';
    } else {
      strokeColor = '#FF6B00';
    }
  } else {
    const { elapsedMs, progressRatio: ratio } = calculateProjectProgress(
      effectiveTargetMs,
      task.startedAtMs,
      task.accumulatedMs,
      currentTimeMs
    );
    progressRatio = Math.min(1, ratio);
    displayTime = formatDuration(elapsedMs);
    strokeColor = isCompleted ? '#81C995' : darkMode ? '#38BDF8' : '#1E3A5F';
  }

  let strokeDashoffset = 0;
  if (isHabit && isCompleted) {
    strokeDashoffset = 0;
  } else {
    strokeDashoffset = circumference * (1 - Math.max(0, Math.min(1, progressRatio)));
  }

  // Long-press confirmation logic (0.8s hold)
  const [holdingProgress, setHoldingProgress] = useState(0);
  const holdStartTimeRef = useRef<number | null>(null);
  const holdAnimFrameRef = useRef<number | null>(null);

  const startHold = () => {
    if (!isPendingConfirmation) return;
    holdStartTimeRef.current = Date.now();

    const checkHold = () => {
      if (!holdStartTimeRef.current) return;
      const elapsed = Date.now() - holdStartTimeRef.current;
      const progress = Math.min(100, (elapsed / 800) * 100);
      setHoldingProgress(progress);

      if (progress >= 100) {
        onConfirmHabit(task.id);
        cancelHold();
      } else {
        holdAnimFrameRef.current = requestAnimationFrame(checkHold);
      }
    };

    holdAnimFrameRef.current = requestAnimationFrame(checkHold);
  };

  const cancelHold = () => {
    holdStartTimeRef.current = null;
    if (holdAnimFrameRef.current) {
      cancelAnimationFrame(holdAnimFrameRef.current);
      holdAnimFrameRef.current = null;
    }
    setHoldingProgress(0);
  };

  useEffect(() => {
    return () => {
      if (holdAnimFrameRef.current) cancelAnimationFrame(holdAnimFrameRef.current);
    };
  }, []);

  const renderCategoryIcon = () => {
    switch (task.category) {
      case 'health':
        return <HeartPulse className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500 shrink-0" />;
      case 'work':
        return <Briefcase className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#3B6998] shrink-0" />;
      case 'study':
        return <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500 shrink-0" />;
      default:
        return <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#FF6B00] shrink-0" />;
    }
  };

  const currentElapsedMs = isRunning && task.startedAtMs
    ? task.accumulatedMs + Math.max(0, currentTimeMs - task.startedAtMs)
    : task.accumulatedMs;

  return (
    <div
      className={`relative rounded-2xl p-2.5 sm:p-5 border transition-all shadow-sm hover:shadow-md flex flex-col items-center justify-between min-h-[300px] sm:min-h-[390px] w-full min-w-0 box-border ${
        isPendingConfirmation
          ? 'border-[#FF6B00] ring-4 ring-[#FF6B00]/20 bg-[#FFF3E0]/30 dark:bg-[#FF6B00]/10 animate-pulse'
          : isCompleted
          ? 'border-[#81C995] bg-[#81C995]/5 dark:bg-emerald-950/20'
          : darkMode
          ? 'bg-slate-900 border-slate-800 text-slate-100'
          : 'bg-white border-slate-200/90 text-slate-800'
      }`}
    >
      {/* Top Bar: Category & Pill Badge */}
      <div className="w-full flex items-center justify-between gap-1 mb-2 min-w-0">
        <div
          className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full border text-[10px] sm:text-xs font-semibold min-w-0 shrink max-w-[55%] ${
            darkMode
              ? 'bg-slate-800 border-slate-700 text-slate-300'
              : 'bg-[#F4F7FA] border-slate-200 text-slate-700'
          }`}
        >
          {renderCategoryIcon()}
          <span className="truncate capitalize">
            {task.category === 'health'
              ? 'Sức khoẻ'
              : task.category === 'work'
              ? 'Công việc'
              : task.category === 'study'
              ? 'Học hành'
              : 'Thói quen'}
          </span>
          {task.sync_status === 1 && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#FF6B00] shrink-0"
              title="Đang chờ đồng bộ đám mây"
            />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isHabit ? (
            <div
              className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-tight shadow-xs whitespace-nowrap shrink-0 ${
                isCompleted
                  ? 'bg-[#81C995] text-slate-950'
                  : task.inCompensationQuest
                  ? 'bg-[#D93025] text-white animate-bounce'
                  : darkMode
                  ? 'bg-[#FF6B00]/20 text-[#FF9E40] border border-[#FF6B00]/40'
                  : 'bg-[#FFF3E0] text-[#FF6B00] border border-[#FF6B00]/30'
              }`}
              title={
                task.inCompensationQuest
                  ? 'Đang trong Nhiệm vụ Đền bù x2: Hoàn thành hôm nay để khôi phục chuỗi'
                  : `Chuỗi hiện tại: ${task.currentStreak} ngày / Mục tiêu ${task.targetMilestoneDays || 30} ngày`
              }
            >
              <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current shrink-0" />
              <span>
                {task.currentStreak}/{task.targetMilestoneDays || 30}
              </span>
            </div>
          ) : (
            <div
              className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-tight border shadow-xs whitespace-nowrap shrink-0 ${
                darkMode
                  ? 'bg-slate-800 text-sky-300 border-sky-500/30'
                  : 'bg-[#E8F0FE] text-[#1E3A5F] border-[#3B6998]/30'
              }`}
              title={`Đã tích lũy qua ${task.currentStreak} phiên/ngày`}
            >
              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>
                {task.currentStreak}{' '}
                <span className="hidden sm:inline">phiên</span>
                <span className="sm:hidden">p</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SVG Circular Node */}
      <div
        className="relative w-28 h-28 sm:w-44 sm:h-44 flex items-center justify-center rounded-full my-1 cursor-pointer select-none group transition-transform active:scale-95 shrink-0"
        onClick={() => {
          if (!isPendingConfirmation && !isCompleted) {
            onToggleTimer(task.id);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`${task.name}: ${isRunning ? 'Tạm dừng' : 'Bắt đầu'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isPendingConfirmation && !isCompleted) onToggleTimer(task.id);
          }
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 filter drop-shadow-xs"
        >
          {/* Base Background Track Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={darkMode ? '#1E293B' : '#F4F7FA'}
            strokeWidth={strokeWidth}
          />
          {/* Subtle Inner Guideline */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius - 8}
            fill="transparent"
            stroke={darkMode ? '#334155' : '#E2E8F0'}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          {/* Dynamic Progress Stroke Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />
        </svg>

        {/* Center of Circle */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 sm:p-3 text-center pointer-events-none">
          {isCompleted ? (
            <div className="flex flex-col items-center">
              <CheckCircle2 className="w-6 h-6 sm:w-9 sm:h-9 text-[#81C995] mb-0.5 sm:mb-1" />
              <span className="text-[9px] sm:text-xs font-bold text-[#81C995] uppercase tracking-wider">
                Đã hoàn thành
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">Hôm nay</span>
            </div>
          ) : isPendingConfirmation ? (
            <div className="flex flex-col items-center">
              <span className="text-[10px] sm:text-xs font-bold text-[#FF6B00] animate-bounce">
                00:00 Hết giờ!
              </span>
              <span
                className={`text-[10px] sm:text-xs font-bold mt-1 ${
                  darkMode ? 'text-white' : 'text-slate-800'
                }`}
              >
                Xác nhận
              </span>
            </div>
          ) : isRunning ? (
            <div className="flex flex-col items-center">
              <span
                className={`text-base sm:text-[1.75rem] font-extrabold font-mono tracking-tight tabular-nums ${
                  darkMode ? 'text-white' : 'text-slate-900'
                }`}
              >
                {displayTime}
              </span>
              <span className="text-[9px] sm:text-xs font-semibold text-emerald-500 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Đang chạy
              </span>
            </div>
          ) : task.accumulatedMs > 0 ? (
            <div className="flex flex-col items-center">
              <span
                className={`text-base sm:text-[1.75rem] font-extrabold font-mono tracking-tight tabular-nums ${
                  darkMode ? 'text-slate-200' : 'text-slate-700'
                }`}
              >
                {displayTime}
              </span>
              <span className="text-[9px] sm:text-xs font-semibold text-amber-500">Tạm dừng</span>
            </div>
          ) : (
            <div className="flex flex-col items-center max-w-[85px] sm:max-w-[130px] px-1">
              <span
                className={`text-xs sm:text-base font-bold line-clamp-2 leading-tight ${
                  darkMode ? 'text-slate-100' : 'text-slate-800'
                }`}
              >
                {task.name}
              </span>
              <span
                className={`text-[9px] sm:text-xs font-semibold mt-1 px-1.5 sm:px-2.5 py-0.5 rounded-full border ${
                  task.inCompensationQuest
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : darkMode
                    ? 'bg-slate-800 text-slate-300 border-slate-700'
                    : 'bg-[#F4F7FA] text-slate-500 border-slate-200'
                }`}
              >
                {Math.round(effectiveTargetMs / 60000)} phút
                {task.inCompensationQuest ? ' (x2)' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Task Title & Status Details */}
      <div className="w-full text-center mt-1 px-0.5 min-w-0">
        <h3
          className={`font-bold text-xs sm:text-sm line-clamp-1 truncate ${
            darkMode ? 'text-slate-100' : 'text-slate-900'
          }`}
          title={task.name}
        >
          {task.name}
        </h3>
        <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1 truncate">
          {task.notes
            ? task.notes
            : isHabit
            ? `Định mức ${Math.round(effectiveTargetMs / 60000)}p/ngày`
            : `Mục tiêu phiên: ${Math.round(effectiveTargetMs / 60000)}p`}
        </p>

        {/* Scheduled Web Push Notification Badge */}
        {isHabit && isRunning && expectedEndFormatted && (
          <div className="mt-1 inline-flex items-center gap-1 text-[9px] sm:text-xs font-semibold text-[#FF6B00] bg-[#FFF3E0] dark:bg-[#FF6B00]/15 px-1.5 sm:px-2 py-0.5 rounded-md border border-[#FF6B00]/30 animate-pulse max-w-full">
            <Bell className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="truncate max-w-[100px] sm:max-w-none">Đích: {expectedEndFormatted}</span>
          </div>
        )}
      </div>

      {/* Anti-Accidental Long-Press or Confirmation Button when PENDING_CONFIRMATION */}
      {isPendingConfirmation && (
        <div className="w-full mt-2 sm:mt-2.5 flex flex-col gap-1.5 sm:gap-2">
          <button
            type="button"
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            className="relative w-full overflow-hidden bg-gradient-to-r from-[#FF6B00] to-[#E65100] text-white text-[11px] sm:text-xs font-bold min-h-11 py-2 sm:min-h-0 sm:py-2.5 px-2 sm:px-3 rounded-xl shadow-md active:scale-98 transition-transform select-none cursor-pointer"
          >
            <div
              className="absolute left-0 top-0 bottom-0 bg-[#FCC934]/40 transition-all duration-75"
              style={{ width: `${holdingProgress}%` }}
            />
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FCC934]" />
              <span>
                {holdingProgress > 0 ? `Giữ: ${Math.round(holdingProgress)}%` : 'Nhấn giữ 0.8s xác nhận'}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onConfirmHabit(task.id)}
            className="w-full text-center text-[10px] sm:text-xs font-semibold text-[#FF6B00] hover:underline cursor-pointer min-h-11 sm:min-h-0 py-2 sm:py-1"
          >
            Xác nhận nhanh
          </button>
        </div>
      )}

      {/* Normal Action Bar */}
      {!isPendingConfirmation && (
        <div
          className={`w-full mt-2 sm:mt-2.5 pt-2 sm:pt-2.5 border-t flex items-center justify-between gap-1 sm:gap-1.5 min-w-0 ${
            darkMode ? 'border-slate-800' : 'border-slate-100'
          }`}
        >
          {!isCompleted ? (
            <button
              type="button"
              onClick={() => onToggleTimer(task.id)}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 min-h-11 py-2 sm:min-h-0 sm:py-2 px-1.5 sm:px-3 rounded-lg text-[10px] sm:text-xs font-bold shadow-xs transition-colors cursor-pointer truncate ${
                isRunning
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                  : 'bg-[#1E3A5F] hover:bg-[#152a45] text-white'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-3 h-3 sm:w-4 sm:h-4 fill-current shrink-0" />
                  <span className="truncate">Dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 sm:w-4 sm:h-4 fill-current shrink-0" />
                  <span className="truncate">{task.accumulatedMs > 0 ? 'Tiếp' : 'Bắt đầu'}</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex-1 min-w-0 text-center min-h-11 py-2 sm:min-h-0 sm:py-2 px-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] sm:text-xs font-bold border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-0.5 sm:gap-1">
              <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
              <span className="truncate">Đã ghi nhận</span>
            </div>
          )}

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            {/* Save / Complete Sprint Session button for Project Mode when there is accumulated time */}
            {!isHabit && currentElapsedMs >= 10000 && onCompleteSprintSession && (
              <button
                type="button"
                onClick={() => onCompleteSprintSession(task.id)}
                className="min-w-11 min-h-11 p-2 sm:min-w-0 sm:min-h-0 sm:p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs shrink-0"
                title="Chốt & Lưu phiên làm việc này vào lịch sử dự án"
              >
                <Check className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            )}

            {/* Zen Focus Mode Button */}
            {!isCompleted && onOpenZenFocus && (
              <button
                type="button"
                onClick={() => onOpenZenFocus(task.id)}
                className={`min-w-11 min-h-11 p-2 sm:min-w-0 sm:min-h-0 sm:p-2 rounded-lg transition-colors border cursor-pointer shrink-0 ${
                  darkMode
                    ? 'text-slate-300 border-slate-700 hover:bg-slate-800'
                    : 'text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title="Mở không gian tập trung toàn màn hình (Zen Focus & Sóng âm)"
              >
                <Maximize2 className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            )}

            {/* Reset Timer */}
            {task.accumulatedMs > 0 && !isCompleted && (
              <button
                type="button"
                onClick={() => onResetTimer(task.id)}
                className="min-w-11 min-h-11 p-2 sm:min-w-0 sm:min-h-0 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Đặt lại đồng hồ về 0"
              >
                <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            )}

            {/* Edit Task */}
            {onOpenEditTask && (
              <button
                type="button"
                onClick={() => onOpenEditTask(task)}
                className={`min-w-11 min-h-11 p-2 sm:min-w-0 sm:min-h-0 sm:p-2 rounded-lg transition-colors cursor-pointer hidden sm:flex shrink-0 ${
                  darkMode
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Chỉnh sửa thông tin tác vụ"
              >
                <Pencil className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            )}

            {/* Stats & Deep Report */}
            <button
              type="button"
              onClick={() => onOpenProjectStats(task.id)}
              className={`min-w-11 min-h-11 p-2 sm:min-w-0 sm:min-h-0 sm:p-2 rounded-lg transition-colors border cursor-pointer shrink-0 ${
                darkMode
                  ? 'text-sky-300 border-sky-500/30 hover:bg-slate-800'
                  : 'text-[#1E3A5F] hover:bg-[#E8F0FE] border-[#3B6998]/30'
              }`}
              title="Xem báo cáo 3 tầng, ma trận chuỗi & tạo thẻ vinh danh"
            >
              <BarChart2 className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>

            {/* Dev Mode Only: Simulate Break Streak & Fast Forward 5s */}
            {devModeEnabled && isHabit && (
              <button
                type="button"
                onClick={() => onSimulateBreakStreak(task.id)}
                className="min-w-11 min-h-11 p-2 sm:min-w-0 sm:min-h-0 sm:p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200 cursor-pointer shrink-0"
                title="[Dev] Giả lập đứt chuỗi"
              >
                <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            )}

            {devModeEnabled && isHabit && !isCompleted && !isRunning && (
              <button
                type="button"
                onClick={() => onFastForward5s(task.id)}
                className="min-w-11 min-h-11 p-2 sm:min-w-0 sm:min-h-0 sm:p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors text-xs font-mono border border-amber-200 cursor-pointer hidden sm:block shrink-0"
                title="[Dev] Tua nhanh còn 5 giây"
              >
                <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Shield info badge on top-left if available */}
      {isHabit && task.shields > 0 && (
        <div
          className="absolute -top-2 -left-1 sm:-left-2 bg-[#FCC934] text-slate-900 font-extrabold text-[9px] sm:text-xs px-1.5 sm:px-2.5 py-0.5 rounded-full flex items-center gap-0.5 sm:gap-1 shadow-sm border border-amber-400 z-10"
          title={`${task.shields} Khiên Bền Bỉ sẵn sàng cứu chuỗi`}
        >
          <Shield className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 fill-slate-900 shrink-0" />
          <span>{task.shields} khiên</span>
        </div>
      )}
    </div>
  );
};
