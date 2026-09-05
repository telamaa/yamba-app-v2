import { writeFileSync } from "node:fs";
import { join } from "node:path";
import prisma from "../index";
import bcrypt from "bcryptjs";
import {
  encryptDeliveryCode,
  hashDeliveryCode,
} from "../../delivery-code/src/index";

/**
 * Mot de passe DEV commun aux 12 users du seed (PR5) : Yamba-Dev-2026!
 * Secret de dev ASSUME (le seed ne tourne jamais en prod) — permet le
 * login front avec n'importe quel user de seed-output.json.
 * Hash calcule UNE fois par run (bcryptjs, meme lib que loginUser).
 */
const SEED_PASSWORD_HASH = bcrypt.hashSync("Yamba-Dev-2026!", 10);

/** Code de livraison DEV commun aux bookings seedés passés par le pickup (D43). */
export const SEED_DELIVERY_CODE = "742891";
const SEED_CHECKLIST = ["CONTENT_MATCHES", "WEIGHT_OK", "NO_FORBIDDEN", "PACKAGING_OK", "ITEMS_IDENTIFIED"];

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
 * B3 (D43) : tout booking passé par le pickup (PICKED_UP, DELIVERED,
 * DISPUTED, COMPLETED) porte un VRAI code — SEED_DELIVERY_CODE ci-dessous,
 * haché (bcrypt) ET chiffré (AES, clé d'env ou clé de dev) — et une
 * checklist 5/5 figée. Le Voyageur du seed peut donc livrer avec ce code
 * et l'Expéditrice le voit dans son suivi.
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
  // A28 — moteur PER_KG (optionnel : seuls les trips nouvelle formule)
  pricePerKgCents?: number;
  checkedBag23PriceCents?: number;
  cabinBag12PriceCents?: number;
  familyConditions?: { familyKey: string; mode: string; surchargePct?: number }[];
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
  // ⭐ A28 — LE trip PER_KG de demonstration (QA de la PR-B) :
  // 11,50 €/kg · 23 kg · electronique +20 % · alimentaire REFUSE ·
  // bagage soute 23 kg a 230 € forfaitaire.
  { key: "bzv-perkg", carrierKey: "thomas", originCity: "Paris", originCountryCode: "FR", originTimezone: "Europe/Paris", destinationCity: "Brazzaville", destinationCountryCode: "CG", destinationTimezone: "Africa/Brazzaville", departureAt: days(15), transportMode: "PLANE", capacityKg: 23, pricePerKgCents: 1150, checkedBag23PriceCents: 23000, familyConditions: [{ familyKey: "ELECTRONICS_DEVICES", mode: "SURCHARGE", surchargePct: 20 }, { familyKey: "FOOD_DRY_SEALED", mode: "REFUSE" }] },
];

/* ══ Pricing helpers (centimes entiers — A2, commission 15 %) ═ */

