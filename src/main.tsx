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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
