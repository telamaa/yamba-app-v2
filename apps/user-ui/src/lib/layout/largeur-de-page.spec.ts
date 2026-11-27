/**
 * largeur-de-page.spec.ts — le gabarit de page n'a qu'un domicile (D110).
 * =======================================================================
 * Deux familles de fiches, et la seconde est la vraie.
 *
 * ① Les fonctions pures : ce que `conteneurDePage` et `rangeeDEnTete`
 *    composent. Utile, mais léger — le défaut de D110 n'était pas un calcul
 *    faux, c'était un calcul CONTOURNÉ.
 *
 * ② LE BALAYAGE : plus aucun fichier du site n'écrit la largeur, la gouttière
 *    ou la hauteur d'en-tête à la main. C'est la seule forme qui aurait vu le
 *    défaut : au 21/11, `max-w-7xl` était recopié 51 fois dans 37 fichiers
 *    avec CINQ gouttières, et `AppContainer` — qui se déclarait « source de
 *    vérité » — avait DEUX usages. Une source de vérité que personne
 *    n'importe n'est pas une source de vérité, c'est un commentaire ; ce qui
 *    fait tenir une charte, c'est l'impossibilité de la contourner (D105).
 *
 * Trois précautions, toutes payées ailleurs dans le dépôt :
 *
 * - ON VISE L'USAGE, JAMAIS UNE ORTHOGRAPHE. Les commentaires sont RETIRÉS
 *   avant de chercher : le dépôt porte cinq commentaires qui citent
 *   `max-w-7xl` pour expliquer la règle, et une fiche qui les compterait
 *   serait rouge pour la plus mauvaise raison — c'est le défaut qu'A224 lot 5
 *   a trouvé DANS son propre détecteur, et le cinquième du mois.
 * - UNE FICHE QUI COMPTE DOIT PROUVER QU'ELLE A COMPTÉ (D104). Chaque
 *   balayage vérifie d'abord son propre volume : un balayage qui ne balaye
 *   rien est vert.
 * - LES NOMBRES SONT LUS DANS LA RÈGLE, jamais recopiés dans l'attendu
 *   (D95 6A) : les deux côtés ne peuvent pas dériver d'un chiffre.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  conteneurDePage,
  rangeeDEnTete,
  GOUTTIERE_DE_PAGE,
  HAUTEUR_D_EN_TETE,
  LARGEUR_MAX_DE_PAGE,
} from "@/lib/layout/largeur-de-page";

const SRC = resolve(__dirname, "..", "..");
const MODULE = resolve(__dirname, "largeur-de-page.ts");

/** Tous les fichiers de code du site, fiches et déclarations exclues. */
function sources(dossier: string = SRC): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    if (!/\.(ts|tsx)$/.test(chemin)) return [];
    if (/\.(spec|d)\.ts$/.test(chemin)) return [];
    return [chemin];
  });
}

/**
 * Le code SANS ses commentaires. Un commentaire qui cite une classe parle de
 * la règle ; il ne l'applique pas.
 */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

const FICHIERS = sources();
const CODE = new Map(FICHIERS.map((f) => [f, codeSeul(f)] as const));
const nom = (chemin: string) => relative(SRC, chemin);

describe("largeur-de-page — ce que les fonctions composent", () => {
  it("le conteneur porte la largeur maximale et la gouttière de la charte", () => {
    const c = conteneurDePage();
    expect(c).toContain(LARGEUR_MAX_DE_PAGE);
    expect(c).toContain(GOUTTIERE_DE_PAGE);
    expect(c).toContain("mx-auto");
  });

  it("la gouttière est RESPONSIVE : 16 px au téléphone, 24 px dès 640 px", () => {
    // L'arbitrage du 21/11. Une gouttière fixe était l'autre option ; c'est
    // celle-ci qui a été retenue, et la fiche la nomme pour qu'un retour en
    // arrière soit une DÉCISION et non une dérive.
    expect(GOUTTIERE_DE_PAGE).toBe("px-4 sm:px-6");
  });

  it("les classes de l'appelant s'ajoutent, sans espace parasite", () => {
    expect(conteneurDePage("py-6")).toBe(`${conteneurDePage()} py-6`);
    expect(conteneurDePage()).not.toMatch(/\s{2}|^\s|\s$/);
    expect(conteneurDePage("")).toBe(conteneurDePage());
  });

  it("la rangée d'en-tête EST un conteneur de page", () => {
    // C'est tout le défaut de D110 : l'en-tête était la référence d'alignement
    // de tout le site, et il ne partageait son gabarit avec personne.
    expect(rangeeDEnTete(false)).toContain(conteneurDePage());
    expect(rangeeDEnTete(true)).toContain(conteneurDePage());
  });

  it("compacte ou non, la rangée ne diffère QUE par sa respiration verticale", () => {
    const large = rangeeDEnTete(false).split(" ").filter((c) => c !== "py-3");
    const serree = rangeeDEnTete(true).split(" ").filter((c) => c !== "py-2");
    expect(serree).toEqual(large);
    expect(rangeeDEnTete(true)).toContain("py-2");
    expect(rangeeDEnTete(false)).toContain("py-3");
  });

  it("la hauteur d'en-tête est un nombre, et la rangée porte sa classe", () => {
    expect(HAUTEUR_D_EN_TETE).toBe(78);
    expect(rangeeDEnTete(false)).toContain(`h-[${HAUTEUR_D_EN_TETE}px]`);
  });
});

