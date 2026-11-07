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
  Cloud,
} from 'lucide-react';
import {
  TaskItem,
  calculateElapsedTime,
  calculateHabitRemaining,
  calculateProjectProgress,
  formatDuration,
  formatClockTime,
  calculateExpectedEndTimestamp,
} from '../utils/engine';

interface CircularTaskNodeProps {
  task: TaskItem;
  currentTimeMs: number;
  onToggleTimer: (taskId: string) => void;
  onResetTimer: (taskId: string) => void;
  onConfirmHabit: (taskId: string) => void;
  onOpenProjectStats: (taskId: string) => void;
  onSimulateBreakStreak: (taskId: string) => void;
  onFastForward5s: (taskId: string) => void;
}

export const CircularTaskNode: React.FC<CircularTaskNodeProps> = ({
  task,
  currentTimeMs,
  onToggleTimer,
  onResetTimer,
  onConfirmHabit,
  onOpenProjectStats,
  onSimulateBreakStreak,
  onFastForward5s,
}) => {
  const isRunning = task.status === 'running';
  const isHabit = task.mode === 'habit';
  const isCompleted = task.status === 'completed_today';
  const isPendingConfirmation = task.status === 'pending_confirmation';

  // Base SVG Geometry (Scale is controlled by Tailwind classes on the wrapper)
  const size = 172;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Real-time calculations
  let displayTime = '';
  let progressRatio = 0;
  let strokeColor = '#3B6998'; // default denim
  let expectedEndFormatted = '';

  if (isHabit) {
    const { remainingMs, progressRatio: ratio, isFinished } = calculateHabitRemaining(
      task.targetDurationMs,
      task.startedAtMs,
      task.accumulatedMs,
      currentTimeMs
    );
    progressRatio = isCompleted ? 1 : ratio;
    displayTime = formatDuration(isCompleted ? task.targetDurationMs : remainingMs);

    if (isRunning && task.startedAtMs) {
      const expectedEnd = calculateExpectedEndTimestamp(task.startedAtMs, task.targetDurationMs, task.accumulatedMs);
      expectedEndFormatted = formatClockTime(expectedEnd);
    }

    if (isCompleted) {
      strokeColor = '#81C995'; // Soft Emerald
    } else if (isPendingConfirmation || isFinished) {
      strokeColor = '#FF6B00'; // Relentless Orange
    } else {
      strokeColor = '#FF6B00'; // Relentless Orange for Habits
    }
  } else {
    // Project Mode
    const { elapsedMs, progressRatio: ratio } = calculateProjectProgress(
      task.targetDurationMs,
      task.startedAtMs,
      task.accumulatedMs,
      currentTimeMs
    );
    progressRatio = Math.min(1, ratio);
    displayTime = formatDuration(elapsedMs);
    strokeColor = isCompleted ? '#81C995' : '#1E3A5F'; // Deep Jean Blue[cite: 1]
  }

  // Stroke offset
  let strokeDashoffset = 0;
  if (isHabit) {
    if (isCompleted) {
      strokeDashoffset = 0;
    } else {
      strokeDashoffset = circumference * (1 - Math.max(0, Math.min(1, progressRatio)));
    }
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
        return <HeartPulse className="w-3.5 h-3.5 text-rose-500" />;
      case 'work':
        return <Briefcase className="w-3.5 h-3.5 text-[#1E3A5F]" />;
      case 'study':
        return <BookOpen className="w-3.5 h-3.5 text-indigo-600" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />;
    }
  };

  return (
    <div
      className={`relative bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-sm hover:shadow-md flex flex-col items-center justify-between min-h-[340px] sm:min-h-[385px] ${
        isPendingConfirmation
          ? 'border-[#FF6B00] ring-4 ring-[#FF6B00]/20 bg-[#FFF3E0]/30 animate-pulse'
          : isCompleted
          ? 'border-[#81C995] bg-[#81C995]/5'
          : 'border-slate-200/90'
      }`}
    >
      {/* Top Bar: Category & Pill Badge */}
      <div className="w-full flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F4F7FA] border border-slate-200 text-[10px] sm:text-xs font-semibold text-slate-700">
          {renderCategoryIcon()}
          <span className="capitalize">
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
              className="w-2 h-2 rounded-full bg-[#FF6B00]"
              title="Đang chờ đồng bộ đám mây (sync_status = 1)"
            />
          )}
        </div>

        {/* Pill Badge (Top Right) */}
        {isHabit ? (
          <div
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-tight shadow-xs ${
              isCompleted
                ? 'bg-[#81C995] text-white'
                : task.inCompensationQuest
                ? 'bg-[#D93025] text-white animate-bounce'
                : 'bg-[#FFF3E0] text-[#FF6B00] border border-[#FF6B00]/30'
            }`}
            title={
              task.inCompensationQuest
                ? 'Đang trong nhiệm vụ đền bù: Hoàn thành ngày hôm nay để không đứt chuỗi'
                : `Chuỗi hiện tại: ${task.currentStreak} ngày / Mục tiêu ${task.targetMilestoneDays || 30} ngày`
            }
          >
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>
              {task.currentStreak}/{task.targetMilestoneDays || 30}
            </span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-tight bg-[#E8F0FE] text-[#1E3A5F] border border-[#3B6998]/30 shadow-xs"
            title={`Đã thực hiện trong ${task.currentStreak} ngày`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{task.currentStreak} ngày</span>
          </div>
        )}
      </div>

      {/* SVG Circular Node - Responsive Resizing Applied Here */}
      <div
        className="relative w-32 h-32 sm:w-44 sm:h-44 flex items-center justify-center rounded-full my-1 cursor-pointer select-none group transition-transform active:scale-95"
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
            stroke="#F4F7FA"
            strokeWidth={strokeWidth}
          />
          {/* Subtle Inner Guideline */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius - 8}
            fill="transparent"
            stroke="#E2E8F0"
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
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center pointer-events-none">
          {isCompleted ? (
            <div className="flex flex-col items-center">
              <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9 text-[#81C995] mb-1" />
              <span className="text-[10px] sm:text-xs font-bold text-[#81C995] uppercase tracking-wider">Đã hoàn thành</span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5">Hôm nay</span>
            </div>
          ) : isPendingConfirmation ? (
            <div className="flex flex-col items-center">
              <span className="text-[10px] sm:text-xs font-bold text-[#FF6B00] animate-bounce">00:00 Hết giờ!</span>
              <span className="text-[10px] sm:text-xs font-bold text-slate-800 mt-1">Xác nhận</span>
            </div>
          ) : isRunning ? (
            <div className="flex flex-col items-center">
              <span className="text-lg sm:text-[1.8rem] font-extrabold font-mono tracking-tight text-slate-900 tabular-nums">
                {displayTime}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-ping" />
                Đang chạy
              </span>
            </div>
          ) : task.accumulatedMs > 0 ? (
            <div className="flex flex-col items-center">
              <span className="text-lg sm:text-[1.8rem] font-extrabold font-mono tracking-tight text-slate-700 tabular-nums">
                {displayTime}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-amber-600">Tạm dừng</span>
            </div>
          ) : (
            <div className="flex flex-col items-center max-w-[100px] sm:max-w-[130px] px-1">
              <span className="text-sm sm:text-base font-bold text-slate-800 line-clamp-2 leading-tight">
                {task.name}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-slate-500 mt-1.5 bg-[#F4F7FA] px-2 sm:px-2.5 py-0.5 rounded-full border border-slate-200">
                {Math.round(task.targetDurationMs / 60000)} phút
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Task Title & Status Details */}
      <div className="w-full text-center mt-1">
        <h3 className="font-bold text-slate-900 text-[13px] sm:text-sm line-clamp-1" title={task.name}>
          {task.name}
        </h3>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 line-clamp-1">
          {isHabit
            ? `Định mức ${Math.round(task.targetDurationMs / 60000)}p/ngày`
            : `Đo lường tiến độ mục tiêu`}
        </p>

        {/* Scheduled Web Push Notification Badge */}
        {isHabit && isRunning && expectedEndFormatted && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-[#FF6B00] bg-[#FFF3E0] px-2 py-0.5 rounded-md border border-[#FF6B00]/30 animate-pulse">
            <Bell className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="truncate max-w-[120px] sm:max-w-none">Hẹn lúc {expectedEndFormatted}</span>
          </div>
        )}
      </div>

      {/* Anti-Accidental Long-Press or Confirmation Button when PENDING_CONFIRMATION */}
      {isPendingConfirmation && (
        <div className="w-full mt-2 sm:mt-2.5 flex flex-col gap-1.5 sm:gap-2">
          {/* Long Press 0.8s Action Button */}
          <button
            type="button"
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            className="relative w-full overflow-hidden bg-gradient-to-r from-[#FF6B00] to-[#E65100] text-white text-[11px] sm:text-xs font-bold py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl shadow-md active:scale-98 transition-transform select-none cursor-pointer"
          >
            <div
              className="absolute left-0 top-0 bottom-0 bg-[#FCC934]/40 transition-all duration-75"
              style={{ width: `${holdingProgress}%` }}
            />
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FCC934]" />
              <span>{holdingProgress > 0 ? `Giữ: ${Math.round(holdingProgress)}%` : 'Nhấn giữ 0.8s xác nhận'}</span>
            </span>
          </button>

          {/* Fallback Single Click Confirm Button */}
          <button
            type="button"
            onClick={() => onConfirmHabit(task.id)}
            className="w-full text-center text-[10px] sm:text-xs font-semibold text-[#FF6B00] hover:underline cursor-pointer py-1"
          >
            Xác nhận nhanh
          </button>
        </div>
      )}

      {/* Normal Action Bar */}
      {!isPendingConfirmation && (
        <div className="w-full mt-2 sm:mt-2.5 pt-2 sm:pt-2.5 border-t border-slate-100 flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5">
          {!isCompleted ? (
            <button
              type="button"
              onClick={() => onToggleTimer(task.id)}
              className={`flex-1 flex items-center justify-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold shadow-xs transition-colors cursor-pointer ${
                isRunning
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                  : 'bg-[#1E3A5F] hover:bg-[#152a45] text-white'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                  <span>Dừng</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                  <span>{task.accumulatedMs > 0 ? 'Tiếp' : 'Bắt đầu'}</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex-1 text-center py-1.5 sm:py-2 px-2 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] sm:text-xs font-bold border border-emerald-200 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              <span>Đã ghi nhận</span>
            </div>
          )}

          <div className="flex gap-1">
            {task.accumulatedMs > 0 && !isCompleted && (
              <button
                type="button"
                onClick={() => onResetTimer(task.id)}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Đặt lại đồng hồ về 0"
              >
                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenProjectStats(task.id)}
              className="p-1.5 sm:p-2 text-[#1E3A5F] hover:bg-[#E8F0FE] rounded-lg transition-colors border border-[#3B6998]/30 cursor-pointer"
              title="Xem báo cáo 3 tầng, ma trận chuỗi & tạo thẻ vinh danh"
            >
              <BarChart2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {isHabit && (
              <button
                type="button"
                onClick={() => onSimulateBreakStreak(task.id)}
                className="p-1.5 sm:p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200 cursor-pointer"
                title="Giả lập đứt chuỗi (Kiểm tra Khiên Bền Bỉ & Nhiệm vụ Đền bù)"
              >
                <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}

            {isHabit && !isCompleted && !isRunning && (
              <button
                type="button"
                onClick={() => onFastForward5s(task.id)}
                className="p-1.5 sm:p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors text-xs font-mono border border-amber-200 cursor-pointer hidden sm:block"
                title="Đặt thời gian còn 5 giây để test ngay chuông & long-press hoàn tất"
              >
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Shield info badge on top-left if available */}
      {isHabit && task.shields > 0 && (
        <div
          className="absolute -top-2 -left-2 bg-[#FCC934] text-slate-900 font-extrabold text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm border border-amber-400"
          title={`${task.shields} Khiên Bền Bỉ sẵn sàng cứu chuỗi`}
        >
          <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-slate-900" />
          <span>{task.shields} khiên</span>
        </div>
      )}
    </div>
  );
};
