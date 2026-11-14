import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { TaskItem, TimeSession, HabitDailyLog } from './engine';
import {
  anonymousAccount, CACHE_NOTICE_KEY, clearAccountCache, DEFAULT_SETTINGS, getCleanStarterTasks,
  hasRecoveryData, loadLocalCache, readCache, writeCache, type AppSettings, type LocalCache,
} from './storage';
import {
  acknowledgeSnapshot, mergeSnapshots, pendingChanges,
  recordLocalChanges, snapshotFingerprint, type SyncSnapshot,
} from './sync';
import { cloudEnabled, cloudError, fetchCloudState, sendLoginOtp, supabase, synchronizeSnapshot, verifyLoginOtp } from './cloud';
import { realtimeManager } from './realtime';

function cleanGuest(): LocalCache {
  return {
    account: anonymousAccount(), initialized: true, acknowledged: null,
    snapshot: { version: 3, ...getCleanStarterTasks(), settings: DEFAULT_SETTINGS, settingsUpdatedAtMs: 0, tombstones: [] },
  };
}

export function useCloudSync() {
  const [initial] = useState(() => ({ recovery: hasRecoveryData() }));
  const [cache, setCache] = useState(cleanGuest);
  const cacheRef = useRef(cache);
  const [hydrated, setHydrated] = useState(false);
  const hydrationRef = useRef<Promise<void> | null>(null);
  const [recoveryAvailable, setRecoveryAvailable] = useState(initial.recovery);
  const [needsAuthentication, setNeedsAuthentication] = useState(false);
  useEffect(() => { realtimeManager.setAccount(cache.account.id); }, [cache.account.id]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!cloudEnabled);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const offlineRef = useRef(isOffline);
  offlineRef.current = isOffline || isSimulatedOffline;
  const userIdRef = useRef<string | null>(null);
  const epochRef = useRef(0);
  const mountedRef = useRef(true);
  const signingOutRef = useRef(false);
  const authEventRef = useRef(0);
  const adoptRef = useRef<(session: Session | null) => Promise<void>>(async () => {});
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const syncRef = useRef<() => Promise<boolean>>(async () => false);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const persist = useCallback((next: LocalCache) => {
    cacheRef.current = next;
    if (mountedRef.current) setCache(next);
    writeQueueRef.current = writeQueueRef.current
      .then(() => writeCache(next))
      .then(() => {
        if (mountedRef.current) {
          setStorageError(null);
          setRecoveryAvailable(hasRecoveryData());
        }
      })
      .catch(() => {
        if (mountedRef.current) setStorageError('Không ghi được bộ nhớ thiết bị. Hãy xuất bản sao JSON trước khi đóng ứng dụng.');
      });
  }, []);

  const cancelRetry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  }, []);

  const update = useCallback((change: (data: SyncSnapshot) => SyncSnapshot) => {
    if (signingOutRef.current) return;
    const current = cacheRef.current;
    const next = recordLocalChanges(current.snapshot, change(current.snapshot));
    if (snapshotFingerprint(next) === snapshotFingerprint(current.snapshot)) return;
    cancelRetry();
    retryCountRef.current = 0;
    persist({ ...current, snapshot: next });
  }, [cancelRetry, persist]);

  const setTasks = useCallback((value: SetStateAction<TaskItem[]>) => update(data => ({
    ...data, tasks: typeof value === 'function' ? value(data.tasks) : value,
  })), [update]);
  const setSessions = useCallback((value: SetStateAction<TimeSession[]>) => update(data => ({
    ...data, sessions: typeof value === 'function' ? value(data.sessions) : value,
  })), [update]);
  const setLogs = useCallback((value: SetStateAction<HabitDailyLog[]>) => update(data => ({
    ...data, logs: typeof value === 'function' ? value(data.logs) : value,
  })), [update]);
  const setSettings = useCallback((value: SetStateAction<AppSettings>) => update(data => ({
    ...data, settings: typeof value === 'function' ? value(data.settings) : value,
  })), [update]);
  const replaceData = useCallback((data: Pick<SyncSnapshot, 'tasks' | 'sessions' | 'logs'> & { settings?: AppSettings }) => {
    update(current => ({ ...current, ...data, settings: data.settings ?? current.settings }));
  }, [update]);

  const syncNow = useCallback((): Promise<boolean> => {
    if (inFlightRef.current) return inFlightRef.current;
    const userId = userIdRef.current;
    if (offlineRef.current) {
      setSyncError('Đang ngoại tuyến. Thay đổi được giữ trong hàng đợi trên thiết bị.');
      return Promise.resolve(false);
    }
    if (supabase && !userId && !cacheRef.current.account.isAnonymous) {
      return supabase.auth.getSession().then(async ({ data, error }) => {
        if (error) throw error;
        await adoptRef.current(data.session);
        return !!userIdRef.current && pendingChanges(cacheRef.current.snapshot, cacheRef.current.acknowledged) === 0;
      }).catch(error => { setSyncError(cloudError(error)); return false; });
    }
    if (!supabase || !userId || cacheRef.current.account.id !== userId) {
      setSyncError(cloudEnabled ? 'Đăng nhập bằng email đã xác thực để đồng bộ đám mây.' : 'Chưa cấu hình Supabase. Dữ liệu chỉ nằm trên thiết bị.');
      return Promise.resolve(false);
    }
    cancelRetry();
    const epoch = epochRef.current;
    const stillCurrent = () => mountedRef.current && epoch === epochRef.current && userIdRef.current === userId;
    setIsSyncing(true);
    setSyncError(null);
    const work = (async () => {
      try {
        if (!cacheRef.current.initialized) {
          const remote = await fetchCloudState(userId);
          if (!stillCurrent()) return false;
          const current = cacheRef.current;
          const initial = remote ? acknowledgeSnapshot(remote.snapshot, remote.snapshot) : current.snapshot;
          persist({ ...current, initialized: true, snapshot: initial, acknowledged: remote?.snapshot ?? null });
        }
        const saved = await synchronizeSnapshot(userId, () => {
          if (!stillCurrent()) throw new Error('Phiên đăng nhập đã thay đổi.');
          return cacheRef.current.snapshot;
        });
        if (!stillCurrent()) return false;
        const current = cacheRef.current;
        persist({
          ...current,
          snapshot: acknowledgeSnapshot(current.snapshot, saved),
          acknowledged: saved,
          account: { ...current.account, lastSyncedAtMs: Date.now() },
        });
        retryCountRef.current = 0;
        return true;
      } catch (error) {
        if (stillCurrent()) {
          setSyncError(cloudError(error));
          retryCountRef.current++;
          if (retryCountRef.current < 5 && !offlineRef.current) {
            retryTimerRef.current = setTimeout(() => {
              retryTimerRef.current = null;
              void syncRef.current();
            }, Math.min(30000, 2000 * 2 ** (retryCountRef.current - 1)));
          }
        }
        return false;
      } finally {
        if (stillCurrent()) {
          inFlightRef.current = null;
          setIsSyncing(false);
          if (retryCountRef.current === 0 && pendingChanges(cacheRef.current.snapshot, cacheRef.current.acknowledged) > 0) {
            retryTimerRef.current = setTimeout(() => {
              retryTimerRef.current = null;
              void syncRef.current();
            }, 700);
          }
        }
      }
    })();
    inFlightRef.current = work;
    return work;
  }, [cancelRetry, persist]);
  syncRef.current = syncNow;

  const adoptSession = useCallback(async (session: Session | null) => {
    await hydrationRef.current;
    if (!mountedRef.current) return;
    if (!session || session.user.is_anonymous) {
      userIdRef.current = null;
      epochRef.current++;
      cancelRetry();
      inFlightRef.current = null;
      setIsSyncing(false);
      if (!cacheRef.current.account.isAnonymous && !signingOutRef.current) {
        setNeedsAuthentication(true);
        setSyncError('Phiên đăng nhập đã hết hạn. Bản ngoại tuyến vẫn được giữ; xác thực lại email để đồng bộ.');
      }
      setAuthReady(true);
      return;
    }
    if (signingOutRef.current) return;
    setNeedsAuthentication(false);
    const user = session.user;
    if (userIdRef.current === user.id && cacheRef.current.account.id === user.id) {
      setAuthReady(true);
      return;
    }
    epochRef.current++;
    cancelRetry();
    inFlightRef.current = null;
    userIdRef.current = user.id;
    const previous = cacheRef.current;
    let stored: LocalCache | null;
    try { stored = previous.account.id === user.id ? previous : await readCache(user.id); }
    catch {
      setStorageError('Không thể giữ bản dữ liệu cũ trước khi đăng nhập. Hãy sao lưu hoặc giải phóng bộ nhớ thiết bị.');
      setAuthReady(true);
      return;
    }
    const mayMigrate = previous.account.isAnonymous && (!previous.migrationEmail || previous.migrationEmail.toLowerCase() === user.email?.toLowerCase());
    const base = stored ?? (mayMigrate ? previous : cleanGuest());
    persist({
      snapshot: base.snapshot,
      initialized: stored?.initialized ?? false,
      acknowledged: stored?.acknowledged ?? null,
      account: {
        id: user.id, email: user.email ?? null, isAnonymous: false, provider: 'supabase',
        lastSyncedAtMs: stored?.account.lastSyncedAtMs ?? null, createdAtMs: Date.parse(user.created_at),
      },
    });
    setAuthReady(true);
    await syncRef.current();
  }, [cancelRetry, persist]);
  adoptRef.current = adoptSession;

  useEffect(() => {
    mountedRef.current = true;
    hydrationRef.current = (async () => {
      try {
        const restored = await loadLocalCache();
        if (!mountedRef.current) return;
        // A session adopted during hydration already restored the matching account cache.
        if (userIdRef.current === null && cacheRef.current.account.isAnonymous) {
          cacheRef.current = restored;
          setCache(restored);
          setRecoveryAvailable(hasRecoveryData());
        }
      } catch {
        if (mountedRef.current) {
          setStorageError('Không đọc hoặc ghi được bộ nhớ thiết bị. Dữ liệu gốc chưa bị xóa; đừng đóng trang khi còn thay đổi chưa sao lưu.');
        }
      } finally {
        if (mountedRef.current) setHydrated(true);
      }
    })();
    return () => {
      mountedRef.current = false;
      epochRef.current++;
      cancelRetry();
      inFlightRef.current = null;
    };
  }, [cancelRetry]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sequence = ++authEventRef.current;
      if (!session) {
        epochRef.current++;
        userIdRef.current = null;
      }
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (active && sequence === authEventRef.current) void adoptSession(session);
      }, 0);
      timers.add(timer);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) throw error;
      return adoptSession(data.session);
    }).catch(error => {
      if (active) {
        setSyncError(cloudError(error));
        setNeedsAuthentication(!cacheRef.current.account.isAnonymous);
        setAuthReady(true);
      }
    });
    return () => {
      active = false;
      for (const timer of timers) clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [adoptSession]);

  useEffect(() => {
    if (!authReady || cache.account.isAnonymous || !cache.initialized || offlineRef.current ||
      !pendingChanges(cache.snapshot, cache.acknowledged) || retryTimerRef.current) return;
    const timer = setTimeout(() => { void syncRef.current(); }, 700);
    return () => clearTimeout(timer);
  }, [authReady, cache.snapshot, cache.account.id, cache.initialized, isOffline, isSimulatedOffline]);

  useEffect(() => {
    const online = () => {
      offlineRef.current = isSimulatedOffline;
      setIsOffline(false);
      retryCountRef.current = 0;
      if (!cacheRef.current.account.isAnonymous) void syncRef.current();
    };
    const offline = () => { offlineRef.current = true; setIsOffline(true); };
    const refresh = () => {
      if (document.visibilityState === 'visible' && !cacheRef.current.account.isAnonymous && !offlineRef.current) void syncRef.current();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const interval = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(interval);
    };
  }, [isSimulatedOffline]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      const current = cacheRef.current;
      if (event.key === 'benbi_logout_v3' && event.newValue) {
        const notice = JSON.parse(event.newValue) as { accountId: string };
        if (notice.accountId !== current.account.id) return;
        authEventRef.current++;
        epochRef.current++;
        userIdRef.current = null;
        cancelRetry();
        inFlightRef.current = null;
        setIsSyncing(false);
        setNeedsAuthentication(false);
        persist(cleanGuest());
        return;
      }
      if (event.key !== CACHE_NOTICE_KEY || !event.newValue) return;
      const noticedAccount: string | null = (() => {
        try {
          return (JSON.parse(event.newValue) as { accountId?: string }).accountId ?? null;
        } catch {
          return null;
        }
      })();
      if (noticedAccount !== current.account.id || !current.initialized) return;
      void readCache(current.account.id).then((incoming) => {
        if (!incoming || !mountedRef.current) return;
        const latest = cacheRef.current;
        if (incoming.account.id !== latest.account.id || !incoming.initialized || !latest.initialized) return;
        const merged = mergeSnapshots(latest.snapshot, incoming.snapshot);
        if (snapshotFingerprint(merged) === snapshotFingerprint(latest.snapshot)) return;
        persist({ ...latest, snapshot: merged });
      }).catch(() => {
        setSyncError('Không đọc được thay đổi từ tab khác. Vui lòng đồng bộ lại.');
      });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [cancelRetry, persist]);

  const sendOtp = useCallback(async (email: string) => {
    if (offlineRef.current) throw new Error('Cần kết nối mạng để gửi mã đăng nhập.');
    await sendLoginOtp(email);
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    if (offlineRef.current) throw new Error('Cần kết nối mạng để xác thực đăng nhập.');
    const verified = await verifyLoginOtp(email, code);
    const { data, error } = await supabase!.auth.getSession();
    if (error) throw new Error(cloudError(error));
    if (data.session?.user.id !== verified.user.id) throw new Error('Phiên đăng nhập đã thay đổi ở tab khác. Vui lòng thử lại.');
    await adoptSession(data.session);
  }, [adoptSession]);

  const logout = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    const current = cacheRef.current;
    try {
      if (current.initialized && !current.account.isAnonymous && pendingChanges(current.snapshot, current.acknowledged) && userIdRef.current) {
        const saved = await syncRef.current();
        if (!saved || pendingChanges(cacheRef.current.snapshot, cacheRef.current.acknowledged)) {
          throw new Error('Còn thay đổi chưa đồng bộ. Kết nối mạng và lưu lên đám mây trước khi đăng xuất; bạn cũng có thể tải bản sao JSON.');
        }
      }
      if (supabase) {
        const { error } = await supabase.auth.signOut({ scope: 'local' });
        if (error) throw new Error(cloudError(error));
      }
      authEventRef.current++;
      epochRef.current++;
      userIdRef.current = null;
      cancelRetry();
      inFlightRef.current = null;
      await writeQueueRef.current;
      const shared = await readCache(current.account.id);
      const latest = cacheRef.current.account.id === current.account.id ? cacheRef.current : current;
      const snapshot = shared ? mergeSnapshots(latest.snapshot, shared.snapshot) : latest.snapshot;
      const retained = pendingChanges(snapshot, latest.acknowledged) > 0;
      if (retained) await writeCache({ ...latest, snapshot });
      else await clearAccountCache(current.account.id);
      localStorage.setItem('benbi_logout_v3', JSON.stringify({ accountId: current.account.id, at: Date.now() }));
      localStorage.removeItem('benbi_cross_tab_event');
      persist(cleanGuest());
      setIsSyncing(false);
      setNeedsAuthentication(false);
      setSyncError(retained ? 'Bản chưa đồng bộ được giữ riêng trên thiết bị. Đăng nhập lại đúng tài khoản để tiếp tục.' : null);
    } finally {
      signingOutRef.current = false;
    }
  }, [cancelRetry, persist]);

  const pendingSyncCount = useMemo(() => pendingChanges(cache.snapshot, cache.acknowledged), [cache.snapshot, cache.acknowledged]);

  return {
    ...cache.snapshot, account: cache.account, setTasks, setSessions, setLogs, setSettings, replaceData,
    needsAuthentication, recoveryAvailable,
    isSyncing, syncError: storageError ?? syncError, syncNow, sendOtp, verifyOtp, logout, cloudEnabled,
    isOffline: isOffline || isSimulatedOffline, isSimulatedOffline, setIsSimulatedOffline,
    isLoadingAccount: !authReady || !hydrated || (!cache.account.isAnonymous && !cache.initialized && !needsAuthentication),
    pendingSyncCount,
  };
}