describe("largeur-de-page — le balayage : aucun contournement", () => {
  it("le balayage voit bien tout le site", () => {
    // D104 : un balayage qui ne balaye rien est vert. Le site comptait plus de
    // 400 fichiers de code au 21/11 ; on refuse de descendre sous la moitié.
    expect(FICHIERS.length).toBeGreaterThanOrEqual(200);
    expect(FICHIERS).toContain(MODULE);
  });

  it("le littéral de la largeur maximale n'existe QUE dans ce module", () => {
    const porteurs = FICHIERS.filter((f) => CODE.get(f)!.includes(LARGEUR_MAX_DE_PAGE));
    expect(porteurs.map(nom)).toEqual([nom(MODULE)]);
  });

  it("aucun appelant ne redéclare une largeur ni une gouttière dans son extra", () => {
    // `conteneurDePage("px-8")` passerait les fiches précédentes et défarait la
    // charte en silence : c'est la prop `size` que D105 a refusée au retour.
    const fautifs: string[] = [];
    for (const [fichier, code] of CODE) {
      if (fichier === MODULE) continue;
      for (const appel of code.matchAll(/conteneurDePage\(\s*"([^"]*)"/g)) {
        if (/(^|\s)(px-|sm:px-|md:px-|lg:px-|max-w-)/.test(appel[1])) {
          fautifs.push(`${nom(fichier)} → ${appel[1]}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("les colonnes plus ÉTROITES que le cadre sont recensées, pas libres", () => {
    // Le premier jet de cette fiche refusait TOUT conteneur centré et plafonné.
    // Elle en a trouvé 28 dans 24 fichiers, à cinq largeurs — `max-w-6xl` à
    // `max-w-2xl` — et elle avait tort de les refuser : une colonne de lecture
    // plus étroite CENTRÉE DANS le cadre est un motif légitime, pas un
    // contournement de la charte. Aucune ne porte la largeur du cadre : D110
    // tient.
    //
    // Mais leurs gouttières divergent (`px-4`, `px-4 sm:px-6`, `px-4 lg:px-6`)
    // et six pages « preview » recopient la même ligne, donc la question
    // « second cadre ou colonne ? » reste ouverte — elle demande un arbitrage
    // produit, pas une fiche. D'ici là on COMPTE : une 30e colonne ne passera
    // pas en silence, et son auteur devra choisir entre la charte et cette
    // liste. C'est la mécanique d'A224 lot 5, sans ses raisons obligatoires :
    // ici le groupe a UNE raison, écrite ci-dessus, pas vingt-cinq.
    const COLONNES_ETROITES = [
      "app/[locale]/(marketing)/help/page.tsx",
      "app/[locale]/dashboard/favorites/page.tsx",
      "app/[locale]/dashboard/finances/preview/page.tsx",
      "app/[locale]/dashboard/following/page.tsx",
      "app/[locale]/dashboard/home/preview/page.tsx",
      "app/[locale]/dashboard/messages/preview/page.tsx",
      "app/[locale]/dashboard/notifications/preview/page.tsx",
      "app/[locale]/dashboard/saved-routes/page.tsx",
      "app/[locale]/dashboard/trips/page.tsx",
      "app/[locale]/dashboard/trips/preview/page.tsx",
      "app/[locale]/share/page.tsx",
      "app/[locale]/u/[slug]/UserProfileClient.tsx",
      "app/[locale]/u/[slug]/not-found.tsx",
      // D115 bis / D116 bis — le message d'une lecture qui échoue, à la
      // place d'un squelette perpétuel. Colonne étroite ASSUMÉE : trois
      // lignes et un bouton se lisent mal sur 1 280 px.
      "components/carrier/deal/views/deliver/DealDeliverClient.tsx",
      "components/carrier/deal/views/pickup/DealPickupClient.tsx",
      "components/dashboard/shipments/preview/page.tsx",
      "components/home/CorridorsSection.tsx",
      "components/home/FinalCtaSection.tsx",
      "components/home/HomePage.tsx",
      "components/home/HowItWorksSection.tsx",
      "components/home/TrustSection.tsx",
      "components/layout/ConsentBanner.tsx",
      "components/legal/LegalDocument.tsx",
      "components/trips/create/CreateTripWizard.tsx",
      "components/trips/detail/TripDetails.tsx",
      "components/users/profile/UserProfileSkeleton.tsx",
    ];
    const centres = new Set<string>();
    for (const [fichier, code] of CODE) {
      if (fichier === MODULE) continue;
      for (const classe of code.matchAll(/class[nN]ame=\{?[`"]([^`"]*)[`"]/g)) {
        const valeur = classe[1];
        if (/\bmx-auto\b/.test(valeur) && /\bmax-w-(\d|screen-|[2-7]xl)/.test(valeur)) {
          centres.add(nom(fichier));
        }
      }
    }
    expect([...centres].sort()).toEqual(COLONNES_ETROITES);
  });
});

describe("largeur-de-page — la hauteur de l'en-tête, un seul chiffre", () => {
  /** Toutes les hauteurs réservées ou soustraites, fichier par fichier. */
  function hauteursEcrites(): { ou: string; px: number; motif: string }[] {
    const trouvees: { ou: string; px: number; motif: string }[] = [];
    // On ne retient que les écritures dont le SENS est la hauteur de
    // l'en-tête. Le premier jet ramassait tout `h-[…px]` du site et rougissait
    // sur l'avatar d'un squelette à 68 px : viser une forme plutôt qu'un sens
    // donne un faux positif, et un faux positif dans un balayage est aussi
    // coûteux qu'un trou — on finit par le désactiver.
    const motifs: [RegExp, string][] = [
      [/yamba-viewport\)-(\d+)px/g, "soustraction du viewport"],
      [/HEADER_HEIGHT\s*=\s*(\d+)/g, "constante locale"],
    ];
    for (const [fichier, code] of CODE) {
      for (const [motif, libelle] of motifs) {
        for (const m of code.matchAll(motif)) {
          trouvees.push({ ou: nom(fichier), px: Number(m[1]), motif: libelle });
        }
      }
    }
    return trouvees;
  }

  it("le balayage des hauteurs trouve bien les ancrages du site", () => {
    // DOUZE soustractions actives du viewport au 21/11 : les dix d'auth, celle
    // du marketing, celle du dashboard. `grep` en comptait treize — la
    // treizième est du code MORT en commentaire dans le layout marketing, et
    // le dépouillement des commentaires l'écarte. C'est précisément pour cela
    // qu'on dépouille : une règle ne s'applique pas depuis un commentaire.
    // Un balayage qui ne balaye rien est vert (D104).
    expect(hauteursEcrites().length).toBeGreaterThanOrEqual(12);
  });

  it("les deux littéraux de la hauteur portent bien le chiffre de la règle", () => {
    // Tailwind ne résout aucune expression : `h-[${"${n}"}px]` ne génère rien, donc
    // ces deux-là DOIVENT rester des littéraux. C'est la fiche qui tient
    // l'égalité, comme D95 6A le fait pour le pied d'écran.
    const trou = readFileSync(join(SRC, "app", "[locale]", "layout.tsx"), "utf8");
    expect(trou).toContain(`pt-[${HAUTEUR_D_EN_TETE}px]`);
    expect(readFileSync(MODULE, "utf8")).toContain(`h-[${HAUTEUR_D_EN_TETE}px]`);
  });

  it("aucune hauteur écrite ne contredit la hauteur de l'en-tête", () => {
    // Le défaut trouvé par D110, et c'est le jumeau VERTICAL du sien : les dix
    // conteneurs d'auth soustrayaient 64 px — l'ancienne hauteur `h-16` — d'un
    // viewport déjà poussé de 78 px par `app/[locale]/layout.tsx`. Chaque page
    // d'auth réclamait donc 14 px de trop, soit un défilement permanent sur
    // grand écran, sur les huit écrans à la fois.
    //
    // On ne vérifie QUE les hauteurs voisines de celle de l'en-tête : une
    // valeur sans rapport (`h-[400px]` d'une illustration) n'est pas concernée.
    const suspectes = hauteursEcrites().filter(
      (h) => Math.abs(h.px - HAUTEUR_D_EN_TETE) <= 24 && h.px !== HAUTEUR_D_EN_TETE,
    );
    expect(suspectes).toEqual([]);
  });

  it("la constante locale des écrans de recherche est celle du module", () => {
    // Deux fichiers recopiaient `const HEADER_HEIGHT = 78`. Ils l'importent.
    const recopies = [...CODE.entries()].filter(([, code]) =>
      /HEADER_HEIGHT\s*=\s*\d/.test(code),
    );
    expect(recopies.map(([f]) => nom(f))).toEqual([]);
  });
});
