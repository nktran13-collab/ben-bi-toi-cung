import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  HeartPulse,
  Briefcase,
  BookOpen,
  Clock,
  Calendar,
  Pencil,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { TaskMode, TaskCategory, TaskItem } from '../utils/engine';
import { useI18n } from '../utils/useI18n';

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
      targetUnlimited?: boolean;
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
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<TaskMode>('habit');
  const [category, setCategory] = useState<TaskCategory>('study');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [unlimited, setUnlimited] = useState(false);
  const [milestoneDays, setMilestoneDays] = useState(30);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingTask) {
      setName(editingTask.name);
      setMode(editingTask.mode);
      setCategory(editingTask.category);
      setDurationMinutes(Math.max(1, Math.round(editingTask.targetDurationMs / 60000)));
      setUnlimited(editingTask.mode === 'project' && !!editingTask.targetUnlimited);
      setMilestoneDays(editingTask.targetMilestoneDays || 30);
      setNotes(editingTask.notes || '');
      setError(null);
    } else {
      setName('');
      setMode('habit');
      setCategory('study');
      setDurationMinutes(30);
      setUnlimited(false);
      setMilestoneDays(30);
      setNotes('');
      setError(null);
    }
  }, [editingTask, isOpen]);

  if (!isOpen) return null;

  const isEditing = !!editingTask;
  const isLimitReached = !isEditing && taskCount >= 24;
  const isUnlimitedTarget = mode === 'project' && unlimited;
  const resolvedDurationMinutes = durationMinutes > 0 ? durationMinutes : 30;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) {
      setError(t('addTask.errorLimit'));
      return;
    }
    if (!name.trim()) {
      setError(t('addTask.errorName'));
      return;
    }
    if (!isUnlimitedTarget && (!durationMinutes || durationMinutes <= 0)) {
      setError(t('addTask.errorDuration'));
      return;
    }

    if (isEditing && editingTask && onEditTask) {
      onEditTask(editingTask.id, {
        name: name.trim(),
        mode,
        category,
        targetDurationMs: resolvedDurationMinutes * 60 * 1000,
        targetMilestoneDays: milestoneDays,
        targetUnlimited: isUnlimitedTarget ? true : undefined,
        notes: notes.trim() || undefined,
      });
    } else {
      onAddTask({
        name: name.trim(),
        mode,
        category,
        targetDurationMs: resolvedDurationMinutes * 60 * 1000,
        targetMilestoneDays: milestoneDays,
        targetUnlimited: isUnlimitedTarget ? true : undefined,
        notes: notes.trim() || undefined,
      });
    }

    setName('');
    setDurationMinutes(30);
    setUnlimited(false);
    setNotes('');
    setError(null);
    onClose();
  };

  return (
    <div className="safe-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between bg-[#1E3A5F] p-4 text-white shadow-xs sm:p-5 [@media(max-height:520px)]:p-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              {isEditing ? (
                <>
                  <Pencil className="w-5 h-5 text-[#FCC934]" />
                  <span>{t('addTask.editTitle')}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-[#FCC934]" />
                  <span>{t('addTask.newTitle')}</span>
                </>
              )}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] sm:text-xs text-[#E8F0FE]/80">
                {isEditing ? t('addTask.editSubtitle') : t('addTask.newSubtitle')}
              </span>
              {!isEditing && (
                <span className="shrink-0 whitespace-nowrap text-[11px] sm:text-xs font-mono px-2 py-0.2 rounded-full bg-white/10 text-[#FCC934]">
                  {t('addTask.maxCount', { n: taskCount })}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('addTask.close')}
            className="p-1.5 rounded-lg text-[#E8F0FE]/70 hover:text-white hover:bg-[#3B6998] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6 [@media(max-height:520px)]:space-y-3 [@media(max-height:520px)]:p-3"
        >
          {isLimitReached && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200 font-medium">
              {t('addTask.limitReached')}
            </div>
          )}
          {error && (
            <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-lg border border-rose-200">{error}</div>
          )}

          {/* Task Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('addTask.nameLabel')} <span className="text-rose-500">*</span>
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
              placeholder={t('addTask.namePlaceholder')}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent"
            />
          </div>

          {/* Mode Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('addTask.modeLabel')}
            </label>
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
                  <span>{t('addTask.modeHabit')}</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{t('addTask.modeHabitDesc')}</div>
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
                  <span>{t('addTask.modeProject')}</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                  {t('addTask.modeProjectDesc')}
                </div>
              </button>
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('addTask.categoryLabel')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'health', label: t('category.health'), icon: HeartPulse, color: 'text-rose-500' },
                {
                  id: 'work',
                  label: t('category.work'),
                  icon: Briefcase,
                  color: 'text-[#3B6998] dark:text-sky-400',
                },
                { id: 'study', label: t('category.study'), icon: BookOpen, color: 'text-indigo-500' },
                { id: 'habit', label: t('category.habit'), icon: Sparkles, color: 'text-[#FF6B00]' },
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
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('addTask.targetLabel')}
                {mode === 'habit' ? ` (${t('common.minutes')})` : ''}
              </label>
              <span
                className={`text-xs font-bold font-mono ${
                  isUnlimitedTarget ? 'text-[#1E3A5F] dark:text-sky-400' : 'text-[#FF6B00]'
                }`}
              >
                {isUnlimitedTarget ? t('addTask.unlimited') : `${durationMinutes} ${t('common.minutes')}`}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {[15, 20, 30, 45, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setUnlimited(false);
                    setDurationMinutes(mins);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold font-mono transition-colors cursor-pointer ${
                    !isUnlimitedTarget && durationMinutes === mins
                      ? 'bg-[#1E3A5F] text-white'
                      : 'bg-[#F4F7FA] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {mins}
                  {t('common.minutesShort')}
                </button>
              ))}
              {mode === 'project' && (
                <button
                  type="button"
                  onClick={() => setUnlimited(true)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                    isUnlimitedTarget
                      ? 'bg-[#1E3A5F] text-white'
                      : 'bg-[#E8F0FE] dark:bg-sky-950/40 text-[#1E3A5F] dark:text-sky-300 border border-[#3B6998]/30 hover:bg-[#D0E1FD] dark:hover:bg-sky-900/50'
                  }`}
                  title={t('addTask.unlimitedTitle')}
                >
                  <InfinityIcon className="w-3.5 h-3.5" />
                  <span>{t('addTask.unlimited')}</span>
                </button>
              )}
            </div>
            {isUnlimitedTarget ? (
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 bg-[#E8F0FE]/70 dark:bg-sky-950/30 border border-[#3B6998]/20 dark:border-sky-800/40 rounded-lg px-3 py-2 leading-relaxed">
                {t('addTask.unlimitedHintPrefix')} <strong>{t('addTask.unlimitedHintMany')}</strong>
                {t('addTask.unlimitedHintMiddle')} <strong>{t('addTask.unlimitedHintAccumulate')}</strong>{' '}
                {t('addTask.unlimitedHintSuffix')}
              </p>
            ) : (
              <input
                type="number"
                min="1"
                max="600"
                value={durationMinutes || ''}
                onChange={(e) => {
                  setUnlimited(false);
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
            )}
          </div>

          {/* Milestone Target Days (For Habits) */}
          {mode === 'habit' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('addTask.milestoneLabel')}
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
                    🔥 {t('addTask.milestoneDays', { n: days })} {days === 66 ? t('addTask.milestoneUcl') : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('addTask.notesLabel')}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('addTask.notesPlaceholder')}
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-[#FF6B00] hover:bg-[#E65100] active:scale-95 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              {isEditing ? t('common.saveChanges') : t('common.createTask')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
