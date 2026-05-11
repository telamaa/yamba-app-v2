/**
 * Script one-shot — Génère un publicSlug unique pour chaque user existant.
 *
 * Usage :
 *   npx tsx packages/libs/prisma/scripts/backfill-public-slug.ts
 *
 * Doit être exécuté AVANT `npx prisma db push` quand on ajoute le champ
 * publicSlug @unique pour la première fois (sinon erreur duplicate key sur null).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

/**
 * Normalise une chaîne pour usage dans un slug :
 * - lowercase
 * - retire les accents (NFD + retrait des marques diacritiques)
 * - remplace tout caractère non alphanumérique par un tiret
 * - retire les tirets en début/fin
 */
function normalizeForSlug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Suffixe aléatoire 5 caractères alphanumériques.
 * 36^5 ≈ 60M combinaisons → collision ultra rare au volume MVP.
 */
function randomSuffix(): string {
  return randomBytes(8)
    .toString("base64")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .slice(0, 5);
}

/**
 * Construit un slug à partir d'un user. Format : `prenom-initiale-suffix`
 * Ex: { firstName: "Enrique", lastName: "Tetelimba" } → "enrique-t-x9k2m"
 */
function buildSlug(firstName: string, lastName: string): string {
  const first = normalizeForSlug(firstName) || "user";
  const initial = normalizeForSlug(lastName.charAt(0)) || "x";
  const suffix = randomSuffix();
  return `${first}-${initial}-${suffix}`;
}

async function generateUniqueSlug(
  firstName: string,
  lastName: string,
  maxAttempts = 5
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const slug = buildSlug(firstName, lastName);
    const existing = await prisma.user.findFirst({
      where: { publicSlug: slug }, // ← Ici OK car on cherche un slug spécifique non-null
      select: { id: true },
    });
    if (!existing) return slug;
    console.warn(`Collision détectée sur "${slug}", retry ${attempt + 1}...`);
  }
  throw new Error(
    `Impossible de générer un slug unique après ${maxAttempts} tentatives`
  );
}

async function main() {
  console.log("🔍 Recherche des users sans publicSlug...");

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { publicSlug: null },
        { publicSlug: { isSet: false } },
      ],
    },
    select: { id: true, firstName: true, lastName: true },
  });

  console.log(`📋 ${users.length} user(s) à backfiller\n`);

  if (users.length === 0) {
    console.log("✅ Aucun user à mettre à jour. Tu peux lancer prisma db push.");
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const slug = await generateUniqueSlug(user.firstName, user.lastName);
      await prisma.user.update({
        where: { id: user.id },
        data: { publicSlug: slug },
      });
      console.log(
        `✓ ${user.firstName} ${user.lastName.charAt(0)}. → ${slug}`
      );
      updated++;
    } catch (err) {
      console.error(
        `✗ Échec pour user ${user.id} (${user.firstName} ${user.lastName}):`,
        err
      );
      failed++;
    }
  }

  console.log("\n─────────────────────────────────────────");
  console.log(`✅ ${updated} user(s) mis à jour`);
  if (failed > 0) console.log(`❌ ${failed} échec(s)`);
  console.log("─────────────────────────────────────────");
  console.log("\nTu peux maintenant lancer : npx prisma db push");
}

main()
  .catch((e) => {
    console.error("❌ Erreur fatale :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
