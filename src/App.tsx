/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  HeartPulse,
  Briefcase,
  BookOpen,
  Filter,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  Plus,
  Search,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';
import {
  TaskItem,
  TimeSession,
  HabitDailyLog,
  TaskCategory,
  TaskMode,
  UserAccount,
  RealtimeSyncPayload,
  RetroactiveConfirmation,
  getLogicalDate,
  getPreviousLogicalDate,
  calculateEarnedShields,
  calculateCheckpoint,
  countPendingSync,
  formatClockTime,
  formatDuration,
  getEffectiveTargetDurationMs,
  evaluateDailyRollover,
  getMillisecondsUntilRollover,
  mergeLocalAndCloudData,
} from './utils/engine';
import { soundEngine } from './utils/audio';
import {
  loadStoredData,
  saveStoredData,
  syncDataToCloud,
  fetchCloudData,
  getCleanStarterTasks,
  getInitialSeedTasks,
  exportFullBackupJSON,
  parseFullBackupJSON,
} from './utils/storage';
import { useWakeLock } from './utils/useWakeLock';
import { usePWAInstall } from './utils/usePWAInstall';
import { notificationService } from './utils/notifications';
import { realtimeManager } from './utils/realtime';
import { setupMediaSession } from './utils/mediaSession';

import { Header } from './components/Header';
import { CircularTaskNode } from './components/CircularTaskNode';
import { ProjectStatsModal } from './components/ProjectStatsModal';
import { StreakBreakModal } from './components/StreakBreakModal';
import { AddTaskModal } from './components/AddTaskModal';
import { AuthModal } from './components/AuthModal';
import { PWAInstallGuideModal } from './components/PWAInstallGuideModal';
import { DevTestToolbar } from './components/DevTestToolbar';
import { MilestoneUpgradeModal } from './components/MilestoneUpgradeModal';
import { RetroactiveConfirmModal } from './components/RetroactiveConfirmModal';
import { IdleDetectionModal } from './components/IdleDetectionModal';
import { ZenFocusModal } from './components/ZenFocusModal';

