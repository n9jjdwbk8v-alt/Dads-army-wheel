import { useEffect, useState } from 'react';

/** Chrome's install prompt event, which isn't in the DOM types yet. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISSED = 'dads-army:install-dismissed';

const standalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

const iPhone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

const wasDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED) === '1';
  } catch {
    return false;
  }
};

/** Suggests adding the site to the Home Screen so it opens full screen like an app. Hidden once installed. */
export default function InstallTip() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [hidden, setHidden] = useState(() => standalone() || wasDismissed() || window.top !== window);

  useEffect(() => {
    const ready = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const installed = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', ready);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {
      // Private mode: it'll just ask again next time.
    }
  };

  if (hidden || (!prompt && !iPhone())) return null;

  return (
    <aside className="install">
      <img className="install__icon" src="./icon-192.png" alt="" width={48} height={48} />
      <div className="install__text">
        <p className="install__title">Get the Dads Army app</p>
        {prompt ? (
          <p className="install__hint">Install it on your phone to open it full screen, even with no signal at the rink.</p>
        ) : (
          <p className="install__hint">
            Tap <strong>Share</strong>{' '}
            <svg className="install__share" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>{' '}
            then <strong>Add to Home Screen</strong> to use it like an app.
          </p>
        )}
      </div>
      <div className="install__actions">
        {prompt && (
          <button
            className="btn btn--primary"
            onClick={async () => {
              await prompt.prompt();
              const { outcome } = await prompt.userChoice;
              setPrompt(null);
              if (outcome === 'accepted') setHidden(true);
            }}
          >
            Install
          </button>
        )}
        <button className="btn btn--ghost" onClick={dismiss}>
          {prompt ? 'Not now' : 'Got it'}
        </button>
      </div>
    </aside>
  );
}
