import type { TaskItem, TimeSession, HabitDailyLog, UserAccount } from './engine.ts';
import { getLogicalDate } from './engine.ts';
import { parseSnapshot, type SyncSnapshot } from './sync.ts';
import { dbDeleteCache, dbGetCache, dbPutCache } from './db.ts';

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
  darkMode?: boolean;
  devModeEnabled?: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  wakeLockRequested: true,
  dayRolloverHour: 4,
  notificationsEnabled: false,
  darkMode: false,
  devModeEnabled: false,
};

const ACTIVE_ACCOUNT_KEY = 'benbi_active_account_v3';
export const CACHE_NOTICE_KEY = 'benbi_cache_notice_v4';

export function anonymousAccount(): UserAccount {
  return {
    id: 'guest',
    email: null,
    isAnonymous: true,
    provider: 'anonymous',
    lastSyncedAtMs: null,
    createdAtMs: Date.now(),
  };
}

export interface LocalCache {
  snapshot: SyncSnapshot;
  account: UserAccount;
  initialized: boolean;
  acknowledged: SyncSnapshot | null;
  migrationEmail?: string;
}

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

export function cacheKey(id: string): string {
  return `benbi_state_v3_${id}`;
}

function preserveRecovery(key: string, raw: string): void {
  localStorage.setItem(`benbi_recovery_${Date.now()}_${crypto.randomUUID()}`, JSON.stringify({ key, raw }));
}

export function hasRecoveryData(): boolean {
  return Object.keys(localStorage).some(key => key.startsWith('benbi_recovery_'));
}

export function exportRecoveryJSON(): string {
  return JSON.stringify(Object.fromEntries(Object.keys(localStorage)
    .filter(key => key.startsWith('benbi_recovery_'))
    .map(key => [key, localStorage.getItem(key)])), null, 2);
}

function parseCacheRaw(raw: string, id: string): LocalCache | null {
  try {
    const cache = JSON.parse(raw) as LocalCache;
    const account = cache?.account;
    if (!account || account.id !== id || !id ||
      (account.email !== null && typeof account.email !== 'string') ||
      typeof account.isAnonymous !== 'boolean' ||
      !['anonymous', 'supabase'].includes(account.provider) ||
      !Number.isFinite(account.createdAtMs) ||
      (account.lastSyncedAtMs !== null && !Number.isFinite(account.lastSyncedAtMs)) ||
      typeof cache.initialized !== 'boolean' ||
      (cache.migrationEmail !== undefined && typeof cache.migrationEmail !== 'string')) {
      throw new Error('Thông tin bộ nhớ đệm không hợp lệ.');
    }
    const snapshot = parseSnapshot(cache.snapshot);
    let acknowledged: SyncSnapshot | null = null;
    try {
      acknowledged = cache.acknowledged === null ? null : parseSnapshot(cache.acknowledged);
    } catch {
      preserveRecovery(cacheKey(id), raw);
    }
    return {
      snapshot,
      account,
      initialized: cache.initialized,
      acknowledged,
      ...(cache.migrationEmail !== undefined ? { migrationEmail: cache.migrationEmail } : {}),
    };
  } catch {
    preserveRecovery(cacheKey(id), raw);
    return null;
  }
}

export async function readCache(id: string): Promise<LocalCache | null> {
  const stored = await dbGetCache(id);
  if (stored) return stored;

  // One-time migration from the pre-Dexie localStorage cache.
  const raw = localStorage.getItem(cacheKey(id));
  if (raw === null) return null;
  const parsed = parseCacheRaw(raw, id);
  if (!parsed) return null;
  if (await dbPutCache(parsed)) localStorage.removeItem(cacheKey(id));
  return parsed;
}

export async function writeCache(cache: LocalCache): Promise<void> {
  const id = cache.account.id;
  const stored = await dbPutCache(cache);
  if (stored) {
    localStorage.removeItem(cacheKey(id));
  } else {
    // IndexedDB unavailable (private mode/quota): keep the sync localStorage copy as fallback.
    localStorage.setItem(cacheKey(id), JSON.stringify(cache));
  }
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
  // Other tabs cannot observe IndexedDB writes, so a tiny notice drives cross-tab merges.
  localStorage.setItem(CACHE_NOTICE_KEY, JSON.stringify({ accountId: id, at: Date.now() }));
}

export async function clearAccountCache(id: string): Promise<void> {
  await dbDeleteCache(id);
  localStorage.removeItem(cacheKey(id));
}

