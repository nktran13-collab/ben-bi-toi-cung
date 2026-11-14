/**
 * Pure business logic and calculation engine for "Bền bỉ tới cùng"
 * (Persistence To The End) - GIAI ĐOẠN 3: UCL 66-day Psychology, Edge Cases & Analytics.
 */

export type MatrixDayStatus =
  | 'completed_on_time' // Relentless Orange #FF6B00
  | 'frozen_by_shield' // Gold #FCC934
  | 'makeup_recovered' // Deep Jean Blue #1E3A5F
  | 'missed' // Coral Red #D93025
  | 'upcoming'; // Soft Jean Tint #E8F0FE

export interface MatrixDayCell {
  dayNumber: number;
  dateStr?: string;
  status: MatrixDayStatus;
  durationMs?: number;
  label?: string;
}

export interface TimeSession {
  id: string; // UUID
  taskId: string;
  logicalDate: string; // YYYY-MM-DD
  startedAt: number;
  endedAt: number;
  durationMs: number; // Raw or trimmed duration
  trimmedMs?: number;
  sync_status: number; // 1 = pending sync, 0 = synced
  updated_at_ms: number;
}

export interface HabitDailyLog {
  id: string; // UUID
  taskId: string;
  logicalDate: string; // YYYY-MM-DD
  completed: boolean;
  actualDurationMs: number;
  confirmedAt?: number;
  recoveryType?: 'on_time' | 'shield' | 'makeup' | 'missed';
  sync_status: number; // 1 = pending sync, 0 = synced
  updated_at_ms: number;
}

export type TaskMode = 'habit' | 'project';
export type TaskCategory = 'health' | 'work' | 'study' | 'habit';

export interface TaskItem {
  id: string; // UUID
  name: string;
  mode: TaskMode;
  category: TaskCategory;
  targetDurationMs: number; // Base Habit quota or Project goal/session target (in ms)
  targetMilestoneDays?: number; // 30, 66, or 100 days
  currentStreak: number;
  bestStreak: number;
  shields: number;
  inCompensationQuest?: boolean; // If true, requires double time (targetDurationMs * 2) for the current day
  status: 'idle' | 'running' | 'paused' | 'pending_confirmation' | 'completed_today';
  startedAtMs: number | null;
  accumulatedMs: number;
  lastCompletedDate?: string;
  lastStreakCheckDate?: string; // Prevents duplicate streak break prompts on the same logical day
  historyStartTimestamp: number;
  notes?: string;
  sync_status: number; // 1 = pending sync, 0 = synced
  updated_at_ms: number;
  timerEndedAtMs?: number; // Timestamp when countdown hit 0
  isSuspectedIdle?: boolean; // Flagged when project running > 180m
}

export interface RetroactiveConfirmation {
  taskId: string;
  taskName: string;
  endedAtMs: number;
  logicalDate: string;
  accumulatedMs: number;
}

export interface UserAccount {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  provider: 'anonymous' | 'mock_otp' | 'supabase' | 'email_sync';
  lastSyncedAtMs: number | null;
  createdAtMs: number;
}

export interface RealtimeSyncPayload {
  type: 'TIMER_START' | 'TIMER_PAUSE' | 'TIMER_RESET' | 'HABIT_CONFIRM' | 'DATA_MERGE';
  senderDeviceId: string;
  accountId: string;
  timestamp: number;
  taskId?: string;
  startedAtMs?: number | null;
  accumulatedMs?: number;
  newStreak?: number;
  shields?: number;
  dataSnapshot?: {
    tasks: TaskItem[];
    sessions: TimeSession[];
    logs: HabitDailyLog[];
  };
}

export interface ScheduledPushRecord {
  taskId: string;
  taskName: string;
  scheduledEndAtMs: number;
  targetMinutes: number;
  active: boolean;
  createdAtMs: number;
}

/**
 * Returns the logical date (YYYY-MM-DD) based on biological rollover hour (default 04:00 AM).
 * Working past midnight (00:00 - 03:59) belongs to the previous logical day.
 */
