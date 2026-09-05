/**
 * platform-settings.schema.ts — le CATALOGUE des paramètres de la plateforme (C-PR8a, D62)
 * ======================================================================================
 * Source unique : chaque clé porte sa règle métier, son unité, sa valeur par défaut
 * (= la valeur du code au moment de la gravure), ses bornes dures, sa portée et son
 * texte d'explication. Le même texte sert l'info-bulle de l'admin, la page
 * « Documentation des paramètres », l'OpenAPI et `context/YAMBA-PARAMETRES.md`.
 *
 * Trois classes (D62 2A) :
 *   A — réglable en ligne : c'est ce catalogue (`SETTINGS_CATALOG`).
 *   B — visible mais modifiable par déploiement : `FIXED_PARAMETERS` (invariants de sécurité).
 *   C — absente de la page tant que le code ne la lit pas : `PLANNED_PARAMETERS` (noms seulement).
 *
 * Deux portées (3A) : BUSINESS = SUPER_ADMIN seul · OPERATIONS = OPS ou SUPER_ADMIN.
 * Pur, sans dépendance : consommé par les services, les fronts (via l'API) et le script
 * qui génère la documentation. Aucune valeur monétaire en Float : tout ce qui est en
 * euros est en CENTS entiers.
 */
import { z } from "zod";

export type SettingScope = "BUSINESS" | "OPERATIONS";
export type SettingUnit = "percent" | "cents" | "kg" | "coef" | "hours" | "days" | "minutes" | "count" | "rating" | "mb";
export type SettingGroup = "pricing" | "protection" | "cancellation" | "rating" | "dispute" | "reputation" | "messaging" | "alerts" | "documents" | "privacy";

export const SETTING_GROUP_LABEL: Record<SettingGroup, string> = {
  pricing: "Prix et commission",
  protection: "Garantie Yamba",
  cancellation: "Annulation",
  rating: "Notation",
  dispute: "Litiges",
  reputation: "Réputation",
  messaging: "Messagerie",
  alerts: "Alertes d'exploitation",
  documents: "Documents",
  privacy: "Données personnelles",
};

export type SettingDefinition = {
  key: string;
  group: SettingGroup;
  label: string;
  /** Ce que fait le paramètre, en français, pour l'info-bulle et la documentation. */
  description: string;
  /** Règle métier / décision source (COM-02, D32, ANN-01…). */
  rule: string;
  unit: SettingUnit;
  default: number;
  min: number;
  max: number;
  step: number;
  scope: SettingScope;
  /** Figure dans les CGU : la page prévient qu'il faut mettre le texte à jour. */
  contractual?: boolean;
  /** Services qui lisent la clé (preuve qu'un curseur commande quelque chose). */
  consumers: readonly string[];
  /** Exemple lisible, calculé à la main, pour la documentation. */
  example?: string;
};

const NEW_BOOKINGS = " Ne change rien aux réservations déjà faites : leur prix est figé (COM-04, PRC-08).";

