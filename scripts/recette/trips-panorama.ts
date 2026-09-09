import prisma from "../../packages/libs/prisma";
import fs from "node:fs";
(async () => {
  const seed = JSON.parse(fs.readFileSync("packages/libs/prisma/scripts/seed-output.json", "utf-8"));
  for (const [cle, id] of Object.entries(seed.trips as Record<string, string>)) {
    const t: any = await prisma.trip.findUnique({ where: { id }, select: { status: true, arrivalAt: true } });
    const b = await prisma.booking.findMany({ where: { tripId: id }, select: { status: true } });
    console.log(`${cle.padEnd(14)} ${String(t?.status).padEnd(10)} ${b.map((x: any) => x.status).join(",") || "(aucune)"}`);
  }
  process.exit(0);
})();
