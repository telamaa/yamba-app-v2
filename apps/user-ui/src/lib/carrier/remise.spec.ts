/**
 * remise.spec.ts — la remise du colis, côté site (D116 bis).
 * ============================================================
 * Ce que ces fiches tiennent :
 *   ① les photos sont OPTIONNELLES mais ne retiennent jamais en silence —
 *     le défaut que ce lot corrige : `isSubmitting || !photosReady` mettait
 *     le bouton en « Vérification… » pour toujours ;
 *   ② le verrou passe avant le code, et les bornes viennent du contrat ;
 *   ③ la parité avec le téléphone sur ce qui doit l'être (bornes, ordre des
 *     manques), pas sur le modèle de photo, qui diverge à dessein ;
 *   ④ ce que l'écran n'a plus le droit de faire : fusionner deux attentes,
 *     afficher un squelette perpétuel, ou laisser un prénom absent trouer
 *     une phrase.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { DELIVERY_PHOTOS_MAX, DeliverDealRequestSchema } from "@packages/api-contracts";

import {
  CODE_LONGUEUR,
  PHOTOS_REMISE_MAX,
  manqueDesPhotos,
  manquesDeLaRemise,
  urlsDeLaRemise,
} from "@/lib/carrier/remise";

const SITE = resolve(__dirname, "../../..");
const MOBILE = resolve(SITE, "../mobile");
const DELIVER = "src/components/carrier/deal/views/deliver";

const CODE = "742891";

function sansCommentaires(source: string): string {
  const net = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  expect(net.length).toBeGreaterThan(source.length / 3);
  return net;
}

describe("① les photos sont optionnelles, jamais silencieuses", () => {
  it("aucune photo ne retient rien", () => {
    // Une seule fonction sous les fiches : un `peutRemettre()` booléen a
    // vécu ici, sans appelant possible — le code vit dans l'état LOCAL du
    // champ, et le remonter ferait rentrer la règle dans un composant.
    expect(manquesDeLaRemise({ code: CODE, photos: [], verrouille: false })).toEqual([]);
  });

  it("une photo EN LIGNE ne retient rien", () => {
    expect(
      manquesDeLaRemise({ code: CODE, photos: [{ url: "https://ik/a.jpg" }], verrouille: false })
    ).toEqual([]);
  });

  it("une photo EN VOL retient, et c'est un téléversement", () => {
    expect(
      manquesDeLaRemise({ code: CODE, photos: [{ uploading: true }], verrouille: false })
    ).toEqual([{ quoi: "televersement" }]);
  });

  it("une photo en ÉCHEC retient, et c'est autre chose", () => {
    // Deux attentes, deux phrases. Les fusionner fait perdre au bouton la
    // raison de son attente — donc sa capacité à la dire.
    expect(
      manquesDeLaRemise({
        code: CODE,
        photos: [{ url: null, error: "boom" }],
        verrouille: false,
      })
    ).toEqual([{ quoi: "echec" }]);
  });

  it("une photo sans URL ni erreur retient quand même, et DIT laquelle", () => {
    // Le cas tordu : l'upload n'a jamais démarré (pas de `file`). Avant, ce
    // lot restait « non prêt » sans que rien ne le dise.
    //
    // La fonction rend LE MANQUE, pas un booléen : son unique appelant a
    // besoin de la RAISON pour l'écrire sous le bouton, et un prédicat
    // l'obligeait à refaire le calcul en ligne pour la retrouver.
    expect(manqueDesPhotos([{}])).toEqual({ quoi: "echec" });
    expect(manqueDesPhotos([{ uploading: true }])).toEqual({ quoi: "televersement" });
  });

  it("retirer la photo fautive débloque l'envoi", () => {
    expect(manqueDesPhotos([])).toBeNull();
    expect(manqueDesPhotos([{ url: "https://ik/a.jpg" }])).toBeNull();
  });

  it("seules les URL prêtes partent", () => {
    expect(
      urlsDeLaRemise([{ url: "https://ik/a.jpg" }, { uploading: true }, { url: "" }])
    ).toEqual(["https://ik/a.jpg"]);
  });
});

describe("② le verrou, le code, et les bornes du contrat", () => {
  it("le VERROU passe avant le code", () => {
    const manques = manquesDeLaRemise({ code: "742", photos: [], verrouille: true });
    expect(manques[0]).toEqual({ quoi: "verrou" });
  });

  it("un code incomplet dit COMBIEN de chiffres manquent", () => {
    expect(manquesDeLaRemise({ code: "742", photos: [], verrouille: false })).toEqual([
      { quoi: "code", chiffres: 3 },
    ]);
  });

  it("deux photos au plus, six chiffres — les bornes du contrat", () => {
    expect(PHOTOS_REMISE_MAX).toBe(DELIVERY_PHOTOS_MAX);
    expect(CODE_LONGUEUR).toBe(6);
    expect(DeliverDealRequestSchema.safeParse({ code: "74289", photoUrls: [] }).success).toBe(
      false
    );
    expect(DeliverDealRequestSchema.safeParse({ code: CODE, photoUrls: [] }).success).toBe(true);
    expect(
      DeliverDealRequestSchema.safeParse({
        code: CODE,
        photoUrls: ["https://ik/a.jpg", "https://ik/b.jpg", "https://ik/c.jpg"],
      }).success
    ).toBe(false);
  });
});

describe("③ la parité avec le téléphone, sur ce qui doit l'être", () => {
  const natif = readFileSync(join(MOBILE, "src/lib/remise.ts"), "utf8");

  it("les deux fronts portent les mêmes bornes", () => {
    expect(natif).toContain(`export const PHOTOS_REMISE_MAX = ${PHOTOS_REMISE_MAX}`);
    expect(natif).toContain(`export const CODE_LONGUEUR = ${CODE_LONGUEUR}`);
  });

  it("les deux fronts nomment les manques PAREIL, et dans le même ordre", () => {
    // Les mots voyagent : une phrase « verrou » d'un côté et « locked » de
    // l'autre finirait par donner deux comportements. L'ORDRE compte autant
    // (D99 bis) : le verrou d'abord, le code ensuite.
    //
    // Premier jet de cette fiche : elle lisait TOUTES les occurrences de
    // `quoi: '…'`, donc la déclaration de TYPE avant les `push`. Elle a
    // rougi sur un ordre d'union, qui n'est pas un comportement. On mesure
    // donc l'ordre des PUSH — le seul qui décide de ce que l'écran lit.
    const ordreDesPush = (source: string) =>
      [...source.matchAll(/push\(\{\s*quoi: ['"]([a-z]+)['"]/g)].map((m) => m[1]);
    const web = readFileSync(join(SITE, "src/lib/carrier/remise.ts"), "utf8");
    expect(ordreDesPush(web)).toEqual(["verrou", "code", "televersement", "echec"]);
    expect(ordreDesPush(natif)).toEqual(ordreDesPush(web));
  });

  it("aucun des deux fronts ne se donne un compteur d'essais", () => {
    // Le nombre d'essais arrive du serveur (A38, D116 1B). Les deux modules
    // ont porté un `ESSAIS_MAX = 3` que personne n'appelait — côté site, un
    // SECOND domicile pour le 3 de `MAX_DELIVERY_ATTEMPTS` (deal.api.ts),
    // qui lui a de vrais lecteurs. Supprimés tous les deux.
    //
    // On dépouille les commentaires : les deux fichiers EXPLIQUENT cette
    // absence, et viser le mot plutôt que l'usage est le piège payé cinq
    // fois ce mois-ci — dont une fois dans le détecteur lui-même (A224 lot 5).
    const web = readFileSync(join(SITE, "src/lib/carrier/remise.ts"), "utf8");
    for (const source of [web, natif]) {
      expect(sansCommentaires(source)).not.toMatch(/ESSAIS_MAX|MAX_ESSAIS/);
    }
    // Et le domicile unique du 3, lui, existe toujours.
    expect(readFileSync(join(SITE, "src/components/carrier/deal/deal.api.ts"), "utf8")).toContain(
      "export const MAX_DELIVERY_ATTEMPTS = 3"
    );
  });
});

describe("④ ce que l'écran n'a plus le droit de faire", () => {
  const client = sansCommentaires(readFileSync(join(SITE, DELIVER, "DealDeliverClient.tsx"), "utf8"));
  const mobile = sansCommentaires(readFileSync(join(SITE, DELIVER, "DealDeliverMobile.tsx"), "utf8"));
  const bureau = sansCommentaires(
    readFileSync(join(SITE, DELIVER, "DealDeliverDesktop.tsx"), "utf8")
  );
  const champ = sansCommentaires(readFileSync(join(SITE, DELIVER, "DeliverOtpInput.tsx"), "utf8"));

  it("il ne fusionne plus « je travaille » et « j'attends une photo »", () => {
    for (const source of [mobile, bureau]) {
      expect(source).not.toContain("props.isSubmitting || !props.photosReady");
      expect(source).toContain("photoHint={props.photoHint}");
    }
  });

  it("le champ du code DIT ce que les photos retiennent", () => {
    expect(champ).toContain("photoHint");
    // Et le bouton reste inactif tant qu'elles retiennent : un envoi qui
    // part sans sa preuve en vol serait pire que l'attente.
    expect(champ).toContain("photoHint !== null");
  });

  it("une lecture qui ÉCHOUE est attrapée, dite, et offre une sortie", () => {
    // Sans `.catch`, le rejet n'était même pas attrapé : squelette à vie.
    expect(client).toContain(".catch(");
    expect(client).toContain("error.loadTitle");
    expect(client).toContain("error.loadBack");
  });

  it("un prénom absent ne troue pas la phrase du mauvais code", () => {
    expect(client).toContain("otp.wrongCodeNoName");
    for (const locale of ["fr", "en"]) {
      const dict = JSON.parse(
        readFileSync(join(SITE, `messages/${locale}/carrierDealDeliver.json`), "utf8")
      ) as { otp: Record<string, string>; error: Record<string, string> };
      expect(dict.otp.wrongCodeNoName).toBeTruthy();
      // La version nommée garde son paramètre : une phrase sans `{` ne
      // nommerait plus personne, et les deux diraient la même chose.
      expect(dict.otp.wrongCode).toContain("{recipientFirstName}");
      for (const cle of ["loadTitle", "loadBody", "loadBack"]) {
        expect(dict.error[cle]).toBeTruthy();
      }
    }
  });

  it("la règle vit dans `lib`, pas dans les composants", () => {
    // Quatrième et cinquième règles sorties d'un composant du site, après
    // `tunnel.ts` (D93), `search-facets.ts` (D100), `parcel-weight.ts`
    // (D101) et `carrier/prise-en-charge.ts` (D115 bis).
    expect(client).toContain('from "@/lib/carrier/remise"');
    expect(client).toContain("manqueDesPhotos");
    // Et il ne recopie pas le corps de la règle : un `"0".repeat(6)` dans
    // l'écran voudrait dire qu'il refait lui-même la question des photos.
    expect(client).not.toContain('"0".repeat(');
  });
});
