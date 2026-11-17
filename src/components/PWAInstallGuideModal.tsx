import React from 'react';
import { X, Smartphone, Share, PlusSquare, CheckCircle, Download, Apple } from 'lucide-react';
import { useI18n } from '../utils/useI18n';

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
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between bg-[#1E3A5F] p-5 text-white [@media(max-height:520px)]:p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#3B6998] text-[#FCC934]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">{t('pwa.title')}</h2>
              <p className="text-xs text-[#E8F0FE]/80">{t('pwa.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-1 rounded-lg text-[#E8F0FE]/70 hover:text-white hover:bg-[#3B6998] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6 [@media(max-height:520px)]:space-y-3 [@media(max-height:520px)]:p-3">
          {/* Quick Install Button for Desktop / Android if event available */}
          {isInstallable && (
            <div className="bg-[#E8F0FE] p-4 rounded-xl border border-[#3B6998]/30 text-center space-y-2">
              <div className="text-xs font-bold text-[#1E3A5F]">{t('pwa.autoTitle')}</div>
              <button
                type="button"
                onClick={() => {
                  onTriggerNativeInstall();
                  onClose();
                }}
                className="w-full py-2.5 bg-[#FF6B00] hover:bg-[#E65100] active:scale-98 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>{t('pwa.installNow')}</span>
              </button>
            </div>
          )}

          {/* iOS Safari Guided Steps */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Apple className="w-4 h-4 text-slate-700" />
              <span>{t('pwa.iosTitle')}</span>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              {/* Step 1 */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F4F7FA] border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-[#1E3A5F] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  1
                </div>
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span>{t('pwa.step1')}</span>
                    <Share className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{t('pwa.step1Desc')}</div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#F4F7FA] border border-slate-200">
                <div className="w-6 h-6 rounded-full bg-[#1E3A5F] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  2
                </div>
                <div>
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <span>{t('pwa.step2')}</span>
                    <PlusSquare className="w-4 h-4 text-slate-700" />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {t('pwa.step2DescPrefix')} <strong>Add to Home Screen</strong>.
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
                    <span>{t('pwa.step3')}</span>
                    <CheckCircle className="w-4 h-4 text-[#81C995]" />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{t('pwa.step3Desc')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Android / Chrome guidance */}
          <div className="border-t border-slate-200 pt-3">
            <div className="text-xs text-slate-500">
              <strong>{t('pwa.androidPrefix')}</strong> {t('pwa.androidBody')}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-[#F4F7FA] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {t('pwa.done')}
          </button>
        </div>
      </div>
    </div>
  );
};
