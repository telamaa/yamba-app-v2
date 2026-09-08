import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ANO-API-13 (recette API 08/09/2026, fiche API-DEAL-22, bloquante) — la page de suivi du
 * destinataire répondait 500 : `tracking-link.service.ts` demandait `cancelledAt` sur
 * `Booking`, un champ qui n'existe pas (le seul champ d'annulation est `cancelReason`).
 * La fonctionnalité était donc **entièrement** inopérante, et rien ne l'avait signalé.
 *
 * C'est le DEUXIÈME cas identique de la campagne : `ANO-API-09` avait cassé l'export RGPD
 * de la même façon, dans auth-service. Un test avait alors été écrit pour ce service ; le
 * défaut est réapparu ailleurs — donc le garde-fou doit couvrir le service entier, pas un
 * fichier.
 *
 * Ce test ne mocke rien et n'ouvre aucune base : il LIT les sources de deal-service, en
 * extrait chaque `select: { … }` posé sur un modèle Prisma, et confronte les champs
 * demandés à `prisma/schema.prisma`. Un champ inventé fait échouer la suite, sans attendre
 * qu'un utilisateur tombe sur un 500.
 */
describe("deal-service — les `select` Prisma ne demandent que des champs qui existent", () => {
  const racine = join(__dirname, "../../../..");
  const src = join(__dirname, "..");

  const modeles = (): Record<string, Set<string>> => {
    const schema = readFileSync(join(racine, "prisma/schema.prisma"), "utf-8");
    const out: Record<string, Set<string>> = {};
    for (const m of schema.matchAll(/^model (\w+) \{(.*?)^\}/gms)) {
      out[m[1]] = new Set(
        m[2]
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))
          .map((l) => l.split(/\s+/)[0])
      );
    }
    return out;
  };

  const fichiers = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) return fichiers(p);
      return p.endsWith(".ts") && !p.endsWith(".spec.ts") ? [p] : [];
    });

  /** Le contenu d'un bloc `{ … }` dont l'ouverture vient d'être consommée. */
  const blocEquilibre = (code: string, apresAccolade: number): string => {
    let i = apresAccolade;
    let profondeur = 1;
    while (i < code.length && profondeur > 0) {
      if (code[i] === "{") profondeur++;
      else if (code[i] === "}") profondeur--;
      i++;
    }
    return code.slice(apresAccolade, i - 1);
  };

  /** Les clés `champ: true` du PREMIER niveau — les sous-sélections d'une relation
   *  appartiennent à un autre modèle et sont donc retirées avant l'analyse. */
  const champsDePremierNiveau = (bloc: string): string[] => {
    let plat = bloc;
    let precedent: string;
    do {
      precedent = plat;
      plat = plat.replace(/\{[^{}]*\}/g, "");
    } while (plat !== precedent);
    return [...plat.matchAll(/(\w+)\s*:\s*true/g)].map((c) => c[1]);
  };

  /** `prisma.booking.findMany({ … select: { a: true, b: true } })` → { Booking, [a, b] } */
  const selects = (): Array<{ fichier: string; modele: string; champs: string[] }> => {
    const trouves: Array<{ fichier: string; modele: string; champs: string[] }> = [];
    for (const f of fichiers(src)) {
      const code = readFileSync(f, "utf-8");
      for (const appel of code.matchAll(
        /(?:prisma|db|tx)\.(\w+)\.(?:findMany|findFirst|findUnique|findUniqueOrThrow|update|create|upsert)!?\(\{/g
      )) {
        // Bornée à l'objet d'arguments de CET appel : sans cela, un appel sans `select`
        // emprunterait celui de l'appel suivant et le test crierait au loup.
        const args = blocEquilibre(code, appel.index + appel[0].length);
        const ouverture = /(?:^|[\s,{])select:\s*\{/.exec(args);
        if (!ouverture) continue;
        const bloc = blocEquilibre(args, ouverture.index + ouverture[0].length);
        const champs = champsDePremierNiveau(bloc);
        if (champs.length) {
          trouves.push({ fichier: f.slice(src.length + 1), modele: appel[1], champs });
        }
      }
    }
    return trouves;
  };

  it("le test trouve bien des requêtes à vérifier (garde-fou du garde-fou)", () => {
    const t = selects();
    expect(t.length).toBeGreaterThanOrEqual(15);
  });

  it("aucun `select` ne demande un champ absent du modèle", () => {
    const schema = modeles();
    const fautifs: string[] = [];
    for (const { fichier, modele, champs } of selects()) {
      const nom = modele.charAt(0).toUpperCase() + modele.slice(1);
      const connus = schema[nom];
      if (!connus) continue; // accesseur qui n'est pas un modèle (ex. `db.$transaction`)
      for (const champ of champs) {
        if (!connus.has(champ)) fautifs.push(`${fichier} → ${nom}.${champ}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("le cas exact d'ANO-API-13 reste attrapé : Booking n'a pas de `cancelledAt`", () => {
    const schema = modeles();
    expect(schema["Booking"].has("cancelledAt")).toBe(false);
    expect(schema["Booking"].has("cancelReason")).toBe(true);
  });
});
