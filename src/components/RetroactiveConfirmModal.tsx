import React from 'react';
import { Moon, CheckCircle2, Clock } from 'lucide-react';
import { RetroactiveConfirmation } from '../utils/engine';

interface RetroactiveConfirmModalProps {
  item: RetroactiveConfirmation | null;
  isOpen: boolean;
  onConfirmYesterday: (taskId: string) => void;
  onDiscard: (taskId: string) => void;
}

export const RetroactiveConfirmModal: React.FC<RetroactiveConfirmModalProps> = ({
  item,
  isOpen,
  onConfirmYesterday,
  onDiscard,
}) => {
  if (!isOpen || !item) return null;

  const endedDate = new Date(item.endedAtMs);
  const timeStr = endedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E3A5F] to-[#3B6998] p-5 text-white flex items-center gap-3.5">
          <div className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center text-[#FCC934] shrink-0 border border-white/20">
            <Moon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Xác nhận Truy lĩnh Sáng Hôm Sau</h3>
            <p className="text-xs text-blue-100">Bảo toàn chuỗi kiên trì thực tế</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-4 bg-[#FFF3E0] border border-[#FF9E40]/30 rounded-xl text-left">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-[#FF6B00] shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 leading-relaxed">
                Bạn đã hoàn thành đủ định mức cho thói quen{' '}
                <strong className="text-[#1E3A5F]">"{item.taskName}"</strong> vào lúc{' '}
                <strong className="text-[#FF6B00]">{timeStr}</strong> hôm trước (ngày logic{' '}
                <span className="font-semibold text-slate-800">{item.logicalDate}</span>) nhưng chưa kịp nhấn giữ xác
                nhận trước giờ chuyển ngày 04:00 AM.
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600">
            Bạn có muốn truy lĩnh và ghi nhận thành tích cho chuỗi ngày hôm qua không?
          </p>

          {/* Action buttons */}
          <div className="pt-2 space-y-2">
            <button
              onClick={() => onConfirmYesterday(item.taskId)}
              className="w-full py-3 px-4 bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Xác nhận ghi nhận chuỗi hôm qua</span>
            </button>
            <button
              onClick={() => onDiscard(item.taskId)}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl transition-colors text-xs"
            >
              Bỏ qua & Đặt lại ngày hôm nay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
