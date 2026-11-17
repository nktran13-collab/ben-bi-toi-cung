/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Filter, Plus } from 'lucide-react';
import {
  TaskItem,
  TaskCategory,
  RetroactiveConfirmation,
  getLogicalDate,
  getPreviousLogicalDate,
  evaluateDailyRollover,
  getMillisecondsUntilRollover,
  formatClockTime,
} from './utils/engine';
import { soundEngine } from './utils/audio';
import {
  getCleanStarterTasks,
  getInitialSeedTasks,
  exportFullBackupJSON,
  exportRecoveryJSON,
  parseFullBackupJSON,
} from './utils/storage';
import { useCloudSync } from './utils/useCloudSync';
import { useTimerWatchdogs } from './utils/useTimerWatchdogs';
import { useTaskActions } from './utils/useTaskActions';
import { useWakeLock } from './utils/useWakeLock';
import { usePWAInstall } from './utils/usePWAInstall';
import { usePushReminders } from './utils/usePushReminders';
import { PUSH_REMINDER_HOUR } from './utils/push';
import { notificationService } from './utils/notifications';
import { realtimeManager } from './utils/realtime';
import { setupMediaSession } from './utils/mediaSession';
import { useI18n } from './utils/useI18n';

import { Header } from './components/Header';
import { CircularTaskNode } from './components/CircularTaskNode';
import { DailyCommandCenter } from './components/DailyCommandCenter';
import { TaskFilterBar } from './components/TaskFilterBar';
import { ToastBanner } from './components/ToastBanner';
import { AccountLoadingOverlay } from './components/AccountLoadingOverlay';
import { ProjectStatsModal } from './components/ProjectStatsModal';
import { StreakBreakModal } from './components/StreakBreakModal';
import { AddTaskModal } from './components/AddTaskModal';
import { AuthModal } from './components/AuthModal';
import { PWAInstallGuideModal } from './components/PWAInstallGuideModal';
import { DevTestToolbar } from './components/DevTestToolbar';
import { MilestoneUpgradeModal } from './components/MilestoneUpgradeModal';
import { RetroactiveConfirmModal } from './components/RetroactiveConfirmModal';
import { IdleDetectionModal } from './components/IdleDetectionModal';
import { SettingsModal } from './components/SettingsModal';
import { ZenFocusModal } from './components/ZenFocusModal';
import { WelcomeModal } from './components/WelcomeModal';

