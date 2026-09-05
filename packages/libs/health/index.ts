/**
 * @packages/libs/health — un /health uniforme (C-PR8c, D64 3A)
 * =============================================================
 * `healthHandler({ service, checks })` renvoie un handler Express : statut `ok` si toutes les
 * vérifications passent, `degraded` sinon (toujours HTTP 200 : un service qui répond est vivant,
 * c'est le corps qui dit s'il est en forme). Chaque vérification a 2 s ; jamais d'exception.
 * Pur (les vérifications sont injectées) : `mongoCheck(prisma)` et `redisCheck(redis)` sont fournis.
 */
export type HealthCheckResult = { ok: boolean; ms: number; error: string | null };
export type HealthCheck = () => Promise<unknown>;
export type HealthReport = { status: "ok" | "degraded"; service: string; version: string; uptimeSeconds: number; checks: Record<string, HealthCheckResult>; at: string };

export const HEALTH_CHECK_TIMEOUT_MS = 2_000;
const STARTED_AT = Date.now();

export async function runCheck(check: HealthCheck, timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS): Promise<HealthCheckResult> {
  const t0 = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([check(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs} ms`)), timeoutMs); })]);
    return { ok: true, ms: Date.now() - t0, error: null };
  } catch (err) {
    return { ok: false, ms: Date.now() - t0, error: err instanceof Error ? err.message : String(err) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function buildHealthReport(service: string, checks: Record<string, HealthCheck>, now: Date = new Date()): Promise<HealthReport> {
  const entries = await Promise.all(Object.entries(checks).map(async ([name, check]) => [name, await runCheck(check)] as const));
  const results = Object.fromEntries(entries);
  return {
    status: entries.every(([, r]) => r.ok) ? "ok" : "degraded",
    service,
    version: process.env.APP_VERSION ?? process.env.GIT_SHA ?? "dev",
    uptimeSeconds: Math.floor((now.getTime() - STARTED_AT) / 1000),
    checks: results,
    at: now.toISOString(),
  };
}

type Res = { setHeader(name: string, value: string): unknown; status(code: number): { json(body: unknown): unknown } };
export function healthHandler(service: string, checks: Record<string, HealthCheck>) {
  return async (_req: unknown, res: Res) => {
    const report = await buildHealthReport(service, checks);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(report);
  };
}

/** Ping Mongo par la commande `ping` (aucune collection touchée). */
export const mongoCheck = (prisma: { $runCommandRaw(cmd: Record<string, unknown>): Promise<unknown> }): HealthCheck => () => prisma.$runCommandRaw({ ping: 1 });
/** Ping Redis. */
export const redisCheck = (redis: { ping(): Promise<string> }): HealthCheck => async () => {
  const r = await redis.ping();
  if (r !== "PONG") throw new Error(`unexpected reply ${r}`);
};
