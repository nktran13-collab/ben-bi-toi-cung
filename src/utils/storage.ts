import {
  TaskItem,
  TimeSession,
  HabitDailyLog,
  UserAccount,
  getLogicalDate,
  mergeLocalAndCloudData,
} from './engine';

const STORAGE_KEYS = {
  TASKS: 'benbi_tasks_v2',
  SESSIONS: 'benbi_sessions_v2',
  HABIT_LOGS: 'benbi_habit_logs_v2',
  SETTINGS: 'benbi_settings_v2',
  USER_ACCOUNT: 'benbi_user_account_v2',
  SIMULATED_OFFLINE: 'benbi_simulated_offline_v2',
};

export interface AppSettings {
  soundEnabled: boolean;
  wakeLockRequested: boolean;
  dayRolloverHour: number; // default 4
  notificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  wakeLockRequested: true,
  dayRolloverHour: 4,
  notificationsEnabled: false,
};

const DEFAULT_ANONYMOUS_ACCOUNT: UserAccount = {
  id: `anon_${Math.random().toString(36).substring(2, 10)}`,
  email: null,
  isAnonymous: true,
  provider: 'anonymous',
  lastSyncedAtMs: null,
  createdAtMs: Date.now(),
};

// Initial realistic seed tasks with UUIDs and sync_status
export function getInitialSeedTasks(): {
  tasks: TaskItem[];
  sessions: TimeSession[];
  logs: HabitDailyLog[];
} {
  const now = Date.now();
  const DAY_MS = 24 * 3600 * 1000;

  const tasks: TaskItem[] = [
    {
      id: 'task-read-30-uuid',
      name: 'Đọc sách chuyên sâu',
      mode: 'habit',
      category: 'study',
      targetDurationMs: 30 * 60 * 1000,
      targetMilestoneDays: 30,
      currentStreak: 12,
      bestStreak: 15,
      shields: 1,
      inCompensationQuest: false,
      status: 'idle',
      startedAtMs: null,
      accumulatedMs: 0,
      historyStartTimestamp: now - 14 * DAY_MS,
      notes: 'Đọc ít nhất 30 phút mỗi ngày không xao nhãng.',
      sync_status: 0, // initially synced
      updated_at_ms: now - 3600000,
    },
    {
      id: 'task-meditation-15-uuid',
      name: 'Thiền chánh niệm & Thở sâu',
      mode: 'habit',
      category: 'health',
      targetDurationMs: 15 * 60 * 1000,
      targetMilestoneDays: 66,
      currentStreak: 21,
      bestStreak: 21,
      shields: 3,
      inCompensationQuest: false,
      status: 'idle',
      startedAtMs: null,
      accumulatedMs: 0,
      historyStartTimestamp: now - 25 * DAY_MS,
      notes: 'Thả lỏng cơ thể và tập trung hơi thở đầu ngày.',
      sync_status: 0,
      updated_at_ms: now - 7200000,
    },
    {
      id: 'task-project-frontend-uuid',
      name: 'Xây dựng Core Applet PWA',
      mode: 'project',
      category: 'work',
      targetDurationMs: 90 * 60 * 1000,
      targetMilestoneDays: 30,
      currentStreak: 6,
      bestStreak: 6,
      shields: 0,
      status: 'idle',
      startedAtMs: null,
      accumulatedMs: 25 * 60 * 1000,
      historyStartTimestamp: now - 10 * DAY_MS,
      notes: 'Thiết kế kiến trúc Offline-First và đồng bộ dữ liệu.',
      sync_status: 0,
      updated_at_ms: now - 1800000,
    },
    {
      id: 'task-pushups-core-uuid',
      name: 'Tập Hít đất & Thể lực',
      mode: 'habit',
      category: 'habit',
      targetDurationMs: 20 * 60 * 1000,
      targetMilestoneDays: 30,
      currentStreak: 6,
      bestStreak: 10,
      shields: 0,
      inCompensationQuest: false,
      status: 'idle',
      startedAtMs: null,
      accumulatedMs: 0,
      historyStartTimestamp: now - 7 * DAY_MS,
      notes: 'Duy trì sức bền cơ bắp và sự tỉnh táo.',
      sync_status: 0,
      updated_at_ms: now - 5000000,
    },
    {
      id: 'task-project-english-uuid',
      name: 'Luyện Nghe Nói Tiếng Anh',
      mode: 'project',
      category: 'study',
      targetDurationMs: 45 * 60 * 1000,
      targetMilestoneDays: 66,
      currentStreak: 8,
      bestStreak: 14,
      shields: 1,
      status: 'idle',
      startedAtMs: null,
      accumulatedMs: 0,
      historyStartTimestamp: now - 12 * DAY_MS,
      notes: 'Nghe podcast kỹ thuật và lặp lại shadow speaking.',
      sync_status: 0,
      updated_at_ms: now - 86400000,
    },
  ];

  const sessions: TimeSession[] = [];
  const logs: HabitDailyLog[] = [];

  for (let i = 1; i <= 10; i++) {
    const pastTime = now - i * DAY_MS;
    const logDate = getLogicalDate(pastTime, 4);

    sessions.push({
      id: `session-work-${i}-uuid`,
      taskId: 'task-project-frontend-uuid',
      logicalDate: logDate,
      startedAt: pastTime - 80 * 60 * 1000,
      endedAt: pastTime,
      durationMs: (60 + (i % 3) * 15) * 60 * 1000,
      sync_status: 0,
      updated_at_ms: pastTime,
    });

    sessions.push({
      id: `session-eng-${i}-uuid`,
      taskId: 'task-project-english-uuid',
      logicalDate: logDate,
      startedAt: pastTime - 45 * 60 * 1000,
      endedAt: pastTime,
      durationMs: 45 * 60 * 1000,
      sync_status: 0,
      updated_at_ms: pastTime,
    });

    logs.push({
      id: `log-read-${i}-uuid`,
      taskId: 'task-read-30-uuid',
      logicalDate: logDate,
      completed: true,
      actualDurationMs: 30 * 60 * 1000,
      confirmedAt: pastTime,
      sync_status: 0,
      updated_at_ms: pastTime,
    });
  }

  return { tasks, sessions, logs };
}