export default function App() {
  const { t, lang } = useI18n();
  // The sync hook owns the canonical data and per-account offline cache.
  const {
    tasks,
    sessions,
    logs,
    settings,
    account,
    setTasks,
    setSessions,
    setLogs,
    setSettings,
    replaceData,
    isSyncing,
    syncError,
    syncNow,
    sendOtp,
    verifyOtp,
    logout,
    cloudEnabled,
    isOffline,
    isSimulatedOffline,
    setIsSimulatedOffline,
    isLoadingAccount,
    pendingSyncCount,
    needsAuthentication,
    recoveryAvailable,
  } = useCloudSync();
  const [dataLoaded, setDataLoaded] = useState(false);
  const pushReminderHour = settings.pushReminderHour ?? PUSH_REMINDER_HOUR;
  const {
    status: pushStatus,
    busy: pushBusy,
    error: pushError,
    enable: enablePush,
    disable: disablePush,
  } = usePushReminders(account.id, account.isAnonymous, pushReminderHour);
  const soundEnabled = settings.soundEnabled;
  const wakeLockRequested = settings.wakeLockRequested;
  const darkMode = !!settings.darkMode;
  const devModeEnabled = !!settings.devModeEnabled;
  const dayRolloverHour = settings.dayRolloverHour;
  const setSoundEnabled = useCallback(
    (value: React.SetStateAction<boolean>) => {
      setSettings((current) => ({
        ...current,
        soundEnabled: typeof value === 'function' ? value(current.soundEnabled) : value,
      }));
    },
    [setSettings],
  );
  const setWakeLockRequested = useCallback(
    (value: React.SetStateAction<boolean>) => {
      setSettings((current) => ({
        ...current,
        wakeLockRequested: typeof value === 'function' ? value(current.wakeLockRequested) : value,
      }));
    },
    [setSettings],
  );
  const setDarkMode = useCallback(
    (value: React.SetStateAction<boolean>) => {
      setSettings((current) => ({
        ...current,
        darkMode: typeof value === 'function' ? value(!!current.darkMode) : value,
      }));
    },
    [setSettings],
  );
  const setDevModeEnabled = useCallback(
    (value: React.SetStateAction<boolean>) => {
      setSettings((current) => ({
        ...current,
        devModeEnabled: typeof value === 'function' ? value(!!current.devModeEnabled) : value,
      }));
    },
    [setSettings],
  );
  // Dev tools stay hidden for regular users; open ?dev=1 once to reveal the toggle.
  const [devToolsUnlocked] = useState(() => {
    try {
      if (new URLSearchParams(window.location.search).has('dev')) {
        localStorage.setItem('benbi_dev_unlock_v1', '1');
        return true;
      }
      return localStorage.getItem('benbi_dev_unlock_v1') === '1';
    } catch {
      return false;
    }
  });
  const [currentCategory, setCurrentCategory] = useState<'all' | TaskCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Realtime cross-tab state tracking
  const [lastRealtimeMessage, setLastRealtimeMessage] = useState<string | null>(null);

  // Notification API permission state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(
    'default',
  );

  // Modals state
  const [statsModalTaskId, setStatsModalTaskId] = useState<string | null>(null);
  const [breakStreakModalTaskId, setBreakStreakModalTaskId] = useState<string | null>(null);
  const [breakStreakMissedDays, setBreakStreakMissedDays] = useState<number>(1);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [zenFocusTaskId, setZenFocusTaskId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPWAGuideOpen, setIsPWAGuideOpen] = useState(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [accountActionError, setAccountActionError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Special Psychology Modals
  const [milestoneTask, setMilestoneTask] = useState<TaskItem | null>(null);
  const [retroactiveItem, setRetroactiveItem] = useState<RetroactiveConfirmation | null>(null);
  const [idleDetectionTask, setIdleDetectionTask] = useState<TaskItem | null>(null);
  const [idleRawDurationMs, setIdleRawDurationMs] = useState<number>(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // PWA Installability hook
  const { isInstallable: isPWAInstallable, promptInstall } = usePWAInstall();

  // Screen Wake Lock API integration
  const { isActive: wakeLockActive } = useWakeLock(wakeLockRequested);

  // Low-frequency clock for minute-level metrics (NOT the per-second timer display:
  // running cards own their own 1s clock so App no longer re-renders 6x/second).
  const [metricsNowMs, setMetricsNowMs] = useState(Date.now());
  const [currentLogicalDate, setCurrentLogicalDate] = useState(() => getLogicalDate(Date.now(), dayRolloverHour));

  // Show auto-dismissing toast notification
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  }, []);

  // Clear task selections only when the account changes, never during routine sync.
  const selectedAccountId = useRef(account.id);
  useEffect(() => {
    if (selectedAccountId.current === account.id) return;
    selectedAccountId.current = account.id;
    setStatsModalTaskId(null);
    setBreakStreakModalTaskId(null);
    setBreakStreakMissedDays(1);
    setZenFocusTaskId(null);
    setEditingTask(null);
    setIsAddTaskModalOpen(false);
    setMilestoneTask(null);
    setRetroactiveItem(null);
    setIdleDetectionTask(null);
    setIdleRawDurationMs(0);
    setLastRealtimeMessage(null);
    setAccountActionError(null);
  }, [account.id]);

  // The hook provides cached data immediately; run initial rollover and welcome checks once.
  useEffect(() => {
    const now = Date.now();
    const initialLogicalDate = getLogicalDate(now, dayRolloverHour);
    const yesterdayDate = getPreviousLogicalDate(initialLogicalDate);

    const rollover = evaluateDailyRollover(tasks, initialLogicalDate, now);
    const initialTasks = rollover.hasChanges ? rollover.updatedTasks : tasks;
    if (rollover.hasChanges) setTasks(initialTasks);

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
        getLogicalDate(t.timerEndedAtMs, dayRolloverHour) === yesterdayDate,
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

    // First-time user welcome guide check
    try {
      const showWelcomePref = localStorage.getItem('benbi_show_welcome_modal_v2');
      if (showWelcomePref !== 'false') {
        setIsWelcomeModalOpen(true);
      }
    } catch {}

    setDataLoaded(true);
    // Intentionally runs once on first data load; later rollovers are handled by the minute clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync dark mode class on document.documentElement
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', darkMode);
    }
  }, [darkMode]);

  // Apply sound preferences from local edits, imports, and cloud updates alike.
  useEffect(() => {
    soundEngine.setMuted(!soundEnabled);
  }, [soundEnabled]);

  // Minute-level clock: refresh metrics and detect the 04:00 logical-day rollover.
  useEffect(() => {
    const tick = () => {
      setMetricsNowMs(Date.now());
      const nextDate = getLogicalDate(Date.now(), dayRolloverHour);
      setCurrentLogicalDate((prev) => (prev === nextDate ? prev : nextDate));
    };
    const interval = setInterval(tick, 30_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [dayRolloverHour]);

  // Apply a new rollover hour immediately instead of waiting for the next minute tick.
  useEffect(() => {
    setCurrentLogicalDate(getLogicalDate(Date.now(), dayRolloverHour));
  }, [dayRolloverHour]);

  useEffect(() => {
    if (!dataLoaded || isLoadingAccount) return;
    const rollover = evaluateDailyRollover(tasks, currentLogicalDate, Date.now());
    if (rollover.hasChanges) {
      setTasks(rollover.updatedTasks);
      if (rollover.detectedBreak) {
        setBreakStreakModalTaskId(rollover.detectedBreak.taskId);
        setBreakStreakMissedDays(rollover.detectedBreak.missedDays);
      }
    }
  }, [currentLogicalDate, dataLoaded, isLoadingAccount, tasks, setTasks]);

  // Countdown completion and idle-session watchdogs (event-driven, no render per tick).
  useTimerWatchdogs({
    tasks,
    dataLoaded,
    isLoadingAccount,
    setTasks,
    onIdleDetected: (task, totalRawMs) => {
      setIdleDetectionTask(task);
      setIdleRawDurationMs(totalRawMs);
    },
  });

  const {
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
  } = useTaskActions({
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
  });

  // Media Session API: Bind lock screen controls to active running task
  const runningTask = isLoadingAccount ? null : tasks.find((t) => t.status === 'running') || null;
  useEffect(() => {
    setupMediaSession(runningTask, {
      // iOS fires media-session actions on its own when the screen locks or the
      // app is backgrounded; only honor them as foreground user gestures, and
      // never let a stray "play" pause a running task.
      onPlay: () => {
        if (document.visibilityState !== 'visible' || !runningTask || runningTask.status !== 'paused') return;
        handleToggleTimer(runningTask.id);
      },
      onPause: () => {
        if (document.visibilityState !== 'visible' || !runningTask || runningTask.status !== 'running') return;
        handleToggleTimer(runningTask.id);
      },
    });
  }, [runningTask, handleToggleTimer, lang]);

  const handleKeep30Days = useCallback(() => {
    setMilestoneTask(null);
  }, []);

  // Backup & Restore JSON + Starter Reset Handlers
  const handleExportBackupJSON = useCallback(() => {
    const json = exportFullBackupJSON(tasks, sessions, logs, settings);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ben-bi-backup-${getLogicalDate(Date.now(), dayRolloverHour)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('app.toast.backupDownloaded'));
  }, [tasks, sessions, logs, settings, showToast, dayRolloverHour, t]);

  const handleExportRecovery = useCallback(() => {
    const blob = new Blob([exportRecoveryJSON()], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ben-bi-recovery-${getLogicalDate(Date.now(), dayRolloverHour)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [dayRolloverHour]);

  const handleImportBackupJSON = useCallback(
    (jsonStr: string): boolean => {
      const parsed = parseFullBackupJSON(jsonStr);
      if (!parsed) return false;
      replaceData(parsed);
      soundEngine.playSuccessChime();
      showToast(t('app.toast.backupRestored'));
      return true;
    },
    [replaceData, showToast, t],
  );

  const handleResetToCleanStarter = useCallback(() => {
    replaceData(getCleanStarterTasks());
    soundEngine.playSoftChime(523.25, 0.25, 0.5);
    showToast(t('app.toast.cleanStarter'));
  }, [replaceData, showToast, t]);

  const handleLoadDemoSeed = useCallback(() => {
    replaceData(getInitialSeedTasks());
    soundEngine.playSoftChime(659.25, 0.25, 0.5);
    showToast(t('app.toast.demoSeed'));
  }, [replaceData, showToast, t]);

  const handleCloseWelcomeModal = useCallback((dontShowAgain: boolean) => {
    setIsWelcomeModalOpen(false);
    try {
      if (dontShowAgain) {
        localStorage.setItem('benbi_show_welcome_modal_v2', 'false');
      } else {
        localStorage.setItem('benbi_show_welcome_modal_v2', 'true');
      }
    } catch {}
  }, []);

  // Only report cloud success when the hook confirms a completed sync.
  const handleTriggerSyncNow = useCallback(async () => {
    if (account.isAnonymous) {
      showToast(t('app.toast.loginRequired'));
      return;
    }
    if (isSyncing) return;

    try {
      const saved = await syncNow();
      if (saved) {
        soundEngine.playSoftChime(880, 0.15, 0.3);
        showToast(t('app.toast.syncSuccess'));
      } else {
        showToast(
          !cloudEnabled
            ? t('app.toast.syncNotConfigured')
            : isOffline
              ? t('app.toast.syncOffline')
              : t('app.toast.syncFailed'),
        );
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('app.toast.syncErrorFallback'));
    }
  }, [account.isAnonymous, isSyncing, syncNow, cloudEnabled, isOffline, showToast, t]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await disablePush().catch(() => {});
      await logout();
      soundEngine.playTap(false);
      showToast(t('app.toast.loggedOut'));
    } finally {
      setIsLoggingOut(false);
    }
  }, [disablePush, logout, showToast, t]);

  const handleTogglePush = useCallback(
    async (next: boolean) => {
      try {
        if (next) {
          await enablePush();
          showToast(t('app.toast.pushOn'));
        } else {
          await disablePush();
          showToast(t('app.toast.pushOff'));
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : t('app.toast.pushSettingError'));
      }
    },
    [enablePush, disablePush, showToast, t],
  );

  // Request Notification Permission
  const handleRequestNotificationPermission = useCallback(async () => {
    const result = await notificationService.requestPermission();
    setNotificationPermission(result);
    setSettings((current) => ({ ...current, notificationsEnabled: result === 'granted' }));
    if (result === 'granted') {
      notificationService.sendNotification(t('app.notifTitle'), t('app.notifEnabledBody'));
      showToast(t('app.toast.notifGranted'));
    } else {
      showToast(t('app.toast.notifDenied'));
    }
  }, [setSettings, showToast, t]);

  const handleTestNotification = useCallback(() => {
    notificationService.sendNotification(t('app.notifTestTitle'), t('app.notifTestBody'));
    soundEngine.playSoftChime(659.25, 0.25, 0.4);
    showToast(t('app.toast.testNotifSent'));
  }, [showToast, t]);

  const handleBroadcastTestEvent = useCallback(() => {
    const now = Date.now();
    realtimeManager.publish({
      type: 'TIMER_START',
      taskId: tasks[0]?.id || 'test_task',
      startedAtMs: now,
      accumulatedMs: 0,
    });
    setLastRealtimeMessage(t('app.realtimeMessage', { time: formatClockTime(now) }));
    showToast(t('app.toast.realtimeBroadcast'));
  }, [tasks, showToast, t]);

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
      const yesterdayDate = getPreviousLogicalDate(getLogicalDate(now, dayRolloverHour));
      setRetroactiveItem({
        taskId: habitTask.id,
        taskName: habitTask.name,
        endedAtMs: now - 8 * 3600 * 1000,
        logicalDate: yesterdayDate,
        accumulatedMs: habitTask.targetDurationMs,
      });
    }
  }, [tasks, dayRolloverHour]);

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
  }, [soundEnabled, setSoundEnabled]);

  // Toggle Wake Lock
  const handleToggleWakeLock = useCallback(() => {
    setWakeLockRequested((prev) => !prev);
  }, [setWakeLockRequested]);

  // Global counts & Daily Command Center Metrics
  const totalShields = tasks.reduce((acc, t) => acc + t.shields, 0);
  const totalActiveStreaks = tasks.filter((t) => t.currentStreak > 0).length;

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
      const runningDelta = t.status === 'running' && t.startedAtMs ? Math.max(0, metricsNowMs - t.startedAtMs) : 0;
      return sum + t.accumulatedMs + runningDelta;
    }, 0);
  const totalFocusedTodayMinutes = Math.round((todayLogsMs + todaySessionsMs + activeTimersMs) / 60000);

  // Saved project time per task for the current logical day (live session is added by the card itself).
  const todayProjectSaved = new Map<string, { ms: number; count: number }>();
  for (const s of sessions) {
    if (s.logicalDate !== currentLogicalDate) continue;
    const entry = todayProjectSaved.get(s.taskId) ?? { ms: 0, count: 0 };
    entry.ms += s.durationMs;
    entry.count += 1;
    todayProjectSaved.set(s.taskId, entry);
  }

  const highestStreak = tasks.reduce((max, t) => Math.max(max, t.currentStreak), 0);
  const msUntilRollover = getMillisecondsUntilRollover(metricsNowMs, dayRolloverHour);
  const hoursUntilRollover = Math.floor(msUntilRollover / 3600000);
  const minsUntilRollover = Math.floor((msUntilRollover % 3600000) / 60000);

  // Filter & Sort tasks (Running first -> Pending confirmation -> Active/Idle -> Completed Today)
  const filteredTasks = tasks
    .filter((t) => {
      if (currentCategory !== 'all' && t.category !== currentCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(q) || (t.notes && t.notes.toLowerCase().includes(q));
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

  const openAddTaskModal = () => {
    setEditingTask(null);
    setIsAddTaskModalOpen(true);
  };

  return (
    <>
      <div
        inert={isLoadingAccount}
        aria-hidden={isLoadingAccount || undefined}
        className={`min-h-screen flex flex-col font-sans selection:bg-[#FF6B00] selection:text-white app-shell transition-colors ${
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
          devToolsUnlocked={devToolsUnlocked}
          onToggleDevMode={() => {
            const next = !devModeEnabled;
            setDevModeEnabled(next);
            showToast(next ? t('app.toast.devOn') : t('app.toast.devOff'));
          }}
          totalShields={totalShields}
          totalActiveStreaks={totalActiveStreaks}
          onOpenAddTask={openAddTaskModal}
          onTestSound={() => soundEngine.playBellChime(523.25)}
          account={account}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          pendingSyncCount={pendingSyncCount}
          isSimulatedOffline={isOffline}
          onTriggerSyncNow={handleTriggerSyncNow}
          isSyncing={isSyncing}
          isPWAInstallable={isPWAInstallable}
          onPromptInstall={promptInstall}
          onOpenPWAGuide={() => setIsPWAGuideOpen(true)}
          onOpenWelcomeModal={() => setIsWelcomeModalOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          dayRolloverHour={dayRolloverHour}
          needsReauth={needsAuthentication}
        />

        <ToastBanner message={toastMessage} onDismiss={() => setToastMessage(null)} />

        {/* Main Container */}
        <main className="max-w-6xl mx-auto w-full px-3 sm:px-4 pt-5 sm:pt-6 flex-1">
          <DailyCommandCenter
            darkMode={darkMode}
            completedHabitsToday={completedHabitsToday}
            habitCount={habitTasks.length}
            dailyHabitProgressPercent={dailyHabitProgressPercent}
            totalFocusedTodayMinutes={totalFocusedTodayMinutes}
            highestStreak={highestStreak}
            totalActiveStreaks={totalActiveStreaks}
            hoursUntilRollover={hoursUntilRollover}
            minsUntilRollover={minsUntilRollover}
            rolloverHour={dayRolloverHour}
            onOpenResetOptions={() => setIsAuthModalOpen(true)}
          />

          <TaskFilterBar
            tasks={tasks}
            darkMode={darkMode}
            currentCategory={currentCategory}
            onSelectCategory={setCurrentCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onAddTask={openAddTaskModal}
          />

          {/* Task Grid */}
          {filteredTasks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-5">
              {filteredTasks.map((task) => (
                <CircularTaskNode
                  key={task.id}
                  task={task}
                  devModeEnabled={devModeEnabled}
                  darkMode={darkMode}
                  todaySavedMs={todayProjectSaved.get(task.id)?.ms ?? 0}
                  todaySessionCount={todayProjectSaved.get(task.id)?.count ?? 0}
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
                {searchQuery ? t('app.emptySearch', { query: searchQuery }) : t('app.emptyCategory')}
              </h3>
              <button
                type="button"
                disabled={tasks.length >= 24}
                onClick={openAddTaskModal}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF6B00] hover:bg-[#E65100] disabled:opacity-40 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('app.addTask')}</span>
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
            dayRolloverHour={dayRolloverHour}
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
          todaySavedMs={selectedZenTask ? (todayProjectSaved.get(selectedZenTask.id)?.ms ?? 0) : 0}
          todaySessionCount={selectedZenTask ? (todayProjectSaved.get(selectedZenTask.id)?.count ?? 0) : 0}
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
            dayRolloverHour={dayRolloverHour}
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

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          dayRolloverHour={dayRolloverHour}
          onChangeDayRolloverHour={(hour) => setSettings((current) => ({ ...current, dayRolloverHour: hour }))}
          pushStatus={pushStatus}
          pushBusy={pushBusy}
          pushError={pushError}
          onTogglePush={handleTogglePush}
          pushReminderHour={pushReminderHour}
          onChangePushReminderHour={(hour) => setSettings((current) => ({ ...current, pushReminderHour: hour }))}
          onRequestLogin={() => {
            setIsSettingsOpen(false);
            setIsAuthModalOpen(true);
          }}
        />

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
          onSendOtp={sendOtp}
          onVerifyOtp={verifyOtp}
          onLogout={handleLogout}
          cloudEnabled={cloudEnabled}
          syncError={syncError}
          onTriggerSyncNow={handleTriggerSyncNow}
          isSyncing={isSyncing}
          onExportBackupJSON={handleExportBackupJSON}
          onImportBackupJSON={handleImportBackupJSON}
          onResetToCleanStarter={handleResetToCleanStarter}
          onLoadDemoSeed={handleLoadDemoSeed}
          needsReauth={needsAuthentication}
          recoveryAvailable={recoveryAvailable}
          onExportRecovery={handleExportRecovery}
        />

        <PWAInstallGuideModal
          isOpen={isPWAGuideOpen}
          onClose={() => setIsPWAGuideOpen(false)}
          isInstallable={isPWAInstallable}
          onTriggerNativeInstall={promptInstall}
        />

        <WelcomeModal
          isOpen={isWelcomeModalOpen}
          onClose={handleCloseWelcomeModal}
          onOpenQuickStart={() => setIsAddTaskModalOpen(true)}
        />

        {/* DevTestToolbar only visible when Dev Mode is enabled */}
        {devModeEnabled && (
          <DevTestToolbar
            isSimulatedOffline={isSimulatedOffline}
            onToggleSimulatedOffline={() => {
              setIsSimulatedOffline((prev) => !prev);
              showToast(!isSimulatedOffline ? t('app.toast.offlineSimOn') : t('app.toast.offlineSimOff'));
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
      <AccountLoadingOverlay
        isLoadingAccount={isLoadingAccount}
        syncError={syncError}
        accountActionError={accountActionError}
        isSyncing={isSyncing}
        isLoggingOut={isLoggingOut}
        onRetrySync={() => {
          setAccountActionError(null);
          void syncNow();
        }}
        onLogout={async () => {
          setAccountActionError(null);
          try {
            await handleLogout();
          } catch (error) {
            setAccountActionError(error instanceof Error ? error.message : t('app.toast.logoutError'));
          }
        }}
      />
    </>
  );
}
