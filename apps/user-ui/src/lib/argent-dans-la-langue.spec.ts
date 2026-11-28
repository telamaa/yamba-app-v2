/**
 * argent-dans-la-langue.spec.ts — D123, côté site.
 * ================================================
 * Le défaut a été VU sur le téléphone en anglais (« You earn 23.00 € »), mais
 * le site portait la moitié la plus coûteuse : **quinze copies locales** de la
 * même fonction `formatEur`, et elles divergeaient DÉJÀ —
 *
 *   • trois règles de décimales : `0` (×3), `amount % 1 === 0 ? 0 : 2` (×11),
 *     `digits` paramétrable (×1) ;
 *   • deux étiquettes anglaises : `en-US` (×13), `en-GB` (×1) ;
 *   • une seizième, exportée depuis le wizard de publication, figée sur
 *     `"fr-FR"` — donc la virgule française dans toute l'interface anglaise.
 *
 * Le même montant s'écrivait « 24 € » sur un écran et « 24,00 € » sur le
 * suivant, dans le même tunnel. Quinze copies ne divergent pas par
 * négligence : elles divergent MÉCANIQUEMENT, parce que chaque auteur tranche
 * à nouveau une question que rien ne lui a tranchée. C'est la leçon de D110
 * (`max-w-7xl` recopié 51 fois), appliquée à de l'argent.
 *
 * La fiche interdit la seizième copie et vérifie le comportement du module
 * partagé. Elle dépouille les commentaires avant de chercher — cinq d'entre
 * eux citent le défaut pour l'expliquer.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  DEFAULT_CURRENCY,
  formatMoney,
  formatMoneyCompact,
  formatMoneyFromCents,
  formatPerKg,
} from "./pricing-example";
import { formatPriceShort } from "./public-user.helpers";

const RACINE = resolve(__dirname, "..");
const MODULE_PARTAGE = join(RACINE, "lib/pricing-example.ts");

function fichiers(dossier: string, extensions: string[]): string[] {
  const trouves: string[] = [];
  const parcourir = (chemin: string) => {
    for (const entree of readdirSync(chemin)) {
      const complet = join(chemin, entree);
      if (statSync(complet).isDirectory()) parcourir(complet);
      else if (extensions.some((e) => entree.endsWith(e)) && !entree.endsWith(".spec.ts"))
        trouves.push(complet);
    }
  };
  parcourir(join(RACINE, dossier));
  return trouves;
}

function sansCommentaires(source: string): string {
  const net = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // Le garde du dépouilleur : s'il y avait du code, il doit en rester. On ne
  // mesure pas un ratio (plusieurs fichiers de ce dépôt sont surtout du
  // commentaire) et on tolère un fichier qui n'a jamais eu de code — son
  // premier passage en a d'ailleurs trouvé QUATRE, entièrement vides et
  // pourtant suivis par git ; ils ont été supprimés.
  const marqueurs = /\b(import|export|const|function|return)\b/;
  if (marqueurs.test(source)) expect(net).toMatch(marqueurs);
  return net;
}

/* ══ ① Le comportement, identique au téléphone ═══════════════════════════ */

describe("① un montant s’écrit dans la langue du lecteur, symbole compris", () => {
  it("le français met le symbole APRÈS, l’anglais AVANT", () => {
    const fr = formatMoneyFromCents(2300, "fr-FR");
    const en = formatMoneyFromCents(2300, "en-US");
    expect(fr.indexOf("€")).toBeGreaterThan(fr.indexOf("23"));
    expect(en.indexOf("€")).toBeLessThan(en.indexOf("23"));
  });

  it("deux décimales toujours — la divergence des quinze copies disparaît", () => {
    expect(formatMoney(3, "fr-FR")).toContain("3,00");
    expect(formatMoney(24.85, "en-US")).toContain("24.85");
  });

  it("une graduation garde ses décimales SIGNIFICATIVES", () => {
    expect(formatMoneyCompact(8, "fr-FR")).not.toContain("8,00");
    expect(formatMoneyCompact(11.5, "en-US")).toContain("11.5");
  });

  it("un tarif au kilo porte son unité", () => {
    expect(formatPerKg(11.5, "fr-FR")).toContain("/kg");
    expect(formatPerKg(11.5, "en-US").startsWith("€")).toBe(true);
  });

  it("la devise est un CODE", () => {
    expect(DEFAULT_CURRENCY).toBe("EUR");
    expect(formatMoneyFromCents(2300, "en-US", "USD")).toContain("$");
  });
});

/* ══ ② La page publique ne rogne plus les centimes ═══════════════════════ */

describe("② `formatPriceShort` — court, jamais faux", () => {
  it("ne perd pas les centimes d’un prix", () => {
    // Le défaut : `Math.floor(cents / 100)` affichait « 24 € » pour 24,85 €
    // sur la page publique d'un Voyageur. Sa JUMELLE, trois fichiers plus
    // loin, portait déjà la bonne version ET une fiche qui disait « ne
    // raccourcit jamais au point de changer le montant ».
    expect(formatPriceShort(2485, "EUR", "fr")).toContain("24,85");
    expect(formatPriceShort(2485, "EUR", "en")).toContain("24.85");
  });

  it("laisse tomber les décimales d’un montant rond", () => {
    expect(formatPriceShort(2500, "EUR", "fr")).not.toContain("00");
  });

  it("place le symbole selon la langue", () => {
    expect(formatPriceShort(2500, "EUR", "en").startsWith("€")).toBe(true);
    expect(formatPriceShort(2500, "EUR", "fr").endsWith("€")).toBe(true);
  });
});

/* ══ ③ Pas de seizième copie ═════════════════════════════════════════════ */

describe("③ une seule mise en forme de l’argent, et elle a un domicile", () => {
  const SOURCES = [...fichiers("components", [".tsx", ".ts"]), ...fichiers("lib", [".ts"])].filter(
    (c) => c !== MODULE_PARTAGE
  );

  it("le balayage a bien balayé", () => {
    expect(SOURCES.length).toBeGreaterThan(100);
  });

  it("plus aucune fonction `formatEur` dans le dépôt", () => {
    for (const chemin of SOURCES) {
      expect(sansCommentaires(readFileSync(chemin, "utf8"))).not.toContain("function formatEur");
    }
  });

  it("`style: \"currency\"` ne vit que dans le module partagé", () => {
    const fautifs = SOURCES.filter((chemin) =>
      /style:\s*["']currency["']/.test(sansCommentaires(readFileSync(chemin, "utf8")))
    ).map((c) => c.replace(RACINE + "/", ""));
    // La liste est NOMMÉE dans le message : un balayage qui rougit doit dire où.
    expect(fautifs).toEqual([]);
  });

  it("aucun écran ne colle « nombre + € »", () => {
    const fautifs = SOURCES.filter((chemin) => {
      const net = sansCommentaires(readFileSync(chemin, "utf8"));
      return /\}\s*€|€\$\{|\{\s*currency\s*\}/.test(net);
    }).map((c) => c.replace(RACINE + "/", ""));
    expect(fautifs).toEqual([]);
  });

  it("aucune table devise→symbole ne survit", () => {
    for (const chemin of SOURCES) {
      const net = sansCommentaires(readFileSync(chemin, "utf8"));
      expect(net).not.toMatch(/===\s*["']EUR["']\s*\?\s*["']€["']/);
      expect(net).not.toMatch(/currency\s*\?\?\s*["']€["']/);
    }
  });
});
