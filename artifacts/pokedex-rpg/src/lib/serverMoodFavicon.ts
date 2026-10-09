import { useEffect } from 'react';

type ServerMood = 'happy' | 'angry' | 'tired';

const ICONS: Record<ServerMood, string> = {
  angry: '/wooper-bravo.png',
  tired: '/wooper-cansado.png',
  happy: '/wooper-feliz.png',
};

function setServerMood(mood: ServerMood) {
  const icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!icon) return;
  const nextHref = new URL(ICONS[mood], window.location.origin).href;
  if (icon.href !== nextHref) icon.href = nextHref;
}

export function useServerMoodFavicon() {
  useEffect(() => {
    let disposed = false;
    let checking = false;

    const checkServer = async () => {
      if (disposed || checking) return;
      if (!navigator.onLine) {
        setServerMood('tired');
        return;
      }

      checking = true;
      try {
        const response = await fetch('/api/healthz', {
          cache: 'no-store',
          credentials: 'include',
          signal: AbortSignal.timeout(6000),
        });

        if (disposed) return;
        if (response.status >= 500) {
          setServerMood('angry');
          return;
        }
        if (!response.ok) {
          setServerMood('tired');
          return;
        }

        const health = await response.json() as { status?: unknown };
        if (disposed) return;
        if (health.status === 'ok') {
          setServerMood('happy');
        } else if (
          health.status === 'down'
          || health.status === 'disabled'
          || health.status === 'offline'
          || health.status === 'stopped'
          || health.status === 'unavailable'
          || health.status === 'error'
        ) {
          setServerMood('angry');
        } else {
          setServerMood('tired');
        }
      } catch {
        if (!disposed) setServerMood('tired');
      } finally {
        checking = false;
      }
    };

    const onOnline = () => { void checkServer(); };
    const onOffline = () => setServerMood('tired');
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkServer();
    };

    void checkServer();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void checkServer();
    }, 20_000);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}
