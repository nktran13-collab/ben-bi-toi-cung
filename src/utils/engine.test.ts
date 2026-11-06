import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLogicalDate,
  calculateElapsedTime,
  calculateHabitRemaining,
  calculateProjectProgress,
  formatDuration,
  calculateEarnedShields,
  calculateCheckpoint,
  calculatePersistenceDensity,
  trimSessionDuration,
  countPendingSync,
  calculateExpectedEndTimestamp,
  formatClockTime,
  mergeLocalAndCloudData,
  getMaxShieldCapacity,
  generateStreakMatrix,
  generateCSVExport,
  generateMarkdownExport,
  TaskItem,
  TimeSession,
  HabitDailyLog,
} from './engine';

test('getLogicalDate assigns 00:00 - 03:59 to the previous logical day', () => {
  const earlyMorningDate = new Date(2026, 10, 6, 2, 30, 0, 0);
  const logicalDateEarly = getLogicalDate(earlyMorningDate.getTime(), 4);
  assert.equal(logicalDateEarly, '2026-11-05');

  const morningDate = new Date(2026, 10, 6, 4, 0, 1, 0);
  const logicalDateMorning = getLogicalDate(morningDate.getTime(), 4);
  assert.equal(logicalDateMorning, '2026-11-06');
});

test('calculateElapsedTime uses Delta-Timestamp without drift', () => {
  const t0 = 1000000;
  assert.equal(calculateElapsedTime(null, 5000, t0), 5000);
  assert.equal(calculateElapsedTime(t0, 5000, t0 + 3000), 8000);
});

test('calculateHabitRemaining counts down towards 0', () => {
  const targetMs = 30 * 60 * 1000;
  const t0 = 1000000;

  const result1 = calculateHabitRemaining(targetMs, t0, 0, t0 + 10 * 60 * 1000);
  assert.equal(result1.remainingMs, 20 * 60 * 1000);
  assert.equal(result1.isFinished, false);

  const result2 = calculateHabitRemaining(targetMs, t0, 0, t0 + 35 * 60 * 1000);
  assert.equal(result2.remainingMs, 0);
  assert.equal(result2.isFinished, true);
});

test('countPendingSync detects unsynced records (sync_status === 1)', () => {
  const tasks: TaskItem[] = [
    {
      id: 't1',
      name: 'Task 1',
      mode: 'habit',
      category: 'health',
      targetDurationMs: 60000,
      currentStreak: 5,
      bestStreak: 5,
      shields: 0,
      status: 'idle',
      startedAtMs: null,
      accumulatedMs: 0,
      historyStartTimestamp: 0,
      sync_status: 1,
      updated_at_ms: Date.now(),
    },
    {
      id: 't2',
      name: 'Task 2',
      mode: 'project',
      category: 'work',
      targetDurationMs: 60000,
      currentStreak: 2,
      bestStreak: 2,
      shields: 0,
      status: 'idle',
      startedAtMs: null,
      accumulatedMs: 0,
      historyStartTimestamp: 0,
      sync_status: 0,
      updated_at_ms: Date.now(),
    },
  ];

  const sessions: TimeSession[] = [
    {
      id: 's1',
      taskId: 't1',
      logicalDate: '2026-11-05',
      startedAt: 100,
      endedAt: 200,
      durationMs: 100,
      sync_status: 1,
      updated_at_ms: Date.now(),
    },
  ];

  const logs: HabitDailyLog[] = [];

  assert.equal(countPendingSync(tasks, sessions, logs), 2);
});

test('calculateExpectedEndTimestamp projects future end time accurately', () => {
  const startedAt = 1000000;
  const targetMs = 15 * 60 * 1000; // 15 mins
  const accumulatedMs = 5 * 60 * 1000; // 5 mins already done
  // Remaining = 10 mins = 600,000 ms
  const expectedEnd = calculateExpectedEndTimestamp(startedAt, targetMs, accumulatedMs);
  assert.equal(expectedEnd, startedAt + 10 * 60 * 1000);
});

