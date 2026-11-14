import { useCallback, useEffect, useRef, useState } from 'react';
import { cloudError } from './cloud';
import {
  getPushPermission,
  hasActivePushSubscription,
  pushConfigured,
  pushSupported,
  registerPushSubscription,
  removePushSubscription,
} from './push';

export type PushStatus = 'loading' | 'unconfigured' | 'unsupported' | 'anonymous' | 'denied' | 'off' | 'on';

export function usePushReminders(accountId: string | null, isAnonymous: boolean) {
  const [status, setStatus] = useState<PushStatus>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncedAccountRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!pushConfigured) {
      setStatus('unconfigured');
      return;
    }
    if (!pushSupported()) {
      setStatus('unsupported');
      return;
    }
    if (!accountId || isAnonymous) {
      setStatus('anonymous');
      return;
    }
    const permission = getPushPermission();
    if (permission === 'denied') {
      setStatus('denied');
      return;
    }
    setStatus(permission === 'granted' && (await hasActivePushSubscription()) ? 'on' : 'off');
  }, [accountId, isAnonymous]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep the server row in sync after login when the browser already holds a subscription.
  useEffect(() => {
    if (status !== 'on' || !accountId || isAnonymous || syncedAccountRef.current === accountId) return;
    syncedAccountRef.current = accountId;
    registerPushSubscription().catch((err) => setError(cloudError(err)));
  }, [status, accountId, isAnonymous]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        const message = 'Bạn cần cho phép thông báo trong trình duyệt để bật nhắc nhở.';
        setError(message);
        throw new Error(message);
      }
      await registerPushSubscription();
      syncedAccountRef.current = accountId;
      setStatus('on');
    } catch (err) {
      setError(cloudError(err));
      void refresh();
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      setBusy(false);
    }
  }, [refresh, accountId]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await removePushSubscription();
      setStatus('off');
    } catch (err) {
      setError(cloudError(err));
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, error, enable, disable, refresh };
}
