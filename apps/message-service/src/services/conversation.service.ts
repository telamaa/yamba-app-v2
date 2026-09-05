/**
 * conversation.service.ts — le fil, les rendez-vous, le numéro (chantier F, D61)
 * ==============================================================================
 * Le message-service POSSÈDE Conversation, Message, Meetup et PhoneReveal. Il LIT le Booking,
 * le Trip et le User (base partagée, lectures croisées autorisées) et n'écrit jamais dans le
 * domaine d'un autre service (D54 2A).
 *
 * Invariants tenus ici :
 *  - une conversation par deal, créée à la demande dès que le deal est engagé (D61 2A) ;
 *  - un tiers n'accède à rien (403 explicite, jamais un 404 : le deal existe) ;
 *  - le code de livraison ne voyage jamais (D43 / D61 4A) : un message qui le contient est refusé ;
 *  - aucun changement d'état sans événement outbox dans la MÊME transaction (D2).
 */
import bcrypt from "bcryptjs";
import prisma from "@packages/libs/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@packages/error-handler";
import {
  MessagingDomainEventSchema,
  type ConversationListResponse,
  type ConversationSummary,
  type ConversationThreadResponse,
  type Meetup as MeetupDto,
  type Message as MessageDto,
  type MessagingDomainEvent,
  type PostMessageRequest,
  type ProposeMeetupRequest,
  type ReportMessageRequest,
  type ReportMessageResponse,
  type RevealPhoneResponse,
} from "@packages/api-contracts";
import { conversationAccess, conversationExists, counterpartIdOf, roleOf } from "../lib/conversation.rules";
import { detectContactInfo, normalizeBody, sixDigitCandidates } from "../lib/message-guard.rules";
import { canAcceptMeetup, nextMeetupOf, validateMeetupSlot } from "../lib/meetup.rules";
import { phoneRevealWindow } from "../lib/phone-reveal.rules";
import { canReportMessage } from "../lib/message-report.rules";

export const MESSAGES_PAGE_SIZE = 50;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Sous-ensemble du Booking dont le fil a besoin (lecture seule). */
const BOOKING_SELECT = {
  id: true,
  status: true,
  shipperId: true,
  carrierId: true,
  acceptedAt: true,
  completedAt: true,
  closedAt: true,
  deliveryCodeHash: true,
  trip: true,
} as const;

type BookingRow = {
  id: string;
  status: string;
  shipperId: string;
  carrierId: string;
  acceptedAt: Date | null;
  completedAt?: Date | null;
  closedAt?: Date | null;
  deliveryCodeHash: string | null;
  trip: { originCity: string; destinationCity: string; departureAt: Date };
};

type MeetupRow = {
  id: string;
  kind: string;
  status: string;
  proposedByRole: string;
  placeLabel: string;
  placeDetails: string | null;
  startAt: Date;
  endAt: Date;
  acceptedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
};

function toMeetupDto(m: MeetupRow): MeetupDto {
  return {
    id: m.id,
    kind: m.kind as MeetupDto["kind"],
    status: m.status as MeetupDto["status"],
    proposedByRole: m.proposedByRole as "SHIPPER" | "CARRIER",
    placeLabel: m.placeLabel,
    placeDetails: m.placeDetails,
    startAt: m.startAt.toISOString(),
    endAt: m.endAt.toISOString(),
    acceptedAt: iso(m.acceptedAt),
    cancelledAt: iso(m.cancelledAt),
    createdAt: m.createdAt.toISOString(),
  };
}

