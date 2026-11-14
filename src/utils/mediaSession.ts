/**
 * Media Session API integration for Lock Screen and Smartwatch controls.
 * Allows users to control (Play / Pause) active tasks from the lock screen.
 */
import { TaskItem } from './engine';
import { soundEngine } from './audio';

const CATEGORY_NAMES: Record<string, string> = {
  health: 'Sức khoẻ',
  work: 'Công việc',
  study: 'Học hành',
  habit: 'Thói quen',
};

export function setupMediaSession(
  runningTask: TaskItem | null,
  handlers: {
    onPlay: () => void;
    onPause: () => void;
  },
) {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) {
    return;
  }

  if (!runningTask) {
    navigator.mediaSession.playbackState = 'none';
    soundEngine.stopSilentTrack();
    try {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
    } catch {
      // Ignore
    }
    return;
  }

  const categoryName = CATEGORY_NAMES[runningTask.category] || 'Bền bỉ';
  const modeName = runningTask.mode === 'habit' ? 'Thói quen' : 'Dự án';

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${runningTask.name} - ${modeName}`,
      artist: 'Bền bỉ tới cùng',
      album: categoryName,
      artwork: [
        {
          src: '/icon.svg',
          sizes: '512x512',
          type: 'image/svg+xml',
        },
      ],
    });

    navigator.mediaSession.playbackState = runningTask.status === 'running' ? 'playing' : 'paused';

    if (runningTask.status === 'running') {
      soundEngine.startSilentTrack();
    } else {
      soundEngine.stopSilentTrack();
    }

    navigator.mediaSession.setActionHandler('play', () => {
      handlers.onPlay();
      navigator.mediaSession.playbackState = 'playing';
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      handlers.onPause();
      navigator.mediaSession.playbackState = 'paused';
    });
  } catch (err) {
    console.warn('MediaSession setup failed', err);
  }
}
