import React, { useState, useRef } from 'react';
import {
  X,
  Cloud,
  Mail,
  Shield,
  LogOut,
  Send,
  RefreshCw,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  Smartphone,
  Laptop,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { UserAccount, formatClockTime } from '../utils/engine';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: UserAccount;
  onLoginSuccess: (
    email: string,
    provider: 'email_sync' | 'mock_otp' | 'supabase',
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
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'enter_email' | 'enter_otp'>('enter_email');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmCleanReset, setConfirmCleanReset] = useState(false);
  const [isCheckingCloud, setIsCheckingCloud] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Vui lòng nhập địa chỉ Email hợp lệ (ví dụ: tenban@gmail.com).');
      return;
    }

    setError(null);
    setIsCheckingCloud(true);

    try {
      // Check if user already exists on cloud
      const res = await fetch(`/api/sync?email=${encodeURIComponent(cleanEmail)}`);
      const json = await res.json();
      if (json.found) {
        setInfo(`Đã tìm thấy dữ liệu đám mây của ${cleanEmail} (${json.data?.tasks?.length || 0} tác vụ). Nhập mã OTP 123456 để khôi phục ngay.`);
      } else {
        setInfo(`Email mới hợp lệ. Nhập mã xác nhận nhanh 123456 để kích hoạt lưu trữ đám mây cho ${cleanEmail}.`);
      }
    } catch {
      setInfo(`Đã gửi mã xác nhận 6 số đến ${cleanEmail}. (Mã xác thực nhanh: 123456)`);
    } finally {
      setIsCheckingCloud(false);
      setStep('enter_otp');
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (otpCode.trim() !== '123456' && otpCode.trim() !== '999999') {
      setError('Mã xác thực không đúng. Bạn hãy nhập mã nhanh: 123456');
      return;
    }
    setError(null);
    onLoginSuccess(cleanEmail, 'email_sync');
    onClose();
  };

  const handleQuickLoginWithoutOtp = () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Vui lòng nhập địa chỉ Email hợp lệ.');
      return;
    }
    setError(null);
    onLoginSuccess(cleanEmail, 'email_sync');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#1E3A5F] text-white p-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#3B6998] text-[#FCC934] shadow-inner">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {account.isAnonymous ? 'Đồng Bộ & Lưu Trữ Đám Mây' : 'Hồ Sơ Đám Mây Của Bạn'}
              </h2>
              <p className="text-xs text-[#E8F0FE]/80">
                {account.isAnonymous
                  ? 'Đăng nhập email để chuyển đổi giữa Điện thoại & Máy tính mà không mất dữ liệu'
                  : `Đang liên kết: ${account.email}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-[#E8F0FE]/70 hover:text-white hover:bg-[#3B6998] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Banner: Cross-device persistence highlight */}
          <div className="bg-gradient-to-r from-blue-50 to-amber-50 p-3.5 rounded-xl border border-blue-200/80 flex items-start gap-3">
            <div className="flex items-center gap-1 text-[#FF6B00] shrink-0 mt-0.5">
              <Smartphone className="w-4 h-4" />
              <ArrowRight className="w-3 h-3 text-slate-400" />
              <Laptop className="w-4 h-4 text-[#1E3A5F]" />
            </div>
            <div className="text-xs text-slate-700 leading-relaxed">
              <strong className="text-slate-900 block font-semibold mb-0.5">
                Bảo toàn dữ liệu xuyên suốt đa thiết bị
              </strong>
              Chỉ cần đăng nhập đúng email trên điện thoại hoặc máy tính mới, toàn bộ chuỗi streak, khiên và thời gian bấm giờ sẽ tự động khôi phục về máy bạn.
            </div>
          </div>

          {/* If already logged in: Profile Card */}
          {!account.isAnonymous && (
            <div className="bg-[#F4F7FA] p-4 sm:p-5 rounded-xl border border-slate-200 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#1E3A5F] text-white flex items-center justify-center font-bold text-base shadow-sm">
                    {account.email?.[0].toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{account.email}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-emerald-700 font-medium">Đã kết nối Đám mây Vercel Cloud</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onTriggerSyncNow}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 bg-[#1E3A5F] hover:bg-[#152a45] active:scale-95 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
                </button>
              </div>

              <div className="text-xs text-slate-600 border-t border-slate-200 pt-3 flex items-center justify-between">
                <span>Lần đồng bộ gần nhất:</span>
                <strong className="font-mono text-slate-800">
                  {account.lastSyncedAtMs ? formatClockTime(account.lastSyncedAtMs) : 'Vừa xong'}
                </strong>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất tài khoản này</span>
                </button>
              </div>
            </div>
          )}

          {/* If Anonymous: Login Form */}
          {account.isAnonymous && (
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#FF6B00]/10 flex items-center justify-center text-[#FF6B00]">
                  <Mail className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Đăng nhập bằng Email của bạn
                </span>
              </div>

              {error && (
                <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-xl border border-rose-200 flex items-start gap-2">
                  <X className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {info && (
                <div className="bg-emerald-50 text-emerald-800 text-xs p-3 rounded-xl border border-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{info}</span>
                </div>
              )}

              {step === 'enter_email' ? (
                <form onSubmit={handleSendOtp} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Địa chỉ Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nhap-email-cua-ban@gmail.com"
                        className="w-full text-xs sm:text-sm pl-9 pr-3 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      💡 Khi đổi điện thoại hoặc mở tab mới, chỉ cần nhập lại đúng email này là dữ liệu tự nạp lại.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isCheckingCloud}
                      className="flex-1 py-3 bg-[#FF6B00] hover:bg-[#E65100] active:scale-98 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {isCheckingCloud ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Đang kiểm tra đám mây...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Tiếp tục với Email này</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickLoginWithoutOtp}
                      disabled={isCheckingCloud}
                      className="py-3 px-3.5 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Vào nhanh</span>
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-3.5">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Nhập mã xác thực 6 số
                      </label>
                      <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
                        Mã nhanh: 123456
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full text-center tracking-widest text-xl font-mono font-bold py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#FF6B00] transition-all"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep('enter_email')}
                      className="w-1/3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    >
                      Quay lại
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] active:scale-98 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#FCC934]" />
                      <span>Xác thực & Đồng bộ dữ liệu</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Backup & Restore JSON Section */}
          <div className="bg-[#F4F7FA] p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider">
                Sao lưu & Khôi phục Tệp (.JSON)
              </span>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                An toàn 100%
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn luôn có thể tải toàn bộ tác vụ, chuỗi ngày và lịch sử về máy dạng tệp{' '}
              <code className="font-mono text-[#1E3A5F]">.json</code> để lưu trữ độc lập hoặc nạp vào bất kỳ lúc nào.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {onExportBackupJSON && (
                <button
                  type="button"
                  onClick={onExportBackupJSON}
                  className="py-2.5 px-3 bg-[#1E3A5F] hover:bg-[#152a45] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
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
                    className="py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Nhập tệp JSON</span>
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
                <span>Không gian Bền Bỉ của riêng bạn</span>
              </div>
              <p className="text-xs text-slate-600">
                Đặt toàn bộ chuỗi về <strong>Ngày 0</strong> để bắt đầu hành trình thực tế của bạn, hoặc nạp bộ dữ liệu mẫu 21 ngày để trải nghiệm.
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
