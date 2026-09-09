/** Recule expiresAt d'une réservation PENDING pour la rendre expirable. */
import prisma from "../../packages/libs/prisma";
(async () => {
  const [id, minutes] = process.argv.slice(2);
  const m = Number(minutes ?? -60);
  const b: any = await prisma.booking.update({
    where: { id },
    data: { expiresAt: new Date(Date.now() + m * 60_000) },
    select: { id: true, status: true, expiresAt: true, tripId: true, pricing: true },
  });
  const t: any = await prisma.trip.findUnique({ where: { id: b.tripId }, select: { reservedKg: true } });
  console.log(JSON.stringify({ id: b.id, status: b.status, expiresAt: b.expiresAt, weightKg: b.pricing?.weightKg, totalShipperCents: b.pricing?.totalShipperCents, reservedKg: t?.reservedKg }));
  process.exit(0);
})();
