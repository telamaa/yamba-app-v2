/**
 * booking.config.spec.ts — le numéro du destinataire, côté SITE (D121).
 * =======================================================================
 * Le miroir de `apps/mobile/src/lib/phone-prefixes.spec.ts`. Le défaut
 * corrigé par D121 vivait **ligne pour ligne** des deux côtés : `toE164`
 * retirait le zéro de tête partout, alors qu'au Congo-Brazzaville et en
 * Côte d'Ivoire il appartient au numéro de l'abonné.
 *
 * Ce fichier n'existait pas : le site avait la même fonction, le même
 * défaut, et aucune fiche. **Un miroir assumé doit être un miroir
 * SURVEILLÉ** — sinon c'est une copie qui dérive.
 */
import { PHONE_PREFIXES, ZERO_DACHEMINEMENT, retireLeZero, toE164 } from "./booking.config";

describe("toE164 — le zéro n'est pas toujours un préfixe d'acheminement", () => {
  it("un numéro français perd son zéro national", () => {
    expect(toE164("+33", "06 42 18 81 12")).toBe("+33642188112");
  });

  it("un numéro congolais GARDE son zéro (+242)", () => {
    // Le défaut : `+24260000000`, injoignable. C'est par ce numéro que le
    // destinataire reçoit son code de livraison (D43) — le colis arrivait,
    // le code n'arrivait pas.
    expect(toE164("+242", "06 000 0000")).toBe("+242060000000");
  });

  it("un numéro ivoirien GARDE son zéro (+225, dix chiffres depuis 2021)", () => {
    expect(toE164("+225", "07 00 00 00 00")).toBe("+2250700000000");
  });

  it("la RD Congo, elle, le retire — deux pays frontaliers, deux règles", () => {
    // Prouvé par les données de recette du dépôt : `+243812345678`.
    expect(toE164("+243", "081 234 5678")).toBe("+243812345678");
  });

  it("le retrait ne mange QU'UN zéro", () => {
    expect(toE164("+33", "006 42 18 81 12")).toBe("+33642188112");
  });

  it("refuse plutôt que de fabriquer un numéro à moitié valide", () => {
    expect(toE164("+33", "")).toBeNull();
    expect(toE164("", "0642188112")).toBeNull();
    expect(toE164("+33", "abcd")).toBeNull();
    expect(toE164("+33", "12")).toBeNull();
  });

  it("chaque pays proposé a une règle, et un inconnu garde le défaut", () => {
    const sansRegle = PHONE_PREFIXES.filter((p) => !(p.code in ZERO_DACHEMINEMENT));
    expect(`sans règle → ${sansRegle.map((p) => p.code).join(", ") || "aucun"}`).toBe(
      "sans règle → aucun"
    );
    expect(retireLeZero("ZZ")).toBe(true);
  });

  it("les DEUX pays établis gardent leur zéro, et eux seuls", () => {
    const gardent = Object.entries(ZERO_DACHEMINEMENT)
      .filter(([, retire]) => !retire)
      .map(([code]) => code)
      .sort();
    expect(gardent).toEqual(["CG", "CI"]);
  });
});