function toMessageDto(m: {
  id: string;
  kind: string;
  authorRole: string;
  authorId: string | null;
  body: string;
  photoUrls: string[];
  systemKey: string | null;
  systemData: unknown;
  flaggedContact: boolean;
  createdAt: Date;
}): MessageDto {
  return {
    id: m.id,
    kind: m.kind as MessageDto["kind"],
    authorRole: m.authorRole as MessageDto["authorRole"],
    authorId: m.authorId,
    body: m.body,
    photoUrls: m.photoUrls ?? [],
    systemKey: m.systemKey,
    systemData: (m.systemData as Record<string, unknown> | null) ?? null,
    flaggedContact: m.flaggedContact,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Enveloppe d'événement (D2) : validée au contrat AVANT écriture, comme le deal-service. */
function envelopeFor(conversationId: string, now: Date) {
  return { aggregateType: "conversation" as const, aggregateId: conversationId, occurredAt: now.toISOString(), correlationId: null, schemaVersion: 1 as const };
}

export function makeConversationService(clock: () => Date = () => new Date()) {
  /** Charge le deal, la conversation (créée à la demande) et le rôle de l'appelant. */
  async function loadContext(userId: string, by: { bookingId?: string; conversationId?: string }) {
    let bookingId = by.bookingId ?? null;
    let conversation = null as null | { id: string; bookingId: string; shipperLastReadAt: Date | null; carrierLastReadAt: Date | null };
    if (by.conversationId) {
      conversation = await prisma.conversation.findUnique({ where: { id: by.conversationId }, select: { id: true, bookingId: true, shipperLastReadAt: true, carrierLastReadAt: true } });
      if (!conversation) throw new NotFoundError("Conversation not found.");
      bookingId = conversation.bookingId;
    }
    if (!bookingId) throw new ValidationError("A deal id or a conversation id is required.");

    const booking = (await prisma.booking.findFirst({ where: { id: bookingId, isDeleted: false }, select: BOOKING_SELECT })) as BookingRow | null;
    if (!booking) throw new NotFoundError("Deal not found.");
    const role = roleOf(userId, booking);
    // 403 et non 404 : le deal existe, l'appelant n'est pas partie (semantique D-existant).
    if (!role) throw new ForbiddenError("You are not a party to this deal.");
    if (!conversationExists(booking)) throw new ForbiddenError("This deal has no conversation yet.");

    if (!conversation) {
      conversation =
        (await prisma.conversation.findUnique({ where: { bookingId }, select: { id: true, bookingId: true, shipperLastReadAt: true, carrierLastReadAt: true } })) ??
        (await prisma.conversation.create({
          data: { bookingId, shipperId: booking.shipperId, carrierId: booking.carrierId, lastMessageAt: null, lastMessageAuthorRole: null, shipperRemindedAt: null, carrierRemindedAt: null },
          select: { id: true, bookingId: true, shipperLastReadAt: true, carrierLastReadAt: true },
        }));
    }
    return { booking, conversation, role, access: conversationAccess(booking, clock()) };
  }

  /**
   * Écrit un message + son événement dans UNE transaction (D2). L'événement est construit
   * APRÈS la création (il porte l'identifiant réel du message) puis validé au contrat avant
   * écriture : un payload invalide est un bug de writer, jamais un poison pour le relais (A24).
   */
  async function writeMessage(
    conversationId: string,
    data: { kind: "TEXT" | "SYSTEM" | "MEETUP"; authorId: string | null; authorRole: string; body: string; photoUrls?: string[]; systemKey?: string | null; systemData?: Record<string, unknown> | null; flaggedContact?: boolean },
    buildEvent: ((messageId: string) => MessagingDomainEvent) | null,
    now: Date
  ): Promise<{ id: string }> {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId,
          kind: data.kind as never,
          authorId: data.authorId,
          authorRole: data.authorRole,
          body: data.body,
          // Pitfall Mongo : une liste ABSENTE n'est matchee par aucun filtre — toujours poser [].
          photoUrls: data.photoUrls ?? [],
          systemKey: data.systemKey ?? null,
          systemData: (data.systemData ?? null) as never,
          flaggedContact: data.flaggedContact ?? false,
        },
        select: { id: true },
      });
      // F-PR3 (D61 6A) — l'auteur du dernier message décide QUI reçoit la relance email.
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now, lastMessageAuthorRole: data.authorRole } });
      if (buildEvent) {
        const parsed = MessagingDomainEventSchema.parse(buildEvent(message.id));
        await tx.outboxEvent.create({
          data: { aggregateType: parsed.aggregateType, aggregateId: parsed.aggregateId, eventType: parsed.eventType, payload: parsed as never, correlationId: null, occurredAt: now, publishedAt: null, attempts: 0 },
        });
      }
      return message;
    });
  }

  function eventBase(booking: BookingRow, conversationId: string, actorRole: "SHIPPER" | "CARRIER" | "SYSTEM", actorId: string | null) {
    return {
      conversationId,
      bookingId: booking.id,
      shipperId: booking.shipperId,
      carrierId: booking.carrierId,
      actorRole,
      actorId,
      recipientId: actorRole === "SHIPPER" ? booking.carrierId : booking.shipperId,
      corridor: { originCity: booking.trip.originCity, destinationCity: booking.trip.destinationCity },
    };
  }

  return {
    /** Mes conversations, la plus active d'abord, avec les non-lus et le prochain rendez-vous. */
    async list(userId: string): Promise<ConversationListResponse> {
      const now = clock();
      const rows = await prisma.conversation.findMany({
        where: { OR: [{ shipperId: userId }, { carrierId: userId }] },
        orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
        take: 100,
      });
      if (rows.length === 0) return { items: [], totalUnread: 0 };
      const bookings = (await prisma.booking.findMany({ where: { id: { in: rows.map((r) => r.bookingId) } }, select: BOOKING_SELECT })) as unknown as BookingRow[];
      const bookingBy = new Map(bookings.map((b) => [b.id, b]));
      const counterpartIds = rows.map((r) => (r.shipperId === userId ? r.carrierId : r.shipperId));
      const [users, meetups, lastMessages] = await Promise.all([
        prisma.user.findMany({ where: { id: { in: [...new Set(counterpartIds)] } }, select: { id: true, firstName: true, avatar: { select: { url: true } } } }),
        prisma.meetup.findMany({ where: { conversationId: { in: rows.map((r) => r.id) }, status: { in: ["PROPOSED", "ACCEPTED"] } } }),
        prisma.message.findMany({ where: { conversationId: { in: rows.map((r) => r.id) } }, orderBy: { createdAt: "desc" }, take: 200, select: { conversationId: true, body: true, authorRole: true, createdAt: true } }),
      ]);
      const userBy = new Map(users.map((u) => [u.id, u]));
      const lastBy = new Map<string, (typeof lastMessages)[number]>();
      for (const m of lastMessages) if (!lastBy.has(m.conversationId)) lastBy.set(m.conversationId, m);
      const unreadCounts = await Promise.all(
        rows.map((r) => {
          const since = r.shipperId === userId ? r.shipperLastReadAt : r.carrierLastReadAt;
          return prisma.message.count({
            where: { conversationId: r.id, authorRole: { not: r.shipperId === userId ? "SHIPPER" : "CARRIER" }, ...(since ? { createdAt: { gt: since } } : {}) },
          });
        })
      );

      const items: ConversationSummary[] = [];
      rows.forEach((r, i) => {
        const booking = bookingBy.get(r.bookingId);
        if (!booking) return;
        const role = r.shipperId === userId ? "SHIPPER" : "CARRIER";
        const counterpart = userBy.get(role === "SHIPPER" ? r.carrierId : r.shipperId);
        const last = lastBy.get(r.id);
        const mine = meetups.filter((m) => m.conversationId === r.id) as unknown as MeetupRow[];
        const next = nextMeetupOf(mine, now);
        items.push({
          id: r.id,
          bookingId: r.bookingId,
          role,
          counterpart: { id: counterpart?.id ?? "", firstName: counterpart?.firstName ?? "—", avatarUrl: counterpart?.avatar?.url ?? null },
          corridor: { originCity: booking.trip.originCity, destinationCity: booking.trip.destinationCity, departureAt: iso(booking.trip.departureAt) },
          bookingStatus: booking.status,
          lastMessage: last ? { body: last.body.slice(0, 140), authorRole: last.authorRole as MessageDto["authorRole"], createdAt: last.createdAt.toISOString() } : null,
          unreadCount: unreadCounts[i],
          nextMeetup: next ? toMeetupDto(next) : null,
          access: conversationAccess(booking, now),
        });
      });
      return { items, totalUnread: items.reduce((a, i) => a + i.unreadCount, 0) };
    },

    /** Le fil : messages du plus ancien au plus récent, rendez-vous, état du numéro. */
    async thread(userId: string, conversationId: string, cursor?: string): Promise<ConversationThreadResponse> {
      const now = clock();
      const { booking, conversation, role, access } = await loadContext(userId, { conversationId });
      const [rawMessages, meetupRows, counterpart, reveal] = await Promise.all([
        prisma.message.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: "desc" },
          take: MESSAGES_PAGE_SIZE + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
        prisma.meetup.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "desc" } }),
        prisma.user.findUnique({ where: { id: counterpartIdOf(role, booking) }, select: { id: true, firstName: true, phoneE164: true, avatar: { select: { url: true } } } }),
        prisma.phoneReveal.findUnique({ where: { conversationId_revealedToId: { conversationId: conversation.id, revealedToId: userId } } }),
      ]);
      const hasMore = rawMessages.length > MESSAGES_PAGE_SIZE;
      const page = hasMore ? rawMessages.slice(0, MESSAGES_PAGE_SIZE) : rawMessages;
      const meetups = meetupRows as unknown as MeetupRow[];
      const acceptedPickup = meetups.find((m) => m.kind === "PICKUP" && m.status === "ACCEPTED") ?? null;
      const window = phoneRevealWindow({ pickupStartAt: acceptedPickup?.startAt ?? null, departureAt: booking.trip.departureAt }, now);
      const next = nextMeetupOf(meetups, now);

      return {
        conversation: {
          id: conversation.id,
          bookingId: booking.id,
          role,
          counterpart: { id: counterpart?.id ?? "", firstName: counterpart?.firstName ?? "—", avatarUrl: counterpart?.avatar?.url ?? null },
          corridor: { originCity: booking.trip.originCity, destinationCity: booking.trip.destinationCity, departureAt: iso(booking.trip.departureAt) },
          bookingStatus: booking.status,
          lastMessage: null,
          unreadCount: 0,
          nextMeetup: next ? toMeetupDto(next) : null,
          access,
        },
        messages: page.reverse().map(toMessageDto),
        meetups: meetups.map(toMeetupDto),
        nextCursor: hasMore ? page[0].id : null,
        phone: { revealed: !!reveal, phoneE164: reveal ? counterpart?.phoneE164 ?? null : null, opensAt: iso(window.opensAt) },
      };
    },

    /** Le fil d'un deal : la conversation est créée à la demande au premier accès (D61 2A). */
    async threadByDeal(userId: string, bookingId: string): Promise<ConversationThreadResponse> {
      const { conversation } = await loadContext(userId, { bookingId });
      return this.thread(userId, conversation.id);
    },

    /**
     * Signaler un message de l'autre partie (D61 7A). Un enregistrement de modération, pas une
     * transition du fil : pas d'événement outbox (A140), le support le voit dans sa file et sur l'accueil.
     */
    async reportMessage(userId: string, conversationId: string, messageId: string, input: ReportMessageRequest): Promise<ReportMessageResponse> {
      const { conversation, role } = await loadContext(userId, { conversationId });
      const message = await prisma.message.findFirst({ where: { id: messageId, conversationId: conversation.id }, select: { id: true, kind: true, authorRole: true } });
      if (!message) throw new NotFoundError("Message not found.");
      const existing = await prisma.report.findFirst({ where: { targetType: "MESSAGE", targetId: message.id, reporterUserId: userId }, select: { id: true } });
      const verdict = canReportMessage(role, message, !!existing);
      if (!verdict.allowed) {
        if (verdict.reason === "ALREADY_REPORTED") throw new ConflictError("You already reported this message.");
        throw new ValidationError(verdict.reason === "OWN_MESSAGE" ? "You cannot report your own message." : "Only text messages can be reported.", { code: verdict.reason });
      }
      const report = await prisma.report.create({
        data: { reporterUserId: userId, targetType: "MESSAGE", targetId: message.id, reason: input.reason, details: input.details?.trim() || null, status: "OPEN" },
        select: { id: true, createdAt: true },
      });
      return { reportId: report.id, createdAt: report.createdAt.toISOString() };
    },

    /** Marque le fil comme lu jusqu'à maintenant. */
    async markRead(userId: string, conversationId: string): Promise<{ readAt: string }> {
      const now = clock();
      const { conversation, role } = await loadContext(userId, { conversationId });
      await prisma.conversation.update({ where: { id: conversation.id }, data: role === "SHIPPER" ? { shipperLastReadAt: now } : { carrierLastReadAt: now } });
      return { readAt: now.toISOString() };
    },

    /** Poster un message : gardes du code de livraison et des coordonnées, puis transaction + outbox. */
    async postMessage(userId: string, conversationId: string, input: PostMessageRequest): Promise<MessageDto> {
      const now = clock();
      const { booking, conversation, role, access } = await loadContext(userId, { conversationId });
      if (!access.canWrite) throw new ValidationError(`This conversation is read-only (${access.reason}).`);
      const body = normalizeBody(input.body);
      if (!body) throw new ValidationError("The message is empty.");

      // D43 / D61 4A — le code de livraison ne voyage JAMAIS : on compare les groupes de six chiffres au hash.
      if (booking.deliveryCodeHash) {
        for (const candidate of sixDigitCandidates(body)) {
          if (await bcrypt.compare(candidate, booking.deliveryCodeHash)) {
            throw new ValidationError("This message contains the delivery code. Give it in person, never in writing.", { code: "DELIVERY_CODE_IN_MESSAGE" });
          }
        }
      }
      const contact = detectContactInfo(body);
      const created = await writeMessage(
        conversation.id,
        { kind: "TEXT", authorId: userId, authorRole: role, body, photoUrls: input.photoUrls ?? [], flaggedContact: contact.flagged },
        (messageId) =>
          ({
            ...envelopeFor(conversation.id, now),
            eventType: "conversation.message_posted",
            payload: { ...eventBase(booking, conversation.id, role, userId), messageId, preview: body.slice(0, 140) },
          }) as MessagingDomainEvent,
        now
      );
      const message = await prisma.message.findUniqueOrThrow({ where: { id: created.id } });
      return toMessageDto(message as never);
    },

    /** Proposer un rendez-vous : la proposition ouverte du même type est remplacée (contre-proposition). */
    async proposeMeetup(userId: string, conversationId: string, input: ProposeMeetupRequest): Promise<MeetupDto> {
      const now = clock();
      const { booking, conversation, role, access } = await loadContext(userId, { conversationId });
      if (!access.canWrite) throw new ValidationError(`This conversation is read-only (${access.reason}).`);
      const slot = { startAt: new Date(input.startAt), endAt: new Date(input.endAt) };
      const check = validateMeetupSlot(slot, now);
      if (!check.ok) throw new ValidationError(`Invalid meeting slot (${check.reason}).`);

      // Une seule proposition ouverte par type : la nouvelle remplace la precedente.
      await prisma.meetup.updateMany({ where: { conversationId: conversation.id, kind: input.kind as never, status: "PROPOSED" }, data: { status: "CANCELLED", cancelledAt: now } });
      const meetup = await prisma.meetup.create({
        data: {
          conversationId: conversation.id,
          bookingId: booking.id,
          kind: input.kind as never,
          proposedByRole: role,
          proposedById: userId,
          placeLabel: input.placeLabel,
          placeDetails: input.placeDetails ?? null,
          startAt: slot.startAt,
          endAt: slot.endAt,
        },
      });
      await writeMessage(
        conversation.id,
        { kind: "MEETUP", authorId: userId, authorRole: role, body: input.placeLabel, systemKey: "meetup.proposed", systemData: { meetupId: meetup.id, kind: input.kind, placeLabel: input.placeLabel, startAt: slot.startAt.toISOString(), endAt: slot.endAt.toISOString() } },
        () =>
          ({
            ...envelopeFor(conversation.id, now),
            eventType: "conversation.meetup_proposed",
            payload: { ...eventBase(booking, conversation.id, role, userId), meetupId: meetup.id, kind: input.kind, placeLabel: input.placeLabel, startAt: slot.startAt.toISOString() },
          }) as MessagingDomainEvent,
        now
      );
      return toMeetupDto(meetup as unknown as MeetupRow);
    },

    /** Accepter : réservé à l'autre partie, verrou optimiste sur le statut PROPOSED. */
    async acceptMeetup(userId: string, conversationId: string, meetupId: string): Promise<MeetupDto> {
      const now = clock();
      const { booking, conversation, role, access } = await loadContext(userId, { conversationId });
      if (!access.canWrite) throw new ValidationError(`This conversation is read-only (${access.reason}).`);
      const meetup = await prisma.meetup.findFirst({ where: { id: meetupId, conversationId: conversation.id } });
      if (!meetup) throw new NotFoundError("Meeting not found.");
      const check = canAcceptMeetup(meetup as unknown as MeetupRow, role);
      if (!check.ok) throw new ValidationError(`This meeting cannot be accepted (${check.reason}).`);

      const updated = await prisma.meetup.updateMany({ where: { id: meetupId, status: "PROPOSED" }, data: { status: "ACCEPTED", acceptedAt: now } });
      if (updated.count === 0) throw new ValidationError("This meeting was just changed. Reload the conversation.");
      const fresh = (await prisma.meetup.findUniqueOrThrow({ where: { id: meetupId } })) as unknown as MeetupRow;
      await writeMessage(
        conversation.id,
        { kind: "MEETUP", authorId: userId, authorRole: role, body: fresh.placeLabel, systemKey: "meetup.accepted", systemData: { meetupId: fresh.id, kind: fresh.kind, placeLabel: fresh.placeLabel, startAt: fresh.startAt.toISOString() } },
        () =>
          ({
            ...envelopeFor(conversation.id, now),
            eventType: "conversation.meetup_accepted",
            payload: { ...eventBase(booking, conversation.id, role, userId), meetupId: fresh.id, kind: fresh.kind as "PICKUP" | "DELIVERY", placeLabel: fresh.placeLabel, startAt: fresh.startAt.toISOString() },
          }) as MessagingDomainEvent,
        now
      );
      return toMeetupDto(fresh);
    },

    /** Révéler le numéro de l'autre partie : au plus tôt deux heures avant le rendez-vous, tracé. */
    async revealPhone(userId: string, conversationId: string): Promise<RevealPhoneResponse> {
      const now = clock();
      const { booking, conversation, role } = await loadContext(userId, { conversationId });
      const meetups = (await prisma.meetup.findMany({ where: { conversationId: conversation.id, kind: "PICKUP", status: "ACCEPTED" } })) as unknown as MeetupRow[];
      const window = phoneRevealWindow({ pickupStartAt: meetups[0]?.startAt ?? null, departureAt: booking.trip.departureAt }, now);
      if (!window.allowed) {
        throw new ValidationError(
          window.reason === "TOO_EARLY" ? `The phone number opens ${window.opensAt?.toISOString() ?? "later"}.` : "No meeting or departure date to open the phone number.",
          { code: window.reason ?? "NOT_ALLOWED" }
        );
      }
      const counterpartId = counterpartIdOf(role, booking);
      const counterpart = await prisma.user.findUniqueOrThrow({ where: { id: counterpartId }, select: { firstName: true, phoneE164: true } });
      const existing = await prisma.phoneReveal.findUnique({ where: { conversationId_revealedToId: { conversationId: conversation.id, revealedToId: userId } } });
      if (existing) return { phoneE164: counterpart.phoneE164, firstName: counterpart.firstName, revealedAt: existing.revealedAt.toISOString() };

      await prisma.phoneReveal.create({ data: { conversationId: conversation.id, bookingId: booking.id, revealedToId: userId, revealedUserId: counterpartId, revealedAt: now } });
      await writeMessage(
        conversation.id,
        { kind: "SYSTEM", authorId: null, authorRole: "SYSTEM", body: "phone.revealed", systemKey: "phone.revealed", systemData: { role } },
        () =>
          ({
            ...envelopeFor(conversation.id, now),
            eventType: "conversation.phone_revealed",
            payload: { ...eventBase(booking, conversation.id, role, userId), revealedUserId: counterpartId },
          }) as MessagingDomainEvent,
        now
      );
      return { phoneE164: counterpart.phoneE164, firstName: counterpart.firstName, revealedAt: now.toISOString() };
    },
  };
}

export type ConversationService = ReturnType<typeof makeConversationService>;