function perCategory(categoryPriceCents: number) {
  const transportCents = categoryPriceCents;
  const commissionCents = Math.max(300, Math.round(transportCents * 0.12)); // D16 acté : 12 %, plancher 3 €
  return {
    pricingModel: "PER_CATEGORY" as const,
    categoryPriceCents,
    pricePerKgCents: null,
    sizeClass: null,
    transportCents,
    commissionPct: 0.12,
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
  const commissionCents = Math.max(300, Math.round(transportCents * 0.12));
  return {
    pricingModel: "PER_KG" as const,
    categoryPriceCents: null,
    pricePerKgCents,
    sizeClass,
    transportCents,
    commissionPct: 0.12,
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
  { key: "bzv-completed-blocked", tripKey: "bzv-inflight", shipperKey: "aminata", status: "COMPLETED", weightKg: 2, category: "BOOKS", description: "Manuels scolaires (versement bloqué : compte Stripe incomplet — recette V12/V13)", declaredValueCents: 4000, pricing: perCategory(2600), recipient: RCP_BZV,
    milestones: { requestedAt: days(-13), expiresAt: days(-12), acceptedAt: days(-12), pickedUpAt: days(-7), deliveredAt: days(-7), payoutDueAt: days(-3), completedAt: days(-3) },
    pickup: { confirmedAt: days(-7), photoUrls: ["https://r2.seed.yamba.dev/bzv-completed-blocked-1.jpg"], notes: null } },
  { key: "bzv-completed", tripKey: "bzv-inflight", shipperKey: "mai", status: "COMPLETED", weightKg: 4, category: "CLOTHES", description: "Pagnes et tissus", declaredValueCents: 20000, pricing: perCategory(3500), recipient: RCP_BZV,
    milestones: { requestedAt: days(-12), expiresAt: days(-11), acceptedAt: days(-11), pickedUpAt: days(-6), deliveredAt: days(-6), payoutDueAt: days(-2), completedAt: days(-2) },
    pickup: { confirmedAt: days(-6), photoUrls: ["https://r2.seed.yamba.dev/bzv-completed-1.jpg"], notes: null } },
  // C-PR5 (D58) — transfert renversé par Stripe après versement : file admin « Transferts renversés » (recette FIN)
  { key: "bzv-reversed", tripKey: "bzv-inflight", shipperKey: "pauline", status: "COMPLETED", weightKg: 3, category: "COSMETICS", description: "Crèmes et parfums (transfert renversé — recette FIN04/FIN05)", declaredValueCents: 9000, pricing: perCategory(3000), recipient: RCP_BZV,
    milestones: { requestedAt: days(-14), expiresAt: days(-13), acceptedAt: days(-13), pickedUpAt: days(-8), deliveredAt: days(-8), payoutDueAt: days(-4), completedAt: days(-4) },
    pickup: { confirmedAt: days(-8), photoUrls: [], notes: null } },

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
  // C-PR2 (A81/D55 3A) — annulée APRÈS le départ sans prise en charge : retenue 50 % « à arbitrer » (file admin, MED8).
  { key: "bzv-held", tripKey: "bzv-inflight", shipperKey: "aminata", status: "CANCELLED", weightKg: 2, category: "COSMETICS", description: "Produits de beauté", declaredValueCents: 6000, pricing: perCategory(2600), recipient: RCP_BZV,
    milestones: { requestedAt: days(-9), expiresAt: days(-8), acceptedAt: days(-8), closedAt: days(-4), closedBy: "SHIPPER", cancelReason: "Le Voyageur ne s'est pas présenté au rendez-vous" } },
];

/* ══ Exécution ════════════════════════════════════════════════ */

async function main() {
  console.log("🌱 Seed Deal lifecycle — 6 corridors internationaux\n");

  // 1. Users — upsert (ids stables entre les runs)
  const userIds = new Map<string, string>();
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { emailNormalized: u.email.toLowerCase() },
      // D71 — un compte de moins de 30 jours est « neuf » (plafonds CNF-06) : les membres du seed ont 90 jours,
      // sauf pour la grille TrustScore qui utilise un compte fraîchement inscrit.
      update: { firstName: u.firstName, lastName: u.lastName, roles: u.roles, passwordHash: SEED_PASSWORD_HASH, createdAt: days(-90) },
      create: {
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        emailNormalized: u.email.toLowerCase(),
        passwordHash: SEED_PASSWORD_HASH,
        publicSlug: `seed-${u.key}`, // String? @unique — 2 nulls collisionnent sur l'index Mongo
        phoneE164: u.phoneE164 ?? null,
        roles: u.roles,
        carrierStatus: u.carrier ? "ACTIVE" : "NONE",
        createdAt: days(-90),
      },
    });
    userIds.set(u.key, user.id);
  }
  console.log(`✓ ${USERS.length} users (upsert par emailNormalized)`);

  // 1bis. CarrierPage Stripe-complet pour chaque Voyageur — le gate D31
  // (accept) exige onboardingStep ≠ PROFILE + stripeOnboardingComplete +
  // stripeChargesEnabled quand le provider est STRIPE. Compte factice :
  // aucune API Stripe n'est appelée avec cet acct_ en dev.
  let carrierPages = 0;
  for (const u of USERS.filter((x) => x.carrier)) {
    const userId = userIds.get(u.key)!;
    await prisma.carrierPage.upsert({
      where: { userId },
      update: {
        onboardingStep: "COMPLETE",
        stripeOnboardingComplete: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      },
      create: {
        userId,
        name: `${u.firstName} ${u.lastName.charAt(0)}.`,
        onboardingStep: "COMPLETE",
        stripeAccountId: `acct_fake_seed_${u.key}`,
        stripeOnboardingComplete: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      },
    });
    carrierPages += 1;
  }
  console.log(`✓ ${carrierPages} carrier pages (onboarding COMPLETE, Stripe factice — gate D31 passant)`);

  const seedIds = [...userIds.values()];

  // 2. Wipe du périmètre seed (idempotence trips/bookings)
  // B4 (D51) : les dossiers de litige suivent leurs bookings.
  const delD = await prisma.dispute.deleteMany({
    where: { OR: [{ shipperId: { in: seedIds } }, { carrierId: { in: seedIds } }] },
  });
  const delB = await prisma.booking.deleteMany({
    where: { OR: [{ shipperId: { in: seedIds } }, { carrierId: { in: seedIds } }] },
  });
  // C-PR4 — billets seedés (les documents suivent la cascade du Trip, mais on nettoie explicitement par fileId)
  await prisma.tripDocument.deleteMany({ where: { fileId: { startsWith: "seed-ticket-" } } });
  // Chantier F (D61) — fils de conversation des deals seedes (Message/Meetup suivent la cascade).
  const seedConversations = await prisma.conversation.findMany({ where: { shipperId: { in: seedIds } }, select: { id: true } });
  // F-PR3 — les signalements des messages de ces fils partent avec eux (Report.targetType MESSAGE).
  if (seedConversations.length) {
    const seedMessages = await prisma.message.findMany({ where: { conversationId: { in: seedConversations.map((c) => c.id) } }, select: { id: true } });
    if (seedMessages.length) await prisma.report.deleteMany({ where: { targetType: "MESSAGE", targetId: { in: seedMessages.map((m) => m.id) } } });
  }
  if (seedConversations.length) {
    const ids = seedConversations.map((c) => c.id);
    await prisma.phoneReveal.deleteMany({ where: { conversationId: { in: ids } } });
    await prisma.meetup.deleteMany({ where: { conversationId: { in: ids } } });
    await prisma.message.deleteMany({ where: { conversationId: { in: ids } } });
    await prisma.conversation.deleteMany({ where: { id: { in: ids } } });
  }
  const delT = await prisma.trip.deleteMany({ where: { userId: { in: seedIds } } });
  console.log(`✓ wipe : ${delB.count} bookings, ${delD.count} disputes, ${delT.count} trips (périmètre seed)`);

  // 3. Trips — reservedKg = Σ poids des bookings ACTIFS (CAP-02, calculé)
  const tripIds = new Map<string, string>();
  let ticketSeeded = false;
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
        // A28 — pass-through PER_KG (undefined = champ absent, trips legacy intacts)
        pricePerKgCents: t.pricePerKgCents,
        checkedBag23PriceCents: t.checkedBag23PriceCents,
        cabinBag12PriceCents: t.cabinBag12PriceCents,
        familyConditions: (t.familyConditions ?? []) as never,
        publishedAt: days(-16),
      },
    });
    tripIds.set(t.key, trip.id);
    console.log(`  · trip ${t.key} → ${trip.id} (reservedKg=${reservedKg}/${t.capacityKg})`);
    // C-PR4 (D57 1A) — un billet PENDING sur le premier trajet à venir : alimente la file « Billets » de l'admin en recette.
    if (!ticketSeeded && t.departureAt.getTime() > Date.now()) {
      ticketSeeded = true;
      await prisma.tripDocument.create({
        data: {
          tripId: trip.id,
          uploadedByUserId: userIds.get(t.carrierKey)!,
          type: "TICKET_PROOF",
          status: "PENDING",
          fileId: `seed-ticket-${t.key}`,
          url: "https://ik.imagekit.io/demo/img/image10.jpeg",
          originalName: `billet-${t.key}.jpeg`,
          mimeType: "image/jpeg",
          title: "Billet (seed)",
        },
      });
      await prisma.trip.update({ where: { id: trip.id }, data: { ticketVerificationStatus: "PENDING" } });
      console.log(`    · billet PENDING seedé sur ${t.key} (file admin « Billets »)`);
    }
  }

  // 4. Bookings
  const output: {
    key: string; id: string; status: string; corridor: string;
    shipper: string; carrier: string;
  }[] = [];

  const seedCodeHash = await hashDeliveryCode(SEED_DELIVERY_CODE);

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
        pickup: b.pickup ? { ...b.pickup, checklist: SEED_CHECKLIST } : undefined,
        trackingEvents: b.trackingEvents ?? [],
        // D43 — un vrai code (haché + chiffré) dès qu'il y a eu pickup.
        ...(b.pickup
          ? { deliveryCodeHash: seedCodeHash, deliveryCodeEncrypted: encryptDeliveryCode(SEED_DELIVERY_CODE) }
          : {}),
        // B2 : un intent FAKE par booking — le FakePaymentProvider ADOPTE
        // les ids `pi_fake_seed_…` inconnus (AUTHORIZED à la lecture), donc
        // accept/decline/cancel sont jouables en dev sans clés Stripe.
        paymentProvider: "FAKE",
        paymentIntentId: `pi_fake_seed_${b.key}`,
        ...b.milestones,
      } as never,
    });
    // B4 — versement (D49/D50) et dossier de litige (D51) cohérents avec le statut.
    const m = b.milestones as { completedAt?: Date; disputeTicket?: string; disputedAt?: Date };
    if (b.status === "COMPLETED" && b.key.endsWith("-blocked")) {
      // A75/V12 : versement FAILED faute de compte Stripe prêt — bandeau + CTA sans Stripe réel.
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          completedBy: "SYSTEM",
          payoutStatus: "FAILED",
          payoutFailureReason: "CARRIER_ACCOUNT_NOT_READY",
          payoutAmountCents: (booking as unknown as { pricing: { transportCents: number } }).pricing.transportCents,
          payoutAttempts: 4,
          // C-PR5 (A111) — relance échue : le cron (ou « Relancer » dans l'admin) peut rejouer tout de suite
          payoutLastAttemptAt: days(-1),
          payoutNextRetryAt: days(-1),
        },
      });
    } else if (b.status === "COMPLETED" && b.key.endsWith("-reversed")) {
      // C-PR5 (D58) — versé puis renversé par Stripe (webhook transfer.reversed) : attend une décision admin.
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          completedBy: "SYSTEM",
          payoutStatus: "REVERSED",
          payoutFailureReason: "PROVIDER_REVERSED",
          payoutAmountCents: (booking as unknown as { pricing: { transportCents: number } }).pricing.transportCents,
          payoutSentAt: m.completedAt ?? NOW,
          payoutAttempts: 1,
          transferId: `tr_fake_seed_${b.key}`,
          payoutReversalResolution: null,
          payoutReversalResolvedAt: null,
        },
      });
    } else if (b.status === "COMPLETED") {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          completedBy: "SYSTEM",
          // B5 : fenêtre de notation ouverte (14 j après completedAt) — recette de la notation
          ratingWindowEndsAt: new Date((m.completedAt ?? NOW).getTime() + 14 * 86_400_000),
          ratingRemindersSent: 0,
          payoutStatus: "SENT",
          payoutAmountCents: (booking as unknown as { pricing: { transportCents: number } }).pricing.transportCents,
          payoutSentAt: m.completedAt ?? NOW,
          payoutAttempts: 1,
          transferId: `tr_fake_seed_${b.key}`,
        },
      });
    }
    if (b.status === "CANCELLED" && b.key.endsWith("-held")) {
      // A81 — paiement capturé à l'acceptation, remboursé à 50 %, retenue conservée « à arbitrer ».
      const pricing = (booking as unknown as { pricing: { totalShipperCents: number } }).pricing;
      const retentionCents = Math.round(pricing.totalShipperCents / 2);
      const closedAt = (b.milestones as { closedAt?: Date }).closedAt ?? NOW;
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          capturedAt: (b.milestones as { acceptedAt?: Date }).acceptedAt ?? NOW,
          chargeId: `ch_fake_seed_${b.key}`,
          refundedAt: closedAt,
          refundAmountCents: pricing.totalShipperCents - retentionCents,
          retentionCents,
          retentionDisposition: "HELD_FOR_MEDIATION",
        },
      });
    }
    // Chantier F (D61) — un fil vivant sur le deal accepte : recette FCH01+ sans rien creer a la main.
    if (b.key === "bzv-accepted") {
      const shipperId = userIds.get(b.shipperKey)!;
      const carrierId = userIds.get(t.carrierKey)!;
      const conversation = await prisma.conversation.create({
        data: { bookingId: booking.id, shipperId, carrierId, lastMessageAt: days(-1), shipperLastReadAt: days(-1) },
      });
      await prisma.message.create({
        data: { conversationId: conversation.id, kind: "TEXT", authorId: shipperId, authorRole: "SHIPPER", body: "Bonjour ! Le colis est pret, emballe et ferme. On se retrouve ou ?", photoUrls: [], createdAt: days(-2) },
      });
      const carrierMessage = await prisma.message.create({
        data: { conversationId: conversation.id, kind: "TEXT", authorId: carrierId, authorRole: "CARRIER", body: "Bonjour, parfait. Je propose le terminal 2E, cote enregistrement. Sinon on peut regler ca directement entre nous, hors appli ?", photoUrls: [], createdAt: days(-1) },
      });
      // F-PR3 (D61 7A) — un message signale par l'Expediteur, a traiter dans l'admin (file « Signalements »).
      await prisma.report.create({
        data: { reporterUserId: shipperId, targetType: "MESSAGE", targetId: carrierMessage.id, reason: "OFF_PLATFORM", details: "Il propose de regler hors de Yamba.", status: "OPEN", createdAt: days(-1) },
      });
      await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAuthorRole: "CARRIER", shipperRemindedAt: null, carrierRemindedAt: null } });
      await prisma.meetup.create({
        data: {
          conversationId: conversation.id,
          bookingId: booking.id,
          kind: "PICKUP",
          status: "PROPOSED",
          proposedByRole: "CARRIER",
          proposedById: carrierId,
          placeLabel: "Paris CDG, terminal 2E, comptoirs d'enregistrement",
          placeDetails: "Devant les bornes libre-service, cote depart.",
          startAt: new Date(t.departureAt.getTime() - 3 * 3_600_000),
          endAt: new Date(t.departureAt.getTime() - 2 * 3_600_000),
          createdAt: days(-1),
        },
      });
      console.log(`    · conversation seedee sur ${b.key} (2 messages, 1 rendez-vous propose, 1 message signale)`);
    }
    if (b.status === "DISPUTED") {
      await prisma.booking.update({ where: { id: booking.id }, data: { payoutStatus: "FROZEN" } });
      await prisma.dispute.create({
        data: {
          bookingId: booking.id,
          ticketNumber: m.disputeTicket ?? `YAM-${1000 + output.length}`,
          shipperId: userIds.get(b.shipperKey)!,
          carrierId: userIds.get(t.carrierKey)!,
          category: "CONTENT_MISSING",
          description: "Le colis est bien arrivé mais il manque une partie du contenu déclaré : deux des trois jouets prévus ne sont pas dans le carton.",
          desiredOutcome: "PARTIAL_REFUND",
          photoUrls: [],
          pledgeAcceptedAt: m.disputedAt ?? NOW,
        },
      });
    }
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
