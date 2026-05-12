import prisma from "@packages/libs/prisma";
import type { Trip } from "@prisma/client";
import { calculateMatchScore } from "../utils/saved-route-matching.helper";
import {
  sendTripPublishedEmail,
  type TripPublishedEmailPayload,
} from "../utils/email/trip-notifications.email";

const NOTIFICATION_COOLDOWN_HOURS = 24;

/**
 * Dispatch les notifications email pour un trip qui vient d'être publié.
 *
 * Logique :
 *   1. Fetch les followers du tripper avec notifyNextTrip=true
 *   2. Fetch les SavedRoute candidates (isActive + emailEnabled + hors cooldown)
 *   3. Filtre les SavedRoute par score de match (>= 70) + dates + includeNearby
 *   4. Déduplique par userId (1 user = 1 email avec contexte enrichi)
 *   5. Envoie les emails en async (fire-and-forget)
 *   6. Update lastNotifiedAt sur les SavedRoute notifiées
 *
 * IMPORTANT : Cette fonction ne doit JAMAIS faire échouer la publication d'un trip.
 * Toute erreur est catchée et loguée.
 */
export async function dispatchTripPublishedNotifications(
  trip: Trip
): Promise<void> {
  try {
    // Safety checks
    if (!trip.userId) {
      console.warn(`[trip-notifications] Trip ${trip.id} has no userId, skipping`);
      return;
    }

    // ─── 1. Tripper info ───
    const tripper = await prisma.user.findUnique({
      where: { id: trip.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        publicSlug: true,
      },
    });

    if (!tripper) {
      console.warn(`[trip-notifications] Tripper not found: ${trip.userId}`);
      return;
    }

    // ─── 2. Followers ───
    const followRows = await prisma.userFollow.findMany({
      where: {
        followedId: trip.userId,
        notifyNextTrip: true,
      },
      select: {
        follower: {
          select: {
            id: true,
            firstName: true,
            emailNormalized: true,
            isDeleted: true,
          },
        },
      },
    });

    // ─── 3. SavedRoute candidates ───
    const cooldownThreshold = new Date(
      Date.now() - NOTIFICATION_COOLDOWN_HOURS * 60 * 60 * 1000
    );

    const candidateSavedRoutes = await prisma.savedRoute.findMany({
      where: {
        isActive: true,
        emailEnabled: true,
        userId: { not: trip.userId }, // safety: pas notifier le tripper lui-même
        OR: [
          { lastNotifiedAt: null },
          { lastNotifiedAt: { lt: cooldownThreshold } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            emailNormalized: true,
            isDeleted: true,
          },
        },
      },
    });

    // ─── 4. Filter SavedRoute by score + dates + nearby toggle ───
    const matchedSavedRoutes = candidateSavedRoutes
      .map((sr) => ({
        ...sr,
        matchScore: calculateMatchScore(sr, trip),
      }))
      .filter((sr) => {
        // Score threshold
        if (sr.matchScore < 70) return false;
        // Respect includeNearby toggle (score 70 = approximate)
        if (sr.matchScore < 100 && !sr.includeNearby) return false;
        // Skip deleted users
        if (sr.user.isDeleted) return false;
        // Date range check
        if (trip.departureAt) {
          if (sr.earliestDate && trip.departureAt < sr.earliestDate) return false;
          if (sr.latestDate && trip.departureAt > sr.latestDate) return false;
        }
        return true;
      });

    // ─── 5. Build deduplicated recipients map ───
    type RecipientContext = TripPublishedEmailPayload["recipient"];

    const recipientsMap = new Map<string, RecipientContext>();

    // Add followers first
    for (const row of followRows) {
      const follower = row.follower;
      if (!follower || follower.isDeleted) continue;
      if (follower.id === trip.userId) continue; // safety

      recipientsMap.set(follower.id, {
        userId: follower.id,
        email: follower.emailNormalized,
        firstName: follower.firstName,
        followsTripper: true,
        matchingSavedRoute: null,
      });
    }

    // Merge with SavedRoute matches (enrich if user already in map)
    for (const sr of matchedSavedRoutes) {
      const existing = recipientsMap.get(sr.userId);
      const matchInfo = {
        id: sr.id,
        matchScore: sr.matchScore,
        originCity: sr.originCity,
        destinationCity: sr.destinationCity,
      };

      if (existing) {
        // User already in map (as follower) → enrich with route info
        existing.matchingSavedRoute = matchInfo;
      } else {
        // New recipient from SavedRoute alone
        recipientsMap.set(sr.userId, {
          userId: sr.userId,
          email: sr.user.emailNormalized,
          firstName: sr.user.firstName,
          followsTripper: false,
          matchingSavedRoute: matchInfo,
        });
      }
    }

    const recipients = Array.from(recipientsMap.values());

    console.log(
      `[trip-notifications] Trip ${trip.id}: ${recipients.length} recipient(s) ` +
      `(${followRows.length} follower(s), ${matchedSavedRoutes.length} route match(es))`
    );

    // ─── 6. Send emails (async, fire-and-forget) ───
    for (const recipient of recipients) {
      sendTripPublishedEmail({
        recipient,
        tripper,
        trip,
      }).catch((err) => {
        console.error(
          `[trip-notifications] Email failed for ${recipient.email}:`,
          err
        );
      });
    }

    // ─── 7. Update lastNotifiedAt on notified SavedRoute (cooldown) ───
    if (matchedSavedRoutes.length > 0) {
      await prisma.savedRoute.updateMany({
        where: {
          id: { in: matchedSavedRoutes.map((sr) => sr.id) },
        },
        data: {
          lastNotifiedAt: new Date(),
        },
      });
    }
  } catch (error) {
    // CRITICAL: ne JAMAIS faire échouer la publication d'un trip
    console.error(
      `[trip-notifications] Dispatch failed for trip ${trip.id}:`,
      error
    );
  }
}
