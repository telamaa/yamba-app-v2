/**
 * privacy.service.ts — les droits sur les données (C-PR8b, D63)
 * =============================================================
 * Export (2A) : ce qui appartient au membre, jamais les coordonnées de l'autre partie ni le code de
 * livraison, ni ce qui le vise. Effacement (3A/4A) : refusé tant qu'un deal vit, sinon UNE transaction
 * qui anonymise le compte champ par champ, supprime ce qui n'a plus de raison d'être, déplace
 * l'identifiant Stripe dans `ErasedAccount`, écrit le registre `DataRequest` (et le journal admin si
 * c'est un admin qui agit). Après le commit : sessions révoquées, fichiers ImageKit supprimés, email
 * de confirmation à l'ancienne adresse — tout en best effort, le compte est déjà effacé.
 *
 * `db` est injecté (structurel) : les specs jouent le tout sur un faux Prisma en mémoire.
 */
import { recordAdminAction } from "@packages/admin-audit";
import { ERASURE_BLOCKERS, type DataExport, type ErasureBlocker } from "@packages/api-contracts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Delegate = { findMany(args: any): Promise<any[]>; findUnique?(args: any): Promise<any>; findFirst?(args: any): Promise<any>; count?(args: any): Promise<number>; update?(args: any): Promise<any>; updateMany?(args: any): Promise<any>; deleteMany?(args: any): Promise<any>; create?(args: any): Promise<any> };
export type PrivacyDb = {
  user: Delegate; carrierPage: Delegate; address: Delegate; image: Delegate; authIdentity: Delegate; userFollow: Delegate; savedRoute: Delegate;
  tripFavorite: Delegate; notification: Delegate; consentLog: Delegate; trip: Delegate; tripDocument: Delegate; booking: Delegate; review: Delegate;
  message: Delegate; meetup: Delegate; phoneReveal: Delegate; report: Delegate; dataRequest: Delegate; erasedAccount: Delegate; adminAction: Delegate;
  $transaction<T>(fn: (tx: PrivacyDb) => Promise<T>): Promise<T>;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const LIVE_BOOKING = ["ACCEPTED", "PICKED_UP", "DELIVERED", "DISPUTED"];
const LIVE_TRIP = ["PUBLISHED", "PAUSED"];

export type ErasureCheck = { blockers: ErasureBlocker[]; counts: Record<string, number> };

/** Pourquoi un compte ne peut pas encore être effacé (D63 3A) — liste fermée, ordre stable. */
export async function erasureBlockers(db: PrivacyDb, userId: string): Promise<ErasureCheck> {
  const party = { OR: [{ shipperId: userId }, { carrierId: userId }], isDeleted: false };
  const [active, pending, payout, retention, trips, user] = await Promise.all([
    db.booking.count!({ where: { ...party, status: { in: LIVE_BOOKING } } }),
    db.booking.count!({ where: { ...party, status: "PENDING" } }),
    db.booking.count!({ where: { carrierId: userId, isDeleted: false, status: "COMPLETED", payoutStatus: { in: ["PENDING", "FAILED", "FROZEN"] } } }),
    db.booking.count!({ where: { ...party, status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION" } }),
    db.trip.count!({ where: { userId, isDeleted: false, status: { in: LIVE_TRIP } } }),
    db.user.findUnique!({ where: { id: userId }, select: { adminRoles: true, adminRole: true, roles: true } }),
  ]);
  const counts = { ACTIVE_DEAL: active, PENDING_REQUEST: pending, PAYOUT_PENDING: payout, RETENTION_HELD: retention, PUBLISHED_TRIP: trips, ADMIN_ACCOUNT: user && ((user.adminRoles?.length ?? 0) > 0 || !!user.adminRole || (user.roles ?? []).includes("ADMIN")) ? 1 : 0 };
  return { blockers: ERASURE_BLOCKERS.filter((b) => counts[b] > 0), counts };
}

export const ERASED_FIRST_NAME = "Membre";
export const ERASED_LAST_NAME = "supprimé";
export const erasedEmailFor = (userId: string) => `erased+${userId}@anonymised.invalid`;
export const erasedSlugFor = (userId: string) => `deleted-${userId}`;

/** Pur (D63 4A) : ce que devient le document User — les uniques nullables ne passent JAMAIS à null (collision Mongo). */
export function anonymizedUserData(userId: string, now: Date) {
  return {
    firstName: ERASED_FIRST_NAME,
    lastName: ERASED_LAST_NAME,
    email: erasedEmailFor(userId),
    emailNormalized: erasedEmailFor(userId),
    passwordHash: null,
    phoneNumber: null,
    phoneE164: null,
    gender: null,
    birthDate: null,
    publicSlug: erasedSlugFor(userId),
    roles: [] as string[],
    adminRoles: [] as string[],
    adminRole: null,
    totpSecretEncrypted: null,
    totpEnabledAt: null,
    totpLastUsedStep: null,
    totpBackupCodeHashes: [] as string[],
    suspensionReason: null,
    suspensionProposedReason: null,
    messagingReminderEmails: false,
    isDeleted: true,
    deletedAt: now,
  };
}
export const anonymizedCarrierPageData = () => ({ name: `${ERASED_FIRST_NAME} ${ERASED_LAST_NAME}`, bio: null, phoneE164: null, coverUrl: null, socialLinks: [] as unknown[], primaryAddressId: null, stripeAccountId: null });

export type EraseInput = {
  userId: string;
  channel: "MEMBER" | "ADMIN";
  requestedByAdminId?: string | null;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};
export type EraseResult = { erased: true; userId: string; erasedAt: Date; email: string; firstName: string; locale: string | null; fileIds: string[]; stripeAccountId: string | null };

export class ErasureBlockedError extends Error {
  constructor(public readonly check: ErasureCheck) {
    super("This account cannot be erased yet.");
  }
}

export function makePrivacyService(deps: {
  db: PrivacyDb;
  clock?: () => Date;
  /** Après le commit, best effort : sessions, fichiers, email. */
  afterErase?: (r: EraseResult) => Promise<void>;
}) {
  const clock = deps.clock ?? (() => new Date());

  return {
    erasureBlockers: (userId: string) => erasureBlockers(deps.db, userId),

    /** Effacement (D63 3A/4A) : 409 typé si un deal vit, sinon une transaction. */
    async eraseAccount(input: EraseInput): Promise<EraseResult> {
      const now = clock();
      const check = await erasureBlockers(deps.db, input.userId);
      if (check.blockers.length) {
        await deps.db.dataRequest.create!({ data: { userId: input.userId, type: "ERASURE", channel: input.channel, status: "REFUSED", refusalReasons: check.blockers, requestedByAdminId: input.requestedByAdminId ?? null, reason: input.reason ?? null, ip: input.ip ?? null, userAgent: input.userAgent ?? null, requestedAt: now, completedAt: now } });
        throw new ErasureBlockedError(check);
      }
      const result = await deps.db.$transaction(async (tx) => {
        const user = await tx.user.findUnique!({ where: { id: input.userId }, select: { id: true, email: true, firstName: true, preferredLocale: true, isDeleted: true, carrierPage: { select: { id: true, stripeAccountId: true } } } });
        if (!user || user.isDeleted) throw new Error("ACCOUNT_NOT_FOUND");
        // Capturés AVANT l'anonymisation : l'email de confirmation part à l'ancienne adresse.
        const identity = { email: String(user.email), firstName: String(user.firstName), locale: (user.preferredLocale as string | null) ?? null, stripeAccountId: (user.carrierPage?.stripeAccountId as string | null) ?? null, carrierPageId: (user.carrierPage?.id as string | null) ?? null };
        const docs = await tx.tripDocument.findMany({ where: { trip: { userId: input.userId } }, select: { id: true, fileId: true } });
        const fileIds = docs.map((d: { fileId: string | null }) => d.fileId).filter((f: string | null): f is string => !!f);
        await tx.user.update!({ where: { id: input.userId }, data: anonymizedUserData(input.userId, now) });
        if (identity.carrierPageId) await tx.carrierPage.update!({ where: { id: identity.carrierPageId }, data: anonymizedCarrierPageData() });
        await tx.address.deleteMany!({ where: { userId: input.userId } });
        await tx.image.deleteMany!({ where: { userId: input.userId } });
        await tx.authIdentity.deleteMany!({ where: { userId: input.userId } });
        await tx.userFollow.deleteMany!({ where: { OR: [{ followerId: input.userId }, { followedId: input.userId }] } });
        await tx.savedRoute.deleteMany!({ where: { userId: input.userId } });
        await tx.tripFavorite.deleteMany!({ where: { userId: input.userId } });
        await tx.notification.deleteMany!({ where: { userId: input.userId } });
        if (docs.length) await tx.tripDocument.deleteMany!({ where: { id: { in: docs.map((d: { id: string }) => d.id) } } });
        await tx.consentLog.updateMany!({ where: { userId: input.userId }, data: { ipAddress: null, userAgent: null } });
        await tx.erasedAccount.create!({ data: { userId: input.userId, channel: input.channel, requestedByAdminId: input.requestedByAdminId ?? null, reason: input.reason ?? null, stripeAccountId: identity.stripeAccountId, erasedAt: now } });
        await tx.dataRequest.create!({ data: { userId: input.userId, type: "ERASURE", channel: input.channel, status: "DONE", refusalReasons: [], requestedByAdminId: input.requestedByAdminId ?? null, reason: input.reason ?? null, ip: input.ip ?? null, userAgent: input.userAgent ?? null, requestedAt: now, completedAt: now } });
        if (input.channel === "ADMIN" && input.requestedByAdminId) {
          await recordAdminAction(tx as never, { adminUserId: input.requestedByAdminId, action: "ACCOUNT_ERASED", targetType: "USER", targetId: input.userId, after: { reason: input.reason ?? null, fileIds: fileIds.length, stripeAccountKept: !!identity.stripeAccountId }, ip: input.ip ?? null, userAgent: input.userAgent ?? null });
        }
        return { erased: true as const, userId: input.userId, erasedAt: now, email: identity.email, firstName: identity.firstName, locale: identity.locale, fileIds, stripeAccountId: identity.stripeAccountId };
      });
      await deps.afterErase?.(result).catch(() => undefined);
      return result;
    },

    /** Export (D63 2A) : ce qui appartient au membre. Les objets sont des projections explicites, jamais un spread de document. */
    async buildDataExport(userId: string): Promise<DataExport> {
      const db = deps.db;
      const now = clock();
      const [user, addresses, consents, carrierPage, trips, bookings, reviewsGiven, reviewsReceived, messages, meetups, phoneReveals, savedRoutes, favorites, following, notifications, reports, requests] = await Promise.all([
        db.user.findUnique!({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, email: true, phoneE164: true, gender: true, birthDate: true, roles: true, preferredLocale: true, publicSlug: true, accountStatus: true, createdAt: true, messagingReminderEmails: true, shipperRatingsAvg: true, shipperRatingsCount: true, shipperReputationLevel: true, shipperCompletedDealsCount: true, parcelsSentCount: true } }),
        db.address.findMany({ where: { userId }, select: { id: true, label: true, formattedAddress: true, city: true, region: true, postalCode: true, country: true, recipientName: true, phoneE164: true, isArchived: true, createdAt: true } }),
        db.consentLog.findMany({ where: { userId }, select: { type: true, version: true, acceptedAt: true, locale: true, revokedAt: true } }),
        db.carrierPage.findFirst!({ where: { userId }, select: { name: true, bio: true, phoneE164: true, coverUrl: true, socialLinks: true, onboardingStep: true, isVerified: true, totalTripsPublished: true, totalParcelsCarried: true, ratingsAvg: true, ratingsCount: true, reputationLevel: true, completedDealsCount: true, createdAt: true } }),
        db.trip.findMany({ where: { userId }, select: { id: true, status: true, originCity: true, originCountry: true, destinationCity: true, destinationCountry: true, departureAt: true, arrivalAt: true, transportMode: true, pricePerKgCents: true, capacityKg: true, travelReference: true, notes: true, createdAt: true, publishedAt: true } }),
        db.booking.findMany({ where: { OR: [{ shipperId: userId }, { carrierId: userId }] }, select: { id: true, ticketNumber: true, shipperId: true, carrierId: true, status: true, requestedAt: true, acceptedAt: true, pickedUpAt: true, deliveredAt: true, completedAt: true, closedAt: true, cancelReason: true, trip: true, pricing: true, parcel: true, recipient: true, pickupPlace: true, deliveryPlace: true, payoutStatus: true, payoutAmountCents: true, refundAmountCents: true, retentionCents: true } }),
        db.review.findMany({ where: { authorUserId: userId }, select: { id: true, bookingId: true, kind: true, rating: true, comment: true, criteria: true, createdAt: true, revealedAt: true } }),
        db.review.findMany({ where: { subjectUserId: userId, revealedAt: { not: null } }, select: { id: true, bookingId: true, kind: true, rating: true, comment: true, createdAt: true, revealedAt: true } }),
        db.message.findMany({ where: { authorId: userId }, select: { id: true, conversationId: true, body: true, photoUrls: true, createdAt: true } }),
        db.meetup.findMany({ where: { proposedById: userId }, select: { id: true, bookingId: true, kind: true, status: true, placeLabel: true, placeDetails: true, startAt: true, endAt: true, createdAt: true } }),
        db.phoneReveal.findMany({ where: { OR: [{ revealedToId: userId }, { revealedUserId: userId }] }, select: { bookingId: true, revealedToId: true, revealedUserId: true, revealedAt: true } }),
        db.savedRoute.findMany({ where: { userId }, select: { id: true, originCity: true, originCountry: true, destinationCity: true, destinationCountry: true, earliestDate: true, latestDate: true, emailEnabled: true, inAppEnabled: true, isActive: true, createdAt: true } }),
        db.tripFavorite.findMany({ where: { userId }, select: { tripId: true, createdAt: true } }),
        db.userFollow.findMany({ where: { followerId: userId }, select: { followedId: true, notifyNextTrip: true, createdAt: true } }),
        db.notification.findMany({ where: { userId }, select: { id: true, type: true, bookingId: true, readAt: true, createdAt: true } }),
        db.report.findMany({ where: { reporterUserId: userId }, select: { id: true, targetType: true, reason: true, details: true, status: true, createdAt: true } }),
        db.dataRequest.findMany({ where: { userId }, select: { type: true, channel: true, status: true, requestedAt: true, completedAt: true } }),
      ]);
      const role = (b: { shipperId: string }) => (b.shipperId === userId ? "SHIPPER" : "CARRIER");
      return {
        exportedAt: now.toISOString(),
        format: "yamba-data-export/1",
        profile: user ?? {},
        preferences: { preferredLocale: user?.preferredLocale ?? null, messagingReminderEmails: user?.messagingReminderEmails ?? true },
        addresses,
        consents,
        carrierProfile: carrierPage ?? null,
        trips,
        // Son rôle, ses montants, le colis et le destinataire QU'IL a saisis ; jamais l'identité de l'autre partie ni le code de livraison.
        bookings: bookings.map((b: Record<string, unknown> & { shipperId: string }) => ({
          id: b.id, ticketNumber: b.ticketNumber, role: role(b), status: b.status, requestedAt: b.requestedAt, acceptedAt: b.acceptedAt, pickedUpAt: b.pickedUpAt, deliveredAt: b.deliveredAt, completedAt: b.completedAt, closedAt: b.closedAt, cancelReason: b.cancelReason,
          trip: b.trip, pricing: b.pricing, parcel: b.parcel, pickupPlace: b.pickupPlace, deliveryPlace: b.deliveryPlace,
          ...(role(b) === "SHIPPER" ? { recipient: b.recipient, refundAmountCents: b.refundAmountCents, retentionCents: b.retentionCents } : { payoutStatus: b.payoutStatus, payoutAmountCents: b.payoutAmountCents }),
        })),
        reviewsGiven,
        reviewsReceived,
        messages,
        meetups,
        phoneReveals,
        savedRoutes,
        favorites,
        following,
        notifications,
        reportsMade: reports,
        dataRequests: requests,
      };
    },

    async recordExport(userId: string, channel: "MEMBER" | "ADMIN", meta: { ip?: string | null; userAgent?: string | null }): Promise<void> {
      const now = clock();
      await deps.db.dataRequest.create!({ data: { userId, type: "EXPORT", channel, status: "DONE", refusalReasons: [], ip: meta.ip ?? null, userAgent: meta.userAgent ?? null, requestedAt: now, completedAt: now } });
    },

    /** Dernier export réussi (pour la règle « une fois par 24 h »). */
    async lastExportAt(userId: string): Promise<Date | null> {
      const row = await deps.db.dataRequest.findFirst!({ where: { userId, type: "EXPORT", status: "DONE" }, orderBy: { requestedAt: "desc" }, select: { requestedAt: true } });
      return row?.requestedAt ?? null;
    },
  };
}
export type PrivacyService = ReturnType<typeof makePrivacyService>;
