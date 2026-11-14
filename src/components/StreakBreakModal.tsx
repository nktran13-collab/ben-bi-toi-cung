import React from 'react';
import { AlertOctagon, Shield, Flame, RotateCcw, Zap, X, Lock, RefreshCw } from 'lucide-react';
import { TaskItem, calculateCheckpoint } from '../utils/engine';

interface StreakBreakModalProps {
  task: TaskItem;
  isOpen: boolean;
  missedDays?: number;
  onClose: () => void;
  onUseShield: (taskId: string) => void;
  onAcceptCompensation: (taskId: string) => void;
  onResetToCheckpoint: (taskId: string) => void;
  onFullReset?: (taskId: string) => void;
}

export const StreakBreakModal: React.FC<StreakBreakModalProps> = ({
  task,
  isOpen,
  missedDays = 1,
  onClose,
  onUseShield,
  onAcceptCompensation,
  onResetToCheckpoint,
  onFullReset,
}) => {
  if (!isOpen) return null;

  const checkpoint = calculateCheckpoint(task.currentStreak);
  const hasShield = task.shields >= missedDays;
  const normalMinutes = Math.round(task.targetDurationMs / 60000);
  const doubleMinutes = normalMinutes * 2;
  const isSevereBreak = missedDays >= 2 && !hasShield;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-rose-200 overflow-hidden flex flex-col">
        {/* Urgent Warning Header (Coral Red #D93025) */}
        <div className="bg-[#D93025] text-white p-5 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/20 rounded-xl mt-0.5">
              <AlertOctagon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-extrabold bg-white/25 px-2 py-0.5 rounded-full">
                  {isSevereBreak ? 'Kỷ luật chuỗi nghiêm ngặt' : 'Bảo vệ chuỗi kiên trì'}
                </span>
                <span className="text-xs text-white/90">
                  {missedDays === 1 ? 'Bỏ lỡ 1 ngày' : `Bỏ lỡ ${missedDays} ngày liên tiếp`}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold mt-1 text-white">Cảnh báo đứt chuỗi: {task.name}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current State Info */}
        <div className="bg-rose-50/70 p-4 border-b border-rose-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#FF6B00] fill-[#FF6B00]" />
            <span className="text-slate-700">Chuỗi đang giữ:</span>
            <strong className="text-slate-900 font-mono text-sm">{task.currentStreak} ngày</strong>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-rose-200">
            <Shield className="w-4 h-4 text-[#FCC934] fill-[#FCC934]" />
            <span className="text-slate-700">Kho khiên:</span>
            <strong className="text-amber-800 font-bold">{task.shields} khiên</strong>
          </div>
        </div>

        {/* Severe Break Notice */}
        {isSevereBreak && (
          <div className="p-4 bg-red-50 border-b border-red-200 text-xs text-red-800 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-[#D93025] shrink-0 mt-0.5" />
            <div>
              <strong>Nút Đi tiếp đã bị khóa:</strong> Bạn đã bỏ lỡ từ 2 ngày liên tiếp trở lên mà không đủ khiên. Để
              bảo vệ kỷ luật thực chất của chuỗi, bạn chỉ có thể chọn Lùi về Cột mốc Bảo lưu gần nhất hoặc Reset toàn
              bộ.
            </div>
          </div>
        )}

        {/* Action Options */}
        <div className="p-5 space-y-3.5">
          {/* Option 1: Use Shield (Only if has enough shields) */}
          {hasShield && (
            <div className="p-4 rounded-xl border border-[#FCC934] bg-amber-50/60 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#FCC934] text-slate-900 mt-0.5">
                    <Shield className="w-5 h-5 fill-slate-900" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Dùng {missedDays} Khiên Bền Bỉ</span>
                      <span className="text-xs bg-[#FCC934] text-slate-950 font-extrabold px-1.5 py-0.2 rounded">
                        Khuyên dùng
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Kích hoạt trạng thái <strong className="text-amber-800">FROZEN_BY_SHIELD</strong> (tô màu Vàng kim
                      trên lưới) để bảo toàn chuỗi {task.currentStreak} ngày.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUseShield(task.id);
                    onClose();
                  }}
                  className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-xs bg-[#1E3A5F] hover:bg-[#152a45] text-white active:scale-95"
                >
                  Dùng {missedDays} khiên
                </button>
              </div>
            </div>
          )}

          {/* Option 2: Compensation Quest (Allowed when missed 1 day and no shield) */}
          {missedDays === 1 && !hasShield && (
            <div className="p-4 rounded-xl border border-[#FF6B00]/40 bg-[#FFF3E0]/70 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#FF6B00] text-white mt-0.5">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Cơ hội Đi tiếp: Nhiệm vụ Đền bù (x2 thời gian)</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Kích hoạt <strong className="text-[#1E3A5F]">MAKEUP_RECOVERED</strong>: Bạn cam kết hoàn thành{' '}
                      <strong className="text-[#FF6B00]">{doubleMinutes} phút</strong> hôm nay (thay vì {normalMinutes}{' '}
                      phút) để khôi phục chuỗi hoàn toàn.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onAcceptCompensation(task.id);
                    onClose();
                  }}
                  className="shrink-0 px-3 py-2 bg-[#FF6B00] hover:bg-[#E65100] active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                >
                  Nhận đền bù x2
                </button>
              </div>
            </div>
          )}

          {/* Option 3: Checkpoint Rollback */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-200 text-slate-700 mt-0.5">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Lùi về Cột mốc Bảo lưu gần nhất: Ngày {checkpoint}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Bảo vệ thành quả: Hệ thống giữ lại cột mốc đạt được (7, 14, 21, 30, 45, 60 ngày) thay vì bắt đầu lại
                    từ con số 0.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onResetToCheckpoint(task.id);
                  onClose();
                }}
                className="shrink-0 px-3 py-2 bg-slate-700 hover:bg-slate-800 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
              >
                Về Ngày {checkpoint}
              </button>
            </div>
          </div>

          {/* Option 4: Full Reset (Only in severe break or manual choice) */}
          <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <RefreshCw className="w-4 h-4 text-red-500" />
              <span>Reset toàn phần về Ngày 0 (Bắt đầu chu trình mới):</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onFullReset) onFullReset(task.id);
                else onResetToCheckpoint(task.id);
                onClose();
              }}
              className="px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-100 rounded-lg font-semibold transition-colors"
            >
              Reset về Ngày 0
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#F4F7FA] px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
