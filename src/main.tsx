import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import App from './App';
import './styles/globals.css';

const sentryDsn =
  (import.meta.env.VITE_SENTRY_DSN as string | undefined) ||
  Object.keys(import.meta.env).find((k) => k.startsWith('VITE_SENTRY_DSN') && import.meta.env[k]);

if (sentryDsn) {
  import('./sentry');
}

const isNative = Capacitor.isNativePlatform() || import.meta.env.VITE_CAPACITOR_BUILD === 'true';
const Router = isNative ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>,
);
