import { writeFileSync } from "node:fs";
import { join } from "node:path";
import prisma from "../index";

/**
 * seed-deals.ts — jeu de données Deal lifecycle (PR3, A14)
 * ========================================================
 * Emplacement : packages/libs/prisma/scripts/seed-deals.ts
 * Exécution   : DATABASE_URL requis dans l'environnement, puis
 *               npx tsx packages/libs/prisma/scripts/seed-deals.ts
 *
 * Couverture INTERNATIONALE (A14) — 6 corridors, 2 moteurs de pricing,
 * fuseaux variés (offsets négatifs et +7h) :
 *   1. Paris → Brazzaville   (colonne vertébrale : les 10 états, 2 trips)
 *   2. Paris → Montréal      (PER_KG, America/Toronto — alias Montréal déprécié)
 *   3. Lisbonne → São Paulo  (PER_KG)
 *   4. Londres → Lagos       (PER_CATEGORY)
 *   5. Paris → Hô Chi Minh-Ville (PER_KG, +7h)
 *   6. Bruxelles → Kinshasa  (PER_CATEGORY)
 *
 * Idempotence :
 *   - Users : upsert par emailNormalized (@unique) → ids STABLES.
 *   - Trips/Bookings : wipe & recreate (périmètre = users du seed) →
 *     ids NEUFS à chaque run, republiés dans seed-output.json.
 *
 * Invariant CAP-02 : reservedKg de chaque trip = Σ weightKg des
 * bookings ACTIFS (PENDING/ACCEPTED/PICKED_UP/DELIVERED/DISPUTED) —
 * CALCULÉ par le script, jamais posé à la main.
 *
 * B1 : deliveryCodeHash reste null (aucun endpoint ne le lit) — B3
 * seedera de vrais hashes bcrypt avec les codes documentés.
 *
 * Sortie : table console + seed-output.json (à côté du script,
 * gitignoré) — successeur des magic IDs du mock front (PR5).
 */

/* ══ Horloge de référence ═════════════════════════════════════ */

const NOW = new Date();
const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000);
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

/* ══ Users (upsert par emailNormalized) ═══════════════════════ */

type SeedUser = {
  key: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: ("SHIPPER" | "CARRIER")[];
  carrier?: boolean;
  phoneE164?: string;
};

const USERS: SeedUser[] = [
  // Carriers (un par corridor)
  { key: "thomas", firstName: "Thomas", lastName: "Nkounkou", email: "thomas.carrier@seed.yamba.dev", roles: ["SHIPPER", "CARRIER"], carrier: true, phoneE164: "+33612345601" },
  { key: "marc", firstName: "Marc", lastName: "Tremblay", email: "marc.carrier@seed.yamba.dev", roles: ["SHIPPER", "CARRIER"], carrier: true, phoneE164: "+33612345602" },
  { key: "ines", firstName: "Inês", lastName: "Ferreira", email: "ines.carrier@seed.yamba.dev", roles: ["SHIPPER", "CARRIER"], carrier: true, phoneE164: "+351912345603" },
  { key: "adebayo", firstName: "Adebayo", lastName: "Okonkwo", email: "adebayo.carrier@seed.yamba.dev", roles: ["SHIPPER", "CARRIER"], carrier: true, phoneE164: "+447712345604" },
  { key: "linh", firstName: "Linh", lastName: "Nguyễn", email: "linh.carrier@seed.yamba.dev", roles: ["SHIPPER", "CARRIER"], carrier: true, phoneE164: "+33612345605" },
  { key: "josephine", firstName: "Joséphine", lastName: "Ilunga", email: "josephine.carrier@seed.yamba.dev", roles: ["SHIPPER", "CARRIER"], carrier: true, phoneE164: "+32471234606" },
  // Shippers
  { key: "aminata", firstName: "Aminata", lastName: "Diallo", email: "aminata.shipper@seed.yamba.dev", roles: ["SHIPPER"], phoneE164: "+33612345611" },
  { key: "joao", firstName: "João", lastName: "Santos", email: "joao.shipper@seed.yamba.dev", roles: ["SHIPPER"], phoneE164: "+351912345612" },
  { key: "chinwe", firstName: "Chinwe", lastName: "Eze", email: "chinwe.shipper@seed.yamba.dev", roles: ["SHIPPER"], phoneE164: "+447712345613" },
  { key: "marieclaire", firstName: "Marie-Claire", lastName: "Bouchard", email: "marieclaire.shipper@seed.yamba.dev", roles: ["SHIPPER"], phoneE164: "+15141234614" },
  { key: "mai", firstName: "Mai", lastName: "Trần", email: "mai.shipper@seed.yamba.dev", roles: ["SHIPPER"], phoneE164: "+33612345615" },
  { key: "pauline", firstName: "Pauline", lastName: "Lemaire", email: "pauline.shipper@seed.yamba.dev", roles: ["SHIPPER"], phoneE164: "+32471234616" },
];

