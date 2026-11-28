/**
 * messaging.types.ts — miroir des contrats du message-service (chantier F, D61)
 * =============================================================================
 * Le serveur est la seule source de vérité : ces types recopient `@packages/api-contracts`
 * (messaging.schema) sans rien recalculer. Le front n'invente aucune règle : il affiche
 * `access` (peut écrire ou non) et `phone.opensAt` tels qu'ils arrivent.
 */
export type MessageKind = "TEXT" | "SYSTEM" | "MEETUP";
export type MessageAuthorRole = "SHIPPER" | "CARRIER" | "SYSTEM";
export type MeetupKind = "PICKUP" | "DELIVERY";
export type MeetupStatus = "PROPOSED" | "ACCEPTED" | "CANCELLED";

export type ChatMessage = {
  id: string;
  kind: MessageKind;
  authorRole: MessageAuthorRole;
  authorId: string | null;
  body: string;
  photoUrls: string[];
  systemKey: string | null;
  systemData: Record<string, unknown> | null;
  flaggedContact: boolean;
  createdAt: string;
};

export type Meetup = {
  id: string;
  kind: MeetupKind;
  status: MeetupStatus;
  proposedByRole: "SHIPPER" | "CARRIER";
  placeLabel: string;
  placeDetails: string | null;
  startAt: string;
  endAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

export type ConversationAccess = {
  canRead: boolean;
  canWrite: boolean;
  /** Clé stable : NOT_ACCEPTED_YET | DISPUTE_OPEN | WRITE_WINDOW_OVER | DEAL_CLOSED */
  reason: string | null;
  writeClosesAt: string | null;
};

export type ConversationSummary = {
  /**
   * D124 — NULL tant que le fil n'a jamais été ouvert : un fil existe dès que
   * le deal est engagé, sa ligne en base n'est écrite qu'à la première
   * ouverture. L'adresse d'un fil, c'est `bookingId`.
   */
  id: string | null;
  bookingId: string;
  role: "SHIPPER" | "CARRIER";
  counterpart: { id: string; firstName: string; avatarUrl: string | null };
  corridor: { originCity: string; destinationCity: string; departureAt: string | null };
  bookingStatus: string;
  lastMessage: { body: string; authorRole: MessageAuthorRole; createdAt: string } | null;
  unreadCount: number;
  nextMeetup: Meetup | null;
  access: ConversationAccess;
};

export type ConversationList = { items: ConversationSummary[]; totalUnread: number };

export type ConversationThread = {
  conversation: ConversationSummary;
  messages: ChatMessage[];
  meetups: Meetup[];
  nextCursor: string | null;
  phone: { revealed: boolean; phoneE164: string | null; opensAt: string | null };
};

export type QuickReply = { key: string; kind: MeetupKind | null; text: string };
