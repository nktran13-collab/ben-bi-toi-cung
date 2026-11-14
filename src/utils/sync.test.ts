import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { TaskItem, TimeSession, HabitDailyLog } from './engine.ts';
import type { AppSettings } from './storage.ts';
import type { Collection, SyncSnapshot, Tombstone } from './sync.ts';
import {
  acknowledgeSnapshot,
  collections,
  fingerprint,
  mergeSnapshots,
  parseSnapshot,
  pendingChanges,
  recordLocalChanges,
  snapshotFingerprint,
} from './sync.ts';

function task(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: 't1',
    name: 'Read',
    mode: 'habit',
    category: 'study',
    targetDurationMs: 60_000,
    currentStreak: 0,
    bestStreak: 0,
    shields: 0,
    status: 'idle',
    startedAtMs: null,
    accumulatedMs: 0,
    historyStartTimestamp: 0,
    sync_status: 0,
    updated_at_ms: 100,
    ...overrides,
  };
}

function session(overrides: Partial<TimeSession> = {}): TimeSession {
  return {
    id: 's1',
    taskId: 't1',
    logicalDate: '2026-11-06',
    startedAt: 0,
    endedAt: 60_000,
    durationMs: 60_000,
    sync_status: 0,
    updated_at_ms: 100,
    ...overrides,
  };
}

function log(overrides: Partial<HabitDailyLog> = {}): HabitDailyLog {
  return {
    id: 'l1',
    taskId: 't1',
    logicalDate: '2026-11-06',
    completed: false,
    actualDurationMs: 60_000,
    sync_status: 0,
    updated_at_ms: 100,
    ...overrides,
  };
}

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    soundEnabled: true,
    wakeLockRequested: true,
    dayRolloverHour: 4,
    notificationsEnabled: false,
    ...overrides,
  };
}

function snapshot(overrides: Partial<SyncSnapshot> = {}): SyncSnapshot {
  return {
    version: 3,
    tasks: [],
    sessions: [],
    logs: [],
    settings: settings(),
    settingsUpdatedAtMs: 100,
    tombstones: [],
    ...overrides,
  };
}

function populated(updated_at_ms = 100): SyncSnapshot {
  return snapshot({
    tasks: [task({ updated_at_ms })],
    sessions: [session({ updated_at_ms })],
    logs: [log({ updated_at_ms })],
  });
}

function deletesFor(data: SyncSnapshot, updated_at_ms: number): Tombstone[] {
  return collections.flatMap((kind) => data[kind].map(({ id }) => ({ kind, id, updated_at_ms })));
}

function reverseCollections(data: SyncSnapshot): SyncSnapshot {
  return {
    ...data,
    tasks: [...data.tasks].reverse(),
    sessions: [...data.sessions].reverse(),
    logs: [...data.logs].reverse(),
    tombstones: [...data.tombstones].reverse(),
  };
}

function ids(data: SyncSnapshot, kind: Collection): string[] {
  return data[kind].map((item) => item.id).sort();
}

for (const kind of collections) {
  for (const newerSide of ['local', 'remote'] as const) {
    test(`mergeSnapshots uses LWW for ${kind} when ${newerSide} is newer`, () => {
      const older = snapshot({
        tasks: [task({ name: 'Z old', currentStreak: 9 }), task({ id: 'older-only' })],
        sessions: [session(), session({ id: 'older-only' })],
        logs: [log({ completed: true }), log({ id: 'older-only' })],
      });
      const newer = snapshot({
        tasks: [task({ name: 'A new', currentStreak: 1, updated_at_ms: 200 }), task({ id: 'newer-only' })],
        sessions: [session({ durationMs: 1_000, endedAt: 1_000, updated_at_ms: 200 }), session({ id: 'newer-only' })],
        logs: [log({ completed: false, actualDurationMs: 1_000, updated_at_ms: 200 }), log({ id: 'newer-only' })],
      });
      const merged = newerSide === 'local' ? mergeSnapshots(newer, older) : mergeSnapshots(older, newer);
      const expected = newer[kind][0];
      assert.deepEqual(
        merged[kind].find((item) => item.id === expected.id),
        expected,
      );
      assert.deepEqual(ids(merged, kind), [expected.id, 'older-only', 'newer-only'].sort());
    });
  }
}

