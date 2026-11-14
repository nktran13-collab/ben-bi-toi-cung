import { RealtimeSyncPayload } from './engine';

const CHANNEL_NAME = 'benbi_realtime_sync_v2';
export const CURRENT_DEVICE_ID = `device_${crypto.randomUUID()}`;

class RealtimeSyncManager {
  private accountId = 'guest';
  private channel: BroadcastChannel | null = null;
  private listeners: ((payload: RealtimeSyncPayload) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (event.data && typeof event.data === 'object') {
            this.notifyListeners(event.data as RealtimeSyncPayload);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel initialization failed, fallback to storage events', e);
      }
    }

    // Storage event fallback for cross-tab sync
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'benbi_cross_tab_event' && e.newValue) {
          try {
            const payload = JSON.parse(e.newValue) as RealtimeSyncPayload;
            this.notifyListeners(payload);
          } catch {
            // ignore
          }
        }
      });
    }
  }

  private notifyListeners(payload: RealtimeSyncPayload) {
    if (payload.senderDeviceId === CURRENT_DEVICE_ID || payload.accountId !== this.accountId) return;
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error('Error handling realtime event:', err);
      }
    });
  }

  public subscribe(callback: (payload: RealtimeSyncPayload) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public setAccount(id: string) {
    this.accountId = id;
  }

  public publish(payload: Omit<RealtimeSyncPayload, 'senderDeviceId' | 'timestamp' | 'accountId'>) {
    const fullPayload: RealtimeSyncPayload = {
      ...payload,
      accountId: this.accountId,
      senderDeviceId: CURRENT_DEVICE_ID,
      timestamp: Date.now(),
    };

    if (this.channel) {
      try {
        this.channel.postMessage(fullPayload);
      } catch (e) {
        console.warn('Channel postMessage failed', e);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('benbi_cross_tab_event', JSON.stringify(fullPayload));
      } catch {
        // ignore
      }
    }
  }
}

export const realtimeManager = new RealtimeSyncManager();
