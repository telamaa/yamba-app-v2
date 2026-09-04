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
