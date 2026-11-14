// Supabase Edge Function: gửi Web Push nhắc hoàn thành thói quen.
// Chạy mỗi giờ bằng cron; chỉ gửi cho thiết bị đang đúng reminder_hour theo múi giờ của nó
// và chỉ khi tài khoản còn thói quen chưa hoàn thành trong ngày logic hiện tại.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  time_zone: string;
  reminder_hour: number;
  last_sent_on: string | null;
}

interface SnapshotLike {
  tasks?: Array<{ mode?: string; lastCompletedDate?: string }>;
  settings?: { dayRolloverHour?: number };
}

const DEFAULT_ROLLOVER_HOUR = 4;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function localParts(at: Date, timeZone: string): { date: string; hour: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
    }).formatToParts(at);
    const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return { date: `${pick('year')}-${pick('month')}-${pick('day')}`, hour: Number(pick('hour')) };
  } catch {
    return null;
  }
}

function logicalDate(at: Date, timeZone: string, rolloverHour: number): string | null {
  return localParts(new Date(at.getTime() - rolloverHour * 3_600_000), timeZone)?.date ?? null;
}

function pendingHabitCount(snapshot: SnapshotLike | null, at: Date, timeZone: string): number {
  const tasks = Array.isArray(snapshot?.tasks) ? snapshot.tasks : [];
  const rawRollover = Number(snapshot?.settings?.dayRolloverHour);
  const rollover =
    Number.isInteger(rawRollover) && rawRollover >= 0 && rawRollover <= 23 ? rawRollover : DEFAULT_ROLLOVER_HOUR;
  const today = logicalDate(at, timeZone, rollover);
  if (!today) return 0;
  return tasks.filter((task) => task && task.mode === 'habit' && task.lastCompletedDate !== today).length;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const cronSecret = Deno.env.get('PUSH_CRON_SECRET');
  if (cronSecret && request.headers.get('x-push-secret') !== cronSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const subject = Deno.env.get('VAPID_SUBJECT');
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!subject || !publicKey || !privateKey) {
    return json({ error: 'Missing VAPID_SUBJECT, VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY secrets' }, 500);
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('benbi_push_subscriptions')
    .select('id,user_id,endpoint,p256dh_key,auth_key,time_zone,reminder_hour,last_sent_on');
  if (error) return json({ error: error.message }, 500);

  const now = new Date();
  const due = (data ?? []).filter((row: SubscriptionRow) => {
    const local = localParts(now, row.time_zone || 'Asia/Ho_Chi_Minh');
    return !!local && local.hour === row.reminder_hour && row.last_sent_on !== local.date;
  });
  if (due.length === 0) return json({ due: 0, sent: 0, skipped: 0, pruned: 0 });

  const userIds = [...new Set(due.map((row: SubscriptionRow) => row.user_id))];
  const { data: states, error: stateError } = await supabase
    .from('benbi_state')
    .select('user_id,data')
    .in('user_id', userIds);
  if (stateError) return json({ error: stateError.message }, 500);

  const snapshots = new Map<string, SnapshotLike>(
    (states ?? []).map((row: { user_id: string; data: SnapshotLike }) => [row.user_id, row.data]),
  );

  let sent = 0;
  let skipped = 0;
  let pruned = 0;
  const failed: string[] = [];

  for (const row of due as SubscriptionRow[]) {
    const timeZone = row.time_zone || 'Asia/Ho_Chi_Minh';
    const local = localParts(now, timeZone);
    if (!local) {
      skipped++;
      continue;
    }

    const pending = pendingHabitCount(snapshots.get(row.user_id) ?? null, now, timeZone);
    if (pending === 0) {
      skipped++;
      continue;
    }

    const rawRollover = Number(snapshots.get(row.user_id)?.settings?.dayRolloverHour);
    const rollover =
      Number.isInteger(rawRollover) && rawRollover >= 0 && rawRollover <= 23 ? rawRollover : DEFAULT_ROLLOVER_HOUR;
    const payload = JSON.stringify({
      title: `🔥 Bền Bỉ · ${pending} thói quen chưa xong`,
      body: `Hôm nay còn ${pending} thói quen. Hoàn tất trước ${String(rollover).padStart(2, '0')}:00 sáng để giữ chuỗi nhé!`,
      icon: '/pwa-192x192.png',
      badge: '/icon.svg',
      tag: 'ben-bi-daily-reminder',
      data: { url: '/' },
    });

    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh_key, auth: row.auth_key } },
        payload,
      );
      sent++;
      await supabase.from('benbi_push_subscriptions').update({ last_sent_on: local.date }).eq('id', row.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase.from('benbi_push_subscriptions').delete().eq('id', row.id);
        pruned++;
      } else {
        failed.push(row.endpoint);
      }
    }
  }

  return json({ due: due.length, sent, skipped, pruned, failed: failed.length });
});
