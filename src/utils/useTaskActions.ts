import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  TaskItem,
  TaskCategory,
  TaskMode,
  HabitDailyLog,
  TimeSession,
  RetroactiveConfirmation,
  getLogicalDate,
  getPreviousLogicalDate,
  calculateEarnedShields,
  calculateCheckpoint,
  formatDuration,
  getEffectiveTargetDurationMs,
} from './engine';
import { soundEngine } from './audio';
import { notificationService } from './notifications';
import { realtimeManager } from './realtime';

interface UseTaskActionsOptions {
  tasks: TaskItem[];
  sessions: TimeSession[];
  logs: HabitDailyLog[];
  setTasks: Dispatch<SetStateAction<TaskItem[]>>;
  setSessions: Dispatch<SetStateAction<TimeSession[]>>;
  setLogs: Dispatch<SetStateAction<HabitDailyLog[]>>;
  showToast: (msg: string) => void;
  breakStreakMissedDays: number;
  idleRawDurationMs: number;
  dayRolloverHour: number;
  setMilestoneTask: (task: TaskItem | null) => void;
  setRetroactiveItem: (item: RetroactiveConfirmation | null) => void;
  setIdleDetectionTask: (task: TaskItem | null) => void;
  setStatsModalTaskId: (id: string | null) => void;
  setEditingTask: (task: TaskItem | null) => void;
  setCurrentCategory: (category: 'all' | TaskCategory) => void;
  setSearchQuery: (query: string) => void;
}

