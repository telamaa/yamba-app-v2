/**
 * messages.api.ts — le fil de discussion, côté réseau (D117).
 * =============================================================
 * `message-service` (port 6005) derrière le gateway, préfixe `/messages/*`.
 *
 * Ces fonctions ne PROJETTENT rien : elles rendent le corps brut, et c'est
 * `lib/fil.ts` qui le lit. La frontière est celle d'A223 — ce fichier tire
 * `client.ts` → `base-url.ts` → `expo-constants`, que le harnais de fiches
 * (`testEnvironment: node`) ne sait pas charger. Les règles vivent donc de
 * l'autre côté, et elles sont jouables.
 *
 * Elles JETTENT, et c'est voulu : les refus de ce service portent un
 * `details.code` destiné au client (A146) — `DELIVERY_CODE_IN_MESSAGE`
 * quand un groupe de six chiffres correspond au code du deal (D43),
 * `CONVERSATION_READ_ONLY` pendant un litige ou après la fenêtre de
 * quatorze jours. Avaler l'exception transformerait une RÈGLE en panne.
 */
import { apiFetch } from '@/lib/api/client';

/** Toutes mes conversations : `{ items, totalUnread }`. */
export function mesConversations(): Promise<unknown> {
  return apiFetch<unknown>('/messages/conversations');
}

/** Un fil : la conversation, ses messages, son curseur. */
export function leFil(conversationId: string): Promise<unknown> {
  return apiFetch<unknown>(`/messages/conversations/${conversationId}`);
}

/* `GET /conversations/by-deal/:bookingId` existe au service et n'est PAS
 * appelé ici : la porte depuis l'écran d'une demande trouve sa conversation
 * dans le contexte d'activité, qui porte déjà la liste (D117 0A) — une
 * requête de moins pour ouvrir une porte qu'on ne franchira peut-être pas.
 *
 * Une fonction écrite « pour la complétude » a vécu ici une heure. Un export
 * sans appelant est un commentaire (D110), et ce lot en a supprimé six le
 * matin même. */

/** J'écris. Le corps est déjà trimé et borné par `corpsAEnvoyer`. */
export function envoyerLeMessage(
  conversationId: string,
  corps: { body: string }
): Promise<unknown> {
  return apiFetch<unknown>(`/messages/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: corps,
  });
}

/**
 * J'ai lu. Le serveur remet le compteur à zéro pour MOI seul.
 *
 * Un échec ici ne se dit pas à l'écran : le pire qu'il puisse arriver est
 * qu'une pastille reste une minute de trop. Interrompre une lecture pour
 * ça serait pire que le défaut.
 */
export function marquerLu(conversationId: string): Promise<unknown> {
  return apiFetch<unknown>(`/messages/conversations/${conversationId}/read`, { method: 'POST' });
}

/** Le catalogue des réponses rapides, traduit par le serveur (D61 2A). */
export function reponsesRapides(): Promise<unknown> {
  return apiFetch<unknown>('/messages/quick-replies');
}

/**
 * Je propose un rendez-vous (D118). Une proposition ouverte du même genre
 * est ANNULÉE par le serveur : c'est une contre-proposition, jamais deux
 * propositions ouvertes à la fois.
 *
 * Elle JETTE : `INVALID_MEETUP_SLOT` porte la borne en cause dans
 * `details.reason`, et `CONVERSATION_READ_ONLY` dit que le fil s'est fermé
 * entre-temps.
 */
export function proposerLeRendezVous(
  conversationId: string,
  corps: {
    kind: string;
    placeLabel: string;
    placeDetails?: string;
    startAt: string;
    endAt: string;
  }
): Promise<unknown> {
  return apiFetch<unknown>(`/messages/conversations/${conversationId}/meetups`, {
    method: 'POST',
    body: corps,
  });
}

/**
 * J'accepte le rendez-vous de l'AUTRE partie.
 *
 * Le serveur refuse ma propre proposition (`OWN_PROPOSAL`) et une
 * proposition qui a bougé entre l'affichage et l'appui (`MEETUP_CHANGED`,
 * verrou optimiste sur `PROPOSED`).
 */
export function accepterLeRendezVous(
  conversationId: string,
  meetupId: string
): Promise<unknown> {
  return apiFetch<unknown>(
    `/messages/conversations/${conversationId}/meetups/${meetupId}/accept`,
    { method: 'POST' }
  );
}

/**
 * J'ouvre le numéro de l'autre partie (D61 4A).
 *
 * Geste IDEMPOTENT côté serveur : un second appui rend le même numéro et la
 * même trace, pas une erreur. Refus possibles : `TOO_EARLY` (la porte n'est
 * pas encore ouverte) et `NO_ANCHOR` (ni rendez-vous de prise en charge
 * accepté, ni date de départ lisible).
 */
export function revelerLeNumero(conversationId: string): Promise<unknown> {
  return apiFetch<unknown>(`/messages/conversations/${conversationId}/phone`, { method: 'POST' });
}

/** Je signale un message de l'autre partie (D61 7A). */
export function signalerLeMessage(
  conversationId: string,
  messageId: string,
  corps: { reason: string; details?: string }
): Promise<unknown> {
  return apiFetch<unknown>(
    `/messages/conversations/${conversationId}/messages/${messageId}/report`,
    { method: 'POST', body: corps }
  );
}
