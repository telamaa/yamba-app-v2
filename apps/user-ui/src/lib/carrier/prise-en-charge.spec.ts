/**
 * prise-en-charge.spec.ts — l'inspection du colis, côté site (D115 bis).
 * ========================================================================
 * Ce que ces fiches tiennent :
 *   ① la copie du contrat : cinq points, cinq raisons, trois bornes, et
 *     l'ORDRE (D99 bis : la parité comparait les règles et les seuils,
 *     jamais l'ordre) ;
 *   ② ce qui MANQUE pour confirmer — y compris la remarque trop longue, que
 *     NI l'une NI l'autre des deux copies de l'écran ne connaissait ;
 *   ③ la parité avec le TÉLÉPHONE, mesurée sur ce qui doit l'être : les
 *     codes, l'ordre, les bornes. Pas l'octet : le modèle de photo diffère
 *     volontairement (le site téléverse à la confirmation, D42/A43 ; le
 *     téléphone à la sélection) ;
 *   ④ ce que l'écran n'a plus le droit de faire : laisser taper 600
 *     caractères, envoyer la checklist dans l'ordre des clics, ou afficher
 *     un squelette perpétuel quand la lecture échoue.
 *
 * Le contrat Zod est IMPORTÉ (le harnais tourne sous Node) ; le téléphone,
 * lui, est LU avec `readFileSync` — un import à travers une frontière de
 * projet est une dépendance de build (D93).
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  PICKUP_CHECKLIST_ITEMS,
  PICKUP_PHOTOS_MAX,
  PICKUP_PHOTOS_MIN,
  PickupRefusalReasonSchema,
  ConfirmPickupRequestSchema,
} from "@packages/api-contracts";

import {
  NOTES_MAX,
  PHOTOS_MAX,
  PHOTOS_MIN,
  POINTS_INSPECTION,
  RAISONS_REFUS,
  checklistAEnvoyer,
  manquesPriseEnCharge,
  notesAEnvoyer,
  peutConfirmerLaPriseEnCharge,
  pointsManquants,
} from "@/lib/carrier/prise-en-charge";

const SITE = resolve(__dirname, "../../..");
const MOBILE = resolve(SITE, "../mobile");

const PICKUP = "src/components/carrier/deal/views/pickup";

/** Un formulaire COMPLET, duquel chaque fiche retire une chose. */
function complet(extra: Partial<{ coches: string[]; photos: number; notes: string }> = {}) {
  return { coches: [...POINTS_INSPECTION], photos: 1, notes: "", ...extra };
}

describe("① la copie dit la même chose que le contrat", () => {
  it("les cinq points, DANS L'ORDRE du contrat", () => {
    expect([...POINTS_INSPECTION]).toEqual([...PICKUP_CHECKLIST_ITEMS]);
  });

  it("les cinq raisons de refus, dans l'ordre du contrat", () => {
    expect([...RAISONS_REFUS]).toEqual([...PickupRefusalReasonSchema.options]);
  });

  it("les bornes de photos et de remarque sont celles du serveur", () => {
    expect(PHOTOS_MIN).toBe(PICKUP_PHOTOS_MIN);
    expect(PHOTOS_MAX).toBe(PICKUP_PHOTOS_MAX);
    // Le plafond de notes est mesuré sur le schéma, pas recopié : un même
    // nombre écrit deux fois dérive (D100).
    const corps = (notes: string) => ({
      checklist: [...PICKUP_CHECKLIST_ITEMS],
      photoUrls: ["https://ik.imagekit.io/yamba/a.jpg"],
      notes,
    });
    expect(ConfirmPickupRequestSchema.safeParse(corps("x".repeat(NOTES_MAX))).success).toBe(true);
    expect(ConfirmPickupRequestSchema.safeParse(corps("x".repeat(NOTES_MAX + 1))).success).toBe(
      false
    );
  });
});

