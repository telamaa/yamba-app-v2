/**
 * pending-payment.ts — ce qu'il faut retrouver au retour d'une redirection (D82 7A)
 * =================================================================================
 * Klarna et PayPal **quittent la page**. Au retour, le navigateur remonte le wizard à
 * neuf : le brouillon et l'étape survivent (ils sont déjà en `sessionStorage`), mais deux
 * choses vivaient en mémoire du composant et disparaissaient avec lui :
 *
 *   1. **l'identifiant de l'autorisation** — sans lui, l'étape 4 repartait en créer UNE
 *      AUTRE : une seconde empreinte sur le moyen de paiement du membre, et la première
 *      laissée orpheline (ramassée depuis par le cron D82 9A, mais deux heures plus tard) ;
 *   2. **les URL des photos déjà téléversées** — elles vivaient dans une variable locale de
 *      `submit()`. Les `File` du navigateur, eux, ne sont pas sérialisables et sont perdus
 *      pour de bon : sans ces URL, la réservation naîtrait SANS ses photos, alors qu'elles
 *      sont déjà chez ImageKit et payées.
 *
 * D'où ce dossier d'attente, écrit JUSTE AVANT de confirmer le paiement — le seul instant
 * où la page peut disparaître.
 *
 * Choix de stockage : **`sessionStorage`**, jamais `localStorage`. Il meurt avec l'onglet,
 * il ne traverse ni les onglets ni les jours, et il survit exactement à ce qu'il doit
 * survivre : une redirection. Rien de sensible n'y entre — ni secret client, ni moyen de
 * paiement, ni coordonnées : un identifiant d'intention et des URL d'images.
 *
 * Toutes les lectures et écritures sont enveloppées : navigation privée, stockage refusé,
 * quota dépassé ne doivent jamais casser un parcours d'argent. Pas de dossier = on repart
 * du chemin normal, pas d'erreur à l'écran.
 */

/** Bump à chaque changement de forme : un dossier d'une autre version est ignoré. */
export const PENDING_PAYMENT_VERSION = 1;

/**
 * Durée de vie : 30 minutes. Au-delà, un retour n'est plus un retour — c'est un onglet
 * oublié. L'autorisation, elle, est libérée par le cron d'orphelines (D82 9A).
 */
export const PENDING_PAYMENT_TTL_MS = 30 * 60 * 1000;

export type PendingPayment = {
  v: number;
  tripId: string;
  paymentIntentId: string;
  /** Photos DÉJÀ téléversées (A45) : jamais les `File`, qui ne survivent pas. */
  photoUrls: string[];
  /** Le total autorisé, pour refuser un retour qui ne parle pas du même devis. */
  totalCents: number;
  savedAt: number;
};

const key = (tripId: string) => `yamba.booking.pendingPayment:${tripId}`;

/** Écrit le dossier d'attente. Best effort : un échec de stockage ne casse rien. */
export function savePendingPayment(p: Omit<PendingPayment, "v" | "savedAt">, now: number = Date.now()): void {
  try {
    const record: PendingPayment = { ...p, v: PENDING_PAYMENT_VERSION, savedAt: now };
    window.sessionStorage.setItem(key(p.tripId), JSON.stringify(record));
  } catch {
    /* navigation privée, stockage refusé, quota : on continue sans filet */
  }
}

/**
 * Relit le dossier d'attente de CE trajet. Rend `null` dès qu'il manque, qu'il est
 * illisible, d'une autre version, périmé, ou qu'il parle d'un autre trajet.
 */
export function readPendingPayment(tripId: string, now: number = Date.now()): PendingPayment | null {
  try {
    const raw = window.sessionStorage.getItem(key(tripId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPayment>;
    if (parsed?.v !== PENDING_PAYMENT_VERSION) return null;
    if (parsed.tripId !== tripId) return null;
    if (typeof parsed.paymentIntentId !== "string" || !parsed.paymentIntentId) return null;
    if (typeof parsed.savedAt !== "number" || now - parsed.savedAt > PENDING_PAYMENT_TTL_MS) return null;
    return {
      v: PENDING_PAYMENT_VERSION,
      tripId,
      paymentIntentId: parsed.paymentIntentId,
      photoUrls: Array.isArray(parsed.photoUrls) ? parsed.photoUrls.filter((u): u is string => typeof u === "string") : [],
      totalCents: typeof parsed.totalCents === "number" ? parsed.totalCents : 0,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearPendingPayment(tripId: string): void {
  try {
    window.sessionStorage.removeItem(key(tripId));
  } catch {
    /* rien à faire : le dossier périme seul */
  }
}

/** Ce que Stripe ajoute à l'URL de retour (`return_url`). */
export type RedirectReturn = {
  paymentIntentId: string;
  /** `succeeded`, `processing`, `failed`… tel que Stripe l'écrit. */
  status: string | null;
};

/**
 * Lit un retour de redirection dans une query string. Fonction PURE : elle prend la
 * chaîne, pas `window` — c'est la partie qu'on peut raisonner et vérifier à la main.
 *
 * Stripe appose `payment_intent`, `payment_intent_client_secret` et `redirect_status`. On
 * ne garde QUE l'identifiant et le statut : le secret client n'a rien à faire dans notre
 * logique, et il traîne déjà assez dans la barre d'adresse.
 */
export function readRedirectReturn(search: string): RedirectReturn | null {
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const paymentIntentId = params.get("payment_intent");
    if (!paymentIntentId) return null;
    return { paymentIntentId, status: params.get("redirect_status") };
  } catch {
    return null;
  }
}

/**
 * Le retour parle-t-il bien du dossier qu'on attendait ?
 *
 * Deux refus volontaires : un identifiant qui ne correspond pas (onglet recyclé, URL
 * collée à la main) et un `redirect_status=failed` (la banque a refusé — il faut repayer,
 * pas créer une réservation).
 */
export function matchesPendingPayment(ret: RedirectReturn, pending: PendingPayment | null): boolean {
  if (!pending) return false;
  if (ret.paymentIntentId !== pending.paymentIntentId) return false;
  return ret.status !== "failed";
}

/** Nettoie l'URL de ses paramètres Stripe, sans recharger la page ni perdre l'historique. */
export function stripRedirectParams(): void {
  try {
    const url = new URL(window.location.href);
    let touched = false;
    for (const p of ["payment_intent", "payment_intent_client_secret", "redirect_status", "source_redirect_slug"]) {
      if (url.searchParams.has(p)) {
        url.searchParams.delete(p);
        touched = true;
      }
    }
    if (touched) window.history.replaceState({}, "", url.toString());
  } catch {
    /* une URL non nettoyée n'empêche rien : le dossier d'attente, lui, est consommé */
  }
}
