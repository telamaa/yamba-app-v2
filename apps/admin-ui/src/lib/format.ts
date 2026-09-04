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

export const OUTCOME_LABEL: Record<string, string> = {
  FULL_REFUND: "Remboursement total",
  PARTIAL_REFUND: "Remboursement partiel",
  CONTACT_CARRIER: "Être mis en relation avec le Voyageur",
  YAMBA_DECIDES: "Laisser Yamba décider",
};

export const ACTION_LABEL: Record<string, string> = {
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
  DEAL_RECONCILED: "Rapprochement Stripe",
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
};

/* F-PR3 (D61 7A) — messages signalés */
export const REPORT_REASON_LABEL: Record<string, string> = {
  OFF_PLATFORM: "Veut sortir de Yamba",
  SCAM: "Tentative d'arnaque",
  HARASSMENT: "Propos déplacés / harcèlement",
  OTHER: "Autre",
};
export const REPORT_STATUS_LABEL: Record<string, string> = { OPEN: "à traiter", REVIEWED: "traité", DISMISSED: "sans suite" };
export const CHAT_ROLE_LABEL: Record<string, string> = { SHIPPER: "Expéditeur", CARRIER: "Voyageur", SYSTEM: "Système" };

/* C-PR5a (D58) */
export const PAYOUT_STATUS_LABEL: Record<string, string> = { PENDING: "en attente d'envoi", SENT: "envoyé", FAILED: "en échec", FROZEN: "gelé (litige)", REVERSED: "renversé" };
export const PAYOUT_FAILURE_LABEL: Record<string, string> = { ACCOUNT_NOT_READY: "compte Stripe du Voyageur non prêt", PROVIDER_ERROR: "refus du fournisseur", REVERSED: "transfert renversé par Stripe" };
export const TIMELINE_LABEL: Record<string, string> = {
  AUTHORIZED: "Empreinte posée (autorisation)", CAPTURED: "Débité (capture)", REFUNDED: "Remboursé à l'Expéditeur", DISPUTED: "Litige ouvert",
  COMPLETED: "Deal terminé", CANCELLED: "Deal annulé", PAYOUT_SENT: "Versement envoyé au Voyageur", PAYOUT_FAILED: "Versement en échec",
  PAYOUT_REVERSED: "Transfert renversé", REVERSAL_RESOLVED: "Renversement clos", RETENTION: "Retenue conservée", RETENTION_DECIDED: "Retenue arbitrée",
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

export const TICKET_REASON_LABEL: Record<string, string> = {
  ILLEGIBLE: "Document illisible",
  DATES_MISMATCH: "Les dates ne correspondent pas au trajet",
  NAME_MISMATCH: "Le nom ne correspond pas au compte",
  SUSPICIOUS: "Document non recevable",
};
export const TICKET_STATUS_LABEL: Record<string, string> = { NOT_SUBMITTED: "aucun billet", PENDING: "à vérifier", VERIFIED: "vérifié", REJECTED: "rejeté" };

export const STATUS_LABEL: Record<string, string> = { ACTIVE: "Actif", RESTRICTED: "Restreint", SUSPENDED: "Suspendu" };

export const RESOLUTION_LABEL: Record<string, string> = {
  REJECTED: "Rejet : le Voyageur est payé en entier",
  PARTIAL_REFUND: "Remboursement partiel",
  FULL_REFUND: "Remboursement total : le Voyageur ne reçoit rien",
  COMPENSATE_CARRIER: "Compensation au Voyageur (prorata)",
  RESTITUTE_SHIPPER: "Restitution de la retenue à l'Expéditeur",
};

export function hoursUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000);
}

export const STEP_LABEL: Record<string, string> = {
  AT_AIRPORT: "À l'aéroport",
  FLIGHT_DEPARTED: "Vol parti",
  FLIGHT_ARRIVED: "Vol arrivé",
};