function parseLegacySnapshot(data: {
  tasks: unknown;
  sessions?: unknown;
  logs?: unknown;
  settings?: unknown;
}): SyncSnapshot {
  if (data.settings !== undefined &&
    (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings))) {
    throw new Error('Cài đặt không hợp lệ.');
  }
  return parseSnapshot({
    version: 3,
    tasks: data.tasks,
    sessions: data.sessions === undefined ? [] : data.sessions,
    logs: data.logs === undefined ? [] : data.logs,
    settings: { ...DEFAULT_SETTINGS, ...data.settings },
    settingsUpdatedAtMs: 0,
    tombstones: [],
  });
}

export async function loadLocalCache(): Promise<LocalCache> {
  const activeId = localStorage.getItem(ACTIVE_ACCOUNT_KEY) || 'guest';
  const cached = await readCache(activeId);
  if (cached) return cached;

  const rawTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
  const rawSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
  const rawLogs = localStorage.getItem(STORAGE_KEYS.HABIT_LOGS);
  const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  const rawAccount = localStorage.getItem(STORAGE_KEYS.USER_ACCOUNT);
  let snapshot: SyncSnapshot;
  try {
    snapshot = [rawTasks, rawSessions, rawLogs, rawSettings].some(raw => raw !== null)
      ? parseLegacySnapshot({
        tasks: rawTasks === null ? [] : JSON.parse(rawTasks),
        sessions: rawSessions === null ? [] : JSON.parse(rawSessions),
        logs: rawLogs === null ? [] : JSON.parse(rawLogs),
        settings: rawSettings === null ? undefined : JSON.parse(rawSettings),
      })
      : parseLegacySnapshot(getCleanStarterTasks());
  } catch {
    preserveRecovery('legacy-v2', JSON.stringify({ rawTasks, rawSessions, rawLogs, rawSettings, rawAccount }));
    snapshot = parseLegacySnapshot(getCleanStarterTasks());
  }

  const cache: LocalCache = {
    snapshot,
    account: anonymousAccount(),
    initialized: true,
    acknowledged: null,
  };
  try {
    const legacyAccount = rawAccount === null ? null : JSON.parse(rawAccount);
    if (legacyAccount && ['email_sync', 'mock_otp'].includes(legacyAccount.provider) &&
      typeof legacyAccount.email === 'string' && legacyAccount.email.trim()) {
      cache.migrationEmail = legacyAccount.email.trim().toLowerCase();
    }
  } catch {}

  // Remove legacy copies only after the guest snapshot is safely persisted.
  await writeCache(cache);
  for (const key of Object.values(STORAGE_KEYS)) localStorage.removeItem(key);
  localStorage.removeItem('benbi_cross_tab_event');
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith('benbi_cloud_db_')) localStorage.removeItem(key);
  }
  return cache;
}

/**
 * Returns clean Day-0 starter templates for a fresh personal journey
 */
export function getCleanStarterTasks(): {
  tasks: TaskItem[];
  sessions: TimeSession[];
  logs: HabitDailyLog[];
} {
  const now = Date.now();
  const seed = getInitialSeedTasks();
  const cleanTasks: TaskItem[] = seed.tasks.map((t) => ({
    ...t,
    currentStreak: 0,
    bestStreak: 0,
    shields: 0,
    inCompensationQuest: false,
    status: 'idle',
    startedAtMs: null,
    accumulatedMs: 0,
    lastCompletedDate: undefined,
    lastStreakCheckDate: undefined,
    historyStartTimestamp: now,
    sync_status: 1,
    updated_at_ms: now,
  }));
  return {
    tasks: cleanTasks,
    sessions: [],
    logs: [],
  };
}

export interface FullBackupPayload {
  version: number;
  app: string;
  exportedAt: string;
  tasks: TaskItem[];
  sessions: TimeSession[];
  logs: HabitDailyLog[];
  settings?: AppSettings;
}

export function exportFullBackupJSON(
  tasks: TaskItem[],
  sessions: TimeSession[],
  logs: HabitDailyLog[],
  settings?: AppSettings
): string {
  const payload: FullBackupPayload = {
    version: 2,
    app: 'ben-bi-toi-cung',
    exportedAt: new Date().toISOString(),
    tasks,
    sessions,
    logs,
    settings,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseFullBackupJSON(jsonStr: string): {
  tasks: TaskItem[];
  sessions: TimeSession[];
  logs: HabitDailyLog[];
  settings: AppSettings;
} | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || !Array.isArray(parsed.tasks)) return null;
    const snapshot = parseLegacySnapshot(parsed);
    return {
      tasks: snapshot.tasks,
      sessions: snapshot.sessions,
      logs: snapshot.logs,
      settings: snapshot.settings,
    };
  } catch {
    return null;
  }
}
