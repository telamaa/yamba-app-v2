/**
 * @packages/libs/maintenance — les règles pures du mode lecture seule (C-PR8c, D64 2A)
 * =====================================================================================
 * Sans dépendance : consommées par le gateway (qui sonde la base) et testées depuis l'auth-service.
 */
export type MaintenanceSnapshot = { enabled: boolean; message: { fr: string; en: string }; scheduledAt: string | null; source: "env" | "db" | "default" };
export const DEFAULT_MAINTENANCE_SNAPSHOT: MaintenanceSnapshot = { enabled: false, message: { fr: "", en: "" }, scheduledAt: null, source: "default" };
export const MAINTENANCE_WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** Connexion / rafraîchissement, back-office (il doit pouvoir lever la maintenance), et l'état lui-même. */
export const MAINTENANCE_EXEMPT_PREFIXES = ["/api/auth/", "/api/admin/", "/api/maintenance"];

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
  return !MAINTENANCE_EXEMPT_PREFIXES.some((p) => path.startsWith(p));
}
