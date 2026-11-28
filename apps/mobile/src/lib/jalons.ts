/**
 * jalons.ts — le transport se raconte en trois crans (D116, A39).
 * =================================================================
 * Zéro import.
 *
 * ── UN RÉCIT, PAS UN FORMULAIRE ─────────────────────────────────────────
 * Le serveur n'accepte les trois jalons que DANS L'ORDRE, et refuse celui
 * qui saute son tour (`TRACKING_STEP_NOT_ALLOWED`). Une liste de trois cases
 * à cocher librement inviterait donc un refus que rien n'explique : l'app
 * n'offre que le SUIVANT.
 *
 * ── ILS SONT FACULTATIFS, ET CELA SE VOIT ───────────────────────────────
 * Ne rien cocher n'empêche pas de remettre le colis. Les jalons servent
 * l'Expéditeur, qui regarde son suivi pendant que son colis vole ; ils ne
 * sont pas une condition du métier. L'écran ne doit donc jamais les
 * présenter comme une étape à franchir.
 *
 * Les trois codes sont RECOPIÉS de `TRACKING_SEQUENCE`
 * (`booking-state-machine.ts`) : le mobile ne peut pas importer le contrat
 * (A223). Une fiche confronte cette copie au contrat Zod réel.
 */

/** Les trois crans, DANS L'ORDRE imposé par le serveur (A39). */
export const JALONS = ['AT_AIRPORT', 'FLIGHT_DEPARTED', 'FLIGHT_ARRIVED'] as const;

export type Jalon = (typeof JALONS)[number];

/**
 * Les jalons déjà confirmés, lus des `trackingEvents` du serveur.
 *
 * On FILTRE sur les trois codes connus plutôt que de faire confiance à la
 * liste : un cran inconnu (ajouté côté serveur avant que l'app ne le
 * connaisse) ne doit pas décaler la séquence — il ferait proposer le mauvais
 * geste suivant.
 */
export function jalonsConfirmes(evenements: unknown): Jalon[] {
  if (!Array.isArray(evenements)) return [];
  const vus: Jalon[] = [];
  for (const brut of evenements) {
    const step =
      typeof brut === 'object' && brut !== null
        ? (brut as Record<string, unknown>).step
        : undefined;
    if (typeof step !== 'string') continue;
    const jalon = JALONS.find((j) => j === step);
    // Un doublon ne compte pas deux fois : le serveur refuse un cran déjà
    // confirmé, mais l'app lit une liste d'événements, pas un ensemble.
    if (jalon !== undefined && !vus.includes(jalon)) vus.push(jalon);
  }
  // L'ordre du RÉCIT, pas celui de la liste reçue : deux événements écrits
  // dans la même seconde peuvent revenir inversés.
  return JALONS.filter((j) => vus.includes(j));
}

/**
 * LE SEUL geste proposé : le cran suivant, ou `null` quand tout est dit.
 *
 * C'est la règle du serveur, recopiée : `expected = SEQUENCE[confirmés.length]`.
 */
export function jalonSuivant(confirmes: readonly Jalon[]): Jalon | null {
  return JALONS[confirmes.length] ?? null;
}

/* Pas de « 2 sur 3 » ici : l'écran affiche LES TROIS crans, cochés ou non,
 * et un compteur à côté de trois lignes visibles compte ce qu'on voit déjà.
 * Une fonction écrite pour une jauge que personne n'affiche a vécu ici. */

/**
 * Le serveur accepterait-il ce cran maintenant ? L'app ne propose que
 * `jalonSuivant`, mais cette question garde la porte : un écran qui aurait
 * gardé un ancien état en mémoire ne doit pas envoyer un cran périmé.
 */
export function jalonEnvoyable(confirmes: readonly Jalon[], jalon: Jalon): boolean {
  return jalonSuivant(confirmes) === jalon;
}
