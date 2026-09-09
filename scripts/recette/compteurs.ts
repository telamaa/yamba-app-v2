import prisma from "../../packages/libs/prisma";
(async () => {
  const pages: any[] = await prisma.carrierPage.findMany({ select: { userId: true, totalTripsPublished: true } });
  const neg = pages.filter((p) => (p.totalTripsPublished ?? 0) < 0);
  console.log("pages Voyageur :", pages.length, "| compteur NÉGATIF :", neg.length);
  for (const p of neg) console.log("  ", p.userId, "→", p.totalTripsPublished);
  const parValeur: Record<string, number> = {};
  for (const p of pages) parValeur[String(p.totalTripsPublished)] = (parValeur[String(p.totalTripsPublished)] ?? 0) + 1;
  console.log("distribution :", JSON.stringify(parValeur));
  process.exit(0);
})();
