import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, get } from '@vercel/blob';

interface SyncPayload {
  tasks: any[];
  sessions: any[];
  logs: any[];
  settings?: any;
  updatedAtMs?: number;
}

function mergeData(
  local: { tasks: any[]; sessions: any[]; logs: any[] },
  cloud: { tasks: any[]; sessions: any[]; logs: any[] }
) {
  const taskMap = new Map<string, any>();
  for (const c of cloud.tasks || []) {
    taskMap.set(c.id, { ...c, sync_status: 0 });
  }
  for (const l of local.tasks || []) {
    const existing = taskMap.get(l.id);
    if (!existing) {
      taskMap.set(l.id, { ...l, sync_status: 0 });
    } else {
      const mergedStreak = Math.max(existing.currentStreak || 0, l.currentStreak || 0);
      const mergedBest = Math.max(existing.bestStreak || 0, l.bestStreak || 0);
      const mergedShields = Math.max(existing.shields || 0, l.shields || 0);
      const isLocalRunning = l.status === 'running';
      const useLocal = isLocalRunning || (l.updated_at_ms || 0) >= (existing.updated_at_ms || 0);

      taskMap.set(l.id, {
        ...(useLocal ? l : existing),
        currentStreak: mergedStreak,
        bestStreak: mergedBest,
        shields: mergedShields,
        sync_status: 0,
        updated_at_ms: Math.max(existing.updated_at_ms || 0, l.updated_at_ms || 0),
      });
    }
  }

  const sessionMap = new Map<string, any>();
  for (const s of cloud.sessions || []) {
    sessionMap.set(s.id, { ...s, sync_status: 0 });
  }
  for (const s of local.sessions || []) {
    if (!sessionMap.has(s.id)) {
      sessionMap.set(s.id, { ...s, sync_status: 0 });
    }
  }

  const logMap = new Map<string, any>();
  for (const l of cloud.logs || []) {
    logMap.set(l.id || `${l.taskId}-${l.logicalDate}`, { ...l, sync_status: 0 });
  }
  for (const l of local.logs || []) {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const emailParam = (req.query.email || (req.body && req.body.email)) as string | undefined;
  if (!emailParam || typeof emailParam !== 'string' || !emailParam.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const normalizedEmail = emailParam.trim().toLowerCase();
  const safeEmailKey = normalizedEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
  const blobPath = `benbi_users/${safeEmailKey}.json`;

  try {
    if (req.method === 'GET') {
      try {
        const file = await get(blobPath, { access: 'private', useCache: false });
        if (!file || file.statusCode !== 200) {
          return res.status(200).json({ found: false, email: normalizedEmail, data: null });
        }
        const text = await new Response(file.stream).text();
        const data = JSON.parse(text);
        return res.status(200).json({
          found: true,
          email: normalizedEmail,
          data,
          lastSyncedAtMs: data.updatedAtMs || Date.now(),
        });
      } catch (err: any) {
        return res.status(200).json({ found: false, email: normalizedEmail, data: null });
      }
    }

    if (req.method === 'POST') {
      const incoming = req.body || {};
      const localData = {
        tasks: Array.isArray(incoming.tasks) ? incoming.tasks : [],
        sessions: Array.isArray(incoming.sessions) ? incoming.sessions : [],
        logs: Array.isArray(incoming.logs) ? incoming.logs : [],
      };

      // Fetch existing cloud data if exists
      let existingData: SyncPayload = { tasks: [], sessions: [], logs: [] };
      try {
        const existingFile = await get(blobPath, { access: 'private', useCache: false });
        if (existingFile && existingFile.statusCode === 200) {
          const text = await new Response(existingFile.stream).text();
          existingData = JSON.parse(text);
        }
      } catch {
        // file doesn't exist yet, proceed with empty cloud base
      }

      const merged = mergeData(localData, existingData);
      const now = Date.now();
      const payloadToSave: SyncPayload = {
        tasks: merged.tasks,
        sessions: merged.sessions,
        logs: merged.logs,
        settings: incoming.settings || existingData.settings,
        updatedAtMs: now,
      };

      await put(blobPath, JSON.stringify(payloadToSave), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      return res.status(200).json({
        success: true,
        email: normalizedEmail,
        data: payloadToSave,
        lastSyncedAtMs: now,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('Sync API Error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err?.message || String(err),
    });
  }
}
