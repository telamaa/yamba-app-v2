import prisma from "../../packages/libs/prisma";
(async () => {
  const r: any[] = await prisma.review.findMany({ where: { bookingId: process.argv[2] }, select: { kind: true, revealedAt: true, rating: true } });
  console.log("avis :", r.length, r.map((x) => `${x.kind}:${x.rating}★ révélé=${x.revealedAt ? "oui" : "non"}`).join(" | ") || "(aucun)");
  const b: any = await prisma.booking.findUnique({ where: { id: process.argv[2] }, select: { ratingsRevealedAt: true, shipperRatedAt: true, carrierRatedAt: true } });
  console.log("booking :", JSON.stringify(b));
  process.exit(0);
})();
