/**
 * fil.spec.ts — le fil de discussion, côté site (D117 bis).
 * ===========================================================
 * Ce que ces fiches tiennent :
 *   ① les règles elles-mêmes (avertir l'auteur, préavis, motifs) ;
 *   ② la PARITÉ avec le téléphone sur ce qui doit l'être — lue avec
 *     `readFileSync`, jamais importée à travers une frontière de projet ;
 *   ③ ce que l'écran n'a plus le droit de faire : taire un drapeau servi,
 *     fermer sans prévenir, écrire une borne en dur, ou poser une
 *     condition qui ne décide rien.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { MESSAGE_MAX_LENGTH, MessageReportReasonSchema } from "@packages/api-contracts";

import {
  MESSAGE_MAX,
  PREAVIS_DE_FERMETURE_JOURS,
  avertirDesCoordonnees,
  estDeMoi,
  fautIlMarquerLu,
  motifDeFermeture,
  preavisDeFermeture,
} from "@/lib/messaging/fil";

const SITE = resolve(__dirname, "../../..");
const MOBILE = resolve(SITE, "../mobile");
const FIL = "src/components/dashboard/messages/ConversationThread.tsx";
const MIDI = Date.parse("2026-11-27T12:00:00.000Z");

function sansCommentaires(source: string): string {
  const net = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  expect(net.length).toBeGreaterThan(source.length / 4);
  return net;
}

const mien = { kind: "TEXT", authorRole: "CARRIER", flaggedContact: true };
const sien = { kind: "TEXT", authorRole: "SHIPPER", flaggedContact: true };

describe("① avertir l'auteur, et lui seul", () => {
  it("ma bulle signalée m'avertit", () => {
    expect(avertirDesCoordonnees(mien, "CARRIER")).toBe(true);
  });

  it("la bulle de l'AUTRE ne le désigne pas du doigt", () => {
    // La détection est une regex qui ne distingue pas un numéro de vol d'un
    // téléphone (`message-guard.rules.ts`). Accuser quelqu'un là-dessus
    // serait pire que se taire.
    expect(avertirDesCoordonnees(sien, "CARRIER")).toBe(false);
  });

  it("un message SYSTÈME n'avertit personne", () => {
    expect(
      avertirDesCoordonnees({ kind: "SYSTEM", authorRole: "SYSTEM", flaggedContact: true }, "CARRIER")
    ).toBe(false);
    expect(estDeMoi({ kind: "SYSTEM", authorRole: "CARRIER" }, "CARRIER")).toBe(false);
  });

  it("un message non signalé n'avertit personne", () => {
    expect(avertirDesCoordonnees({ ...mien, flaggedContact: false }, "CARRIER")).toBe(false);
  });
});

describe("② la fermeture s'annonce, et les motifs sont nommés", () => {
  it("deux jours avant, pas à la seconde où elle tombe", () => {
    expect(preavisDeFermeture(new Date(MIDI + 3 * 86_400_000).toISOString(), MIDI)).toBeNull();
    expect(preavisDeFermeture(new Date(MIDI + 86_400_000).toISOString(), MIDI)).toBe(1);
    expect(PREAVIS_DE_FERMETURE_JOURS).toBe(2);
  });

  it("une échéance passée, absente ou illisible n'annonce rien", () => {
    expect(preavisDeFermeture(new Date(MIDI - 1).toISOString(), MIDI)).toBeNull();
    expect(preavisDeFermeture(null, MIDI)).toBeNull();
    expect(preavisDeFermeture("nawak", MIDI)).toBeNull();
  });

  it("un motif INCONNU ferme quand même", () => {
    expect(motifDeFermeture("DISPUTE_OPEN")).toBe("litige");
    expect(motifDeFermeture("WRITE_WINDOW_OVER")).toBe("fenetre");
    expect(motifDeFermeture("UNE_RAISON_DE_DEMAIN")).toBe("autre");
    expect(motifDeFermeture(null)).toBeNull();
  });

  it("on ne marque lu que s'il y a QUELQUE CHOSE à marquer", () => {
    // `unreadCount >= 0` était toujours vrai : un compteur n'est jamais
    // négatif. Une condition qui ne décide rien n'est pas une condition.
    expect(fautIlMarquerLu({ unreadCount: 2 })).toBe(true);
    expect(fautIlMarquerLu({ unreadCount: 0 })).toBe(false);
    expect(fautIlMarquerLu(undefined)).toBe(false);
  });
});

describe("③ la parité avec le téléphone, sur ce qui doit l'être", () => {
  const natif = readFileSync(join(MOBILE, "src/lib/fil.ts"), "utf8");

  it("les deux fronts portent les mêmes bornes", () => {
    expect(MESSAGE_MAX).toBe(MESSAGE_MAX_LENGTH);
    expect(natif).toContain(`export const MESSAGE_MAX = ${MESSAGE_MAX}`);
    expect(natif).toContain(
      `export const PREAVIS_DE_FERMETURE_JOURS = ${PREAVIS_DE_FERMETURE_JOURS}`
    );
  });

  it("les deux fronts nomment les motifs de fermeture PAREIL", () => {
    // Les mots voyagent : « litige » d'un côté et « dispute » de l'autre
    // finirait par donner deux comportements.
    //
    // Premier jet de cette fiche : elle cherchait `return 'autre'` et a
    // rougi parce que le natif l'écrit dans un TERNAIRE
    // (`brut.length > 0 ? 'autre' : null`). Viser une orthographe plutôt
    // qu'un usage est le piège payé cinq fois ce mois-ci — on découpe donc
    // la fonction et on y cherche les trois mots.
    const regle = natif.slice(
      natif.indexOf("export function motifDeFermeture"),
      natif.indexOf("function accesDeLApi")
    );
    // Un découpage qui rate ses bornes rend une chaîne VIDE, et une chaîne
    // vide passe tous les `not.toContain` — verte pour la pire raison (D98).
    expect(regle.length).toBeGreaterThan(80);
    for (const motif of ["litige", "fenetre", "autre"]) {
      expect(regle).toContain(`'${motif}'`);
    }
  });

  it("les deux fronts avertissent le même : l'AUTEUR", () => {
    // On compare la RÈGLE, pas la sortie : une comparaison de sorties
    // n'attrape que les cas qu'on a pensé à écrire.
    const regle = natif.slice(
      natif.indexOf("export function avertirDesCoordonnees"),
      natif.indexOf("export function jourDuMessage")
    );
    expect(regle.length).toBeGreaterThan(40);
    expect(regle).toContain("estDeMoi(message, monRole)");
    expect(regle).toContain("coordonneesDetectees");
  });

  it("les motifs de signalement sont ceux du contrat, des deux côtés", () => {
    const options = MessageReportReasonSchema.options;
    expect(options).toContain("OFF_PLATFORM");
    expect(natif).toContain(
      `export const MOTIFS_DE_SIGNALEMENT = [${options.map((o) => `'${o}'`).join(", ")}] as const`
    );
  });
});

describe("④ ce que l'écran n'a plus le droit de faire", () => {
  const ecran = sansCommentaires(readFileSync(join(SITE, FIL), "utf8"));

  it("il n'écrit plus la borne EN DUR", () => {
    // Elle y était deux fois (`slice(0, 2000)`) : le défaut que D110 a
    // compté 51 fois sur `max-w-7xl`, à plus petite échelle.
    expect(ecran).not.toMatch(/slice\(0, *2000\)/);
    expect(ecran).toContain("MESSAGE_MAX");
  });

  it("il ne pose plus une condition qui ne décide rien", () => {
    expect(ecran).not.toContain("unreadCount >= 0");
    expect(ecran).toContain("fautIlMarquerLu");
  });

  it("il DIT ce que le serveur lui sert : le drapeau et l'échéance", () => {
    expect(ecran).toContain("avertirDesCoordonnees");
    expect(ecran).toContain("contactWarning");
    expect(ecran).toContain("writeClosesAt");
    expect(ecran).toContain("notice.closing");
  });

  it("les deux phrases neuves existent dans les DEUX langues", () => {
    for (const locale of ["fr", "en"]) {
      const dico = JSON.parse(
        readFileSync(join(SITE, `messages/${locale}/messaging.json`), "utf8")
      ) as { contactWarning?: string; notice?: { closing?: string } };
      expect(typeof dico.contactWarning).toBe("string");
      expect(typeof dico.notice?.closing).toBe("string");
      // Le préavis est un NOMBRE : il s'écrit dans la langue du lecteur
      // (D108), donc en gabarit pluriel et jamais concaténé.
      expect(dico.notice?.closing).toContain("plural");
    }
  });

  it("l'heure n'entre dans le rendu qu'APRÈS le montage", () => {
    // Un composant client est AUSSI rendu sur le serveur (doc Next 16,
    // « Server and Client Boundary ») : la passe serveur et l'hydratation
    // doivent produire le même balisage. Un `Date.now()` lu pendant le
    // rendu peut répondre deux choses de part et d'autre d'un jour.
    expect(ecran).toContain("const [monte, setMonte] = useState(false)");
    // Toute lecture de l'heure dans le rendu passe par ce drapeau.
    for (const ligne of ecran.split("\n")) {
      if (!ligne.includes("Date.now()")) continue;
      expect(`${ligne.trim()} → gardée`).toContain("monte");
    }
  });

  it("la règle vit dans `lib`, pas dans le composant", () => {
    // Sixième règle sortie d'un composant du site après `tunnel.ts` (D93),
    // `search-facets.ts` (D100), `parcel-weight.ts` (D101),
    // `prise-en-charge.ts` (D115 bis) et `remise.ts` (D116 bis).
    expect(ecran).toContain('from "@/lib/messaging/fil"');
  });
});