test('equal-timestamp conflicts converge by fingerprint with both inputs and all arrays reversed', () => {
  const left = snapshot({
    tasks: [task({ name: 'A' }), task({ id: 'other', sync_status: 1 })],
    sessions: [session({ durationMs: 10 }), session({ id: 'other', sync_status: 1 })],
    logs: [log({ completed: false }), log({ id: 'other', sync_status: 1 })],
    settings: settings({ darkMode: false }),
    tombstones: [{ kind: 'tasks', id: 'gone-a', updated_at_ms: 50 }],
  });
  const right = snapshot({
    tasks: [task({ name: 'Z' }), task({ id: 'other' })],
    sessions: [session({ durationMs: 20 }), session({ id: 'other' })],
    logs: [log({ completed: true }), log({ id: 'other' })],
    settings: settings({ darkMode: true }),
    tombstones: [{ kind: 'logs', id: 'gone-b', updated_at_ms: 60 }],
  });
  const originalLeft = structuredClone(left);
  const originalRight = structuredClone(right);
  const merged = mergeSnapshots(left, right);
  assert.equal(merged.tasks.find((item) => item.id === 't1')?.name, 'Z');
  assert.equal(merged.sessions.find((item) => item.id === 's1')?.durationMs, 20);
  assert.equal(merged.logs.find((item) => item.id === 'l1')?.completed, true);
  assert.equal(merged.settings.darkMode, true);
  for (const [a, b] of [
    [right, left],
    [reverseCollections(left), reverseCollections(right)],
    [reverseCollections(right), reverseCollections(left)],
    [merged, merged],
  ]) {
    assert.equal(snapshotFingerprint(mergeSnapshots(a, b)), snapshotFingerprint(merged));
  }
  assert.deepEqual(left, originalLeft);
  assert.deepEqual(right, originalRight);
});

test('fingerprint canonicalizes object keys and ignores sync_status and undefined properties', () => {
  assert.equal(
    fingerprint({ b: { y: 2, x: 1, sync_status: 1 }, a: [task({ sync_status: 1, notes: undefined })] }),
    fingerprint({ a: [task()], b: { x: 1, y: 2, sync_status: 0 } }),
  );
  assert.notEqual(fingerprint(task()), fingerprint(task({ name: 'Different' })));
  assert.notEqual(fingerprint(task()), fingerprint(task({ updated_at_ms: 101 })));
});

test('duplicates within and across snapshots deduplicate by collection and ID, keeping newest records and tombstones', () => {
  const left = snapshot({
    tasks: [task({ id: 'same', updated_at_ms: 200 }), task({ id: 'same' })],
    sessions: [session({ id: 'same', taskId: 'same' }), session({ id: 'same', taskId: 'same', updated_at_ms: 200 })],
    logs: [log({ id: 'same', taskId: 'same' }), log({ id: 'same', taskId: 'same' })],
    tombstones: collections.flatMap((kind) => [
      { kind, id: 'gone', updated_at_ms: 10 },
      { kind, id: 'gone', updated_at_ms: 30 },
    ]),
  });
  const right = snapshot({
    tasks: [task({ id: 'same', updated_at_ms: 200 }), task({ id: 'same', updated_at_ms: 150 })],
    sessions: [session({ id: 'same', taskId: 'same' })],
    logs: [log({ id: 'same', taskId: 'same', updated_at_ms: 200 }), log({ id: 'same', taskId: 'same' })],
    tombstones: collections.map((kind) => ({ kind, id: 'gone', updated_at_ms: 20 })),
  });
  const merged = mergeSnapshots(left, right);
  for (const kind of collections) {
    assert.deepEqual(ids(merged, kind), ['same']);
    assert.equal(merged[kind][0].updated_at_ms, 200);
    assert.deepEqual(
      merged.tombstones.filter((t) => t.kind === kind),
      [{ kind, id: 'gone', updated_at_ms: 30 }],
    );
  }
  assert.equal(
    snapshotFingerprint(merged),
    snapshotFingerprint(mergeSnapshots(reverseCollections(right), reverseCollections(left))),
  );
});

