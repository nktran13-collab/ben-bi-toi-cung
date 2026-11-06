import React from 'react';
import {
  Shield,
  Sun,
  Volume2,
  VolumeX,
  Plus,
  Sparkles,
  Clock,
  Flame,
  Cloud,
  CloudOff,
  RefreshCw,
  Download,
  Smartphone,
  User,
} from 'lucide-react';
import { getLogicalDate, UserAccount } from '../utils/engine';

interface HeaderProps {
  wakeLockActive: boolean;
  wakeLockRequested: boolean;
  onToggleWakeLock: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  totalShields: number;
  totalActiveStreaks: number;
  onOpenAddTask: () => void;
  onTestSound: () => void;
  account: UserAccount;
  onOpenAuthModal: () => void;
  pendingSyncCount: number;
  isSimulatedOffline: boolean;
  onTriggerSyncNow: () => void;
  isSyncing: boolean;
  isPWAInstallable: boolean;
  onPromptInstall: () => void;
  onOpenPWAGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  wakeLockActive,
  wakeLockRequested,
  onToggleWakeLock,
  soundEnabled,
  onToggleSound,
  totalShields,
  totalActiveStreaks,
  onOpenAddTask,
  onTestSound,
  account,
  onOpenAuthModal,
  pendingSyncCount,
  isSimulatedOffline,
  onTriggerSyncNow,
  isSyncing,
  isPWAInstallable,
  onPromptInstall,
  onOpenPWAGuide,
}) => {
  const logicalDate = getLogicalDate(Date.now(), 4);
  const now = new Date();
  const currentHour = now.getHours();
  const isPastMidnight = currentHour < 4;

  return (
    <header className="sticky top-0 z-30 bg-[#1E3A5F] text-white shadow-md border-b border-[#3B6998]">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Concept */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B00] to-[#E65100] flex items-center justify-center shadow-md shadow-[#FF6B00]/25 text-white shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Bền bỉ tới cùng
              </h1>
              <span className="text-xs font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#3B6998] text-[#E8F0FE] border border-[#3B6998]/50">
                Giai đoạn 3
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#E8F0FE]/90">
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-[#FCC934]" />
                Ngày làm việc: <strong className="text-white">{logicalDate}</strong>
              </span>
              {isPastMidnight && (
                <span
                  className="text-xs bg-[#FF6B00]/20 text-[#FFF3E0] px-2 py-0.5 rounded border border-[#FF6B00]/40 font-semibold"
                  title="Chế độ sinh học 04:00 sáng tính giờ vào ngày hôm trước"
                >
                  Đêm muộn (trước 04:00)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Global Controls & Sync Badges */}
        <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
          {/* Cloud Sync Status Badge */}
          {isSimulatedOffline ? (
            <div
              className="flex items-center gap-1.5 bg-rose-950/60 px-2.5 py-1.5 rounded-lg border border-rose-500/50 text-xs text-rose-200"
              title="Thiết bị đang ở chế độ Ngoại tuyến (Offline). Thay đổi được ghi nguyên tử vào máy."
            >
              <CloudOff className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-semibold">Ngoại tuyến ({pendingSyncCount})</span>
            </div>
          ) : pendingSyncCount > 0 ? (
            <button
              type="button"
              onClick={onTriggerSyncNow}
              disabled={isSyncing}
              className="flex items-center gap-1.5 bg-[#FFF3E0] text-[#FF6B00] hover:bg-amber-100 px-2.5 py-1.5 rounded-lg border border-[#FF6B00]/40 text-xs font-semibold shadow-xs transition-colors"
              title="Có bản ghi chờ đồng bộ lên đám mây. Bấm để đồng bộ ngay."
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Chờ đồng bộ ({pendingSyncCount})</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-1.5 bg-[#152a45] px-2.5 py-1.5 rounded-lg border border-[#81C995]/50 text-xs text-[#81C995]"
              title="Toàn bộ tác vụ đã đồng bộ lên đám mây"
            >
              <Cloud className="w-3.5 h-3.5 text-[#81C995]" />
              <span className="font-semibold hidden sm:inline">Đã đồng bộ</span>
            </div>
          )}

          {/* Account / Save Cloud Button */}
          <button
            type="button"
            onClick={onOpenAuthModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              !account.isAnonymous
                ? 'bg-[#152a45] text-white border-[#81C995]/70'
                : 'bg-[#152a45] text-[#E8F0FE]/80 border-[#3B6998]/60 hover:text-white'
            }`}
            title="Đăng nhập tài khoản để đồng bộ đa thiết bị"
          >
            <User className="w-3.5 h-3.5 text-[#FCC934]" />
            <span className="max-w-[100px] sm:max-w-[130px] truncate">
              {account.isAnonymous ? '☁️ Lưu tiến trình' : account.email?.split('@')[0]}
            </span>
          </button>

          {/* PWA Install Button */}
          <button
            type="button"
            onClick={isPWAInstallable ? onPromptInstall : onOpenPWAGuide}
            className="flex items-center gap-1.5 bg-[#152a45] hover:bg-[#3B6998] text-[#E8F0FE] px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[#3B6998]/60 transition-colors"
            title="Cài đặt Bền Bỉ Tới Cùng ra Màn hình chính (PWA)"
          >
            {isPWAInstallable ? (
              <Download className="w-3.5 h-3.5 text-[#81C995]" />
            ) : (
              <Smartphone className="w-3.5 h-3.5 text-[#FCC934]" />
            )}
            <span className="hidden sm:inline">Cài App</span>
          </button>

          {/* Total Shields Badge */}
          <div
            className="flex items-center gap-1.5 bg-[#152a45] px-2.5 py-1.5 rounded-lg border border-[#3B6998]/60 text-xs text-white"
            title="Khiên Bền Bỉ tích luỹ (1 khiên mỗi 7 ngày chuỗi) dùng để cứu chuỗi khi lỡ quên"
          >
            <Shield className="w-4 h-4 text-[#FCC934] fill-[#FCC934]" />
            <span className="font-semibold">{totalShields}</span>
          </div>

          {/* Screen Wake Lock Toggle */}
          <button
            type="button"
            onClick={onToggleWakeLock}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              wakeLockRequested
                ? 'bg-[#3B6998] text-white border-[#81C995]/60 shadow-inner'
                : 'bg-[#152a45] text-[#E8F0FE]/70 border-[#3B6998]/40 hover:text-white'
            }`}
            title="Screen Wake Lock API: Giữ màn hình luôn sáng khi đang tập trung"
          >
            <Sun
              className={`w-3.5 h-3.5 ${wakeLockActive ? 'text-[#FCC934] animate-pulse' : 'text-[#E8F0FE]/60'}`}
            />
            <span className="hidden sm:inline">Giữ sáng</span>
            <span
              className={`w-2 h-2 rounded-full ${wakeLockActive ? 'bg-[#81C995]' : 'bg-gray-500'}`}
            />
          </button>

          {/* Sound Toggle & Test */}
          <div className="flex items-center bg-[#152a45] rounded-lg border border-[#3B6998]/60 overflow-hidden">
            <button
              type="button"
              onClick={onToggleSound}
              className={`p-1.5 text-xs transition-colors ${
                soundEnabled ? 'text-[#FCC934] hover:bg-[#3B6998]' : 'text-gray-400 hover:text-white'
              }`}
              title={soundEnabled ? 'Chuông ngân FM Bell đang bật (Bấm để tắt)' : 'Chuông đang tắt (Bấm để bật)'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onTestSound}
              className="px-2.5 py-1.5 text-xs text-[#E8F0FE]/80 hover:text-white hover:bg-[#3B6998] border-l border-[#3B6998]/40 hidden sm:inline font-medium"
              title="Nghe thử tiếng chuông ngân FM Bell Chime"
            >
              Chuông
            </button>
          </div>

          {/* Primary Action Button (10% Relentless Orange) */}
          <button
            type="button"
            onClick={onOpenAddTask}
            className="flex items-center gap-1.5 bg-[#FF6B00] hover:bg-[#E65100] active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm tác vụ</span>
          </button>
        </div>
      </div>
    </header>
  );
};
