/**
 * shipment.api.ts — le suivi d'UN envoi, côté Expéditeur.
 * ========================================================
 * MÊME endpoint que le web : `GET /deals/:id` (gateway → deal-service), qui
 * sert la vue SHIPPER du deal — un DTO à liste blanche, cadré par rôle (A13) :
 * le Voyageur n'y verrait pas les mêmes champs, et le code de livraison
 * n'existe QUE de ce côté-ci (D43).
 *
 * Le serveur décide de tout (RG-MOB-1) :
 *   • la visibilité — un deal qui n'est pas le tien répond 404, jamais 403
 *     (ne pas révéler l'existence d'une ressource) ;
 *   • `allowedActions` — la machine d'état (16 transitions liées à un acteur)
 *     dit ce qui est permis MAINTENANT. L'app REFLÈTE cette liste, elle ne la
 *     recalcule jamais : un bouton que le serveur n'autorise pas n'existe pas ;
 *   • les montants, en CENTS entiers (D2) — la conversion n'a lieu qu'à
 *     l'affichage ;
 *   • les échéances (`expiresAt`, `payoutDueAt`, `disputeOpensAt`), déjà
 *     calculées : l'app décompte, elle ne décide pas de la date.
 *
 * Les types miroitent le DTO champ à champ pour ce que l'écran consomme —
 * même contrat que `apps/user-ui/src/components/booking/booking-tracker/
 * booking-tracker.adapter.ts`. La forme canonique vit dans le registre Zod
 * (`ShipperBookingViewSchema`, @packages/api-contracts) : on ne l'importe pas
 * ici pour garder Metro à l'écart de zod — et c'est la limite de l'exercice,
 * consignée comme axe.
 */
import { apiFetch } from './client';

/* ── Les statuts du SERVEUR (9, machine de deal-service) ────────────────── */

export type ShipmentServerStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'DISPUTED';

export type ShipmentTrackingStep = 'AT_AIRPORT' | 'FLIGHT_DEPARTED' | 'FLIGHT_ARRIVED';

export type ShipmentPlaceKind = 'AIRPORT' | 'TRAIN_STATION' | 'CITY_AREA';

export type ShipmentPlaceSnapshot = {
  kind: ShipmentPlaceKind;
  details?: string | null;
};

/** La décision d'une médiation, telle qu'elle est servie à l'Expéditeur (D55). */
export type ShipmentDisputeResolution = {
  outcome: 'REJECTED' | 'PARTIAL_REFUND' | 'FULL_REFUND';
  refundCents: number;
  carrierPayoutCents: number;
  reason: string;
  resolvedAt: string;
};

/** Le dossier déposé, en lecture (A74) — le contenu de la version du
 *  Voyageur n'est JAMAIS servi à l'Expéditeur, seule sa date l'est. */
export type ShipmentDisputeFile = {
  ticketNumber: string;
  category: string;
  description: string;
  desiredOutcome?: string | null;
  photoUrls: string[];
  createdAt: string;
  carrierRespondedAt?: string | null;
  resolution?: ShipmentDisputeResolution | null;
};

export type ShipmentRetentionDecision = {
  outcome: 'COMPENSATE_CARRIER' | 'RESTITUTE_SHIPPER';
  reason: string;
  decidedAt: string;
};

/** L'état de notation de MON rôle (B5) — servi, jamais déduit. */
export type ShipmentRatingState = {
  windowEndsAt: string | null;
  ratedByMe: boolean;
  counterpartHasRated: boolean;
  revealedAt: string | null;
  canRate: boolean;
};

/** La préviz ANN-01 — servie, jamais recalculée (le front reflète). Non nulle
 *  exactement quand `cancel` est dans `allowedActions`. */
export type ShipmentCancellationPreview = {
  refundCents: number;
  retentionCents: number;
  retentionPct: number;
  /** `departureAt - 48 h` : avant cet instant, l'annulation rend 100 %. */
  fullRefundUntil: string;
  currencyCode: string;
};