/* ══ Trips ════════════════════════════════════════════════════ */

type SeedTrip = {
  key: string;
  carrierKey: string;
  originCity: string;
  originCountryCode: string;
  originTimezone: string;
  destinationCity: string;
  destinationCountryCode: string;
  destinationTimezone: string;
  departureAt: Date;
  transportMode: "PLANE";
  capacityKg: number;
};

const TRIPS: SeedTrip[] = [
  // Colonne vertébrale — 2 trips (états "avant départ" vs "en cours/finis")
  { key: "bzv-upcoming", carrierKey: "thomas", originCity: "Paris", originCountryCode: "FR", originTimezone: "Europe/Paris", destinationCity: "Brazzaville", destinationCountryCode: "CG", destinationTimezone: "Africa/Brazzaville", departureAt: days(10), transportMode: "PLANE", capacityKg: 23 },
  { key: "bzv-inflight", carrierKey: "thomas", originCity: "Paris", originCountryCode: "FR", originTimezone: "Europe/Paris", destinationCity: "Brazzaville", destinationCountryCode: "CG", destinationTimezone: "Africa/Brazzaville", departureAt: days(-6), transportMode: "PLANE", capacityKg: 23 },
  { key: "yul", carrierKey: "marc", originCity: "Paris", originCountryCode: "FR", originTimezone: "Europe/Paris", destinationCity: "Montréal", destinationCountryCode: "CA", destinationTimezone: "America/Toronto", departureAt: days(3), transportMode: "PLANE", capacityKg: 20 },
  { key: "gru", carrierKey: "ines", originCity: "Lisbonne", originCountryCode: "PT", originTimezone: "Europe/Lisbon", destinationCity: "São Paulo", destinationCountryCode: "BR", destinationTimezone: "America/Sao_Paulo", departureAt: days(5), transportMode: "PLANE", capacityKg: 18 },
  { key: "los", carrierKey: "adebayo", originCity: "Londres", originCountryCode: "GB", originTimezone: "Europe/London", destinationCity: "Lagos", destinationCountryCode: "NG", destinationTimezone: "Africa/Lagos", departureAt: days(-2), transportMode: "PLANE", capacityKg: 23 },
  { key: "sgn", carrierKey: "linh", originCity: "Paris", originCountryCode: "FR", originTimezone: "Europe/Paris", destinationCity: "Hô Chi Minh-Ville", destinationCountryCode: "VN", destinationTimezone: "Asia/Ho_Chi_Minh", departureAt: days(-1), transportMode: "PLANE", capacityKg: 15 },
  { key: "fih", carrierKey: "josephine", originCity: "Bruxelles", originCountryCode: "BE", originTimezone: "Europe/Brussels", destinationCity: "Kinshasa", destinationCountryCode: "CD", destinationTimezone: "Africa/Kinshasa", departureAt: days(7), transportMode: "PLANE", capacityKg: 23 },
];

/* ══ Pricing helpers (centimes entiers — A2, commission 15 %) ═ */

