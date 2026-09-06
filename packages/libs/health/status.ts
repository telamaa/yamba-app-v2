/**
 * status.ts — la sonde publique d'un moniteur externe (D70 1A)
 * =============================================================
 * `serviceEntries()` : les cinq services, ports du poste surchargeables par l'environnement.
 * `probeService()` : un `/health` en 2 s, jamais d'exception. `aggregateStatus()` : règle PURE —
 * le code HTTP porte l'alerte (503 = degraded / down ; 200 = ok / maintenance).
 */
import type { HealthReport } from "./index";

export type ServiceEntry = { name: string; url: string; path: string };
export type ServiceProbe = { name: string; reachable: boolean; status: "ok" | "degraded" | null; ms: number };
export type PublicStatus = "ok" | "maintenance" | "degraded" | "down";
export type PublicStatusBody = { status: PublicStatus; services: ServiceProbe[]; at: string };

export const PROBE_TIMEOUT_MS = 2_000;

export function serviceEntries(env: NodeJS.ProcessEnv = process.env): ServiceEntry[] {
  return [
    { name: "auth-service", url: env.AUTH_SERVICE_URL ?? `http://localhost:${env.AUTH_SERVICE_PORT ?? 6001}`, path: "/health" },
    { name: "trip-service", url: env.TRIP_SERVICE_URL ?? "http://localhost:6002", path: "/health" },
    { name: "deal-service", url: env.DEAL_SERVICE_URL ?? "http://localhost:6003", path: "/health" },
    { name: "notification-service", url: env.NOTIFICATION_SERVICE_URL ?? "http://localhost:6004", path: "/health" },
    { name: "message-service", url: env.MESSAGE_SERVICE_URL ?? "http://localhost:6005", path: "/health" },
  ];
}

export async function probeService(entry: ServiceEntry, timeoutMs: number = PROBE_TIMEOUT_MS, fetchImpl: typeof fetch = fetch): Promise<ServiceProbe & { report: HealthReport | null; error: string | null }> {
  const t0 = Date.now();
  try {
    const r = await fetchImpl(`${entry.url}${entry.path}`, { signal: AbortSignal.timeout(timeoutMs) });
    const body = (await r.json().catch(() => null)) as HealthReport | null;
    const report = body && typeof body === "object" && "status" in body ? body : null;
    return { name: entry.name, reachable: r.ok, status: report ? report.status : null, ms: Date.now() - t0, report, error: r.ok ? null : `HTTP ${r.status}` };
  } catch (err) {
    return { name: entry.name, reachable: false, status: null, ms: Date.now() - t0, report: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Règle pure : maintenance planifiée ≠ panne ; un service injoignable = down ; un service en forme dégradée = degraded. */
export function aggregateStatus(probes: ServiceProbe[], maintenanceEnabled: boolean): { status: PublicStatus; httpStatus: 200 | 503 } {
  if (maintenanceEnabled) return { status: "maintenance", httpStatus: 200 };
  if (probes.some((p) => !p.reachable)) return { status: "down", httpStatus: 503 };
  if (probes.some((p) => p.status !== "ok")) return { status: "degraded", httpStatus: 503 };
  return { status: "ok", httpStatus: 200 };
}

/** Le corps public : jamais une URL interne ni une erreur brute. */
export function toPublicBody(status: PublicStatus, probes: ServiceProbe[], now: Date = new Date()): PublicStatusBody {
  return { status, services: probes.map((p) => ({ name: p.name, reachable: p.reachable, status: p.status, ms: p.ms })), at: now.toISOString() };
}