/** La vue SHIPPER de `GET /deals/:id`, restreinte aux champs que l'app lit. */
export type ShipperShipmentDto = {
  id: string;
  tripId: string;
  carrierId: string;
  status: ShipmentServerStatus;
  /** Les faits du trajet GELÉS à la création : le suivi reste lisible même si
   *  le Voyageur modifie ou supprime son trajet ensuite. */
  trip: {
    originCity: string;
    destinationCity: string;
    originCountryCode?: string | null;
    destinationCountryCode?: string | null;
    /** Fuseaux IANA (D24) : l'heure se lit dans le fuseau du LIEU, pas du téléphone. */
    originTimezone?: string | null;
    destinationTimezone?: string | null;
    departureAt: string;
    transportMode?: string | null;
  };
  /** L'instantané de prix, IMMUABLE (D17) — jamais recalculé depuis le trajet. */
  pricing: {
    weightKg: number;
    billableWeightKg?: number | null;
    sizeClass?: string | null;
    product?: string | null;
    transportCents: number;
    commissionCents: number;
    premiumCents: number;
    totalShipperCents: number;
    currencyCode: string;
    protectionTier?: string | null;
    // `sizeCoef` et `minimumApplied` sont encore au contrat mais D81 (17/10) a
    // cessé de les ÉCRIRE : ils valent null sur toute réservation récente, et
    // ce qui les remplace (`billingFloorKg`, `sizeMinKg`, `billableReason`)
    // n'est pas servi. On ne consomme donc pas de champ mort — la raison du
    // poids facturé reste hors de cette fiche, et c'est consigné comme axe.
  };
  parcel: {
    category: string;
    /** La famille D14 — c'est ELLE qui se lit (« Vêtements & textile ») ;
     *  `category` est une dérivation legacy (A29). */
    categoryFamily?: string | null;
    description: string;
    declaredValueCents: number;
    photoUrls: string[];
  };
  recipient: {
    firstName: string;
    lastName: string;
    phoneE164?: string | null;
  };
  pickupPlace?: ShipmentPlaceSnapshot | null;
  deliveryPlace?: ShipmentPlaceSnapshot | null;
  carrier: {
    id: string;
    firstName?: string | null;
    lastInitial: string;
    avatarUrl: string | null;
    publicSlug?: string | null;
  };

  /* ── Jalons (tous servis, jamais déduits) ─────────────────────────────── */
  requestedAt: string;
  /** `requestedAt + 24 h` — la fenêtre d'acceptation (DEA-01). */
  expiresAt: string;
  acceptedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  /** `deliveredAt + J+4` — fin de la période de vérification. */
  payoutDueAt?: string | null;
  completedAt?: string | null;
  /** SHIPPER = confirmation anticipée · SYSTEM = J+4 · ADMIN = médiation.
   *  Le texte de clôture en DÉPEND (ANO-WEB-04). */
  completedBy?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  /** Le motif du refus, quand le Voyageur a décliné la demande. */
  declineReason?: string | null;
  /** Le motif du refus AU RENDEZ-VOUS (B3/A40) — un colis non conforme. */
  pickupRefusalReason?: string | null;
  disputeTicket?: string | null;
  disputedAt?: string | null;
  /** PICKED_UP : quand « colis non livré » devient signalable (départ + 48 h). */
  disputeOpensAt?: string | null;
  deliveryPhotoUrls?: string[] | null;

  /* ── Argent ───────────────────────────────────────────────────────────── */
  /** Le DÉBIT réel : à l'acceptation, pas à la demande (capture manuelle, D39). */
  capturedAt?: string | null;
  refundedAt?: string | null;
  /** Ce qui a VRAIMENT été rendu — barème ANN-01, décision de médiation
   *  ou restitution. `null` quand rien n'a été remboursé. */
  refundAmountCents?: number | null;
  retentionCents?: number | null;
  retentionDecision?: ShipmentRetentionDecision | null;
  payoutStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'FROZEN' | null;
  cancellationPreview?: ShipmentCancellationPreview | null;

  dispute?: ShipmentDisputeFile | null;
  rating?: ShipmentRatingState | null;

  /** Le code à 6 chiffres — servi du pickup à la remise, à l'Expéditeur SEUL. */
  deliveryCode: string | null;
  codeRegenerationsLeft: number;
  pickup?: {
    confirmedAt: string;
    photoUrls: string[];
    notes?: string | null;
    /** Les points d'inspection cochés au rendez-vous (CNF-04), gelés. */
    checklist?: string[];
  } | null;
  trackingEvents: { step: ShipmentTrackingStep; confirmedAt: string }[];
  /** La machine d'état du serveur : les gestes possibles, et eux seuls. */
  allowedActions: string[];
};

