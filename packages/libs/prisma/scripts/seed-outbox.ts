import prisma from "../index";
import { BookingDomainEventSchema } from "../../api-contracts/src";

/**
 * seed-outbox.ts — alimentation de l'outbox pour le smoke du relay (PR4)
 * ======================================================================
 * Emplacement : packages/libs/prisma/scripts/seed-outbox.ts
 * Exécution   : DATABASE_URL requis, seed-deals DÉJÀ passé, puis
 *               npx tsx packages/libs/prisma/scripts/seed-outbox.ts
 *               npx tsx packages/libs/prisma/scripts/seed-outbox.ts --with-poison
 *
 * Pourquoi ce script existe : AUCUNE transition n'écrit encore
 * d'OutboxEvent (les writers = B2). Pour smoke-tester le relay de bout
 * en bout (Mongo → relay → Redpanda), on injecte des événements
 * construits depuis de VRAIS bookings du seed — jamais de données
 * inventées — et chaque payload passe BookingDomainEventSchema.parse
 * AVANT insertion : ce script prouve donc aussi que seed, contrat et
 * relay sont alignés.
 *
 * Contenu injecté :
 * - 5 événements du cycle de vie sur UN booking COMPLETED (requested →
 *   accepted → picked_up → delivered → completed), occurredAt étagés :
 *   même aggregateId → prouve l'ordre par clé de partition.
 * - 1 booking.requested sur un booking PENDING (second agrégat).
 * - --with-poison : 1 row au payload hors contrat → prouve le parking
 *   (attempts 1→10 en ~10 ticks, puis exclusion + log PARKED).
 *
 * Idempotence : wipe ciblé par correlationId "seed-outbox" — on
 * n'efface QUE les rows de ce script (la doctrine « jamais de delete »
 * protège l'audit trail de PRODUCTION ; un jeu de smoke marqué est
 * rejouable par définition).
 */

const SEED_CORRELATION_ID = "seed-outbox";
const WITH_POISON = process.argv.includes("--with-poison");

type SeededBooking = NonNullable<Awaited<ReturnType<typeof findBookingByStatus>>>;

function findBookingByStatus(status: "COMPLETED" | "PENDING") {
  return prisma.booking.findFirst({ where: { status } });
}

/** Socle commun des payloads — depuis les snapshots FIGÉS du booking. */
function basePayload(booking: SeededBooking, actor: "SHIPPER" | "CARRIER" | "SYSTEM") {
  return {
    bookingId: booking.id,
    tripId: booking.tripId,
    shipperId: booking.shipperId,
    carrierId: booking.carrierId,
    corridor: {
      originCity: booking.trip.originCity,
      originCountryCode: booking.trip.originCountryCode,
      destinationCity: booking.trip.destinationCity,
      destinationCountryCode: booking.trip.destinationCountryCode,
    },
    category: booking.parcel.category,
    categoryFamily: booking.parcel.categoryFamily,
    weightKg: booking.pricing.weightKg,
    transportCents: booking.pricing.transportCents,
    totalShipperCents: booking.pricing.totalShipperCents,
    currencyCode: booking.pricing.currencyCode,
    actor,
  };
}

function envelope(booking: SeededBooking, occurredAt: Date) {
  return {
    aggregateType: "booking" as const,
    aggregateId: booking.id,
    occurredAt: occurredAt.toISOString(),
    correlationId: SEED_CORRELATION_ID,
    schemaVersion: 1 as const,
  };
}

const iso = (value: Date | null | undefined): string => (value ?? new Date()).toISOString();

