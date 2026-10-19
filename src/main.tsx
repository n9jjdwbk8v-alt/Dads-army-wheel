import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Offline support for the installed app. Skipped in development and when shown inside another page.
if ('serviceWorker' in navigator && import.meta.env.PROD && window.top === window) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Not supported here (e.g. a private window); the site works the same without it.
    });
  });
}

// iPhones ignore the page's no-zoom setting, so stop their pinch gestures directly.
for (const gesture of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(gesture, e => e.preventDefault(), { passive: false });
}

// Keep the installed app upright where the phone allows it (Android); elsewhere a sideways phone gets a
// "turn your phone upright" screen.
const orientation = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
orientation?.lock?.('portrait').catch(() => {});

// Ask the browser to keep this site's saved roster, history and fees rather than clearing them when the phone
// runs low on space. Installed (Home Screen) apps usually get this automatically.
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
