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

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
  onOpenQuickStart?: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose, onOpenQuickStart }) => {
  // Checkbox: Default is checked ("Hiện lại lần sau") or unchecked based on preference
  const [showNextTime, setShowNextTime] = useState(false);

  if (!isOpen) return null;

  const handleStartNow = () => {
    // If user checked "Hiện lại lần sau", dontShowAgain is false.
    // If user unchecked it, dontShowAgain is true (won't show automatically next time).
    onClose(!showNextTime);
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
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col text-slate-800 dark:text-slate-100 transition-all">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#1E3A5F] via-[#2A4D7A] to-[#FF6B00] text-white p-5 sm:p-6 relative overflow-hidden shrink-0">
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
                  <span>Chào mừng bạn mới</span>
                  <span>•</span>
                  <span>Kỷ luật 66 ngày UCL</span>
                </div>
                <h2 className="text-lg sm:text-2xl font-extrabold text-white leading-tight">Bền Bỉ Tới Cùng</h2>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRemindLater}
              aria-label="Đóng bảng hướng dẫn"
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="mt-3 text-xs sm:text-sm text-[#E8F0FE]/90 leading-relaxed font-normal">
            Không gian rèn luyện kỷ luật không bỏ cuộc, giúp bạn biến hành động có chủ đích thành phản xạ tự nhiên sau
            30 – 66 ngày bền bỉ.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. Habit Mode */}
            <div className="bg-orange-50/70 dark:bg-orange-950/20 p-3.5 rounded-2xl border border-orange-200/80 dark:border-orange-900/40 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center shrink-0 shadow-xs shadow-orange-500/30">
                <Flame className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Thói Quen & Chuỗi Ngày</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Đồng hồ đếm ngược từng phút, tự động tích lũy <strong>Chuỗi ngày (Streak)</strong> không ngắt quãng
                  hướng đến cột mốc 66 ngày tự động hóa.
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
                  <span>Khiên Bền Bỉ (Shield)</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Cứ mỗi <strong>7 ngày kỷ luật</strong> bạn nhận 1 Khiên. Khi lỡ quên hoặc có việc đột xuất, Khiên sẽ
                  bảo vệ giữ nguyên chuỗi streak cho bạn.
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
                  <span>Dự Án & Cắt Gọt Thời Gian</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Bấm giờ làm việc sâu, dễ dàng <strong>cắt gọt bớt phút xao nhãng</strong> và chốt từng phiên vào nhật
                  ký dự án chi tiết.
                </p>
              </div>
            </div>

            {/* 4. Sinh học 04:00 AM & Cloud Sync */}
            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Đồng Bộ Đám Mây & 04:00 AM</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Ngày mới chuyển lúc <strong>04:00 sáng</strong> cho người thức khuya. Xác thực email bằng mã OTP để
                  đồng bộ dữ liệu giữa các thiết bị khi có mạng.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Bonus Pill Highlights */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1 font-medium">
              <Headphones className="w-3.5 h-3.5 text-[#FF6B00]" />
              Zen Focus (Brown Noise)
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
            <span className="flex items-center gap-1 font-medium">
              <Moon className="w-3.5 h-3.5 text-[#1E3A5F] dark:text-[#FCC934]" />
              Dark Mode dịu mắt
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
            <span className="flex items-center gap-1 font-medium">
              <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
              Dùng ngoại tuyến, đồng bộ khi có mạng
            </span>
          </div>

          {/* Re-show preference checkbox */}
          <div className="pt-1 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showNextTime}
                onChange={(e) => setShowNextTime(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-[#FF6B00] focus:ring-[#FF6B00] accent-[#FF6B00] cursor-pointer"
              />
              <span>Tiếp tục hiện lại bảng mô tả này vào lần mở sau</span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#F8FAFC] dark:bg-slate-800/80 px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-200 dark:border-slate-700 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRemindLater}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Để sau (Hiện lại lần tới)</span>
          </button>

          <button
            type="button"
            onClick={handleStartNow}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-[#FF6B00] to-[#E65100] hover:from-[#E65100] hover:to-[#D84315] active:scale-98 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Bắt đầu trải nghiệm ngay</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
