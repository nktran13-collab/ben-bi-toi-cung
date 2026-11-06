import React, { useState } from 'react';
import { X, Cloud, Mail, CheckCircle2, Shield, LogOut, Database, Key, Send, RefreshCw } from 'lucide-react';
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
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  account,
  onLoginSuccess,
  onLogout,
  onTriggerSyncNow,
  isSyncing,
}) => {
  const [authMode, setAuthMode] = useState<'mock_otp' | 'supabase'>('mock_otp');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'enter_email' | 'enter_otp'>('enter_email');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ Email hợp lệ.');
      return;
    }
    setError(null);
    setStep('enter_otp');
    setInfo(`Đã gửi mã xác nhận 6 số đến ${email}. (Mã test mặc định là 123456)`);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim() !== '123456') {
      setError('Mã xác thực không chính xác. Hãy nhập mã test: 123456');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#1E3A5F] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#3B6998] text-[#FCC934]">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {account.isAnonymous ? 'Lưu Tiến Trình / Đám Mây' : 'Tài Khoản Đồng Bộ'}
              </h2>
              <p className="text-xs text-[#E8F0FE]/80">
                {account.isAnonymous
                  ? 'Bảo vệ chuỗi và đồng bộ đa thiết bị tự động'
                  : `Đang liên kết: ${account.email}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#E8F0FE]/70 hover:text-white hover:bg-[#3B6998] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4">
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
                      <span>{account.provider === 'supabase' ? 'Supabase Realtime' : 'Mock Cloud OTP'}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onTriggerSyncNow}
                  disabled={isSyncing}
                  className="flex items-center gap-1 bg-[#1E3A5F] hover:bg-[#152a45] text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                  title="Đẩy các thay đổi cục bộ lên đám mây ngay lập tức"
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
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất (Trở về chế độ Ẩn danh)</span>
              </button>
            </div>
          )}

          {/* If Anonymous: Login Form */}
          {account.isAnonymous && (
            <>
              {/* Auto-Merge Notice */}
              <div className="bg-[#FFF3E0] p-3 rounded-xl border border-[#FF6B00]/30 text-xs text-amber-900 flex items-start gap-2">
                <Shield className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                <p>
                  <strong>Hợp nhất tự động (Auto-Merge):</strong> Toàn bộ chuỗi streak, lịch sử bấm giờ và các tác vụ bạn vừa tạo sẽ tự động được gộp vào tài khoản Email mà không bị mất!
                </p>
              </div>

              {/* Mode Switcher */}
              <div className="flex rounded-lg p-1 bg-slate-100 border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('mock_otp');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 rounded-md transition-all ${
                    authMode === 'mock_otp'
                      ? 'bg-white text-[#1E3A5F] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Giả lập Cloud OTP (Nhanh)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('supabase');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 rounded-md transition-all ${
                    authMode === 'supabase'
                      ? 'bg-white text-[#1E3A5F] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Kết nối Supabase Thật
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

              {/* Mode A: Mock OTP Form */}
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
                        className="w-full py-2.5 bg-[#FF6B00] hover:bg-[#E65100] active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Gửi mã xác nhận OTP</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nhập mã xác thực 6 số (Mã test: 123456)
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
                          className="w-1/3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                        >
                          Quay lại
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                        >
                          Xác thực & Hợp nhất
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Mode B: Real Supabase Configuration */}
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
                    className="w-full py-2.5 bg-[#1E3A5F] hover:bg-[#152a45] active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
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
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