for (const kind of collections) {
  for (const timestamp of [99, 100]) {
    test(`${kind} deletion wins over a record at timestamp ${timestamp} when deleted at 100`, () => {
      const records = populated(timestamp);
      const deleted = snapshot({ tombstones: [{ kind, id: records[kind][0].id, updated_at_ms: 100 }] });
      for (const merged of [mergeSnapshots(records, deleted), mergeSnapshots(deleted, records)]) {
        assert.deepEqual(merged[kind], []);
        assert.deepEqual(merged.tombstones, deleted.tombstones);
      }
    });
  }
}

test('explicit recreation newer than tombstones survives for all three collections', () => {
  const deleted = snapshot({ tombstones: deletesFor(populated(), 200) });
  const recreated = populated(201);
  for (const merged of [mergeSnapshots(deleted, recreated), mergeSnapshots(recreated, deleted)]) {
    for (const kind of collections) assert.deepEqual(merged[kind], recreated[kind]);
    assert.deepEqual(merged.tombstones, deleted.tombstones);
  }
});

test('a recreated parent suppresses children older than or tied with its deletion, but retains newer children', () => {
  const deleted = snapshot({ tombstones: [{ kind: 'tasks', id: 't1', updated_at_ms: 200 }] });
  const recreated = snapshot({
    tasks: [task({ updated_at_ms: 201 })],
    sessions: [
      session({ id: 'older', updated_at_ms: 199 }),
      session({ id: 'tie', updated_at_ms: 200 }),
      session({ id: 'new', updated_at_ms: 201 }),
    ],
    logs: [
      log({ id: 'older', updated_at_ms: 199 }),
      log({ id: 'tie', updated_at_ms: 200 }),
      log({ id: 'new', updated_at_ms: 201 }),
    ],
  });
  for (const merged of [mergeSnapshots(deleted, recreated), mergeSnapshots(recreated, deleted)]) {
    assert.deepEqual(merged.tasks, recreated.tasks);
    assert.deepEqual(ids(merged, 'sessions'), ['new']);
    assert.deepEqual(ids(merged, 'logs'), ['new']);
  }
});

test('children without a live parent are suppressed even when newer than the parent deletion', () => {
  const records = snapshot({
    tasks: [task()],
    sessions: [session({ updated_at_ms: 300 }), session({ id: 'orphan', taskId: 'missing', updated_at_ms: 300 })],
    logs: [log({ updated_at_ms: 300 }), log({ id: 'orphan', taskId: 'missing', updated_at_ms: 300 })],
  });
  const deleted = snapshot({ tombstones: [{ kind: 'tasks', id: 't1', updated_at_ms: 200 }] });
  const merged = mergeSnapshots(records, deleted);
  for (const kind of collections) assert.deepEqual(merged[kind], []);
});

test('repeated offline stale snapshots and their acknowledgements cannot resurrect deleted data', () => {
  const offline = populated();
  const local = recordLocalChanges(offline, snapshot(), 200);
  const cloud = mergeSnapshots(offline, local);
  assert.equal(cloud.tombstones.length, 3);
  const reconnected = mergeSnapshots(offline, cloud);
  const acknowledged = acknowledgeSnapshot(reconnected, cloud);
  for (const data of [
    cloud,
    reconnected,
    acknowledged,
    mergeSnapshots(acknowledged, offline),
    mergeSnapshots(offline, acknowledged),
  ]) {
    for (const kind of collections) assert.deepEqual(data[kind], []);
    assert.deepEqual(data.tombstones, local.tombstones);
  }
  assert.equal(pendingChanges(acknowledged, cloud), 0);
});

