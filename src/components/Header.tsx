import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Shield,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Plus,
  Sparkles,
  Clock,
  Settings,
  Cloud,
  CloudOff,
  RefreshCw,
  Download,
  Smartphone,
  User,
  FlaskConical,
  Eye,
  HelpCircle,
  MoreVertical,
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
  devToolsUnlocked?: boolean;
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
  onOpenWelcomeModal?: () => void;
  onOpenSettings: () => void;
  dayRolloverHour: number;
  needsReauth?: boolean;
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, hint, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
  >
    <span className="flex min-w-0 items-center gap-2.5">
      {icon}
      <span className="truncate">{label}</span>
    </span>
    {hint && <span className="shrink-0 text-xs font-semibold text-slate-400">{hint}</span>}
  </button>
);

export const Header: React.FC<HeaderProps> = ({
  wakeLockActive,
  wakeLockRequested,
  onToggleWakeLock,
  soundEnabled,
  onToggleSound,
  darkMode,
  onToggleDarkMode,
  devModeEnabled,
  devToolsUnlocked = false,
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
  onOpenWelcomeModal,
  onOpenSettings,
  dayRolloverHour,
  needsReauth = false,
}) => {
  const headerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const logicalDate = getLogicalDate(Date.now(), dayRolloverHour);
  const now = new Date();
  const currentHour = now.getHours();
  const isPastMidnight = currentHour < dayRolloverHour;
  const rolloverLabel = `${String(dayRolloverHour).padStart(2, '0')}:00`;

  // Publish the real header height so in-flow overlays (toast) sit below it
  // instead of overlapping when the header wraps to several rows on phones.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () => {
      document.documentElement.style.setProperty(
        '--app-header-h',
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const runAndClose = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  return (
    <header
      ref={headerRef}
      className="app-header sticky top-0 z-30 bg-[#1E3A5F] dark:bg-[#0F1E36] text-white shadow-md border-b border-[#3B6998]/80 transition-colors"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 sm:py-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* Brand & Concept */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B00] to-[#E65100] flex items-center justify-center shadow-md shadow-[#FF6B00]/25 text-white shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-2 truncate">
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
                  title={`Chế độ sinh học ${rolloverLabel} sáng tính giờ vào ngày hôm trước`}
                >
                  Ca đêm (&lt; {rolloverLabel})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Global Controls: second row on phones, inline on desktop */}
        <div className="order-2 flex w-full items-center justify-between gap-1.5 sm:order-none sm:w-auto sm:justify-end sm:gap-2">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            {/* Cloud Sync Status Badge */}
            {isSimulatedOffline ? (
              <div
                className="flex min-h-11 items-center gap-1.5 bg-rose-950/60 px-2.5 rounded-lg border border-rose-500/50 text-xs text-rose-200 sm:min-h-0 sm:py-1.5"
                title="Thiết bị đang ở chế độ Ngoại tuyến (Offline). Thay đổi được ghi nguyên tử vào máy."
              >
                <CloudOff className="h-[18px] w-[18px] text-rose-400 sm:h-3.5 sm:w-3.5" />
                <span className="font-semibold">
                  Offline<span className="hidden sm:inline"> ({pendingSyncCount})</span>
                </span>
              </div>
            ) : pendingSyncCount > 0 ? (
              <button
                type="button"
                onClick={onTriggerSyncNow}
                disabled={isSyncing}
                className="flex min-h-11 items-center gap-1.5 bg-[#152a45] text-[#FCC934] hover:bg-[#3B6998]/60 px-2.5 rounded-lg border border-[#FF6B00]/60 text-xs font-semibold shadow-xs transition-colors cursor-pointer sm:min-h-0 sm:py-1.5"
                title="Có bản ghi chờ đồng bộ. Bấm để đồng bộ ngay."
              >
                <RefreshCw
                  className={`h-[18px] w-[18px] text-[#FCC934] sm:h-3.5 sm:w-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                />
                <span className="hidden sm:inline">Đồng bộ</span>
                <span className="font-mono text-[11px] leading-none">({pendingSyncCount})</span>
              </button>
            ) : (
              <div
                className="flex min-h-11 items-center gap-1.5 bg-[#152a45] px-2.5 rounded-lg border border-[#81C995]/50 text-xs text-[#81C995] sm:min-h-0 sm:py-1.5"
                title="Toàn bộ dữ liệu đã được lưu an toàn"
              >
                <Cloud className="h-[18px] w-[18px] text-[#81C995] sm:h-3.5 sm:w-3.5" />
                <span className="font-semibold">Đã lưu</span>
              </div>
            )}

            {/* Account / Backup & Cloud Button */}
            <button
              type="button"
              onClick={onOpenAuthModal}
              aria-label={
                needsReauth ? 'Phiên đăng nhập đã hết hạn, xác thực lại' : 'Tài khoản, đồng bộ đám mây và sao lưu'
              }
              className={`flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer sm:min-h-0 sm:min-w-0 sm:py-1.5 ${
                needsReauth
                  ? 'bg-amber-950/60 text-amber-100 border-amber-400/80'
                  : !account.isAnonymous
                    ? 'bg-[#152a45] text-white border-[#81C995]/70'
                    : 'bg-[#152a45] text-[#E8F0FE]/90 border-[#3B6998]/60 hover:text-white hover:bg-[#3B6998]/50'
              }`}
              title={
                needsReauth
                  ? 'Phiên đăng nhập đã hết hạn. Bấm để xác thực lại email.'
                  : 'Quản lý Tài khoản, Đồng bộ Đám mây & Sao lưu JSON'
              }
            >
              <User className="h-[18px] w-[18px] text-[#FCC934] shrink-0 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline max-w-[125px] truncate">
                {account.isAnonymous ? 'Sao lưu / Cloud' : account.email?.split('@')[0]}
              </span>
              {needsReauth && (
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" aria-label="Cần đăng nhập lại" />
              )}
            </button>

            {/* Total Shields Badge */}
            <div
              className="flex min-h-11 items-center gap-1 bg-[#152a45] px-2.5 rounded-lg border border-[#3B6998]/60 text-xs text-white sm:min-h-0 sm:py-1.5"
              title="Khiên Bền Bỉ tích luỹ (1 khiên mỗi 7 ngày chuỗi) dùng để bảo vệ chuỗi khi lỡ quên"
            >
              <Shield className="h-[18px] w-[18px] text-[#FCC934] fill-[#FCC934] sm:h-3.5 sm:w-3.5" />
              <span className="font-bold font-mono text-[11px] leading-none">{totalShields}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Secondary controls stay inline on desktop, move into the mobile menu */}
            <div className="hidden sm:flex items-center gap-1.5 sm:gap-2">
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
                <Eye className={`w-3.5 h-3.5 ${wakeLockActive ? 'text-[#FCC934]' : 'text-[#E8F0FE]/60'}`} />
                <span className="hidden lg:inline">Giữ sáng</span>
                <span className={`w-1.5 h-1.5 rounded-full ${wakeLockActive ? 'bg-[#81C995]' : 'bg-gray-500'}`} />
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

              {/* Day Rollover Settings */}
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1.5 rounded-lg border border-[#3B6998]/60 bg-[#152a45] text-[#E8F0FE]/80 hover:text-white hover:bg-[#3B6998]/50 transition-colors cursor-pointer"
                title={`Cài đặt: ngày mới bắt đầu lúc ${rolloverLabel} (mặc định 04:00)`}
              >
                <Settings className="w-4 h-4" />
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

              {/* App Guide / Welcome Info */}
              {onOpenWelcomeModal && (
                <button
                  type="button"
                  onClick={onOpenWelcomeModal}
                  className="p-1.5 rounded-lg border border-[#3B6998]/60 bg-[#152a45] text-[#FCC934] hover:bg-[#3B6998] transition-colors cursor-pointer"
                  title="Xem Giới thiệu & Hướng dẫn sử dụng ứng dụng"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              )}

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

              {/* Dev Mode Toggle (hidden unless unlocked or already enabled) */}
              {(devModeEnabled || devToolsUnlocked) && (
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
              )}
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={onOpenAddTask}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 bg-[#FF6B00] hover:bg-[#E65100] active:scale-95 text-white text-xs font-bold px-3 rounded-lg shadow-sm transition-all cursor-pointer sm:min-h-0 sm:flex-none sm:py-1.5"
              title="Thêm tác vụ mới"
            >
              <Plus className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
              <span className="inline sm:hidden">Thêm</span>
              <span className="hidden sm:inline">Thêm tác vụ</span>
            </button>

            {/* Mobile-only overflow menu */}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Mở menu cài đặt và tiện ích"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#3B6998]/60 bg-[#152a45] text-[#E8F0FE] transition-colors hover:bg-[#3B6998] cursor-pointer sm:hidden"
            >
              <MoreVertical className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-3 top-full z-50 mt-1 w-[calc(100vw-1.5rem)] max-w-xs overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:hidden"
        >
          <MenuItem
            icon={<User className="w-4 h-4 text-[#FCC934]" />}
            label="Tài khoản & Sao lưu"
            hint={account.isAnonymous ? 'Đăng nhập' : account.email?.split('@')[0]}
            onClick={runAndClose(onOpenAuthModal)}
          />
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          <MenuItem
            icon={<Eye className="w-4 h-4 text-[#3B6998]" />}
            label="Giữ màn hình sáng"
            hint={wakeLockActive ? 'Bật' : 'Tắt'}
            onClick={runAndClose(onToggleWakeLock)}
          />
          <MenuItem
            icon={darkMode ? <Sun className="w-4 h-4 text-[#FCC934]" /> : <Moon className="w-4 h-4 text-[#3B6998]" />}
            label="Giao diện tối"
            hint={darkMode ? 'Bật' : 'Tắt'}
            onClick={runAndClose(onToggleDarkMode)}
          />
          <MenuItem
            icon={
              soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#81C995]" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )
            }
            label="Âm thanh chuông"
            hint={soundEnabled ? 'Bật' : 'Tắt'}
            onClick={runAndClose(onToggleSound)}
          />
          <MenuItem
            icon={<Settings className="w-4 h-4 text-[#3B6998] dark:text-[#81C995]" />}
            label="Cài đặt"
            hint={rolloverLabel}
            onClick={runAndClose(onOpenSettings)}
          />
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          {onOpenWelcomeModal && (
            <MenuItem
              icon={<HelpCircle className="w-4 h-4 text-[#FF6B00]" />}
              label="Giới thiệu & Hướng dẫn"
              onClick={runAndClose(onOpenWelcomeModal)}
            />
          )}
          <MenuItem
            icon={<Smartphone className="w-4 h-4 text-[#3B6998]" />}
            label={isPWAInstallable ? 'Cài ứng dụng ra màn hình chính' : 'Cách cài ứng dụng'}
            onClick={runAndClose(isPWAInstallable ? onPromptInstall : onOpenPWAGuide)}
          />
          {(devModeEnabled || devToolsUnlocked) && (
            <MenuItem
              icon={<FlaskConical className="w-4 h-4 text-slate-400" />}
              label="Chế độ nhà phát triển"
              hint={devModeEnabled ? 'Bật' : 'Tắt'}
              onClick={runAndClose(onToggleDevMode)}
            />
          )}
          <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
          <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-slate-400">
            <span>Chuỗi đang duy trì</span>
            <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Shield className="w-3 h-3 text-[#FCC934] fill-[#FCC934]" />
              {totalShields} khiên
            </span>
          </div>
        </div>
      )}
    </header>
  );
};
