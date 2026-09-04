/**
 * backfill-admin-roles.ts — reprise des profils cumulés (C-PR3bis, D60 1A)
 * ========================================================================
 * Les comptes admin d'avant C-PR3bis ont `adminRole` mais pas `adminRoles` (liste ABSENTE : aucun filtre
 * Prisma ne la matche — pitfall Mongo). On relit chaque compte admin et on pose `adminRoles = [adminRole]`
 * quand la liste est absente ou vide. Idempotent, à jouer une fois après `npx prisma db push`.
 *
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/backfill-admin-roles.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({ where: { adminRole: { not: null }, isDeleted: false }, select: { id: true, email: true, adminRole: true, adminRoles: true } });
  let fixed = 0;
  for (const u of admins) {
    if ((u.adminRoles ?? []).length > 0 || !u.adminRole) continue;
    await prisma.user.update({ where: { id: u.id }, data: { adminRoles: [u.adminRole] } });
    fixed += 1;
    console.log(`  · ${u.email} → adminRoles = [${u.adminRole}]`);
  }
  console.log(`${admins.length} compte(s) admin lus, ${fixed} repris.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
