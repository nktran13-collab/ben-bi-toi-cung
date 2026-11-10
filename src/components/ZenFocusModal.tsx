import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  Headphones,
  VolumeX,
  Flame,
  Sparkles,
  CheckCircle2,
  Check,
  Maximize2,
} from 'lucide-react';
import {
  TaskItem,
  calculateHabitRemaining,
  calculateProjectProgress,
  formatDuration,
  getEffectiveTargetDurationMs,
} from '../utils/engine';
import { soundEngine } from '../utils/audio';

interface ZenFocusModalProps {
  task: TaskItem | null;
  isOpen: boolean;
  currentTimeMs: number;
  onClose: () => void;
  onToggleTimer: (taskId: string) => void;
  onConfirmHabit: (taskId: string) => void;
  onCompleteSprintSession: (taskId: string) => void;
}

export const ZenFocusModal: React.FC<ZenFocusModalProps> = ({
  task,
  isOpen,
  currentTimeMs,
  onClose,
  onToggleTimer,
  onConfirmHabit,
  onCompleteSprintSession,
}) => {
  const [ambientPlaying, setAmbientPlaying] = useState(false);
  const [holdingProgress, setHoldingProgress] = useState(0);
  const holdStartTimeRef = useRef<number | null>(null);
  const holdAnimFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setAmbientPlaying(soundEngine.getIsAmbientPlaying());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      soundEngine.stopAmbientFocus();
      setAmbientPlaying(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  const isRunning = task.status === 'running';
  const isHabit = task.mode === 'habit';
  const isCompleted = task.status === 'completed_today';
  const isPendingConfirmation = task.status === 'pending_confirmation';
  const effectiveTargetMs = getEffectiveTargetDurationMs(task);

  const size = 280;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let displayTime = '';
  let progressRatio = 0;
  let strokeColor = '#FF6B00';

  if (isHabit) {
    const { remainingMs, progressRatio: ratio } = calculateHabitRemaining(
      effectiveTargetMs,
      task.startedAtMs,
      task.accumulatedMs,
      currentTimeMs
    );
    progressRatio = isCompleted ? 1 : ratio;
    displayTime = formatDuration(isCompleted ? effectiveTargetMs : remainingMs);
    strokeColor = isCompleted ? '#81C995' : '#FF6B00';
  } else {
    const { elapsedMs, progressRatio: ratio } = calculateProjectProgress(
      effectiveTargetMs,
      task.startedAtMs,
      task.accumulatedMs,
      currentTimeMs
    );
    progressRatio = Math.min(1, ratio);
    displayTime = formatDuration(elapsedMs, true);
    strokeColor = '#38BDF8';
  }

  const strokeDashoffset = circumference * (1 - Math.max(0, Math.min(1, progressRatio)));

  const handleToggleAmbient = () => {
    if (ambientPlaying) {
      soundEngine.stopAmbientFocus();
      setAmbientPlaying(false);
    } else {
      const started = soundEngine.startAmbientFocus(0.14);
      setAmbientPlaying(started);
    }
  };

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

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#0B1528] via-[#132542] to-[#1E3A5F] text-white flex flex-col justify-between p-6 sm:p-10 select-none animate-fade-in">
      {/* Top Bar */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold tracking-wider uppercase text-[#FCC934] flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Không Gian Tập Trung Sâu (Zen Focus)</span>
          </span>
          {isHabit && (
            <span className="px-3 py-1 rounded-full bg-[#FF6B00]/20 border border-[#FF6B00]/40 text-xs font-bold text-[#FF9E40] flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>Chuỗi {task.currentStreak} ngày</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleToggleAmbient}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              ambientPlaying
                ? 'bg-[#FF6B00] text-white border-[#FF6B00] shadow-lg shadow-[#FF6B00]/30'
                : 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/15'
            }`}
            title="Bật/Tắt âm thanh sóng âm Brown Noise giúp não bộ tập trung sâu"
          >
            {ambientPlaying ? (
              <>
                <Headphones className="w-4 h-4 animate-pulse" />
                <span>Sóng Tập Trung: BẬT</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-400" />
                <span>Sóng Tập Trung: TẮT</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors cursor-pointer"
            title="Thoát chế độ Zen (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center Focus Ring */}
      <div className="flex flex-col items-center justify-center my-auto py-6">
        <div className="text-center mb-6 max-w-lg">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {task.name}
          </h2>
          {task.notes ? (
            <p className="text-sm text-blue-200/80 mt-2 italic">“{task.notes}”</p>
          ) : (
            <p className="text-xs text-blue-200/60 mt-1.5">
              {isHabit
                ? `Mục tiêu định mức: ${Math.round(effectiveTargetMs / 60000)} phút không xao nhãng`
                : 'Tập trung sâu — Mọi giây phút đều được ghi nhận chính xác'}
            </p>
          )}
        </div>

        <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
          {/* Breathing glow when running */}
          {isRunning && (
            <div className="absolute inset-0 rounded-full bg-[#FF6B00]/15 blur-2xl animate-pulse pointer-events-none" />
          )}

          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${size} ${size}`}
            className="transform -rotate-90"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={strokeWidth}
            />
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

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            {isCompleted ? (
              <div className="flex flex-col items-center">
                <CheckCircle2 className="w-12 h-12 text-[#81C995] mb-2" />
                <span className="text-base font-bold text-[#81C995] uppercase tracking-wider">
                  Đã Hoàn Thành
                </span>
              </div>
            ) : (
              <>
                <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-white tabular-nums">
                  {displayTime}
                </span>
                <span className="text-xs font-semibold text-blue-200/80 mt-2 flex items-center gap-1.5">
                  {isRunning ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>Đang tập trung cao độ</span>
                    </>
                  ) : isPendingConfirmation ? (
                    <span className="text-[#FCC934] font-bold">Đã chạm mốc 00:00!</span>
                  ) : (
                    <span>Đang tạm dừng</span>
                  )}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {isPendingConfirmation ? (
            <button
              type="button"
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onClick={() => onConfirmHabit(task.id)}
              className="relative overflow-hidden px-8 py-4 rounded-2xl bg-gradient-to-r from-[#FF6B00] to-[#E65100] text-white font-bold text-sm shadow-xl cursor-pointer"
            >
              <div
                className="absolute left-0 top-0 bottom-0 bg-[#FCC934]/40 transition-all duration-75"
                style={{ width: `${holdingProgress}%` }}
              />
              <span className="relative z-10 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FCC934]" />
                <span>Xác nhận hoàn thành chuỗi hôm nay</span>
              </span>
            </button>
          ) : !isCompleted ? (
            <>
              <button
                type="button"
                onClick={() => onToggleTimer(task.id)}
                className={`px-8 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-2.5 shadow-xl transition-all cursor-pointer active:scale-95 ${
                  isRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    : 'bg-[#FF6B00] hover:bg-[#E65100] text-white'
                }`}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-5 h-5 fill-current" />
                    <span>Tạm dừng</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>{task.accumulatedMs > 0 ? 'Tiếp tục tập trung' : 'Bắt đầu tập trung'}</span>
                  </>
                )}
              </button>

              {!isHabit && task.accumulatedMs >= 60000 && (
                <button
                  type="button"
                  onClick={() => {
                    onCompleteSprintSession(task.id);
                    onClose();
                  }}
                  className="px-6 py-3.5 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-xl transition-all cursor-pointer"
                >
                  <Check className="w-5 h-5" />
                  <span>Hoàn tất & Lưu phiên</span>
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Footer quote */}
      <div className="text-center text-xs text-blue-200/60">
        “Chiến thắng không thuộc về người thông minh nhất, mà thuộc về người bền bỉ tới cùng.”
      </div>
    </div>
  );
};