export const SETTINGS_CATALOG = [
  /* ── Prix et commission ── */
  { key: "pricing.commissionPct", group: "pricing", label: "Commission Yamba", description: "Pourcentage prélevé sur le transport, payé par l'Expéditeur ; les frais Stripe sont absorbés dedans." + NEW_BOOKINGS, rule: "D16 · COM-01", unit: "percent", default: 12, min: 5, max: 20, step: 0.5, scope: "BUSINESS", contractual: true, consumers: ["deal-service", "trip-service", "user-ui"], example: "Transport 20 € → commission 2,40 € (12 %)." },
  { key: "pricing.commissionFloorCents", group: "pricing", label: "Plancher de commission", description: "La commission ne descend jamais sous ce montant, même sur un petit colis." + NEW_BOOKINGS, rule: "D16 · COM-02", unit: "cents", default: 300, min: 100, max: 1000, step: 50, scope: "BUSINESS", contractual: true, consumers: ["deal-service", "trip-service", "user-ui"], example: "Transport 8 € → 12 % = 0,96 €, plancher 3 € appliqué." },
  { key: "pricing.minBillableKg", group: "pricing", label: "Poids facturable minimum", description: "Un colis plus léger est facturé comme s'il pesait ce poids (standard courrier / express).", rule: "D32 · PRC-06", unit: "kg", default: 0.5, min: 0.1, max: 2, step: 0.1, scope: "BUSINESS", consumers: ["deal-service", "trip-service", "user-ui"], example: "Colis de 0,2 kg à 10 €/kg → facturé 0,5 kg = 5 €." },
  { key: "pricing.minTransportCents", group: "pricing", label: "Prix minimum par colis", description: "Le transport d'un colis ne descend jamais sous ce montant : le coût réel du Voyageur est le temps, pas le poids." + NEW_BOOKINGS, rule: "D32 · PRC-06", unit: "cents", default: 800, min: 100, max: 3000, step: 50, scope: "BUSINESS", contractual: true, consumers: ["deal-service", "trip-service", "user-ui"], example: "0,5 kg à 10 €/kg = 5 € → 8 € appliqués." },
  { key: "pricing.referenceKg", group: "pricing", label: "Colis de référence (comparabilité)", description: "Poids du colis de référence qui rend les offres comparables dans la recherche (tri par prix). Les trajets déjà publiés gardent leur valeur jusqu'au script de recalcul.", rule: "D33", unit: "kg", default: 2, min: 1, max: 10, step: 0.5, scope: "BUSINESS", consumers: ["trip-service"], example: "12 €/kg → prix comparable 24 €." },
  { key: "pricing.sizeCoefS", group: "pricing", label: "Coefficient taille S", description: "Multiplicateur du transport pour un petit colis. Doit rester ≤ M ≤ L.", rule: "PRC-03", unit: "coef", default: 1, min: 0.5, max: 2, step: 0.05, scope: "BUSINESS", consumers: ["deal-service", "user-ui"] },
  { key: "pricing.sizeCoefM", group: "pricing", label: "Coefficient taille M", description: "Multiplicateur du transport pour un colis moyen.", rule: "PRC-03", unit: "coef", default: 1.1, min: 0.5, max: 2, step: 0.05, scope: "BUSINESS", consumers: ["deal-service", "user-ui"] },
  { key: "pricing.sizeCoefL", group: "pricing", label: "Coefficient taille L", description: "Multiplicateur du transport pour un grand colis.", rule: "PRC-03", unit: "coef", default: 1.25, min: 0.5, max: 2, step: 0.05, scope: "BUSINESS", consumers: ["deal-service", "user-ui"], example: "Transport 20 € en L → 25 €." },
  /* ── Garantie Yamba ── */
  { key: "protection.extendedPremiumCents", group: "protection", label: "Prime Garantie étendue", description: "Prix payé par l'Expéditeur pour la Garantie étendue, ajouté au total." + NEW_BOOKINGS, rule: "D22 · GAR-06", unit: "cents", default: 600, min: 0, max: 5000, step: 50, scope: "BUSINESS", contractual: true, consumers: ["deal-service", "user-ui"] },
  { key: "protection.extendedCapCents", group: "protection", label: "Plafond Garantie étendue", description: "Valeur maximale couverte par la Garantie étendue. Figure dans les CGU.", rule: "D22 · GAR-03", unit: "cents", default: 50000, min: 10000, max: 200000, step: 1000, scope: "BUSINESS", contractual: true, consumers: ["deal-service", "user-ui"] },
  /* ── Annulation ── */
  { key: "cancellation.fullRefundUntilHours", group: "cancellation", label: "Remboursement intégral jusqu'à", description: "Nombre d'heures avant le départ jusqu'auquel une annulation après acceptation est remboursée à 100 %. En deçà, la retenue s'applique.", rule: "ANN-01 · D21", unit: "hours", default: 48, min: 0, max: 168, step: 1, scope: "BUSINESS", contractual: true, consumers: ["deal-service"], example: "Départ samedi 10 h : intégral jusqu'à jeudi 10 h." },
  { key: "cancellation.lateRetentionPct", group: "cancellation", label: "Retenue d'annulation tardive", description: "Part du total retenue quand l'Expéditeur annule après la fenêtre ; le Voyageur en reçoit sa part nette au prorata.", rule: "ANN-01 · D39 · D50", unit: "percent", default: 50, min: 0, max: 100, step: 5, scope: "BUSINESS", contractual: true, consumers: ["deal-service"], example: "Total 30 € annulé la veille → 15 € rendus." },
  /* ── Notation ── */
  { key: "rating.windowDays", group: "rating", label: "Fenêtre de notation", description: "Jours pendant lesquels les deux parties peuvent se noter après la fin du deal ; les notes se révèlent à la fin de la fenêtre ou quand les deux ont noté.", rule: "D53 · RG-NOTE-01", unit: "days", default: 14, min: 1, max: 60, step: 1, scope: "BUSINESS", contractual: true, consumers: ["deal-service"] },
  /* ── Litiges ── */
  { key: "dispute.responseDelayHours", group: "dispute", label: "Délai de réponse au litige", description: "Heures laissées au Voyageur pour donner sa version avant que le litige devienne décidable sans elle.", rule: "D55 1A · RG-MED-02", unit: "hours", default: 72, min: 12, max: 336, step: 12, scope: "BUSINESS", consumers: ["deal-service"], example: "Litige ouvert lundi 9 h → décidable jeudi 9 h." },
  /* ── Réputation ── */
  { key: "reputation.carrier.confirmedMinDeals", group: "reputation", label: "Voyageur confirmé : deals minimum", description: "Nombre de deals terminés à partir duquel un Voyageur passe de « nouveau » à « confirmé ».", rule: "D29① · REP-03", unit: "count", default: 3, min: 1, max: 50, step: 1, scope: "BUSINESS", consumers: ["deal-service"] },
  { key: "reputation.carrier.topMinDeals", group: "reputation", label: "Voyageur top : deals minimum", description: "Deals terminés nécessaires au niveau « top » (avec la note et les annulations ci-dessous).", rule: "REP-03", unit: "count", default: 10, min: 1, max: 200, step: 1, scope: "BUSINESS", consumers: ["deal-service"] },
  { key: "reputation.carrier.topMinRating", group: "reputation", label: "Voyageur top : note minimale", description: "Moyenne révélée minimale pour le niveau « top ».", rule: "REP-03", unit: "rating", default: 4.8, min: 3, max: 5, step: 0.1, scope: "BUSINESS", consumers: ["deal-service"] },
  { key: "reputation.carrier.topMaxLateCancellations", group: "reputation", label: "Voyageur top : annulations tolérées", description: "Annulations après acceptation tolérées pour rester « top ».", rule: "REP-03", unit: "count", default: 0, min: 0, max: 10, step: 1, scope: "BUSINESS", consumers: ["deal-service"] },
  { key: "reputation.shipper.confirmedMinDeals", group: "reputation", label: "Expéditeur fiable : deals minimum", description: "Deals terminés à partir desquels un Expéditeur est « confirmé ».", rule: "REP-03", unit: "count", default: 3, min: 1, max: 50, step: 1, scope: "BUSINESS", consumers: ["deal-service"] },
  { key: "reputation.shipper.topMinDeals", group: "reputation", label: "Expéditeur top : deals minimum", description: "Deals terminés nécessaires au niveau « top » côté Expéditeur.", rule: "REP-03", unit: "count", default: 5, min: 1, max: 200, step: 1, scope: "BUSINESS", consumers: ["deal-service"] },
  { key: "reputation.shipper.topMinRating", group: "reputation", label: "Expéditeur top : note minimale", description: "Moyenne révélée minimale pour le niveau « top » côté Expéditeur.", rule: "REP-03", unit: "rating", default: 4.8, min: 3, max: 5, step: 0.1, scope: "BUSINESS", consumers: ["deal-service"] },
  { key: "reputation.shipper.topMaxLateCancellations", group: "reputation", label: "Expéditeur top : annulations tardives tolérées", description: "Annulations tardives tolérées pour rester « top » côté Expéditeur.", rule: "REP-03", unit: "count", default: 0, min: 0, max: 10, step: 1, scope: "BUSINESS", consumers: ["deal-service"] },
  /* ── Messagerie ── */
  { key: "messaging.writeDaysAfterEnd", group: "messaging", label: "Fil ouvert après la fin du deal", description: "Jours pendant lesquels on peut encore écrire dans la conversation après la fin du deal ; ensuite lecture seule.", rule: "D61 2A · RG-FCH-07", unit: "days", default: 14, min: 0, max: 90, step: 1, scope: "BUSINESS", consumers: ["message-service"] },
  { key: "messaging.phoneRevealLeadHours", group: "messaging", label: "Numéro révélé avant le rendez-vous", description: "Heures avant le rendez-vous de remise (à défaut le départ) à partir desquelles le numéro de l'autre partie peut être affiché.", rule: "D61 4A", unit: "hours", default: 2, min: 0, max: 72, step: 1, scope: "BUSINESS", consumers: ["message-service"], example: "Remise à 14 h → numéro disponible dès 12 h." },
  { key: "messaging.retentionDays", group: "messaging", label: "Conservation des conversations", description: "Jours après la fin du deal (ou la dernière activité) au bout desquels la conversation est purgée ; les signalements survivent.", rule: "D61 8A · RG-FCH-22", unit: "days", default: 365, min: 30, max: 1095, step: 1, scope: "OPERATIONS", consumers: ["message-service"] },
  { key: "messaging.reminderDelayMinutes", group: "messaging", label: "Relance email après", description: "Minutes pendant lesquelles un message doit rester non lu avant l'email de relance (le cron passe toutes les 5 min).", rule: "D61 6A · RG-FCH-17", unit: "minutes", default: 15, min: 1, max: 1440, step: 1, scope: "OPERATIONS", consumers: ["message-service"] },
  { key: "messaging.reminderMinIntervalMinutes", group: "messaging", label: "Au plus une relance toutes les", description: "Intervalle minimal entre deux emails de relance pour une même conversation et un même destinataire. Doit rester ≥ le délai de relance.", rule: "D61 6A · RG-FCH-17", unit: "minutes", default: 60, min: 5, max: 1440, step: 5, scope: "OPERATIONS", consumers: ["message-service"] },
  /* ── Alertes d'exploitation ── */
  { key: "alerts.payoutFailedHours", group: "alerts", label: "Versement en échec depuis", description: "Heures après lesquelles un versement en échec devient une alerte.", rule: "D59 3A", unit: "hours", default: 48, min: 1, max: 336, step: 1, scope: "OPERATIONS", consumers: ["deal-service"] },
  { key: "alerts.disputeUndecidedHours", group: "alerts", label: "Litige décidable sans décision depuis", description: "Heures après lesquelles un litige décidable et non décidé devient une alerte.", rule: "D59 3A · A131", unit: "hours", default: 72, min: 1, max: 336, step: 1, scope: "OPERATIONS", consumers: ["deal-service"] },
  { key: "alerts.retentionHeldDays", group: "alerts", label: "Retenue non arbitrée depuis", description: "Jours après lesquels une retenue d'annulation non arbitrée devient une alerte.", rule: "D59 3A", unit: "days", default: 7, min: 1, max: 60, step: 1, scope: "OPERATIONS", consumers: ["deal-service"] },
  { key: "alerts.reversalOpenHours", group: "alerts", label: "Renversement ouvert depuis", description: "Heures après lesquelles un renversement de versement ouvert devient une alerte.", rule: "D59 3A", unit: "hours", default: 48, min: 1, max: 336, step: 1, scope: "OPERATIONS", consumers: ["deal-service"] },
  { key: "alerts.outboxParkedAttempts", group: "alerts", label: "Événement parqué après", description: "Nombre de tentatives de relais à partir duquel un événement de l'outbox est considéré parqué.", rule: "D59 3A", unit: "count", default: 10, min: 1, max: 100, step: 1, scope: "OPERATIONS", consumers: ["deal-service"] },
  { key: "alerts.outboxLagMinutes", group: "alerts", label: "Relais en retard depuis", description: "Minutes de retard du relais d'événements à partir desquelles une alerte est levée.", rule: "D59 3A", unit: "minutes", default: 15, min: 1, max: 1440, step: 1, scope: "OPERATIONS", consumers: ["deal-service"] },
  { key: "alerts.emailsFailedWindowHours", group: "alerts", label: "Emails en échec : fenêtre", description: "Fenêtre glissante (heures) dans laquelle un email en échec déclenche l'alerte.", rule: "D59 3A", unit: "hours", default: 24, min: 1, max: 168, step: 1, scope: "OPERATIONS", consumers: ["deal-service"] },
  { key: "alerts.noTripPublishedDays", group: "alerts", label: "Aucun trajet publié depuis", description: "Jours sans nouvelle publication de trajet avant l'alerte de liquidité.", rule: "D59 3A", unit: "days", default: 7, min: 1, max: 90, step: 1, scope: "OPERATIONS", consumers: ["deal-service"] },
  { key: "alerts.acceptanceRateWindowDays", group: "alerts", label: "Taux d'acceptation : fenêtre", description: "Jours sur lesquels le taux d'acceptation des demandes est calculé.", rule: "D59 3A", unit: "days", default: 7, min: 1, max: 90, step: 1, scope: "OPERATIONS", consumers: ["deal-service"] },
  { key: "alerts.acceptanceRateMinPct", group: "alerts", label: "Taux d'acceptation minimum", description: "En dessous de ce pourcentage sur la fenêtre, alerte.", rule: "D59 3A", unit: "percent", default: 30, min: 0, max: 100, step: 1, scope: "OPERATIONS", consumers: ["deal-service"] },
  { key: "alerts.acceptanceRateMinRequests", group: "alerts", label: "Taux d'acceptation : demandes minimum", description: "Nombre minimal de demandes sur la fenêtre pour que le taux soit significatif.", rule: "D59 3A", unit: "count", default: 5, min: 1, max: 1000, step: 1, scope: "OPERATIONS", consumers: ["deal-service"] },
  /* ── Documents ── */
  { key: "documents.maxDocsPerTrip", group: "documents", label: "Documents par trajet", description: "Nombre maximal de justificatifs (billets…) attachés à un trajet.", rule: "ex-SiteConfig", unit: "count", default: 5, min: 1, max: 20, step: 1, scope: "OPERATIONS", consumers: ["trip-service"] },
  { key: "documents.maxDocSizeMb", group: "documents", label: "Taille maximale d'un document", description: "Taille maximale (Mo) d'un justificatif de trajet, vérifiée côté serveur.", rule: "ex-SiteConfig", unit: "mb", default: 5, min: 1, max: 25, step: 1, scope: "OPERATIONS", consumers: ["trip-service"] },
  /* ── Données personnelles ── */
  { key: "privacy.recipientRetentionDays", group: "privacy", label: "Effacement du destinataire après", description: "Jours après la fin d'un deal au bout desquels le nom, le téléphone et l'email du destinataire (un tiers sans compte) sont effacés de la réservation. Jamais avant : un litige ou une preuve de remise peut en avoir besoin.", rule: "D63 5A · RGP-02", unit: "days", default: 30, min: 7, max: 365, step: 1, scope: "OPERATIONS", consumers: ["deal-service"] },
] as const satisfies readonly SettingDefinition[];

