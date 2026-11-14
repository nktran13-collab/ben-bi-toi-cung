import type { TaskItem, TimeSession, HabitDailyLog } from './engine.ts';
import type { AppSettings } from './storage.ts';

export const collections = ['tasks', 'sessions', 'logs'] as const;
export type Collection = (typeof collections)[number];
export interface Tombstone {
  kind: Collection;
  id: string;
  updated_at_ms: number;
}
export interface SyncSnapshot {
  version: 3;
  tasks: TaskItem[];
  sessions: TimeSession[];
  logs: HabitDailyLog[];
  settings: AppSettings;
  settingsUpdatedAtMs: number;
  tombstones: Tombstone[];
}

type SyncRecord = { id: string; updated_at_ms: number; sync_status: number };

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key, item]) => key !== 'sync_status' && item !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

export function fingerprint(value: unknown): string {
  return JSON.stringify(canonical(value));
}

export function snapshotFingerprint(data: SyncSnapshot): string {
  const byId = <T extends { id: string }>(items: T[]) =>
    [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return fingerprint({
    ...data,
    tasks: byId(data.tasks),
    sessions: byId(data.sessions),
    logs: byId(data.logs),
    tombstones: [...data.tombstones].sort((a, b) => (`${a.kind}:${a.id}` < `${b.kind}:${b.id}` ? -1 : 1)),
  });
}

function mergeRecords<T extends SyncRecord>(local: T[], remote: T[], deleted: Map<string, number>): T[] {
  const result = new Map<string, T>();
  for (const item of [...local, ...remote]) {
    if ((deleted.get(item.id) ?? -1) >= item.updated_at_ms) continue;
    const previous = result.get(item.id);
    if (
      !previous ||
      item.updated_at_ms > previous.updated_at_ms ||
      (item.updated_at_ms === previous.updated_at_ms && fingerprint(item) > fingerprint(previous))
    ) {
      result.set(item.id, item);
    }
  }
  return [...result.values()];
}

export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot): SyncSnapshot {
  const deleted = new Map<string, Tombstone>();
  for (const item of [...local.tombstones, ...remote.tombstones]) {
    const key = `${item.kind}:${item.id}`;
    if (!deleted.has(key) || deleted.get(key)!.updated_at_ms < item.updated_at_ms) deleted.set(key, item);
  }
  const tombstones = [...deleted.values()];
  const mapFor = (kind: Collection) =>
    new Map(tombstones.filter((t) => t.kind === kind).map((t) => [t.id, t.updated_at_ms]));
  const taskDeletes = mapFor('tasks');
  const tasks = mergeRecords(local.tasks, remote.tasks, taskDeletes);
  const taskIds = new Set(tasks.map((t) => t.id));
  const hasParent = (item: TimeSession | HabitDailyLog) =>
    taskIds.has(item.taskId) && (taskDeletes.get(item.taskId) ?? -1) < item.updated_at_ms;
  const useRemoteSettings =
    remote.settingsUpdatedAtMs > local.settingsUpdatedAtMs ||
    (remote.settingsUpdatedAtMs === local.settingsUpdatedAtMs &&
      fingerprint(remote.settings) > fingerprint(local.settings));
  return {
    version: 3,
    tasks,
    sessions: mergeRecords(local.sessions, remote.sessions, mapFor('sessions')).filter(hasParent),
    logs: mergeRecords(local.logs, remote.logs, mapFor('logs')).filter(hasParent),
    settings: useRemoteSettings ? remote.settings : local.settings,
    settingsUpdatedAtMs: Math.max(local.settingsUpdatedAtMs, remote.settingsUpdatedAtMs),
    tombstones,
  };
}

export function recordLocalChanges(previous: SyncSnapshot, next: SyncSnapshot, now = Date.now()): SyncSnapshot {
  const result = { ...next, tombstones: [...previous.tombstones] };
  for (const kind of collections) {
    const old = new Map<string, SyncRecord>(previous[kind].map((item) => [item.id, item]));
    const present = new Set(next[kind].map((item) => item.id));
    for (const item of previous[kind]) {
      if (!present.has(item.id))
        result.tombstones.push({ kind, id: item.id, updated_at_ms: Math.max(now, item.updated_at_ms + 1) });
    }
    const items = next[kind].map((item) => {
      const before = old.get(item.id);
      if (before && fingerprint(before) === fingerprint(item)) return before;
      const deletedAt = previous.tombstones
        .filter((t) => t.kind === kind && t.id === item.id)
        .reduce((time, t) => Math.max(time, t.updated_at_ms), 0);
      return { ...item, sync_status: 1, updated_at_ms: Math.max(now, (before?.updated_at_ms ?? 0) + 1, deletedAt + 1) };
    });
    Object.assign(result, { [kind]: items });
  }
  if (fingerprint(previous.settings) !== fingerprint(next.settings)) {
    result.settingsUpdatedAtMs = Math.max(now, previous.settingsUpdatedAtMs + 1);
  }
  const deleted = new Map<string, Tombstone>();
  for (const t of result.tombstones) {
    const key = `${t.kind}:${t.id}`;
    if (!deleted.has(key) || deleted.get(key)!.updated_at_ms < t.updated_at_ms) deleted.set(key, t);
  }
  result.tombstones = [...deleted.values()];
  return result;
}