test('recordLocalChanges stamps additions/edits, preserves unchanged rows, and creates/deduplicates tombstones', () => {
  const previous = snapshot({
    tasks: [task(), task({ id: 'keep', updated_at_ms: 90 }), task({ id: 'remove', updated_at_ms: 95 })],
    sessions: [session(), session({ id: 'keep', updated_at_ms: 90 }), session({ id: 'remove', updated_at_ms: 95 })],
    logs: [log(), log({ id: 'keep', updated_at_ms: 90 }), log({ id: 'remove', updated_at_ms: 95 })],
    tombstones: [
      { kind: 'tasks', id: 'historical', updated_at_ms: 10 },
      { kind: 'tasks', id: 'historical', updated_at_ms: 20 },
    ],
  });
  const next = snapshot({
    tasks: [
      task({ name: 'Edited' }),
      task({ id: 'keep', updated_at_ms: 90, sync_status: 1 }),
      task({ id: 'add', updated_at_ms: 0 }),
    ],
    sessions: [
      session({ durationMs: 30_000 }),
      session({ id: 'keep', updated_at_ms: 90, sync_status: 1 }),
      session({ id: 'add', updated_at_ms: 0 }),
    ],
    logs: [
      log({ completed: true }),
      log({ id: 'keep', updated_at_ms: 90, sync_status: 1 }),
      log({ id: 'add', updated_at_ms: 0 }),
    ],
  });
  const originalPrevious = structuredClone(previous);
  const originalNext = structuredClone(next);
  const result = recordLocalChanges(previous, next, 100);
  for (const kind of collections) {
    assert.deepEqual(result[kind][0], { ...next[kind][0], updated_at_ms: 101, sync_status: 1 });
    assert.deepEqual(result[kind][1], previous[kind][1]);
    assert.deepEqual(result[kind][2], { ...next[kind][2], updated_at_ms: 100, sync_status: 1 });
    assert.deepEqual(
      result.tombstones.filter((t) => t.kind === kind && t.id === 'remove'),
      [{ kind, id: 'remove', updated_at_ms: 100 }],
    );
  }
  assert.deepEqual(
    result.tombstones.filter((t) => t.id === 'historical'),
    [{ kind: 'tasks', id: 'historical', updated_at_ms: 20 }],
  );
  assert.deepEqual(previous, originalPrevious);
  assert.deepEqual(next, originalNext);
});

test('same-millisecond edits, deletion, recreation, and clock rollback stay strictly monotonic', () => {
  let current = populated();
  for (const [now, expected] of [
    [100, 101],
    [100, 102],
    [1, 103],
  ]) {
    current = recordLocalChanges(
      current,
      {
        ...current,
        tasks: current.tasks.map((t) => ({ ...t, name: `${t.name}!` })),
        sessions: current.sessions.map((s) => ({ ...s, durationMs: s.durationMs + 1 })),
        logs: current.logs.map((l) => ({ ...l, completed: !l.completed })),
      },
      now,
    );
    for (const kind of collections) {
      assert.equal(current[kind][0].updated_at_ms, expected);
      assert.equal(current[kind][0].sync_status, 1);
    }
  }
  for (const deletedAt of [104, 106]) {
    const deleted = recordLocalChanges(current, { ...current, tasks: [], sessions: [], logs: [] }, 100);
    for (const kind of collections) {
      assert.deepEqual(deleted[kind], []);
      assert.deepEqual(
        deleted.tombstones.filter((t) => t.kind === kind),
        [{ kind, id: current[kind][0].id, updated_at_ms: deletedAt }],
      );
    }
    current = recordLocalChanges(deleted, populated(), 100);
    for (const kind of collections) {
      assert.equal(current[kind][0].updated_at_ms, deletedAt + 1);
      assert.equal(current[kind][0].sync_status, 1);
    }
    assert.equal(snapshotFingerprint(mergeSnapshots(current, deleted)), snapshotFingerprint(current));
  }
});

test('recordLocalChanges does not timestamp sync_status-only changes or reordering', () => {
  const previous = snapshot({
    tasks: [task(), task({ id: 'other' })],
    sessions: [session(), session({ id: 'other' })],
    logs: [log(), log({ id: 'other' })],
  });
  const next = reverseCollections({
    ...previous,
    tasks: previous.tasks.map((t) => ({ ...t, sync_status: 1 })),
    sessions: previous.sessions.map((s) => ({ ...s, sync_status: 1 })),
    logs: previous.logs.map((l) => ({ ...l, sync_status: 1 })),
  });
  const result = recordLocalChanges(previous, next, 500);
  assert.equal(snapshotFingerprint(result), snapshotFingerprint(previous));
  for (const kind of collections)
    assert.ok(result[kind].every((item) => item.sync_status === 0 && item.updated_at_ms === 100));
  assert.equal(result.settingsUpdatedAtMs, previous.settingsUpdatedAtMs);
  assert.deepEqual(result.tombstones, []);
});

