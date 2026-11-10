import React from 'react';
import {
  Shield,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Plus,
  Sparkles,
  Clock,
  Cloud,
  CloudOff,
  RefreshCw,
  Download,
  Smartphone,
  User,
  FlaskConical,
  Eye,
} from 'lucide-react';
import { getLogicalDate, UserAccount } from '../utils/engine';

interface HeaderProps {
  wakeLockActive: boolean;
  wakeLockRequested: boolean;
  onToggleWakeLock: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  devModeEnabled: boolean;
  onToggleDevMode: () => void;
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
  darkMode,
  onToggleDarkMode,
  devModeEnabled,
  onToggleDevMode,
  totalShields,
  onOpenAddTask,
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
    <header className="sticky top-0 z-30 bg-[#1E3A5F] dark:bg-[#0F1E36] text-white shadow-md border-b border-[#3B6998]/80 transition-colors">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Concept */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B00] to-[#E65100] flex items-center justify-center shadow-md shadow-[#FF6B00]/25 text-white shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Bền bỉ tới cùng
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-white/10 text-[#FCC934] border border-white/15">
                UCL 66-Day System
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#E8F0FE]/90">
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-[#FCC934]" />
                Ngày sinh học: <strong className="text-white">{logicalDate}</strong>
              </span>
              {isPastMidnight && (
                <span
                  className="text-xs bg-[#FF6B00]/20 text-[#FFF3E0] px-2 py-0.5 rounded border border-[#FF6B00]/40 font-semibold"
                  title="Chế độ sinh học 04:00 sáng tính giờ vào ngày hôm trước"
                >
                  Ca đêm (&lt; 04:00)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Global Controls & Sync Badges */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
          {/* Cloud Sync Status Badge */}
          {isSimulatedOffline ? (
            <div
              className="flex items-center gap-1.5 bg-rose-950/60 px-2.5 py-1.5 rounded-lg border border-rose-500/50 text-xs text-rose-200"
              title="Thiết bị đang ở chế độ Ngoại tuyến (Offline). Thay đổi được ghi nguyên tử vào máy."
            >
              <CloudOff className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-semibold">Offline ({pendingSyncCount})</span>
            </div>
          ) : pendingSyncCount > 0 ? (
            <button
              type="button"
              onClick={onTriggerSyncNow}
              disabled={isSyncing}
              className="flex items-center gap-1.5 bg-[#FFF3E0] text-[#FF6B00] hover:bg-amber-100 px-2.5 py-1.5 rounded-lg border border-[#FF6B00]/40 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Có bản ghi chờ đồng bộ. Bấm để đồng bộ ngay."
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Đồng bộ</span>
              <span className="font-mono">({pendingSyncCount})</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-1.5 bg-[#152a45] px-2.5 py-1.5 rounded-lg border border-[#81C995]/50 text-xs text-[#81C995]"
              title="Toàn bộ dữ liệu đã được lưu an toàn"
            >
              <Cloud className="w-3.5 h-3.5 text-[#81C995]" />
              <span className="font-semibold hidden md:inline">Đã lưu</span>
            </div>
          )}

          {/* Account / Backup & Cloud Button */}
          <button
            type="button"
            onClick={onOpenAuthModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
              !account.isAnonymous
                ? 'bg-[#152a45] text-white border-[#81C995]/70'
                : 'bg-[#152a45] text-[#E8F0FE]/90 border-[#3B6998]/60 hover:text-white hover:bg-[#3B6998]/50'
            }`}
            title="Quản lý Tài khoản, Đồng bộ Đám mây & Sao lưu JSON"
          >
            <User className="w-3.5 h-3.5 text-[#FCC934]" />
            <span className="max-w-[95px] sm:max-w-[125px] truncate">
              {account.isAnonymous ? 'Sao lưu / Cloud' : account.email?.split('@')[0]}
            </span>
          </button>

          {/* Total Shields Badge */}
          <div
            className="flex items-center gap-1 bg-[#152a45] px-2.5 py-1.5 rounded-lg border border-[#3B6998]/60 text-xs text-white"
            title="Khiên Bền Bỉ tích luỹ (1 khiên mỗi 7 ngày chuỗi) dùng để bảo vệ chuỗi khi lỡ quên"
          >
            <Shield className="w-3.5 h-3.5 text-[#FCC934] fill-[#FCC934]" />
            <span className="font-bold font-mono">{totalShields}</span>
          </div>

          {/* Screen Wake Lock Toggle */}
          <button
            type="button"
            onClick={onToggleWakeLock}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
              wakeLockRequested
                ? 'bg-[#3B6998] text-white border-[#81C995]/60 shadow-inner'
                : 'bg-[#152a45] text-[#E8F0FE]/70 border-[#3B6998]/40 hover:text-white'
            }`}
            title="Giữ màn hình luôn sáng khi đang bấm giờ tập trung"
          >
            <Eye
              className={`w-3.5 h-3.5 ${wakeLockActive ? 'text-[#FCC934]' : 'text-[#E8F0FE]/60'}`}
            />
            <span className="hidden lg:inline">Giữ sáng</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${wakeLockActive ? 'bg-[#81C995]' : 'bg-gray-500'}`}
            />
          </button>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              darkMode
                ? 'bg-[#3B6998] text-[#FCC934] border-[#FCC934]/50'
                : 'bg-[#152a45] text-[#E8F0FE]/80 border-[#3B6998]/60 hover:text-white hover:bg-[#3B6998]/50'
            }`}
            title={darkMode ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối (Dịu mắt ban đêm)'}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={onToggleSound}
            className={`p-1.5 rounded-lg border border-[#3B6998]/60 bg-[#152a45] transition-colors cursor-pointer ${
              soundEnabled ? 'text-[#FCC934] hover:bg-[#3B6998]' : 'text-gray-400 hover:text-white'
            }`}
            title={soundEnabled ? 'Chuông ngân FM Bell đang BẬT' : 'Chuông đang TẮT'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* PWA Install Button */}
          <button
            type="button"
            onClick={isPWAInstallable ? onPromptInstall : onOpenPWAGuide}
            className="flex items-center gap-1 bg-[#152a45] hover:bg-[#3B6998] text-[#E8F0FE] px-2 py-1.5 rounded-lg text-xs font-medium border border-[#3B6998]/60 transition-colors cursor-pointer"
            title="Cài đặt ứng dụng ra Màn hình chính (PWA)"
          >
            {isPWAInstallable ? (
              <Download className="w-3.5 h-3.5 text-[#81C995]" />
            ) : (
              <Smartphone className="w-3.5 h-3.5 text-[#FCC934]" />
            )}
            <span className="hidden xl:inline">Cài App</span>
          </button>

          {/* Dev Mode Toggle */}
          <button
            type="button"
            onClick={onToggleDevMode}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              devModeEnabled
                ? 'bg-[#FF6B00]/20 text-[#FCC934] border-[#FF6B00]'
                : 'bg-[#152a45] text-[#E8F0FE]/50 border-[#3B6998]/40 hover:text-white'
            }`}
            title={
              devModeEnabled
                ? 'Đang bật Chế độ Nhà phát triển (Dev/Test Toolbar) — Bấm để ẩn'
                : 'Bật công cụ kiểm thử dành cho Nhà phát triển (Dev Mode)'
            }
          >
            <FlaskConical className="w-4 h-4" />
          </button>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={onOpenAddTask}
            className="flex items-center gap-1.5 bg-[#FF6B00] hover:bg-[#E65100] active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm tác vụ</span>
          </button>
        </div>
      </div>
    </header>
  );
};
