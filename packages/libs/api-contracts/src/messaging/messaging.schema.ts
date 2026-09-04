/**
 * messaging.schema.ts — coordination Expéditeur ↔ Voyageur (chantier F, D61)
 * ==========================================================================
 * Une conversation par deal, ouverte à l'acceptation. Le RENDEZ-VOUS est un objet
 * (proposé / accepté), pas une suite de messages ; le fil sert au reste.
 */
import { z } from "zod";
import { ObjectIdSchema } from "../common";

export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_MAX_PHOTOS = 5;
export const CONVERSATION_WRITE_DAYS_AFTER_END = 14;
export const PHONE_REVEAL_LEAD_HOURS = 2;

export const MessageKindSchema = z.enum(["TEXT", "SYSTEM", "MEETUP"]).meta({ id: "MessageKind" });
export type MessageKind = z.infer<typeof MessageKindSchema>;
export const MessageAuthorRoleSchema = z.enum(["SHIPPER", "CARRIER", "SYSTEM"]).meta({ id: "MessageAuthorRole" });
export const MeetupKindSchema = z.enum(["PICKUP", "DELIVERY"]).meta({ id: "MeetupKind" });
export type MeetupKind = z.infer<typeof MeetupKindSchema>;
export const MeetupStatusSchema = z.enum(["PROPOSED", "ACCEPTED", "CANCELLED"]).meta({ id: "MeetupStatus" });
export type MeetupStatus = z.infer<typeof MeetupStatusSchema>;

export const MessageSchema = z
  .object({
    id: ObjectIdSchema,
    kind: MessageKindSchema,
    authorRole: MessageAuthorRoleSchema,
    authorId: ObjectIdSchema.nullable(),
    body: z.string().describe("Texte de l'auteur, ou libellé de repli d'un message système"),
    photoUrls: z.array(z.string()),
    systemKey: z.string().nullable().describe("Clé i18n d'un message SYSTEM / MEETUP — le client affiche sa propre copie"),
    systemData: z.record(z.string(), z.unknown()).nullable(),
    flaggedContact: z.boolean().describe("D61 5A — coordonnées détectées : averti, jamais bloqué"),
    createdAt: z.string().datetime(),
  })
  .meta({ id: "Message" });
export type Message = z.infer<typeof MessageSchema>;

export const MeetupSchema = z
  .object({
    id: ObjectIdSchema,
    kind: MeetupKindSchema,
    status: MeetupStatusSchema,
    proposedByRole: z.enum(["SHIPPER", "CARRIER"]),
    placeLabel: z.string(),
    placeDetails: z.string().nullable(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    acceptedAt: z.string().datetime().nullable(),
    cancelledAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .meta({ id: "Meetup" });
export type Meetup = z.infer<typeof MeetupSchema>;

export const ConversationAccessSchema = z
  .object({
    canRead: z.boolean(),
    canWrite: z.boolean(),
    reason: z.string().nullable().describe("Pourquoi l'écriture est fermée (clé stable, traduite par le client)"),
    writeClosesAt: z.string().datetime().nullable(),
  })
  .meta({ id: "ConversationAccess" });
export type ConversationAccess = z.infer<typeof ConversationAccessSchema>;

export const ConversationSummarySchema = z
  .object({
    id: ObjectIdSchema,
    bookingId: ObjectIdSchema,
    role: z.enum(["SHIPPER", "CARRIER"]).describe("Le rôle de CELUI qui lit"),
    counterpart: z.object({ id: ObjectIdSchema, firstName: z.string(), avatarUrl: z.string().nullable() }),
    corridor: z.object({ originCity: z.string(), destinationCity: z.string(), departureAt: z.string().datetime().nullable() }),
    bookingStatus: z.string(),
    lastMessage: z.object({ body: z.string(), authorRole: MessageAuthorRoleSchema, createdAt: z.string().datetime() }).nullable(),
    unreadCount: z.number().int(),
    nextMeetup: MeetupSchema.nullable(),
    access: ConversationAccessSchema,
  })
  .meta({ id: "ConversationSummary" });
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export const ConversationListResponseSchema = z
  .object({ items: z.array(ConversationSummarySchema), totalUnread: z.number().int() })
  .meta({ id: "ConversationListResponse" });
export type ConversationListResponse = z.infer<typeof ConversationListResponseSchema>;

export const ConversationThreadResponseSchema = z
  .object({
    conversation: ConversationSummarySchema,
    messages: z.array(MessageSchema).describe("Du plus ancien au plus récent"),
    meetups: z.array(MeetupSchema),
    nextCursor: ObjectIdSchema.nullable().describe("Messages plus ANCIENS à charger"),
    phone: z.object({ revealed: z.boolean(), phoneE164: z.string().nullable(), opensAt: z.string().datetime().nullable() }).describe("D61 4A — révélé au plus tôt 2 h avant le rendez-vous"),
  })
  .meta({ id: "ConversationThreadResponse" });
export type ConversationThreadResponse = z.infer<typeof ConversationThreadResponseSchema>;

export const PostMessageRequestSchema = z
  .object({
    body: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
    photoUrls: z.array(z.string().url()).max(MESSAGE_MAX_PHOTOS).optional(),
  })
  .meta({ id: "PostMessageRequest" });
export type PostMessageRequest = z.infer<typeof PostMessageRequestSchema>;

export const ProposeMeetupRequestSchema = z
  .object({
    kind: MeetupKindSchema,
    placeLabel: z.string().trim().min(3).max(160),
    placeDetails: z.string().trim().max(500).optional(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  })
  .meta({ id: "ProposeMeetupRequest", description: "Proposition de rendez-vous ; une contre-proposition remplace la précédente" });
export type ProposeMeetupRequest = z.infer<typeof ProposeMeetupRequestSchema>;

export const QuickReplySchema = z
  .object({ key: z.string(), kind: MeetupKindSchema.nullable(), text: z.string() })
  .meta({ id: "QuickReply", description: "D61 2A — réponses rapides traduites, servies dans la langue du lecteur" });
export type QuickReply = z.infer<typeof QuickReplySchema>;
export const QuickRepliesResponseSchema = z.object({ items: z.array(QuickReplySchema) }).meta({ id: "QuickRepliesResponse" });
export type QuickRepliesResponse = z.infer<typeof QuickRepliesResponseSchema>;

export const RevealPhoneResponseSchema = z
  .object({ phoneE164: z.string().nullable(), firstName: z.string(), revealedAt: z.string().datetime() })
  .meta({ id: "RevealPhoneResponse" });
export type RevealPhoneResponse = z.infer<typeof RevealPhoneResponseSchema>;