test('mergeLocalAndCloudData merges datasets while preserving active sessions & highest streaks', () => {
  const localTask: TaskItem = {
    id: 'habit-1',
    name: 'Đọc sách',
    mode: 'habit',
    category: 'study',
    targetDurationMs: 1800000,
    currentStreak: 14, // Local has higher streak
    bestStreak: 14,
    shields: 2,
    status: 'running', // Local is actively running
    startedAtMs: 5000,
    accumulatedMs: 1000,
    historyStartTimestamp: 0,
    sync_status: 1,
    updated_at_ms: 6000,
  };

  const cloudTask: TaskItem = {
    id: 'habit-1',
    name: 'Đọc sách',
    mode: 'habit',
    category: 'study',
    targetDurationMs: 1800000,
    currentStreak: 10,
    bestStreak: 12,
    shields: 1,
    status: 'idle',
    startedAtMs: null,
    accumulatedMs: 0,
    historyStartTimestamp: 0,
    sync_status: 0,
    updated_at_ms: 1000,
  };

  const merged = mergeLocalAndCloudData(
    { tasks: [localTask], sessions: [], logs: [] },
    { tasks: [cloudTask], sessions: [], logs: [] }
  );

  assert.equal(merged.tasks.length, 1);
  const t = merged.tasks[0];
  assert.equal(t.currentStreak, 14); // Preserved local higher streak
  assert.equal(t.bestStreak, 14);
  assert.equal(t.shields, 2);
  assert.equal(t.status, 'running'); // Preserved running state!
  assert.equal(t.sync_status, 0); // Marked as synced
});

test('getMaxShieldCapacity returns 2 for 30-day target and 3 for 66-day target', () => {
  assert.equal(getMaxShieldCapacity(30), 2);
  assert.equal(getMaxShieldCapacity(66), 3);
  assert.equal(getMaxShieldCapacity(100), 3);
});

test('calculateCheckpoint returns nearest reserved milestone or 0', () => {
  assert.equal(calculateCheckpoint(5), 0);
  assert.equal(calculateCheckpoint(7), 7);
  assert.equal(calculateCheckpoint(12), 7);
  assert.equal(calculateCheckpoint(14), 14);
  assert.equal(calculateCheckpoint(29), 21);
  assert.equal(calculateCheckpoint(30), 30);
  assert.equal(calculateCheckpoint(44), 30);
  assert.equal(calculateCheckpoint(45), 45);
  assert.equal(calculateCheckpoint(59), 45);
  assert.equal(calculateCheckpoint(60), 60);
  assert.equal(calculateCheckpoint(66), 60);
});

test('generateStreakMatrix produces 30 or 66 items with correct color coding', () => {
  const logs: HabitDailyLog[] = [
    {
      id: 'l1',
      taskId: 'habit-1',
      logicalDate: '2026-11-01',
      completed: true,
      actualDurationMs: 1800000,
      recoveryType: 'on_time',
      sync_status: 0,
      updated_at_ms: Date.now(),
    },
    {
      id: 'l2',
      taskId: 'habit-1',
      logicalDate: '2026-11-02',
      completed: true,
      actualDurationMs: 1800000,
      recoveryType: 'shield',
      sync_status: 0,
      updated_at_ms: Date.now(),
    },
    {
      id: 'l3',
      taskId: 'habit-1',
      logicalDate: '2026-11-03',
      completed: true,
      actualDurationMs: 3600000,
      recoveryType: 'makeup',
      sync_status: 0,
      updated_at_ms: Date.now(),
    },
  ];

  const matrix = generateStreakMatrix(66, 3, logs, 'habit-1');
  assert.equal(matrix.length, 66);
  assert.equal(matrix[0].status, 'completed_on_time');
  assert.equal(matrix[1].status, 'frozen_by_shield');
  assert.equal(matrix[2].status, 'makeup_recovered');
  // Day 60 is upcoming
  assert.equal(matrix[59].status, 'upcoming');
});

test('generateCSVExport & generateMarkdownExport output valid report data', () => {
  const task: TaskItem = {
    id: 'habit-1',
    name: 'Tập thể dục',
    mode: 'habit',
    category: 'health',
    targetDurationMs: 1800000,
    currentStreak: 10,
    bestStreak: 10,
    shields: 1,
    status: 'idle',
    startedAtMs: null,
    accumulatedMs: 0,
    historyStartTimestamp: 0,
    targetMilestoneDays: 30,
    sync_status: 0,
    updated_at_ms: Date.now(),
  };

  const sessions: TimeSession[] = [
    {
      id: 's1',
      taskId: 'habit-1',
      logicalDate: '2026-11-05',
      startedAt: 1000,
      endedAt: 61000,
      durationMs: 60000,
      sync_status: 0,
      updated_at_ms: Date.now(),
    },
  ];

  const logs: HabitDailyLog[] = [
    {
      id: 'l1',
      taskId: 'habit-1',
      logicalDate: '2026-11-05',
      completed: true,
      actualDurationMs: 60000,
      recoveryType: 'on_time',
      sync_status: 0,
      updated_at_ms: Date.now(),
    },
  ];

  const csv = generateCSVExport(task, sessions, logs);
  assert.match(csv, /Mã tác vụ/);
  assert.match(csv, /Tập thể dục/);
  assert.match(csv, /2026-11-05/);

  const md = generateMarkdownExport(task, sessions, logs);
  assert.match(md, /Báo Cáo Bền Bỉ/);
  assert.match(md, /Tập thể dục/);
});
