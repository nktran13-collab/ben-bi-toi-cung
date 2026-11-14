import { formatClockTime, ScheduledPushRecord } from './engine';

class NotificationService {
  private activeTimers = new Map<string, number>();
  private scheduledRecords = new Map<string, ScheduledPushRecord>();

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermission(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  public async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      return result;
    } catch (e) {
      console.warn('Error requesting notification permission:', e);
      return 'denied';
    }
  }

  /**
   * Schedules a completion notification when habit countdown reaches 00:00.
   * Simulates payload queuing for Supabase Edge Functions / Web Push.
   */
  public scheduleHabitEndPush(taskId: string, taskName: string, remainingMs: number): ScheduledPushRecord | null {
    this.cancelScheduledPush(taskId);

    const now = Date.now();
    const scheduledEndAtMs = now + remainingMs;
    const targetMinutes = Math.round(remainingMs / 60000);

    const record: ScheduledPushRecord = {
      taskId,
      taskName,
      scheduledEndAtMs,
      targetMinutes,
      active: true,
      createdAtMs: now,
    };

    this.scheduledRecords.set(taskId, record);

    // Mock Payload for Supabase Edge Function / Push Queue
    const mockPushPayload = {
      action: 'QUEUE_SCHEDULED_WEB_PUSH',
      taskId,
      taskName,
      scheduledTimeIso: new Date(scheduledEndAtMs).toISOString(),
      displayTime: formatClockTime(scheduledEndAtMs),
      notification: {
        title: `🔥 Bền Bỉ: ${taskName} đã hoàn thành!`,
        body: 'Đồng hồ đếm ngược đã chạm 00:00. Mở app và nhấn giữ 0.8 giây để bảo toàn chuỗi.',
        tag: `habit-finish-${taskId}`,
      },
    };
    console.log('[Web Push Service Queue Scheduled]', mockPushPayload);

    // Client-side timer trigger
    if (typeof window !== 'undefined') {
      const timerId = window.setTimeout(() => {
        this.sendNotification(
          `🔥 Bền Bỉ: ${taskName} đã hết giờ!`,
          'Đồng hồ đã về 00:00. Chạm để mở ứng dụng và nhấn giữ xác nhận chuỗi của bạn.',
        );
        this.scheduledRecords.delete(taskId);
        this.activeTimers.delete(taskId);
      }, remainingMs);

      this.activeTimers.set(taskId, timerId);
    }

    return record;
  }

  /**
   * Cancels a previously scheduled push when user pauses timer
   */
  public cancelScheduledPush(taskId: string) {
    if (this.activeTimers.has(taskId)) {
      clearTimeout(this.activeTimers.get(taskId));
      this.activeTimers.delete(taskId);
    }
    this.scheduledRecords.delete(taskId);
    console.log(`[Web Push Service Queue Cancelled] Task: ${taskId}`);
  }

  /**
   * Dispatches immediate browser system notification
   */
  public sendNotification(title: string, body: string) {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return;
    }
    try {
      new Notification(title, {
        body,
        icon: '/icon.svg',
        badge: '/icon.svg',
        vibrate: [200, 100, 200],
      } as NotificationOptions);
    } catch (e) {
      console.warn('System Notification dispatch error:', e);
    }
  }

  public getActiveScheduledPush(taskId: string): ScheduledPushRecord | undefined {
    return this.scheduledRecords.get(taskId);
  }
}

export const notificationService = new NotificationService();