export type SettingKey = (typeof SETTINGS_CATALOG)[number]["key"];
export const SETTING_KEYS = SETTINGS_CATALOG.map((d) => d.key) as SettingKey[];
export type PlatformSettingsValues = Record<SettingKey, number>;

export const SETTINGS_DEFAULTS: PlatformSettingsValues = Object.fromEntries(SETTINGS_CATALOG.map((d) => [d.key, d.default])) as PlatformSettingsValues;

export function settingDefinition(key: string): SettingDefinition | undefined {
  return (SETTINGS_CATALOG as readonly SettingDefinition[]).find((d) => d.key === key);
}
export const isSettingKey = (key: string): key is SettingKey => SETTING_KEYS.includes(key as SettingKey);

/** Classe B (D62 2A) — visibles, modifiables par déploiement seulement. */
export const FIXED_PARAMETERS = [
  { key: "session.member.idleMinutes", label: "Session membre : inactivité", value: "60 min (7 j avec « rester connecté »)", rule: "D27 · RG-A-13" },
  { key: "session.member.maxDays", label: "Session membre : durée maximale", value: "7 j (30 j avec « rester connecté »)", rule: "D27 · RG-A-14" },
  { key: "session.admin", label: "Session admin", value: "accès 15 min · inactivité 45 min · 12 h de vie", rule: "D54 8A · RG-ADM-05" },
  { key: "otp.validityMinutes", label: "Code OTP : validité", value: "10 min", rule: "RG-A-01" },
  { key: "totp.lockout", label: "2FA admin : blocage", value: "5 échecs → 15 min", rule: "RG-ADM-04" },
  { key: "deliveryCode.lockout", label: "Code de livraison : blocage", value: "3 codes faux → 15 min", rule: "D4 · RG-P-06" },
  { key: "reasons.minLength", label: "Motifs au journal", value: "20 caractères (sanction, masquage, export) · 50 (décision de médiation, remboursement manuel)", rule: "D54 6A · D56 2A · D58 3A" },
  { key: "adminInvite.validityHours", label: "Invitation admin : validité", value: "48 h", rule: "D56 · RG-ADM-10" },
] as const;

