/**
 * publish-sauvegarde.ts — le brouillon rattrape le serveur, jamais l'inverse.
 * ============================================================================
 * D111 quater. Le tunnel enregistre son état côté serveur dès qu'il le peut
 * (mode + deux villes, les seuls champs que `createTripSchema` exige), puis
 * à chaque écran franchi.
 *
 * TROIS PARTIS PRIS, ET LE PREMIER COMMANDE LES DEUX AUTRES.
 *
 * ① **La copie LOCALE reste la copie de travail.** La sauvegarde est un
 *    filet, pas une étape : elle ne bloque jamais la navigation, et son
 *    échec ne se montre pas. Quelqu'un qui remplit un formulaire dans un
 *    avion doit pouvoir finir ; lui refuser l'écran suivant parce que le
 *    réseau tousse, c'est lui faire perdre exactement ce que la sauvegarde
 *    est censée protéger.
 *
 * ② **Les enregistrements sont SÉRIALISÉS.** Deux « Continuer » rapprochés
 *    lanceraient deux créations concurrentes, et le Voyageur se retrouverait
 *    avec deux brouillons pour un seul trajet. La file d'attente garantit
 *    que le second appel voit l'identifiant posé par le premier.
 *
 * ③ **L'identifiant ne s'écrase jamais.** Une réponse en retard qui
 *    reviendrait après une reprise d'un AUTRE brouillon ne doit pas lui
 *    voler son id.
 */
import { enregistrerLeBrouillon } from '@/lib/api/publish.api';
import { getPublishDraft, setPublishDraft } from '@/lib/publish-draft';
import { construireCorps } from '@/lib/publish-payload';
import { pretPourLeServeur } from '@/lib/publish-trip';

let enVol: Promise<void> = Promise.resolve();

async function executer(): Promise<void> {
  const draft = getPublishDraft();
  if (!pretPourLeServeur(draft)) return;

  const identifiantAvant = draft.tripId;
  const id = await enregistrerLeBrouillon(construireCorps(draft, false), identifiantAvant);
  if (id === null) return;

  // On ne pose l'identifiant que s'il n'y en avait pas, et seulement si le
  // brouillon courant est toujours celui qu'on a enregistré.
  const courant = getPublishDraft();
  if (courant.tripId === null && identifiantAvant === null) setPublishDraft({ tripId: id });
}

/**
 * Enregistre l'état courant. À appeler SANS attendre (`void`) : la
 * navigation ne dépend pas du réseau.
 */
export function sauvegarderLeBrouillon(): Promise<void> {
  const suite = enVol.then(executer);
  // La file ne doit jamais se rompre sur un échec : on la recolle.
  enVol = suite.catch(() => undefined);
  return suite;
}
