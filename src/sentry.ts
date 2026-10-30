// Optional Sentry init for the browser bundle.
//
// Set VITE_SENTRY_DSN to enable error reporting. When the variable is unset or
// empty this module does nothing. The DSN is browser-safe by Sentry's design.
// Session Replay is off by default.

import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE ?? "development",
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export {};