test('settings use whole-object LWW in either direction, with deterministic equal-timestamp ties', () => {
  const older = snapshot({ settings: settings({ soundEnabled: true, darkMode: true }), settingsUpdatedAtMs: 100 });
  const newer = snapshot({ settings: settings({ soundEnabled: false, darkMode: false }), settingsUpdatedAtMs: 200 });
  for (const merged of [mergeSnapshots(older, newer), mergeSnapshots(newer, older)]) {
    assert.deepEqual(merged.settings, newer.settings);
    assert.equal(merged.settingsUpdatedAtMs, 200);
  }
  const tied = { ...newer, settingsUpdatedAtMs: 100 };
  for (const merged of [mergeSnapshots(older, tied), mergeSnapshots(tied, older)]) {
    assert.deepEqual(merged.settings, older.settings);
    assert.equal(merged.settingsUpdatedAtMs, 100);
  }
});

test('local settings changes advance monotonically in the same millisecond and after clock rollback', () => {
  let current = snapshot();
  for (const [now, expected] of [
    [100, 101],
    [100, 102],
    [1, 103],
    [500, 500],
  ]) {
    current = recordLocalChanges(
      current,
      {
        ...current,
        settings: { ...current.settings, soundEnabled: !current.settings.soundEnabled },
      },
      now,
    );
    assert.equal(current.settingsUpdatedAtMs, expected);
  }
  const unchanged = recordLocalChanges(current, structuredClone(current), 1_000);
  assert.equal(unchanged.settingsUpdatedAtMs, 500);
});

test('an acknowledgement arriving after newer local edits leaves those edits and settings pending', () => {
  const sent = snapshot({
    tasks: [task({ sync_status: 1 }), task({ id: 'unchanged', sync_status: 1 })],
    sessions: [session({ sync_status: 1 }), session({ id: 'unchanged', sync_status: 1 })],
    logs: [log({ sync_status: 1 }), log({ id: 'unchanged', sync_status: 1 })],
  });
  const current = recordLocalChanges(
    sent,
    {
      ...sent,
      tasks: [task({ name: 'Edited while sending' }), sent.tasks[1]],
      sessions: [session({ durationMs: 30_000 }), sent.sessions[1]],
      logs: [log({ completed: true }), sent.logs[1]],
      settings: settings({ soundEnabled: false }),
    },
    100,
  );
  const originalCurrent = structuredClone(current);
  const originalSent = structuredClone(sent);
  const acknowledged = acknowledgeSnapshot(current, sent);
  for (const kind of collections) {
    assert.deepEqual(acknowledged[kind][0], current[kind][0]);
    assert.equal(acknowledged[kind][0].sync_status, 1);
    assert.equal(acknowledged[kind].find((item) => item.id === 'unchanged')?.sync_status, 0);
  }
  assert.deepEqual(acknowledged.settings, current.settings);
  assert.equal(acknowledged.settingsUpdatedAtMs, 101);
  assert.equal(pendingChanges(acknowledged, sent), 4);
  const finallyAcknowledged = acknowledgeSnapshot(acknowledged, current);
  for (const kind of collections) assert.ok(finallyAcknowledged[kind].every((item) => item.sync_status === 0));
  assert.equal(pendingChanges(finallyAcknowledged, current), 0);
  assert.deepEqual(current, originalCurrent);
  assert.deepEqual(sent, originalSent);
});

test('a delayed acknowledgement cannot undo newer local deletions', () => {
  const sent = populated();
  const current = recordLocalChanges(sent, snapshot(), 100);
  const acknowledged = acknowledgeSnapshot(current, sent);
  for (const kind of collections) assert.deepEqual(acknowledged[kind], []);
  assert.deepEqual(acknowledged.tombstones, current.tombstones);
  assert.equal(pendingChanges(acknowledged, sent), 3);
});

test('records created after a snapshot was sent remain pending when that snapshot is acknowledged', () => {
  const sent = snapshot();
  const current = recordLocalChanges(sent, populated(), 200);
  const acknowledged = acknowledgeSnapshot(current, sent);
  for (const kind of collections) {
    assert.deepEqual(acknowledged[kind], current[kind]);
    assert.equal(acknowledged[kind][0].sync_status, 1);
  }
  assert.equal(pendingChanges(acknowledged, sent), 3);
});

