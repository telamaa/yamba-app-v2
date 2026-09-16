/**
 * @packages/libs/maintenance — les règles pures du mode lecture seule (C-PR8c, D64 2A)
 * =====================================================================================
 * Sans dépendance : consommées par le gateway (qui sonde la base) et testées depuis l'auth-service.
 */
export type MaintenanceSnapshot = { enabled: boolean; message: { fr: string; en: string }; scheduledAt: string | null; source: "env" | "db" | "default" };
export const DEFAULT_MAINTENANCE_SNAPSHOT: MaintenanceSnapshot = { enabled: false, message: { fr: "", en: "" }, scheduledAt: null, source: "default" };
export const MAINTENANCE_WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/**
 * Connexion / rafraîchissement, back-office (il doit pouvoir lever la maintenance), et l'état lui-même.
 * Comparés PAR SEGMENT (décision du § 5.23, recette § 5.24 lot c) : `/api/maintenance` était un simple préfixe de chaîne,
 * `/api/maintenanceX` passait donc la lecture seule ; un préfixe se compare au chemin exact ou suivi de « / ».
 */
export const MAINTENANCE_EXEMPT_PREFIXES = ["/api/auth", "/api/admin", "/api/maintenance"];

/**
 * Le chemin est-il exempté ? Segment entier seulement, sans tenir compte de la casse (Express route sans la casse :
 * `/API/AUTH/login` atteint la même route). Un chemin qui ne ressemble pas exactement à un préfixe reste bloqué —
 * l'erreur sûre en lecture seule.
 */
export function isExemptPath(path: string): boolean {
  const p = path.toLowerCase();
  return MAINTENANCE_EXEMPT_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/**
 * Décision du § 5.23 (recette § 5.24, lot b) — le rythme de relecture du bandeau membre : 15 s quand une maintenance est
 * active ou annoncée (le membre doit voir la levée ou le passage en lecture seule vite), 60 s sinon (le sondage courant
 * ne coûte presque rien au gateway, qui sert l'état depuis son cache de 10 s).
 */
export const MAINTENANCE_POLL_ACTIVE_MS = 15_000;
export const MAINTENANCE_POLL_IDLE_MS = 60_000;
export function maintenancePollMs(state: { enabled: boolean; scheduledAt: string | null } | null | undefined, now: number = Date.now()): number {
  if (!state) return MAINTENANCE_POLL_IDLE_MS;
  if (state.enabled) return MAINTENANCE_POLL_ACTIVE_MS;
  const at = state.scheduledAt ? Date.parse(state.scheduledAt) : NaN;
  return Number.isFinite(at) && at > now ? MAINTENANCE_POLL_ACTIVE_MS : MAINTENANCE_POLL_IDLE_MS;
}

/** Les valeurs stockées → un instantané (valeurs manquantes = défauts). */
export function snapshotFrom(values: unknown): MaintenanceSnapshot {
  const v = (values && typeof values === "object" ? values : {}) as Record<string, unknown>;
  return {
    enabled: v.enabled === true,
    message: { fr: typeof v.messageFr === "string" ? v.messageFr : "", en: typeof v.messageEn === "string" ? v.messageEn : "" },
    scheduledAt: typeof v.scheduledAt === "string" ? v.scheduledAt : null,
    source: "db",
  };
}

/** L'environnement l'emporte sur la base (le jour où Mongo est la panne). */
export function envOverride(env: Record<string, string | undefined>): MaintenanceSnapshot | null {
  if (env.MAINTENANCE_MODE !== "on") return null;
  return { enabled: true, message: { fr: env.MAINTENANCE_MESSAGE_FR ?? "Maintenance en cours, la plateforme est en lecture seule.", en: env.MAINTENANCE_MESSAGE_EN ?? "Maintenance in progress, the platform is read-only." }, scheduledAt: null, source: "env" };
}

/** La requête est-elle bloquée ? Écritures seulement, hors auth / admin. */
export function isBlocked(method: string, path: string, state: MaintenanceSnapshot): boolean {
  if (!state.enabled) return false;
  if (!MAINTENANCE_WRITE_METHODS.has(method.toUpperCase())) return false;
  return !isExemptPath(path);
}

/**
 * A182 (recette 02-ADMIN § 5.23) — la santé du gateway dit si l'environnement force la maintenance. Le gateway est le
 * seul processus qui applique `MAINTENANCE_MODE` : l'auth-service lisait SA propre variable, et l'écran se trompait.
 */
export const MAINTENANCE_ENV_CHECK_ERROR = "maintenance (env)";
export const maintenanceCheckError = (state: MaintenanceSnapshot): string | null => (state.enabled ? `maintenance (${state.source})` : null);
export function isForcedByEnvironment(report: { checks?: Record<string, { error: string | null }> } | null | undefined): boolean {
  return report?.checks?.maintenance?.error === MAINTENANCE_ENV_CHECK_ERROR;
}
