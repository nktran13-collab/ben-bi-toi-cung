import React, { useState } from 'react';
import { X, Sparkles, HeartPulse, Briefcase, BookOpen, Clock, Calendar } from 'lucide-react';
import { TaskMode, TaskCategory, TaskItem } from '../utils/engine';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (task: Omit<TaskItem, 'id' | 'currentStreak' | 'bestStreak' | 'shields' | 'status' | 'startedAtMs' | 'accumulatedMs' | 'historyStartTimestamp' | 'sync_status' | 'updated_at_ms'>) => void;
  taskCount?: number;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({ isOpen, onClose, onAddTask, taskCount = 0 }) => {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<TaskMode>('habit');
  const [category, setCategory] = useState<TaskCategory>('study');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [milestoneDays, setMilestoneDays] = useState(30);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isLimitReached = taskCount >= 24;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) {
      setError('Đã đạt giới hạn tối đa 24 tác vụ. Vui lòng hoàn tất hoặc xóa bớt tác vụ.');
      return;
    }
    if (!name.trim()) {
      setError('Vui lòng nhập tên tác vụ.');
      return;
    }
    if (durationMinutes <= 0) {
      setError('Thời lượng phải lớn hơn 0 phút.');
      return;
    }

    onAddTask({
      name: name.trim(),
      mode,
      category,
      targetDurationMs: durationMinutes * 60 * 1000,
      targetMilestoneDays: milestoneDays,
      notes: notes.trim() || undefined,
    });

    // Reset form
    setName('');
    setDurationMinutes(30);
    setNotes('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#1E3A5F] text-white p-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FCC934]" />
              Thêm Tác Vụ Mới
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-[#E8F0FE]/80">
                Thiết lập mục tiêu và định mức kỷ luật hàng ngày
              </span>
              <span className="text-xs font-mono px-2 py-0.2 rounded-full bg-white/10 text-[#FCC934]">
                {taskCount}/24 tác vụ tối đa
              </span>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          {isLimitReached && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 font-medium">
              ⚠️ Đã đạt giới hạn tối đa 24 tác vụ. Bạn không thể tạo thêm tác vụ mới để duy trì sự tập trung tối ưu.
            </div>
          )}
          {error && (
            <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-lg border border-rose-200">
              {error}
            </div>
          )}

          {/* Task Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tên tác vụ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="VD: Đọc sách 30p, Lập trình Frontend, Thiền sáng..."
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent"
            />
          </div>

          {/* Mode Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Chế độ tác vụ
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMode('habit')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mode === 'habit'
                    ? 'border-[#FF6B00] bg-[#FFF3E0] ring-2 ring-[#FF6B00]/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold text-[#FF6B00] flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Thói quen (Đếm ngược)</span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Đếm từ 100% về 0%, yêu cầu giữ 0.8s để xác nhận chuỗi 🔥
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('project')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mode === 'project'
                    ? 'border-[#1E3A5F] bg-[#E8F0FE] ring-2 ring-[#1E3A5F]/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold text-[#1E3A5F] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>Dự án (Đo lường lấp đầy)</span>
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Đo tổng thời gian, mật độ bền bỉ % và có tính năng cắt gọt thừa
                </div>
              </button>
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nhóm danh mục
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'health', label: 'Sức khoẻ', icon: HeartPulse, color: 'text-rose-500' },
                { id: 'work', label: 'Công việc', icon: Briefcase, color: 'text-[#1E3A5F]' },
                { id: 'study', label: 'Học hành', icon: BookOpen, color: 'text-indigo-600' },
                { id: 'habit', label: 'Thói quen', icon: Sparkles, color: 'text-[#FF6B00]' },
              ].map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id as TaskCategory)}
                    className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-slate-800 bg-slate-100 font-bold shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Duration */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Định mức mục tiêu (phút)
              </label>
              <span className="text-xs font-bold font-mono text-[#1E3A5F]">
                {durationMinutes} phút ({Math.floor(durationMinutes / 60)}h {durationMinutes % 60}p)
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {[15, 20, 30, 45, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold font-mono transition-colors ${
                    durationMinutes === mins
                      ? 'bg-[#1E3A5F] text-white'
                      : 'bg-[#F4F7FA] text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {mins}p
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              max="600"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value)))}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 font-mono"
            />
          </div>

          {/* Milestone Target Days (For Habits) */}
          {mode === 'habit' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cột mốc mục tiêu chuỗi
              </label>
              <div className="flex gap-2">
                {[30, 66, 100].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setMilestoneDays(days)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      milestoneDays === days
                        ? 'border-[#FF6B00] bg-[#FFF3E0] text-[#FF6B00] font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    🔥 {days} ngày {days === 66 ? '(Hình thành phản xạ)' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú ý định (Tùy chọn)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Đọc sách vào 21:00 trước khi ngủ, không dùng điện thoại"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-[#FF6B00] hover:bg-[#E65100] rounded-lg shadow-sm transition-all active:scale-95"
            >
              Tạo tác vụ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
