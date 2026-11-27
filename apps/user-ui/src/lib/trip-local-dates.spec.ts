/**
 * trip-local-dates.spec.ts — la date locale d'un trajet, côté site.
 * ==================================================================
 * Ce module décide des dates de TOUT le tableau de bord Voyageur — « Mes
 * trajets », l'accueil, la fiche d'un trajet, le tri, le badge « parti » —
 * et il n'avait AUCUNE fiche. Il a été écrit pour clore `ANO-WEB-41`, une
 * anomalie MAJEURE de recette (« jeu. 1 janv. » sur toutes les lignes).
 *
 * Il vivait dans `components/trips/list/`, c'est-à-dire HORS de la frontière
 * du harnais (A224 ne joue que `src/lib`) : un module pur, central, invisible
 * de tous les contrôles. D111 quinquies l'a remonté ici et l'a dupliqué vers
 * le téléphone, qui souffrait du défaut d'origine sans le savoir.
 *
 * Le module est DUPLIQUÉ OCTET POUR OCTET avec `apps/mobile/src/lib/` ;
 * c'est `trip-local-dates.spec.ts` côté téléphone qui compare les copies.
 * Ici on teste le COMPORTEMENT : l'égalité de deux fichiers ne prouve jamais
 * qu'ils ont raison, seulement qu'ils ont tort ensemble (leçon d'A224).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  localDateTime,
  withLocalDates,
  withLocalDatesInList,
  type TripDatesLike,
} from "@/lib/trip-local-dates";

describe("localDateTime — une conversion, pas une devinette", () => {
  it("rend le jour et l'heure du LIEU", () => {
    expect(localDateTime("2026-11-23T07:18:42.842Z", "Europe/Paris")).toEqual({
      date: "2026-11-23",
      time: "08:18",
    });
    expect(localDateTime("2026-11-23T07:18:42.842Z", "Asia/Dubai")).toEqual({
      date: "2026-11-23",
      time: "11:18",
    });
  });

  it("change de JOUR quand le fuseau le commande", () => {
    // Sans le fuseau, cet instant se lirait « 24 novembre » — un jour de
    // trop. C'est pourquoi la dérivation sans fuseau est refusée ailleurs
    // (D111 quater 2C, la publication) : là-bas on n'a pas le fuseau.
    expect(localDateTime("2026-11-24T23:30:00.000Z", "Asia/Dubai")?.date).toBe("2026-11-25");
    expect(localDateTime("2026-11-24T22:30:00.000Z", "America/New_York")?.date).toBe("2026-11-24");
  });

  it("écrit l'heure sur 24 h", () => {
    expect(localDateTime("2026-11-23T22:05:00.000Z", "Europe/Paris")?.time).toBe("23:05");
  });

  it("se tait plutôt que d'inventer", () => {
    expect(localDateTime(null, "Europe/Paris")).toBeNull();
    expect(localDateTime("", "Europe/Paris")).toBeNull();
    expect(localDateTime("pas une date", "Europe/Paris")).toBeNull();
    expect(localDateTime(new Date("nawak"), "Europe/Paris")).toBeNull();
  });

  it("un fuseau inconnu retombe sur celui du navigateur, sans jeter", () => {
    const sortie = localDateTime("2026-11-23T07:18:42.842Z", "Mars/Olympus_Mons");
    expect(sortie?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sortie?.time).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("withLocalDates — ce qui est saisi l'emporte sur ce qui est calculé", () => {
  it("ne réécrit jamais une chaîne existante", () => {
    const trajet = {
      departureDateLocal: "2026-11-25",
      departureTimeLocal: "21:00",
      departureAt: "2026-11-25T20:00:00.000Z",
      originTimezone: "Europe/Paris",
    };
    expect(withLocalDates(trajet)).toEqual(trajet);
  });

  it("comble les quatre chaînes, départ ET arrivée", () => {
    const comble = withLocalDates({
      departureAt: "2026-11-18T07:18:42.842Z",
      originTimezone: "Europe/Paris",
      arrivalAt: "2026-11-18T14:00:00.000Z",
      destinationTimezone: "Africa/Brazzaville",
    });
    expect(comble.departureDateLocal).toBe("2026-11-18");
    expect(comble.departureTimeLocal).toBe("08:18");
    expect(comble.arrivalDateLocal).toBe("2026-11-18");
    expect(comble.arrivalTimeLocal).toBe("15:00");
  });

  it("une chaîne VIDE compte comme absente — c'est ce que sert la base", () => {
    expect(
      withLocalDates({
        departureDateLocal: "",
        departureAt: "2026-11-18T07:18:42.842Z",
        originTimezone: "Europe/Paris",
      }).departureDateLocal
    ).toBe("2026-11-18");
  });

  it("sans aucun instant, l'objet ressort TEL QUEL", () => {
    const nu = { departureDateLocal: null, originCity: "Paris" };
    expect(withLocalDates(nu)).toBe(nu);
  });
});

describe("withLocalDatesInList — les deux formes que sert l'API", () => {
  type Enveloppe = { trips: TripDatesLike[]; count: number };
  const brut: TripDatesLike = {
    departureAt: "2026-11-18T07:18:42.842Z",
    originTimezone: "Europe/Paris",
  };

  it("un tableau nu", () => {
    const sortie = withLocalDatesInList([brut]) as TripDatesLike[];
    expect(sortie[0].departureDateLocal).toBe("2026-11-18");
  });

  it("une enveloppe `{ trips }`, dont le reste survit", () => {
    // Variable et non littéral : un littéral déclenche le contrôle des
    // propriétés en trop sur `count`, qui ne regarde pas la fonction.
    const enveloppe: Enveloppe = { trips: [brut], count: 1 };
    const sortie = withLocalDatesInList(enveloppe) as Enveloppe;
    expect(sortie.trips[0].departureDateLocal).toBe("2026-11-18");
    expect(sortie.count).toBe(1);
  });

  it("rien du tout ne casse rien", () => {
    expect(withLocalDatesInList(null)).toBeNull();
    expect(withLocalDatesInList(undefined)).toBeUndefined();
    expect(withLocalDatesInList({})).toEqual({});
  });
});

describe("le branchement : au BORD de la lecture, une seule fois", () => {
  // Les écrans lisent `departureDateLocal` partout ; normaliser dans chaque
  // écran serait la règle recopiée vingt fois (le défaut de D110). Elle est
  // appliquée dans les deux hooks de lecture, et nulle part ailleurs.
  const hook = readFileSync(resolve(__dirname, "../hooks/useTrip.ts"), "utf8");

  it("`useMyTrips` normalise la liste", () => {
    expect(hook).toContain("withLocalDatesInList");
  });

  it("`useTrip` normalise le trajet seul", () => {
    expect(hook).toContain("withLocalDates(");
  });

  it("l'adaptateur du tableau de bord ne dérive RIEN de son côté", () => {
    // Il porte encore un repli sur l'époque Unix (`new Date(0)`), hérité
    // d'avant ANO-WEB-41. Il est aujourd'hui inatteignable — les deux
    // consommateurs passent par `useMyTrips` — mais il ne doit SURTOUT pas
    // devenir une seconde dérivation : deux règles de date, c'est deux
    // dates. Cette fiche tient la frontière, pas le repli.
    const adaptateur = readFileSync(
      resolve(__dirname, "../components/dashboard/trips/my-deals.adapter.ts"),
      "utf8"
    );
    expect(adaptateur).not.toContain("trip-local-dates");
    expect(adaptateur).not.toContain("Intl.DateTimeFormat");
  });
});