describe("② ce qui manque pour confirmer, la remarque comprise", () => {
  it("un formulaire vide manque des points, puis de la photo", () => {
    const manques = manquesPriseEnCharge({ coches: [], photos: 0, notes: "" });
    expect(manques).toEqual([{ quoi: "points", combien: 5 }, { quoi: "photo" }]);
  });

  it("le COMBIEN est juste — c'est lui que le bouton annonce", () => {
    expect(pointsManquants(["CONTENT_MATCHES", "WEIGHT_OK"])).toHaveLength(3);
    expect(manquesPriseEnCharge(complet({ coches: ["CONTENT_MATCHES"] }))).toEqual([
      { quoi: "points", combien: 4 },
    ]);
  });

  it("UNE REMARQUE TROP LONGUE BLOQUE — le défaut que ce lot corrige", () => {
    // Avant : aucun plafond côté client. Le Voyageur tapait 600 caractères,
    // ses photos partaient chez ImageKit, et la confirmation échouait sur un
    // message générique. Le bouton était ACTIF pour un envoi voué à l'échec.
    const manques = manquesPriseEnCharge(complet({ notes: "x".repeat(NOTES_MAX + 7) }));
    expect(manques).toEqual([{ quoi: "notes", deTrop: 7 }]);
    expect(peutConfirmerLaPriseEnCharge(complet({ notes: "x".repeat(NOTES_MAX + 1) }))).toBe(false);
  });

  it("les espaces de tête et de queue ne comptent pas dans le plafond", () => {
    expect(peutConfirmerLaPriseEnCharge(complet({ notes: `  ${"x".repeat(NOTES_MAX)}  ` }))).toBe(
      true
    );
  });

  it("un `Set` de coches est accepté tel quel — c'est ce que l'écran tient", () => {
    expect(peutConfirmerLaPriseEnCharge(complet({ coches: [] }))).toBe(false);
    expect(
      peutConfirmerLaPriseEnCharge({
        coches: new Set(POINTS_INSPECTION),
        photos: 2,
        notes: "Coin enfoncé",
      })
    ).toBe(true);
  });

  it("un point inconnu ne compte pour aucun des cinq", () => {
    // Une coche étrangère ne doit pas « remplir » la checklist : le serveur
    // exige les cinq NOMS, pas cinq éléments.
    expect(peutConfirmerLaPriseEnCharge(complet({ coches: ["AUTRE_CHOSE"] }))).toBe(false);
  });
});

describe("③ la parité avec le téléphone : les codes, l'ordre, les bornes", () => {
  const natif = readFileSync(join(MOBILE, "src/lib/prise-en-charge.ts"), "utf8");

  const listeDu = (source: string, nom: string): string[] => {
    const debut = source.indexOf(`export const ${nom} = [`);
    expect(debut).toBeGreaterThan(-1);
    const fin = source.indexOf("] as const", debut);
    expect(fin).toBeGreaterThan(debut);
    return [...source.slice(debut, fin).matchAll(/'([A-Z_]+)'|"([A-Z_]+)"/g)].map(
      (m) => m[1] ?? m[2]
    );
  };

  it("les deux fronts listent les mêmes points, dans le même ordre", () => {
    expect(listeDu(natif, "POINTS_INSPECTION")).toEqual([...POINTS_INSPECTION]);
  });

  it("les deux fronts listent les mêmes raisons, dans le même ordre", () => {
    expect(listeDu(natif, "RAISONS_REFUS")).toEqual([...RAISONS_REFUS]);
  });

  it("les deux fronts portent les mêmes bornes", () => {
    expect(natif).toContain(`export const PHOTOS_MIN = ${PHOTOS_MIN}`);
    expect(natif).toContain(`export const PHOTOS_MAX = ${PHOTOS_MAX}`);
    expect(natif).toContain(`export const NOTES_MAX = ${NOTES_MAX}`);
  });

  it("la DIVERGENCE de modèle de photo est assumée, et écrite", () => {
    // Le site téléverse à la confirmation (rien ne part si une photo
    // échoue), le téléphone à la sélection (un réessai par photo). Exiger
    // l'égalité octet pour octet ici serait exiger un mensonge : on vérifie
    // donc que chaque fichier EXPLIQUE la différence, pour que le prochain
    // lecteur ne « corrige » pas l'un vers l'autre.
    const web = readFileSync(join(SITE, "src/lib/carrier/prise-en-charge.ts"), "utf8");
    expect(web).toContain("téléverse à la CONFIRMATION");
    // Côté natif, le modèle vit dans `photos.ts` — c'est LUI qui porte
    // l'état d'un lot ; `prise-en-charge.ts` ne fait que le consommer.
    const photos = readFileSync(join(MOBILE, "src/lib/photos.ts"), "utf8");
    expect(photos).toContain("DÈS la sélection");
  });
});