/** Le cycle de vie complet d'un booking COMPLETED — 5 événements étagés. */
function lifecycleEvents(booking: SeededBooking, t0: Date) {
  const at = (offsetSeconds: number) => new Date(t0.getTime() + offsetSeconds * 1000);
  return [
    {
      ...envelope(booking, at(0)),
      eventType: "booking.requested" as const,
      payload: { ...basePayload(booking, "SHIPPER"), expiresAt: iso(booking.expiresAt) },
    },
    {
      ...envelope(booking, at(1)),
      eventType: "booking.accepted" as const,
      payload: { ...basePayload(booking, "CARRIER"), acceptedAt: iso(booking.acceptedAt) },
    },
    {
      ...envelope(booking, at(2)),
      eventType: "booking.picked_up" as const,
      payload: {
        ...basePayload(booking, "CARRIER"),
        pickedUpAt: iso(booking.pickedUpAt),
        photoCount: booking.parcel.photoUrls.length || 1,
      },
    },
    {
      ...envelope(booking, at(3)),
      eventType: "booking.delivered" as const,
      payload: {
        ...basePayload(booking, "CARRIER"),
        deliveredAt: iso(booking.deliveredAt),
        payoutDueAt: iso(booking.payoutDueAt),
        attemptsUsed: 1,
      },
    },
    {
      ...envelope(booking, at(4)),
      eventType: "booking.completed" as const,
      payload: {
        ...basePayload(booking, "SYSTEM"),
        completedAt: iso(booking.completedAt),
        completedBy: "SYSTEM" as const,
      },
    },
  ];
}

async function main(): Promise<void> {
  // 1. Wipe ciblé — idempotence du seed, périmètre = ses propres rows.
  const wiped = await prisma.outboxEvent.deleteMany({
    where: { correlationId: SEED_CORRELATION_ID },
  });
  console.log(`Wipe : ${wiped.count} row(s) seed-outbox supprimée(s)`);

  // 2. Les vrais bookings du seed-deals (prérequis).
  const completed = await findBookingByStatus("COMPLETED");
  const pending = await findBookingByStatus("PENDING");
  if (!completed || !pending) {
    throw new Error(
      "Bookings COMPLETED/PENDING introuvables — lancer seed-deals d'abord : npx tsx packages/libs/prisma/scripts/seed-deals.ts"
    );
  }

  // 3. Construction + VALIDATION AU CONTRAT de chaque événement.
  const t0 = new Date();
  const events = [
    ...lifecycleEvents(completed, t0),
    {
      ...envelope(pending, new Date(t0.getTime() + 5000)),
      eventType: "booking.requested" as const,
      payload: { ...basePayload(pending, "SHIPPER"), expiresAt: iso(pending.expiresAt) },
    },
  ].map((candidate) => BookingDomainEventSchema.parse(candidate));

  // 4. Insertion — payload = l'événement COMPLET (enveloppe incluse),
  //    colonnes = copies dénormalisées (décision A24).
  await prisma.outboxEvent.createMany({
    data: events.map((event) => ({
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: JSON.parse(JSON.stringify(event)),
      correlationId: SEED_CORRELATION_ID,
      occurredAt: new Date(event.occurredAt),
      publishedAt: null,
    })),
  });
  console.log(
    `Insérés : ${events.length} événements valides (${new Set(events.map((e) => e.aggregateId)).size} agrégats)`
  );

  // 5. Option poison — payload volontairement HORS contrat.
  if (WITH_POISON) {
    await prisma.outboxEvent.create({
      data: {
        aggregateType: "booking",
        aggregateId: completed.id,
        eventType: "booking.requested",
        payload: { poison: true, reason: "seed-outbox --with-poison (preuve du parking)" },
        correlationId: SEED_CORRELATION_ID,
        occurredAt: new Date(t0.getTime() + 6000),
        publishedAt: null,
      },
    });
    console.log("Inséré : 1 row POISON (attendu : parking à 10 tentatives, log PARKED)");
  }

  console.log(
    "\nSmoke : démarrer le deal-service puis\n  docker exec yamba-redpanda rpk topic consume booking-events -n " +
    `${events.length}\nAttendu : ${events.length} messages, ordre du cycle de vie respecté pour l'agrégat ${completed.id}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
