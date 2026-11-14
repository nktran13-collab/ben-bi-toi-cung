import { useEffect, useRef } from 'react';
import type { TaskItem } from './engine';
import { getEffectiveTargetDurationMs } from './engine';
import { soundEngine } from './audio';
import { notificationService } from './notifications';

type SetTasks = (value: React.SetStateAction<TaskItem[]>) => void;

interface TimerWatchdogsOptions {
  tasks: TaskItem[];
  dataLoaded: boolean;
  isLoadingAccount: boolean;
  setTasks: SetTasks;
  onIdleDetected: (task: TaskItem, totalRawMs: number) => void;
}

const WATCHDOG_INTERVAL_MS = 500;
const IDLE_THRESHOLD_MS = 180 * 60 * 1000;

/**
 * Event-driven timers for countdown completion and idle sessions.
 * Interval callbacks read the latest tasks through a ref, so App only renders
 * when a watchdog actually changes state (not once per tick).
 */
export function useTimerWatchdogs({
  tasks,
  dataLoaded,
  isLoadingAccount,
  setTasks,
  onIdleDetected,
}: TimerWatchdogsOptions) {
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const idleHandlerRef = useRef(onIdleDetected);
  idleHandlerRef.current = onIdleDetected;

  const habitHandledRef = useRef<Set<string>>(new Set());
  const idleHandledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!dataLoaded || isLoadingAccount) return;

    const check = () => {
      const now = Date.now();
      const liveTasks = tasksRef.current;

      for (const id of habitHandledRef.current) {
        const t = liveTasks.find((task) => task.id === id);
        if (!t || t.status !== 'running') habitHandledRef.current.delete(id);
      }

      liveTasks.forEach((task) => {
        if (task.mode !== 'habit' || task.status !== 'running' || task.startedAtMs === null) return;
        if (habitHandledRef.current.has(task.id)) return;

        const effectiveTargetMs = getEffectiveTargetDurationMs(task);
        const elapsed = task.accumulatedMs + Math.max(0, now - task.startedAtMs);
        if (elapsed < effectiveTargetMs) return;

        habitHandledRef.current.add(task.id);
        soundEngine.playBellChime(523.25);

        notificationService.sendNotification(
          `🔥 Bền Bỉ: ${task.name} đã hoàn thành!`,
          'Đồng hồ đếm ngược đã chạm 00:00. Nhấn giữ 0.8 giây để xác nhận chuỗi của bạn.'
        );

        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id && t.status === 'running'
              ? {
                  ...t,
                  status: 'pending_confirmation',
                  accumulatedMs: getEffectiveTargetDurationMs(t),
                  startedAtMs: null,
                  timerEndedAtMs: now,
                  sync_status: 1,
                  updated_at_ms: Date.now(),
                }
              : t
          )
        );
      });
    };

    const interval = setInterval(check, WATCHDOG_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [dataLoaded, isLoadingAccount, setTasks]);

  useEffect(() => {
    if (!dataLoaded || isLoadingAccount) return;

    const check = () => {
      const now = Date.now();
      const liveTasks = tasksRef.current;

      for (const id of idleHandledRef.current) {
        const t = liveTasks.find((task) => task.id === id);
        if (!t || t.status !== 'running') idleHandledRef.current.delete(id);
      }

      liveTasks.forEach((task) => {
        if (task.mode !== 'project' || task.status !== 'running' || task.startedAtMs === null) return;
        if (idleHandledRef.current.has(task.id)) return;

        const continuousRunMs = now - task.startedAtMs;
        if (continuousRunMs < IDLE_THRESHOLD_MS) return;

        idleHandledRef.current.add(task.id);
        const totalRawMs = task.accumulatedMs + continuousRunMs;
        soundEngine.playSoftChime(440, 0.2, 0.5);

        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id && t.status === 'running'
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

        idleHandlerRef.current(task, totalRawMs);
      });
    };

    const interval = setInterval(check, WATCHDOG_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [dataLoaded, isLoadingAccount, setTasks]);
}