test('pendingChanges is zero for equal content despite sync_status, key order, or collection/tombstone order', () => {
  const saved = snapshot({
    tasks: [task(), task({ id: 'other' })],
    sessions: [session(), session({ id: 'other' })],
    logs: [log(), log({ id: 'other' })],
    tombstones: collections.map((kind) => ({ kind, id: 'gone', updated_at_ms: 50 })),
  });
  const current = reverseCollections({
    ...saved,
    tasks: saved.tasks.map((t) => ({ ...t, sync_status: 1 })),
    sessions: saved.sessions.map((s) => ({ ...s, sync_status: 1 })),
    logs: saved.logs.map((l) => ({ ...l, sync_status: 1 })),
    settings: { notificationsEnabled: false, dayRolloverHour: 4, wakeLockRequested: true, soundEnabled: true },
  });
  assert.equal(snapshotFingerprint(current), snapshotFingerprint(saved));
  assert.equal(pendingChanges(current, saved), 0);
  assert.equal(pendingChanges(saved, current), 0);
});

test('pendingChanges counts content changes even with sync_status zero', () => {
  const saved = populated();
  const current = snapshot({
    tasks: [task({ name: 'Changed' })],
    sessions: [session({ durationMs: 1 })],
    logs: [log({ completed: true })],
  });
  assert.equal(pendingChanges(current, saved), 3);
  assert.equal(pendingChanges(populated(101), saved), 3);
  assert.equal(pendingChanges(populated(), snapshot()), 3);
});

test('pendingChanges includes tombstones, settings content, settings timestamps, and the initial upload', () => {
  const saved = snapshot();
  const current = snapshot({
    tombstones: deletesFor(populated(), 200),
    settings: settings({ soundEnabled: false }),
    settingsUpdatedAtMs: 200,
  });
  assert.notEqual(snapshotFingerprint(current), snapshotFingerprint(saved));
  assert.equal(pendingChanges(current, saved), 4);
  assert.equal(pendingChanges({ ...saved, tombstones: current.tombstones }, saved), 3);
  assert.equal(pendingChanges({ ...saved, settings: current.settings }, saved), 1);
  assert.equal(pendingChanges({ ...saved, settingsUpdatedAtMs: 101 }, saved), 1);
  assert.equal(
    pendingChanges({ ...current, tombstones: current.tombstones.map((t) => ({ ...t, updated_at_ms: 201 })) }, current),
    3,
  );
  assert.equal(pendingChanges(structuredClone(current), current), 0);
  assert.equal(pendingChanges(snapshot(), null), 1);
  assert.equal(pendingChanges({ ...populated(), tombstones: current.tombstones }, null), 7);
});

test('parseSnapshot accepts a complete JSON snapshot and an empty snapshot', () => {
  const valid = populated(0);
  valid.settingsUpdatedAtMs = 0;
  valid.tombstones = [{ kind: 'tasks', id: 'gone', updated_at_ms: 0 }];
  const parsed: unknown = JSON.parse(JSON.stringify(valid));
  assert.deepEqual(parseSnapshot(parsed), valid);
  assert.deepEqual(parseSnapshot(snapshot()), snapshot());
});

