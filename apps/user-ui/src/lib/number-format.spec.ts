/**
 * number-format.spec.ts — les nombres que l'on MONTRE, côté site (D108).
 * ======================================================================
 * Le module est DUPLIQUÉ OCTET POUR OCTET avec `apps/mobile/src/lib/` :
 * `poids-localise.spec.ts`, côté téléphone, compare les deux copies. Ici on
 * teste le COMPORTEMENT de la règle — l'égalité des fichiers ne prouve jamais
 * qu'ils ont raison, seulement qu'ils ont tort ensemble (leçon d'A224 : les
 * correctifs D99→D102 n'étaient gardés que par RICOCHET, et une règle fausse
 * des deux côtés restait verte).
 *
 * Ce que ces fiches défendent est une PROPRIÉTÉ, pas une valeur : « le
 * séparateur suit la langue », « une note garde toujours une décimale ». Les
 * valeurs elles-mêmes appartiennent à `Intl`, qu'on ne reteste pas.
 */
import { formatRating, roundToTenth, intlTagFor } from "@/lib/number-format";

describe("formatRating — une note s'écrit dans la langue du lecteur", () => {
  it("le séparateur suit la langue, et c'est tout l'enjeu du lot", () => {
    expect(formatRating(4.8, "fr-FR")).toBe("4,8");
    expect(formatRating(4.8, "en-US")).toBe("4.8");
  });

  it("une note ronde GARDE sa décimale", () => {
    // « 5 » se lit comme un compte, « 5,0 » comme une moyenne : sous une
    // étoile, les deux ne disent pas la même chose. C'est la seule chose que
    // `toFixed(1)` faisait bien, et elle est conservée.
    expect(formatRating(5, "fr-FR")).toBe("5,0");
    expect(formatRating(5, "en-US")).toBe("5.0");
    expect(formatRating(0, "fr-FR")).toBe("0,0");
  });

  it("une note trop précise est RAMENÉE à une décimale, jamais tronquée", () => {
    // Une moyenne arrive du serveur avec ses décimales : 4.75 doit s'arrondir,
    // pas se couper (4,7 serait une note injustement rabaissée).
    expect(formatRating(4.75, "fr-FR")).toBe("4,8");
    expect(formatRating(4.44, "fr-FR")).toBe("4,4");
  });

  it("le résultat ne contient JAMAIS les deux séparateurs", () => {
    // Le défaut d'origine produisait « 4.8 » dans une phrase française et
    // « 4,8 » dans une phrase anglaise : un seul séparateur, le bon.
    expect(formatRating(4.8, "fr-FR")).not.toContain(".");
    expect(formatRating(4.8, "en-US")).not.toContain(",");
  });
});

describe("roundToTenth — arrondir n'est pas mettre en forme", () => {
  it("rend un NOMBRE, pas une chaîne", () => {
    // C'est tout le point : une chaîne ne se localise plus, et une chaîne
    // « 12,5 » rendue à un gabarit `{kg, number}` ne vaut plus rien du tout.
    expect(typeof roundToTenth(12.3456)).toBe("number");
    expect(roundToTenth(12.3456)).toBe(12.3);
  });

  it("arrondit au plus proche, dans les deux sens, zéro et négatifs compris", () => {
    expect(roundToTenth(12.35)).toBe(12.4);
    expect(roundToTenth(12.34)).toBe(12.3);
    expect(roundToTenth(0)).toBe(0);
    expect(roundToTenth(-2.26)).toBe(-2.3);
  });

  it("laisse un nombre déjà court intact", () => {
    expect(roundToTenth(2)).toBe(2);
    expect(roundToTenth(2.3)).toBe(2.3);
  });
});

describe("intlTagFor — le ternaire qui existait en six exemplaires", () => {
  it("rend les étiquettes BCP 47 attendues", () => {
    expect(intlTagFor("fr")).toBe("fr-FR");
    expect(intlTagFor("en")).toBe("en-US");
  });

  it("toute autre langue retombe sur l'anglais, jamais sur du vide", () => {
    // Une étiquette vide ferait jeter `Intl.NumberFormat` ; une langue
    // inconnue doit DÉGRADER, pas casser l'écran.
    expect(intlTagFor("es")).toBe("en-US");
    expect(intlTagFor("")).toBe("en-US");
    expect(() => new Intl.NumberFormat(intlTagFor("es"))).not.toThrow();
  });

  it("son résultat est utilisable tel quel par la règle", () => {
    expect(formatRating(4.8, intlTagFor("fr"))).toBe("4,8");
    expect(formatRating(4.8, intlTagFor("en"))).toBe("4.8");
  });
});