export function useTaskActions(options: UseTaskActionsOptions) {
  const {
    tasks,
    sessions,
    logs,
    setTasks,
    setSessions,
    setLogs,
    showToast,
    breakStreakMissedDays,
    idleRawDurationMs,
    dayRolloverHour,
    setMilestoneTask,
    setRetroactiveItem,
    setIdleDetectionTask,
    setStatsModalTaskId,
    setEditingTask,
    setCurrentCategory,
    setSearchQuery,
  } = options;

  // Toggle Timer with atomic local write and realtime broadcast
  const handleToggleTimer = useCallback(
    (taskId: string) => {
      const now = Date.now();
      setTasks((prev) => {
        let broadcastAction: 'TIMER_START' | 'TIMER_PAUSE' = 'TIMER_START';
        let targetStartedAt: number | null = now;
        let targetAccumulated = 0;

        const updated: TaskItem[] = prev.map((t): TaskItem => {
          if (t.id !== taskId) return t;

          if (t.status === 'running') {
            soundEngine.playTap(false);
            notificationService.cancelScheduledPush(t.id);
            broadcastAction = 'TIMER_PAUSE';
            const elapsed = t.startedAtMs ? now - t.startedAtMs : 0;
            targetAccumulated = t.accumulatedMs + Math.max(0, elapsed);
            targetStartedAt = null;

            return {
              ...t,
              status: 'paused',
              startedAtMs: null,
              accumulatedMs: targetAccumulated,
              sync_status: 1,
              updated_at_ms: now,
            };
          } else {
            soundEngine.playTap(true);
            broadcastAction = 'TIMER_START';
            targetAccumulated = t.accumulatedMs;
            targetStartedAt = now;

            if (t.mode === 'habit') {
              const effectiveTargetMs = getEffectiveTargetDurationMs(t);
              const remainingMs = Math.max(0, effectiveTargetMs - targetAccumulated);
              notificationService.scheduleHabitEndPush(t.id, t.name, remainingMs);
            }

            return {
              ...t,
              status: 'running',
              startedAtMs: now,
              sync_status: 1,
              updated_at_ms: now,
            };
          }
        });

        realtimeManager.publish({
          type: broadcastAction,
          taskId,
          startedAtMs: targetStartedAt,
          accumulatedMs: targetAccumulated,
        });

        return updated;
      });
    },
    [setTasks],
  );

  const handleResetTimer = useCallback(
    (taskId: string) => {
      soundEngine.playTap(false);
      notificationService.cancelScheduledPush(taskId);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'idle',
                startedAtMs: null,
                accumulatedMs: 0,
                sync_status: 1,
                updated_at_ms: Date.now(),
              }
            : t,
        ),
      );

      realtimeManager.publish({ type: 'TIMER_RESET', taskId });
    },
    [setTasks],
  );

  // Fast-forward to 5s remaining (testing helper)
  const handleFastForward5s = useCallback(
    (taskId: string) => {
      const now = Date.now();
      soundEngine.playSoftChime(880, 0.2, 0.3);

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const effectiveTargetMs = getEffectiveTargetDurationMs(t);
          const targetRemainMs = 5000;
          const newAccumulated = Math.max(0, effectiveTargetMs - targetRemainMs);

          notificationService.scheduleHabitEndPush(t.id, t.name, targetRemainMs);

          const updatedTask: TaskItem = {
            ...t,
            status: 'running',
            startedAtMs: now,
            accumulatedMs: newAccumulated,
            sync_status: 1,
            updated_at_ms: now,
          };

          realtimeManager.publish({
            type: 'TIMER_START',
            taskId,
            startedAtMs: now,
            accumulatedMs: newAccumulated,
          });

          return updatedTask;
        }),
      );
    },
    [setTasks],
  );

  // Confirm habit after long-press or confirmation button
  const handleConfirmHabit = useCallback(
    (taskId: string) => {
      const now = Date.now();
      const logicalDate = getLogicalDate(now, dayRolloverHour);

      soundEngine.playSuccessChime();
      notificationService.cancelScheduledPush(taskId);

      let updatedStreak = 0;
      let updatedShields = 0;
      let targetMilestone = 30;
      let shouldTriggerMilestoneModal: TaskItem | null = null;
      let wasInCompensation = false;
      let completedDurationMs = 0;

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const alreadyCompletedToday = t.lastCompletedDate === logicalDate;
          const newStreak = alreadyCompletedToday ? t.currentStreak : t.currentStreak + 1;
          const newBest = Math.max(t.bestStreak, newStreak);
          targetMilestone = t.targetMilestoneDays || 30;
          wasInCompensation = !!t.inCompensationQuest;
          completedDurationMs = getEffectiveTargetDurationMs(t);

          const { newShields, earned } = alreadyCompletedToday
            ? { newShields: t.shields, earned: false }
            : calculateEarnedShields(newStreak, t.shields, targetMilestone);
          updatedStreak = newStreak;
          updatedShields = newShields;

          const updatedTask: TaskItem = {
            ...t,
            status: 'completed_today',
            currentStreak: newStreak,
            bestStreak: newBest,
            shields: updatedShields,
            inCompensationQuest: false,
            startedAtMs: null,
            accumulatedMs: t.targetDurationMs,
            lastCompletedDate: logicalDate,
            lastStreakCheckDate: logicalDate,
            timerEndedAtMs: undefined,
            sync_status: 1,
            updated_at_ms: now,
          };

          if (newStreak === 30 && targetMilestone === 30) {
            shouldTriggerMilestoneModal = updatedTask;
          }

          if (earned) {
            showToast(`🛡️ Bạn vừa được thưởng +1 Khiên Bền Bỉ vì chuỗi ${newStreak} ngày!`);
          }

          return updatedTask;
        }),
      );

      const targetTask = tasks.find((t) => t.id === taskId);
      const newLog: HabitDailyLog = {
        id: `log_${crypto.randomUUID()}`,
        taskId,
        logicalDate,
        completed: true,
        actualDurationMs: completedDurationMs || (targetTask ? getEffectiveTargetDurationMs(targetTask) : 0),
        confirmedAt: now,
        recoveryType: wasInCompensation ? 'makeup' : 'on_time',
        sync_status: 1,
        updated_at_ms: now,
      };
      setLogs((prev) => [newLog, ...prev]);

      realtimeManager.publish({
        type: 'HABIT_CONFIRM',
        taskId,
        newStreak: updatedStreak,
        shields: updatedShields,
      });

      showToast(
        wasInCompensation
          ? `⚡ Đã hoàn thành Nhiệm vụ Đền bù x2! Chuỗi khôi phục và tăng lên ${updatedStreak} ngày.`
          : `🔥 Đã hoàn thành thói quen hôm nay! Chuỗi tăng lên ${updatedStreak} ngày.`,
      );

      if (shouldTriggerMilestoneModal) {
        setMilestoneTask(shouldTriggerMilestoneModal);
      }
    },
    [tasks, setTasks, setLogs, showToast, setMilestoneTask, dayRolloverHour],
  );

  // Upgrade habit to the UCL 66-day milestone
  const handleUpgradeTo66Days = useCallback(
    (taskId: string) => {
      const now = Date.now();
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, targetMilestoneDays: 66, sync_status: 1, updated_at_ms: now } : t)),
      );
      setMilestoneTask(null);
      soundEngine.playSuccessChime();
      showToast('🚀 Đã nâng cấp mục tiêu lên 66 ngày! Phản xạ thần kinh đang dần tự động hóa.');
    },
    [setTasks, setMilestoneTask, showToast],
  );

  // Retroactive confirmation handlers
  const handleConfirmYesterday = useCallback(
    (taskId: string) => {
      const now = Date.now();
      const currentLogical = getLogicalDate(now, dayRolloverHour);
      const yesterdayDate = getPreviousLogicalDate(currentLogical);

      soundEngine.playSuccessChime();

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const newStreak = t.currentStreak + 1;
          const targetMilestone = t.targetMilestoneDays || 30;
          const { newShields } = calculateEarnedShields(newStreak, t.shields, targetMilestone);

          return {
            ...t,
            status: 'idle',
            currentStreak: newStreak,
            bestStreak: Math.max(t.bestStreak, newStreak),
            shields: newShields,
            inCompensationQuest: false,
            lastCompletedDate: yesterdayDate,
            lastStreakCheckDate: currentLogical,
            timerEndedAtMs: undefined,
            startedAtMs: null,
            accumulatedMs: 0,
            sync_status: 1,
            updated_at_ms: now,
          };
        }),
      );

      const targetTask = tasks.find((t) => t.id === taskId);
      const newLog: HabitDailyLog = {
        id: `retro_${crypto.randomUUID()}`,
        taskId,
        logicalDate: yesterdayDate,
        completed: true,
        actualDurationMs: targetTask?.targetDurationMs || 0,
        confirmedAt: now,
        recoveryType: 'on_time',
        sync_status: 1,
        updated_at_ms: now,
      };
      setLogs((prev) => [newLog, ...prev]);

      setRetroactiveItem(null);
      showToast('✅ Đã truy lĩnh và bảo toàn chuỗi ngày hôm qua thành công!');
    },
    [tasks, setTasks, setLogs, setRetroactiveItem, showToast, dayRolloverHour],
  );

  const handleDiscardYesterday = useCallback(
    (taskId: string) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'idle',
                timerEndedAtMs: undefined,
                startedAtMs: null,
                accumulatedMs: 0,
                sync_status: 1,
                updated_at_ms: Date.now(),
              }
            : t,
        ),
      );
      setRetroactiveItem(null);
    },
    [setTasks, setRetroactiveItem],
  );

  // Idle timer resolution handlers
  const handleSaveIdleTrimmed = useCallback(
    (taskId: string, trimmedDurationMs: number) => {
      const now = Date.now();
      const logicalDate = getLogicalDate(now, dayRolloverHour);
      soundEngine.playSuccessChime();

      setSessions((prev) => [
        {
          id: `idle_session_${crypto.randomUUID()}`,
          taskId,
          logicalDate,
          startedAt: now - trimmedDurationMs,
          endedAt: now,
          durationMs: trimmedDurationMs,
          trimmedMs: Math.max(0, idleRawDurationMs - trimmedDurationMs),
          sync_status: 1,
          updated_at_ms: now,
        },
        ...prev,
      ]);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'idle',
                startedAtMs: null,
                accumulatedMs: 0,
                currentStreak: t.currentStreak + 1,
                bestStreak: Math.max(t.bestStreak, t.currentStreak + 1),
                lastCompletedDate: logicalDate,
                isSuspectedIdle: false,
                sync_status: 1,
                updated_at_ms: now,
              }
            : t,
        ),
      );

      setIdleDetectionTask(null);
      showToast(`Đã lưu phiên làm việc ${formatDuration(trimmedDurationMs, true)} sau khi cắt gọt.`);
    },
    [idleRawDurationMs, setSessions, setTasks, setIdleDetectionTask, showToast, dayRolloverHour],
  );

  const handleDiscardIdle = useCallback(
    (taskId: string) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'idle',
                startedAtMs: null,
                accumulatedMs: 0,
                isSuspectedIdle: false,
                sync_status: 1,
                updated_at_ms: Date.now(),
              }
            : t,
        ),
      );
      setIdleDetectionTask(null);
      showToast('Đã hủy phiên làm việc chạy quá giờ.');
    },
    [setTasks, setIdleDetectionTask, showToast],
  );

  // Trim latest session for project mode
  const handleTrimLatestSession = useCallback(
    (taskId: string, trimMinutes: number) => {
      soundEngine.playSoftChime(440, 0.2, 0.4);
      const trimMs = trimMinutes * 60 * 1000;
      const now = Date.now();

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            accumulatedMs: Math.max(0, t.accumulatedMs - trimMs),
            sync_status: 1,
            updated_at_ms: now,
          };
        }),
      );

      setSessions((prev) => {
        const rev = [...prev].reverse();
        const latest = rev.find((s) => s.taskId === taskId);
        if (!latest) return prev;
        return prev.map((s) =>
          s.id === latest.id
            ? {
                ...s,
                durationMs: Math.max(0, s.durationMs - trimMs),
                trimmedMs: (s.trimmedMs || 0) + trimMs,
                sync_status: 1,
                updated_at_ms: now,
              }
            : s,
        );
      });
    },
    [setTasks, setSessions],
  );

  // Complete sprint session for project mode (works whether paused or running)
  const handleCompleteSprintSession = useCallback(
    (taskId: string) => {
      const now = Date.now();
      const logicalDate = getLogicalDate(now, dayRolloverHour);
      soundEngine.playSuccessChime();

      const targetTask = tasks.find((t) => t.id === taskId);
      if (!targetTask) return;

      const runningDelta =
        targetTask.status === 'running' && targetTask.startedAtMs ? Math.max(0, now - targetTask.startedAtMs) : 0;
      const sessionDuration = targetTask.accumulatedMs + runningDelta;

      if (sessionDuration <= 0) return;

      setSessions((prev) => [
        {
          id: `session_${crypto.randomUUID()}`,
          taskId: targetTask.id,
          logicalDate,
          startedAt: now - sessionDuration,
          endedAt: now,
          durationMs: sessionDuration,
          sync_status: 1,
          updated_at_ms: now,
        },
        ...prev,
      ]);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'idle',
                startedAtMs: null,
                accumulatedMs: 0,
                currentStreak: t.currentStreak + 1,
                bestStreak: Math.max(t.bestStreak, t.currentStreak + 1),
                lastCompletedDate: logicalDate,
                sync_status: 1,
                updated_at_ms: now,
              }
            : t,
        ),
      );

      showToast(`✅ Đã chốt & lưu phiên làm việc ${formatDuration(sessionDuration)} vào nhật ký dự án.`);
    },
    [tasks, setSessions, setTasks, showToast, dayRolloverHour],
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      soundEngine.playTap(false);
      setTasks(tasks.filter((t) => t.id !== taskId));
      setSessions(sessions.filter((s) => s.taskId !== taskId));
      setLogs(logs.filter((l) => l.taskId !== taskId));
      setStatsModalTaskId(null);
      showToast('Đã xóa tác vụ thành công.');
    },
    [tasks, sessions, logs, setTasks, setSessions, setLogs, setStatsModalTaskId, showToast],
  );

  // Streak break recovery handlers
  const handleUseShield = useCallback(
    (taskId: string) => {
      soundEngine.playSoftChime(587.33, 0.3, 0.8);
      const now = Date.now();
      const logicalDate = getLogicalDate(now, dayRolloverHour);
      const yesterdayDate = getPreviousLogicalDate(logicalDate);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                shields: Math.max(0, t.shields - breakStreakMissedDays),
                lastCompletedDate: yesterdayDate,
                lastStreakCheckDate: logicalDate,
                sync_status: 1,
                updated_at_ms: now,
              }
            : t,
        ),
      );

      const newLog: HabitDailyLog = {
        id: `shield_log_${crypto.randomUUID()}`,
        taskId,
        logicalDate: yesterdayDate,
        completed: true,
        actualDurationMs: 0,
        confirmedAt: now,
        recoveryType: 'shield',
        sync_status: 1,
        updated_at_ms: now,
      };
      setLogs((prev) => [newLog, ...prev]);

      showToast('🛡️ Đã sử dụng Khiên Bền Bỉ để bảo vệ chuỗi thành công!');
    },
    [breakStreakMissedDays, setTasks, setLogs, showToast, dayRolloverHour],
  );

  const handleAcceptCompensation = useCallback(
    (taskId: string) => {
      soundEngine.playSoftChime(784, 0.3, 0.8);
      const now = Date.now();
      const logicalDate = getLogicalDate(now, dayRolloverHour);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                inCompensationQuest: true,
                lastStreakCheckDate: logicalDate,
                sync_status: 1,
                updated_at_ms: now,
              }
            : t,
        ),
      );
      showToast('⚡ Đã kích hoạt Nhiệm vụ Đền bù x2 thời gian cho hôm nay!');
    },
    [setTasks, showToast, dayRolloverHour],
  );

  const handleResetToCheckpoint = useCallback(
    (taskId: string) => {
      soundEngine.playTap(false);
      const now = Date.now();
      const logicalDate = getLogicalDate(now, dayRolloverHour);
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const checkpoint = calculateCheckpoint(t.currentStreak);
          return {
            ...t,
            currentStreak: checkpoint,
            inCompensationQuest: false,
            lastStreakCheckDate: logicalDate,
            sync_status: 1,
            updated_at_ms: now,
          };
        }),
      );
      showToast('Đã trở về cột mốc bảo lưu gần nhất.');
    },
    [setTasks, showToast, dayRolloverHour],
  );

  const handleFullResetStreak = useCallback(
    (taskId: string) => {
      soundEngine.playTap(false);
      const now = Date.now();
      const logicalDate = getLogicalDate(now, dayRolloverHour);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                currentStreak: 0,
                inCompensationQuest: false,
                lastStreakCheckDate: logicalDate,
                sync_status: 1,
                updated_at_ms: now,
              }
            : t,
        ),
      );
      showToast('Đã đặt lại chuỗi về Ngày 0.');
    },
    [setTasks, showToast, dayRolloverHour],
  );

  // Add task with 24-task limit enforcement
  const handleAddTask = useCallback(
    (
      newTaskData: Omit<
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
    ) => {
      if (tasks.length >= 24) {
        showToast('Đã đạt giới hạn tối đa 24 tác vụ. Vui lòng hoàn tất hoặc xóa bớt tác vụ.');
        return;
      }
      soundEngine.playSoftChime(659.25, 0.25, 0.5);
      const now = Date.now();
      const newTask: TaskItem = {
        ...newTaskData,
        id: `task_${crypto.randomUUID()}`,
        currentStreak: 0,
        bestStreak: 0,
        shields: 0,
        status: 'idle',
        startedAtMs: null,
        accumulatedMs: 0,
        historyStartTimestamp: now,
        sync_status: 1,
        updated_at_ms: now,
      };

      setTasks((prev) => [newTask, ...prev]);
      setCurrentCategory('all');
      setSearchQuery('');
      showToast(`Đã tạo tác vụ "${newTask.name}".`);
    },
    [tasks, setTasks, setCurrentCategory, setSearchQuery, showToast],
  );

  const handleEditTask = useCallback(
    (
      taskId: string,
      updates: {
        name: string;
        mode: TaskMode;
        category: TaskCategory;
        targetDurationMs: number;
        targetMilestoneDays?: number;
        notes?: string;
      },
    ) => {
      const now = Date.now();
      soundEngine.playSoftChime(659.25, 0.2, 0.4);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updates, sync_status: 1, updated_at_ms: now } : t)),
      );
      setEditingTask(null);
      showToast(`Đã cập nhật tác vụ "${updates.name}".`);
    },
    [setTasks, setEditingTask, showToast],
  );

  return {
    handleToggleTimer,
    handleResetTimer,
    handleFastForward5s,
    handleConfirmHabit,
    handleUpgradeTo66Days,
    handleConfirmYesterday,
    handleDiscardYesterday,
    handleSaveIdleTrimmed,
    handleDiscardIdle,
    handleTrimLatestSession,
    handleCompleteSprintSession,
    handleDeleteTask,
    handleUseShield,
    handleAcceptCompensation,
    handleResetToCheckpoint,
    handleFullResetStreak,
    handleAddTask,
    handleEditTask,
  };
}
