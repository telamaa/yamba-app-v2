/**
 * rendez-vous.spec.ts — se retrouver, côté site (D118 bis).
 * ===========================================================
 * Ce que ces fiches tiennent : les CINQ motifs de créneau sont nommés, les
 * deux bornes de texte sont posées DANS les champs, et la table des phrases
 * du composant couvre toutes les clés que la règle peut produire.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { ProposeMeetupRequestSchema } from "@packages/api-contracts";

import {
  DETAIL_MAX,
  LIEU_MAX,
  LIEU_MIN,
  SEUIL_DU_COMPTEUR,
  cleDuRefusDuRendezVous,
  restantDuChamp,
} from "@/lib/messaging/rendez-vous";

const SITE = resolve(__dirname, "../../..");
const MOBILE = resolve(SITE, "../mobile");
const PANNEAU = "src/components/dashboard/messages/MeetupPanel.tsx";

describe("① les cinq motifs de créneau sont nommés", () => {
  it("END_BEFORE_START a SA phrase, et ce n'est pas la générique", () => {
    // C'est l'erreur la plus probable d'un formulaire à deux
    // `datetime-local` : celui qui intervertit début et fin lisait « Le
    // rendez-vous n'a pas pu être proposé », c'est-à-dire rien.
    expect(cleDuRefusDuRendezVous("INVALID_MEETUP_SLOT", "END_BEFORE_START")).toBe("finAvantDebut");
    expect(cleDuRefusDuRendezVous("INVALID_MEETUP_SLOT", "INVALID_DATES")).toBe("creneau");
    expect(cleDuRefusDuRendezVous("INVALID_MEETUP_SLOT", "TOO_SOON")).toBe("tropTot");
    expect(cleDuRefusDuRendezVous("INVALID_MEETUP_SLOT", "TOO_FAR")).toBe("tropLoin");
    expect(cleDuRefusDuRendezVous("INVALID_MEETUP_SLOT", "WINDOW_TOO_LONG")).toBe("tropLong");
  });

  it("les quatre autres codes du serveur sont nommés aussi", () => {
    expect(cleDuRefusDuRendezVous("CONVERSATION_READ_ONLY", null)).toBe("ferme");
    expect(cleDuRefusDuRendezVous("MEETUP_CHANGED", null)).toBe("change");
    expect(cleDuRefusDuRendezVous("MEETUP_NOT_ACCEPTABLE", "OWN_PROPOSAL")).toBe("sienne");
    expect(cleDuRefusDuRendezVous("MEETUP_NOT_FOUND", null)).toBe("introuvable");
    expect(cleDuRefusDuRendezVous("QUOI", null)).toBe("echec");
  });

  it("les DEUX fronts traduisent les mêmes motifs", () => {
    // Lu avec `readFileSync` : jamais un import à travers une frontière de
    // projet (D93). Le natif ne peut pas EXPRIMER trois de ces refus, mais
    // il les traduit quand même — un serveur peut durcir ses bornes.
    const natif = readFileSync(join(MOBILE, "src/lib/rendez-vous.ts"), "utf8");
    const regle = natif.slice(
      natif.indexOf("export function cleDuRefusDuRendezVous"),
      natif.indexOf("export function cleDuRefusDuNumero")
    );
    expect(regle.length).toBeGreaterThan(200);
    for (const cle of ["ferme", "change", "sienne", "introuvable", "tropTot", "tropLoin", "tropLong"]) {
      expect(regle).toContain(`'${cle}'`);
    }
  });

  it("toute clé que la règle produit a une phrase dans le composant", () => {
    // Le défaut qu'on vient de corriger était exactement celui-là : une
    // règle qui produit plus de clés que la table n'en porte.
    const panneau = readFileSync(join(SITE, PANNEAU), "utf8");
    const produites = new Set(
      [
        ["CONVERSATION_READ_ONLY", null],
        ["MEETUP_CHANGED", null],
        ["MEETUP_NOT_ACCEPTABLE", "OWN_PROPOSAL"],
        ["MEETUP_NOT_FOUND", null],
        ["INVALID_MEETUP_SLOT", "TOO_SOON"],
        ["INVALID_MEETUP_SLOT", "TOO_FAR"],
        ["INVALID_MEETUP_SLOT", "WINDOW_TOO_LONG"],
        ["INVALID_MEETUP_SLOT", "END_BEFORE_START"],
        ["INVALID_MEETUP_SLOT", "INVALID_DATES"],
        ["AUTRE", null],
      ].map(([c, r]) => cleDuRefusDuRendezVous(c, r))
    );
    expect(produites.size).toBeGreaterThanOrEqual(9);
    for (const cle of produites) expect(`${cle} → ${panneau.includes(`${cle}:`)}`).toBe(`${cle} → true`);
  });
});

describe("② les bornes de texte sont posées DANS les champs", () => {
  it("le lieu et le repère sont plafonnés à la frappe", () => {
    // Leçon D115 bis ① : le refus arrivait après coup, sur un message
    // générique, et il fallait tout refaire.
    const panneau = readFileSync(join(SITE, PANNEAU), "utf8");
    expect(panneau).toContain("slice(0, LIEU_MAX)");
    expect(panneau).toContain("slice(0, DETAIL_MAX)");
    expect(panneau).toContain("maxLength={LIEU_MAX}");
    expect(panneau).toContain("maxLength={DETAIL_MAX}");
    // Et plus aucun littéral : la borne a UN domicile (D110).
    expect(panneau).not.toMatch(/minLength=\{3\}/);
  });

  it("les bornes sont celles du contrat", () => {
    const base = {
      kind: "PICKUP" as const,
      startAt: "2026-12-02T08:00:00.000Z",
      endAt: "2026-12-02T09:00:00.000Z",
    };
    expect(ProposeMeetupRequestSchema.safeParse({ ...base, placeLabel: "x".repeat(LIEU_MAX) }).success).toBe(true);
    expect(ProposeMeetupRequestSchema.safeParse({ ...base, placeLabel: "x".repeat(LIEU_MAX + 1) }).success).toBe(false);
    expect(ProposeMeetupRequestSchema.safeParse({ ...base, placeLabel: "x".repeat(LIEU_MIN - 1) }).success).toBe(false);
    expect(
      ProposeMeetupRequestSchema.safeParse({
        ...base,
        placeLabel: "Terminal 2E",
        placeDetails: "y".repeat(DETAIL_MAX + 1),
      }).success
    ).toBe(false);
  });

  it("le compteur n'apparaît qu'à l'APPROCHE", () => {
    // Un compteur permanent est du bruit ; un compteur absent est une
    // surprise. Il apparaît dans les vingt derniers caractères.
    expect(restantDuChamp("x".repeat(LIEU_MAX - SEUIL_DU_COMPTEUR - 1), LIEU_MAX)).toBeNull();
    expect(restantDuChamp("x".repeat(LIEU_MAX - SEUIL_DU_COMPTEUR), LIEU_MAX)).toBe(SEUIL_DU_COMPTEUR);
    expect(restantDuChamp("x".repeat(LIEU_MAX), LIEU_MAX)).toBe(0);
    // Jamais négatif : le champ plafonne, mais une valeur collée avant le
    // plafond ne doit pas afficher « -4 caractères restants ».
    expect(restantDuChamp("x".repeat(LIEU_MAX + 4), LIEU_MAX)).toBe(0);
  });

  it("le compteur est un GABARIT pluriel, dans les deux langues", () => {
    for (const locale of ["fr", "en"]) {
      const dico = JSON.parse(
        readFileSync(join(SITE, `messages/${locale}/messaging.json`), "utf8")
      ) as { meetup: Record<string, string>; errors: Record<string, string> };
      expect(dico.meetup.remaining).toContain("plural");
      for (const cle of ["meetupFinAvantDebut", "meetupCreneau", "meetupSienne", "meetupIntrouvable"]) {
        expect(typeof dico.errors[cle]).toBe("string");
      }
    }
  });
});
