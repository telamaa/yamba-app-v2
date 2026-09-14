export function money(cents: number | null | undefined, currency = "EUR"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export const CATEGORY_LABEL: Record<string, string> = {
  NOT_DELIVERED: "Colis non livré",
  CONTENT_MISSING: "Contenu manquant",
  DAMAGED: "Colis endommagé",
  SIGNIFICANT_DELAY: "Retard important",
  RECIPIENT_ISSUE: "Problème destinataire",
  OTHER: "Autre",
};

/** Catégories du colis déclaré (ParcelCategory) — mêmes libellés que le site (messages/fr/booking.json). */
export const PARCEL_CATEGORY_LABEL: Record<string, string> = {
  CLOTHES: "Vêtements", SHOES: "Chaussures", FASHION_ACCESSORIES: "Accessoires de mode", OTHER_ACCESSORIES: "Autres accessoires",
  BOOKS: "Livres", DOCUMENTS: "Documents", SMALL_TOYS: "Petits jouets", PHONE: "Téléphone", COMPUTER: "Ordinateur",
  OTHER_ELECTRONICS: "Autre électronique", CHECKED_BAG_23KG: "Bagage en soute 23 kg", CABIN_BAG_12KG: "Bagage cabine 12 kg",
};

export const OUTCOME_LABEL: Record<string, string> = {
  FULL_REFUND: "Remboursement total",
  PARTIAL_REFUND: "Remboursement partiel",
  CONTACT_CARRIER: "Être mis en relation avec le Voyageur",
  YAMBA_DECIDES: "Laisser Yamba décider",
};

export const ACTION_LABEL: Record<string, string> = {
  SETTING_CHANGED: "Paramètre modifié",
  ACCOUNT_ERASED: "Compte effacé (RGPD)",
  MAINTENANCE_CHANGED: "État de maintenance modifié",
  EMAIL_SUPPRESSION_LIFTED: "Suppression d'adresse levée",
  DATA_REQUESTS_VIEWED: "Registre RGPD consulté",
  SETTINGS_RESET: "Paramètre réinitialisé",
  ADMIN_LOGIN: "Connexion admin",
  ADMIN_LOGOUT: "Déconnexion",
  ADMIN_TOTP_ENABLED: "2FA activée",
  ADMIN_BACKUP_CODE_USED: "Code de secours utilisé",
  DISPUTE_VIEWED: "Dossier consulté",
  DISPUTE_RESOLVED: "Litige tranché",
  RETENTION_ARBITRATED: "Retenue arbitrée",
  ADMIN_INVITED: "Admin invité",
  ADMIN_INVITE_ACCEPTED: "Invitation acceptée",
  ADMIN_ROLE_CHANGED: "Profil admin modifié",
  ADMIN_REVOKED: "Accès admin retiré",
  ADMIN_SESSION_REVOKED: "Session révoquée",
  USER_VIEWED: "Fiche consultée",
  USER_SUSPENSION_PROPOSED: "Suspension proposée",
  USER_SUSPENDED: "Compte suspendu",
  USER_RESTRICTED: "Compte restreint",
  USER_REINSTATED: "Compte rétabli",
  TRIP_VIEWED: "Trajet consulté",
  TRIP_HIDE_PROPOSED: "Masquage proposé",
  TRIP_HIDDEN: "Trajet masqué",
  TRIP_UNHIDDEN: "Trajet rétabli",
  DOCUMENT_VIEWED: "Document ouvert",
  TICKET_VERIFIED: "Billet vérifié",
  TICKET_REJECTED: "Billet rejeté",
  DEAL_MONEY_VIEWED: "Fiche argent consultée",
  DEAL_RECONCILED: "Rapprochement fournisseur", // § 5.13 : en local le fournisseur est Fake, pas Stripe
  PAYOUT_RETRIED: "Versement rejoué",
  PAYOUT_REVERSAL_RESOLVED: "Renversement clos",
  FINANCE_EXPORTED: "Export finances",
  REFUND_MANUAL_PROPOSED: "Remboursement manuel proposé",
  REFUND_MANUAL_APPLIED: "Remboursement manuel appliqué",
  DEAL_HISTORY_VIEWED: "Chronologie consultée",
  PILOTAGE_DRILLDOWN_VIEWED: "Liste d'inscriptions consultée (pilotage)",
  EXPORTED: "Export CSV",
  CONVERSATION_VIEWED: "Conversation consultée",
  MESSAGE_REPORT_REVIEWED: "Message signalé traité",
  REPORT_REVIEWED: "Signalement traité", // D68
};

/* F-PR3 (D61 7A) — messages signalés */
export const REPORT_REASON_LABEL: Record<string, string> = {
  OFF_PLATFORM: "Veut sortir de Yamba",
  SCAM: "Tentative d'arnaque",
  HARASSMENT: "Propos déplacés / harcèlement",
  OTHER: "Autre",
  // D68 — trajets et membres
  ILLEGAL_CONTENT: "Contenu illicite",
  INAPPROPRIATE: "Comportement inapproprié",
  IMPERSONATION: "Usurpation d'identité",
};
export const TRUST_LEVEL_LABEL: Record<string, string> = { NEW: "Compte neuf", STANDARD: "Standard", WATCH: "À surveiller", HIGH_RISK: "À risque" }; // D71
export const REPORT_TARGET_LABEL: Record<string, string> = { TRIP: "Trajet", USER: "Membre" };
export const REPORT_STATUS_LABEL: Record<string, string> = { OPEN: "à traiter", REVIEWED: "traité", DISMISSED: "sans suite" };
export const CHAT_ROLE_LABEL: Record<string, string> = { SHIPPER: "Expéditeur", CARRIER: "Voyageur", SYSTEM: "Système" };

/* C-PR5a (D58) */
export const PAYOUT_STATUS_LABEL: Record<string, string> = { PENDING: "en attente d'envoi", SENT: "envoyé", FAILED: "en échec", FROZEN: "gelé (litige)", REVERSED: "renversé" };
export const PAYOUT_FAILURE_LABEL: Record<string, string> = { ACCOUNT_NOT_READY: "compte Stripe du Voyageur non prêt", PROVIDER_ERROR: "refus du fournisseur", REVERSED: "transfert renversé par Stripe" };
export const TIMELINE_LABEL: Record<string, string> = {
  AUTHORIZED: "Empreinte posée (autorisation)", CAPTURED: "Débité (capture)", REFUNDED: "Remboursé à l'Expéditeur", DISPUTED: "Litige ouvert",
  COMPLETED: "Deal terminé", CANCELLED: "Deal annulé", PAYOUT_SENT: "Versement envoyé au Voyageur", PAYOUT_FAILED: "Versement en échec",
  PAYOUT_REVERSED: "Transfert renversé", REVERSAL_RESOLVED: "Renversement clos", RETENTION: "Retenue conservée", RETENTION_DECIDED: "Retenue arbitrée",
  AUTHORIZATION_RELEASED: "Empreinte libérée (jamais débitée)", // recette § 5.12
};
export const DIVERGENCE_LABEL: Record<string, string> = {
  CAPTURE_NOT_RECORDED: "Débit chez Stripe, non enregistré en base",
  CAPTURE_RECORDED_NOT_LIVE: "Débit enregistré, mais Stripe ne montre rien d'encaissé",
  REFUND_NOT_RECORDED: "Remboursement chez Stripe supérieur à la base (remboursement parti sans écriture)",
  REFUND_RECORDED_NOT_LIVE: "Remboursement en base absent ou échoué chez Stripe",
  TRANSFER_MISSING: "Transfert enregistré, introuvable chez Stripe",
  TRANSFER_AMOUNT_MISMATCH: "Montant du transfert différent du versement enregistré",
  TRANSFER_REVERSED_NOT_MARKED: "Transfert renversé chez Stripe, toujours « envoyé » en base",
  TRANSFER_MARKED_REVERSED_BUT_LIVE_OK: "Marqué renversé en base, pas de renversement chez Stripe",
  INTENT_NOT_FOUND: "Paiement introuvable chez le fournisseur",
};
/**
 * Recette § 5.13 — ce que veut dire chaque divergence et QUI agit. L'écran affichait sous le libellé le message
 * anglais du serveur ; l'administrateur y lit maintenant la conséquence et le geste, jamais une correction automatique.
 */
export const DIVERGENCE_HELP: Record<string, string> = {
  CAPTURE_NOT_RECORDED: "L'Expéditeur a été débité mais la base l'ignore : ne rien relancer, signaler au développement avec l'identifiant du deal.",
  CAPTURE_RECORDED_NOT_LIVE: "La base croit l'argent encaissé : aucun versement ni remboursement ne doit partir avant vérification dans le tableau de bord du fournisseur.",
  REFUND_NOT_RECORDED: "De l'argent est reparti sans trace en base (souvent un remboursement fait à la main dans le tableau de bord) : ne pas rembourser à nouveau.",
  REFUND_RECORDED_NOT_LIVE: "La base annonce un remboursement que le fournisseur ne montre pas : l'Expéditeur n'a peut-être rien reçu. Vérifier avant de lui répondre.",
  TRANSFER_MISSING: "Le versement est noté envoyé mais le transfert n'existe pas chez le fournisseur : le Voyageur n'a probablement rien reçu.",
  TRANSFER_AMOUNT_MISMATCH: "Le montant versé diffère du montant enregistré : comparer au prix figé avant tout geste.",
  TRANSFER_REVERSED_NOT_MARKED: "Le fournisseur a repris l'argent du Voyageur mais la base dit « envoyé » : le deal doit passer par la file « Transferts renversés ».",
  TRANSFER_MARKED_REVERSED_BUT_LIVE_OK: "La base croit le transfert renversé alors qu'il est intact : ne pas re-verser, l'argent est déjà chez le Voyageur.",
  INTENT_NOT_FOUND: "Le fournisseur ne connaît pas ce paiement (en local : deal du jeu d'essai, attendu). En production, signaler au développement.",
};
/** Statut d'un paiement chez le fournisseur (PaymentAuthorizationStatus). */
export const INTENT_STATUS_LABEL: Record<string, string> = {
  REQUIRES_PAYMENT_METHOD: "en attente de carte", PROCESSING: "en cours", AUTHORIZED: "empreinte posée", CAPTURED: "encaissé", CANCELED: "annulé", UNKNOWN: "état inconnu",
};
/** Statut d'un remboursement chez le fournisseur (Stripe `refund.status`). */
export const REFUND_STATUS_LABEL: Record<string, string> = { succeeded: "réussi", pending: "en cours", failed: "échoué", canceled: "annulé", requires_action: "action requise" };
/** Nom du fournisseur tel qu'on le dit à un administrateur. */
export const PROVIDER_LABEL: Record<string, string> = { STRIPE: "Stripe", FAKE: "le fournisseur de test (Fake)" };

export const TICKET_REASON_LABEL: Record<string, string> = {
  ILLEGIBLE: "Document illisible",
  DATES_MISMATCH: "Les dates ne correspondent pas au trajet",
  NAME_MISMATCH: "Le nom ne correspond pas au compte",
  SUSPICIOUS: "Document non recevable",
};
// ANO-ADM-16 — « expiré » : billet en attente d'un trajet déjà parti (le serveur le calcule, `effectiveTicketStatus`).
export const TICKET_STATUS_LABEL: Record<string, string> = { NOT_SUBMITTED: "aucun billet", PENDING: "à vérifier", VERIFIED: "vérifié", REJECTED: "rejeté", EXPIRED: "expiré (trajet parti)" };
/** Recette § 5.7 — statut et mode d'un trajet en français ; le code reste lisible au survol (`title`). */
/** Recette § 5.8 — types de documents d'un trajet, en français (le code reste lisible au survol). */
export const DOCUMENT_TYPE_LABEL: Record<string, string> = { TICKET_PROOF: "Billet", ITINERARY_PROOF: "Itinéraire", VEHICLE_PROOF: "Véhicule", IDENTITY_PROOF: "Pièce d'identité", OTHER: "Autre" };
/** Recette § 5.8 — le type de fichier d'un billet, lu avant de l'ouvrir (PDF, image). */
export const DOCUMENT_MIME_LABEL = (mime: string): string => (mime === "application/pdf" ? "PDF" : mime.startsWith("image/") ? `image ${mime.slice(6).toUpperCase()}` : mime);
export const TRIP_STATUS_LABEL: Record<string, string> = { DRAFT: "Brouillon", PUBLISHED: "Publié", PAUSED: "En pause", COMPLETED: "Terminé", CANCELLED: "Annulé", ARCHIVED: "Archivé" };
export const TRANSPORT_MODE_LABEL: Record<string, string> = { PLANE: "Avion", TRAIN: "Train", CAR: "Voiture" };
/** Statuts d'une réservation, tels que l'admin les lit (9 statuts de la machine D37/D39/D55). */
export const BOOKING_STATUS_LABEL: Record<string, string> = { PENDING: "En attente", ACCEPTED: "Acceptée", DECLINED: "Refusée", EXPIRED: "Expirée", CANCELLED: "Annulée", PICKED_UP: "Prise en charge", DELIVERED: "Livrée", COMPLETED: "Terminée", DISPUTED: "En litige" };

export const STATUS_LABEL: Record<string, string> = { ACTIVE: "Actif", RESTRICTED: "Restreint", SUSPENDED: "Suspendu" };

export const RESOLUTION_LABEL: Record<string, string> = {
  REJECTED: "Rejet : le Voyageur est payé en entier",
  PARTIAL_REFUND: "Remboursement partiel",
  FULL_REFUND: "Remboursement total : le Voyageur ne reçoit rien",
  COMPENSATE_CARRIER: "Compensation au Voyageur (prorata)",
  RESTITUTE_SHIPPER: "Restitution de la retenue à l'Expéditeur",
};

/** § 5.10 — la disposition d'une retenue d'annulation tardive, lisible (le code reste au survol et dans l'API). */
export const RETENTION_DISPOSITION_LABEL: Record<string, string> = {
  HELD_FOR_MEDIATION: "en attente d'arbitrage",
  CARRIER: "compensation versée au Voyageur",
  SHIPPER: "restituée à l'Expéditeur",
};

export function hoursUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000);
}

