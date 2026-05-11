import { randomBytes } from "crypto";
import prisma from "@packages/libs/prisma";

const MAX_SLUG_GENERATION_ATTEMPTS = 5;

/**
 * Normalise une chaîne pour usage dans un slug :
 * lowercase, sans accents, alphanumériques uniquement.
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
 * Génère un suffixe aléatoire 5 caractères alphanumériques (lowercase).
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
 * Construit un slug depuis firstName + lastInitial + suffixRandom.
 * Ex: "Enrique", "Tetelimba" → "enrique-t-x9k2m"
 */
function buildSlug(firstName: string, lastName: string): string {
  const first = normalizeForSlug(firstName) || "user";
  const initial = normalizeForSlug(lastName.charAt(0)) || "x";
  const suffix = randomSuffix();
  return `${first}-${initial}-${suffix}`;
}

/**
 * Génère un publicSlug unique non-collisionnel, en checkant la DB.
 * Au-delà de 5 essais infructueux, throw — devrait jamais arriver vu
 * la cardinalité du suffixe.
 *
 * À utiliser à l'inscription user (verifyRegistrationOtp).
 */
export async function generateUniquePublicSlug(
  firstName: string,
  lastName: string
): Promise<string> {
  for (let attempt = 0; attempt < MAX_SLUG_GENERATION_ATTEMPTS; attempt++) {
    const slug = buildSlug(firstName, lastName);
    const existing = await prisma.user.findUnique({
      where: { publicSlug: slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  throw new Error(
    `Failed to generate unique publicSlug after ${MAX_SLUG_GENERATION_ATTEMPTS} attempts`
  );
}
