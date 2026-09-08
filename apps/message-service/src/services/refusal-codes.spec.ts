import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * ANO-API-20 (recette API 08/09/2026, fiche API-IDEM-08) — deux acceptations simultanées du même
 * rendez-vous : la garde optimiste répondait bien **400**, mais avec une phrase anglaise et
 * **sans `details.code`**. Le front ne pouvait ni traduire le refus, ni le distinguer d'une saisie
 * invalide. Pire, la raison lisible par la machine était **collée dans la phrase**
 * (« This conversation is read-only (DISPUTE_OPEN). ») : lisible par un humain anglophone,
 * inexploitable par un programme.
 *
 * La règle non négociable est pourtant écrite : « un refus métier porte un `details.code`, et ce
 * code atteint le client ». Ce test la fait respecter à la SOURCE plutôt qu'à la relecture : il lit
 * les services de message-service et refuse tout jet d'erreur métier sans `code`.
 *
 * Les erreurs de VALIDATION de forme (schéma Zod dans les contrôleurs) en sont exclues : elles
 * portent déjà la liste des champs fautifs, qui est leur contrat.
 */
describe("message-service — tout refus métier porte un `details.code`", () => {
  const services = join(__dirname);

  const fichiers = (dir: string): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) return fichiers(p);
      return p.endsWith(".ts") && !p.endsWith(".spec.ts") ? [p] : [];
    });

  /** Le contenu d'un appel `Erreur(...)` dont la parenthèse ouvrante vient d'être consommée. */
  const argumentsDe = (code: string, apresParenthese: number): string => {
    let i = apresParenthese;
    let profondeur = 1;
    while (i < code.length && profondeur > 0) {
      if (code[i] === "(") profondeur++;
      else if (code[i] === ")") profondeur--;
      i++;
    }
    return code.slice(apresParenthese, i - 1);
  };

  const jets = (): Array<{ fichier: string; ligne: number; classe: string; args: string }> => {
    const trouves: Array<{ fichier: string; ligne: number; classe: string; args: string }> = [];
    for (const f of fichiers(services)) {
      const code = readFileSync(f, "utf-8");
      for (const m of code.matchAll(/new (ValidationError|ForbiddenError|NotFoundError|ConflictError|AuthError)\(/g)) {
        trouves.push({
          fichier: f.slice(services.length + 1),
          ligne: code.slice(0, m.index).split("\n").length,
          classe: m[1],
          args: argumentsDe(code, m.index! + m[0].length),
        });
      }
    }
    return trouves;
  };

  it("le test trouve bien des refus à vérifier (garde-fou du garde-fou)", () => {
    expect(jets().length).toBeGreaterThanOrEqual(10);
  });

  it("aucun refus métier ne part sans code", () => {
    const sansCode = jets()
      .filter((j) => !/code:/.test(j.args))
      .map((j) => `${j.fichier}:${j.ligne} → ${j.classe}`);
    expect(sansCode).toEqual([]);
  });

  it("aucune raison machine n'est cachée dans la phrase du message", () => {
    // « (${check.reason}) » et consorts : la raison appartient à `details`, pas au texte.
    const dansLaPhrase = jets()
      .filter((j) => /\(\$\{[^}]*reason[^}]*\}\)/.test(j.args))
      .map((j) => `${j.fichier}:${j.ligne}`);
    expect(dansLaPhrase).toEqual([]);
  });
});
