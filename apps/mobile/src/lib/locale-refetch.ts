/**
 * locale-refetch.ts — redemander au serveur ce qu'il a mis en forme DANS une
 * langue, quand la langue change.
 * ============================================================================
 * LE DÉFAUT, MESURÉ (émulateur Android, 09/11/2026). On arrive en visiteur,
 * l'appareil est en anglais, le flux d'accueil s'affiche. On se connecte : le
 * compte est en français, toute l'app bascule — et les cartes continuent
 * d'annoncer « November 13, 2026 » à côté de « 9,50 € » et « Nouveau
 * Voyageur ».
 *
 * POURQUOI. `travelDate` n'est pas calculé ici : il arrive DÉJÀ ÉCRIT du
 * serveur (`apps/trip-service/src/lib/trip-mappers.ts`, d'après l'en-tête
 * `x-locale`), parce que lui seul connaît le fuseau d'ORIGINE du trajet — un
 * départ à 23 h 30 à Paris n'est pas le même jour vu de Montréal. C'est donc
 * la seule chaîne de la liste que le client ne sait pas retraduire tout seul :
 * toutes les autres passent par `use-intl` et se re-rendent, celle-là est une
 * DONNÉE, et une donnée ne change pas parce qu'un rendu a eu lieu.
 *
 * LA RÈGLE. Tout écran qui GARDE une réponse serveur contenant du texte
 * localisé doit la redemander quand la langue change. Pas « se re-rendre » :
 * REDEMANDER.
 *
 * POURQUOI UNE FONCTION, ET PAS TROIS LIGNES DANS L'ÉCRAN. Parce qu'une
 * langue qui change est un évènement RARE — connexion, déconnexion, réglage —
 * que personne ne reproduit en recette courante : c'est exactement le genre de
 * règle qui se casse sans bruit. Écrite ici, elle se vérifie sans rendu
 * (`testEnvironment: node`, A223) et elle se relit en un seul endroit.
 *
 * ATTENTION — l'onglet Favoris s'en tire aujourd'hui PAR ACCIDENT : son
 * chargement dépend de `t`, dont l'identité change avec la langue, ce qui
 * relance l'effet. Mémoriser `t` (une optimisation parfaitement légitime)
 * rétablirait le défaut en silence. Un accident n'est pas une règle.
 */

/**
 * Où en est l'écran : rien demandé (`idle`), demande en vol (`pending`),
 * réponse à l'écran (`served`).
 */
export type LocaleRefetchState = 'idle' | 'pending' | 'served';

export type LocaleRefetchInput = {
  /**
   * La langue de ce que l'on tient. L'appelant l'initialise à la langue DU
   * MONTAGE — jamais à vide : c'est ce qui garantit qu'une ouverture d'écran
   * ne déclenche aucun aller-retour supplémentaire.
   */
  served: string;
  /** La langue de l'écran, maintenant. */
  current: string;
  state: LocaleRefetchState;
};

/**
 * Faut-il relancer la demande ?
 *
 * OUI seulement si la langue a changé depuis ce que l'on tient ET qu'il y a
 * quelque chose à remplacer. `pending` compte : la requête en vol est partie
 * avec l'ANCIEN en-tête, sa réponse arriverait dans l'ancienne langue.
 *
 * NON quand l'écran est encore vide (`idle`) : la prochaine demande, quelle
 * qu'elle soit, portera la bonne langue d'elle-même. Redemander ici ferait un
 * aller-retour pour remplacer du néant.
 */
export function shouldRefetchForLocale({ served, current, state }: LocaleRefetchInput): boolean {
  if (served === current) return false;
  return state !== 'idle';
}