/** Classe C (D62 2A) — nommées au §13 des règles métier, pas encore lues par le code. */
export const PLANNED_PARAMETERS = [
  { key: "WEIGHT_TOLERANCE_PCT", rule: "PRC-07 · RG-B-11" },
  { key: "SUGGESTION_EXPRESS_CAP_PCT", rule: "PRC-10" },
  { key: "NEW_ACCOUNT_MAX_DECLARED_VALUE / MAX_WEIGHT / MAX_SHIPMENTS_PER_MONTH", rule: "CNF-06" },
  { key: "IDENTITY_REQUIRED_FROM", rule: "CNF-05" },
  { key: "PROTECTION_BASIC_CAP / PROTECTION_PROVIDER", rule: "GAR-01/03" },
  { key: "REPORT_REVIEW_THRESHOLD", rule: "SIG-03" },
  { key: "BAG_FORFAIT_DISCOUNT", rule: "PRC-09" },
  { key: "CATEGORY_SURCHARGE_MAX_PCT", rule: "CAT-03" },
] as const;

/* ── Validation ─────────────────────────────────────────────────────────── */

/** Bornes du catalogue, clé par clé (un objet Zod plat : lisible en OpenAPI). */
export const PlatformSettingsValuesSchema = z
  .object(Object.fromEntries(SETTINGS_CATALOG.map((d) => [d.key, z.number().min(d.min).max(d.max).meta({ description: `${d.label} (${d.unit}) — ${d.rule}` })])) as Record<SettingKey, z.ZodNumber>)
  .meta({ id: "PlatformSettingsValues" });

