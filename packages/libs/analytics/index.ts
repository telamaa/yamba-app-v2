/**
 * @packages/libs/analytics — PostHog côté serveur, sans SDK (D66 4A)
 * ==================================================================
 * `POST {POSTHOG_HOST}/batch` par `fetch`, fire-and-forget, inerte sans `POSTHOG_API_KEY`. Les
 * événements métier de l'outbox deviennent des événements produit : `distinct_id` = userId,
 * `uuid` = identifiant de l'événement (dédoublonnage côté PostHog), propriétés sur LISTE BLANCHE —
 * jamais nom, email, téléphone, adresse, photo, code (A57). Pur là où c'est possible, testé.
 */
export const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

export type AnalyticsEvent = { distinctId: string; event: string; uuid?: string; timestamp?: string; properties?: Record<string, unknown> };
export type AnalyticsConfig = { apiKey: string | undefined; host: string };

export function analyticsConfigFromEnv(env: Record<string, string | undefined> = process.env): AnalyticsConfig {
  return { apiKey: env.POSTHOG_API_KEY || undefined, host: (env.POSTHOG_HOST || DEFAULT_POSTHOG_HOST).replace(/\/$/, "") };
}
export const isAnalyticsEnabled = (cfg: AnalyticsConfig = analyticsConfigFromEnv()) => Boolean(cfg.apiKey);

/** Pur : la charge utile PostHog d'un lot. */
export function batchPayload(cfg: AnalyticsConfig, events: AnalyticsEvent[]): Record<string, unknown> {
  return {
    api_key: cfg.apiKey,
    batch: events.map((e) => ({
      event: e.event,
      distinct_id: e.distinctId,
      ...(e.uuid ? { uuid: e.uuid } : {}),
      timestamp: e.timestamp ?? new Date().toISOString(),
      properties: { ...(e.properties ?? {}), $lib: "yamba-server", $process_person_profile: true },
    })),
  };
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

/** Envoie un lot ; jamais d'exception vers l'appelant (un analytics qui casse un consumer serait une faute). */
export async function captureServerEvents(events: AnalyticsEvent[], deps: { cfg?: AnalyticsConfig; fetchImpl?: FetchLike; onError?: (err: unknown) => void } = {}): Promise<boolean> {
  const cfg = deps.cfg ?? analyticsConfigFromEnv();
  if (!cfg.apiKey || events.length === 0) return false;
  const fetchImpl: FetchLike = deps.fetchImpl ?? ((u, i) => fetch(u, i));
  try {
    const res = await fetchImpl(`${cfg.host}/batch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(batchPayload(cfg, events)) });
    if (!res.ok) deps.onError?.(new Error(`PostHog ${res.status}`));
    return res.ok;
  } catch (err) {
    deps.onError?.(err);
    return false;
  }
}

/* ── Événements outbox → événements produit (pur) ───────────────────────── */

/** Liste BLANCHE des propriétés d'un événement `booking.*` / `conversation.*` reprises telles quelles. */
export const ALLOWED_EVENT_PROPERTIES = ["bookingId", "tripId", "conversationId", "category", "categoryFamily", "weightKg", "transportCents", "totalShipperCents", "currencyCode", "actor", "status", "reason", "outcome", "kind", "amountCents"] as const;

export type OutboxLikeEvent = { eventId: string; eventType: string; occurredAt?: string | Date; payload: Record<string, unknown> & { shipperId?: string; carrierId?: string; corridor?: { originCity?: string | null; originCountryCode?: string | null; destinationCity?: string | null; destinationCountryCode?: string | null } } };

/** Les parties d'un événement (dédoublonnées) — l'analytics ne s'adresse qu'à celles qui ont consenti. */
export function partiesOf(e: OutboxLikeEvent): string[] {
  return [...new Set([e.payload.shipperId, e.payload.carrierId].filter((x): x is string => typeof x === "string" && x.length > 0))];
}

/** Pur : un événement outbox → un événement produit par partie consentante. Rien qui identifie une personne. */
export function analyticsEventsFor(e: OutboxLikeEvent, consentingUserIds: readonly string[]): AnalyticsEvent[] {
  const props: Record<string, unknown> = {};
  for (const k of ALLOWED_EVENT_PROPERTIES) {
    const v = (e.payload as Record<string, unknown>)[k];
    if (v !== undefined && v !== null && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) props[k] = v;
  }
  const c = e.payload.corridor;
  if (c) {
    if (c.originCity) props.originCity = c.originCity;
    if (c.originCountryCode) props.originCountryCode = c.originCountryCode;
    if (c.destinationCity) props.destinationCity = c.destinationCity;
    if (c.destinationCountryCode) props.destinationCountryCode = c.destinationCountryCode;
    if (c.originCity && c.destinationCity) props.corridor = `${c.originCity} → ${c.destinationCity}`;
  }
  const timestamp = e.occurredAt ? new Date(e.occurredAt).toISOString() : undefined;
  return partiesOf(e)
    .filter((id) => consentingUserIds.includes(id))
    .map((distinctId) => ({
      distinctId,
      event: e.eventType,
      uuid: uuidFrom(`${e.eventId}:${distinctId}`),
      timestamp,
      properties: { ...props, role: distinctId === e.payload.shipperId ? "SHIPPER" : "CARRIER", source: "outbox" },
    }));
}

/** UUID v5-like déterministe (SHA-1 de la graine, mis en forme) : le même événement rejoué ne compte pas deux fois. */
export function uuidFrom(seed: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const h = createHash("sha1").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0")}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}
