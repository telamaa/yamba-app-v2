/**
 * seed-admins.ts — les sept comptes du back-office de recette (RECETTE-02-ADMIN § 2.5)
 * ====================================================================================
 * Le cahier crée ces comptes « comme des membres ordinaires puis promus par grant-admin.ts »,
 * et enrôle leur double authentification à la main avec une application TOTP. Ce script fait
 * exactement cela, de façon rejouable — c'est la remise à zéro du harnais navigateur :
 *
 *   1. **le membre** : upsert par `emailNormalized`, mot de passe commun du seed
 *      (`Yamba-Dev-2026!`, secret de dev assumé, comme `seed-deals.ts`) ;
 *   2. **les profils** : la même écriture que `grant-admin.ts` (`roles` + ADMIN, `adminRole`
 *      miroir du premier profil, `adminRoles` = la liste, D60 1A) ;
 *   3. **la 2FA** : un secret TOTP NEUF, chiffré comme le fait `/auth/admin/totp/setup`
 *      (`encryptTotpSecret`, clé `TOTP_ENCRYPTION_KEY` ou clé de dev), huit codes de secours
 *      hachés — et le secret + les codes EN CLAIR dans `seed-admins-output.json` (jamais
 *      versionné) pour que le harnais CALCULE le code à six chiffres, comme la campagne API.
 *
 * Le compte est aussi remis en état de marche (`accountStatus` ACTIVE, non supprimé, email non
 * supprimé) : un scénario de sanction ou d'effacement ne doit pas laisser le suivant sans admin.
 *
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/seed-admins.ts          # rejoue tout
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/seed-admins.ts --show   # lit la sortie
 *
 * Ce script ne touche NI aux sessions ouvertes (Redis) NI au journal d'audit : enrôler par ce
 * chemin n'écrit pas `ADMIN_TOTP_ENABLED` — le premier enrôlement par l'écran (ADM-SEC-2) se
 * joue sur un compte que le scénario réinitialise lui-même (`grant-admin.ts --revoke`, puis
 * une nouvelle attribution).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import prisma from "../index";
import { encryptTotpSecret, generateBackupCodes, generateTotpSecret, hashBackupCode } from "../../totp/src/index";

type Profil = "SUPER_ADMIN" | "MEDIATOR" | "SUPPORT" | "FINANCE" | "OPS" | "PRIVACY";

interface AdminDeRecette {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Profil[];
}

/** Les adresses et prénoms sont ceux du cahier (§ 2.5, § 4.3) — Mailpit accepte tout domaine. */
const ADMINS: AdminDeRecette[] = [
  { key: "super", email: "super@recette.yamba.dev", firstName: "Sacha", lastName: "Superviseur", roles: ["SUPER_ADMIN"] },
  { key: "mediateur", email: "mediateur@recette.yamba.dev", firstName: "Nadia", lastName: "Médiatrice", roles: ["MEDIATOR"] },
  { key: "support", email: "support@recette.yamba.dev", firstName: "Sami", lastName: "Support", roles: ["SUPPORT"] },
  { key: "exploitation", email: "exploitation@recette.yamba.dev", firstName: "Olivier", lastName: "Exploitation", roles: ["OPS"] },
  { key: "finance", email: "finance@recette.yamba.dev", firstName: "Fatou", lastName: "Finance", roles: ["FINANCE"] },
  { key: "privacy", email: "privacy@recette.yamba.dev", firstName: "Paul", lastName: "Privacy", roles: ["PRIVACY"] },
  // Profils cumulés = UNION des permissions (D60 1A) — scénario ADM-PRM-7.
  { key: "cumul", email: "cumul@recette.yamba.dev", firstName: "Camille", lastName: "Cumul", roles: ["SUPPORT", "FINANCE"] },
];

const SORTIE = join(__dirname, "seed-admins-output.json");
const SEED_PASSWORD_HASH = bcrypt.hashSync("Yamba-Dev-2026!", 10);
const days = (n: number) => new Date(Date.now() + n * 86_400_000);

async function main() {
  if (process.argv.includes("--show")) {
    if (!existsSync(SORTIE)) {
      console.error("Aucune sortie : joue d'abord le seed.");
      process.exit(1);
    }
    console.log(readFileSync(SORTIE, "utf-8"));
    return;
  }

  console.log("🌱 Seed admins — les sept comptes du back-office de recette\n");
  const sortie: Record<string, { id: string; email: string; roles: Profil[]; secret: string; backupCodes: string[] }> = {};

  for (const a of ADMINS) {
    const secret = generateTotpSecret();
    const backupCodes = generateBackupCodes();
    const enrolement = {
      totpSecretEncrypted: encryptTotpSecret(secret),
      totpEnabledAt: new Date(),
      totpLastUsedStep: null,
      totpBackupCodeHashes: backupCodes.map(hashBackupCode),
    };
    const profils = { adminRole: a.roles[0], adminRoles: a.roles };

    const existant = await prisma.user.findUnique({ where: { emailNormalized: a.email.toLowerCase() }, select: { roles: true } });
    const roles: Role[] = existant ? (existant.roles.includes("ADMIN") ? existant.roles : [...existant.roles, "ADMIN"]) : ["SHIPPER", "ADMIN"];

    const user = await prisma.user.upsert({
      where: { emailNormalized: a.email.toLowerCase() },
      update: {
        firstName: a.firstName,
        lastName: a.lastName,
        passwordHash: SEED_PASSWORD_HASH,
        roles,
        ...profils,
        ...enrolement,
        accountStatus: "ACTIVE",
        isDeleted: false,
        emailSuppressedAt: null,
      },
      create: {
        firstName: a.firstName,
        lastName: a.lastName,
        email: a.email,
        emailNormalized: a.email.toLowerCase(),
        passwordHash: SEED_PASSWORD_HASH,
        publicSlug: `recette-admin-${a.key}`, // String? @unique — deux nulls collisionnent sur Mongo
        roles,
        ...profils,
        ...enrolement,
        carrierStatus: "NONE",
        createdAt: days(-90),
      },
    });
    sortie[a.key] = { id: user.id, email: a.email, roles: a.roles, secret, backupCodes };
    console.log(`✓ ${a.email.padEnd(34)} ${a.roles.join(" + ").padEnd(18)} 2FA enrôlée`);
  }

  writeFileSync(SORTIE, JSON.stringify({ generatedAt: new Date().toISOString(), admins: sortie }, null, 2));
  console.log(`\n→ ${SORTIE}\n  (secrets TOTP et codes de secours en clair : poste de recette seulement, jamais versionné)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
