/** Rend un trajet éligible à complete-trips (arrivée passée de N jours). */
import prisma from "../../packages/libs/prisma";
const ID = process.argv[2];
const JOURS = Number(process.argv[3] ?? 3);
(async () => {
  const t = await prisma.trip.update({
    where: { id: ID },
    data: {
      isDeleted: false,
      departureAt: new Date(Date.now() - (JOURS + 1) * 86_400_000),
      arrivalAt: new Date(Date.now() - JOURS * 86_400_000),
    },
    select: { id: true, status: true, arrivalAt: true, userId: true },
  });
  console.log("éligible :", t.id, t.status, t.arrivalAt?.toISOString());
  process.exit(0);
})();
