import { useEffect, useState } from 'react';

/**
 * Component-local clock. Keeps the tick out of App state so a running timer
 * only re-renders the card that displays it.
 *
 * iOS suspends a locked/backgrounded PWA and can leave intervals dead on resume,
 * so the timer must resync from the wall clock and restart its tick on return.
 */
export function useNow(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    let id = window.setInterval(() => setNow(Date.now()), intervalMs);

    const resync = () => {
      window.clearInterval(id);
      id = window.setInterval(() => setNow(Date.now()), intervalMs);
      setNow(Date.now());
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') resync();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', resync);
    window.addEventListener('focus', resync);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', resync);
      window.removeEventListener('focus', resync);
    };
  }, [intervalMs, active]);

  return now;
}
