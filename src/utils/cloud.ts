import { createClient } from '@supabase/supabase-js';
import { mergeSnapshots, parseSnapshot, snapshotFingerprint, type SyncSnapshot } from './sync';

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
export const cloudEnabled = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && key.length > 20;
export const supabase = cloudEnabled ? createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

function client() {
  if (!supabase) throw new Error('Chưa cấu hình Supabase. Dữ liệu hiện chỉ được lưu trên thiết bị.');
  return supabase;
}

export function cloudError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (/rate limit|too many|security purposes/i.test(message)) return 'Máy chủ đang giới hạn yêu cầu. Vui lòng chờ một phút rồi thử lại.';
  if (/expired|invalid.*(token|otp)|token.*(invalid|expired)/i.test(message)) return 'Mã không đúng hoặc đã hết hạn. Kiểm tra email hoặc gửi lại mã.';
  if (/email.*not.*authorized|email_address_not_authorized/i.test(message)) return 'Máy chủ email chưa cấu hình SMTP riêng nên chưa gửi được tới địa chỉ này.';
  if (/captcha/i.test(message)) return 'Máy chủ yêu cầu xác minh trình duyệt. Vui lòng kiểm tra cấu hình CAPTCHA.';
  if (/permission denied|row.level|42501/i.test(message)) return 'Chưa có quyền truy cập dữ liệu. Hãy đăng nhập lại hoặc kiểm tra schema Supabase.';
  if (/fetch|network|load failed/i.test(message)) return 'Không kết nối được máy chủ. Thay đổi vẫn nằm trong hàng đợi trên thiết bị.';
  return message || 'Chưa đồng bộ được. Dữ liệu trên thiết bị chưa bị xóa.';
}

export async function sendLoginOtp(email: string) {
  const { error } = await client().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: new URL(import.meta.env.BASE_URL, location.origin).href },
  });
  if (error) throw new Error(cloudError(error));
}

export async function verifyLoginOtp(email: string, token: string) {
  if (!/^\d{6}$/.test(token)) throw new Error('Mã xác thực phải gồm 6 chữ số.');
  const { data, error } = await client().auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
  if (error) throw new Error(cloudError(error));
  if (!data.session || data.user?.is_anonymous) throw new Error('Chưa tạo được phiên đăng nhập đã xác thực.');
  return data.session;
}

export async function fetchCloudState(userId: string) {
  const { data, error } = await client().from('benbi_state').select('data,revision').eq('user_id', userId).maybeSingle();
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
  throw new Error('Dữ liệu đang thay đổi trên thiết bị khác. Sẽ thử đồng bộ lại.');
}