/** Règles de cohérence entre clés (D62 5A) — refusées côté serveur quel que soit le rôle. */
export function settingsCoherenceIssues(v: PlatformSettingsValues): string[] {
  const issues: string[] = [];
  if (!(v["pricing.sizeCoefS"] <= v["pricing.sizeCoefM"] && v["pricing.sizeCoefM"] <= v["pricing.sizeCoefL"])) issues.push("Les coefficients de taille doivent respecter S ≤ M ≤ L.");
  if (v["protection.extendedCapCents"] < v["protection.extendedPremiumCents"]) issues.push("Le plafond de la Garantie étendue doit être supérieur à sa prime.");
  if (v["reputation.carrier.topMinDeals"] < v["reputation.carrier.confirmedMinDeals"]) issues.push("Voyageur : le niveau top exige au moins autant de deals que le niveau confirmé.");
  if (v["reputation.shipper.topMinDeals"] < v["reputation.shipper.confirmedMinDeals"]) issues.push("Expéditeur : le niveau top exige au moins autant de deals que le niveau confirmé.");
  if (v["messaging.reminderMinIntervalMinutes"] < v["messaging.reminderDelayMinutes"]) issues.push("L'intervalle entre deux relances doit être supérieur ou égal au délai de relance.");
  return issues;
}

