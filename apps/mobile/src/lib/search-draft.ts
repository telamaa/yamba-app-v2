/**
 * search-draft.ts — le brouillon de recherche, partagé entre l'écran et ses
 * pages poussées.
 * ==========================================================================
 * Départ, destination et date se choisissent désormais dans de VRAIES pages
 * (`/search/city`, `/search/date`) qui glissent depuis la droite — le motif
 * natif des deux OS, celui que le web imite déjà dans
 * `MobileFieldFullScreen`. Mais une page poussée ne RETOURNE pas de valeur :
 * `router.back()` ne transporte rien.
 *
 * D'où ce brouillon EN MÉMOIRE de processus — exactement le motif de
 * `auth-flow-state.ts` pour les parcours d'auth à étapes. La page écrit, se
 * referme, l'écran lit. L'app tuée = le brouillon disparaît, comme un
 * formulaire abandonné : c'est voulu, ce n'est pas une préférence à
 * persister.
 *
 * Les abonnés sont notifiés à chaque écriture (`useSyncExternalStore` côté
 * écran) : pas de scrutation, pas de rafraîchissement à l'ouverture.
 */
import type { SearchDate } from '@/lib/search-date';

export type SearchDraft = {
  from: string;
  to: string;
  date: SearchDate | null;
};

let draft: SearchDraft = { from: '', to: '', date: null };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** `useSyncExternalStore` exige une référence STABLE tant que rien ne change
 *  — renvoyer un nouvel objet à chaque appel boucle à l'infini. */
export function getSearchDraft(): SearchDraft {
  return draft;
}

export function setSearchDraft(patch: Partial<SearchDraft>): void {
  draft = { ...draft, ...patch };
  emit();
}

export function subscribeSearchDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
