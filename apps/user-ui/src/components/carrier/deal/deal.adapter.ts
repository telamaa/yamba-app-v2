/**
 * deal.adapter.ts — CarrierBookingView (API) → DealRequest (vue)
 * ===============================================================
 * Même rôle que shipments.adapter.ts côté Expéditeur : SEULE frontière
 * entre le contrat backend (deal-service, A13) et le view-model du
 * module. Fonction PURE — le reste du module ne voit jamais la forme
 * backend.
 *
 * Dégradations assumées (documentées, pas oubliées) :
 * - shipper.rating/shipmentCount/memberSince/isVerified : absents de
 *   BookingCounterpart (privacy) — l'UI les masque (B5 les ramènera) ;
 * - earnings : CarrierPricing = gains seulement (A13) — net = transportCents,
 *   jamais de commission ni de total Expéditeur ;
 * - trip.durationHours/isDirect : pas dans le snapshot — sous-titre sans eux ;
 * - recipient : exposé par l'API dès la création, mais l'UI ne le révèle
 *   qu'après pickup (philosophie É4) — l'adapter suit l'UI.
 */

import type {
  DealLocation,
  DealPhoto,
  DealRequest,
  DealStatus,
  DealTrackingEvent,
} from "./deal.types";

/* ── Forme backend (whitelist de LECTURE — seuls les champs lus) ──
   Même convention que shipments.adapter.ts : le tsconfig user-ui
   n'aliasant pas @packages/api-contracts, le miroir structurel local
   EST la frontière (toute divergence casse au premier appel réel). */

type PlaceSnapshotDto = {
  kind: "AIRPORT" | "TRAIN_STATION" | "CITY_AREA";
  details?: string | null;
} | null;

export type CarrierBookingViewDto = {
  id: string;
  tripId: string;
  status: DealStatus;
  trip: {
    originCity: string;
    destinationCity: string;
    departureAt: string;
  };
  pricing: {
    weightKg: number;
    transportCents: number;
  };
  parcel: {
    category: DealRequest["parcel"]["category"];
    description: string;
    declaredValueCents: number;
    photoUrls: string[];
  };
  recipient: {
    firstName: string;
    lastName: string;
    phoneE164: string;
  };
  pickupPlace?: PlaceSnapshotDto;
  deliveryPlace?: PlaceSnapshotDto;
  shipper: {
    id: string;
    firstName?: string | null;
    lastInitial: string;
    avatarUrl: string | null;
    publicSlug?: string | null;
  };
  requestedAt: string;
  expiresAt: string;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  pickup?: {
    confirmedAt: string;
    photoUrls: string[];
    notes?: string | null;
  } | null;
  trackingEvents: { step: DealTrackingEvent["id"]; confirmedAt: string }[];
  allowedActions: string[];
  deliveryAttemptsLeft?: number;
  deliveryLockedUntil?: string | null;
  // B4-PR3
  payoutDueAt?: string | null;
  deliveryPhotoUrls?: string[] | null;
  completedAt?: string | null;
  completedBy?: string | null;
  payoutStatus?: DealRequest["payoutStatus"] | null;
  payoutSentAt?: string | null;
  payoutBlocker?: DealRequest["payoutBlocker"] | null;
  disputeTicket?: string | null;
  disputedAt?: string | null;
  disputeCategory?: DealRequest["disputeCategory"] | null;
  payoutAmountCents?: number | null;
  retentionDisposition?: DealRequest["retentionDisposition"] | null;
  rating?: DealRequest["rating"];
  dispute?: DealRequest["dispute"] | null;
  retentionDecision?: DealRequest["retentionDecision"] | null;
};

/** J+4 : fenêtre de vérification avant versement (payoutDueAt = deliveredAt + 4j). */
export const PAYOUT_DELAY_DAYS = 4;

const PLACE_KIND_TO_LOCATION_TYPE: Record<string, DealLocation["type"]> = {
  AIRPORT: "AIRPORT",
  TRAIN_STATION: "STATION",
  CITY_AREA: "ADDRESS",
};

function toLocation(
  place: PlaceSnapshotDto | undefined,
  id: string,
  city: string
): DealLocation {
  return {
    id,
    type: place ? PLACE_KIND_TO_LOCATION_TYPE[place.kind] ?? "ADDRESS" : "ADDRESS",
    name: place?.details || city,
    detail: place?.details ?? undefined,
    city,
  };
}