export function acknowledgeSnapshot(current: SyncSnapshot, saved: SyncSnapshot): SyncSnapshot {
  const merged = mergeSnapshots(current, saved);
  for (const kind of collections) {
    const acknowledged = new Map<string, SyncRecord>(saved[kind].map((item) => [item.id, item]));
    Object.assign(merged, {
      [kind]: merged[kind].map((item) => ({
        ...item,
        sync_status: fingerprint(item) === fingerprint(acknowledged.get(item.id)) ? 0 : 1,
      })),
    });
  }
  return merged;
}

export function pendingChanges(current: SyncSnapshot, saved: SyncSnapshot | null): number {
  if (saved && snapshotFingerprint(current) === snapshotFingerprint(saved)) return 0;
  let count = 0;
  for (const kind of collections) {
    const known = new Map<string, SyncRecord>((saved?.[kind] ?? []).map((item) => [item.id, item]));
    count += current[kind].filter((item) => fingerprint(item) !== fingerprint(known.get(item.id))).length;
  }
  const knownDeletes = new Set(saved?.tombstones.map(fingerprint));
  count += current.tombstones.filter((t) => !knownDeletes.has(fingerprint(t))).length;
  if (
    !saved ||
    fingerprint(current.settings) !== fingerprint(saved.settings) ||
    current.settingsUpdatedAtMs !== saved.settingsUpdatedAtMs
  )
    count++;
  return count;
}

export function parseSnapshot(value: unknown): SyncSnapshot {
  const data = value as SyncSnapshot;
  const validRecord = (item: SyncRecord) =>
    item &&
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    Number.isFinite(item.updated_at_ms) &&
    item.updated_at_ms >= 0 &&
    [0, 1].includes(item.sync_status);
  if (
    !data ||
    data.version !== 3 ||
    !collections.every((kind) => Array.isArray(data[kind]) && data[kind].every(validRecord)) ||
    !data.settings ||
    typeof data.settings.soundEnabled !== 'boolean' ||
    typeof data.settings.wakeLockRequested !== 'boolean' ||
    !Number.isInteger(data.settings.dayRolloverHour) ||
    data.settings.dayRolloverHour < 0 ||
    data.settings.dayRolloverHour > 23 ||
    typeof data.settings.notificationsEnabled !== 'boolean' ||
    (data.settings.darkMode !== undefined && typeof data.settings.darkMode !== 'boolean') ||
    (data.settings.devModeEnabled !== undefined && typeof data.settings.devModeEnabled !== 'boolean') ||
    !Number.isFinite(data.settingsUpdatedAtMs) ||
    data.settingsUpdatedAtMs < 0 ||
    !Array.isArray(data.tombstones) ||
    !data.tombstones.every((t) => validRecord({ ...t, sync_status: 0 }) && collections.includes(t.kind))
  ) {
    throw new Error('Dữ liệu đồng bộ không hợp lệ. Bản trên thiết bị chưa bị thay thế.');
  }
  if (
    !data.tasks.every(
      (t) =>
        typeof t.name === 'string' &&
        ['habit', 'project'].includes(t.mode) &&
        ['health', 'work', 'study', 'habit'].includes(t.category) &&
        ['idle', 'running', 'paused', 'pending_confirmation', 'completed_today'].includes(t.status) &&
        [t.targetDurationMs, t.currentStreak, t.bestStreak, t.shields, t.accumulatedMs, t.historyStartTimestamp].every(
          Number.isFinite,
        ) &&
        (t.startedAtMs === null || Number.isFinite(t.startedAtMs)),
    ) ||
    !data.sessions.every(
      (s) =>
        typeof s.taskId === 'string' &&
        typeof s.logicalDate === 'string' &&
        [s.startedAt, s.endedAt, s.durationMs].every(Number.isFinite),
    ) ||
    !data.logs.every(
      (l) =>
        typeof l.taskId === 'string' &&
        typeof l.logicalDate === 'string' &&
        typeof l.completed === 'boolean' &&
        Number.isFinite(l.actualDurationMs),
    )
  ) {
    throw new Error('Bản ghi tác vụ hoặc lịch sử không hợp lệ.');
  }
  return data;
}
