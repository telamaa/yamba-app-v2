/**
 * instrumentation-client.ts — Sentry navigateur (C-PR3, D56 7A)
 * Chargé par Next 16 avant l'hydratation. Inerte sans NEXT_PUBLIC_SENTRY_DSN.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    initialScope: { tags: { app: "user-ui" } },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
