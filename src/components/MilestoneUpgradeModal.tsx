import React, { useEffect, useRef } from 'react';
import { Award, Zap, Shield, Sparkles, CheckCircle2 } from 'lucide-react';
import { TaskItem } from '../utils/engine';
import { soundEngine } from '../utils/audio';

interface MilestoneUpgradeModalProps {
  task: TaskItem;
  isOpen: boolean;
  onUpgrade: (taskId: string) => void;
  onKeep: (taskId: string) => void;
}

export const MilestoneUpgradeModal: React.FC<MilestoneUpgradeModalProps> = ({ task, isOpen, onUpgrade, onKeep }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    soundEngine.playSuccessChime();

    // Confetti canvas animation
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const colors = ['#FF6B00', '#1E3A5F', '#FCC934', '#81C995', '#3B6998', '#FF9E40'];
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      rotation: number;
      vRot: number;
    }> = [];

    const width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    const height = (canvas.height = canvas.parentElement?.clientHeight || 450);

    for (let i = 0; i < 75; i++) {
      particles.push({
        x: width / 2,
        y: height / 2 - 40,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.7) * 14,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravity
        p.rotation += p.vRot;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Canvas Confetti */}
        <div className="absolute inset-0 pointer-events-none z-10">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>

        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-[#1E3A5F] via-[#3B6998] to-[#1E3A5F] p-6 text-white text-center relative z-20">
          <div className="w-16 h-16 mx-auto mb-3 bg-white/10 rounded-full flex items-center justify-center border-2 border-[#FCC934] shadow-lg">
            <Award className="w-9 h-9 text-[#FCC934] animate-bounce" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FF6B00] text-white text-xs font-bold rounded-full uppercase tracking-wider mb-2 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" /> Chinh phục Mốc 30 Ngày
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Chúc mừng bạn!</h2>
          <p className="text-xs text-blue-100 mt-1">
            Tác vụ: <span className="font-semibold text-white">"{task.name}"</span>
          </p>
        </div>

        {/* Body */}
        <div className="p-6 relative z-20 space-y-4">
          <div className="p-4 bg-[#FFF3E0] border border-[#FF9E40]/30 rounded-xl text-left">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-[#FF6B00] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-[#1E3A5F]">Tâm lý học thói quen UCL (London)</h4>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                  Bạn đã hình thành nền móng 30 ngày vững chắc. Nghiên cứu của TS. Phillippa Lally tại UCL chứng minh
                  rằng cần trung bình <strong>66 ngày</strong> để một hành vi trở thành phản xạ tự động hóa thần kinh
                  (Automaticity).
                </p>
              </div>
            </div>
          </div>

          {/* Perks of upgrading */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-[#81C995] shrink-0" />
              <span>
                Giữ nguyên chuỗi <strong>🔥 {task.currentStreak} ngày</strong> hiện tại.
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <Shield className="w-4 h-4 text-[#FCC934] shrink-0" />
              <span>
                Mở rộng dung lượng tích trữ Khiên Bền Bỉ từ <strong>2 lên 3 Khiên</strong>.
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-700">
              <Award className="w-4 h-4 text-[#FF6B00] shrink-0" />
              <span>
                Kích hoạt các Cột mốc Bảo lưu mới tại <strong>Ngày 45 & Ngày 60</strong>.
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              onClick={() => onUpgrade(task.id)}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FF6B00] to-[#E05E00] text-white font-bold rounded-xl shadow-lg hover:shadow-orange-500/25 transition-all flex items-center justify-center gap-2 text-sm active:scale-[0.98]"
            >
              <span>🚀 Nâng cấp lên Cột mốc 66 ngày</span>
            </button>
            <button
              onClick={() => onKeep(task.id)}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl transition-colors text-xs"
            >
              Giữ nguyên cột mốc 30 ngày
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
