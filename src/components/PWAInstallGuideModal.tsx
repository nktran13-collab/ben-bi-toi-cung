import React from 'react';
import { X, Smartphone, Share, PlusSquare, CheckCircle, Download, Apple } from 'lucide-react';

interface PWAInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  onTriggerNativeInstall: () => void;
}

export const PWAInstallGuideModal: React.FC<PWAInstallGuideModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  onTriggerNativeInstall,
}) => {
  if (!isOpen) return null;

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#1E3A5F] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#3B6998] text-[#FCC934]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Cài Đặt App Ra Màn Hình Chính</h2>
              <p className="text-xs text-[#E8F0FE]/80">Chạy độc lập (Standalone) như Native App, không giật lag</p>
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
          {/* Quick Install Button for Desktop / Android if event available */}
          {isInstallable && (
            <div className="bg-[#E8F0FE] p-4 rounded-xl border border-[#3B6998]/30 text-center space-y-2">
              <div className="text-xs font-bold text-[#1E3A5F]">Trình duyệt hỗ trợ cài đặt tự động 1-chạm</div>
              <button
                type="button"
                onClick={() => {
                  onTriggerNativeInstall();
                  onClose();
                }}
                className="w-full py-2.5 bg-[#FF6B00] hover:bg-[#E65100] active:scale-98 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Cài đặt ứng dụng ngay</span>
              </button>
            </div>
          )}

          {/* iOS Safari Guided Steps */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Apple className="w-4 h-4 text-slate-700" />
              <span>Hướng dẫn cài đặt trên iPhone / iPad (Safari):</span>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              {/* Step 1 */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F4F7FA] border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-[#1E3A5F] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  1
                </div>
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span>Nhấn biểu tượng Chia sẻ</span>
                    <Share className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Nằm ở thanh công cụ dưới đáy màn hình Safari của iPhone.
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F4F7FA] border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-[#1E3A5F] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  2
                </div>
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span>Chọn "Thêm vào MH chính"</span>
                    <PlusSquare className="w-4 h-4 text-slate-700" />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Cuộn xuống danh sách hành động và chọn <strong>Add to Home Screen</strong>.
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F4F7FA] border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-[#1E3A5F] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  3
                </div>
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span>Bấm "Thêm" (Add)</span>
                    <CheckCircle className="w-4 h-4 text-[#81C995]" />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Biểu tượng Bền Bỉ sẽ xuất hiện ngay trên màn hình chính của bạn.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Android / Chrome guidance */}
          <div className="border-t border-slate-200 pt-3">
            <div className="text-xs text-slate-500">
              <strong>Đối với Android / Chrome:</strong> Nếu không thấy nút tự động, hãy nhấn vào dấu ba chấm (⋮) ở góc
              trên bên phải trình duyệt và chọn <em>"Cài đặt ứng dụng"</em> hoặc <em>"Thêm vào màn hình chính"</em>.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#F4F7FA] px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