function perCategory(categoryPriceCents: number) {
  const transportCents = categoryPriceCents;
  const commissionCents = Math.max(200, Math.round(transportCents * 0.15)); // plancher D16
  return {
    pricingModel: "PER_CATEGORY" as const,
    categoryPriceCents,
    pricePerKgCents: null,
    sizeClass: null,
    transportCents,
    commissionPct: 0.15,
    commissionCents,
    protectionProvider: null,
    protectionTier: null,
    premiumCents: 0,
    totalShipperCents: transportCents + commissionCents,
    currencyCode: "EUR",
  };
}

function perKg(pricePerKgCents: number, weightKg: number, sizeClass: "S" | "M" | "L") {
  const transportCents = Math.round(pricePerKgCents * weightKg);
  const commissionCents = Math.max(200, Math.round(transportCents * 0.15));
  return {
    pricingModel: "PER_KG" as const,
    categoryPriceCents: null,
    pricePerKgCents,
    sizeClass,
    transportCents,
    commissionPct: 0.15,
    commissionCents,
    protectionProvider: null,
    protectionTier: null,
    premiumCents: 0,
    totalShipperCents: transportCents + commissionCents,
    currencyCode: "EUR",
  };
}

/* ══ Bookings (20 — chaque état ≥ 1, corridor 1 = les 10) ═════ */

const ACTIVE = ["PENDING", "ACCEPTED", "PICKED_UP", "DELIVERED", "DISPUTED"];

type SeedBooking = {
  key: string; // successeur des magic IDs (abc123, picked123, …)
  tripKey: string;
  shipperKey: string;
  status: string;
  weightKg: number;
  category: string;
  description: string;
  declaredValueCents: number;
  pricing: ReturnType<typeof perCategory> | ReturnType<typeof perKg>;
  recipient: { firstName: string; lastName: string; phoneE164: string; email: string };
  milestones: Record<string, Date | string | null>;
  pickup?: { confirmedAt: Date; photoUrls: string[]; notes: string | null };
  trackingEvents?: { step: string; confirmedAt: Date }[];
};

const RCP_BZV = { firstName: "Clarisse", lastName: "Mabiala", phoneE164: "+242061234567", email: "clarisse@seed.yamba.dev" };
const RCP_YUL = { firstName: "Étienne", lastName: "Roy", phoneE164: "+15145551234", email: "etienne@seed.yamba.dev" };
const RCP_GRU = { firstName: "Beatriz", lastName: "Almeida", phoneE164: "+5511987654321", email: "beatriz@seed.yamba.dev" };
const RCP_LOS = { firstName: "Ngozi", lastName: "Balogun", phoneE164: "+2348012345678", email: "ngozi@seed.yamba.dev" };
const RCP_SGN = { firstName: "Đức", lastName: "Phạm", phoneE164: "+84901234567", email: "duc@seed.yamba.dev" };
const RCP_FIH = { firstName: "Patrice", lastName: "Kabongo", phoneE164: "+243812345678", email: "patrice@seed.yamba.dev" };

