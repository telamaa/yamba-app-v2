/**
 * analytics.ts — PostHog dans le navigateur, seulement avec le consentement (D66 2A/3A)
 * =====================================================================================
 * Le choix vit dans le navigateur (`yamba.analytics.consent`, six mois) et, pour un membre,
 * sur son compte. Le SDK n'est chargé qu'après « accepter » (import dynamique) ; refus = rien.
 * Pas d'autocapture, pas d'enregistrement de session, profils « identified_only », DNT respecté.
 * `identify(userId)` à la connexion (id seul), `reset()` à la déconnexion.
 */
export type ConsentChoice = "granted" | "denied";
const STORAGE_KEY = "yamba.analytics.consent";
const CONSENT_TTL_MS = 180 * 86_400_000;

type PostHogLike = { init(key: string, cfg: Record<string, unknown>): unknown; capture(event: string, props?: Record<string, unknown>): unknown; identify(id: string): unknown; reset(): unknown; opt_out_capturing?(): unknown };
let client: PostHogLike | null = null;
let loading: Promise<PostHogLike | null> | null = null;

export function readConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { choice?: ConsentChoice; at?: number };
    if (!parsed.choice || !parsed.at || Date.now() - parsed.at > CONSENT_TTL_MS) return null;
    return parsed.choice;
  } catch {
    return null;
  }
}
export function writeConsent(choice: ConsentChoice): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: Date.now() })); } catch { /* stockage indisponible : la bannière reviendra */ }
}

export const analyticsConfigured = () => Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

/** Charge et initialise PostHog si (et seulement si) le consentement est donné et la clé posée. */
export async function ensureAnalytics(): Promise<PostHogLike | null> {
  if (client) return client;
  if (typeof window === "undefined" || readConsent() !== "granted" || !analyticsConfigured()) return null;
  if (!loading) {
    loading = import("posthog-js")
      .then((mod) => {
        const ph = (mod.default ?? mod) as unknown as PostHogLike;
        ph.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
          api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          disable_session_recording: true,
          person_profiles: "identified_only",
          respect_dnt: true,
          persistence: "localStorage+cookie",
        });
        client = ph;
        return ph;
      })
      .catch(() => null)
      .finally(() => { loading = null; });
  }
  return loading;
}

export async function track(event: string, properties?: Record<string, unknown>): Promise<void> {
  const ph = await ensureAnalytics();
  ph?.capture(event, properties);
}
export async function trackPageview(path: string): Promise<void> {
  const ph = await ensureAnalytics();
  ph?.capture("$pageview", { $current_url: typeof window !== "undefined" ? window.location.href : path, path });
}
export async function identifyUser(userId: string): Promise<void> {
  const ph = await ensureAnalytics();
  ph?.identify(userId);
}
export function resetAnalytics(): void {
  client?.reset();
}
/** Refus a posteriori : on arrête tout et on oublie l'identité côté navigateur. */
export function disableAnalytics(): void {
  try { client?.opt_out_capturing?.(); client?.reset(); } catch { /* rien */ }
  client = null;
}
