import React, { useState, useRef } from 'react';
import {
  X,
  Cloud,
  Mail,
  Shield,
  LogOut,
  Database,
  Key,
  Send,
  RefreshCw,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { UserAccount, formatClockTime } from '../utils/engine';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: UserAccount;
  onLoginSuccess: (
    email: string,
    provider: 'mock_otp' | 'supabase',
    supabaseUrl?: string,
    supabaseAnonKey?: string
  ) => void;
  onLogout: () => void;
  onTriggerSyncNow: () => void;
  isSyncing: boolean;
  onExportBackupJSON?: () => void;
  onImportBackupJSON?: (jsonStr: string) => boolean;
  onResetToCleanStarter?: () => void;
  onLoadDemoSeed?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  account,
  onLoginSuccess,
  onLogout,
  onTriggerSyncNow,
  isSyncing,
  onExportBackupJSON,
  onImportBackupJSON,
  onResetToCleanStarter,
  onLoadDemoSeed,
}) => {
  const [authMode, setAuthMode] = useState<'mock_otp' | 'supabase'>('mock_otp');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'enter_email' | 'enter_otp'>('enter_email');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmCleanReset, setConfirmCleanReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ Email hợp lệ.');
      return;
    }
    setError(null);
    setStep('enter_otp');
    setInfo(`Đã gửi mã xác nhận 6 số đến ${email}. (Mã xác thực nhanh: 123456)`);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim() !== '123456') {
      setError('Mã xác thực không chính xác. Hãy nhập mã: 123456');
      return;
    }
    setError(null);
    onLoginSuccess(email.trim(), 'mock_otp');
    onClose();
  };

  const handleConnectSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Vui lòng nhập Email để liên kết tài khoản.');
      return;
    }
    if (!supabaseUrl.startsWith('https://')) {
      setError('SUPABASE_URL phải bắt đầu bằng https://');
      return;
    }
    if (!supabaseAnonKey.trim()) {
      setError('Vui lòng nhập SUPABASE_ANON_KEY.');
      return;
    }

    onLoginSuccess(email.trim(), 'supabase', supabaseUrl.trim(), supabaseAnonKey.trim());
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportBackupJSON) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const ok = onImportBackupJSON(content);
      if (ok) {
        setError(null);
        setInfo('Đã khôi phục dữ liệu từ file sao lưu (.json) thành công!');
      } else {
        setError('File sao lưu không hợp lệ hoặc bị hỏng.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col text-slate-800">
        {/* Header */}
        <div className="bg-[#1E3A5F] text-white p-5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#3B6998] text-[#FCC934]">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {account.isAnonymous ? 'Sao Lưu & Đồng Bộ Đám Mây' : 'Tài Khoản & Quản Trị Dữ Liệu'}
              </h2>
              <p className="text-xs text-[#E8F0FE]/80">
                {account.isAnonymous
                  ? 'Bảo vệ chuỗi kỷ luật, xuất file Backup & đồng bộ đa thiết bị'
                  : `Đang liên kết: ${account.email}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#E8F0FE]/70 hover:text-white hover:bg-[#3B6998] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Backup & Restore JSON Section */}
          <div className="bg-[#F4F7FA] p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider">
                Sao lưu & Khôi phục File (.JSON)
              </span>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                An toàn 100%
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tải toàn bộ tác vụ, chuỗi ngày và lịch sử phiên làm việc về máy dưới dạng file{' '}
              <code className="font-mono text-[#1E3A5F]">.json</code> để lưu trữ hoặc chuyển sang thiết bị khác.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {onExportBackupJSON && (
                <button
                  type="button"
                  onClick={onExportBackupJSON}
                  className="py-2 px-3 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-[#FCC934]" />
                  <span>Tải bản Sao lưu</span>
                </button>
              )}
              {onImportBackupJSON && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2 px-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Nhập file JSON</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Starter Reset / Demo Data Switcher */}
          {(onResetToCleanStarter || onLoadDemoSeed) && (
            <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200/80 space-y-2.5">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Thiết lập Không gian Bền Bỉ của riêng bạn</span>
              </div>
              <p className="text-xs text-slate-600">
                Đặt toàn bộ chuỗi về <strong>Ngày 0</strong> để bắt đầu hành trình thực tế, hoặc nạp bộ dữ liệu mẫu 21 ngày để trải nghiệm tính năng.
              </p>

              {!confirmCleanReset ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {onResetToCleanStarter && (
                    <button
                      type="button"
                      onClick={() => setConfirmCleanReset(true)}
                      className="py-2 px-2.5 bg-white hover:bg-amber-100/60 text-slate-800 border border-amber-300 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#FF6B00]" />
                      <span>Bắt đầu từ Ngày 0</span>
                    </button>
                  )}
                  {onLoadDemoSeed && (
                    <button
                      type="button"
                      onClick={() => {
                        onLoadDemoSeed();
                        onClose();
                      }}
                      className="py-2 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F]" />
                      <span>Nạp dữ liệu Demo</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-white p-3 rounded-lg border border-red-200 space-y-2">
                  <p className="text-xs text-red-700 font-medium">
                    Đặt lại toàn bộ chuỗi về Ngày 0 và xóa lịch sử demo để bắt đầu mới?
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmCleanReset(false)}
                      className="px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-100 rounded-md cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onResetToCleanStarter) onResetToCleanStarter();
                        setConfirmCleanReset(false);
                        onClose();
                      }}
                      className="px-3 py-1 text-xs font-bold text-white bg-[#FF6B00] hover:bg-[#E65100] rounded-md cursor-pointer"
                    >
                      Xác nhận đặt về Ngày 0
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* If already logged in: Profile Card */}
          {!account.isAnonymous && (
            <div className="bg-[#F4F7FA] p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-[#1E3A5F] text-white flex items-center justify-center font-bold text-sm">
                    {account.email?.[0].toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{account.email}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#81C995]" />
                      <span>
                        {account.provider === 'supabase' ? 'Supabase Realtime' : 'Hồ sơ Đồng bộ Cục bộ'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onTriggerSyncNow}
                  disabled={isSyncing}
                  className="flex items-center gap-1 bg-[#1E3A5F] hover:bg-[#152a45] text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ'}</span>
                </button>
              </div>

              <div className="text-xs text-slate-600 border-t border-slate-200 pt-2 flex items-center justify-between">
                <span>Lần đồng bộ gần nhất:</span>
                <strong className="font-mono text-slate-800">
                  {account.lastSyncedAtMs ? formatClockTime(account.lastSyncedAtMs) : 'Chưa có'}
                </strong>
              </div>

              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất (Trở về chế độ Ẩn danh)</span>
              </button>
            </div>
          )}

          {/* If Anonymous: Login Form */}
          {account.isAnonymous && (
            <>
              <div className="bg-[#FFF3E0] p-3 rounded-xl border border-[#FF6B00]/30 text-xs text-amber-900 flex items-start gap-2">
                <Shield className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                <p>
                  <strong>Hợp nhất tự động (Auto-Merge):</strong> Toàn bộ chuỗi streak, lịch sử bấm giờ và các tác vụ bạn vừa tạo sẽ tự động được gộp vào hồ sơ Email mà không bị mất!
                </p>
              </div>

              <div className="flex rounded-lg p-1 bg-slate-100 border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('mock_otp');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                    authMode === 'mock_otp'
                      ? 'bg-white text-[#1E3A5F] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Định danh Email (Nhanh)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('supabase');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer ${
                    authMode === 'supabase'
                      ? 'bg-white text-[#1E3A5F] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kết nối Supabase Cloud
                </button>
              </div>

              {error && (
                <div className="bg-rose-50 text-rose-700 text-xs p-2.5 rounded-lg border border-rose-200">
                  {error}
                </div>
              )}
              {info && (
                <div className="bg-emerald-50 text-emerald-800 text-xs p-2.5 rounded-lg border border-emerald-200">
                  {info}
                </div>
              )}

              {authMode === 'mock_otp' && (
                <div>
                  {step === 'enter_email' ? (
                    <form onSubmit={handleSendOtp} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Địa chỉ Email của bạn
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tenban@gmail.com"
                            className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-[#FF6B00] hover:bg-[#E65100] active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Gửi mã xác nhận OTP</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nhập mã xác thực 6 số (Mã mặc định: 123456)
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          required
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="123456"
                          className="w-full text-center tracking-widest text-lg font-mono font-bold py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#FF6B00]"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setStep('enter_email')}
                          className="w-1/3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                        >
                          Quay lại
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                          Xác thực & Hợp nhất
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {authMode === 'supabase' && (
                <form onSubmit={handleConnectSupabase} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email người dùng
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Database className="w-3.5 h-3.5 text-[#1E3A5F]" />
                      <span>SUPABASE_URL</span>
                    </label>
                    <input
                      type="url"
                      required
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://xyzcompany.supabase.co"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-[#FCC934]" />
                      <span>SUPABASE_ANON_KEY</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={supabaseAnonKey}
                      onChange={(e) => setSupabaseAnonKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                      className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Kết nối Supabase & Đồng bộ
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#F4F7FA] px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