const malformedSnapshots: [string, unknown][] = [
  ['null', null],
  ['undefined', undefined],
  ['primitive', 42],
  ['array', []],
  ['empty object', {}],
  ['serialized JSON instead of an object', JSON.stringify(snapshot())],
  ['wrong version', { ...snapshot(), version: 2 }],
  ['string version', { ...snapshot(), version: '3' }],
  ['missing settings', { ...snapshot(), settings: undefined }],
  ['null settings', { ...snapshot(), settings: null }],
  ['invalid soundEnabled', { ...snapshot(), settings: { ...settings(), soundEnabled: 'true' } }],
  ['invalid wakeLockRequested', { ...snapshot(), settings: { ...settings(), wakeLockRequested: 1 } }],
  ['missing dayRolloverHour', { ...snapshot(), settings: { ...settings(), dayRolloverHour: undefined } }],
  ['string dayRolloverHour', { ...snapshot(), settings: { ...settings(), dayRolloverHour: '4' } }],
  ['non-finite dayRolloverHour', { ...snapshot(), settings: { ...settings(), dayRolloverHour: NaN } }],
  ['missing notificationsEnabled', { ...snapshot(), settings: { ...settings(), notificationsEnabled: undefined } }],
  ['invalid notificationsEnabled', { ...snapshot(), settings: { ...settings(), notificationsEnabled: 'false' } }],
  ['missing settings timestamp', { ...snapshot(), settingsUpdatedAtMs: undefined }],
  ['string settings timestamp', { ...snapshot(), settingsUpdatedAtMs: '100' }],
  ['NaN settings timestamp', { ...snapshot(), settingsUpdatedAtMs: NaN }],
  ['infinite settings timestamp', { ...snapshot(), settingsUpdatedAtMs: Infinity }],
  ['negative settings timestamp', { ...snapshot(), settingsUpdatedAtMs: -1 }],
  ['missing tombstones', { ...snapshot(), tombstones: undefined }],
  ['non-array tombstones', { ...snapshot(), tombstones: {} }],
  ['null tombstone', { ...snapshot(), tombstones: [null] }],
  ['unknown tombstone kind', { ...snapshot(), tombstones: [{ kind: 'settings', id: 'x', updated_at_ms: 100 }] }],
  ['empty tombstone ID', { ...snapshot(), tombstones: [{ kind: 'tasks', id: '', updated_at_ms: 100 }] }],
  ['negative tombstone timestamp', { ...snapshot(), tombstones: [{ kind: 'tasks', id: 'x', updated_at_ms: -1 }] }],
  [
    'non-finite tombstone timestamp',
    { ...snapshot(), tombstones: [{ kind: 'logs', id: 'x', updated_at_ms: Infinity }] },
  ],
];
for (const [name, value] of malformedSnapshots) {
  test(`parseSnapshot rejects ${name}`, () => assert.throws(() => parseSnapshot(value), Error));
}

for (const kind of collections) {
  for (const [name, value] of [
    ['missing', undefined],
    ['null', null],
    ['object', {}],
  ] as const) {
    test(`parseSnapshot rejects ${name} ${kind} collection`, () => {
      assert.throws(() => parseSnapshot({ ...snapshot(), [kind]: value }), Error);
    });
  }
  const invalidRecords: [string, unknown][] = [
    ['null record', null],
    ['empty record', {}],
    ['empty ID', { ...populated()[kind][0], id: '' }],
    ['non-string ID', { ...populated()[kind][0], id: 1 }],
    ['missing timestamp', { ...populated()[kind][0], updated_at_ms: undefined }],
    ['negative timestamp', { ...populated()[kind][0], updated_at_ms: -1 }],
    ['string timestamp', { ...populated()[kind][0], updated_at_ms: '100' }],
    ['NaN timestamp', { ...populated()[kind][0], updated_at_ms: NaN }],
    ['infinite timestamp', { ...populated()[kind][0], updated_at_ms: Infinity }],
    ['missing sync_status', { ...populated()[kind][0], sync_status: undefined }],
    ['non-numeric sync_status', { ...populated()[kind][0], sync_status: 'pending' }],
  ];
  for (const [name, value] of invalidRecords) {
    test(`parseSnapshot rejects ${kind}: ${name}`, () => {
      assert.throws(() => parseSnapshot({ ...populated(), [kind]: [value] }), Error);
    });
  }
}

const invalidFields: [Collection, string, unknown][] = [
  ['tasks', 'name', 123],
  ['tasks', 'mode', 'unknown'],
  ['tasks', 'category', 'unknown'],
  ['tasks', 'status', 'unknown'],
  ['tasks', 'startedAtMs', undefined],
  ['tasks', 'startedAtMs', NaN],
  ...['targetDurationMs', 'currentStreak', 'bestStreak', 'shields', 'accumulatedMs', 'historyStartTimestamp'].map(
    (field) => ['tasks', field, '100'] as [Collection, string, unknown],
  ),
  ['sessions', 'taskId', 123],
  ['sessions', 'logicalDate', null],
  ...['startedAt', 'endedAt', 'durationMs'].map(
    (field) => ['sessions', field, Infinity] as [Collection, string, unknown],
  ),
  ['logs', 'taskId', 123],
  ['logs', 'logicalDate', null],
  ['logs', 'completed', 'true'],
  ['logs', 'actualDurationMs', NaN],
];
for (const [kind, field, value] of invalidFields) {
  test(`parseSnapshot rejects ${kind}.${field} = ${String(value)}`, () => {
    const data = populated();
    assert.throws(() => parseSnapshot({ ...data, [kind]: [{ ...data[kind][0], [field]: value }] }), Error);
  });
}