export default function App() {
  // App State
  const [dataLoaded, setDataLoaded] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [logs, setLogs] = useState<HabitDailyLog[]>([]);
  const [account, setAccount] = useState<UserAccount>({
    id: 'anon_init',
    email: null,
    isAnonymous: true,
    provider: 'anonymous',
    lastSyncedAtMs: null,
    createdAtMs: Date.now(),
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wakeLockRequested, setWakeLockRequested] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<'all' | TaskCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Realtime cross-tab state tracking
  const [lastRealtimeMessage, setLastRealtimeMessage] = useState<string | null>(null);

  // Notification API permission state
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >('default');

  // Modals state
  const [statsModalTaskId, setStatsModalTaskId] = useState<string | null>(null);
  const [breakStreakModalTaskId, setBreakStreakModalTaskId] = useState<string | null>(null);
  const [breakStreakMissedDays, setBreakStreakMissedDays] = useState<number>(1);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [zenFocusTaskId, setZenFocusTaskId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPWAGuideOpen, setIsPWAGuideOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Special Psychology Modals
  const [milestoneTask, setMilestoneTask] = useState<TaskItem | null>(null);
  const [retroactiveItem, setRetroactiveItem] = useState<RetroactiveConfirmation | null>(null);
  const [idleDetectionTask, setIdleDetectionTask] = useState<TaskItem | null>(null);
  const [idleRawDurationMs, setIdleRawDurationMs] = useState<number>(0);

  // PWA Installability hook
  const { isInstallable: isPWAInstallable, isIOS, promptInstall } = usePWAInstall();

  // Screen Wake Lock API integration
  const { isActive: wakeLockActive } = useWakeLock(wakeLockRequested);

  // Real-time clock tick for smooth SVG animation and tabular-nums timer
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());

  // Show auto-dismissing toast notification
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  }, []);

  // Load from local storage on mount + Run Daily Rollover & Retroactive checks
  useEffect(() => {
    const loaded = loadStoredData();
    const now = Date.now();
    const currentLogicalDate = getLogicalDate(now, 4);
    const yesterdayDate = getPreviousLogicalDate(currentLogicalDate);

    // Evaluate daily rollover (04:00 AM reset + automatic streak break detection)
    const rollover = evaluateDailyRollover(loaded.tasks, currentLogicalDate, now);
    const initialTasks = rollover.hasChanges ? rollover.updatedTasks : loaded.tasks;

    setTasks(initialTasks);
    setSessions(loaded.sessions);
    setLogs(loaded.logs);
    setAccount(loaded.account);
    setSoundEnabled(loaded.settings.soundEnabled);
    setWakeLockRequested(loaded.settings.wakeLockRequested);
    setDarkMode(!!loaded.settings.darkMode);
    setDevModeEnabled(!!loaded.settings.devModeEnabled);
    setIsSimulatedOffline(loaded.simulatedOffline);
    soundEngine.setMuted(!loaded.settings.soundEnabled);

    if (notificationService.isSupported()) {
      setNotificationPermission(notificationService.getPermission());
    }

    if (rollover.detectedBreak) {
      setBreakStreakModalTaskId(rollover.detectedBreak.taskId);
      setBreakStreakMissedDays(rollover.detectedBreak.missedDays);
    }

    // Check for Retroactive Confirmation (Habit finished yesterday but user fell asleep without confirming)
    const pendingYesterdayTask = initialTasks.find(
      (t) =>
        t.mode === 'habit' &&
        t.status === 'pending_confirmation' &&
        t.timerEndedAtMs &&
        t.timerEndedAtMs < now &&
        getLogicalDate(t.timerEndedAtMs, 4) === yesterdayDate
    );

    if (pendingYesterdayTask && pendingYesterdayTask.timerEndedAtMs) {
      setRetroactiveItem({
        taskId: pendingYesterdayTask.id,
        taskName: pendingYesterdayTask.name,
        endedAtMs: pendingYesterdayTask.timerEndedAtMs,
        logicalDate: yesterdayDate,
        accumulatedMs: pendingYesterdayTask.accumulatedMs,
      });
    }

    setDataLoaded(true);
  }, []);

  // Sync dark mode class on document.documentElement
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', darkMode);
    }
  }, [darkMode]);

  // Save to local storage whenever data changes
  useEffect(() => {
    if (!dataLoaded) return;
    saveStoredData(
      tasks,
      sessions,
      logs,
      {
        soundEnabled,
        wakeLockRequested,
        dayRolloverHour: 4,
        notificationsEnabled: notificationPermission === 'granted',
        darkMode,
        devModeEnabled,
      },
      account,
      isSimulatedOffline
    );
  }, [
    tasks,
    sessions,
    logs,
    soundEnabled,
    wakeLockRequested,
    darkMode,
    devModeEnabled,
    account,
    isSimulatedOffline,
    notificationPermission,
    dataLoaded,
  ]);

  // Background refresh on startup: pull any changes made on other devices
  useEffect(() => {
    if (!dataLoaded || account.isAnonymous || !account.email || isSimulatedOffline) {
      return;
    }
    fetchCloudData(account.email).then((cloud) => {
      if (cloud.found && cloud.data) {
        const merged = mergeLocalAndCloudData(
          { tasks, sessions, logs },
          cloud.data
        );
        setTasks(merged.tasks);
        setSessions(merged.sessions);
        setLogs(merged.logs);
      }
    }).catch((e) => console.warn('Background sync on mount failed', e));
  }, [account.email, account.isAnonymous, dataLoaded, isSimulatedOffline]);

  // Online auto-sync listener
  useEffect(() => {
    const handleOnline = () => {
      if (!account.isAnonymous && account.email && !isSimulatedOffline) {
        syncDataToCloud(account, { tasks, sessions, logs }, false).then((res) => {
          if (res.success) {
            setTasks(res.syncedTasks);
            setSessions(res.syncedSessions);
            setLogs(res.syncedLogs);
            setAccount(res.updatedAccount);
            showToast('🟢 Đã kết nối mạng trở lại & đồng bộ đám mây thành công.');
          }
        });
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [account, tasks, sessions, logs, isSimulatedOffline, showToast]);

  // Debounced auto-sync when tasks, sessions or logs change
  useEffect(() => {
    if (!dataLoaded || account.isAnonymous || !account.email || isSimulatedOffline || isSyncing) {
      return;
    }
    const hasPending =
      tasks.some((t) => t.sync_status === 1) ||
      sessions.some((s) => s.sync_status === 1) ||
      logs.some((l) => l.sync_status === 1);

    if (!hasPending) return;

    const timer = setTimeout(() => {
      syncDataToCloud(account, { tasks, sessions, logs }, false).then((res) => {
        if (res.success) {
          setTasks(res.syncedTasks);
          setSessions(res.syncedSessions);
          setLogs(res.syncedLogs);
          setAccount(res.updatedAccount);
        }
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [tasks, sessions, logs, account, isSimulatedOffline, isSyncing, dataLoaded]);

  // Delta-Timestamp Engine: Update current time tick & check live 04:00 AM rollover
  const currentLogicalDate = getLogicalDate(currentTimeMs, 4);

  useEffect(() => {
    if (!dataLoaded) return;
    const rollover = evaluateDailyRollover(tasks, currentLogicalDate, Date.now());
    if (rollover.hasChanges) {
      setTasks(rollover.updatedTasks);
      if (rollover.detectedBreak) {
        setBreakStreakModalTaskId(rollover.detectedBreak.taskId);
        setBreakStreakMissedDays(rollover.detectedBreak.missedDays);
      }
    }
  }, [currentLogicalDate, dataLoaded, tasks]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 150);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setCurrentTimeMs(Date.now());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Realtime Cross-Tab / Cross-Device Sync Listener
  useEffect(() => {
    const unsubscribe = realtimeManager.subscribe((payload: RealtimeSyncPayload) => {
      const timeStr = formatClockTime(payload.timestamp);

      if (payload.type === 'TIMER_START' && payload.taskId) {
        setLastRealtimeMessage(`[${timeStr}] Bắt đầu chạy tác vụ từ thiết bị khác`);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === payload.taskId
              ? {
                  ...t,
                  status: 'running',
                  startedAtMs: payload.startedAtMs || Date.now(),
                  accumulatedMs: payload.accumulatedMs ?? t.accumulatedMs,
                }
              : t
          )
        );
      } else if (payload.type === 'TIMER_PAUSE' && payload.taskId) {
        setLastRealtimeMessage(`[${timeStr}] Tạm dừng tác vụ từ thiết bị khác`);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === payload.taskId
              ? {
                  ...t,
                  status: 'paused',
                  startedAtMs: null,
                  accumulatedMs: payload.accumulatedMs ?? t.accumulatedMs,
                }
              : t
          )
        );
      } else if (payload.type === 'TIMER_RESET' && payload.taskId) {
        setLastRealtimeMessage(`[${timeStr}] Đặt lại tác vụ từ thiết bị khác`);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === payload.taskId
              ? {
                  ...t,
                  status: 'idle',
                  startedAtMs: null,
                  accumulatedMs: 0,
                }
              : t
          )
        );
      } else if (payload.type === 'HABIT_CONFIRM' && payload.taskId) {
        setLastRealtimeMessage(`[${timeStr}] Xác nhận hoàn thành thói quen từ thiết bị khác`);
        soundEngine.playSuccessChime();
        setTasks((prev) =>
          prev.map((t) =>
            t.id === payload.taskId
              ? {
                  ...t,
                  status: 'completed_today',
                  currentStreak: payload.newStreak ?? t.currentStreak + 1,
                  shields: payload.shields ?? t.shields,
                  inCompensationQuest: false,
                  startedAtMs: null,
                  accumulatedMs: getEffectiveTargetDurationMs(t),
                }
              : t
          )
        );
      } else if (payload.type === 'DATA_MERGE' && payload.dataSnapshot) {
        setLastRealtimeMessage(`[${timeStr}] Nhận gói dữ liệu đồng bộ đám mây`);
        setTasks(payload.dataSnapshot.tasks);
        setSessions(payload.dataSnapshot.sessions);
        setLogs(payload.dataSnapshot.logs);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Habit countdown completion detector: 00:00 -> PENDING_CONFIRMATION + FM Chime + Push Notification!
  useEffect(() => {
    tasks.forEach((task) => {
      if (task.mode === 'habit' && task.status === 'running' && task.startedAtMs !== null) {
        const effectiveTargetMs = getEffectiveTargetDurationMs(task);
        const elapsed = task.accumulatedMs + Math.max(0, currentTimeMs - task.startedAtMs);
        if (elapsed >= effectiveTargetMs) {
          soundEngine.playBellChime(523.25);

          notificationService.sendNotification(
            `🔥 Bền Bỉ: ${task.name} đã hoàn thành!`,
            'Đồng hồ đếm ngược đã chạm 00:00. Nhấn giữ 0.8 giây để xác nhận chuỗi của bạn.'
          );

          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    status: 'pending_confirmation',
                    accumulatedMs: getEffectiveTargetDurationMs(t),
                    startedAtMs: null,
                    timerEndedAtMs: currentTimeMs,
                    sync_status: 1,
                    updated_at_ms: Date.now(),
                  }
                : t
            )
          );
        }
      }
    });
  }, [currentTimeMs, tasks]);

  // Idle Timer Detection (> 180 min continuous session for Project mode)
  useEffect(() => {
    tasks.forEach((task) => {
      if (task.mode === 'project' && task.status === 'running' && task.startedAtMs !== null) {
        const continuousRunMs = currentTimeMs - task.startedAtMs;
        if (continuousRunMs >= 180 * 60 * 1000) {
          const totalRawMs = task.accumulatedMs + continuousRunMs;
          soundEngine.playSoftChime(440, 0.2, 0.5);

          setTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    status: 'paused',
                    startedAtMs: null,
                    accumulatedMs: totalRawMs,
                    isSuspectedIdle: true,
                    sync_status: 1,
                    updated_at_ms: Date.now(),
                  }
                : t
            )
          );

          setIdleDetectionTask(task);
          setIdleRawDurationMs(totalRawMs);
        }
      }
    });
  }, [currentTimeMs, tasks]);

  // Toggle Timer (Single Tap) with Atomic Local Write & Realtime Broadcast
  const handleToggleTimer = useCallback((taskId: string) => {
    const now = Date.now();
    setTasks((prev) => {
      let broadcastAction: 'TIMER_START' | 'TIMER_PAUSE' = 'TIMER_START';
      let targetStartedAt: number | null = now;
      let targetAccumulated: number = 0;

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
  }, []);

  // Media Session API: Bind lock screen controls to active running task
  const runningTask = tasks.find((t) => t.status === 'running') || null;
  useEffect(() => {
    setupMediaSession(runningTask, {
      onPlay: () => {
        if (runningTask) handleToggleTimer(runningTask.id);
      },
      onPause: () => {
        if (runningTask) handleToggleTimer(runningTask.id);
      },
    });
  }, [runningTask, handleToggleTimer]);

  // Reset Timer
  const handleResetTimer = useCallback((taskId: string) => {
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
          : t
      )
    );

    realtimeManager.publish({
      type: 'TIMER_RESET',
      taskId,
    });
  }, []);

  // Fast-Forward to 5s remaining (Testing Helper)
  const handleFastForward5s = useCallback((taskId: string) => {
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
      })
    );
  }, []);

  // Confirm Habit (After Long-Press 0.8s or confirmation button)
  const handleConfirmHabit = useCallback(
    (taskId: string) => {
      const now = Date.now();
      const logicalDate = getLogicalDate(now, 4);

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
            inCompensationQuest: false, // Clears x2 compensation quest, restoring base targetDurationMs for tomorrow!
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
        })
      );

      const targetTask = tasks.find((t) => t.id === taskId);
      const newLog: HabitDailyLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        taskId,
        logicalDate,
        completed: true,
        actualDurationMs:
          completedDurationMs || (targetTask ? getEffectiveTargetDurationMs(targetTask) : 0),
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
          : `🔥 Đã hoàn thành thói quen hôm nay! Chuỗi tăng lên ${updatedStreak} ngày.`
      );

      if (shouldTriggerMilestoneModal) {
        setMilestoneTask(shouldTriggerMilestoneModal);
      }
    },
    [tasks, showToast]
  );

  // Upgrade Habit to UCL 66-day milestone
  const handleUpgradeTo66Days = useCallback(
    (taskId: string) => {
      const now = Date.now();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                targetMilestoneDays: 66,
                sync_status: 1,
                updated_at_ms: now,
              }
            : t
        )
      );
      setMilestoneTask(null);
      soundEngine.playSuccessChime();
      showToast('🚀 Đã nâng cấp mục tiêu lên 66 ngày! Phản xạ thần kinh đang dần tự động hóa.');
    },
    [showToast]
  );

  const handleKeep30Days = useCallback(() => {
    setMilestoneTask(null);
  }, []);

  // Retroactive Confirmation Handlers
  const handleConfirmYesterday = useCallback(
    (taskId: string) => {
      const now = Date.now();
      const currentLogical = getLogicalDate(now, 4);
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
        })
      );

      const targetTask = tasks.find((t) => t.id === taskId);
      const newLog: HabitDailyLog = {
        id: `retro_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
    [tasks, showToast]
  );

  const handleDiscardYesterday = useCallback((taskId: string) => {
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
          : t
      )
    );
    setRetroactiveItem(null);
  }, []);

  // Idle Timer Resolution Handlers
  const handleSaveIdleTrimmed = useCallback(
    (taskId: string, trimmedDurationMs: number) => {
      const now = Date.now();
      const logicalDate = getLogicalDate(now, 4);
      soundEngine.playSuccessChime();

      setSessions((prev) => [
        {
          id: `idle_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
            : t
        )
      );

      setIdleDetectionTask(null);
      showToast(`Đã lưu phiên làm việc ${formatDuration(trimmedDurationMs, true)} sau khi cắt gọt.`);
    },
    [idleRawDurationMs, showToast]
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
            : t
        )
      );
      setIdleDetectionTask(null);
      showToast('Đã hủy phiên làm việc chạy quá giờ.');
    },
    [showToast]
  );

  // Trim Session for Project Mode
  const handleTrimLatestSession = useCallback((taskId: string, trimMinutes: number) => {
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
      })
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
          : s
      );
    });
  }, []);

  // Complete Sprint Session for Project Mode (works whether paused or currently running!)
  const handleCompleteSprintSession = useCallback(
    (taskId: string) => {
      const now = Date.now();
      const logicalDate = getLogicalDate(now, 4);
      soundEngine.playSuccessChime();

      const targetTask = tasks.find((t) => t.id === taskId);
      if (!targetTask) return;

      const runningDelta =
        targetTask.status === 'running' && targetTask.startedAtMs
          ? Math.max(0, now - targetTask.startedAtMs)
          : 0;
      const sessionDuration = targetTask.accumulatedMs + runningDelta;

      if (sessionDuration <= 0) return;

      setSessions((prev) => [
        {
          id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
            : t
        )
      );

      showToast(`✅ Đã chốt & lưu phiên làm việc ${formatDuration(sessionDuration)} vào nhật ký dự án.`);
    },
    [tasks, showToast]
  );

  // Delete Task (In-app confirmation handled inside ProjectStatsModal)
  const handleDeleteTask = useCallback(
    (taskId: string) => {
      soundEngine.playTap(false);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSessions((prev) => prev.filter((s) => s.taskId !== taskId));
      setLogs((prev) => prev.filter((l) => l.taskId !== taskId));
      setStatsModalTaskId(null);
      showToast('Đã xóa tác vụ thành công.');
    },
    [showToast]
  );

  // Streak Break Recoveries
  const handleUseShield = useCallback(
    (taskId: string) => {
      soundEngine.playSoftChime(587.33, 0.3, 0.8);
      const now = Date.now();
      const logicalDate = getLogicalDate(now, 4);
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
            : t
        )
      );

      const newLog: HabitDailyLog = {
        id: `shield_log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
    [breakStreakMissedDays, showToast]
  );

  const handleAcceptCompensation = useCallback(
    (taskId: string) => {
      soundEngine.playSoftChime(784, 0.3, 0.8);
      const now = Date.now();
      const logicalDate = getLogicalDate(now, 4);
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
            : t
        )
      );
      showToast('⚡ Đã kích hoạt Nhiệm vụ Đền bù x2 thời gian cho hôm nay!');
    },
    [showToast]
  );

  const handleResetToCheckpoint = useCallback(
    (taskId: string) => {
      soundEngine.playTap(false);
      const now = Date.now();
      const logicalDate = getLogicalDate(now, 4);
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
        })
      );
      showToast('Đã trở về cột mốc bảo lưu gần nhất.');
    },
    [showToast]
  );

  const handleFullResetStreak = useCallback(
    (taskId: string) => {
      soundEngine.playTap(false);
      const now = Date.now();
      const logicalDate = getLogicalDate(now, 4);
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
            : t
        )
      );
      showToast('Đã đặt lại chuỗi về Ngày 0.');
    },
    [showToast]
  );

  // Add Task with Max 24 limit enforcement
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
      >
    ) => {
      if (tasks.length >= 24) {
        showToast('⚠️ Đã đạt giới hạn tối đa 24 tác vụ. Vui lòng hoàn tất hoặc xóa bớt tác vụ.');
        return;
      }

      soundEngine.playSoftChime(659.25, 0.25, 0.5);
      const now = Date.now();
      const newTask: TaskItem = {
        ...newTaskData,
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
      showToast(`Đã tạo tác vụ "${newTask.name}".`);
    },
    [tasks.length, showToast]
  );

  // Edit Existing Task
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
      }
    ) => {
      const now = Date.now();
      soundEngine.playSoftChime(659.25, 0.2, 0.4);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                ...updates,
                sync_status: 1,
                updated_at_ms: now,
              }
            : t
        )
      );
      setEditingTask(null);
      showToast(`Đã cập nhật tác vụ "${updates.name}".`);
    },
    [showToast]
  );

  // Backup & Restore JSON + Starter Reset Handlers
  const handleExportBackupJSON = useCallback(() => {
    const json = exportFullBackupJSON(tasks, sessions, logs, {
      soundEnabled,
      wakeLockRequested,
      dayRolloverHour: 4,
      notificationsEnabled: notificationPermission === 'granted',
      darkMode,
      devModeEnabled,
    });
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ben-bi-backup-${getLogicalDate(Date.now(), 4)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📦 Đã tải xuống file sao lưu dữ liệu (.json) thành công!');
  }, [
    tasks,
    sessions,
    logs,
    soundEnabled,
    wakeLockRequested,
    notificationPermission,
    darkMode,
    devModeEnabled,
    showToast,
  ]);

  const handleImportBackupJSON = useCallback(
    (jsonStr: string): boolean => {
      const parsed = parseFullBackupJSON(jsonStr);
      if (!parsed) return false;
      setTasks(parsed.tasks);
      setSessions(parsed.sessions);
      setLogs(parsed.logs);
      if (parsed.settings) {
        if (parsed.settings.darkMode !== undefined) setDarkMode(parsed.settings.darkMode);
        if (parsed.settings.soundEnabled !== undefined) {
          setSoundEnabled(parsed.settings.soundEnabled);
          soundEngine.setMuted(!parsed.settings.soundEnabled);
        }
      }
      soundEngine.playSuccessChime();
      showToast('✅ Đã khôi phục toàn bộ dữ liệu từ bản sao lưu!');
      return true;
    },
    [showToast]
  );

  const handleResetToCleanStarter = useCallback(() => {
    const clean = getCleanStarterTasks();
    setTasks(clean.tasks);
    setSessions(clean.sessions);
    setLogs(clean.logs);
    soundEngine.playSoftChime(523.25, 0.25, 0.5);
    showToast('🌱 Đã đặt lại toàn bộ chuỗi về Ngày 0 để bạn bắt đầu hành trình thực tế!');
  }, [showToast]);

  const handleLoadDemoSeed = useCallback(() => {
    const seed = getInitialSeedTasks();
    setTasks(seed.tasks);
    setSessions(seed.sessions);
    setLogs(seed.logs);
    soundEngine.playSoftChime(659.25, 0.25, 0.5);
    showToast('✨ Đã nạp bộ dữ liệu mẫu 21 ngày để trải nghiệm tính năng!');
  }, [showToast]);

  // Cloud Sync Handler (Converts sync_status = 1 -> 0)
  const handleTriggerSyncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const result = await syncDataToCloud(account, { tasks, sessions, logs }, isSimulatedOffline);
      if (result.success) {
        setTasks(result.syncedTasks);
        setSessions(result.syncedSessions);
        setLogs(result.syncedLogs);
        setAccount(result.updatedAccount);
        soundEngine.playSoftChime(880, 0.15, 0.3);
        showToast(result.message);

        realtimeManager.publish({
          type: 'DATA_MERGE',
          dataSnapshot: {
            tasks: result.syncedTasks,
            sessions: result.syncedSessions,
            logs: result.syncedLogs,
          },
        });
      } else {
        showToast(result.message);
      }
    } catch (e) {
      console.warn('Sync failed:', e);
      showToast('Đồng bộ thất bại. Vui lòng kiểm tra kết nối.');
    } finally {
      setIsSyncing(false);
    }
  }, [account, tasks, sessions, logs, isSimulatedOffline, isSyncing, showToast]);

  // Auth: Email Login & Cross-Device Cloud Sync
  const handleLoginSuccess = useCallback(
    async (
      email: string,
      provider: 'email_sync' | 'mock_otp' | 'supabase' = 'email_sync',
      supabaseUrl?: string,
      supabaseAnonKey?: string
    ) => {
      const normalizedEmail = email.trim().toLowerCase();
      setIsSyncing(true);

      try {
        // Step 1: Check if this email already has data in Vercel Blob cloud
        const cloudResult = await fetchCloudData(normalizedEmail);

        let finalTasks = tasks;
        let finalSessions = sessions;
        let finalLogs = logs;

        const updatedAccount: UserAccount = {
          id: `user_${normalizedEmail.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          email: normalizedEmail,
          isAnonymous: false,
          provider,
          supabaseUrl,
          supabaseAnonKey,
          lastSyncedAtMs: Date.now(),
          createdAtMs: account.createdAtMs || Date.now(),
        };

        if (cloudResult.found && cloudResult.data) {
          // Cloud data exists! Intelligently merge local + cloud
          const merged = mergeLocalAndCloudData(
            { tasks, sessions, logs },
            cloudResult.data
          );
          finalTasks = merged.tasks;
          finalSessions = merged.sessions;
          finalLogs = merged.logs;

          setTasks(finalTasks);
          setSessions(finalSessions);
          setLogs(finalLogs);
          setAccount(updatedAccount);
          soundEngine.playSuccessChime();

          showToast(
            `🎉 Chào mừng trở lại! Đã khôi phục thành công ${finalTasks.length} tác vụ từ tài khoản ${normalizedEmail}.`
          );

          // Push merged snapshot back to ensure cloud is fresh
          await syncDataToCloud(
            updatedAccount,
            { tasks: finalTasks, sessions: finalSessions, logs: finalLogs },
            isSimulatedOffline
          );
        } else {
          // First time this email logs in: upload current local tasks to cloud!
          setAccount(updatedAccount);
          soundEngine.playSuccessChime();

          const syncRes = await syncDataToCloud(
            updatedAccount,
            { tasks, sessions, logs },
            isSimulatedOffline
          );
          if (syncRes.success) {
            setTasks(syncRes.syncedTasks);
            setSessions(syncRes.syncedSessions);
            setLogs(syncRes.syncedLogs);
            setAccount(syncRes.updatedAccount);
            showToast(
              `✨ Đã kích hoạt tài khoản ${normalizedEmail} & bảo vệ toàn bộ dữ liệu trên đám mây!`
            );
          } else {
            showToast(`Đã liên kết email ${normalizedEmail}. Dữ liệu đang được lưu an toàn.`);
          }
        }
      } catch (err) {
        console.error('Login sync error:', err);
        showToast('Có lỗi xảy ra khi đồng bộ đám mây. Vui lòng thử lại.');
      } finally {
        setIsSyncing(false);
      }
    },
    [account, tasks, sessions, logs, isSimulatedOffline, showToast]
  );

  // Auth: Logout
  const handleLogout = useCallback(() => {
    const anonymousAccount: UserAccount = {
      id: `anon_${Math.random().toString(36).substring(2, 10)}`,
      email: null,
      isAnonymous: true,
      provider: 'anonymous',
      lastSyncedAtMs: null,
      createdAtMs: Date.now(),
    };
    setAccount(anonymousAccount);
    soundEngine.playTap(false);
    showToast('Đã đăng xuất. Dữ liệu trên thiết bị vẫn được bảo toàn.');
  }, [showToast]);

  // Request Notification Permission
  const handleRequestNotificationPermission = useCallback(async () => {
    const result = await notificationService.requestPermission();
    setNotificationPermission(result);
    if (result === 'granted') {
      notificationService.sendNotification(
        '🔔 Bền Bỉ Tới Cùng',
        'Đã bật thông báo thành công! Bạn sẽ nhận được chuông báo khi hoàn thành thói quen.'
      );
      showToast('Đã cấp quyền thông báo hệ thống.');
    } else {
      showToast('Quyền thông báo bị từ chối.');
    }
  }, [showToast]);

  const handleTestNotification = useCallback(() => {
    notificationService.sendNotification(
      '🔔 Thử nghiệm thông báo Bền Bỉ',
      'Hệ thống thông báo đẩy đang hoạt động hoàn hảo ngay cả khi khóa màn hình.'
    );
    soundEngine.playSoftChime(659.25, 0.25, 0.4);
    showToast('Đã bắn thông báo thử nghiệm.');
  }, [showToast]);

  const handleBroadcastTestEvent = useCallback(() => {
    const now = Date.now();
    realtimeManager.publish({
      type: 'TIMER_START',
      taskId: tasks[0]?.id || 'test_task',
      startedAtMs: now,
      accumulatedMs: 0,
    });
    setLastRealtimeMessage(`[${formatClockTime(now)}] Đã phát gói tin test từ thiết bị này`);
    showToast('Đã phát gói tin Realtime Broadcast sang các tab/thiết bị khác.');
  }, [tasks, showToast]);

  // DevTestToolbar Triggers
  const handleTestMilestone30 = useCallback(() => {
    const habitTask = tasks.find((t) => t.mode === 'habit') || tasks[0];
    if (habitTask) {
      setMilestoneTask({
        ...habitTask,
        currentStreak: 30,
        bestStreak: Math.max(habitTask.bestStreak, 30),
        targetMilestoneDays: 30,
      });
    }
  }, [tasks]);

  const handleTestRetroactiveConfirm = useCallback(() => {
    const habitTask = tasks.find((t) => t.mode === 'habit') || tasks[0];
    if (habitTask) {
      const now = Date.now();
      const yesterdayDate = getPreviousLogicalDate(getLogicalDate(now, 4));
      setRetroactiveItem({
        taskId: habitTask.id,
        taskName: habitTask.name,
        endedAtMs: now - 8 * 3600 * 1000,
        logicalDate: yesterdayDate,
        accumulatedMs: habitTask.targetDurationMs,
      });
    }
  }, [tasks]);

  const handleTestIdleDetection = useCallback(() => {
    const projectTask = tasks.find((t) => t.mode === 'project') || tasks[0];
    if (projectTask) {
      setIdleDetectionTask(projectTask);
      setIdleRawDurationMs(195 * 60 * 1000);
    }
  }, [tasks]);

  const handleTestStreakBreak1Day = useCallback(() => {
    const habitTask = tasks.find((t) => t.mode === 'habit') || tasks[0];
    if (habitTask) {
      setBreakStreakModalTaskId(habitTask.id);
      setBreakStreakMissedDays(1);
    }
  }, [tasks]);

  const handleTestStreakBreak2Days = useCallback(() => {
    const habitTask = tasks.find((t) => t.mode === 'habit') || tasks[0];
    if (habitTask) {
      setBreakStreakModalTaskId(habitTask.id);
      setBreakStreakMissedDays(2);
    }
  }, [tasks]);

  // Toggle Sound
  const handleToggleSound = useCallback(() => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    soundEngine.setMuted(!nextVal);
    if (nextVal) {
      soundEngine.playSoftChime(523.25, 0.2, 0.3);
    }
  }, [soundEnabled]);

  // Toggle Wake Lock
  const handleToggleWakeLock = useCallback(() => {
    setWakeLockRequested((prev) => !prev);
  }, []);

  // Global counts & Daily Command Center Metrics
  const totalShields = tasks.reduce((acc, t) => acc + t.shields, 0);
  const totalActiveStreaks = tasks.filter((t) => t.currentStreak > 0).length;
  const pendingSyncCount = countPendingSync(tasks, sessions, logs);

  const habitTasks = tasks.filter((t) => t.mode === 'habit');
  const completedHabitsToday = habitTasks.filter((t) => t.status === 'completed_today').length;
  const dailyHabitProgressPercent =
    habitTasks.length > 0 ? Math.round((completedHabitsToday / habitTasks.length) * 100) : 0;

  // Total focused minutes today (across logs, sessions, and active timers)
  const todayLogsMs = logs
    .filter((l) => l.logicalDate === currentLogicalDate && l.completed)
    .reduce((sum, l) => sum + (l.actualDurationMs || 0), 0);
  const todaySessionsMs = sessions
    .filter((s) => s.logicalDate === currentLogicalDate)
    .reduce((sum, s) => sum + s.durationMs, 0);
  const activeTimersMs = tasks
    .filter((t) => t.status !== 'completed_today')
    .reduce((sum, t) => {
      const runningDelta =
        t.status === 'running' && t.startedAtMs ? Math.max(0, currentTimeMs - t.startedAtMs) : 0;
      return sum + t.accumulatedMs + runningDelta;
    }, 0);
  const totalFocusedTodayMinutes = Math.round((todayLogsMs + todaySessionsMs + activeTimersMs) / 60000);

  const highestStreak = tasks.reduce((max, t) => Math.max(max, t.currentStreak), 0);
  const msUntilRollover = getMillisecondsUntilRollover(currentTimeMs, 4);
  const hoursUntilRollover = Math.floor(msUntilRollover / 3600000);
  const minsUntilRollover = Math.floor((msUntilRollover % 3600000) / 60000);

  // Filter & Sort tasks (Running first -> Pending confirmation -> Active/Idle -> Completed Today)
  const filteredTasks = tasks
    .filter((t) => {
      if (currentCategory !== 'all' && t.category !== currentCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) || (t.notes && t.notes.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      const priority = (status: TaskItem['status']) => {
        if (status === 'running') return 0;
        if (status === 'pending_confirmation') return 1;
        if (status === 'paused') return 2;
        if (status === 'idle') return 3;
        return 4; // completed_today
      };
      return priority(a.status) - priority(b.status);
    });

  const selectedStatsTask = tasks.find((t) => t.id === statsModalTaskId);
  const selectedBreakStreakTask = tasks.find((t) => t.id === breakStreakModalTaskId);
  const selectedZenTask = tasks.find((t) => t.id === zenFocusTaskId) || null;

  return (
    <div
      className={`min-h-screen flex flex-col font-sans selection:bg-[#FF6B00] selection:text-white pb-24 transition-colors ${
        darkMode ? 'bg-[#0B1324] text-slate-100' : 'bg-[#F4F7FA] text-slate-800'
      }`}
    >
      {/* Top Header */}
      <Header
        wakeLockActive={wakeLockActive}
        wakeLockRequested={wakeLockRequested}
        onToggleWakeLock={handleToggleWakeLock}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        devModeEnabled={devModeEnabled}
        onToggleDevMode={() => {
          const next = !devModeEnabled;
          setDevModeEnabled(next);
          showToast(
            next
              ? '🧪 Đã bật Chế độ Nhà phát triển (Dev/Test Toolbar).'
              : '✨ Đã ẩn công cụ kiểm thử (Giao diện chuẩn Production).'
          );
        }}
        totalShields={totalShields}
        totalActiveStreaks={totalActiveStreaks}
        onOpenAddTask={() => {
          setEditingTask(null);
          setIsAddTaskModalOpen(true);
        }}
        onTestSound={() => soundEngine.playBellChime(523.25)}
        account={account}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        pendingSyncCount={pendingSyncCount}
        isSimulatedOffline={isSimulatedOffline}
        onTriggerSyncNow={handleTriggerSyncNow}
        isSyncing={isSyncing}
        isPWAInstallable={isPWAInstallable}
        onPromptInstall={promptInstall}
        onOpenPWAGuide={() => setIsPWAGuideOpen(true)}
      />

      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="sticky top-16 z-40 max-w-xl mx-auto w-full px-4 mt-2">
          <div className="bg-[#1E3A5F] text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-[#3B6998] flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FCC934] shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-white/70 hover:text-white font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 pt-5 sm:pt-6 flex-1">
        {/* Daily Command Center Banner */}
        <section
          aria-label="Tổng quan tiến độ kỷ luật hôm nay"
          className={`mb-6 rounded-2xl p-4 sm:p-5 border shadow-xs transition-colors ${
            darkMode
              ? 'bg-slate-900/90 border-slate-800 text-slate-100'
              : 'bg-white border-slate-200/90 text-slate-800'
          }`}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Metric 1: Daily Habit Progress */}
            <div
              className={`p-3.5 rounded-xl border ${
                darkMode
                  ? 'bg-slate-800/70 border-slate-700/80'
                  : 'bg-[#F4F7FA] border-slate-200/70'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#81C995]" />
                  <span>Thói quen hôm nay</span>
                </span>
                <span className="font-mono font-bold text-[#FF6B00]">
                  {dailyHabitProgressPercent}%
                </span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-black font-mono tabular-nums">
                  {completedHabitsToday}/{habitTasks.length}
                </span>
                <span className="text-[11px] text-slate-400">đã hoàn tất</span>
              </div>
              <div className="mt-2 w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FF6B00] to-[#81C995] transition-all duration-500"
                  style={{ width: `${dailyHabitProgressPercent}%` }}
                />
              </div>
            </div>

            {/* Metric 2: Total Focused Time Today */}
            <div
              className={`p-3.5 rounded-xl border ${
                darkMode
                  ? 'bg-slate-800/70 border-slate-700/80'
                  : 'bg-[#F4F7FA] border-slate-200/70'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <TrendingUp className="w-3.5 h-3.5 text-[#3B6998]" />
                <span>Tổng tập trung hôm nay</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono tabular-nums">
                  {totalFocusedTodayMinutes}
                </span>
                <span className="text-xs font-semibold text-slate-400">phút</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {(totalFocusedTodayMinutes / 60).toFixed(1)} giờ tích lũy trong ngày
              </div>
            </div>

            {/* Metric 3: Highest Active Streak */}
            <div
              className={`p-3.5 rounded-xl border ${
                darkMode
                  ? 'bg-slate-800/70 border-slate-700/80'
                  : 'bg-[#F4F7FA] border-slate-200/70'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <Flame className="w-3.5 h-3.5 text-[#FF6B00] fill-[#FF6B00]" />
                <span>Chuỗi dẫn đầu</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[#FF6B00]">
                  {highestStreak}
                </span>
                <span className="text-xs font-semibold text-slate-400">ngày liên tiếp</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Đang duy trì {totalActiveStreaks} chuỗi</span>
                {highestStreak > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="text-[#3B6998] dark:text-sky-400 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                    title="Đặt lại về Ngày 0 hoặc Sao lưu dữ liệu"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Đặt lại</span>
                  </button>
                )}
              </div>
            </div>

            {/* Metric 4: Biological Rollover Countdown (04:00 AM) */}
            <div
              className={`p-3.5 rounded-xl border ${
                darkMode
                  ? 'bg-slate-800/70 border-slate-700/80'
                  : 'bg-[#F4F7FA] border-slate-200/70'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5 text-[#FCC934]" />
                <span>Quỹ thời gian ngày sinh học</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black font-mono tabular-nums">
                  {hoursUntilRollover}g {String(minsUntilRollover).padStart(2, '0')}p
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Chuyển sang ngày mới lúc 04:00 sáng
              </div>
            </div>
          </div>
        </section>

        {/* Category Filter Tabs & Search Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div
            className={`flex items-center gap-1.5 p-1 rounded-xl border shadow-2xs overflow-x-auto max-w-full ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
            }`}
          >
            <button
              type="button"
              onClick={() => setCurrentCategory('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                currentCategory === 'all'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : darkMode
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tất cả</span>
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-white/20">
                {tasks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentCategory('health')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                currentCategory === 'health'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : darkMode
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
              <span>Sức khoẻ</span>
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full ${
                  darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tasks.filter((t) => t.category === 'health').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentCategory('work')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                currentCategory === 'work'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : darkMode
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-[#3B6998]" />
              <span>Công việc</span>
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full ${
                  darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tasks.filter((t) => t.category === 'work').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentCategory('study')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                currentCategory === 'study'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : darkMode
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span>Học hành</span>
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full ${
                  darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tasks.filter((t) => t.category === 'study').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentCategory('habit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                currentCategory === 'habit'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : darkMode
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>Thói quen</span>
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full ${
                  darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tasks.filter((t) => t.category === 'habit').length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative flex-1 sm:w-52">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm tác vụ..."
                className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-[#FF6B00] ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500'
                    : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
                }`}
              />
            </div>

            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono border flex items-center gap-1.5 shrink-0 ${
                tasks.length >= 24
                  ? 'bg-red-50 text-red-700 border-red-300'
                  : darkMode
                  ? 'bg-slate-900 text-sky-300 border-slate-800'
                  : 'bg-[#E8F0FE] text-[#1E3A5F] border-[#3B6998]/30'
              }`}
            >
              <span>{tasks.length}/24</span>
            </div>
          </div>
        </div>

        {/* Task Grid */}
        {filteredTasks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {filteredTasks.map((task) => (
              <CircularTaskNode
                key={task.id}
                task={task}
                currentTimeMs={currentTimeMs}
                devModeEnabled={devModeEnabled}
                darkMode={darkMode}
                onToggleTimer={handleToggleTimer}
                onResetTimer={handleResetTimer}
                onConfirmHabit={handleConfirmHabit}
                onCompleteSprintSession={handleCompleteSprintSession}
                onOpenProjectStats={(id) => setStatsModalTaskId(id)}
                onOpenEditTask={(t) => {
                  setEditingTask(t);
                  setIsAddTaskModalOpen(true);
                }}
                onOpenZenFocus={(id) => setZenFocusTaskId(id)}
                onSimulateBreakStreak={(id) => {
                  setBreakStreakModalTaskId(id);
                  setBreakStreakMissedDays(1);
                }}
                onFastForward5s={handleFastForward5s}
              />
            ))}
          </div>
        ) : (
          <div
            className={`rounded-2xl p-12 text-center border ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-[#E8F0FE] text-[#1E3A5F] flex items-center justify-center mx-auto mb-3">
              <Filter className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm">
              {searchQuery
                ? `Không tìm thấy tác vụ nào khớp với "${searchQuery}"`
                : 'Chưa có tác vụ nào trong danh mục này'}
            </h3>
            <button
              type="button"
              disabled={tasks.length >= 24}
              onClick={() => {
                setEditingTask(null);
                setIsAddTaskModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#E65100] disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm tác vụ mới</span>
            </button>
          </div>
        )}
      </main>

      {/* 3-Tier Deep Report & Share Card Modal */}
      {selectedStatsTask && (
        <ProjectStatsModal
          task={selectedStatsTask}
          sessions={sessions}
          logs={logs}
          userEmail={account.email}
          isOpen={!!statsModalTaskId}
          onClose={() => setStatsModalTaskId(null)}
          onTrimLatestSession={handleTrimLatestSession}
          onCompleteSprintSession={handleCompleteSprintSession}
          onDeleteTask={handleDeleteTask}
          onEditTask={(t) => {
            setEditingTask(t);
            setIsAddTaskModalOpen(true);
          }}
        />
      )}

      {/* Zen Focus Fullscreen Modal */}
      <ZenFocusModal
        task={selectedZenTask}
        isOpen={!!zenFocusTaskId}
        currentTimeMs={currentTimeMs}
        onClose={() => setZenFocusTaskId(null)}
        onToggleTimer={handleToggleTimer}
        onConfirmHabit={handleConfirmHabit}
        onCompleteSprintSession={handleCompleteSprintSession}
      />

      {selectedBreakStreakTask && (
        <StreakBreakModal
          task={selectedBreakStreakTask}
          isOpen={!!breakStreakModalTaskId}
          missedDays={breakStreakMissedDays}
          onClose={() => setBreakStreakModalTaskId(null)}
          onUseShield={handleUseShield}
          onAcceptCompensation={handleAcceptCompensation}
          onResetToCheckpoint={handleResetToCheckpoint}
          onFullReset={handleFullResetStreak}
        />
      )}

      {milestoneTask && (
        <MilestoneUpgradeModal
          task={milestoneTask}
          isOpen={!!milestoneTask}
          onUpgrade={handleUpgradeTo66Days}
          onKeep={handleKeep30Days}
        />
      )}

      {retroactiveItem && (
        <RetroactiveConfirmModal
          item={retroactiveItem}
          isOpen={!!retroactiveItem}
          onConfirmYesterday={handleConfirmYesterday}
          onDiscard={handleDiscardYesterday}
        />
      )}

      {idleDetectionTask && (
        <IdleDetectionModal
          task={idleDetectionTask}
          isOpen={!!idleDetectionTask}
          rawDurationMs={idleRawDurationMs}
          onSaveTrimmed={handleSaveIdleTrimmed}
          onDiscard={handleDiscardIdle}
        />
      )}

      <AddTaskModal
        isOpen={isAddTaskModalOpen}
        onClose={() => {
          setIsAddTaskModalOpen(false);
          setEditingTask(null);
        }}
        onAddTask={handleAddTask}
        editingTask={editingTask}
        onEditTask={handleEditTask}
        taskCount={tasks.length}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        account={account}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
        onTriggerSyncNow={handleTriggerSyncNow}
        isSyncing={isSyncing}
        onExportBackupJSON={handleExportBackupJSON}
        onImportBackupJSON={handleImportBackupJSON}
        onResetToCleanStarter={handleResetToCleanStarter}
        onLoadDemoSeed={handleLoadDemoSeed}
      />

      <PWAInstallGuideModal
        isOpen={isPWAGuideOpen}
        onClose={() => setIsPWAGuideOpen(false)}
        isInstallable={isPWAInstallable}
        onTriggerNativeInstall={promptInstall}
        isIOS={isIOS}
      />

      {/* DevTestToolbar only visible when Dev Mode is enabled */}
      {devModeEnabled && (
        <DevTestToolbar
          isSimulatedOffline={isSimulatedOffline}
          onToggleSimulatedOffline={() => {
            setIsSimulatedOffline((prev) => !prev);
            showToast(
              !isSimulatedOffline
                ? 'Đã chuyển sang chế độ Mất mạng (Offline).'
                : 'Đã khôi phục kết nối mạng (Online).'
            );
          }}
          pendingSyncCount={pendingSyncCount}
          onTriggerSyncNow={handleTriggerSyncNow}
          isSyncing={isSyncing}
          onBroadcastTestEvent={handleBroadcastTestEvent}
          lastRealtimeEventMessage={lastRealtimeMessage}
          onTestNotification={handleTestNotification}
          notificationPermission={notificationPermission}
          onRequestNotificationPermission={handleRequestNotificationPermission}
          onOpenPWAGuide={() => setIsPWAGuideOpen(true)}
          isPWAInstallable={isPWAInstallable}
          onTestMilestone30={handleTestMilestone30}
          onTestRetroactiveConfirm={handleTestRetroactiveConfirm}
          onTestIdleDetection={handleTestIdleDetection}
          onTestStreakBreak1Day={handleTestStreakBreak1Day}
          onTestStreakBreak2Days={handleTestStreakBreak2Days}
        />
      )}
    </div>
  );
}
