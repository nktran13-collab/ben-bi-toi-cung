import React from 'react';

interface AccountLoadingOverlayProps {
  isLoadingAccount: boolean;
  syncError: string | null;
  accountActionError: string | null;
  isSyncing: boolean;
  isLoggingOut: boolean;
  onRetrySync: () => void;
  onLogout: () => void;
}

export const AccountLoadingOverlay: React.FC<AccountLoadingOverlayProps> = ({
  isLoadingAccount,
  syncError,
  accountActionError,
  isSyncing,
  isLoggingOut,
  onRetrySync,
  onLogout,
}) => {
  if (!isLoadingAccount) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-loading-title"
      aria-describedby="account-loading-description"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/95 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <h2 id="account-loading-title" className="text-lg font-bold">
          {syncError ? 'Chưa tải được dữ liệu tài khoản' : 'Đang tải dữ liệu tài khoản'}
        </h2>
        <p
          id="account-loading-description"
          className="mt-3 text-sm text-slate-300"
          role={syncError ? 'alert' : 'status'}
        >
          {syncError || 'Vui lòng chờ xác thực và tải dữ liệu trước khi tiếp tục.'}
        </p>
        {accountActionError && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {accountActionError}
          </p>
        )}
        {(syncError || accountActionError) && (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isSyncing || isLoggingOut}
              onClick={onRetrySync}
              className="rounded-lg bg-[#FF6B00] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {isSyncing ? 'Đang thử lại...' : 'Thử lại đồng bộ'}
            </button>
            <button
              type="button"
              disabled={isSyncing || isLoggingOut}
              onClick={onLogout}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
