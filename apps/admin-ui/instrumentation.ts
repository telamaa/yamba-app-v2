/**
 * instrumentation.ts — Sentry côté serveur Next (C-PR3, D56 7A). Inerte sans SENTRY_DSN.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: 0,
    initialScope: { tags: { app: "admin-ui-server" } },
  });
}