const BOOKINGS: SeedBooking[] = [
  /* ── Corridor 1 · trip à venir (états pré-départ) ─────────── */
  { key: "bzv-pending", tripKey: "bzv-upcoming", shipperKey: "aminata", status: "PENDING", weightKg: 3, category: "DOCUMENTS", description: "Dossier administratif famille", declaredValueCents: 5000, pricing: perCategory(2500), recipient: RCP_BZV,
    milestones: { requestedAt: hours(-2), expiresAt: hours(22) } },
  { key: "bzv-accepted", tripKey: "bzv-upcoming", shipperKey: "pauline", status: "ACCEPTED", weightKg: 5, category: "CLOTHES", description: "Vêtements enfants", declaredValueCents: 12000, pricing: perCategory(3500), recipient: RCP_BZV,
    milestones: { requestedAt: days(-2), expiresAt: days(-1), acceptedAt: hours(-30) } },
  { key: "bzv-cancelled", tripKey: "bzv-upcoming", shipperKey: "aminata", status: "CANCELLED", weightKg: 4, category: "SHOES", description: "Chaussures de sport", declaredValueCents: 9000, pricing: perCategory(3000), recipient: RCP_BZV,
    milestones: { requestedAt: days(-3), expiresAt: days(-2), acceptedAt: days(-2), closedAt: days(-1), closedBy: "SHIPPER" } },
  { key: "bzv-declined", tripKey: "bzv-upcoming", shipperKey: "joao", status: "DECLINED", weightKg: 8, category: "OTHER_ELECTRONICS", description: "Petit électroménager", declaredValueCents: 25000, pricing: perCategory(6000), recipient: RCP_BZV,
    milestones: { requestedAt: days(-2), expiresAt: days(-1), closedAt: hours(-40), closedBy: "CARRIER", declineReason: "capacity_full" } },
  { key: "bzv-expired", tripKey: "bzv-upcoming", shipperKey: "chinwe", status: "EXPIRED", weightKg: 2, category: "BOOKS", description: "Livres scolaires", declaredValueCents: 4000, pricing: perCategory(2000), recipient: RCP_BZV,
    milestones: { requestedAt: hours(-30), expiresAt: hours(-6), closedAt: hours(-6), closedBy: "SYSTEM" } },

  /* ── Corridor 1 · trip parti (états en cours / terminaux) ─── */
  { key: "bzv-picked", tripKey: "bzv-inflight", shipperKey: "aminata", status: "PICKED_UP", weightKg: 6, category: "PHONE", description: "Téléphone + accessoires", declaredValueCents: 45000, pricing: perCategory(4000), recipient: RCP_BZV,
    milestones: { requestedAt: days(-9), expiresAt: days(-8), acceptedAt: days(-8), pickedUpAt: days(-6) },
    pickup: { confirmedAt: days(-6), photoUrls: ["https://r2.seed.yamba.dev/bzv-picked-1.jpg"], notes: "Remis au T2E, comptoir 4" } },
  { key: "bzv-tracking", tripKey: "bzv-inflight", shipperKey: "pauline", status: "PICKED_UP", weightKg: 4, category: "FASHION_ACCESSORIES", description: "Sacs et foulards", declaredValueCents: 15000, pricing: perCategory(3200), recipient: RCP_BZV,
    milestones: { requestedAt: days(-9), expiresAt: days(-8), acceptedAt: days(-8), pickedUpAt: days(-6) },
    pickup: { confirmedAt: days(-6), photoUrls: ["https://r2.seed.yamba.dev/bzv-tracking-1.jpg"], notes: null },
    trackingEvents: [
      { step: "AT_AIRPORT", confirmedAt: days(-6) },
      { step: "FLIGHT_DEPARTED", confirmedAt: hours(-6 * 24 + 3) },
      { step: "FLIGHT_ARRIVED", confirmedAt: days(-5) },
    ] },
  { key: "bzv-delivered", tripKey: "bzv-inflight", shipperKey: "joao", status: "DELIVERED", weightKg: 5, category: "COMPUTER", description: "Ordinateur portable", declaredValueCents: 80000, pricing: perCategory(5500), recipient: RCP_BZV,
    milestones: { requestedAt: days(-9), expiresAt: days(-8), acceptedAt: days(-8), pickedUpAt: days(-6), deliveredAt: days(-1), payoutDueAt: days(3) },
    pickup: { confirmedAt: days(-6), photoUrls: ["https://r2.seed.yamba.dev/bzv-delivered-1.jpg"], notes: null } },
  { key: "bzv-disputed", tripKey: "bzv-inflight", shipperKey: "chinwe", status: "DISPUTED", weightKg: 3, category: "SMALL_TOYS", description: "Jouets anniversaire", declaredValueCents: 8000, pricing: perCategory(2800), recipient: RCP_BZV,
    milestones: { requestedAt: days(-9), expiresAt: days(-8), acceptedAt: days(-8), pickedUpAt: days(-6), deliveredAt: days(-2), payoutDueAt: days(2), disputeTicket: "YAM-2041", disputedAt: days(-1) },
    pickup: { confirmedAt: days(-6), photoUrls: ["https://r2.seed.yamba.dev/bzv-disputed-1.jpg"], notes: null } },
  { key: "bzv-completed", tripKey: "bzv-inflight", shipperKey: "mai", status: "COMPLETED", weightKg: 4, category: "CLOTHES", description: "Pagnes et tissus", declaredValueCents: 20000, pricing: perCategory(3500), recipient: RCP_BZV,
    milestones: { requestedAt: days(-12), expiresAt: days(-11), acceptedAt: days(-11), pickedUpAt: days(-6), deliveredAt: days(-6), payoutDueAt: days(-2), completedAt: days(-2) },
    pickup: { confirmedAt: days(-6), photoUrls: ["https://r2.seed.yamba.dev/bzv-completed-1.jpg"], notes: null } },

  /* ── Paris → Montréal (PER_KG) ────────────────────────────── */
  { key: "yul-accepted", tripKey: "yul", shipperKey: "marieclaire", status: "ACCEPTED", weightKg: 7, category: "CLOTHES", description: "Manteaux d'hiver", declaredValueCents: 30000, pricing: perKg(600, 7, "M"), recipient: RCP_YUL,
    milestones: { requestedAt: days(-1), expiresAt: hours(0.5 * 24), acceptedAt: hours(-10) } },
  { key: "yul-delivered", tripKey: "yul", shipperKey: "aminata", status: "DELIVERED", weightKg: 3, category: "BOOKS", description: "Bandes dessinées", declaredValueCents: 6000, pricing: perKg(600, 3, "S"), recipient: RCP_YUL,
    milestones: { requestedAt: days(-8), expiresAt: days(-7), acceptedAt: days(-7), pickedUpAt: days(-4), deliveredAt: hours(-12), payoutDueAt: days(3.5) },
    pickup: { confirmedAt: days(-4), photoUrls: ["https://r2.seed.yamba.dev/yul-delivered-1.jpg"], notes: null } },

  /* ── Lisbonne → São Paulo (PER_KG) ────────────────────────── */
  { key: "gru-pending", tripKey: "gru", shipperKey: "joao", status: "PENDING", weightKg: 5, category: "FASHION_ACCESSORIES", description: "Acessórios de moda", declaredValueCents: 18000, pricing: perKg(550, 5, "M"), recipient: RCP_GRU,
    milestones: { requestedAt: hours(-5), expiresAt: hours(19) } },
  { key: "gru-completed", tripKey: "gru", shipperKey: "ines", status: "COMPLETED", weightKg: 6, category: "DOCUMENTS", description: "Documentos notariais", declaredValueCents: 3000, pricing: perKg(550, 6, "M"), recipient: RCP_GRU,
    milestones: { requestedAt: days(-15), expiresAt: days(-14), acceptedAt: days(-14), pickedUpAt: days(-10), deliveredAt: days(-9), payoutDueAt: days(-5), completedAt: days(-6) },
    pickup: { confirmedAt: days(-10), photoUrls: ["https://r2.seed.yamba.dev/gru-completed-1.jpg"], notes: null } },

  /* ── Londres → Lagos (PER_CATEGORY) ───────────────────────── */
  { key: "los-picked", tripKey: "los", shipperKey: "chinwe", status: "PICKED_UP", weightKg: 8, category: "OTHER_ELECTRONICS", description: "Console + jeux", declaredValueCents: 55000, pricing: perCategory(5000), recipient: RCP_LOS,
    milestones: { requestedAt: days(-5), expiresAt: days(-4), acceptedAt: days(-4), pickedUpAt: days(-2) },
    pickup: { confirmedAt: days(-2), photoUrls: ["https://r2.seed.yamba.dev/los-picked-1.jpg"], notes: "Heathrow T5" },
    trackingEvents: [
      { step: "AT_AIRPORT", confirmedAt: days(-2) },
      { step: "FLIGHT_DEPARTED", confirmedAt: hours(-2 * 24 + 4) },
    ] },
  { key: "los-disputed", tripKey: "los", shipperKey: "mai", status: "DISPUTED", weightKg: 2, category: "PHONE", description: "Smartphone neuf", declaredValueCents: 60000, pricing: perCategory(4000), recipient: RCP_LOS,
    milestones: { requestedAt: days(-6), expiresAt: days(-5), acceptedAt: days(-5), pickedUpAt: days(-2), deliveredAt: days(-1), payoutDueAt: days(3), disputeTicket: "YAM-2042", disputedAt: hours(-8) },
    pickup: { confirmedAt: days(-2), photoUrls: ["https://r2.seed.yamba.dev/los-disputed-1.jpg"], notes: null } },

  /* ── Paris → Hô Chi Minh-Ville (PER_KG, +7h) ──────────────── */
  { key: "sgn-picked", tripKey: "sgn", shipperKey: "mai", status: "PICKED_UP", weightKg: 4, category: "BOOKS", description: "Sách tiếng Việt", declaredValueCents: 5000, pricing: perKg(700, 4, "S"), recipient: RCP_SGN,
    milestones: { requestedAt: days(-4), expiresAt: days(-3), acceptedAt: days(-3), pickedUpAt: days(-1) },
    pickup: { confirmedAt: days(-1), photoUrls: ["https://r2.seed.yamba.dev/sgn-picked-1.jpg"], notes: null },
    trackingEvents: [{ step: "AT_AIRPORT", confirmedAt: days(-1) }] },
  { key: "sgn-expired", tripKey: "sgn", shipperKey: "pauline", status: "EXPIRED", weightKg: 3, category: "CLOTHES", description: "Áo dài sur mesure", declaredValueCents: 15000, pricing: perKg(700, 3, "S"), recipient: RCP_SGN,
    milestones: { requestedAt: days(-3), expiresAt: days(-2), closedAt: days(-2), closedBy: "SYSTEM" } },

  /* ── Bruxelles → Kinshasa (PER_CATEGORY) ──────────────────── */
  { key: "fih-declined", tripKey: "fih", shipperKey: "pauline", status: "DECLINED", weightKg: 10, category: "CHECKED_BAG_23KG", description: "Valise complète", declaredValueCents: 40000, pricing: perCategory(9000), recipient: RCP_FIH,
    milestones: { requestedAt: days(-2), expiresAt: days(-1), closedAt: hours(-30), closedBy: "CARRIER", declineReason: "category_mismatch" } },
  { key: "fih-cancelled", tripKey: "fih", shipperKey: "marieclaire", status: "CANCELLED", weightKg: 3, category: "DOCUMENTS", description: "Actes de naissance", declaredValueCents: 2000, pricing: perCategory(2500), recipient: RCP_FIH,
    milestones: { requestedAt: days(-4), expiresAt: days(-3), closedAt: days(-3), closedBy: "SHIPPER" } },
];

