/**
 * largeur-de-page.ts — « l'en-tête et la page ont la même gouttière » (D110)
 * ===========================================================================
 * La géométrie du cadre de page : sa largeur maximale, sa gouttière, la
 * hauteur de l'en-tête qui la surplombe. Un seul domicile, et des fonctions
 * PURES — donc exécutables par une fiche sans monter React.
 *
 * CE QUE CE FICHIER REMPLACE, ET POURQUOI IL EXISTE
 * -------------------------------------------------
 * Le dépôt avait déjà la bonne règle, écrite au bon endroit, avec sa raison :
 * `components/layout/AppContainer.tsx` annonce « Source de vérité pour les
 * dimensions de layout de l'app […] change-les ici UNE SEULE FOIS et tout le
 * layout de l'app suivra ». Au 21/11, **un seul fichier l'importait**, pendant
 * que `max-w-7xl` était recopié à la main **51 fois dans 37 fichiers** — avec
 * CINQ gouttières différentes autour de lui (45 × `px-4`, 20 × `sm:px-6`,
 * 2 × `px-3`, 1 × `lg:px-8`, 1 × `px-1`).
 *
 * L'en-tête était dans le camp `px-4`. Résultat mesurable : au-delà de 640 px,
 * vingt blocs de contenu — tunnel de réservation, suivi de colis, fiche
 * trajet, notation, affaire du Voyageur — commençaient **8 px plus à
 * l'intérieur que le logo**.
 *
 * D93 avait écrit la moitié de la leçon : « une règle écrite DANS le composant
 * qui s'en sert ne protège qu'une page ». Voici l'autre moitié, plus traître :
 * **une règle écrite dans un composant PARTAGÉ ne protège personne si rien
 * n'oblige à s'en servir.** Une source de vérité que l'on n'importe pas n'est
 * pas une source de vérité, c'est un commentaire.
 *
 * D'où la forme retenue, qui est celle de D105 (le `BackButton` n'expose pas
 * de prop `size`) : le littéral `max-w-7xl` **n'existe plus qu'ici**, et
 * `largeur-de-page.spec.ts` l'interdit partout ailleurs. Une charte ne se
 * défait pas par malveillance, elle se défait par une copie de trop.
 *
 * POURQUOI DES CHAÎNES ET NON DES NOMBRES
 * ---------------------------------------
 * Tailwind lit le TEXTE des sources (`content: ["./src/**\/*.{js,ts,jsx,tsx,mdx}"]`)
 * et ne résout aucune expression : `` h-[${n}px] `` ne génère rien. Les classes
 * doivent donc apparaître littéralement, ce qu'elles font ici — ce fichier est
 * dans le glob. C'est aussi la limite du procédé : `HAUTEUR_D_EN_TETE` porte
 * le NOMBRE pour le JavaScript, mais les pages qui réservent cette hauteur
 * (`pt-[78px]`, `top-[78px]`, `h-[78px]`) gardent leur littéral. La fiche
 * confronte alors les littéraux au nombre, comme D95 6A le fait pour le pied
 * d'écran : les deux côtés ne peuvent pas dériver d'un chiffre.
 */

/**
 * La largeur maximale du cadre — 80 rem, soit 1280 px. Inchangée par D110,
 * qui ne touche que la gouttière et le nombre de domiciles de la règle.
 */
export const LARGEUR_MAX_DE_PAGE = "max-w-7xl";

/**
 * La gouttière, RESPONSIVE : 16 px sur téléphone, 24 px à partir de 640 px.
 *
 * Arbitrage rendu par l'utilisateur le 21/11 sur trois options chiffrées.
 * C'est la valeur que le tunnel de réservation appliquait déjà sur ses vingt
 * blocs — la plus nombreuse des deux, et la seule qui laisse le contenu
 * respirer sur tablette et grand écran. L'en-tête l'adopte : il était la
 * raison du décalage, pas sa victime.
 */
export const GOUTTIERE_DE_PAGE = "px-4 sm:px-6";

/**
 * La hauteur de l'en-tête fixe, en pixels.
 *
 * Elle vivait en trois endroits — `h-[78px]` dans l'en-tête et son squelette,
 * `pt-[78px]` dans `app/[locale]/layout.tsx` qui réserve le trou, et un
 * `const HEADER_HEIGHT = 78` recopié dans DEUX composants de recherche.
 * Quatre copies d'un même nombre, dont l'une doit rester un littéral pour
 * Tailwind : c'est la fiche qui tient l'égalité.
 */
export const HAUTEUR_D_EN_TETE = 78;

/** La classe Tailwind de cette hauteur, pour la rangée de l'en-tête. */
const CLASSE_HAUTEUR_D_EN_TETE = "h-[78px]";

/**
 * Le cadre de page : centré, pleine largeur disponible, plafonné, gouttière.
 *
 * `w-full` est redondant sur un bloc, et il est gardé : ces conteneurs servent
 * aussi d'enfants de `flex`, où `width: auto` ne remplit pas.
 *
 * @param extra Les classes propres à l'appelant — marges verticales, fond,
 *   `relative`… Tout SAUF la largeur et la gouttière, qui sont la charte.
 */
export function conteneurDePage(extra = ""): string {
  return `mx-auto w-full ${LARGEUR_MAX_DE_PAGE} ${GOUTTIERE_DE_PAGE} ${extra}`.trim();
}

/**
 * La rangée de l'en-tête : le cadre de page, plus la mise en ligne de ses
 * contrôles et la respiration qui se réduit au défilement.
 *
 * Elle est partagée parce que `HeaderSkeleton` est monté en PERMANENCE — le
 * `Header` le cache en `display: none` — donc toute règle de l'un doit être
 * écrite dans l'autre. D93 avait payé 27 jours pour l'avoir seulement SU ;
 * ici, les deux fichiers ne peuvent plus diverger, puisqu'ils n'ont plus de
 * chaîne à recopier. Elle portait 94 caractères, à l'identique, deux fois.
 *
 * @param compact Vrai dès que la page a défilé au-delà du seuil.
 */
export function rangeeDEnTete(compact: boolean): string {
  return [
    conteneurDePage(),
    "flex items-center justify-between transition-all",
    CLASSE_HAUTEUR_D_EN_TETE,
    compact ? "py-2" : "py-3",
  ].join(" ");
}