/**
 * Fusionne des valeurs stockées avec les défauts : clé inconnue ignorée, valeur absente ou
 * non finie → défaut. Hors bornes : la valeur stockée est conservée (elle a été validée à
 * l'écriture ; si le catalogue a resserré ses bornes depuis, l'admin la voit signalée).
 */
export function mergeSettingsValues(stored: Record<string, unknown> | null | undefined): PlatformSettingsValues {
  const out = { ...SETTINGS_DEFAULTS };
  if (stored && typeof stored === "object") {
    for (const key of SETTING_KEYS) {
      const raw = (stored as Record<string, unknown>)[key];
      if (typeof raw === "number" && Number.isFinite(raw)) out[key] = raw;
    }
  }
  return out;
}

/* ── Projections vers les consommateurs (pures) ─────────────────────────── */

export function pricingParamsFromSettings(v: PlatformSettingsValues) {
  return {
    sizeCoef: { S: v["pricing.sizeCoefS"], M: v["pricing.sizeCoefM"], L: v["pricing.sizeCoefL"] },
    minBillableKg: v["pricing.minBillableKg"],
    minTransportCents: v["pricing.minTransportCents"],
    commissionPct: v["pricing.commissionPct"],
    commissionFloorCents: v["pricing.commissionFloorCents"],
    protectionExtendedPremiumCents: v["protection.extendedPremiumCents"],
    protectionExtendedCapCents: v["protection.extendedCapCents"],
    /** Classe C (D62 2A) : PRC-07 n'est pas encore lu par le code — constante tant qu'aucun consommateur n'existe. */
    weightTolerancePct: 10,
    referenceKg: v["pricing.referenceKg"],
  };
}
export type PricingParamsView = ReturnType<typeof pricingParamsFromSettings>;

