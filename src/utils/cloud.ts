import { createClient } from '@supabase/supabase-js';
import { mergeSnapshots, parseSnapshot, snapshotFingerprint, type SyncSnapshot } from './sync';
import { t } from './i18n';

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
export const cloudEnabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && key.length > 20;
export const supabase = cloudEnabled
  ? createClient(url, key, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

function client() {
  if (!supabase) throw new Error(t('cloud.notConfigured'));
  return supabase;
}

export function cloudError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (/rate limit|too many|security purposes/i.test(message)) return t('cloud.rateLimit');
  if (/expired|invalid.*(token|otp)|token.*(invalid|expired)/i.test(message)) return t('cloud.otpInvalid');
  if (/email.*not.*authorized|email_address_not_authorized/i.test(message)) return t('cloud.smtp');
  if (/captcha/i.test(message)) return t('cloud.captcha');
  if (/permission denied|row.level|42501/i.test(message)) return t('cloud.permission');
  if (/fetch|network|load failed/i.test(message)) return t('cloud.network');
  return message || t('cloud.generic');
}

export async function sendLoginOtp(email: string) {
  const { error } = await client().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: new URL(import.meta.env.BASE_URL, location.origin).href },
  });
  if (error) throw new Error(cloudError(error));
}

export async function verifyLoginOtp(email: string, token: string) {
  if (!/^\d{6}$/.test(token)) throw new Error(t('cloud.otpSixDigits'));
  const { data, error } = await client().auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
  if (error) throw new Error(cloudError(error));
  if (!data.session || data.user?.is_anonymous) throw new Error(t('cloud.noSession'));
  return data.session;
}

export async function fetchCloudState(userId: string) {
  const { data, error } = await client()
    .from('benbi_state')
    .select('data,revision')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? { snapshot: parseSnapshot(data.data), revision: Number(data.revision) } : null;
}

export async function synchronizeSnapshot(userId: string, getCurrent: () => SyncSnapshot): Promise<SyncSnapshot> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const remote = await fetchCloudState(userId);
    const local = getCurrent();
    const merged = remote ? mergeSnapshots(local, remote.snapshot) : local;
    if (remote && snapshotFingerprint(merged) === snapshotFingerprint(remote.snapshot)) return remote.snapshot;
    const query = remote
      ? client().from('benbi_state').update({ data: merged }).eq('user_id', userId).eq('revision', remote.revision)
      : client().from('benbi_state').insert({ user_id: userId, data: merged });
    const { data, error } = await query.select('data').maybeSingle();
    if (error) {
      if (error.code === '23505') continue;
      throw error;
    }
    if (data) return parseSnapshot(data.data);
  }
  throw new Error(t('cloud.repeatedChange'));
}