type DealResponse = {
  success: boolean;
  viewerRole: 'SHIPPER' | 'CARRIER';
  deal: ShipperShipmentDto;
};

/**
 * Le suivi d'un envoi. Le `viewerRole` est servi par le serveur : s'il répond
 * `CARRIER`, c'est que le compte connecté est le Voyageur de ce deal — la
 * fiche Expéditeur n'a alors rien à montrer, et on le dit plutôt que de
 * lire des champs absents.
 */
export async function getShipment(shipmentId: string): Promise<ShipperShipmentDto> {
  // L'authentification est le défaut du client (`requireAuth !== false`).
  const res = await apiFetch<DealResponse>(`/deals/${shipmentId}`);
  if (res.viewerRole !== 'SHIPPER') throw new WrongViewerRoleError();
  return res.deal;
}

/** Le deal existe, mais pour l'autre face : il n'y a pas de suivi Expéditeur. */
export class WrongViewerRoleError extends Error {
  readonly code = 'WRONG_VIEWER_ROLE';
  constructor() {
    super('Not the shipper of this deal');
    this.name = 'WrongViewerRoleError';
  }
}

/* ══ Les gestes de l'Expéditeur ═══════════════════════════════════════════
   Quatre écritures, toutes gardées par la machine d'état du serveur. L'app
   ne les propose que si `allowedActions` les contient — mais elle ne s'y fie
   pas pour le résultat : entre la lecture et le clic, le deal a pu changer
   (le Voyageur accepte à la seconde où l'on annule). Un refus 409
   `TRANSITION_NOT_ALLOWED` est donc normal, pas un bug : on RELIT.
   ══════════════════════════════════════════════════════════════════════════ */

/** `POST /deals/:id/cancel` — ANN-01. Le MONTANT est décidé par le serveur
 *  à l'instant T : la préviz lue avant le clic n'était qu'informative. */
export type CancelResult = {
  bookingId: string;
  status: ShipmentServerStatus;
  /** Ce qui est rendu. `null` quand rien ne l'est. */
  refundAmountCents: number | null;
  currencyCode: string;
};

export async function cancelShipment(shipmentId: string): Promise<CancelResult> {
  return apiFetch<CancelResult>(`/deals/${shipmentId}/cancel`, { method: 'POST', body: {} });
}

/** `POST /deals/:id/code/regenerate` — plafond SERVEUR (5), colis en transit
 *  seulement. Le nouveau code est servi ici ; l'écran RELIT ensuite, pour que
 *  le code affiché vienne toujours de `GET /deals/:id` (A43). */
export type RegenerateCodeResult = {
  bookingId: string;
  deliveryCode: string;
  codeRegenerationsLeft: number;
};

export async function regenerateDeliveryCode(shipmentId: string): Promise<RegenerateCodeResult> {
  return apiFetch<RegenerateCodeResult>(`/deals/${shipmentId}/code/regenerate`, {
    method: 'POST',
    body: {},
  });
}

/** `POST /deals/:id/confirm` — confirmation anticipée. Le serveur clôt le deal
 *  PUIS tente le versement en ligne (A67). Geste DÉFINITIF (INV-3) : après
 *  lui, plus aucun signalement n'est possible. */
export type ConfirmDeliveryResult = {
  bookingId: string;
  completedAt: string;
  payoutStatus: 'SENT' | 'FAILED';
};

export async function confirmDelivery(shipmentId: string): Promise<ConfirmDeliveryResult> {
  // 2A : l'Expéditeur n'a JAMAIS à connaître l'échec d'un versement — c'est
  // une affaire entre Yamba et le Voyageur. Le champ est lu, jamais montré.
  return apiFetch<ConfirmDeliveryResult>(`/deals/${shipmentId}/confirm`, {
    method: 'POST',
    body: {},
  });
}