export function alertThresholdsFromSettings(v: PlatformSettingsValues) {
  return {
    payoutFailedHours: v["alerts.payoutFailedHours"],
    disputeUndecidedHours: v["alerts.disputeUndecidedHours"],
    retentionHeldDays: v["alerts.retentionHeldDays"],
    reversalOpenHours: v["alerts.reversalOpenHours"],
    outboxParkedAttempts: v["alerts.outboxParkedAttempts"],
    outboxLagMinutes: v["alerts.outboxLagMinutes"],
    emailsFailedWindowHours: v["alerts.emailsFailedWindowHours"],
    noTripPublishedDays: v["alerts.noTripPublishedDays"],
    acceptanceRateWindowDays: v["alerts.acceptanceRateWindowDays"],
    acceptanceRateMinPct: v["alerts.acceptanceRateMinPct"],
    acceptanceRateMinRequests: v["alerts.acceptanceRateMinRequests"],
  };
}

export function reputationParamsFromSettings(v: PlatformSettingsValues) {
  return {
    carrier: { confirmedMinDeals: v["reputation.carrier.confirmedMinDeals"], topMinDeals: v["reputation.carrier.topMinDeals"], topMinRating: v["reputation.carrier.topMinRating"], topMaxLateCancellations: v["reputation.carrier.topMaxLateCancellations"] },
    shipper: { confirmedMinDeals: v["reputation.shipper.confirmedMinDeals"], topMinDeals: v["reputation.shipper.topMinDeals"], topMinRating: v["reputation.shipper.topMinRating"], topMaxLateCancellations: v["reputation.shipper.topMaxLateCancellations"] },
  };
}

/* ── Contrats HTTP ──────────────────────────────────────────────────────── */

export const SETTINGS_REASON_MIN_LENGTH = 20;