describe("④ ce que l'écran n'a plus le droit de faire", () => {
  const client = readFileSync(join(SITE, PICKUP, "DealPickupClient.tsx"), "utf8");
  const notes = readFileSync(join(SITE, PICKUP, "PickupNotes.tsx"), "utf8");
  const bureau = readFileSync(join(SITE, PICKUP, "DealPickupDesktop.tsx"), "utf8");
  const mobile = readFileSync(join(SITE, PICKUP, "DealPickupMobile.tsx"), "utf8");
  const carte = readFileSync(join(SITE, PICKUP, "PickupConfirmCard.tsx"), "utf8");

  it("la remarque est PLAFONNÉE dans le champ lui-même", () => {
    expect(notes).toContain("maxLength={NOTES_MAX}");
    expect(notes).toContain('from "@/lib/carrier/prise-en-charge"');
  });

  it("la checklist part dans l'ordre du CONTRAT, plus dans celui des clics", () => {
    expect(client).toContain("checklist: checklistAEnvoyer()");
    expect(client).not.toContain("Array.from(checked)");
    expect(checklistAEnvoyer()).toEqual([...PICKUP_CHECKLIST_ITEMS]);
  });

  it("la remarque vide part ABSENTE, jamais vide", () => {
    expect(notesAEnvoyer("   ")).toBeUndefined();
    expect(notesAEnvoyer("  deux mots  ")).toBe("deux mots");
    expect(client).toContain("notes: notesAEnvoyer(notes)");
  });

  it("une lecture qui ÉCHOUE n'affiche plus un squelette perpétuel", () => {
    // Le squelette tournait indéfiniment, sans un mot ni une sortie : un
    // écran ne prétend pas faire ce qu'il ne fait pas (famille D100).
    expect(client).toContain("errors.loadTitle");
    expect(client).toContain("errors.loadBack");
    const apresLErreur = client.slice(client.indexOf("if (loadError || !deal)"));
    expect(apresLErreur.slice(0, 400)).not.toContain("DealSkeleton");
  });

  it("UNE SEULE source dit ce qui manque, et les deux arbres la reçoivent", () => {
    // La phrase était recopiée dans `DealPickupMobile` (barre du bas) et
    // `PickupConfirmCard` (colonne bureau) : deux copies, deux vérités, et
    // aucune des deux ne connaissait la remarque trop longue. Une règle
    // écrite dans le composant qui s'en sert ne protège qu'une page (D93).
    expect(client).toContain("manquesPriseEnCharge");
    for (const source of [mobile, bureau, carte]) {
      expect(source).not.toContain("validation.checklistIncomplete");
      expect(source).not.toContain("validation.photoMissing");
    }
    expect(mobile).toContain("blockingHint={props.blockingHint}");
    expect(bureau).toContain("blockingHint={props.blockingHint}");
  });

  it("les trois phrases de blocage existent dans les DEUX langues", () => {
    // Clés CALCULÉES côté orchestrateur : ni `tsc` ni le contrôle i18n de la
    // CI (il compare FR et EN entre EUX) ne verrait une absence (leçon D83).
    for (const locale of ["fr", "en"]) {
      const dict = JSON.parse(
        readFileSync(join(SITE, `messages/${locale}/carrierDealPickup.json`), "utf8")
      ) as { validation: Record<string, string>; errors: Record<string, string> };
      for (const cle of ["checklistIncomplete", "photoMissing", "notesTooLong"]) {
        expect(dict.validation[cle]).toBeTruthy();
      }
      for (const cle of ["loadTitle", "loadBody", "loadBack"]) {
        expect(dict.errors[cle]).toBeTruthy();
      }
    }
  });

  it("la barre du bas n'a plus de variante que PERSONNE ne rendait", () => {
    // Mesuré, pas lu : `PickupFooter` n'était importé que par la vue
    // téléphone, avec `variant="mobile"`. Sa branche bureau — quarante
    // lignes, ses propres boutons, sa propre phrase — n'était atteinte par
    // aucun rendu. On l'édite en croyant corriger l'écran, et rien ne change.
    const barre = readFileSync(join(SITE, PICKUP, "PickupFooter.tsx"), "utf8");
    expect(barre).not.toContain('variant === "mobile"');
    expect(barre).not.toContain('variant: "desktop" | "mobile"');
    expect(bureau).not.toContain("PickupFooter");
  });
});