export function getLogicalDate(timestampMs: number = Date.now(), rolloverHour = 4): string {
  const adjusted = new Date(timestampMs - rolloverHour * 3600 * 1000);
  const y = adjusted.getFullYear();
  const m = String(adjusted.getMonth() + 1).padStart(2, '0');
  const d = String(adjusted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns previous logical day (YYYY-MM-DD). Supports timestamp or YYYY-MM-DD string.
 */
export function getPreviousLogicalDate(input: number | string = Date.now(), rolloverHour = 4): string {
  if (typeof input === 'string') {
    const parts = input.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }
  const baseMs = typeof input === 'number' ? input : Date.now();
  const adjusted = new Date(baseMs - (rolloverHour + 24) * 3600 * 1000);
  const y = adjusted.getFullYear();
  const m = String(adjusted.getMonth() + 1).padStart(2, '0');
  const d = String(adjusted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the effective target duration for a task (doubles if inCompensationQuest is active for a habit).
 * Preserves base targetDurationMs so completing the compensation quest restores normal quota next day.
 */
export function getEffectiveTargetDurationMs(
  task: Pick<TaskItem, 'mode' | 'targetDurationMs' | 'inCompensationQuest'>,
): number {
  if (task.mode === 'habit' && task.inCompensationQuest) {
    return task.targetDurationMs * 2;
  }
  return task.targetDurationMs;
}

/**
 * Calculates calendar days difference between two YYYY-MM-DD logical dates (toDate - fromDate).
 */
export function calculateDaysBetweenLogicalDates(fromDateStr: string, toDateStr: string): number {
  const fParts = fromDateStr.split('-').map((n) => parseInt(n, 10));
  const tParts = toDateStr.split('-').map((n) => parseInt(n, 10));
  if (fParts.length !== 3 || tParts.length !== 3) return 0;

  const fromUtc = Date.UTC(fParts[0], fParts[1] - 1, fParts[2]);
  const toUtc = Date.UTC(tParts[0], tParts[1] - 1, tParts[2]);
  return Math.round((toUtc - fromUtc) / (24 * 3600 * 1000));
}

/**
 * Evaluates tasks on daily biological rollover (04:00 AM):
 * 1. Resets 'completed_today' tasks from a previous logical day back to 'idle' for the new day.
 * 2. Detects real streak breaks when a habit missed 1 or more logical days.
 */
export function evaluateDailyRollover(
  tasks: TaskItem[],
  currentLogicalDate: string,
  nowMs: number = Date.now(),
): {
  updatedTasks: TaskItem[];
  hasChanges: boolean;
  detectedBreak: { taskId: string; missedDays: number } | null;
} {
  let hasChanges = false;
  let detectedBreak: { taskId: string; missedDays: number } | null = null;

  const updatedTasks = tasks.map((task): TaskItem => {
    let updated = task;

    // 1. Reset completed_today if lastCompletedDate is before currentLogicalDate
    if (
      updated.status === 'completed_today' &&
      updated.lastCompletedDate &&
      updated.lastCompletedDate < currentLogicalDate
    ) {
      hasChanges = true;
      updated = {
        ...updated,
        status: 'idle',
        startedAtMs: null,
        accumulatedMs: 0,
        timerEndedAtMs: undefined,
        sync_status: 1,
        updated_at_ms: nowMs,
      };
    }

    // 2. Check for missed logical days on active streaks
    if (
      updated.mode === 'habit' &&
      updated.currentStreak > 0 &&
      updated.lastCompletedDate &&
      updated.lastStreakCheckDate !== currentLogicalDate
    ) {
      const daysDiff = calculateDaysBetweenLogicalDates(updated.lastCompletedDate, currentLogicalDate);
      if (daysDiff >= 2) {
        const missedDays = daysDiff - 1;
        if (!detectedBreak) {
          detectedBreak = { taskId: updated.id, missedDays };
        }
        hasChanges = true;
        updated = {
          ...updated,
          lastStreakCheckDate: currentLogicalDate,
          sync_status: 1,
          updated_at_ms: nowMs,
        };
      }
    }

    return updated;
  });

  return { updatedTasks, hasChanges, detectedBreak };
}

/**
 * Returns milliseconds remaining until the next biological rollover (04:00 AM).
 */
export function getMillisecondsUntilRollover(nowMs: number = Date.now(), rolloverHour = 4): number {
  const d = new Date(nowMs);
  const nextRollover = new Date(d);
  nextRollover.setHours(rolloverHour, 0, 0, 0);
  if (d.getTime() >= nextRollover.getTime()) {
    nextRollover.setDate(nextRollover.getDate() + 1);
  }
  return Math.max(0, nextRollover.getTime() - nowMs);
}

/**
 * Delta-Timestamp calculation:
 * T_elapsed = T_accumulated + (Date.now() - T_started_at)
 */
export function calculateElapsedTime(
  startedAtMs: number | null,
  accumulatedMs: number,
  nowMs: number = Date.now(),
): number {
  if (startedAtMs === null) {
    return Math.max(0, accumulatedMs);
  }
  return Math.max(0, accumulatedMs + Math.max(0, nowMs - startedAtMs));
}

/**
 * Calculates Habit countdown details.
 * Remaining decreases from targetDurationMs to 0.
 */
export function calculateHabitRemaining(
  targetDurationMs: number,
  startedAtMs: number | null,
  accumulatedMs: number,
  nowMs: number = Date.now(),
): { remainingMs: number; progressRatio: number; isFinished: boolean } {
  const elapsed = calculateElapsedTime(startedAtMs, accumulatedMs, nowMs);
  const remainingMs = Math.max(0, targetDurationMs - elapsed);
  const progressRatio = targetDurationMs > 0 ? Math.max(0, Math.min(1, remainingMs / targetDurationMs)) : 0;
  return {
    remainingMs,
    progressRatio,
    isFinished: remainingMs <= 0,
  };
}

/**
 * Calculates Project progress details.
 * Elapsed increases, progressRatio fills up from 0 to 1.
 */
export function calculateProjectProgress(
  targetDurationMs: number,
  startedAtMs: number | null,
  accumulatedMs: number,
  nowMs: number = Date.now(),
): { elapsedMs: number; progressRatio: number } {
  const elapsedMs = calculateElapsedTime(startedAtMs, accumulatedMs, nowMs);
  const progressRatio = targetDurationMs > 0 ? Math.min(1, elapsedMs / targetDurationMs) : 0;
  return {
    elapsedMs,
    progressRatio,
  };
}

/**
 * Formats milliseconds into HH:MM:SS or MM:SS with tabular-nums friendly format.
 */
export function formatDuration(ms: number, showHoursAlways = false): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0 || showHoursAlways) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Maximum shields capacity rule:
 * - 30-day cycle: max 2 shields
 * - 66-day cycle: max 3 shields
 */
export function getMaxShieldCapacity(targetMilestoneDays = 30): number {
  return targetMilestoneDays >= 66 ? 3 : 2;
}

/**
 * Calculates earned shields based on streak count (1 shield for every 7 days, bounded by capacity).
 */
export function calculateEarnedShields(
  streak: number,
  existingShields: number = 0,
  targetMilestoneDays = 30,
): { newShields: number; earned: boolean } {
  const maxCapacity = getMaxShieldCapacity(targetMilestoneDays);
  const earnedBonus = streak > 0 && streak % 7 === 0 ? 1 : 0;
  const newShields = Math.min(maxCapacity, existingShields + earnedBonus);
  return {
    newShields,
    earned: earnedBonus > 0 && newShields > existingShields,
  };
}

/**
 * Nearest Checkpoint milestone (Days 0, 7, 14, 21, 30, 45, 60, 66)
 */
export function calculateCheckpoint(streak: number): number {
  const milestones = [60, 45, 30, 21, 14, 7, 0];
  for (const m of milestones) {
    if (streak >= m) return m;
  }
  return 0;
}

/**
 * Persistence Density: active work days / total history calendar days
 */
export function calculatePersistenceDensity(activeDaysCount: number, totalHistoryDays: number): number {
  if (totalHistoryDays <= 0) return 100;
  const ratio = (activeDaysCount / totalHistoryDays) * 100;
  return Math.min(100, Math.max(0, Math.round(ratio)));
}

/**
 * Trims session duration if user forgot to stop the timer.
 */
export function trimSessionDuration(sessionDurationMs: number, trimMinutes: number): number {
  const trimMs = trimMinutes * 60 * 1000;
  return Math.max(0, sessionDurationMs - trimMs);
}

/**
 * Counts items awaiting cloud sync (sync_status === 1)
 */
export function countPendingSync(tasks: TaskItem[], sessions: TimeSession[], logs: HabitDailyLog[]): number {
  const pendingTasks = tasks.filter((t) => t.sync_status === 1).length;
  const pendingSessions = sessions.filter((s) => s.sync_status === 1).length;
  const pendingLogs = logs.filter((l) => l.sync_status === 1).length;
  return pendingTasks + pendingSessions + pendingLogs;
}

/**
 * Calculate expected end timestamp for habit countdown notification
 */
export function calculateExpectedEndTimestamp(
  startedAtMs: number,
  targetDurationMs: number,
  accumulatedMs: number,
): number {
  const remainingMs = Math.max(0, targetDurationMs - accumulatedMs);
  return startedAtMs + remainingMs;
}

/**
 * Format notification timestamp to HH:MM:SS
 */
export function formatClockTime(timestampMs: number): string {
  const d = new Date(timestampMs);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Generates visual matrix cells for a 30 or 66 day habit cycle
 */
export function generateStreakMatrix(
  targetDays: number,
  currentStreak: number,
  logs: HabitDailyLog[],
  taskId: string,
): MatrixDayCell[] {
  const cells: MatrixDayCell[] = [];
  const taskLogs = logs.filter((l) => l.taskId === taskId);

  for (let i = 1; i <= targetDays; i++) {
    if (i <= currentStreak) {
      // Find matching log if available
      const log = taskLogs[i - 1];
      let status: MatrixDayStatus = 'completed_on_time';
      if (log?.recoveryType === 'shield') {
        status = 'frozen_by_shield';
      } else if (log?.recoveryType === 'makeup') {
        status = 'makeup_recovered';
      } else if (log?.recoveryType === 'missed') {
        status = 'missed';
      }
      cells.push({
        dayNumber: i,
        status,
        durationMs: log?.actualDurationMs,
        label: `Ngày ${i}`,
      });
    } else {
      cells.push({
        dayNumber: i,
        status: 'upcoming',
        label: `Ngày ${i}`,
      });
    }
  }

  return cells;
}

/**
 * Generates CSV string for export
 */
export function generateCSVExport(task: TaskItem, sessions: TimeSession[], logs: HabitDailyLog[]): string {
  const lines: string[] = [];
  lines.push(`Mã tác vụ,Tên tác vụ,Chế độ,Danh mục,Chuỗi hiện tại,Chuỗi kỷ lục,Định mức (phút)`);
  lines.push(
    `"${task.id}","${task.name}","${task.mode}","${task.category}",${task.currentStreak},${task.bestStreak},${Math.round(task.targetDurationMs / 60000)}`,
  );
  lines.push('');

  if (task.mode === 'project') {
    lines.push(`Lịch sử các phiên làm việc (Project Sessions)`);
    lines.push(`Mã phiên,Ngày logic,Bắt đầu,Kết thúc,Thời lượng (phút),Đã cắt gọt (phút)`);
    const taskSessions = sessions.filter((s) => s.taskId === task.id);
    for (const s of taskSessions) {
      lines.push(
        `"${s.id}","${s.logicalDate}","${new Date(s.startedAt).toLocaleString()}","${new Date(s.endedAt).toLocaleString()}",${(s.durationMs / 60000).toFixed(1)},${((s.trimmedMs || 0) / 60000).toFixed(1)}`,
      );
    }
  } else {
    lines.push(`Nhật ký chuỗi thói quen (Habit Logs)`);
    lines.push(`Mã log,Ngày logic,Hoàn thành,Thời lượng thực (phút),Loại ghi nhận,Thời điểm xác nhận`);
    const taskLogs = logs.filter((l) => l.taskId === task.id);
    for (const l of taskLogs) {
      lines.push(
        `"${l.id}","${l.logicalDate}",${l.completed ? 'Có' : 'Không'},${(l.actualDurationMs / 60000).toFixed(1)},"${l.recoveryType || 'on_time'}","${l.confirmedAt ? new Date(l.confirmedAt).toLocaleString() : ''}"`,
      );
    }
  }

  return lines.join('\n');
}

/**
 * Generates Markdown report string for export
 */
export function generateMarkdownExport(task: TaskItem, sessions: TimeSession[], logs: HabitDailyLog[]): string {
  const lines: string[] = [];
  lines.push(`# Báo Cáo Bền Bỉ: ${task.name}`);
  lines.push(`- **Chế độ**: ${task.mode === 'habit' ? 'Thói quen đếm ngược' : 'Đo lường dự án'}`);
  lines.push(`- **Danh mục**: ${task.category}`);
  lines.push(`- **Chuỗi hiện tại**: 🔥 ${task.currentStreak} ngày (Kỷ lục: ${task.bestStreak} ngày)`);
  lines.push(`- **Định mức**: ${Math.round(task.targetDurationMs / 60000)} phút`);
  lines.push(`- **Khiên Bền Bỉ**: 🛡️ ${task.shields} khiên`);
  lines.push('');

  if (task.mode === 'project') {
    const taskSessions = sessions.filter((s) => s.taskId === task.id);
    const totalMs = taskSessions.reduce((sum, s) => sum + s.durationMs, 0);
    lines.push(`### Thống kê tổng hợp`);
    lines.push(`- **Tổng thời gian tích lũy**: ${formatDuration(totalMs, true)}`);
    lines.push(`- **Tổng số phiên làm việc**: ${taskSessions.length}`);
    lines.push('');
    lines.push(`| Ngày logic | Bắt đầu | Kết thúc | Thời lượng | Đã cắt gọt |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);
    for (const s of taskSessions) {
      lines.push(
        `| ${s.logicalDate} | ${new Date(s.startedAt).toLocaleTimeString()} | ${new Date(s.endedAt).toLocaleTimeString()} | ${(s.durationMs / 60000).toFixed(0)}m | ${((s.trimmedMs || 0) / 60000).toFixed(0)}m |`,
      );
    }
  } else {
    const taskLogs = logs.filter((l) => l.taskId === task.id);
    lines.push(`### Nhật ký chuỗi thói quen (${taskLogs.length} ngày)`);
    lines.push(`| Ngày logic | Hoàn thành | Thời lượng | Kiểu ghi nhận |`);
    lines.push(`| :--- | :--- | :--- | :--- |`);
    for (const l of taskLogs) {
      lines.push(
        `| ${l.logicalDate} | ${l.completed ? '✅' : '❌'} | ${(l.actualDurationMs / 60000).toFixed(0)}m | ${l.recoveryType || 'on_time'} |`,
      );
    }
  }

  return lines.join('\n');
}

/**
 * Auto-Merge anonymous local data into cloud account data
 */
export function mergeLocalAndCloudData(
  local: { tasks: TaskItem[]; sessions: TimeSession[]; logs: HabitDailyLog[] },
  cloud: { tasks: TaskItem[]; sessions: TimeSession[]; logs: HabitDailyLog[] },
): { tasks: TaskItem[]; sessions: TimeSession[]; logs: HabitDailyLog[] } {
  const taskMap = new Map<string, TaskItem>();

  for (const cTask of cloud.tasks) {
    taskMap.set(cTask.id, { ...cTask, sync_status: 0 });
  }

  for (const lTask of local.tasks) {
    const existing = taskMap.get(lTask.id);
    if (!existing) {
      taskMap.set(lTask.id, { ...lTask, sync_status: 0 });
    } else {
      const mergedStreak = Math.max(existing.currentStreak, lTask.currentStreak);
      const mergedBest = Math.max(existing.bestStreak, lTask.bestStreak);
      const mergedShields = Math.max(existing.shields, lTask.shields);
      const isLocalRunning = lTask.status === 'running';

      taskMap.set(lTask.id, {
        ...(isLocalRunning ? lTask : existing),
        currentStreak: mergedStreak,
        bestStreak: mergedBest,
        shields: mergedShields,
        sync_status: 0,
        updated_at_ms: Math.max(existing.updated_at_ms, lTask.updated_at_ms),
      });
    }
  }

  const sessionMap = new Map<string, TimeSession>();
  for (const s of cloud.sessions) {
    sessionMap.set(s.id, { ...s, sync_status: 0 });
  }
  for (const s of local.sessions) {
    if (!sessionMap.has(s.id)) {
      sessionMap.set(s.id, { ...s, sync_status: 0 });
    }
  }

  const logMap = new Map<string, HabitDailyLog>();
  for (const l of cloud.logs) {
    logMap.set(l.id || `${l.taskId}-${l.logicalDate}`, { ...l, sync_status: 0 });
  }
  for (const l of local.logs) {
    const key = l.id || `${l.taskId}-${l.logicalDate}`;
    if (!logMap.has(key)) {
      logMap.set(key, { ...l, sync_status: 0 });
    }
  }

  return {
    tasks: Array.from(taskMap.values()),
    sessions: Array.from(sessionMap.values()).sort((a, b) => b.startedAt - a.startedAt),
    logs: Array.from(logMap.values()),
  };
}
