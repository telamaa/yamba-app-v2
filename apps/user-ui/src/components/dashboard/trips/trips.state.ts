import type { CarrierTripItem } from "./trips.types";

/**
 * Mock — dates RELATIVES à Date.now() (démo stable à chaque reload).
 *
 * VITRINE DES CAS DE FIGURE (page /dashboard/trips/preview) :
 *  À traiter    : RESPOND (24h) · PICKUP (jour J) · DELIVER (atterri) · RATE
 *  Trip cards   : à venir (demande + accepté) · à venir sans deal ·
 *                 en vol (deal transit, aucune action) · atterri (remise + litige)
 *  Historique   : terminé (noté + non noté)
 *
 * Magic IDs carrier : abc123 (É2), picked123 (É5/É7, code 742891),
 * shipper123 (É10 rate). ⚠️ sonia456/pickup à vérifier côté mock carrier.
 */

const now = Date.now();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const mockCarrierTrips: CarrierTripItem[] = [
  /* ── À VENIR : jeudi, 1 demande (RESPOND) + 1 accepté (PICKUP) ── */
  {
    id: "trip_cdg_bzv_16",
    status: "PUBLISHED",
    originCity: "Paris",
    originDetail: "CDG",
    destinationCity: "Brazzaville",
    destinationDetail: "Maya-Maya",
    departureAt: new Date(now + 6 * DAY).toISOString(),
    durationHours: 8,
    isDirect: true,
    capacityKg: 12,
    remainingKg: 8,
    viewsCount: 34,
    publishedAt: new Date(now - 5 * DAY).toISOString(),
    deals: [
      {
        id: "abc123",
        status: "PENDING",
        shipper: { firstName: "Aminata", lastInitial: "T." },
        recipientFirstName: "Marie",
        category: "CLOTHES",
        weightKg: 2.5,
        netEarningsEur: 89.3,
        expiresAt: new Date(now + 3 * HOUR).toISOString(),
      },
      {
        id: "sonia456",
        status: "ACCEPTED",
        shipper: { firstName: "Sonia", lastInitial: "R." },
        recipientFirstName: "Clarisse",
        category: "COSMETICS",
        weightKg: 1.5,
        netEarningsEur: 89.3,
        pickupMeetingAt: new Date(now + 4 * HOUR).toISOString(),
        pickupLocationName: "CDG Terminal 2E",
      },
    ],
  },

  /* ── À VENIR : sans deal (empty state actionnable) ────────────── */
  {
    id: "trip_lys_dla_25",
    status: "PUBLISHED",
    originCity: "Lyon",
    destinationCity: "Douala",
    departureAt: new Date(now + 15 * DAY).toISOString(),
    durationHours: 11,
    isDirect: false,
    stopsCount: 1,
    capacityKg: 10,
    remainingKg: 10,
    viewsCount: 12,
    publishedAt: new Date(now - 1 * DAY).toISOString(),
    deals: [],
  },

  /* ── EN COURS : en vol (deal transit — aucune action possible) ── */
  {
    id: "trip_ory_abj_11",
    status: "DEPARTED",
    originCity: "Paris",
    originDetail: "Orly",
    destinationCity: "Abidjan",
    departureAt: new Date(now - 3 * HOUR).toISOString(),
    durationHours: 6,
    isDirect: true,
    capacityKg: 15,
    remainingKg: 11,
    viewsCount: 42,
    publishedAt: new Date(now - 9 * DAY).toISOString(),
    deals: [
      {
        id: "transit_fatou",
        status: "PICKED_UP",
        lastTrackingStep: "FLIGHT_DEPARTED",
        shipper: { firstName: "Fatou", lastInitial: "D." },
        recipientFirstName: "Aïcha",
        category: "GIFTS",
        weightKg: 3.2,
        netEarningsEur: 72.4,
      },
    ],
  },

  /* ── EN COURS : atterri — 1 remise (DELIVER) + 1 litige (gelé) ── */
  {
    id: "trip_cdg_bzv_08",
    status: "ARRIVED",
    originCity: "Paris",
    originDetail: "CDG",
    destinationCity: "Brazzaville",
    departureAt: new Date(now - 2 * DAY).toISOString(),
    arrivedAt: new Date(now - 10 * HOUR).toISOString(),
    durationHours: 8,
    isDirect: true,
    capacityKg: 12,
    remainingKg: 7.5,
    viewsCount: 51,
    publishedAt: new Date(now - 14 * DAY).toISOString(),
    deals: [
      {
        id: "picked123",
        status: "PICKED_UP",
        lastTrackingStep: "FLIGHT_ARRIVED",
        shipper: { firstName: "Aminata", lastInitial: "T." },
        recipientFirstName: "Marie",
        category: "CLOTHES",
        weightKg: 2.5,
        netEarningsEur: 89.3,
      },
      {
        id: "dispute_yannick",
        status: "DISPUTED",
        shipper: { firstName: "Yannick", lastInitial: "P." },
        recipientFirstName: "Blaise",
        category: "SHOES",
        weightKg: 2.0,
        netEarningsEur: 64.1,
        deliveredAt: new Date(now - 8 * HOUR).toISOString(),
      },
    ],
  },

  /* ── HISTORIQUE : terminé — 1 notation en attente (RATE) + 1 noté ── */
  {
    id: "trip_cdg_bzv_28juin",
    status: "COMPLETED",
    originCity: "Paris",
    destinationCity: "Brazzaville",
    departureAt: new Date(now - 12 * DAY).toISOString(),
    arrivedAt: new Date(now - 12 * DAY + 8 * HOUR).toISOString(),
    durationHours: 8,
    isDirect: true,
    capacityKg: 12,
    remainingKg: 7,
    viewsCount: 89,
    publishedAt: new Date(now - 25 * DAY).toISOString(),
    deals: [
      {
        id: "shipper123",
        status: "COMPLETED",
        shipper: { firstName: "Aminata", lastInitial: "T." },
        recipientFirstName: "Marie",
        category: "CLOTHES",
        weightKg: 2.5,
        netEarningsEur: 89.3,
        deliveredAt: new Date(now - 11 * DAY).toISOString(),
        hasRated: false,
      },
      {
        id: "done_josue",
        status: "COMPLETED",
        shipper: { firstName: "Josué", lastInitial: "M." },
        recipientFirstName: "Prisca",
        category: "GIFTS",
        weightKg: 1.9,
        netEarningsEur: 89.3,
        deliveredAt: new Date(now - 11 * DAY).toISOString(),
        hasRated: true,
      },
    ],
  },
];
