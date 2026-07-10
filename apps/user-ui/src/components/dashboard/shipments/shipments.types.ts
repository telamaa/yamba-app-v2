import type { ParcelCategory } from "@/components/booking/booking.types";

/**
 * Statuts d'un envoi vus côté Expéditeur (liste).
 * Miroir de DealStatus + états terminaux backend (COMPLETED, DISPUTED).
 */
export type ShipmentStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PICKED_UP"
  | "DELIVERED"
  | "COMPLETED"
  | "DISPUTED"
  | "EXPIRED"
  | "DECLINED"
  | "CANCELLED";

export type ShipmentTrackingStep =
  | "AT_AIRPORT"
  | "FLIGHT_DEPARTED"
  | "FLIGHT_ARRIVED";

/**
 * DTO léger de liste — ce que renverra `GET /me/bookings`.
 * Les échéances (expiresAt, payoutAt, arrivalEtaAt) sont pré-calculées
 * côté serveur : le front ne fait que les afficher / décompter.
 */
export type ShipmentListItem = {
  id: string;
  status: ShipmentStatus;

  originCity: string;
  destinationCity: string;

  category: ParcelCategory;
  weightKg: number;

  carrier: {
    firstName: string;
    lastInitial: string;
  };
  recipientFirstName?: string;

  /** Jalons (ISO) — présents selon le statut */
  requestedAt?: string;
  acceptedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  completedAt?: string;

  /** Échéances pré-calculées (ISO) */
  expiresAt?: string; // PENDING : fin de la fenêtre 24h
  payoutAt?: string; // DELIVERED : versement auto J+4
  arrivalEtaAt?: string; // PICKED_UP transit : atterrissage estimé

  /** Contexte pickup (ACCEPTED) */
  pickupMeetingAt?: string;
  pickupLocationName?: string;

  /** PICKED_UP : false = code à transmettre, true = transit (timeline miroir) */
  hasTrackingEvents?: boolean;
  lastTrackingStep?: ShipmentTrackingStep;

  /** COMPLETED */
  hasRated?: boolean;
  ratedStars?: number;

  /** DISPUTED */
  disputeTicket?: string;

  /** EXPIRED / DECLINED / CANCELLED */
  refunded?: boolean;
};

/* ─────────────────────────── Présentation ─────────────────────────── */

export type ShipmentGroup = "action" | "ongoing" | "done";
export type ShipmentBadgeTone = "slate" | "teal" | "amber" | "emerald" | "red";
export type ShipmentCtaKind = "primary" | "outlineAmber" | "ghost";

export type ShipmentPresentation = {
  group: ShipmentGroup;
  badgeTone: ShipmentBadgeTone;
  /** Liseré amber à gauche de la row (urgence) */
  urgent: boolean;
  /** Row historique (opacité réduite, vignette neutre) */
  muted: boolean;
  /** Cible du clic row ET du CTA (URL stable, le statut pilote la vue) */
  href: string;
  ctaKind: ShipmentCtaKind;
};

/**
 * Encode la machine d'état → présentation de liste.
 * Chaque statut a exactement UNE "prochaine action" (spec fonctionnelle §2).
 */
export function getShipmentPresentation(
  item: ShipmentListItem
): ShipmentPresentation {
  switch (item.status) {
    case "PICKED_UP":
      if (item.hasTrackingEvents) {
        return {
          group: "ongoing",
          badgeTone: "teal",
          urgent: false,
          muted: false,
          href: "/bookings/" + item.id,
          ctaKind: "ghost",
        };
      }
      return {
        group: "action",
        badgeTone: "amber",
        urgent: true,
        muted: false,
        href: "/bookings/" + item.id,
        ctaKind: "primary",
      };

    case "DELIVERED":
      return {
        group: "action",
        badgeTone: "amber",
        urgent: true,
        muted: false,
        href: "/bookings/" + item.id,
        ctaKind: "primary",
      };

    case "COMPLETED":
      if (item.hasRated) {
        return {
          group: "done",
          badgeTone: "emerald",
          urgent: false,
          muted: true,
          href: "/bookings/" + item.id,
          ctaKind: "ghost",
        };
      }
      return {
        group: "action",
        badgeTone: "emerald",
        urgent: false,
        muted: false,
        href: "/bookings/" + item.id + "/rate",
        ctaKind: "outlineAmber",
      };

    case "ACCEPTED":
      return {
        group: "ongoing",
        badgeTone: "teal",
        urgent: false,
        muted: false,
        href: "/bookings/" + item.id,
        ctaKind: "ghost",
      };

    case "DISPUTED":
      return {
        group: "ongoing",
        badgeTone: "red",
        urgent: false,
        muted: false,
        href: "/bookings/" + item.id,
        ctaKind: "ghost",
      };

    case "PENDING":
      return {
        group: "ongoing",
        badgeTone: "slate",
        urgent: false,
        muted: false,
        href: "/bookings/" + item.id,
        ctaKind: "ghost",
      };

    case "EXPIRED":
    case "DECLINED":
    case "CANCELLED":
      return {
        group: "done",
        badgeTone: "slate",
        urgent: false,
        muted: true,
        href: "/bookings/" + item.id,
        ctaKind: "ghost",
      };
  }
}

/* ─────────────────────────── Helpers temps ─────────────────────────── */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * "2 j 14 h" / "21 h" / "45 min" — décompte lisible pour les badges.
 * Retourne null si l'échéance est passée.
 */
export function formatRemaining(
  targetIso: string,
  nowMs: number,
  locale: string
): string | null {
  const diff = new Date(targetIso).getTime() - nowMs;
  if (diff <= 0) return null;

  const days = Math.floor(diff / DAY_MS);
  const hours = Math.floor((diff % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((diff % HOUR_MS) / 60_000);

  const d = locale === "fr" ? "j" : "d";
  const h = "h";

  if (days > 0) return days + " " + d + " " + hours + " " + h;
  if (hours > 0) return hours + " " + h;
  return minutes + " min";
}
