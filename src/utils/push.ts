import { cloudEnabled, cloudError, supabase } from './cloud';

export const PUSH_REMINDER_HOUR = 20;

const vapidPublicKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim();

export const pushConfigured = cloudEnabled && vapidPublicKey.length > 80;

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
  );
}

export function getPushPermission(): NotificationPermission | 'unsupported' {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
  timeZone: string;
}

export function toSubscriptionRecord(
  json: Pick<PushSubscriptionJSON, 'endpoint' | 'keys'>,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
): PushSubscriptionRecord | null {
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, p256dh, auth, timeZone };
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function hasActivePushSubscription(): Promise<boolean> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return false;
  return (await registration.pushManager.getSubscription()) !== null;
}

export async function registerPushSubscription(): Promise<void> {
  if (!pushConfigured || !supabase) throw new Error('Chưa cấu hình khóa VAPID cho thông báo đẩy.');
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    throw new Error('Trình duyệt chưa kích hoạt Service Worker. Hãy mở bản cài đặt (PWA) rồi thử lại.');
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const record = toSubscriptionRecord(subscription.toJSON());
  if (!record) throw new Error('Trình duyệt trả về đăng ký đẩy không hợp lệ.');

  const { error } = await supabase.rpc('benbi_register_push_subscription', {
    endpoint_in: record.endpoint,
    p256dh_in: record.p256dh,
    auth_in: record.auth,
    time_zone_in: record.timeZone,
    reminder_hour_in: PUSH_REMINDER_HOUR,
  });
  if (error) throw new Error(cloudError(error));
}

export async function removePushSubscription(): Promise<void> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  if (supabase) {
    const { error } = await supabase.from('benbi_push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    if (error) throw new Error(cloudError(error));
  }
  await subscription.unsubscribe();
}