export const STEP_LABEL: Record<string, string> = {
  AT_AIRPORT: "À l'aéroport",
  FLIGHT_DEPARTED: "Vol parti",
  FLIGHT_ARRIVED: "Vol arrivé",
};

/* Recette § 5.12 — fiche argent en français : bilan, acteurs, modèle de prix, chronologie du deal. */
export const MONEY_PENDING_LABEL: Record<string, string> = {
  AUTHORIZATION_OPEN: "empreinte posée, en attente de la décision du Voyageur",
  DEAL_IN_PROGRESS: "deal en cours : le versement partira à la fin",
  PAYOUT_DUE: "versement dû, pas encore envoyé",
  PAYOUT_FROZEN: "versement gelé par le litige",
  PAYOUT_FAILED: "versement en échec",
  REVERSAL_OPEN: "transfert renversé, décision à prendre",
  RETENTION_HELD: "retenue à arbitrer",
  REFUND_PROPOSED: "remboursement proposé, à appliquer",
};
export const MONEY_ANOMALY_LABEL: Record<string, string> = {
  UNALLOCATED_FUNDS: "Argent sans destination : le deal est clos, rien n'est en attente, et la plateforme détient plus que sa commission.",
  OVERSPENT: "La plateforme a versé et remboursé plus qu'elle n'a reçu, sans geste commercial qui l'explique.",
};
export const ACTOR_LABEL: Record<string, string> = { SHIPPER: "par l'Expéditeur", CARRIER: "par le Voyageur", SYSTEM: "automatique", ADMIN: "par un admin" };
export const PRICING_MODEL_LABEL: Record<string, string> = { PER_CATEGORY: "au colis (catégorie)", PER_KG: "au kilo" };
export const HISTORY_STATUS_LABEL: Record<string, string> = { PUBLISHED: "publié", PENDING: "en attente", PARKED: "parqué", READ: "lue", UNREAD: "non lue", SENT: "envoyé", DELIVERED: "remis", FAILED: "en échec", BOUNCED: "rebond", COMPLAINED: "plainte" };
/** Le détail d'une ligne de chronologie de l'argent, lisible : acteur, issue de retenue, nature d'échec, décision de renversement. */
export function timelineDetailLabel(detail: string | null): string | null {
  if (!detail) return null;
  return ACTOR_LABEL[detail] ?? RETENTION_DISPOSITION_LABEL[detail] ?? PAYOUT_FAILURE_LABEL[detail] ?? (detail === "RESENT" ? "re-versé" : detail === "WRITTEN_OFF" ? "abandonné" : detail);
}
const AFTER_KEY_LABEL: Record<string, string> = { amountCents: "montant", totalRefundedCents: "cumul remboursé", refundedCents: "remboursé", reason: "motif", outcome: "issue", divergences: "divergences", provider: "fournisseur", payoutStatus: "versement", refundId: "remboursement", transferId: "transfert", providerError: "échec" };
/** § 5.13 — valeurs codées du journal qui ont un libellé. */
const AFTER_VALUE_LABEL: Record<string, string> = { PROVIDER_UNAVAILABLE: "fournisseur injoignable, rien comparé" };
/** Le « after » d'une action admin en une ligne lisible (montants en euros, codes traduits) ; une clé inconnue garde son nom. */
export function adminAfterSummary(after: unknown, currency = "EUR"): string | null {
  if (!after || typeof after !== "object") return null;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(after as Record<string, unknown>)) {
    if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) continue;
    const label = AFTER_KEY_LABEL[k] ?? k;
    const value = /Cents$/.test(k) && typeof v === "number" ? money(v, currency) : k === "outcome" && typeof v === "string" ? (RESOLUTION_LABEL[v] ?? v) : k === "payoutStatus" && typeof v === "string" ? (PAYOUT_STATUS_LABEL[v] ?? v) : Array.isArray(v) ? v.map((x) => DIVERGENCE_LABEL[String(x)] ?? String(x)).join(", ") : (AFTER_VALUE_LABEL[String(v)] ?? String(v));
    parts.push(`${label} : ${value}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