function toDeclaredPhotos(urls: string[]): DealPhoto[] {
  return urls.map((url: string, i: number) => ({
    id: `declared-${i}`,
    url,
    context: "DECLARED_CONTENT" as const,
  }));
}

function toTrackingEvents(
  events: CarrierBookingViewDto["trackingEvents"]
): DealTrackingEvent[] {
  return events.map((e) => ({ id: e.step, at: e.confirmedAt }));
}

export function toDealRequest(view: CarrierBookingViewDto): DealRequest {
  const pickedUp = Boolean(view.pickedUpAt);

  return {
    id: view.id,
    status: view.status,
    allowedActions: view.allowedActions,
    createdAt: view.requestedAt,
    expiresAt: view.expiresAt,

    shipper: {
      id: view.shipper.id,
      firstName: view.shipper.firstName ?? "",
      lastInitial: view.shipper.lastInitial,
      avatarUrl: view.shipper.avatarUrl ?? undefined,
      publicSlug: view.shipper.publicSlug ?? undefined,
    },

    trip: {
      tripId: view.tripId,
      originCity: view.trip.originCity,
      destinationCity: view.trip.destinationCity,
      departureDate: view.trip.departureAt,
    },

    parcel: {
      category: view.parcel.category,
      weightKg: view.pricing.weightKg,
      declaredValueEur: view.parcel.declaredValueCents / 100,
      description: view.parcel.description,
      photos: toDeclaredPhotos(view.parcel.photoUrls),
    },

    pickupLocation: toLocation(view.pickupPlace, "pickup", view.trip.originCity),
    deliveryLocation: toLocation(
      view.deliveryPlace,
      "delivery",
      view.trip.destinationCity
    ),

    // CarrierPricing n'expose pas le tier de protection (A13 : la
    // couverture est un fait Expéditeur) — la card affiche la base.
    insurance: "BASIC",

    earnings: {
      netForCarrier: view.pricing.transportCents / 100,
      payoutDelayDays: PAYOUT_DELAY_DAYS,
    },

    pickup: view.pickup
      ? {
        pickedUpAt: view.pickup.confirmedAt,
        locationName: view.pickupPlace?.details || view.trip.originCity,
        photos: view.pickup.photoUrls.map((url: string, i: number) => ({
          id: `pickup-${i}`,
          url,
          context: "PICKUP_CONTENT" as const,
        })),
        notes: view.pickup.notes ?? undefined,
      }
      : undefined,

    recipient: pickedUp
      ? {
        firstName: view.recipient.firstName,
        lastName: view.recipient.lastName,
        city: view.trip.destinationCity,
        phone: view.recipient.phoneE164,
      }
      : undefined,

    trackingEvents: toTrackingEvents(view.trackingEvents),

    // A38 — le serveur compte les essais ; l'écran de saisie s'initialise ici.
    deliveryAttemptsLeft: view.deliveryAttemptsLeft,
    deliveryLockedUntil: view.deliveryLockedUntil ?? undefined,

    // B4-PR3 — après la remise : tout vient du serveur (A75/A76).
    deliveredAt: view.deliveredAt ?? undefined,
    payoutDueAt: view.payoutDueAt ?? undefined,
    deliveryPhotos: (view.deliveryPhotoUrls ?? []).map((url: string, i: number) => ({
      id: `delivery-${i}`,
      url,
      context: "PICKUP_OTHER" as const,
    })),
    completedAt: view.completedAt ?? undefined,
    completedBy: view.completedBy === "SHIPPER" || view.completedBy === "SYSTEM" ? view.completedBy : undefined,
    payoutStatus: view.payoutStatus ?? undefined,
    payoutSentAt: view.payoutSentAt ?? undefined,
    payoutBlocker: view.payoutBlocker ?? undefined,
    disputeTicket: view.disputeTicket ?? undefined,
    disputedAt: view.disputedAt ?? undefined,
    disputeCategory: view.disputeCategory ?? undefined,
    payoutAmountCents: view.payoutAmountCents ?? undefined,
    retentionDisposition: view.retentionDisposition ?? undefined,
    rating: view.rating ?? null,
    dispute: view.dispute ?? undefined,
    retentionDecision: view.retentionDecision ?? undefined,
  };
}
