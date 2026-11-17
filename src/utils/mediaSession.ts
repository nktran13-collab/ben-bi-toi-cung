/**
 * Media Session API integration for Lock Screen and Smartwatch controls.
 * Allows users to control (Play / Pause) active tasks from the lock screen.
 */
import { TaskItem } from './engine';
import { soundEngine } from './audio';
import { t } from './i18n';

const CATEGORY_KEYS = {
  health: 'category.health',
  work: 'category.work',
  study: 'category.study',
  habit: 'category.habit',
} as const;

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

  const categoryKey = CATEGORY_KEYS[runningTask.category as keyof typeof CATEGORY_KEYS];
  const categoryName = categoryKey ? t(categoryKey) : t('media.fallback');
  const modeName = runningTask.mode === 'habit' ? t('media.modeHabit') : t('media.modeProject');

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${runningTask.name} - ${modeName}`,
      artist: t('media.artist'),
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
