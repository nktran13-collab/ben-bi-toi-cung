/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  HeartPulse,
  Briefcase,
  BookOpen,
  Filter,
  CheckCircle2,
  Clock,
  Flame,
  Shield,
  Layers,
  HelpCircle,
  Plus,
  Cloud,
  CloudOff,
  Radio,
  Bell,
  Smartphone,
  Award,
} from 'lucide-react';
import {
  TaskItem,
  TimeSession,
  HabitDailyLog,
  TaskCategory,
  UserAccount,
  RealtimeSyncPayload,
  RetroactiveConfirmation,
  getLogicalDate,
  getPreviousLogicalDate,
  calculateEarnedShields,
  calculateCheckpoint,
  countPendingSync,
  formatClockTime,
  calculateExpectedEndTimestamp,
  formatDuration,
} from './utils/engine';
import { soundEngine } from './utils/audio';
import { loadStoredData, saveStoredData, syncDataToCloud } from './utils/storage';
import { useWakeLock } from './utils/useWakeLock';
import { usePWAInstall } from './utils/usePWAInstall';
import { notificationService } from './utils/notifications';
import { realtimeManager, CURRENT_DEVICE_ID } from './utils/realtime';
import { setupMediaSession } from './utils/mediaSession';
import { Analytics } from '@vercel/analytics/react';

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
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<'all' | TaskCategory>('all');
  const [isSyncing, setIsSyncing] = useState(false);

  // Realtime cross-tab state tracking
  const [lastRealtimeMessage, setLastRealtimeMessage] = useState<string | null>(null);

  // Notification API permission state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');

  // Modals state
  const [statsModalTaskId, setStatsModalTaskId] = useState<string | null>(null);
  const [breakStreakModalTaskId, setBreakStreakModalTaskId] = useState<string | null>(null);
  const [breakStreakMissedDays, setBreakStreakMissedDays] = useState<number>(1);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPWAGuideOpen, setIsPWAGuideOpen] = useState(false);
  const [showInfoBanner, setShowInfoBanner] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Phase 3 Special Modals
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

  // Load from local storage on mount
  useEffect(() => {
    const loaded = loadStoredData();
    setTasks(loaded.tasks);
    setSessions(loaded.sessions);
    setLogs(loaded.logs);
    setAccount(loaded.account);
    setSoundEnabled(loaded.settings.soundEnabled);
    setWakeLockRequested(loaded.settings.wakeLockRequested);
    setIsSimulatedOffline(loaded.simulatedOffline);
    soundEngine.setMuted(!loaded.settings.soundEnabled);

    if (notificationService.isSupported()) {
      setNotificationPermission(notificationService.getPermission());
    }

    // Check for Retroactive Confirmation (Habit finished yesterday but user fell asleep without confirming)
    const now = Date.now();
    const currentLogicalDate = getLogicalDate(now, 4);
    const yesterdayDate = getPreviousLogicalDate(currentLogicalDate);

    const pendingYesterdayTask = loaded.tasks.find(
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
      },
      account,
      isSimulatedOffline
    );
  }, [tasks, sessions, logs, soundEnabled, wakeLockRequested, account, isSimulatedOffline, notificationPermission, dataLoaded]);

  // Delta-Timestamp Engine: Update current time tick
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
                  startedAtMs: null,
                  accumulatedMs: t.targetDurationMs,
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
        const elapsed = task.accumulatedMs + Math.max(0, currentTimeMs - task.startedAtMs);
        if (elapsed >= task.targetDurationMs) {
          // Reached 00:00!
          soundEngine.playBellChime(523.25);

          // Trigger System Notification
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
                    accumulatedMs: t.targetDurationMs,
                    startedAtMs: null,
                    timerEndedAtMs: currentTimeMs,
                    sync_status: 1, // Atomic local write
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
          // Exceeded 180 minutes! Auto pause and trigger Idle Warning dialog
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
  }, [runningTask]);

  // Toggle Timer (Single Tap) with Atomic Local Write & Realtime Broadcast
  const handleToggleTimer = useCallback(
    (taskId: string) => {
      const now = Date.now();
      setTasks((prev) => {
        let broadcastAction: 'TIMER_START' | 'TIMER_PAUSE' = 'TIMER_START';
        let targetStartedAt: number | null = now;
        let targetAccumulated: number = 0;

        const updated: TaskItem[] = prev.map((t): TaskItem => {
          if (t.id !== taskId) return t;

          if (t.status === 'running') {
            // Pause
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
              sync_status: 1, // Pending sync
              updated_at_ms: now,
            };
          } else {
            // Start
            soundEngine.playTap(true);
            broadcastAction = 'TIMER_START';
            targetAccumulated = t.accumulatedMs;
            targetStartedAt = now;

            // If Habit, schedule Web Push notification
            if (t.mode === 'habit') {
              const remainingMs = Math.max(0, t.targetDurationMs - targetAccumulated);
              notificationService.scheduleHabitEndPush(t.id, t.name, remainingMs);
            }

            return {
              ...t,
              status: 'running',
              startedAtMs: now,
              sync_status: 1, // Pending sync
              updated_at_ms: now,
            };
          }
        });

        // Publish to other tabs in Realtime
        realtimeManager.publish({
          type: broadcastAction,
          taskId,
          startedAtMs: targetStartedAt,
          accumulatedMs: targetAccumulated,
        });

        return updated;
      });
    },
    []
  );

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
        const targetRemainMs = 5000;
        const newAccumulated = Math.max(0, t.targetDurationMs - targetRemainMs);

        // Schedule push for 5 seconds
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

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const newStreak = t.currentStreak + 1;
          const newBest = Math.max(t.bestStreak, newStreak);
          targetMilestone = t.targetMilestoneDays || 30;

          // Shield Economy: +1 every 7 days, max capped by milestone (2 for 30d, 3 for 66d)
          const { newShields, earned } = calculateEarnedShields(newStreak, t.shields, targetMilestone);
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
            timerEndedAtMs: undefined,
            sync_status: 1, // Atomic write
            updated_at_ms: now,
          };

          // Check UCL 30-Day Milestone Upgrade
          if (newStreak === 30 && targetMilestone === 30) {
            shouldTriggerMilestoneModal = updatedTask;
          }

          if (earned) {
            showToast(`🛡️ Bạn vừa được thưởng +1 Khiên Bền Bỉ vì chuỗi ${newStreak} ngày!`);
          }

          return updatedTask;
        })
      );

      // Add Habit Log with UUID and sync_status = 1
      const newLog: HabitDailyLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        taskId,
        logicalDate,
        completed: true,
        actualDurationMs: tasks.find((t) => t.id === taskId)?.targetDurationMs || 0,
        confirmedAt: now,
        recoveryType: 'on_time',
        sync_status: 1,
        updated_at_ms: now,
      };
      setLogs((prev) => [newLog, ...prev]);

      // Broadcast habit confirmation
      realtimeManager.publish({
        type: 'HABIT_CONFIRM',
        taskId,
        newStreak: updatedStreak,
        shields: updatedShields,
      });

      showToast(`🔥 Đã hoàn thành thói quen hôm nay! Chuỗi tăng lên ${updatedStreak} ngày.`);

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

  const handleKeep30Days = useCallback((taskId: string) => {
    setMilestoneTask(null);
  }, []);

  // Retroactive Confirmation Handlers
  const handleConfirmYesterday = useCallback(
    (taskId: string) => {
      const now = Date.now();
      const currentLogicalDate = getLogicalDate(now, 4);
      const yesterdayDate = getPreviousLogicalDate(currentLogicalDate);

      soundEngine.playSuccessChime();

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const newStreak = t.currentStreak + 1;
          const targetMilestone = t.targetMilestoneDays || 30;
          const { newShields } = calculateEarnedShields(newStreak, t.shields, targetMilestone);

          return {
            ...t,
            status: 'idle', // Ready for today's new session!
            currentStreak: newStreak,
            bestStreak: Math.max(t.bestStreak, newStreak),
            shields: newShields,
            lastCompletedDate: yesterdayDate,
            timerEndedAtMs: undefined,
            startedAtMs: null,
            accumulatedMs: 0,
            sync_status: 1,
            updated_at_ms: now,
          };
        })
      );

      // Create retroactive habit log for yesterday
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

  const handleDiscardIdle = useCallback((taskId: string) => {
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
  }, [showToast]);

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

  // Complete Sprint Session for Project Mode
  const handleCompleteSprintSession = useCallback(
    (taskId: string) => {
      const now = Date.now();
      const logicalDate = getLogicalDate(now, 4);
      soundEngine.playSuccessChime();

      const targetTask = tasks.find((t) => t.id === taskId);
      if (!targetTask) return;

      const sessionDuration = targetTask.accumulatedMs;
      if (sessionDuration > 0) {
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
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'idle',
                startedAtMs: null,
                accumulatedMs: 0,
                currentStreak: t.currentStreak + 1,
                sync_status: 1,
                updated_at_ms: now,
              }
            : t
        )
      );

      showToast(`Đã lưu phiên làm việc ${formatDuration(sessionDuration)} vào lịch sử.`);
    },
    [tasks, showToast]
  );

  // --- HÀM MỚI: Xóa Tác Vụ ---
  const handleDeleteTask = useCallback((taskId: string) => {
    if (window.confirm('Anh có chắc chắn muốn xóa tác vụ này? Toàn bộ lịch sử sẽ bị xóa vĩnh viễn.')) {
      soundEngine.playTap(false);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSessions((prev) => prev.filter((s) => s.taskId !== taskId));
      setLogs((prev) => prev.filter((l) => l.taskId !== taskId));
      setStatsModalTaskId(null); // Đóng bảng báo cáo
      showToast('Đã xóa tác vụ thành công.');
    }
  }, [showToast]);

  // Streak Break Recoveries
  const handleUseShield = useCallback((taskId: string) => {
    soundEngine.playSoftChime(587.33, 0.3, 0.8);
    const now = Date.now();
    const logicalDate = getLogicalDate(now, 4);

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              shields: Math.max(0, t.shields - 1),
              sync_status: 1,
              updated_at_ms: now,
            }
          : t
      )
    );

    // Record shielded log in history
    const newLog: HabitDailyLog = {
      id: `shield_log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      taskId,
      logicalDate,
      completed: true,
      actualDurationMs: 0,
      confirmedAt: now,
      recoveryType: 'shield',
      sync_status: 1,
      updated_at_ms: now,
    };
    setLogs((prev) => [newLog, ...prev]);

    showToast('🛡️ Đã sử dụng 1 Khiên Bền Bỉ để bảo vệ chuỗi (FROZEN_BY_SHIELD)!');
  }, [showToast]);

  const handleAcceptCompensation = useCallback((taskId: string) => {
    soundEngine.playSoftChime(784, 0.3, 0.8);
    const now = Date.now();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              inCompensationQuest: true,
              targetDurationMs: t.targetDurationMs * 2,
              sync_status: 1,
              updated_at_ms: now,
            }
          : t
      )
    );
    showToast('⚡ Đã kích hoạt Nhiệm vụ Đền bù x2 cho ngày tiếp theo (MAKEUP_RECOVERED).');
  }, [showToast]);

  const handleResetToCheckpoint = useCallback((taskId: string) => {
    soundEngine.playTap(false);
    const now = Date.now();
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const checkpoint = calculateCheckpoint(t.currentStreak);
        return {
          ...t,
          currentStreak: checkpoint,
          inCompensationQuest: false,
          sync_status: 1,
          updated_at_ms: now,
        };
      })
    );
    showToast('Đã trở về cột mốc bảo lưu gần nhất.');
  }, [showToast]);

  const handleFullResetStreak = useCallback((taskId: string) => {
    soundEngine.playTap(false);
    const now = Date.now();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              currentStreak: 0,
              inCompensationQuest: false,
              sync_status: 1,
              updated_at_ms: now,
            }
          : t
      )
    );
    showToast('Đã đặt lại chuỗi về Ngày 0.');
  }, [showToast]);

  // Add Task with Max 24 limit enforcement
  const handleAddTask = useCallback(
    (newTaskData: Omit<TaskItem, 'id' | 'currentStreak' | 'bestStreak' | 'shields' | 'status' | 'startedAtMs' | 'accumulatedMs' | 'historyStartTimestamp' | 'sync_status' | 'updated_at_ms'>) => {
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
        sync_status: 1, // Pending sync
        updated_at_ms: now,
      };
      setTasks((prev) => [newTask, ...prev]);
      showToast(`Đã tạo tác vụ "${newTask.name}".`);
    },
    [tasks.length, showToast]
  );

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

        // Broadcast to other tabs
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

  // Auth: Email Login & Auto-Merge
  const handleLoginSuccess = useCallback(
    async (
      email: string,
      provider: 'mock_otp' | 'supabase',
      supabaseUrl?: string,
      supabaseAnonKey?: string
    ) => {
      const updatedAccount: UserAccount = {
        id: `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email,
        isAnonymous: false,
        provider,
        supabaseUrl,
        supabaseAnonKey,
        lastSyncedAtMs: null,
        createdAtMs: account.createdAtMs || Date.now(),
      };

      setAccount(updatedAccount);
      soundEngine.playSuccessChime();

      // Trigger auto-merge with cloud database
      setIsSyncing(true);
      try {
        const result = await syncDataToCloud(updatedAccount, { tasks, sessions, logs }, isSimulatedOffline);
        if (result.success) {
          setTasks(result.syncedTasks);
          setSessions(result.syncedSessions);
          setLogs(result.syncedLogs);
          setAccount(result.updatedAccount);
          showToast(`Chào mừng ${email}! Đã tự động hợp nhất dữ liệu lên đám mây.`);
        }
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
    showToast('Đã đăng xuất. Dữ liệu trên thiết bị vẫn được bảo toàn ở chế độ Ẩn danh.');
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

  // Test Notification Trigger
  const handleTestNotification = useCallback(() => {
    notificationService.sendNotification(
      '🔔 Thử nghiệm thông báo Bền Bỉ',
      'Hệ thống thông báo đẩy đang hoạt động hoàn hảo ngay cả khi khóa màn hình.'
    );
    soundEngine.playSoftChime(659.25, 0.25, 0.4);
    showToast('Đã bắn thông báo thử nghiệm.');
  }, [showToast]);

  // Realtime Broadcast Test Packet
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

  // Phase 3 Quick Test Triggers for DevTestToolbar
  const handleTestMilestone30 = useCallback(() => {
    const habitTask = tasks.find((t) => t.mode === 'habit') || tasks[0];
    if (habitTask) {
      const simulated: TaskItem = {
        ...habitTask,
        currentStreak: 30,
        bestStreak: Math.max(habitTask.bestStreak, 30),
        targetMilestoneDays: 30,
      };
      setMilestoneTask(simulated);
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
        endedAtMs: now - 8 * 3600 * 1000, // 8 hours ago (late night)
        logicalDate: yesterdayDate,
        accumulatedMs: habitTask.targetDurationMs,
      });
    }
  }, [tasks]);

  const handleTestIdleDetection = useCallback(() => {
    const projectTask = tasks.find((t) => t.mode === 'project') || tasks[0];
    if (projectTask) {
      const simulatedRawMs = 195 * 60 * 1000; // 195 mins (3h 15m)
      setIdleDetectionTask(projectTask);
      setIdleRawDurationMs(simulatedRawMs);
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

  // Global counts
  const totalShields = tasks.reduce((acc, t) => acc + t.shields, 0);
  const totalActiveStreaks = tasks.filter((t) => t.currentStreak > 0).length;
  const completedTodayCount = tasks.filter((t) => t.status === 'completed_today').length;
  const pendingSyncCount = countPendingSync(tasks, sessions, logs);

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (currentCategory === 'all') return true;
    return t.category === currentCategory;
  });

  const selectedStatsTask = tasks.find((t) => t.id === statsModalTaskId);
  const selectedBreakStreakTask = tasks.find((t) => t.id === breakStreakModalTaskId);

  return (
    <div className="min-h-screen bg-[#F4F7FA] text-slate-800 flex flex-col font-sans selection:bg-[#FF6B00] selection:text-white pb-24">
      {/* Top Header */}
      <Header
        wakeLockActive={wakeLockActive}
        wakeLockRequested={wakeLockRequested}
        onToggleWakeLock={handleToggleWakeLock}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        totalShields={totalShields}
        totalActiveStreaks={totalActiveStreaks}
        onOpenAddTask={() => setIsAddTaskModalOpen(true)}
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
              className="text-white/70 hover:text-white font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 pt-5 sm:pt-7 flex-1">
        
        {/* Category Filter Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setCurrentCategory('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                currentCategory === 'all'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
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
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
              <span>Sức khoẻ</span>
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                {tasks.filter((t) => t.category === 'health').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentCategory('work')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                currentCategory === 'work'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-[#3B6998]" />
              <span>Công việc</span>
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                {tasks.filter((t) => t.category === 'work').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentCategory('study')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                currentCategory === 'study'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>Học hành</span>
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                {tasks.filter((t) => t.category === 'study').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentCategory('habit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                currentCategory === 'habit'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>Thói quen</span>
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                {tasks.filter((t) => t.category === 'habit').length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono border flex items-center gap-1.5 ${
                tasks.length >= 24
                  ? 'bg-red-50 text-red-700 border-red-300'
                  : 'bg-[#E8F0FE] text-[#1E3A5F] border-[#3B6998]/30'
              }`}
            >
              <span>{tasks.length}/24 tác vụ</span>
            </div>
          </div>
        </div>

        {/* --- GRID HIỂN THỊ ĐÃ ĐƯỢC CHỈNH THÀNH 2 CỘT TRÊN ĐIỆN THOẠI --- */}
        {filteredTasks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
            {filteredTasks.map((task) => (
              <CircularTaskNode
                key={task.id}
                task={task}
                currentTimeMs={currentTimeMs}
                onToggleTimer={handleToggleTimer}
                onResetTimer={handleResetTimer}
                onConfirmHabit={handleConfirmHabit}
                onOpenProjectStats={(id) => setStatsModalTaskId(id)}
                onSimulateBreakStreak={(id) => {
                  setBreakStreakModalTaskId(id);
                  setBreakStreakMissedDays(1);
                }}
                onFastForward5s={handleFastForward5s}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-[#E8F0FE] text-[#1E3A5F] flex items-center justify-center mx-auto mb-3">
              <Filter className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">Chưa có tác vụ nào trong danh mục này</h3>
            <button
              type="button"
              disabled={tasks.length >= 24}
              onClick={() => setIsAddTaskModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#E65100] disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm tác vụ mới</span>
            </button>
          </div>
        )}
      </main>

      {/* 3-Tier Deep Report & Share Card Modal (BỔ SUNG HÀM XÓA VÀO ĐÂY) */}
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
        />
      )}

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
        onClose={() => setIsAddTaskModalOpen(false)}
        onAddTask={handleAddTask}
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
      />

      <PWAInstallGuideModal
        isOpen={isPWAGuideOpen}
        onClose={() => setIsPWAGuideOpen(false)}
        isInstallable={isPWAInstallable}
        onTriggerNativeInstall={promptInstall}
        isIOS={isIOS}
      />

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

      <Analytics />
    </div>
  );
}