export function loadStoredData(): {
  tasks: TaskItem[];
  sessions: TimeSession[];
  logs: HabitDailyLog[];
  settings: AppSettings;
  account: UserAccount;
  simulatedOffline: boolean;
} {
  try {
    const rawTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
    const rawSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    const rawLogs = localStorage.getItem(STORAGE_KEYS.HABIT_LOGS);
    const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const rawAccount = localStorage.getItem(STORAGE_KEYS.USER_ACCOUNT);
    const rawSimOffline = localStorage.getItem(STORAGE_KEYS.SIMULATED_OFFLINE);

    const simulatedOffline = rawSimOffline === 'true';

    if (rawTasks && rawSessions && rawLogs) {
      return {
        tasks: JSON.parse(rawTasks),
        sessions: JSON.parse(rawSessions),
        logs: JSON.parse(rawLogs),
        settings: rawSettings ? JSON.parse(rawSettings) : DEFAULT_SETTINGS,
        account: rawAccount ? JSON.parse(rawAccount) : DEFAULT_ANONYMOUS_ACCOUNT,
        simulatedOffline,
      };
    }
  } catch (e) {
    console.warn('Failed to parse localStorage data, initializing seed', e);
  }

  const seed = getInitialSeedTasks();
  saveStoredData(seed.tasks, seed.sessions, seed.logs, DEFAULT_SETTINGS, DEFAULT_ANONYMOUS_ACCOUNT, false);
  return {
    tasks: seed.tasks,
    sessions: seed.sessions,
    logs: seed.logs,
    settings: DEFAULT_SETTINGS,
    account: DEFAULT_ANONYMOUS_ACCOUNT,
    simulatedOffline: false,
  };
}

export function saveStoredData(
  tasks: TaskItem[],
  sessions: TimeSession[],
  logs: HabitDailyLog[],
  settings?: AppSettings,
  account?: UserAccount,
  simulatedOffline?: boolean
) {
  try {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    localStorage.setItem(STORAGE_KEYS.HABIT_LOGS, JSON.stringify(logs));
    if (settings) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }
    if (account) {
      localStorage.setItem(STORAGE_KEYS.USER_ACCOUNT, JSON.stringify(account));
    }
    if (simulatedOffline !== undefined) {
      localStorage.setItem(STORAGE_KEYS.SIMULATED_OFFLINE, String(simulatedOffline));
    }
  } catch (e) {
    console.warn('LocalStorage save error', e);
  }
}

/**
 * Cloud Sync Simulation:
 * Synchronizes pending items (`sync_status === 1`) to the cloud storage table for the account.
 */
export async function syncDataToCloud(
  account: UserAccount,
  local: { tasks: TaskItem[]; sessions: TimeSession[]; logs: HabitDailyLog[] },
  isOffline: boolean
): Promise<{
  success: boolean;
  syncedTasks: TaskItem[];
  syncedSessions: TimeSession[];
  syncedLogs: HabitDailyLog[];
  updatedAccount: UserAccount;
  message: string;
}> {
  if (isOffline) {
    return {
      success: false,
      syncedTasks: local.tasks,
      syncedSessions: local.sessions,
      syncedLogs: local.logs,
      updatedAccount: account,
      message: 'Thiết bị đang ở chế độ Ngoại tuyến (Offline). Thay đổi được giữ trong hàng đợi cục bộ.',
    };
  }

  // Artificial network roundtrip delay
  await new Promise((resolve) => setTimeout(resolve, 400));

  const cloudKey = `benbi_cloud_db_${account.email || account.id}`;
  let cloudDb: { tasks: TaskItem[]; sessions: TimeSession[]; logs: HabitDailyLog[] } = {
    tasks: [],
    sessions: [],
    logs: [],
  };

  try {
    const rawCloud = localStorage.getItem(cloudKey);
    if (rawCloud) {
      cloudDb = JSON.parse(rawCloud);
    }
  } catch (e) {
    console.warn('Error reading cloud db', e);
  }

  // Auto-merge local with cloud
  const merged = mergeLocalAndCloudData(local, cloudDb);

  // Persist to cloud table
  try {
    localStorage.setItem(cloudKey, JSON.stringify(merged));
  } catch (e) {
    console.warn('Error saving to cloud table', e);
  }

  const updatedAccount: UserAccount = {
    ...account,
    lastSyncedAtMs: Date.now(),
  };

  return {
    success: true,
    syncedTasks: merged.tasks,
    syncedSessions: merged.sessions,
    syncedLogs: merged.logs,
    updatedAccount,
    message: 'Đã đồng bộ thành công toàn bộ dữ liệu lên đám mây.',
  };
}
