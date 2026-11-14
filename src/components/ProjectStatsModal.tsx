import React, { useState, useRef } from 'react';
import {
  X,
  Clock,
  Calendar,
  TrendingUp,
  Scissors,
  Check,
  BarChart3,
  Download,
  Share2,
  FileSpreadsheet,
  FileText,
  Shield,
  Flame,
  Award,
  Trash2,
  Pencil,
  CheckCircle2,
} from 'lucide-react';
import {
  TaskItem,
  TimeSession,
  HabitDailyLog,
  calculatePersistenceDensity,
  formatDuration,
  trimSessionDuration,
  generateStreakMatrix,
  generateCSVExport,
  generateMarkdownExport,
  MatrixDayStatus,
  getLogicalDate,
} from '../utils/engine';

interface ProjectStatsModalProps {
  task: TaskItem;
  sessions: TimeSession[];
  logs?: HabitDailyLog[];
  userEmail?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTrimLatestSession?: (taskId: string, trimMinutes: number) => void;
  onCompleteSprintSession?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onEditTask?: (task: TaskItem) => void;
}

export const ProjectStatsModal: React.FC<ProjectStatsModalProps> = ({
  task,
  sessions,
  logs = [],
  userEmail,
  isOpen,
  onClose,
  onTrimLatestSession,
  onCompleteSprintSession,
  onDeleteTask,
  onEditTask,
}) => {
  const [trimMinutes, setTrimMinutes] = useState(15);
  const [trimSuccessMessage, setTrimSuccessMessage] = useState<string | null>(null);
  const [shareCardGenerating, setShareCardGenerating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!isOpen) return null;

  // Filter sessions and logs for this task
  const taskSessions = sessions.filter((s) => s.taskId === task.id);
  const taskLogs = logs.filter((l) => l.taskId === task.id);

  const totalSessionMs = taskSessions.reduce((acc, s) => acc + s.durationMs, 0);
  const totalLogMs = taskLogs.reduce((acc, l) => acc + (l.actualDurationMs || 0), 0);
  const totalDurationMs = task.mode === 'project'
    ? totalSessionMs + task.accumulatedMs
    : totalLogMs + task.accumulatedMs;

  // Calculate distinct active days
  const activeDaysSet = new Set(
    task.mode === 'project'
      ? taskSessions.map((s) => s.logicalDate)
      : taskLogs.filter((l) => l.completed).map((l) => l.logicalDate)
  );
  const activeDaysCount = activeDaysSet.size;

  // Calculate history days since task creation
  const now = Date.now();
  const DAY_MS = 24 * 3600 * 1000;
  const historyDays = Math.max(1, Math.ceil((now - task.historyStartTimestamp) / DAY_MS));
  const persistenceDensity = calculatePersistenceDensity(activeDaysCount, historyDays);

  const avgMinutesPerActiveDay = activeDaysCount > 0
    ? Math.round(totalDurationMs / activeDaysCount / 60000)
    : 0;

  // Group durations by last 30 logical days (04:00 AM rollover) for Project bar chart
  const last30Days: { dateStr: string; label: string; dayNum: string; durationMinutes: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const targetTime = now - i * DAY_MS;
    const dateStr = getLogicalDate(targetTime, 4);
    const parts = dateStr.split('-');
    const dayNum = parseInt(parts[2], 10);
    const minutes = Math.round(
      taskSessions
        .filter((s) => s.logicalDate === dateStr)
        .reduce((sum, s) => sum + s.durationMs, 0) / 60000
    );
    last30Days.push({
      dateStr,
      label: `${dayNum}/${parseInt(parts[1], 10)}`,
      dayNum: `${dayNum}`,
      durationMinutes: minutes,
    });
  }

  const maxMinutesIn30Days = Math.max(...last30Days.map((d) => d.durationMinutes));
  const activeDaysIn30 = last30Days.filter((d) => d.durationMinutes > 0).length;
  const totalMinutesIn30 = last30Days.reduce((sum, d) => sum + d.durationMinutes, 0);

  const getHeatColor = (minutes: number): string => {
    if (minutes <= 0) return 'bg-slate-100 text-slate-400 border-slate-200';
    if (minutes === maxMinutesIn30Days) return 'bg-[#FF6B00] text-white border-[#FF6B00]';
    const ratio = minutes / maxMinutesIn30Days;
    if (ratio < 1 / 3) return 'bg-[#D0E1FD] text-[#1E3A5F] border-[#B9CFF0]';
    if (ratio < 2 / 3) return 'bg-[#7FA8D4] text-white border-[#7FA8D4]';
    return 'bg-[#1E3A5F] text-white border-[#1E3A5F]';
  };

  // Habit Streak Matrix
  const targetMilestone = task.targetMilestoneDays || 30;
  const streakMatrix = generateStreakMatrix(targetMilestone, task.currentStreak, logs, task.id);

  // Trim Session calculation for project
  const latestSession = taskSessions.length > 0 ? taskSessions[taskSessions.length - 1] : null;
  const targetToTrimMs = task.accumulatedMs > 0 ? task.accumulatedMs : latestSession ? latestSession.durationMs : 0;
  const trimmedMs = trimSessionDuration(targetToTrimMs, trimMinutes);

  const handleApplyTrim = () => {
    if (onTrimLatestSession) {
      onTrimLatestSession(task.id, trimMinutes);
      setTrimSuccessMessage(`Đã cắt gọt ${trimMinutes} phút thành công!`);
      setTimeout(() => setTrimSuccessMessage(null), 3000);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const csvContent = generateCSVExport(task, sessions, logs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ben-bi-${task.id}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Markdown
  const handleExportMarkdown = () => {
    const mdContent = generateMarkdownExport(task, sessions, logs);
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ben-bi-${task.id}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Generate 1200x630 HTML5 Canvas Share Card
  const handleGenerateShareCard = () => {
    setShareCardGenerating(true);
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setShareCardGenerating(false);
      return;
    }

    // 1. Background (White / Pale Slate 65%)
    ctx.fillStyle = '#F4F7FA';
    ctx.fillRect(0, 0, 1200, 630);

    // Decorative Deep Jean Blue Banner (25%)
    ctx.fillStyle = '#1E3A5F';
    ctx.fillRect(0, 0, 1200, 140);

    // Orange Accent Line (10%)
    ctx.fillStyle = '#FF6B00';
    ctx.fillRect(0, 134, 1200, 6);

    // Header Branding
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('BỀN BỈ TỚI CÙNG', 60, 65);

    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#E8F0FE';
    ctx.fillText('Hành trình kỷ luật không ma sát • Persistence To The End', 60, 102);

    // User Tag
    if (userEmail) {
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#FCC934';
      ctx.textAlign = 'right';
      ctx.fillText(userEmail, 1140, 85);
      ctx.textAlign = 'left';
    }

    // Main Card Box
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(60, 180, 1080, 390, 24);
    ctx.fill();

    // Box border
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Task Name & Mode Badge
    ctx.font = 'bold 42px sans-serif';
    ctx.fillStyle = '#1E3A5F';
    ctx.fillText(task.name, 100, 250);

    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = task.mode === 'habit' ? '#FF6B00' : '#3B6998';
    ctx.fillText(
      task.mode === 'habit'
        ? `🔥 THÓI QUEN KỶ LUẬT (${targetMilestone} NGÀY)`
        : '⏱️ DỰ ÁN TÍCH LŨY',
      100,
      290
    );

    // Stats Grid
    // Col 1: Streak / Total Time
    ctx.fillStyle = '#FFF3E0';
    ctx.beginPath();
    ctx.roundRect(100, 330, 280, 140, 16);
    ctx.fill();

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#B45309';
    ctx.fillText(task.mode === 'habit' ? 'CHUỖI HIỆN TẠI' : 'TỔNG TẬP TRUNG', 130, 365);

    ctx.font = 'bold 44px sans-serif';
    ctx.fillStyle = '#FF6B00';
    ctx.fillText(
      task.mode === 'habit' ? `🔥 ${task.currentStreak} ngày` : formatDuration(totalDurationMs, true),
      130,
      430
    );

    // Col 2: Persistence Density
    ctx.fillStyle = '#E8F0FE';
    ctx.beginPath();
    ctx.roundRect(410, 330, 280, 140, 16);
    ctx.fill();

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#1E3A5F';
    ctx.fillText('MẬT ĐỘ BỀN BỈ', 440, 365);

    ctx.font = 'bold 44px sans-serif';
    ctx.fillStyle = '#1E3A5F';
    ctx.fillText(`${persistenceDensity}%`, 440, 430);

    // Col 3: Shields or Active Days
    ctx.fillStyle = '#F4F7FA';
    ctx.beginPath();
    ctx.roundRect(720, 330, 380, 140, 16);
    ctx.fill();

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(task.mode === 'habit' ? 'KHIÊN BỀN BỈ TÍCH TRỮ' : 'SỐ NGÀY THỰC HIỆN', 750, 365);

    ctx.font = 'bold 44px sans-serif';
    ctx.fillStyle = '#1E3A5F';
    ctx.fillText(
      task.mode === 'habit' ? `🛡️ ${task.shields} khiên` : `${activeDaysCount} / ${historyDays} ngày`,
      750,
      430
    );

    // Footer quote
    ctx.font = 'italic 18px sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText(
      '“Chiến thắng không thuộc về người thông minh nhất, mà thuộc về người bền bỉ tới cùng.”',
      100,
      525
    );

    // Watermark URL
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#3B6998';
    ctx.fillText('ben-bi-toi-cung.vercel.app', 1100, 525);
    ctx.textAlign = 'left';

    // Download PNG
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `vinh-danh-ben-bi-${task.id}.png`;
    a.click();
    setShareCardGenerating(false);
  };

  const getMatrixColor = (status: MatrixDayStatus): string => {
    switch (status) {
      case 'completed_on_time':
        return 'bg-[#FF6B00] text-white border-[#FF6B00]';
      case 'frozen_by_shield':
        return 'bg-[#FCC934] text-slate-900 border-[#FCC934]';
      case 'makeup_recovered':
        return 'bg-[#1E3A5F] text-white border-[#1E3A5F]';
      case 'missed':
        return 'bg-[#D93025] text-white border-[#D93025]';
      case 'upcoming':
      default:
        return 'bg-[#E8F0FE] text-slate-500 border-[#D0E1FD]';
    }
  };

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
        {/* Header Ribbon */}
        <div className="bg-[#1E3A5F] text-white p-5 flex flex-wrap gap-3 items-center justify-between sticky top-0 z-10 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold bg-[#3B6998] px-2.5 py-0.5 rounded-full text-[#E8F0FE]">
                {task.mode === 'habit' ? 'Báo cáo Thói quen' : 'Báo cáo Dự án'}
              </span>
              <span className="text-xs text-[#E8F0FE]/80">Mục tiêu: {targetMilestone} ngày</span>
            </div>
            <h2 className="text-xl font-bold mt-1 text-white flex items-center gap-2">
              {task.name}
              {task.mode === 'habit' && (
                <span className="text-sm font-semibold text-[#FCC934] bg-white/10 px-2 py-0.5 rounded-md">
                  🔥 {task.currentStreak} ngày
                </span>
              )}
            </h2>
          </div>
          
          {/* Top-Right Action Buttons: Edit, Delete & Close */}
          <div className="flex items-center gap-2">
            {onEditTask && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditTask(task);
                }}
                title="Chỉnh sửa thông tin tác vụ"
                className="w-9 h-9 rounded-full bg-white/15 text-white font-bold hover:bg-[#3B6998] transition-colors flex items-center justify-center cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {onDeleteTask && (
              <button
                type="button"
                onClick={() => setConfirmingDelete((prev) => !prev)}
                title="Xóa tác vụ này vĩnh viễn"
                className="w-9 h-9 rounded-full bg-red-500/20 text-red-300 font-bold hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Đóng bảng báo cáo"
              className="w-9 h-9 rounded-full bg-[#3B6998] text-white font-bold hover:bg-[#FF6B00] transition-colors flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* In-App Delete Confirmation Banner */}
        {confirmingDelete && onDeleteTask && (
          <div className="bg-red-50 border-b border-red-200 px-5 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-red-800">
              <strong>Xác nhận xóa vĩnh viễn:</strong> Bạn có chắc chắn muốn xóa tác vụ{' '}
              <strong>"{task.name}"</strong> cùng toàn bộ lịch sử phiên làm việc?
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => onDeleteTask(task.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 cursor-pointer"
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        )}

        {/* Active Unsaved Sprint Session Banner for Project Mode */}
        {task.mode === 'project' && task.accumulatedMs > 0 && onCompleteSprintSession && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Đang có phiên làm việc tích lũy <strong>{formatDuration(task.accumulatedMs, true)}</strong> chưa chốt vào nhật ký.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onCompleteSprintSession(task.id)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              Chốt & Lưu Phiên Này
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* TẦNG 1: Hero Summary Cards (#1E3A5F theme) */}
          <div className="bg-[#1E3A5F] text-white p-5 rounded-2xl shadow-lg border border-[#3B6998]">
            <div className="text-xs font-semibold text-[#E8F0FE]/80 uppercase tracking-wider mb-3">
              Tầng 1 • Tổng quan năng lực kiên trì (Hero Summary)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 text-[#E8F0FE] text-xs font-medium">
                  <Clock className="w-4 h-4 text-[#FF6B00]" />
                  <span>Tổng thời gian tích lũy</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white mt-1.5 tabular-nums">
                  {formatDuration(totalDurationMs, true)}
                </div>
                <div className="text-xs text-blue-200 mt-0.5">
                  {(totalDurationMs / 3600000).toFixed(1)} giờ thực tế
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 text-[#E8F0FE] text-xs font-medium">
                  <TrendingUp className="w-4 h-4 text-[#FCC934]" />
                  <span>Mật độ bền bỉ (% Density)</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[#FCC934] mt-1.5 tabular-nums">
                  {persistenceDensity}%
                </div>
                <div className="text-xs text-blue-200 mt-0.5">
                  {activeDaysCount} ngày làm / {historyDays} ngày lịch sử
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 text-[#E8F0FE] text-xs font-medium">
                  <Calendar className="w-4 h-4 text-[#81C995]" />
                  <span>Trung bình mỗi ngày làm</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white mt-1.5 tabular-nums">
                  {avgMinutesPerActiveDay} <span className="text-sm font-normal">phút</span>
                </div>
                <div className="text-xs text-blue-200 mt-0.5">Định mức: {Math.round(task.targetDurationMs / 60000)} phút</div>
              </div>
            </div>
          </div>

          {/* TẦNG 2: Trực quan hóa dữ liệu (Project Heatmap or Habit 66-day Matrix) */}
          <div className="bg-[#F4F7FA] p-5 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#1E3A5F]" />
                <h3 className="text-sm font-bold text-slate-800">
                  {task.mode === 'project'
                    ? 'Tầng 2 • Bản đồ nhiệt 30 ngày gần nhất'
                    : `Tầng 2 • Ma trận chuỗi ${targetMilestone} ngày (UCL habit formation)`}
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">Rollover: 04:00 AM</span>
            </div>

            {task.mode === 'project' ? (
              /* Project 30-day Heatmap */
              <div className="space-y-3">
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5 sm:gap-2">
                  {last30Days.map((d, idx) => (
                    <div
                      key={d.dateStr}
                      title={`${d.label}: ${d.durationMinutes} phút`}
                      className={`flex h-9 sm:h-12 flex-col items-center justify-center rounded-lg border text-[11px] sm:text-xs font-bold leading-none transition-colors ${getHeatColor(
                        d.durationMinutes
                      )} ${idx === last30Days.length - 1 ? 'ring-2 ring-[#FF6B00]/60 ring-offset-1' : ''}`}
                    >
                      <span>{d.dayNum}</span>
                      <span className="hidden sm:block text-[9px] font-semibold opacity-90 mt-1">
                        {d.durationMinutes > 0 ? `${d.durationMinutes}m` : '—'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-slate-500 pt-2 border-t border-slate-200">
                  {maxMinutesIn30Days > 0 ? (
                    <>
                      <span className="font-semibold text-slate-600">{activeDaysIn30}/30 ngày</span> có làm việc • tổng{' '}
                      <span className="font-semibold text-slate-600">{totalMinutesIn30} phút</span> • cao nhất{' '}
                      <span className="font-semibold text-[#FF6B00]">{maxMinutesIn30Days} phút</span>
                    </>
                  ) : (
                    <span className="font-semibold text-slate-400">Chưa có phiên làm việc trong 30 ngày gần nhất</span>
                  )}
                </div>

                {/* Heat Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-medium text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-[#FF6B00] rounded-xs inline-block shrink-0" />
                    <span>Cao nhất</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-[#1E3A5F] rounded-xs inline-block shrink-0" />
                    <span>Nhiều</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-[#7FA8D4] rounded-xs inline-block shrink-0" />
                    <span>Vừa</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-[#D0E1FD] rounded-xs inline-block shrink-0" />
                    <span>Ít</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-slate-100 border border-slate-200 rounded-xs inline-block shrink-0" />
                    <span>Chưa làm</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Habit 30/66-day Matrix */
              <div className="space-y-3">
                <div className="grid grid-cols-5 sm:grid-cols-11 gap-1.5 max-h-[300px] overflow-y-auto p-1">
                  {streakMatrix.map((cell) => (
                    <div
                      key={cell.dayNumber}
                      title={`${cell.label}: ${cell.status}`}
                      className={`h-9 rounded-lg border flex flex-col items-center justify-center text-xs font-bold transition-all shadow-xs ${getMatrixColor(
                        cell.status
                      )}`}
                    >
                      <span className="text-xs leading-tight">D{cell.dayNumber}</span>
                    </div>
                  ))}
                </div>

                {/* 5-Color Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs font-medium text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-[#FF6B00] rounded-xs inline-block shrink-0" />
                    <span>Hoàn thành đúng giờ</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-[#FCC934] rounded-xs inline-block shrink-0" />
                    <span>Khiên bảo vệ</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-[#1E3A5F] rounded-xs inline-block shrink-0" />
                    <span>Đền bù (x2)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-[#D93025] rounded-xs inline-block shrink-0" />
                    <span>Bỏ lỡ / Đứt chuỗi</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 bg-[#E8F0FE] border border-[#D0E1FD] rounded-xs inline-block shrink-0" />
                    <span>Ngày tương lai</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cắt gọt thời gian thừa nếu quên tắt timer (Cho Dự án) */}
          {task.mode === 'project' && onTrimLatestSession && (
            <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#FF6B00] text-white">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Cắt gọt thời gian thừa (Trim Session)
                  </h4>
                  <p className="text-[10px] sm:text-xs text-slate-600">
                    Nếu bạn để quên đồng hồ chạy qua giờ, hãy kéo thanh trượt để cắt bớt.
                  </p>
                </div>
              </div>

              {trimSuccessMessage && (
                <div className="bg-emerald-100 text-emerald-800 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 font-medium">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{trimSuccessMessage}</span>
                </div>
              )}

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Số phút muốn cắt bớt:</span>
                  <span className="text-[#FF6B00] font-mono text-sm">{trimMinutes} phút</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  step="1"
                  value={trimMinutes}
                  onChange={(e) => setTrimMinutes(Number(e.target.value))}
                  className="w-full accent-[#FF6B00] cursor-pointer"
                />
              </div>

              <div className="bg-white p-3 rounded-lg border border-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-2">
                <div>
                  <span className="text-slate-500">Thời gian sau cắt: </span>
                  <strong className="text-slate-900 font-mono font-bold text-sm">
                    {formatDuration(trimmedMs)}
                  </strong>
                  <span className="text-slate-400 text-[10px] sm:text-xs block sm:inline"> (gốc: {formatDuration(targetToTrimMs)})</span>
                </div>
                <button
                  type="button"
                  onClick={handleApplyTrim}
                  className="w-full sm:w-auto bg-[#FF6B00] hover:bg-[#E65100] text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-xs transition-colors text-center"
                >
                  Cắt gọt
                </button>
              </div>
            </div>
          )}

          {/* TẦNG 3: Xuất dữ liệu & Bảng vinh danh Share Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-[#FF6B00]" />
                <h4 className="text-sm font-bold text-slate-800">
                  Tầng 3 • Xuất dữ liệu & Thẻ Vinh Danh
                </h4>
              </div>
            </div>

            <p className="text-[11px] sm:text-xs text-slate-600">
              Xuất nhật ký làm việc để lưu trữ hoặc tạo ảnh 1200x630 chia sẻ mạng xã hội.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Xuất file CSV (.csv)</span>
              </button>

              <button
                type="button"
                onClick={handleExportMarkdown}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors border border-slate-200"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Xuất Markdown (.md)</span>
              </button>

              <button
                type="button"
                onClick={handleGenerateShareCard}
                disabled={shareCardGenerating}
                className="py-2.5 px-3 bg-[#FF6B00] hover:bg-[#E05E00] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
              >
                <Award className="w-4 h-4 text-[#FCC934]" />
                <span>{shareCardGenerating ? 'Đang tạo...' : '🏆 Tạo Thẻ Vinh Danh'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#F4F7FA] px-5 sm:px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="text-[10px] sm:text-xs text-slate-500 font-medium">Bền bỉ tới cùng • Chuẩn UCL 66 ngày</span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 sm:py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 bg-slate-100 sm:bg-transparent rounded-lg transition-colors border border-slate-200 sm:border-transparent"
          >
            Đóng báo cáo
          </button>
        </div>
      </div>
    </div>
  );
};
