import type { ShipmentListItem } from "./shipments.types";

/**
 * Jeu de données mock — dates RELATIVES à Date.now() pour un état
 * de démo stable à chaque reload (convention projet).
 *
 * Les IDs réutilisent les "magic IDs" du booking-tracker : chaque row
 * pointe vers une vue déjà implémentée → la démo E2E devient cliquable.
 */

const now = Date.now();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const mockShipments: ShipmentListItem[] = [
  /* ── À TRAITER ────────────────────────────────────────────────── */

  // Code à transmettre (É4b)
  {
    id: "picked123",
    status: "PICKED_UP",
    hasTrackingEvents: false,
    originCity: "Paris",
    destinationCity: "Brazzaville",
    category: "CLOTHES",
    weightKg: 2.5,
    carrier: { firstName: "Thomas", lastInitial: "M." },
    recipientFirstName: "Marie",
    pickedUpAt: new Date(now - 2 * HOUR).toISOString(),
  },

  // Période de vérification (É8) — versement auto dans ~2j14h
  {
    id: "delivered123",
    status: "DELIVERED",
    originCity: "Paris",
    destinationCity: "Brazzaville",
    category: "CLOTHES",
    weightKg: 2.5,
    carrier: { firstName: "Thomas", lastInitial: "M." },
    recipientFirstName: "Marie",
    deliveredAt: new Date(now - (1 * DAY + 10 * HOUR)).toISOString(),
    payoutAt: new Date(now + (2 * DAY + 14 * HOUR)).toISOString(),
  },

  // Terminé non noté → notation (É10)
  {
    id: "rate456",
    status: "COMPLETED",
    hasRated: false,
    originCity: "Paris",
    destinationCity: "Pointe-Noire",
    category: "COSMETICS",
    weightKg: 1.8,
    carrier: { firstName: "Léa", lastInitial: "K." },
    recipientFirstName: "Grâce",
    deliveredAt: new Date(now - 3 * DAY).toISOString(),
    completedAt: new Date(now - 2 * DAY).toISOString(),
  },

  /* ── EN COURS ─────────────────────────────────────────────────── */

  // En attente de réponse (fenêtre 24h)
  {
    id: "pending789",
    status: "PENDING",
    originCity: "Lyon",
    destinationCity: "Douala",
    category: "DOCUMENTS",
    weightKg: 0.4,
    carrier: { firstName: "Karim", lastInitial: "A." },
    requestedAt: new Date(now - 3 * HOUR).toISOString(),
    expiresAt: new Date(now + 21 * HOUR).toISOString(),
  },

  // Accepté — préparation du colis (É3b)
  {
    id: "abc123",
    status: "ACCEPTED",
    originCity: "Paris",
    destinationCity: "Brazzaville",
    category: "ELECTRONICS_SMALL",
    weightKg: 3.1,
    carrier: { firstName: "Thomas", lastInitial: "M." },
    recipientFirstName: "Marie",
    acceptedAt: new Date(now - 5 * HOUR).toISOString(),
    pickupMeetingAt: new Date(now + 2 * DAY).toISOString(),
    pickupLocationName: "CDG Terminal 2E",
  },

  // En transit — vol en cours (É6)
  {
    id: "transit123",
    status: "PICKED_UP",
    hasTrackingEvents: true,
    lastTrackingStep: "FLIGHT_DEPARTED",
    originCity: "Paris",
    destinationCity: "Brazzaville",
    category: "CLOTHES",
    weightKg: 2.5,
    carrier: { firstName: "Thomas", lastInitial: "M." },
    recipientFirstName: "Marie",
    pickedUpAt: new Date(now - 6 * HOUR).toISOString(),
    arrivalEtaAt: new Date(now + 5 * HOUR).toISOString(),
  },

  // Litige en examen
  {
    id: "dispute321",
    status: "DISPUTED",
    originCity: "Marseille",
    destinationCity: "Abidjan",
    category: "SHOES",
    weightKg: 2.0,
    carrier: { firstName: "David", lastInitial: "B." },
    recipientFirstName: "Awa",
    deliveredAt: new Date(now - 4 * DAY).toISOString(),
    disputeTicket: "YAM-4821",
  },

  /* ── HISTORIQUE ───────────────────────────────────────────────── */

  // Terminé et noté
  {
    id: "done001",
    status: "COMPLETED",
    hasRated: true,
    ratedStars: 5,
    originCity: "Paris",
    destinationCity: "Brazzaville",
    category: "CLOTHES",
    weightKg: 2.2,
    carrier: { firstName: "Thomas", lastInitial: "M." },
    recipientFirstName: "Marie",
    deliveredAt: new Date(now - 12 * DAY).toISOString(),
    completedAt: new Date(now - 8 * DAY).toISOString(),
  },

  // Expirée sans réponse — remboursée
  {
    id: "exp001",
    status: "EXPIRED",
    refunded: true,
    originCity: "Paris",
    destinationCity: "Kinshasa",
    category: "GIFTS",
    weightKg: 1.2,
    carrier: { firstName: "Jules", lastInitial: "N." },
    requestedAt: new Date(now - 27 * DAY).toISOString(),
    expiresAt: new Date(now - 26 * DAY).toISOString(),
  },
];
