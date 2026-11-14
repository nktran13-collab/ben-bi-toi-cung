import React, { useState, useEffect } from 'react';
import { X, Sparkles, HeartPulse, Briefcase, BookOpen, Clock, Calendar, Pencil } from 'lucide-react';
import { TaskMode, TaskCategory, TaskItem } from '../utils/engine';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (
    task: Omit<
      TaskItem,
      | 'id'
      | 'currentStreak'
      | 'bestStreak'
      | 'shields'
      | 'status'
      | 'startedAtMs'
      | 'accumulatedMs'
      | 'historyStartTimestamp'
      | 'sync_status'
      | 'updated_at_ms'
    >,
  ) => void;
  editingTask?: TaskItem | null;
  onEditTask?: (
    taskId: string,
    updates: {
      name: string;
      mode: TaskMode;
      category: TaskCategory;
      targetDurationMs: number;
      targetMilestoneDays?: number;
      notes?: string;
    },
  ) => void;
  taskCount?: number;
}

export const AddTaskModal: React.FC<AddTaskModalProps> = ({
  isOpen,
  onClose,
  onAddTask,
  editingTask = null,
  onEditTask,
  taskCount = 0,
}) => {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<TaskMode>('habit');
  const [category, setCategory] = useState<TaskCategory>('study');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [milestoneDays, setMilestoneDays] = useState(30);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingTask) {
      setName(editingTask.name);
      setMode(editingTask.mode);
      setCategory(editingTask.category);
      setDurationMinutes(Math.max(1, Math.round(editingTask.targetDurationMs / 60000)));
      setMilestoneDays(editingTask.targetMilestoneDays || 30);
      setNotes(editingTask.notes || '');
      setError(null);
    } else {
      setName('');
      setMode('habit');
      setCategory('study');
      setDurationMinutes(30);
      setMilestoneDays(30);
      setNotes('');
      setError(null);
    }
  }, [editingTask, isOpen]);

  if (!isOpen) return null;

  const isEditing = !!editingTask;
  const isLimitReached = !isEditing && taskCount >= 24;

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
    if (!durationMinutes || durationMinutes <= 0) {
      setError('Thời lượng định mức phải lớn hơn 0 phút.');
      return;
    }

    if (isEditing && editingTask && onEditTask) {
      onEditTask(editingTask.id, {
        name: name.trim(),
        mode,
        category,
        targetDurationMs: durationMinutes * 60 * 1000,
        targetMilestoneDays: milestoneDays,
        notes: notes.trim() || undefined,
      });
    } else {
      onAddTask({
        name: name.trim(),
        mode,
        category,
        targetDurationMs: durationMinutes * 60 * 1000,
        targetMilestoneDays: milestoneDays,
        notes: notes.trim() || undefined,
      });
    }

    setName('');
    setDurationMinutes(30);
    setNotes('');
    setError(null);
    onClose();
  };

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#1E3A5F] text-white p-4 sm:p-5 flex items-center justify-between sticky top-0 z-10 shrink-0 shadow-xs">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              {isEditing ? (
                <>
                  <Pencil className="w-5 h-5 text-[#FCC934]" />
                  <span>Chỉnh Sửa Tác Vụ</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-[#FCC934]" />
                  <span>Thêm Tác Vụ Mới</span>
                </>
              )}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] sm:text-xs text-[#E8F0FE]/80">
                {isEditing
                  ? 'Cập nhật định mức, danh mục hoặc ghi chú ý định'
                  : 'Thiết lập mục tiêu và định mức kỷ luật hàng ngày'}
              </span>
              {!isEditing && (
                <span className="text-[11px] sm:text-xs font-mono px-2 py-0.2 rounded-full bg-white/10 text-[#FCC934]">
                  {taskCount}/24 tối đa
                </span>
              )}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {isLimitReached && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 font-medium">
              ⚠️ Đã đạt giới hạn tối đa 24 tác vụ. Bạn không thể tạo thêm tác vụ mới để duy trì sự tập trung tối ưu.
            </div>
          )}
          {error && (
            <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-lg border border-rose-200">{error}</div>
          )}

          {/* Task Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Tên tác vụ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="VD: Đọc sách 30p, Lập trình Frontend, Thiền sáng..."
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent"
            />
          </div>

          {/* Mode Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Chế độ tác vụ</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMode('habit')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  mode === 'habit'
                    ? 'border-[#FF6B00] bg-[#FFF3E0] dark:bg-[#FF6B00]/15 ring-2 ring-[#FF6B00]/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="text-xs font-bold text-[#FF6B00] flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Thói quen (Đếm ngược)</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                  Đếm từ 100% về 0%, yêu cầu giữ 0.8s để xác nhận chuỗi 🔥
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('project')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  mode === 'project'
                    ? 'border-[#1E3A5F] bg-[#E8F0FE] dark:bg-sky-950/30 ring-2 ring-[#1E3A5F]/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="text-xs font-bold text-[#1E3A5F] dark:text-sky-400 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>Dự án (Đo lường)</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                  Đo tổng thời gian, mật độ bền bỉ % và có tính năng chốt phiên
                </div>
              </button>
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nhóm danh mục</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'health', label: 'Sức khoẻ', icon: HeartPulse, color: 'text-rose-500' },
                { id: 'work', label: 'Công việc', icon: Briefcase, color: 'text-[#3B6998] dark:text-sky-400' },
                { id: 'study', label: 'Học hành', icon: BookOpen, color: 'text-indigo-500' },
                { id: 'habit', label: 'Thói quen', icon: Sparkles, color: 'text-[#FF6B00]' },
              ].map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id as TaskCategory)}
                    className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'border-slate-800 bg-slate-100 dark:border-sky-500 dark:bg-slate-800 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
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
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Định mức mục tiêu (phút)</label>
              <span className="text-xs font-bold font-mono text-[#FF6B00]">
                {durationMinutes} phút ({Math.floor(durationMinutes / 60)}h {durationMinutes % 60}p)
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {[15, 20, 30, 45, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationMinutes(mins)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold font-mono transition-colors cursor-pointer ${
                    durationMinutes === mins
                      ? 'bg-[#1E3A5F] text-white'
                      : 'bg-[#F4F7FA] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
              value={durationMinutes || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setDurationMinutes(0);
                } else {
                  const num = Number(val);
                  if (!Number.isNaN(num)) {
                    setDurationMinutes(num);
                  }
                }
              }}
              placeholder="30"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
            />
          </div>

          {/* Milestone Target Days (For Habits) */}
          {mode === 'habit' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cột mốc mục tiêu chuỗi
              </label>
              <div className="flex gap-2">
                {[30, 66, 100].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setMilestoneDays(days)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      milestoneDays === days
                        ? 'border-[#FF6B00] bg-[#FFF3E0] dark:bg-[#FF6B00]/15 text-[#FF6B00] font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    🔥 {days} ngày {days === 66 ? '(Chuẩn UCL)' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Ghi chú ý định (Tùy chọn)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Đọc sách vào 21:00 trước khi ngủ, không dùng điện thoại"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Sticky Submit Actions at bottom of form */}
          <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-900 z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-[#FF6B00] hover:bg-[#E65100] active:scale-95 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              {isEditing ? 'Lưu thay đổi' : 'Tạo tác vụ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
