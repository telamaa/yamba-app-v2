/**
 * sentry.ts — observabilité des erreurs (C-PR3, D56 7A)
 * =====================================================
 * `initSentry(service)` : ne fait rien sans SENTRY_DSN (dev par défaut) ;
 * `captureServerError(err, req)` : envoie les 5xx et les erreurs non opérationnelles,
 * taguées du service et de l'identifiant de corrélation posé par le gateway —
 * la même clé que dans les logs, pour remonter de l'alerte à la requête.
 */
import * as Sentry from "@sentry/node";

let enabled = false;

export function initSentry(service: string): boolean {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || undefined,
    tracesSampleRate: 0,
    initialScope: { tags: { service } },
  });
  enabled = true;
  return true;
}

export function isSentryEnabled(): boolean {
  return enabled;
}

export function captureServerError(err: unknown, req?: { headers?: Record<string, unknown>; method?: string; originalUrl?: string; url?: string }): void {
  if (!enabled) return;
  const correlationId = typeof req?.headers?.["x-correlation-id"] === "string" ? (req.headers["x-correlation-id"] as string) : undefined;
  Sentry.captureException(err, {
    tags: { correlationId: correlationId ?? "none" },
    extra: { method: req?.method, path: req?.originalUrl ?? req?.url },
  });
}
