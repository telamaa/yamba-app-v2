import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * d2-ecrivains-outbox.spec.ts — D2 vérifiée sur TOUS les écrivains, y compris ceux de demain
 * ===========================================================================================
 * Règle non négociable du dépôt : « aucun changement d'état sans événement outbox dans la MÊME
 * transaction » (D2).
 *
 * A197 a rendu cette règle **exécutable** sur les deux écrivains qui portent les invariants
 * (`booking-write.ts` et `conversation.service.ts`) : deux fiches pilotent le code réel avec un client
 * de test qui journalise la provenance de chaque appel. C'est la meilleure preuve — mais elle coûte
 * cher, elle est écrite écrivain par écrivain, et **elle ne dit rien de l'écrivain ajouté demain**.
 *
 * L'inventaire du 18/09 l'a montré : sur les QUATRE endroits du dépôt qui écrivent dans l'outbox, deux
 * n'avaient aucune garde — `deal-request.service.ts` et `deal-mediation.service.ts`. Les deux
 * respectent D2 aujourd'hui ; rien ne les empêchait de cesser de le faire.
 *
 * Cette fiche est le filet à mailles larges qui complète les deux fiches à mailles fines : elle
 * n'ouvre aucune base, ne pilote aucun service, et **lit la source**. Elle vérifie une propriété
 * syntaxique, plus faible qu'un comportement mesuré, mais qui a deux qualités que l'autre n'a pas :
 * elle couvre **tout le dépôt**, et elle couvre **ce qui n'est pas encore écrit**.
 *
 * Même famille que les gardes déjà en place : `seed-integrity` lit le seed, `outbox-purge` lit la
 * source du cron pour interdire le retour d'un filtre nu, `refusal-codes` lit les contrôleurs.
 *
 * Ce qu'elle NE prouve pas, et qu'il faut savoir : qu'un `tx` passé en argument soit bien celui d'une
 * transaction ouverte. C'est le travail des deux fiches pilotées. Les deux filets sont complémentaires ;
 * aucun ne remplace l'autre.
 */

/** Les sources de production des cinq services (ni fiches de test, ni scripts de recette ou de seed). */
function sourcesDeProduction(): Array<{ chemin: string; code: string }> {
  const racine = join(__dirname, "../../../../apps");
  const trouvees: Array<{ chemin: string; code: string }> = [];

  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier)) {
      const complet = join(dossier, entree);
      if (statSync(complet).isDirectory()) {
        if (entree === "node_modules" || entree === "dist" || entree === ".next") continue;
        parcourir(complet);
        continue;
      }
      if (!entree.endsWith(".ts") || entree.endsWith(".spec.ts") || entree.endsWith(".test.ts")) continue;
      trouvees.push({ chemin: complet.slice(complet.indexOf("apps/")), code: readFileSync(complet, "utf-8") });
    }
  };

  for (const service of readdirSync(racine)) {
    const src = join(racine, service, "src");
    try {
      if (statSync(src).isDirectory()) parcourir(src);
    } catch {
      continue; // un projet sans `src` (le harnais e2e, par exemple)
    }
  }
  return trouvees;
}

/**
 * `await tx.outboxEvent.create({…})` → le RÉCEPTEUR (`tx`), c'est lui qui nous intéresse.
 *
 * **Seules `create` et `createMany` comptent**, et c'est un resserrement délibéré, fait après avoir vu
 * la règle trop large lever dix signalements tous légitimes : le relais (`outbox-relay.ts`,
 * `messaging-relay.ts`) marque `publishedAt` et `attempts` sur le client global, et le cron de
 * conservation purge les lignes publiées. Ces écritures portent sur le **cycle de vie** d'un événement
 * déjà produit, pas sur sa production — et elles ont de bonnes raisons d'être hors transaction :
 * elles n'accompagnent aucun changement d'état du domaine.
 *
 * D2 dit « aucun changement d'état sans son événement dans la MÊME transaction ». C'est la NAISSANCE
 * de l'événement qui doit être atomique avec l'état. Élargir la règle à `update` ou `delete` aurait
 * fabriqué huit faux positifs — et un garde-fou qui crie à tort est un garde-fou qu'on désarme.
 */
const ECRITURE_OUTBOX = /(\w+)\s*\.\s*outboxEvent\s*\.\s*(create|createMany)\s*\(/g;

const sources = sourcesDeProduction();

describe("D2 — tout écrivain de l'outbox écrit sur un client de TRANSACTION", () => {
  it("l'inventaire n'est pas vide (sinon cette fiche ne prouverait rien)", () => {
    expect(sources.length).toBeGreaterThan(50);
    const ecrivains = sources.filter((s) => /\.outboxEvent\s*\.\s*(create|createMany)/.test(s.code));
    expect(ecrivains.length).toBeGreaterThanOrEqual(3);
  });

  it("aucune écriture d'outbox sur le client GLOBAL — toujours sur le client de transaction", () => {
    const fautifs: string[] = [];
    for (const { chemin, code } of sources) {
      for (const m of code.matchAll(ECRITURE_OUTBOX)) {
        const recepteur = m[1];
        // `prisma` et `db` sont les noms du client global dans ce dépôt ; un client de transaction
        // s'appelle `tx` (ou porte tout autre nom — ce qui compte est qu'il ne soit PAS le global).
        if (recepteur === "prisma" || recepteur === "db") {
          fautifs.push(`${chemin} — ${recepteur}.outboxEvent.${m[2]}(…) : hors transaction`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("tout fichier qui écrit dans l'outbox ouvre bien une transaction", () => {
    const sansTransaction: string[] = [];
    for (const { chemin, code } of sources) {
      if (!/\.outboxEvent\s*\.\s*(create|createMany)/.test(code)) continue;
      // Soit le fichier ouvre lui-même une transaction, soit il REÇOIT le `tx` de son appelant
      // (`auditedOutbox(tx, …)` dans la médiation) — les deux sont légitimes.
      const ouvre = /\$transaction\s*\(/.test(code);
      const recoit = /\(\s*tx\s*:|,\s*tx\s*:|\btx\s*:\s*typeof\s+prisma/.test(code);
      if (!ouvre && !recoit) sansTransaction.push(chemin);
    }
    expect(sansTransaction).toEqual([]);
  });

  it("le garde-fou attrape bien le défaut qu'il prétend interdire (vu ROUGE)", () => {
    // La contre-épreuve : on rejoue la règle sur une source FABRIQUÉE qui porte le défaut d'A197 —
    // l'état écrit dans la transaction, l'événement écrit dehors, sur le client global.
    const fautive = `
      await prisma.$transaction(async (tx) => { await tx.booking.updateMany({}); });
      await prisma.outboxEvent.create({ data: {} });
    `;
    const fautifs = [...fautive.matchAll(ECRITURE_OUTBOX)].filter((m) => m[1] === "prisma" || m[1] === "db");
    expect(fautifs).toHaveLength(1);

    // Et le cas correct ne déclenche rien.
    const saine = `await prisma.$transaction(async (tx) => { await tx.outboxEvent.create({ data: {} }); });`;
    expect([...saine.matchAll(ECRITURE_OUTBOX)].filter((m) => m[1] === "prisma" || m[1] === "db")).toHaveLength(0);
  });
});