/* ══ Exécution ════════════════════════════════════════════════ */

async function main() {
  console.log("🌱 Seed Deal lifecycle — 6 corridors internationaux\n");

  // 1. Users — upsert (ids stables entre les runs)
  const userIds = new Map<string, string>();
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { emailNormalized: u.email.toLowerCase() },
      update: { firstName: u.firstName, lastName: u.lastName, roles: u.roles },
      create: {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        emailNormalized: u.email.toLowerCase(),
        publicSlug: `seed-${u.key}`, // String? @unique — 2 nulls collisionnent sur l'index Mongo
        phoneE164: u.phoneE164 ?? null,
        roles: u.roles,
        carrierStatus: u.carrier ? "ACTIVE" : "NONE",
      },
    });
    userIds.set(u.key, user.id);
  }
  console.log(`✓ ${USERS.length} users (upsert par emailNormalized)`);

  const seedIds = [...userIds.values()];

  // 2. Wipe du périmètre seed (idempotence trips/bookings)
  const delB = await prisma.booking.deleteMany({
    where: { OR: [{ shipperId: { in: seedIds } }, { carrierId: { in: seedIds } }] },
  });
  const delT = await prisma.trip.deleteMany({ where: { userId: { in: seedIds } } });
  console.log(`✓ wipe : ${delB.count} bookings, ${delT.count} trips (périmètre seed)`);

  // 3. Trips — reservedKg = Σ poids des bookings ACTIFS (CAP-02, calculé)
  const tripIds = new Map<string, string>();
  for (const t of TRIPS) {
    const reservedKg = BOOKINGS
      .filter((b) => b.tripKey === t.key && ACTIVE.includes(b.status))
      .reduce((sum, b) => sum + b.weightKg, 0);

    const trip = await prisma.trip.create({
      data: {
        userId: userIds.get(t.carrierKey)!,
        status: "PUBLISHED",
        transportMode: t.transportMode,
        originCity: t.originCity,
        originCountryCode: t.originCountryCode,
        originTimezone: t.originTimezone,
        originLabel: `${t.originCity} (${t.originCountryCode})`,
        destinationCity: t.destinationCity,
        destinationCountryCode: t.destinationCountryCode,
        destinationTimezone: t.destinationTimezone,
        destinationLabel: `${t.destinationCity} (${t.destinationCountryCode})`,
        departureAt: t.departureAt,
        capacityKg: t.capacityKg,
        reservedKg,
        publishedAt: days(-16),
      },
    });
    tripIds.set(t.key, trip.id);
    console.log(`  · trip ${t.key} → ${trip.id} (reservedKg=${reservedKg}/${t.capacityKg})`);
  }

  // 4. Bookings
  const output: {
    key: string; id: string; status: string; corridor: string;
    shipper: string; carrier: string;
  }[] = [];

  for (const b of BOOKINGS) {
    const t = TRIPS.find((x) => x.key === b.tripKey)!;
    const booking = await prisma.booking.create({
      data: {
        tripId: tripIds.get(b.tripKey)!,
        shipperId: userIds.get(b.shipperKey)!,
        carrierId: userIds.get(t.carrierKey)!,
        status: b.status as never,
        trip: {
          originCity: t.originCity,
          originCountryCode: t.originCountryCode,
          originTimezone: t.originTimezone,
          destinationCity: t.destinationCity,
          destinationCountryCode: t.destinationCountryCode,
          destinationTimezone: t.destinationTimezone,
          departureAt: t.departureAt,
          transportMode: t.transportMode,
        },
        pricing: { ...b.pricing, weightKg: b.weightKg },
        parcel: {
          category: b.category as never,
          categoryFamily: null,
          description: b.description,
          declaredValueCents: b.declaredValueCents,
          photoUrls: [`https://r2.seed.yamba.dev/${b.key}-declared.jpg`],
        },
        recipient: b.recipient,
        pickup: b.pickup ?? undefined,
        trackingEvents: b.trackingEvents ?? [],
        ...b.milestones,
      } as never,
    });
    output.push({
      key: b.key,
      id: booking.id,
      status: b.status,
      corridor: `${t.originCity} → ${t.destinationCity}`,
      shipper: USERS.find((u) => u.key === b.shipperKey)!.email,
      carrier: USERS.find((u) => u.key === t.carrierKey)!.email,
    });
  }
  console.log(`✓ ${BOOKINGS.length} bookings\n`);

  // 5. Sortie — table console + seed-output.json (successeur des magic IDs)
  console.table(output.map(({ key, status, corridor, id }) => ({ key, status, corridor, id })));

  const outPath = join(__dirname, "seed-output.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        generatedAt: NOW.toISOString(),
        note: "Ids régénérés à chaque run (wipe & recreate). Users stables (upsert).",
        users: Object.fromEntries(userIds),
        trips: Object.fromEntries(tripIds),
        bookings: output,
      },
      null,
      2
    )
  );
  console.log(`\n📄 ${outPath}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
