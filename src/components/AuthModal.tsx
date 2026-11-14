import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Cloud,
  Mail,
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
  ShieldCheck,
} from 'lucide-react';
import { UserAccount, formatClockTime } from '../utils/engine';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: UserAccount;
  onSendOtp: (email: string) => Promise<void>;
  onVerifyOtp: (email: string, code: string) => Promise<void>;
  onLogout: () => Promise<void>;
  syncError?: string | null;
  cloudEnabled: boolean;
  onTriggerSyncNow: () => void;
  isSyncing: boolean;
  onExportBackupJSON?: () => void;
  onImportBackupJSON?: (jsonStr: string) => boolean;
  onResetToCleanStarter?: () => void;
  onLoadDemoSeed?: () => void;
  needsReauth?: boolean;
  recoveryAvailable?: boolean;
  onExportRecovery?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  account,
  onSendOtp,
  onVerifyOtp,
  onLogout,
  syncError,
  cloudEnabled,
  onTriggerSyncNow,
  isSyncing,
  onExportBackupJSON,
  onImportBackupJSON,
  onResetToCleanStarter,
  onLoadDemoSeed,
  needsReauth = false,
  recoveryAvailable = false,
  onExportRecovery,
}) => {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [code, setCode] = useState('');
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmCleanReset, setConfirmCleanReset] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!cooldownUntil) return;

    const updateCooldown = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldown(remaining);
      if (remaining === 0) setCooldownUntil(0);
    };
    updateCooldown();
    const timer = window.setInterval(updateCooldown, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => {
    if (isOpen && needsReauth && account.email) setEmail(prev => prev || account.email!);
  }, [isOpen, needsReauth, account.email]);

  if (!isOpen) return null;
  const showOtpForm = account.isAnonymous || needsReauth;

  const handleClose = () => {
    if (submittingRef.current) return;
    onClose();
  };

  const handleSendOtp = async () => {
    if (submittingRef.current || !cloudEnabled || Date.now() < cooldownUntil) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Vui lòng nhập email hợp lệ (ví dụ: tenban@gmail.com).');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      await onSendOtp(cleanEmail);
      setEmail(cleanEmail);
      setCode('');
      setStep('otp');
      setCooldownUntil(Date.now() + 60_000);
      setCooldown(60);
      setInfo('Đã gửi mã xác thực. Kiểm tra hộp thư và thư rác.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được mã. Vui lòng thử lại.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (submittingRef.current || !cloudEnabled) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Vui lòng nhập đủ 6 chữ số trong email.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      await onVerifyOtp(email, code);
      setStep('email');
      setCode('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xác thực được mã. Vui lòng thử lại.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      await onLogout();
      setStep('email');
      setCode('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đăng xuất được. Vui lòng thử lại.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleEditEmail = () => {
    if (submittingRef.current) return;
    setStep('email');
    setCode('');
    setError(null);
    setInfo(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 'email') await handleSendOtp();
    else await handleVerifyOtp();
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
    <div role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#1E3A5F] text-white p-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#3B6998] text-[#FCC934] shadow-inner">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                {account.isAnonymous ? 'Đăng Nhập & Đồng Bộ Đám Mây' : 'Hồ Sơ Đám Mây Của Bạn'}
              </h2>
              <p className="text-xs text-[#E8F0FE]/80">
                {account.isAnonymous
                  ? 'Xác thực email bằng mã OTP qua Supabase để đồng bộ'
                  : needsReauth
                  ? `Phiên đã hết hạn: ${account.email}`
                  : `Email đã xác thực qua Supabase: ${account.email}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-[#E8F0FE]/70 hover:text-white hover:bg-[#3B6998] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                Đồng bộ bằng email đã xác thực
              </strong>
              Khi đổi thiết bị, bạn cần xác thực mã OTP gửi đến email qua Supabase để truy cập dữ liệu đám mây. Chỉ nhập email chưa đủ để đăng nhập.
            </div>
          </div>

          {!cloudEnabled && (
            <p role="status" className="bg-amber-50 text-amber-800 text-xs p-3 rounded-xl border border-amber-200">
              Chưa cấu hình Supabase nên chưa thể gửi mã OTP hoặc đồng bộ. Bạn vẫn có thể dùng dữ liệu trên máy và sao lưu JSON.
            </p>
          )}
          {error && (
            <div role="alert" className="bg-rose-50 text-rose-700 text-xs p-3 rounded-xl border border-rose-200 flex items-start gap-2">
              <X className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div role="status" className="bg-emerald-50 text-emerald-800 text-xs p-3 rounded-xl border border-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

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
                      {needsReauth ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-amber-700 font-medium">Phiên đăng nhập đã hết hạn</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-emerald-700 font-medium">Email đã xác thực qua Supabase</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!submittingRef.current && cloudEnabled) onTriggerSyncNow();
                  }}
                  disabled={isSyncing || isSubmitting || !cloudEnabled || needsReauth}
                  className="flex items-center gap-1.5 bg-[#1E3A5F] hover:bg-[#152a45] active:scale-95 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Đang lưu...' : 'Lưu lên Đám mây'}</span>
                </button>
              </div>

              {syncError && (
                <p role="alert" className="bg-rose-50 text-rose-700 text-xs p-3 rounded-xl border border-rose-200">
                  {syncError}
                </p>
              )}

              <div className="text-xs text-slate-600 border-t border-slate-200 pt-3 flex items-center justify-between">
                <span>Lần đồng bộ gần nhất:</span>
                <strong className="font-mono text-slate-800">
                  {account.lastSyncedAtMs ? formatClockTime(account.lastSyncedAtMs) : 'Chưa đồng bộ'}
                </strong>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất tài khoản này</span>
                </button>
              </div>
            </div>
          )}

          {needsReauth && !account.isAnonymous && (
            <p role="status" className="bg-amber-50 text-amber-800 text-xs p-3 rounded-xl border border-amber-200">
              Dữ liệu trên máy vẫn được giữ. Xác thực lại email {account.email} để tiếp tục đồng bộ.
            </p>
          )}

          {/* If Anonymous: Supabase Email OTP Form */}
          {showOtpForm && (
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#FF6B00]/10 flex items-center justify-center text-[#FF6B00]">
                  <Mail className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {step === 'email' ? (needsReauth ? 'Xác thực lại bằng OTP' : 'Đăng nhập bằng OTP qua Supabase') : 'Xác thực email qua Supabase'}
                </span>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                {step === 'email' ? (
                  <div>
                    <label htmlFor="auth-email" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Địa chỉ email của bạn
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        id="auth-email"
                        type="email"
                        autoComplete="email"
                        required
                        autoFocus
                        disabled={isSubmitting}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nhap-email-cua-ban@gmail.com"
                        className="w-full text-xs sm:text-sm pl-9 pr-3 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent transition-all disabled:opacity-60"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Supabase sẽ gửi mã OTP đến email này. Chỉ sau khi xác thực thành công, bạn mới đăng nhập để đồng bộ dữ liệu.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-600 break-all">Mã đã gửi đến <strong>{email}</strong></span>
                      <button
                        type="button"
                        onClick={handleEditEmail}
                        disabled={isSubmitting}
                        className="shrink-0 px-2 py-1.5 text-[#1E3A5F] font-semibold rounded-lg hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                      >
                        Sửa email
                      </button>
                    </div>
                    <div>
                      <label htmlFor="auth-otp" className="block text-xs font-bold text-slate-700 mb-1.5">
                        Mã OTP gồm 6 chữ số
                      </label>
                      <input
                        id="auth-otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        minLength={6}
                        maxLength={6}
                        required
                        autoFocus
                        disabled={isSubmitting}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-full text-lg font-mono text-center tracking-[0.4em] px-3 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent transition-all disabled:opacity-60"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSubmitting || !cloudEnabled || cooldown > 0}
                      className="text-xs font-semibold text-[#1E3A5F] hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cooldown > 0 ? `Gửi lại mã sau ${cooldown}s` : 'Gửi lại mã'}
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !cloudEnabled || (step === 'email' ? cooldown > 0 : code.length !== 6)}
                  className="w-full py-3 bg-[#FF6B00] hover:bg-[#E65100] active:scale-98 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        {step === 'otp'
                          ? 'Xác thực & Đăng nhập'
                          : cooldown > 0 ? `Gửi mã sau ${cooldown}s` : 'Gửi mã OTP'}
                      </span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {recoveryAvailable && onExportRecovery && (
            <div role="status" className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 space-y-2.5">
              <p className="text-xs text-amber-900 leading-relaxed">
                Phát hiện dữ liệu cũ trên máy không đọc được và đã được giữ lại nguyên trạng. Hãy tải về để không bị mất.
              </p>
              <button
                type="button"
                onClick={onExportRecovery}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải dữ liệu khôi phục</span>
              </button>
            </div>
          )}

          {/* Backup & Restore JSON Section */}
          <div className="bg-[#F4F7FA] p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider">
                Sao lưu & Khôi phục Tệp (.JSON)
              </span>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Sao lưu trên máy</span>
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
                        if (submittingRef.current) return;
                        onLoadDemoSeed();
                        handleClose();
                      }}
                      disabled={isSubmitting}
                      className="py-2 px-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
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
                        if (submittingRef.current) return;
                        if (onResetToCleanStarter) onResetToCleanStarter();
                        setConfirmCleanReset(false);
                        handleClose();
                      }}
                      disabled={isSubmitting}
                      className="px-3 py-1 text-xs font-bold text-white bg-[#FF6B00] hover:bg-[#E65100] rounded-md cursor-pointer disabled:opacity-50"
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
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
