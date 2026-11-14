import React from 'react';
import { Bell, BellOff, Clock, LogIn, X } from 'lucide-react';
import { PUSH_REMINDER_HOUR } from '../utils/push';
import type { PushStatus } from '../utils/usePushReminders';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayRolloverHour: number;
  onChangeDayRolloverHour: (hour: number) => void;
  pushStatus: PushStatus;
  pushBusy: boolean;
  pushError: string | null;
  onTogglePush: (enabled: boolean) => void;
  onRequestLogin: () => void;
}

const HOUR_OPTIONS = [0, 1, 2, 3, 4, 5, 6];

const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  dayRolloverHour,
  onChangeDayRolloverHour,
  pushStatus,
  pushBusy,
  pushError,
  onTogglePush,
  onRequestLogin,
}) => {
  if (!isOpen) return null;

  const pushOn = pushStatus === 'on';
  const reminderLabel = formatHour(PUSH_REMINDER_HOUR);

  const renderPushControl = () => {
    if (pushStatus === 'loading') {
      return <span className="text-[11px] font-medium text-slate-400">Đang kiểm tra…</span>;
    }
    if (pushStatus === 'unsupported') {
      return <span className="text-[11px] font-medium text-slate-400">Trình duyệt không hỗ trợ</span>;
    }
    if (pushStatus === 'denied') {
      return (
        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <BellOff className="h-3.5 w-3.5" />
          Đã bị chặn
        </span>
      );
    }
    if (pushStatus === 'anonymous') {
      return (
        <button
          type="button"
          onClick={onRequestLogin}
          className="flex items-center gap-1.5 rounded-lg border border-[#3B6998]/50 bg-[#E8F0FE]/70 px-2.5 py-1.5 text-[11px] font-bold text-[#1E3A5F] transition-colors hover:bg-[#E8F0FE] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <LogIn className="h-3.5 w-3.5" />
          Đăng nhập
        </button>
      );
    }
    return (
      <button
        type="button"
        role="switch"
        aria-checked={pushOn}
        aria-label="Bật nhắc nhở đẩy hằng ngày"
        disabled={pushBusy}
        onClick={() => onTogglePush(!pushOn)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          pushOn ? 'bg-[#FF6B00]' : 'bg-slate-300 dark:bg-slate-600'
        } ${pushBusy ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
            pushOn ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    );
  };

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-[#F4F7FA] px-5 py-4 dark:border-slate-800 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E3A5F] text-[#FCC934]">
              <Clock className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 id="settings-modal-title" className="text-base font-bold text-[#1E3A5F] dark:text-slate-100">
                Cài đặt
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Ngày sinh học & nhắc nhở</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cài đặt"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Ngày mới bắt đầu lúc
            </span>
            <div role="radiogroup" aria-label="Giờ bắt đầu ngày mới" className="mt-2 grid grid-cols-4 gap-2">
              {HOUR_OPTIONS.map((hour) => {
                const selected = hour === dayRolloverHour;
                return (
                  <button
                    key={hour}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onChangeDayRolloverHour(hour)}
                    className={`rounded-xl border px-2 py-2.5 font-mono text-sm font-bold transition-colors ${
                      selected
                        ? 'border-[#FF6B00] bg-[#FF6B00] text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-[#FF6B00]/50 hover:text-[#FF6B00] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-[#FF6B00]/60'
                    }`}
                  >
                    {formatHour(hour)}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="rounded-xl border border-[#3B6998]/25 bg-[#E8F0FE]/60 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            Mặc định <strong className="text-[#1E3A5F] dark:text-slate-100">04:00</strong> để người thức khuya vẫn tính
            vào ngày hôm trước. Mốc mới áp dụng từ lần chuyển ngày kế tiếp; dữ liệu đã ghi vẫn giữ ngày logic cũ.
          </p>

          {pushStatus !== 'unconfigured' && (
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-[#1E3A5F] dark:text-slate-100">
                    <Bell className="h-4 w-4 text-[#FF6B00]" />
                    Nhắc nhở hằng ngày
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    Gửi thông báo đẩy lúc <strong>{reminderLabel}</strong> (giờ máy) nếu còn thói quen chưa hoàn thành.
                    Chỉ gửi khi đã đăng nhập email và thiết bị có mạng.
                  </p>
                </div>
                {renderPushControl()}
              </div>

              {pushStatus === 'denied' && (
                <p className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
                  Hãy mở cài đặt trình duyệt, cho phép thông báo cho trang này rồi tải lại.
                </p>
              )}
              {pushError && (
                <p className="mt-2 text-[11px] leading-relaxed text-red-600 dark:text-red-400">{pushError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
