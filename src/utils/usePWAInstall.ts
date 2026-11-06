import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already running in standalone display mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Dynamic Manifest injection if not already present
    injectDynamicManifest();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
    } catch (err) {
      console.warn('PWA install error:', err);
    }
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
    promptInstall: install,
  };
}

/**
 * Injects W3C Web Manifest dynamically as a Blob URL with high-contrast maskable SVG icon
 */
function injectDynamicManifest() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[rel="manifest"]')) return;

  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" rx="128" fill="#1E3A5F"/>
      <circle cx="256" cy="256" r="180" fill="none" stroke="#FF6B00" stroke-width="36"/>
      <path d="M256 140 L280 230 L370 256 L280 282 L256 372 L232 282 L142 256 L232 230 Z" fill="#FCC934"/>
      <circle cx="256" cy="256" r="28" fill="#FFFFFF"/>
    </svg>
  `.trim();

  const svgDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgIcon)}`;

  const manifestData = {
    id: '/',
    name: 'Bền Bỉ Tới Cùng - Persistence To The End',
    short_name: 'Bền Bỉ',
    description: 'Ứng dụng PWA Offline-First tối ưu kỷ luật, đếm giờ độ lệch thời gian thực và đồng bộ đa thiết bị.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#1E3A5F',
    background_color: '#FFFFFF',
    icons: [
      {
        src: svgDataUrl,
        sizes: '192x192 512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: svgDataUrl,
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };

  const blob = new Blob([JSON.stringify(manifestData, null, 2)], {
    type: 'application/manifest+json',
  });
  const manifestUrl = URL.createObjectURL(blob);

  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = manifestUrl;
  document.head.appendChild(link);

  // Set theme color
  let themeMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeMeta) {
    themeMeta = document.createElement('meta');
    themeMeta.setAttribute('name', 'theme-color');
    document.head.appendChild(themeMeta);
  }
  themeMeta.setAttribute('content', '#1E3A5F');

  // Set Apple mobile tags
  const appleMeta = document.createElement('meta');
  appleMeta.setAttribute('name', 'apple-mobile-web-app-capable');
  appleMeta.setAttribute('content', 'yes');
  document.head.appendChild(appleMeta);

  const appleStatusMeta = document.createElement('meta');
  appleStatusMeta.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
  appleStatusMeta.setAttribute('content', 'black-translucent');
  document.head.appendChild(appleStatusMeta);
}
