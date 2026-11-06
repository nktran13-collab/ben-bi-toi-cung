import React, { useState } from 'react';
import { AlertTriangle, Clock, Scissors, Check, Trash2 } from 'lucide-react';
import { TaskItem, formatDuration } from '../utils/engine';

interface IdleDetectionModalProps {
  task: TaskItem | null;
  isOpen: boolean;
  rawDurationMs: number;
  onSaveTrimmed: (taskId: string, trimmedDurationMs: number) => void;
  onDiscard: (taskId: string) => void;
}

export const IdleDetectionModal: React.FC<IdleDetectionModalProps> = ({
  task,
  isOpen,
  rawDurationMs,
  onSaveTrimmed,
  onDiscard,
}) => {
  if (!isOpen || !task) return null;

  const rawMinutes = Math.max(15, Math.round(rawDurationMs / 60000));
  // Default to 60 mins or half of raw minutes as reasonable focused estimate
  const defaultSelectedMinutes = Math.min(60, rawMinutes);
  const [selectedMinutes, setSelectedMinutes] = useState<number>(defaultSelectedMinutes);

  const trimmedMs = selectedMinutes * 60 * 1000;
  const discardedMs = Math.max(0, rawDurationMs - trimmedMs);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#D93025] to-[#B71C1C] p-5 text-white flex items-center gap-3.5">
          <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center text-white shrink-0 border border-white/20">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Phát hiện Quên Tắt Đồng Hồ (&gt; 3 Giờ)</h3>
            <p className="text-xs text-red-100">Bảo vệ độ chính xác dữ liệu tập trung</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Tác vụ dự án</div>
            <div className="text-base font-bold text-[#1E3A5F] mt-0.5">{task.name}</div>
            <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#D93025]" />
              <span>Đồng hồ đã chạy liên tục: <strong className="text-[#D93025]">{formatDuration(rawDurationMs, true)}</strong> ({rawMinutes} phút)</span>
            </div>
          </div>

          {/* Slider control */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label htmlFor="idle-trim-slider" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Scissors className="w-4 h-4 text-[#FF6B00]" />
                Kéo chọn thời gian thực tế bạn đã tập trung:
              </label>
              <span className="text-sm font-black text-[#1E3A5F] px-2.5 py-1 bg-[#E8F0FE] rounded-lg">
                {selectedMinutes} phút ({formatDuration(trimmedMs, true)})
              </span>
            </div>

            <input
              id="idle-trim-slider"
              type="range"
              min={10}
              max={rawMinutes}
              step={5}
              value={selectedMinutes}
              onChange={(e) => setSelectedMinutes(parseInt(e.target.value, 10))}
              className="w-full accent-[#FF6B00] cursor-pointer h-2 bg-slate-200 rounded-lg"
            />

            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>Tối thiểu: 10 phút</span>
              <span>Cắt bỏ thời gian rác: {Math.round(discardedMs / 60000)} phút</span>
              <span>Toàn bộ: {rawMinutes} phút</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 grid grid-cols-2 gap-3">
            <button
              onClick={() => onDiscard(task.id)}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs"
            >
              <Trash2 className="w-4 h-4 text-slate-500" />
              <span>Hủy toàn bộ phiên này</span>
            </button>
            <button
              onClick={() => onSaveTrimmed(task.id, trimmedMs)}
              className="py-3 px-4 bg-[#1E3A5F] hover:bg-[#162D4A] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 text-xs active:scale-[0.98]"
            >
              <Check className="w-4 h-4 text-[#81C995]" />
              <span>Lưu {selectedMinutes} phút</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
