import React, { useState } from 'react';
import {
  FlaskConical,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  Smartphone,
  ChevronUp,
  ChevronDown,
  Layers,
  Radio,
  Award,
  Moon,
  Clock,
  AlertOctagon,
  Sparkles,
} from 'lucide-react';
import { CURRENT_DEVICE_ID } from '../utils/realtime';

interface DevTestToolbarProps {
  isSimulatedOffline: boolean;
  onToggleSimulatedOffline: () => void;
  pendingSyncCount: number;
  onTriggerSyncNow: () => void;
  isSyncing: boolean;
  onBroadcastTestEvent: () => void;
  lastRealtimeEventMessage: string | null;
  onTestNotification: () => void;
  notificationPermission: NotificationPermission | 'unsupported';
  onRequestNotificationPermission: () => void;
  onOpenPWAGuide: () => void;
  isPWAInstallable: boolean;
  // Phase 3 Test Action Triggers
  onTestMilestone30?: () => void;
  onTestRetroactiveConfirm?: () => void;
  onTestIdleDetection?: () => void;
  onTestStreakBreak1Day?: () => void;
  onTestStreakBreak2Days?: () => void;
}

export const DevTestToolbar: React.FC<DevTestToolbarProps> = ({
  isSimulatedOffline,
  onToggleSimulatedOffline,
  pendingSyncCount,
  onTriggerSyncNow,
  isSyncing,
  onBroadcastTestEvent,
  lastRealtimeEventMessage,
  onTestNotification,
  notificationPermission,
  onRequestNotificationPermission,
  onOpenPWAGuide,
  isPWAInstallable,
  onTestMilestone30,
  onTestRetroactiveConfirm,
  onTestIdleDetection,
  onTestStreakBreak1Day,
  onTestStreakBreak2Days,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      aria-label="Bảng điều khiển kiểm thử Giai đoạn 3"
      className="fixed bottom-3 right-3 z-40 max-w-sm w-full sm:w-96 select-none font-sans"
    >
      {/* Collapsed Pill Button */}
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="ml-auto flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-bold px-3.5 py-2.5 rounded-full shadow-xl border border-[#3B6998] transition-all hover:scale-102 cursor-pointer"
          title="Mở bảng điều khiển kiểm thử Giai đoạn 3"
        >
          <FlaskConical className="w-4 h-4 text-[#FCC934]" />
          <span>Dev Toolbar GĐ3</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs ${
              isSimulatedOffline ? 'bg-rose-500 text-white' : 'bg-[#81C995] text-slate-950 font-extrabold'
            }`}
          >
            {isSimulatedOffline ? 'Offline' : 'Online'}
          </span>
          {pendingSyncCount > 0 && (
            <span className="bg-[#FF6B00] text-white text-xs px-1.5 py-0.2 rounded-full font-mono">
              +{pendingSyncCount}
            </span>
          )}
          <ChevronUp className="w-4 h-4 text-[#E8F0FE]/70" />
        </button>
      ) : (
        /* Expanded Control Panel */
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col transition-all">
          {/* Header */}
          <div className="bg-[#1E3A5F] text-white px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#FCC934]" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Bảng Kiểm Thử Giai Đoạn 3</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-md text-[#E8F0FE]/70 hover:text-white hover:bg-[#3B6998]"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Test Sections */}
          <div className="p-3.5 space-y-3 text-xs max-h-[75vh] overflow-y-auto">
            {/* Phase 3 Special Test Triggers */}
            <div className="bg-gradient-to-r from-[#FFF3E0] to-[#FFE0B2] p-3 rounded-xl border border-[#FF6B00]/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1E3A5F] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#FF6B00]" />
                  <span>🧪 4 Kịch Bản Kiểm Thử Giai Đoạn 3</span>
                </span>
                <span className="text-xs bg-[#FF6B00] text-white px-2 py-0.2 rounded-full font-bold">GĐ3</span>
              </div>

              <div className="grid grid-cols-1 gap-1.5 pt-1">
                {onTestMilestone30 && (
                  <button
                    type="button"
                    onClick={onTestMilestone30}
                    className="py-1.5 px-2 bg-white hover:bg-slate-50 text-[#1E3A5F] border border-orange-200 rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-2xs text-left"
                  >
                    <Award className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                    <span>1. Chạm mốc 29-&gt;30 ngày (Nâng cấp 66 ngày)</span>
                  </button>
                )}

                {onTestRetroactiveConfirm && (
                  <button
                    type="button"
                    onClick={onTestRetroactiveConfirm}
                    className="py-1.5 px-2 bg-white hover:bg-slate-50 text-[#1E3A5F] border border-orange-200 rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-2xs text-left"
                  >
                    <Moon className="w-3.5 h-3.5 text-[#FCC934] shrink-0" />
                    <span>2. Quên xác nhận đêm qua (Truy lĩnh sáng nay)</span>
                  </button>
                )}

                {onTestIdleDetection && (
                  <button
                    type="button"
                    onClick={onTestIdleDetection}
                    className="py-1.5 px-2 bg-white hover:bg-slate-50 text-[#1E3A5F] border border-orange-200 rounded-lg font-bold text-xs flex items-center gap-2 transition-all shadow-2xs text-left"
                  >
                    <Clock className="w-3.5 h-3.5 text-[#D93025] shrink-0" />
                    <span>3. Quên tắt đồng hồ &gt; 3h (Idle Trim Slider)</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  {onTestStreakBreak1Day && (
                    <button
                      type="button"
                      onClick={onTestStreakBreak1Day}
                      className="py-1.5 px-1.5 bg-white hover:bg-slate-50 text-[#D93025] border border-red-200 rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-all shadow-2xs"
                    >
                      <AlertOctagon className="w-3 h-3 text-[#D93025]" />
                      <span>Đứt chuỗi 1 ngày</span>
                    </button>
                  )}

                  {onTestStreakBreak2Days && (
                    <button
                      type="button"
                      onClick={onTestStreakBreak2Days}
                      className="py-1.5 px-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-all shadow-2xs"
                    >
                      <AlertOctagon className="w-3 h-3 text-white" />
                      <span>Đứt chuỗi 2 ngày (Khóa)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Offline / Online Simulation */}
            <div className="bg-[#F4F7FA] p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  {isSimulatedOffline ? (
                    <WifiOff className="w-4 h-4 text-rose-600" />
                  ) : (
                    <Wifi className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>Mạng Ngoại Tuyến (Offline-First)</span>
                </span>
                <button
                  type="button"
                  onClick={onToggleSimulatedOffline}
                  className={`px-2.5 py-1 rounded-md font-bold text-xs transition-colors ${
                    isSimulatedOffline
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isSimulatedOffline ? 'Đang Mất mạng (Bật lại)' : 'Đang Online (Ngắt mạng)'}
                </button>
              </div>

              <div className="text-xs text-slate-600 flex items-center justify-between">
                <span>Hàng đợi chờ đồng bộ:</span>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded-full ${
                    pendingSyncCount > 0 ? 'bg-[#FF6B00]/20 text-[#FF6B00]' : 'bg-[#81C995]/20 text-emerald-800'
                  }`}
                >
                  {pendingSyncCount} bản ghi (sync_status = 1)
                </span>
              </div>

              <button
                type="button"
                onClick={onTriggerSyncNow}
                disabled={isSyncing || isSimulatedOffline}
                className="w-full py-1.5 bg-[#1E3A5F] hover:bg-[#152a45] disabled:opacity-40 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay (Đổi 1 -> 0)'}</span>
              </button>
            </div>

            {/* Realtime Cross-Tab Sync */}
            <div className="bg-[#E8F0FE]/60 p-3 rounded-xl border border-[#3B6998]/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1E3A5F] flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-[#3B6998]" />
                  <span>Đồng Bộ Đa Tab (Broadcast)</span>
                </span>
                <span className="text-xs text-slate-500 font-mono">{CURRENT_DEVICE_ID.substring(0, 12)}...</span>
              </div>

              {lastRealtimeEventMessage && (
                <div className="bg-white p-2 rounded border border-blue-200 text-xs font-mono text-blue-900 truncate">
                  {lastRealtimeEventMessage}
                </div>
              )}

              <button
                type="button"
                onClick={onBroadcastTestEvent}
                className="w-full py-1.5 bg-[#3B6998] hover:bg-[#1E3A5F] text-white rounded-lg font-semibold flex items-center justify-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Bắn gói tin Realtime thử nghiệm</span>
              </button>
            </div>

            {/* Web Push & PWA */}
            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-[#FF6B00]" />
                  <span>Thông Báo Đẩy & PWA</span>
                </span>
                <span className="text-xs font-semibold text-slate-500">Quyền: {notificationPermission}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={notificationPermission === 'granted' ? onTestNotification : onRequestNotificationPermission}
                  className="py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg font-semibold text-xs flex items-center justify-center gap-1"
                >
                  <Bell className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>{notificationPermission === 'granted' ? 'Thử Thông Báo' : 'Bật Quyền Báo'}</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenPWAGuide}
                  className="py-1.5 px-2 bg-[#FF6B00] hover:bg-[#E65100] text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{isPWAInstallable ? 'Cài Đặt App' : 'HD Cài PWA'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
