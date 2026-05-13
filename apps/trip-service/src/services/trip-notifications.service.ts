import prisma from "@packages/libs/prisma";
import type { Trip } from "@prisma/client";
import {
  explainMatchScore,
} from "../utils/saved-route-matching.helper";
import {
  sendTripPublishedEmail,
  type TripPublishedEmailPayload,
} from "../utils/email/trip-notifications.email";

const NOTIFICATION_COOLDOWN_HOURS = 24;

/**
 * Dispatch les notifications email pour un trip qui vient d'être publié.
 *
 * Notes d'implémentation :
 *  - Le filtre cooldown (lastNotifiedAt) est fait en JS, pas en Prisma.
 *    Raison : Prisma + MongoDB n'arrive pas à matcher correctement les
 *    documents où un champ est absent (pas même null, juste absent).
 *    Le coût est négligeable car le pre-filter countryCode est très selectif.
 *  - Cette fonction ne DOIT JAMAIS faire échouer la publication d'un trip.
 */
export async function dispatchTripPublishedNotifications(
  trip: Trip
): Promise<void> {
  try {
    if (!trip.userId) {
      console.warn(`[trip-notifications] Trip ${trip.id} has no userId, skipping`);
      return;
    }

    console.log(
      `[trip-notifications] === Dispatch start for trip ${trip.id} ===\n` +
      `  Origin: ${trip.originCity} (${trip.originCountryCode ?? "??"}) placeId=${trip.originPlaceId ?? "-"}\n` +
      `  Destination: ${trip.destinationCity} (${trip.destinationCountryCode ?? "??"}) placeId=${trip.destinationPlaceId ?? "-"}`
    );

    // ─── 1. Tripper info ───
    const tripper = await prisma.user.findUnique({
      where: { id: trip.userId },
      select: { id: true, firstName: true, lastName: true, publicSlug: true },
    });
    if (!tripper) {
      console.warn(`[trip-notifications] Tripper not found: ${trip.userId}`);
      return;
    }

    // ─── 2. Followers ───
    const followRows = await prisma.userFollow.findMany({
      where: { followedId: trip.userId, notifyNextTrip: true },
      select: {
        follower: {
          select: { id: true, firstName: true, emailNormalized: true, isDeleted: true },
        },
      },
    });

    // ─── 3. SavedRoute candidates (sans filtre cooldown) ───
    const baseWhere: any = {
      isActive: true,
      emailEnabled: true,
      userId: { not: trip.userId },
    };

    const hasIsoCodes = !!trip.originCountryCode && !!trip.destinationCountryCode;
    if (hasIsoCodes) {
      baseWhere.originCountryCode = trip.originCountryCode;
      baseWhere.destinationCountryCode = trip.destinationCountryCode;
    }

    const rawCandidates = await prisma.savedRoute.findMany({
      where: baseWhere,
      include: {
        user: {
          select: { id: true, firstName: true, emailNormalized: true, isDeleted: true },
        },
      },
    });

    // ─── 4. Post-filter cooldown en JavaScript ───
    // Note : Prisma + MongoDB ne matche pas correctement les champs absents,
    // donc on filtre cooldown ici. Logique : on garde si jamais notifié OU
    // dernière notif plus ancienne que le seuil.
    const cooldownThreshold = new Date(
      Date.now() - NOTIFICATION_COOLDOWN_HOURS * 60 * 60 * 1000
    );

    const candidateSavedRoutes = rawCandidates.filter((sr) => {
      if (!sr.lastNotifiedAt) return true; // jamais notifié
      return sr.lastNotifiedAt < cooldownThreshold;
    });

    console.log(
      `[trip-notifications] Candidates: ${candidateSavedRoutes.length}/${rawCandidates.length} ` +
      `after cooldown filter (prefilter=${hasIsoCodes ? "countryCode" : "all-active"})`
    );

    // ─── 5. Filter par score + dates + includeNearby ───
    const matchedSavedRoutes = candidateSavedRoutes
      .map((sr) => {
        const match = explainMatchScore(sr, trip);
        return { ...sr, matchScore: match.score, matchReason: match.reason };
      })
      .filter((sr) => {
        if (sr.matchScore < 70) {
          console.log(`[trip-notifications]   ❌ SR ${sr.id} score=${sr.matchScore} reason="${sr.matchReason}"`);
          return false;
        }
        if (sr.matchScore < 100 && !sr.includeNearby) {
          console.log(`[trip-notifications]   ⏭ SR ${sr.id} score=${sr.matchScore} skipped (includeNearby=false)`);
          return false;
        }
        if (sr.user.isDeleted) return false;
        if (trip.departureAt) {
          if (sr.earliestDate && trip.departureAt < sr.earliestDate) {
            console.log(`[trip-notifications]   📅 SR ${sr.id} skipped (departure before earliestDate)`);
            return false;
          }
          if (sr.latestDate && trip.departureAt > sr.latestDate) {
            console.log(`[trip-notifications]   📅 SR ${sr.id} skipped (departure after latestDate)`);
            return false;
          }
        }
        console.log(`[trip-notifications]   ✅ SR ${sr.id} (${sr.originCity}→${sr.destinationCity}) score=${sr.matchScore} reason="${sr.matchReason}"`);
        return true;
      });

    // ─── 6. Recipients map (dédupliqué par userId) ───
    type RecipientContext = TripPublishedEmailPayload["recipient"];
    const recipientsMap = new Map<string, RecipientContext>();

    for (const row of followRows) {
      const follower = row.follower;
      if (!follower || follower.isDeleted) continue;
      if (follower.id === trip.userId) continue;
      recipientsMap.set(follower.id, {
        userId: follower.id,
        email: follower.emailNormalized,
        firstName: follower.firstName,
        followsTripper: true,
        matchingSavedRoute: null,
      });
    }

    for (const sr of matchedSavedRoutes) {
      const existing = recipientsMap.get(sr.userId);
      const matchInfo = {
        id: sr.id,
        matchScore: sr.matchScore,
        originCity: sr.originCity,
        destinationCity: sr.destinationCity,
      };
      if (existing) {
        existing.matchingSavedRoute = matchInfo;
      } else {
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
      `[trip-notifications] === Result: ${recipients.length} recipient(s) ` +
      `(${followRows.length} follower(s), ${matchedSavedRoutes.length} route match(es)) ===`
    );

    // ─── 7. Send emails (fire-and-forget) ───
    for (const recipient of recipients) {
      sendTripPublishedEmail({ recipient, tripper, trip }).catch((err) => {
        console.error(`[trip-notifications] Email failed for ${recipient.email}:`, err);
      });
    }

    // ─── 8. Update lastNotifiedAt (cooldown) ───
    if (matchedSavedRoutes.length > 0) {
      await prisma.savedRoute.updateMany({
        where: { id: { in: matchedSavedRoutes.map((sr) => sr.id) } },
        data: { lastNotifiedAt: new Date() },
      });
    }
  } catch (error) {
    console.error(`[trip-notifications] Dispatch failed for trip ${trip.id}:`, error);
  }
}