const SettingDefinitionSchema = z
  .object({
    key: z.string(),
    group: z.enum(["pricing", "protection", "cancellation", "rating", "dispute", "reputation", "messaging", "alerts", "documents", "privacy"]),
    label: z.string(),
    description: z.string(),
    rule: z.string(),
    unit: z.enum(["percent", "cents", "kg", "coef", "hours", "days", "minutes", "count", "rating", "mb"]),
    default: z.number(),
    min: z.number(),
    max: z.number(),
    step: z.number(),
    scope: z.enum(["BUSINESS", "OPERATIONS"]),
    contractual: z.boolean().optional(),
    consumers: z.array(z.string()),
    example: z.string().optional(),
  })
  .meta({ id: "SettingDefinition" });

export const SettingsLastChangeSchema = z
  .object({ at: z.string().datetime(), byName: z.string(), keys: z.array(z.string()) })
  .meta({ id: "SettingsLastChange", description: "Dernière modification (7 jours) — affichée sur l'accueil admin (D62 5A)" });

export const AdminSettingsResponseSchema = z
  .object({
    values: PlatformSettingsValuesSchema,
    defaults: PlatformSettingsValuesSchema,
    version: z.number().int(),
    updatedAt: z.string().datetime().nullable(),
    updatedBy: z.object({ id: z.string(), firstName: z.string(), lastName: z.string() }).nullable(),
    lastChange: SettingsLastChangeSchema.nullable(),
    catalog: z.array(SettingDefinitionSchema),
    fixed: z.array(z.object({ key: z.string(), label: z.string(), value: z.string(), rule: z.string() })),
    planned: z.array(z.object({ key: z.string(), rule: z.string() })),
  })
  .meta({ id: "AdminSettingsResponse" });
export type AdminSettingsResponse = z.infer<typeof AdminSettingsResponseSchema>;

export const UpdateSettingsRequestSchema = z
  .object({
    changes: z.record(z.string(), z.number()).meta({ description: "Clés du catalogue → nouvelle valeur (seules les clés modifiées)" }),
    reason: z.string().trim().min(SETTINGS_REASON_MIN_LENGTH).max(500),
    expectedVersion: z.number().int().min(0).meta({ description: "Verrou optimiste : la version lue ; 409 si elle a bougé" }),
  })
  .meta({ id: "UpdateSettingsRequest" });
export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequestSchema>;

export const ResetSettingsRequestSchema = z
  .object({
    keys: z.array(z.string()).optional().meta({ description: "Clés à remettre par défaut ; absent ou vide = toutes" }),
    reason: z.string().trim().min(SETTINGS_REASON_MIN_LENGTH).max(500),
    expectedVersion: z.number().int().min(0),
  })
  .meta({ id: "ResetSettingsRequest" });
export type ResetSettingsRequest = z.infer<typeof ResetSettingsRequestSchema>;

export const SettingsWriteResponseSchema = z
  .object({ version: z.number().int(), changed: z.array(z.object({ key: z.string(), before: z.number(), after: z.number() })) })
  .meta({ id: "SettingsWriteResponse" });
export type SettingsWriteResponse = z.infer<typeof SettingsWriteResponseSchema>;

/** Public (D62 7A) — les paramètres de prix lus par le wizard. */
export const PricingParamsResponseSchema = z
  .object({
    sizeCoef: z.object({ S: z.number(), M: z.number(), L: z.number() }),
    minBillableKg: z.number(),
    minTransportCents: z.number().int(),
    commissionPct: z.number(),
    commissionFloorCents: z.number().int(),
    protectionExtendedPremiumCents: z.number().int(),
    protectionExtendedCapCents: z.number().int(),
    weightTolerancePct: z.number(),
    referenceKg: z.number(),
    version: z.number().int(),
  })
  .meta({ id: "PricingParamsResponse", description: "Server pricing parameters (D62 7A) — the wizard quotes with the single engine and these values" });
export type PricingParamsResponse = z.infer<typeof PricingParamsResponseSchema>;
