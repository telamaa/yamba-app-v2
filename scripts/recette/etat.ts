/** Inspecte trajets / réservations / page Voyageur — outil transverse de la campagne. */
import prisma from "../../packages/libs/prisma";
(async () => {
  const [quoi, id] = process.argv.slice(2);
  if (quoi === "trip") {
    const t: any = await prisma.trip.findUnique({ where: { id }, select: { id: true, status: true, isDeleted: true, arrivalAt: true, departureAt: true, userId: true } });
    const b = await prisma.booking.findMany({ where: { tripId: id }, select: { id: true, status: true } });
    const p: any = t && (await prisma.carrierPage.findUnique({ where: { userId: t.userId }, select: { totalTripsPublished: true } }));
    console.log(JSON.stringify({ trip: t, bookings: b, totalTripsPublished: p?.totalTripsPublished ?? null }, null, 1));
  } else if (quoi === "booking") {
    const b: any = await prisma.booking.findUnique({ where: { id } });
    console.log(JSON.stringify(b, null, 1));
  }
  process.exit(0);
})();
