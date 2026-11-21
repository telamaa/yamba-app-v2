/**
 * tab-bar-geometry.ts — les mesures de la barre d'onglets (D109).
 * ===============================================================
 * Pur, zéro import. Les nombres vivent ici et non dans l'écran, pour la même
 * raison qu'`back-affordance.ts` (D105) : une fiche ne peut pas importer un
 * composant — il tire `react-native`, que le harnais (`testEnvironment: node`,
 * A223) ne sait pas charger. Quand un test ne peut pas charger votre code, il
 * vous dit où est la frontière : on déplace la règle, pas la frontière.
 *
 * Ce que ces nombres racontent, et pourquoi ils sont ici plutôt qu'épars.
 * ---------------------------------------------------------------------
 * Avant D109, la barre faisait 52 pt dont 42 d'indicateur, et cet indicateur
 * CONTENAIT le mot : il ne restait que 11 pt de fente, donc 9 pt de police —
 * sous le minimum d'iOS (10) comme de Material 3 (11), et sous le plancher
 * d'interligne de la maison (1,35). Le fichier de la barre était pour cela
 * exempté NOMMÉMENT de `typography.spec.ts`, avec une raison qui n'était pas
 * une propriété du texte mais un coût : « toucher à la fente rouvre D88 ».
 *
 * La taille du texte était donc dictée par une hauteur de pilule. D109 place
 * l'indicateur derrière l'ICÔNE SEULE — la vraie spec de la barre Material 3,
 * que l'ancien fichier citait sans la suivre jusqu'au bout — et le mot vit
 * dessous, hors de lui. Le texte retrouve sa place, l'exception disparaît.
 */

/** Le glyphe d'un onglet. */
export const ICON_SIZE = 22;

/** L'indicateur de sélection : l'icône, et 5 pt de chaque côté. */
export const INDICATOR_HEIGHT = 32;

/** L'écart entre l'indicateur et le mot. */
export const STACK_GAP = 4;

/**
 * Le mot. 10 et non 9 : 10 pt est le minimum d'un libellé d'onglet iOS, et
 * Material 3 descend à 11 sp. En dessous, on n'écrit plus pour être lu.
 */
export const LABEL_SIZE = 10;

/**
 * Son interligne. 14/10 = 1,40, au-dessus du plancher maison de 1,35 — qui
 * existe parce que Plus Jakarta Sans a des jambages généreux et qu'Android
 * les coupe. Le mot qui avait forcé la descente à 9 pt était « Messages » :
 * son `g` était le premier concerné.
 */
export const LABEL_LINE_HEIGHT = 14;

/** La respiration au-dessus et au-dessous du contenu de la barre. */
export const BAR_BREATHING = 5;

/**
 * La hauteur de la barre n'est pas un nombre choisi : c'est une SOMME.
 *
 *     32 (indicateur) + 4 (écart) + 14 (ligne du mot) = 50
 *     + 5 de respiration de chaque côté                = 60
 *
 * L'écrire ainsi évite le défaut que D109 corrige — un nombre posé une fois,
 * puis devenu la contrainte de tout ce qu'il contient.
 */
export function barHeight(): number {
  return INDICATOR_HEIGHT + STACK_GAP + LABEL_LINE_HEIGHT + BAR_BREATHING * 2;
}

/** Le rapport interligne / corps du libellé, que le plancher maison borne. */
export function labelRatio(): number {
  return LABEL_LINE_HEIGHT / LABEL_SIZE;
}

/* ── La marque « Publier » ──────────────────────────────────────────────── */

/** Elle pèse plus que les quatre contours : c'est ce qui la fait lire comme
 *  une ACTION et non comme une cinquième destination. */
export const MARK_SIZE = 30;
export const MARK_RADIUS = 10;
export const MARK_GLYPH = 19;

/** Les deux mangues de la maison. */
export const MARK_BG = '#FF9900';
export const MARK_BG_DEEP = '#CC7A00';

/** Les deux fonds de barre, tels que la barre les peint. */
export const BAR_LIGHT = '#FAFAFB';
export const BAR_DARK = '#1C1C1E';

/**
 * Quelle mangue, selon le thème et l'état — et ce n'est PAS la même paire
 * des deux côtés.
 *
 * Le jeton `mangoDark` porte dans son commentaire « pour l'état actif sur
 * fond CLAIR », et c'est exact : mesuré contre les deux fonds de barre,
 *
 *                    barre claire   barre sombre
 *     #FF9900           2,05:1         7,95:1
 *     #CC7A00           3,17:1         5,15:1
 *
 * Employer `mangoDark` à l'état actif sur une barre SOMBRE revient donc à
 * rendre la marque MOINS visible au moment où elle doit l'être le plus.
 * C'est exactement le défaut ① que D88 avait déjà corrigé une fois sur cette
 * barre : « un même jeton ne vaut pas sur deux supports ».
 *
 * La règle, elle, ne dépend d'aucun jeton : **l'état actif s'éloigne toujours
 * de la luminance de sa barre.** Elle se vérifie, et une fiche la vérifie.
 */
export function markBackground(dark: boolean, focused: boolean): string {
  if (dark) return focused ? MARK_BG : MARK_BG_DEEP;
  return focused ? MARK_BG_DEEP : MARK_BG;
}

/**
 * Le glyphe est en ENCRE et non en blanc, et c'est mesuré : blanc sur
 * `#FF9900` vaut 2,14:1, sous les 3:1 qu'exige WCAG 1.4.11 d'un objet
 * graphique. Cette encre vaut 8,79:1 sur la même mangue — et c'est déjà le
 * couple de la pastille de badge de cette barre. On suit le précédent de la
 * maison plutôt que d'en inventer un.
 */
export const MARK_INK = '#0B1120';
