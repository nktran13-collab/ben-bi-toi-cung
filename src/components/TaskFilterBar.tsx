import React from 'react';
import { Sparkles, HeartPulse, Briefcase, BookOpen, Layers, Plus, Search } from 'lucide-react';
import type { TaskCategory, TaskItem } from '../utils/engine';

interface TaskFilterBarProps {
  tasks: TaskItem[];
  darkMode: boolean;
  currentCategory: 'all' | TaskCategory;
  onSelectCategory: (category: 'all' | TaskCategory) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddTask: () => void;
}

export const TaskFilterBar: React.FC<TaskFilterBarProps> = ({
  tasks,
  darkMode,
  currentCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onAddTask,
}) => {
  const categories: {
    value: 'all' | TaskCategory;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    count: number;
  }[] = [
    { value: 'all', label: 'Tất cả', icon: Layers, iconClass: '', count: tasks.length },
    {
      value: 'health',
      label: 'Sức khoẻ',
      icon: HeartPulse,
      iconClass: 'text-rose-500',
      count: tasks.filter((t) => t.category === 'health').length,
    },
    {
      value: 'work',
      label: 'Công việc',
      icon: Briefcase,
      iconClass: 'text-[#3B6998]',
      count: tasks.filter((t) => t.category === 'work').length,
    },
    {
      value: 'study',
      label: 'Học hành',
      icon: BookOpen,
      iconClass: 'text-indigo-500',
      count: tasks.filter((t) => t.category === 'study').length,
    },
    {
      value: 'habit',
      label: 'Thói quen',
      icon: Sparkles,
      iconClass: 'text-[#FF6B00]',
      count: tasks.filter((t) => t.category === 'habit').length,
    },
  ];

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
      <div
        className={`flex w-full flex-wrap items-center gap-1 rounded-xl border p-1 shadow-2xs sm:w-auto sm:flex-nowrap sm:gap-1.5 sm:overflow-x-auto ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
        }`}
      >
        {categories.map(({ value, label, icon: Icon, iconClass, count }) => {
          const active = currentCategory === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelectCategory(value)}
              className={`flex items-center gap-1 min-h-11 px-2.5 py-2 sm:min-h-0 sm:gap-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : darkMode
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`hidden h-3.5 w-3.5 sm:block ${iconClass}`} />
              <span>{label}</span>
              <span
                className={`text-[11px] leading-none px-1.5 py-0.5 rounded-full ${
                  value === 'all'
                    ? 'bg-white/20'
                    : darkMode
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-200 text-slate-700'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        <div className="relative flex-1 sm:w-52">
          <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm kiếm tác vụ..."
            className={`w-full min-h-11 sm:min-h-0 pl-8 pr-3 py-2 sm:py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#FF6B00] ${
              darkMode
                ? 'bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500'
                : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
            }`}
          />
        </div>

        <div
          className={`min-h-11 sm:min-h-0 px-3 py-2 sm:py-1.5 rounded-xl text-xs font-bold font-mono border flex items-center justify-center gap-1.5 shrink-0 ${
            tasks.length >= 24
              ? 'bg-red-50 text-red-700 border-red-300'
              : darkMode
                ? 'bg-slate-900 text-sky-300 border-slate-800'
                : 'bg-[#E8F0FE] text-[#1E3A5F] border-[#3B6998]/30'
          }`}
        >
          <span>{tasks.length}/24</span>
        </div>

        <button
          type="button"
          disabled={tasks.length >= 24}
          onClick={onAddTask}
          className="hidden min-h-11 sm:flex sm:min-h-0 px-3.5 py-2 sm:py-1.5 bg-[#FF6B00] hover:bg-[#E65100] active:scale-95 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition-all items-center gap-1.5 cursor-pointer shrink-0"
          title="Thêm tác vụ mới"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Thêm tác vụ</span>
        </button>
      </div>
    </div>
  );
};
