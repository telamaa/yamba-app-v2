/**
 * repair-absent-scalars.ts — pose les scalaires absents sur les documents existants
 * ====================================================================================
 * Pitfall Prisma+Mongo, SIXIÈME occurrence — et la première sur `User`. Un champ ABSENT du
 * document n'est matché par AUCUN filtre : `where: { isDeleted: false }` ne trouve pas un compte
 * dont le champ n'a jamais été écrit, alors que Prisma le RELIT à `false` (valeur par défaut du
 * schéma). Le défaut est donc invisible à la lecture et silencieux à la requête.
 *
 * Trouvé le 08/09/2026 en soldant la dette D-5 : `GET /users/{slug}/public` répondait **404 pour
 * 22 comptes sur 26**, parce que `publicProfileWhere` filtre sur `profilePublic`. La campagne de
 * recette ne l'avait pas vu : le jeu d'essai ÉCRIT ces champs, donc ils existent sur les comptes
 * du seed. « Une fixture qui pose le champ ne prouve rien sur le vrai writer. »
 *
 * Ce script pose la valeur par défaut du schéma sur les documents où le champ manque, via une
 * commande Mongo brute (`$exists: false`) — Prisma ne sait pas exprimer « champ absent » en
 * écriture. Il est IDEMPOTENT : relancé, il ne touche plus rien.
 *
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/repair-absent-scalars.ts
 *   npx tsx --env-file=.env packages/libs/prisma/scripts/repair-absent-scalars.ts --dry-run
 */
import prisma from "../index";

/**
 * Collection → { champ : valeur par défaut }, LUES DANS `prisma/schema.prisma` et recopiées ici.
 * Deux exclusions volontaires côté `User` :
 * - `emailVerified` n'existe pas sur le modèle (c'est un champ du profil Google) : l'écrire
 *   créerait un champ que le schéma ignore ;
 * - `adminRoles` a son propre script, `backfill-admin-roles.ts`, qui sait recopier le rôle
 *   principal dans la liste — poser `[]` à l'aveugle effacerait cette information.
 */
const DEFAUTS: Record<string, Record<string, string | boolean>> = {
  User: {
    isDeleted: false, //               @default(false)
    profilePublic: true, //            @default(true)
    accountStatus: "ACTIVE", //        @default(ACTIVE)
    messagingReminderEmails: true, //  @default(true)
    preferredLocale: "fr", //          @default("fr")
  },
  Trip: {
    isDeleted: false, //               @default(false) — 24 trajets sur 37 sans le champ, donc
    //                                 invisibles sur la page publique (`publicTripWhere`).
  },
  Booking: {
    isDeleted: false, //               @default(false)
  },
};

async function main() {
  const sec = process.argv.includes("--dry-run");
  if (sec) console.log("— simulation, aucune écriture —\n");
  let total = 0;
  for (const [collection, champs] of Object.entries(DEFAUTS)) {
    for (const [champ, defaut] of Object.entries(champs)) {
      const etiquette = `${collection}.${champ}`.padEnd(34);
      const avant = (await prisma.$runCommandRaw({ count: collection, query: { [champ]: { $exists: false } } })) as { n: number };
      if (avant.n === 0) {
        console.log(`· ${etiquette} rien à faire`);
        continue;
      }
      if (sec) {
        console.log(`· ${etiquette} ${avant.n} document(s) à réparer → ${JSON.stringify(defaut)}`);
        total += avant.n;
        continue;
      }
      const res = (await prisma.$runCommandRaw({
        update: collection,
        updates: [{ q: { [champ]: { $exists: false } }, u: { $set: { [champ]: defaut } }, multi: true }],
      })) as { nModified: number };
      console.log(`✓ ${etiquette} ${avant.n} absent(s) → ${res.nModified} réparé(s)`);
      total += res.nModified;
    }
  }
  console.log(`\n${sec ? "à réparer" : "réparés"} : ${total} champ(s) sur les documents existants.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
