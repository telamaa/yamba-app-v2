import prisma from "../../packages/libs/prisma";
(async () => {
  const [ID, heures] = process.argv.slice(2);
  const cree = new Date(Date.now() - Number(heures ?? 25) * 3_600_000);
  await prisma.user.update({ where: { id: ID }, data: { carrierStatus: "ONBOARDING", isDeleted: false, emailSuppressedAt: null } as never });
  const p: any = await prisma.carrierPage.findUnique({ where: { userId: ID }, select: { id: true } });
  if (p) await prisma.$runCommandRaw({ update: "CarrierPage", updates: [{ q: { _id: { $oid: p.id } }, u: { $set: { createdAt: { $date: cree.toISOString() }, onboardingRemindersSent: 0 } }, multi: false }] });
  const u: any = await prisma.user.findUnique({ where: { id: ID }, select: { email: true, carrierStatus: true } });
  console.log(JSON.stringify({ email: u.email, carrierStatus: u.carrierStatus, pageCreee: cree.toISOString(), rappelsEnvoyes: 0 }));
  process.exit(0);
})();
