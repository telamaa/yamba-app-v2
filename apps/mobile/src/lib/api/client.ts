/**
 * client.ts — le client API du mobile (A201, D36)
 * ================================================
 * Miroir des sémantiques de `apps/user-ui/src/lib/api-client.ts`, transposées
 * aux jetons : Bearer au lieu des cookies, refresh en vol UNIQUE partagé par
 * toutes les requêtes 401 concurrentes, et circuit breaker 30 s — sans lui,
 * une session morte ferait payer à CHAQUE requête authentifiée son propre
 * cycle « 401 → refresh → 401 ».
 *
 * Le serveur décide de tout (RG-MOB-1) : un refus métier arrive avec son
 * `details.code`, exposé tel quel dans `ApiError.code`.
 */
import { currentLocale } from '@/i18n/locale-state';

import { apiBaseUrl } from './base-url';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from './token-store';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  /** L'id de corrélation de la requête : le même que dans les logs serveur
   *  et Sentry (le gateway propage `x-correlation-id` tel quel). */
  readonly correlationId: string | null;

  constructor(status: number, message: string, code: string | null, correlationId: string | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

/**
 * Id de corrélation généré CÔTÉ CLIENT : le gateway n'en fabrique un que si
 * la requête n'en porte pas — en l'envoyant, l'app connaît l'id même quand la
 * réponse ne revient jamais (panne réseau). Pas un besoin cryptographique :
 * horodatage + aléa suffisent à corréler.
 */
function newCorrelationId(): string {
  return `mob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
};

/** Mémorise la paire reçue (login ou refresh) et réarme le circuit breaker. */
export async function storeSessionTokens(tokens: SessionTokens): Promise<void> {
  setAccessToken(tokens.accessToken);
  await setRefreshToken(tokens.refreshToken);
  lastRefreshFailureAt = null;
}

/* ── Refresh : vol unique + circuit breaker (même contrat que le web) ────── */

const REFRESH_FAILURE_COOLDOWN_MS = 30_000;
let lastRefreshFailureAt: number | null = null;
let refreshInFlight: Promise<boolean> | null = null;

function breakerOpen(): boolean {
  return (
    lastRefreshFailureAt !== null &&
    Date.now() - lastRefreshFailureAt < REFRESH_FAILURE_COOLDOWN_MS
  );
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (refreshToken === null) return false;

  try {
    const response = await fetch(`${apiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${refreshToken}`,
        'x-token-delivery': 'body',
        'x-locale': currentLocale(),
      },
    });
    if (!response.ok) return false;

    const body = (await response.json()) as { tokens?: SessionTokens };
    if (!body.tokens) return false;

    await storeSessionTokens(body.tokens);
    return true;
  } catch {
    // Panne réseau : on n'invalide PAS la session (le refresh resservira),
    // mais le breaker évitera de marteler.
    return false;
  }
}

/** Rafraîchit la session — un seul vol à la fois, les appels concurrents
 *  partagent la même promesse. Échec → jetons purgés + breaker armé. */
export async function refreshSession(): Promise<boolean> {
  if (breakerOpen()) return false;

  if (refreshInFlight === null) {
    refreshInFlight = doRefresh()
      .then(async (ok) => {
        if (!ok) {
          lastRefreshFailureAt = Date.now();
          await clearTokens();
        }
        return ok;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/* ── Le fetch de toutes les requêtes ─────────────────────────────────────── */

type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  /** false = route publique : pas de Bearer, pas de cycle refresh. */
  requireAuth?: boolean;
};

async function rawFetch(
  path: string,
  options: ApiFetchOptions,
  correlationId: string
): Promise<Response> {
  const headers: Record<string, string> = {
    'x-locale': currentLocale(),
    'x-correlation-id': correlationId,
    ...options.headers,
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.requireAuth !== false) {
    const access = getAccessToken();
    if (access) headers.authorization = `Bearer ${access}`;
  }
  return fetch(`${apiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function toApiError(response: Response, correlationId: string): Promise<ApiError> {
  let message = `HTTP ${response.status}`;
  let code: string | null = null;
  try {
    const body = (await response.json()) as {
      message?: string;
      details?: { code?: unknown };
    };
    if (typeof body.message === 'string') message = body.message;
    if (typeof body.details?.code === 'string') code = body.details.code;
  } catch {
    // Corps non-JSON (504 du gateway…) : on garde le statut.
  }
  return new ApiError(response.status, message, code, correlationId);
}

/**
 * Appel API. Sur un 401 d'une route authentifiée : UN refresh partagé, puis
 * une (seule) relance de la requête — jamais de boucle. La relance porte le
 * MÊME id de corrélation : les deux lignes serveur racontent un seul geste.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const correlationId = newCorrelationId();
  let response = await rawFetch(path, options, correlationId);

  if (response.status === 401 && options.requireAuth !== false) {
    const refreshed = await refreshSession();
    if (!refreshed) throw await toApiError(response, correlationId);
    response = await rawFetch(path, options, correlationId);
  }

  if (!response.ok) throw await toApiError(response, correlationId);
  return (await response.json()) as T;
}
