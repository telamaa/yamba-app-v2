/**
 * carrefour.ts — ce qui attend le membre, les deux faces confondues (D114).
 * ==========================================================================
 * L'onglet Activité listait des PORTES. Une porte dit où aller ; elle ne dit
 * pas ce qu'il faut faire, ni dans quel ordre. Quelqu'un qui a un colis à
 * confirmer, une demande qui expire dans deux heures et un Voyageur à noter
 * devait ouvrir trois écrans pour l'apprendre.
 *
 * Ce module fusionne les deux rôles en UNE liste ordonnée. Il ne connaît ni
 * le réseau ni l'écran : on lui donne les projections déjà faites.
 *
 * ── CE QU'ON NE MET PAS DEDANS, ET POURQUOI ─────────────────────────────
 * UNIQUEMENT ce que le membre peut FAIRE AUJOURD'HUI dans l'app. Prendre en
 * charge et remettre un colis sont des gestes autorisés par le serveur, mais
 * leurs écrans n'existent pas encore (hors périmètre D113) : les annoncer
 * ici recréerait exactement le défaut que les trois derniers lots ont
 * corrigé — une porte vers rien. Le jour où ces écrans naissent, ils
 * entrent ici, et une fiche le rappelle.
 *
 * ── L'ORDRE EST NOMMÉ, PAS NUMÉROTÉ ─────────────────────────────────────
 * Le site classe par `{ RESPOND: 0, PICKUP: 1, DELIVER: 1, RATE: 3 }` : une
 * échelle à trous, où personne ne sait ce que vaudrait un 2. Ici l'ordre est
 * une LISTE de noms — on le lit, on l'étend en insérant un mot, et aucune
 * valeur n'est à inventer.
 */
import type { DemandeDeLaListe } from '@/lib/mes-demandes';
import { sectionDeLaDemande } from '@/lib/mes-demandes';
import type { EnvoiDeLaListe } from '@/lib/mes-envois';
import { actionMiseEnAvant } from '@/lib/mes-envois';

/** Ce qu'il y a à faire, du plus pressant au moins pressant. */
export type TypeDeChose = 'repondre' | 'confirmer' | 'noter';

/**
 * L'ordre de traitement, et sa raison :
 *   ① RÉPONDRE — c'est le seul où quelqu'un d'AUTRE perd quelque chose si
 *     l'on tarde : la demande meurt en 24 h et l'Expéditeur perd son colis ;
 *   ② CONFIRMER — l'argent du Voyageur est bloqué tant qu'on ne confirme
 *     pas ; cela se débloque tout seul, mais plus tard ;
 *   ③ NOTER — personne n'attend après, c'est une dette de politesse.
 */
export const ORDRE: readonly TypeDeChose[] = ['repondre', 'confirmer', 'noter'];

export type ChoseQuiAttend =
  | { type: 'repondre'; id: string; echeance: string | null; demande: DemandeDeLaListe }
  | { type: 'confirmer'; id: string; echeance: string | null; envoi: EnvoiDeLaListe }
  | { type: 'noter'; id: string; echeance: string | null; envoi: EnvoiDeLaListe };

/** L'instant d'une échéance, ou `null` si elle est absente ou illisible. */
function instant(iso: string | null): number | null {
  if (iso === null) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Tout ce qui attend, dans l'ordre : par TYPE d'abord, par échéance ensuite.
 *
 * Une chose sans échéance passe après celles qui en ont, à type égal — mais
 * jamais après un type moins pressant : un colis à confirmer sans date reste
 * devant une note à donner, parce que l'argent de quelqu'un dort.
 */
export function choseQuiAttendent(
  envois: EnvoiDeLaListe[],
  demandes: DemandeDeLaListe[]
): ChoseQuiAttend[] {
  const choses: ChoseQuiAttend[] = [];

  for (const demande of demandes) {
    if (sectionDeLaDemande(demande) !== 'aRepondre') continue;
    choses.push({ type: 'repondre', id: demande.id, echeance: demande.expireLe, demande });
  }

  for (const envoi of envois) {
    const action = actionMiseEnAvant(envoi);
    if (action === 'confirmer') {
      choses.push({ type: 'confirmer', id: envoi.id, echeance: null, envoi });
    } else if (action === 'noter') {
      choses.push({ type: 'noter', id: envoi.id, echeance: envoi.noterAvant, envoi });
    }
  }

  return choses.sort((a, b) => {
    const parType = ORDRE.indexOf(a.type) - ORDRE.indexOf(b.type);
    if (parType !== 0) return parType;
    const ta = instant(a.echeance);
    const tb = instant(b.echeance);
    if (ta === null) return tb === null ? 0 : 1;
    if (tb === null) return -1;
    return ta - tb;
  });
}

/**
 * Combien de choses attendent. Zéro est une bonne nouvelle, pas un vide :
 * c'est l'écran qui le dira, ce module se contente de compter.
 */
export function compteDesChoses(choses: ChoseQuiAttend[]): number {
  return choses.length;
}

/**
 * Les N premières, et combien restent derrière.
 *
 * Un carrefour n'est pas une liste de travail : il montre le haut de la pile
 * et dit où est le reste. Dérouler vingt lignes ici transformerait l'écran
 * d'orientation en quatrième liste, et il y en a déjà trois.
 */
export const TETE_DE_PILE = 4;

export function teteDePile(
  choses: ChoseQuiAttend[],
  combien: number = TETE_DE_PILE
): { visibles: ChoseQuiAttend[]; reste: number } {
  return {
    visibles: choses.slice(0, combien),
    reste: Math.max(0, choses.length - combien),
  };
}
