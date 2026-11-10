import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, get } from '@vercel/blob';

interface SyncPayload {
  tasks: any[];
  sessions: any[];
  logs: any[];
  settings?: any;
  updatedAtMs?: number;
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
      const incomingTasks = Array.isArray(incoming.tasks) ? incoming.tasks : [];
      const incomingSessions = Array.isArray(incoming.sessions) ? incoming.sessions : [];
      const incomingLogs = Array.isArray(incoming.logs) ? incoming.logs : [];

      // Clean sync_status = 0 for cloud storage
      const cleanTasks = incomingTasks.map((t: any) => ({ ...t, sync_status: 0 }));
      const cleanSessions = incomingSessions.map((s: any) => ({ ...s, sync_status: 0 }));
      const cleanLogs = incomingLogs.map((l: any) => ({ ...l, sync_status: 0 }));

      const now = Date.now();
      const payloadToSave: SyncPayload = {
        tasks: cleanTasks,
        sessions: cleanSessions,
        logs: cleanLogs,
        settings: incoming.settings,
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
