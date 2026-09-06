/**
 * admin-conversation.service.ts — lecture admin et signalements (F-PR3, D61 7A)
 * ==============================================================================
 * Le support et le médiateur lisent un fil ENTIER depuis un dossier : la lecture est un geste
 * volontaire et journalisé (CONVERSATION_VIEWED — l'admin voit des propos privés). Jamais le
 * numéro de téléphone (seulement qui l'a vu, quand), jamais le code (il n'est pas dans le fil).
 * Traiter un signalement écrit la décision ET la ligne de journal dans la même transaction.
 */
import prisma from "@packages/libs/prisma";
import { ConflictError, NotFoundError } from "@packages/error-handler";
import { recordAdminAction } from "@packages/admin-audit";
import type { AdminConversationResponse, AdminMessage, AdminMessageReportItem, AdminMessageReportsResponse, MessageReportReason, MessageReportStatus, ReviewMessageReportRequest } from "@packages/api-contracts";

export type AdminActor = { id: string; ip: string | null; userAgent: string | null };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export type AdminConversationService = ReturnType<typeof makeAdminConversationService>;

export function makeAdminConversationService() {
  return {
    async viewByDeal(actor: AdminActor, bookingId: string): Promise<AdminConversationResponse> {
      const conversation = await prisma.conversation.findUnique({ where: { bookingId } });
      if (!conversation) throw new NotFoundError("This deal has no conversation.");
      const [booking, shipper, carrier, messages, meetups, reveals] = await Promise.all([
        prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, trip: { select: { originCity: true, destinationCity: true, departureAt: true } } } }),
        prisma.user.findUnique({ where: { id: conversation.shipperId }, select: { id: true, firstName: true, lastName: true } }),
        prisma.user.findUnique({ where: { id: conversation.carrierId }, select: { id: true, firstName: true, lastName: true } }),
        prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } }),
        prisma.meetup.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: "asc" } }),
        prisma.phoneReveal.findMany({ where: { conversationId: conversation.id }, orderBy: { revealedAt: "asc" } }),
      ]);
      if (!booking) throw new NotFoundError("Deal not found.");
      const reports = messages.length
        ? await prisma.report.findMany({ where: { targetType: "MESSAGE", targetId: { in: messages.map((m) => m.id) } }, orderBy: { createdAt: "asc" } })
        : [];
      const roleOf = (userId: string): "SHIPPER" | "CARRIER" => (userId === conversation.shipperId ? "SHIPPER" : "CARRIER");
      const reportsByMessage = new Map<string, AdminMessage["reports"]>();
      for (const r of reports) {
        const list = reportsByMessage.get(r.targetId) ?? [];
        list.push({ id: r.id, reason: r.reason as MessageReportReason, details: r.details, status: r.status as MessageReportStatus, reporterRole: roleOf(r.reporterUserId), createdAt: r.createdAt.toISOString() });
        reportsByMessage.set(r.targetId, list);
      }

      await recordAdminAction(prisma, { adminUserId: actor.id, action: "CONVERSATION_VIEWED", targetType: "CONVERSATION", targetId: conversation.id, after: { bookingId, messages: messages.length }, ip: actor.ip, userAgent: actor.userAgent });

      return {
        conversationId: conversation.id,
        bookingId,
        bookingStatus: booking.status,
        corridor: { originCity: booking.trip.originCity, destinationCity: booking.trip.destinationCity, departureAt: iso(booking.trip.departureAt) },
        shipper: { id: conversation.shipperId, firstName: shipper?.firstName ?? "—", lastName: shipper?.lastName ?? "" },
        carrier: { id: conversation.carrierId, firstName: carrier?.firstName ?? "—", lastName: carrier?.lastName ?? "" },
        messages: messages.map((m) => ({
          id: m.id,
          kind: m.kind as AdminMessage["kind"],
          authorRole: m.authorRole as AdminMessage["authorRole"],
          authorId: m.authorId,
          body: m.body,
          photoUrls: m.photoUrls ?? [],
          systemKey: m.systemKey,
          systemData: (m.systemData as Record<string, unknown> | null) ?? null,
          flaggedContact: m.flaggedContact,
          createdAt: m.createdAt.toISOString(),
          reports: reportsByMessage.get(m.id) ?? [],
        })),
        meetups: meetups.map((m) => ({
          id: m.id,
          kind: m.kind as "PICKUP" | "DELIVERY",
          status: m.status as "PROPOSED" | "ACCEPTED" | "CANCELLED",
          proposedByRole: m.proposedByRole as "SHIPPER" | "CARRIER",
          placeLabel: m.placeLabel,
          placeDetails: m.placeDetails,
          startAt: m.startAt.toISOString(),
          endAt: m.endAt.toISOString(),
          acceptedAt: iso(m.acceptedAt),
          cancelledAt: iso(m.cancelledAt),
          createdAt: m.createdAt.toISOString(),
        })),
        phoneReveals: reveals.map((r) => ({ revealedToRole: roleOf(r.revealedToId), revealedAt: r.revealedAt.toISOString() })),
        lastMessageAt: iso(conversation.lastMessageAt),
      };
    },

    /** La file des messages signalés (OPEN par défaut), les plus anciens d'abord. Lecture non journalisée : c'est une liste de travail. */
    async listReports(status: MessageReportStatus): Promise<AdminMessageReportsResponse> {
      const reports = await prisma.report.findMany({ where: { targetType: "MESSAGE", status }, orderBy: { createdAt: "asc" }, take: 200 });
      if (reports.length === 0) return { items: [], total: 0 };
      const messages = await prisma.message.findMany({ where: { id: { in: reports.map((r) => r.targetId) } } });
      const byMessage = new Map(messages.map((m) => [m.id, m]));
      const conversations = await prisma.conversation.findMany({ where: { id: { in: [...new Set(messages.map((m) => m.conversationId))] } } });
      const byConversation = new Map(conversations.map((c) => [c.id, c]));
      const bookings = await prisma.booking.findMany({ where: { id: { in: conversations.map((c) => c.bookingId) } }, select: { id: true, trip: { select: { originCity: true, destinationCity: true } } } });
      const byBooking = new Map(bookings.map((b) => [b.id, b]));
      const userIds = new Set<string>();
      for (const c of conversations) {
        userIds.add(c.shipperId);
        userIds.add(c.carrierId);
      }
      const users = await prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, firstName: true } });
      const nameOf = new Map(users.map((u) => [u.id, u.firstName]));

      const items: AdminMessageReportItem[] = [];
      for (const r of reports) {
        const message = byMessage.get(r.targetId);
        const conversation = message ? byConversation.get(message.conversationId) : undefined;
        if (!message || !conversation) continue; // message purgé : le signalement reste, sans corps — hors file
        const booking = byBooking.get(conversation.bookingId);
        const roleOf = (userId: string | null): "SHIPPER" | "CARRIER" | "SYSTEM" => (!userId ? "SYSTEM" : userId === conversation.shipperId ? "SHIPPER" : "CARRIER");
        items.push({
          id: r.id,
          status: r.status as MessageReportStatus,
          reason: r.reason as MessageReportReason,
          details: r.details,
          createdAt: r.createdAt.toISOString(),
          reporter: { id: r.reporterUserId, firstName: nameOf.get(r.reporterUserId) ?? "—", role: roleOf(r.reporterUserId) as "SHIPPER" | "CARRIER" },
          author: { id: message.authorId, firstName: message.authorId ? nameOf.get(message.authorId) ?? "—" : "Système", role: roleOf(message.authorId) },
          message: { id: message.id, body: message.body, createdAt: message.createdAt.toISOString() },
          conversationId: conversation.id,
          bookingId: conversation.bookingId,
          corridor: { originCity: booking?.trip.originCity ?? "—", destinationCity: booking?.trip.destinationCity ?? "—" },
        });
      }
      return { items, total: items.length };
    },

    /** Traiter un signalement : décision + journal dans la MÊME transaction ; un signalement déjà traité ne se retraite pas (409). */
    async reviewReport(actor: AdminActor, reportId: string, input: ReviewMessageReportRequest): Promise<{ id: string; status: MessageReportStatus }> {
      const report = await prisma.report.findFirst({ where: { id: reportId, targetType: "MESSAGE" }, select: { id: true, status: true } });
      if (!report) throw new NotFoundError("Report not found.");
      if (report.status !== "OPEN") throw new ConflictError("This report has already been reviewed.");
      await prisma.$transaction(async (tx) => {
        const updated = await tx.report.updateMany({ where: { id: report.id, status: "OPEN" }, data: { status: input.decision } });
        if (updated.count !== 1) throw new ConflictError("This report has already been reviewed.");
        await recordAdminAction(tx, {
          adminUserId: actor.id,
          action: "MESSAGE_REPORT_REVIEWED",
          targetType: "REPORT",
          targetId: report.id,
          before: { status: "OPEN" },
          after: { status: input.decision, note: input.note?.trim() || null },
          ip: actor.ip,
          userAgent: actor.userAgent,
        });
      });
      return { id: report.id, status: input.decision };
    },
  };
}
