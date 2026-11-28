/**
 * activite-context.tsx — UNE lecture, pour tout ce qui compte l'activité.
 * =========================================================================
 * D114. `use-tab-badges.ts` était un hook à état LOCAL : chacun de ses
 * consommateurs refaisait les requêtes pour son compte. Ils étaient trois
 * (la barre d'onglets, l'onglet Messages, l'onglet Activité), donc jusqu'à
 * TROIS jeux d'appels à chaque passage de l'app au premier plan — et le
 * carrefour en aurait fait un quatrième.
 *
 * Pire que le gaspillage : trois lectures à trois instants différents
 * peuvent se CONTREDIRE. Le badge de la barre annoncerait deux demandes
 * pendant que l'écran en montre une. C'est le défaut mesuré sur le site,
 * où « En cours » affiche deux nombres à quarante pixels d'écart — ici il
 * serait séparé par une barre d'onglets, donc encore plus difficile à voir.
 *
 * UNE lecture, UNE vérité, et les compteurs DÉRIVENT des mêmes listes que
 * les écrans. `useTabBadges` garde son nom et sa forme : ses trois appelants
 * n'ont rien à changer.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { apiFetch } from '@/lib/api/client';
import { mesConversations } from '@/lib/api/messages.api';
import { mesDemandes } from '@/lib/api/my-deals.api';
import { mesEnvois } from '@/lib/api/shipment.api';
import { conversationsDeLApi, type ConversationDeLaListe } from '@/lib/fil';
import { demandeDeLApi, sectionDeLaDemande, type DemandeDeLaListe } from '@/lib/mes-demandes';
import { envoiDeLApi, sectionDeLEnvoi, type EnvoiDeLaListe } from '@/lib/mes-envois';
import { useSession } from '@/lib/session-context';

type TripLike = { status?: string };
type MyTripsResponse = TripLike[] | { trips?: TripLike[] };

export type TabBadges = {
  /** Demandes qui attendent une réponse (Voyageur). */
  pendingDeals: number;
  /** Trajets DRAFT ou PAUSED à finaliser (Voyageur). */
  draftTrips: number;
  /** Messages non lus, toutes conversations (compté par le serveur). */
  unreadMessages: number;
  /** Envois qui attendent un geste de l'Expéditeur. */
  shipmentsToHandle: number;
};

const ZERO: TabBadges = {
  pendingDeals: 0,
  draftTrips: 0,
  unreadMessages: 0,
  shipmentsToHandle: 0,
};

type ActiviteState = {
  badges: TabBadges;
  envois: EnvoiDeLaListe[];
  demandes: DemandeDeLaListe[];
  /**
   * D117 — les conversations, GARDÉES.
   *
   * Elles arrivaient déjà : le serveur sert `{ items, totalUnread }` et ce
   * fichier typait la réponse `{ totalUnread: number }`. La liste entière
   * traversait le réseau à chaque rafraîchissement et mourait à
   * `JSON.parse` — D102 rejoué sur un autre contrat. L'onglet Messages la
   * lit désormais d'ici, et c'est la MÊME lecture que le badge : une
   * pastille ne peut pas annoncer autre chose que l'écran où elle mène.
   */
  conversations: ConversationDeLaListe[];
  /**
   * La lecture des conversations a ÉCHOUÉ.
   *
   * Sans ce drapeau, une panne réseau donnerait une liste vide, et l'écran
   * dirait « aucune conversation » — un mensonge, et le même que D115 bis
   * et D116 bis ont corrigé deux fois sur le site (le squelette perpétuel,
   * puis la lecture non attrapée). Une absence et une panne ne se disent
   * pas avec la même phrase.
   */
  conversationsEnEchec: boolean;
  /** `false` tant que la première lecture n'est pas revenue. */
  pret: boolean;
};

/**
 * Ce que voient les écrans : les données, PLUS le moyen de les relire.
 *
 * L'action est tenue à part de l'état. Une `relire` rangée DANS l'état
 * qu'elle produit se référencerait elle-même — TypeScript le refuse, et il
 * a raison : une donnée et le moyen de l'obtenir n'ont pas la même durée
 * de vie.
 */
export type Activite = ActiviteState & { rafraichir: () => Promise<void> };

const VIDE: ActiviteState = {
  badges: ZERO,
  envois: [],
  demandes: [],
  conversations: [],
  conversationsEnEchec: false,
  pret: false,
};

const ActiviteContext = createContext<Activite | null>(null);

const RIEN: Activite = { ...VIDE, rafraichir: async () => undefined };

/** Sentinelle : une lecture qui a échoué n'est pas une lecture vide. */
const ECHEC = Symbol('lecture en échec');

function tripsOf(body: MyTripsResponse): TripLike[] {
  if (Array.isArray(body)) return body;
  return Array.isArray(body.trips) ? body.trips : [];
}

export function ActiviteProvider({ children }: { children: ReactNode }) {
  const { status, user } = useSession();
  const [etat, setEtat] = useState<ActiviteState>(VIDE);
  const isCarrier = user?.roles.includes('CARRIER') ?? false;

  const relire = useCallback(async () => {
    const [deals, trips, conversations, envoisBruts] = await Promise.all([
      isCarrier ? mesDemandes() : Promise.resolve([]),
      apiFetch<MyTripsResponse>('/trips/my').catch(() => null),
      mesConversations().catch(() => ECHEC),
      mesEnvois(),
    ]);

    // La réponse ENTIÈRE, enfin lue (D117 0A).
    const enEchec = conversations === ECHEC;
    const fils = conversationsDeLApi(enEchec ? null : conversations);
    const demandes = deals
      .map(demandeDeLApi)
      .filter((d): d is DemandeDeLaListe => d !== null);
    const envois = envoisBruts
      .map(envoiDeLApi)
      .filter((e): e is EnvoiDeLaListe => e !== null);

    // Forme à UPDATER : le compteur des messages doit pouvoir relire le
    // précédent quand la lecture a échoué. L'updater reste PUR — il ne fait
    // que calculer (CQS, leçon D83) ; les effets sont déjà tous derrière.
    setEtat((precedent) => ({
      // LES COMPTEURS DÉRIVENT DES LISTES : c'est ce qui rend impossible
      // qu'un badge dise autre chose que l'écran vers lequel il mène.
      badges: {
        pendingDeals: demandes.filter((d) => sectionDeLaDemande(d) === 'aRepondre').length,
        draftTrips: tripsOf(trips ?? []).filter(
          (t) => t.status === 'DRAFT' || t.status === 'PAUSED'
        ).length,
        // Une panne ne REMET PAS la pastille à zéro : elle garderait le
        // dernier compte connu plutôt que d'annoncer « tout est lu », ce
        // qui est la version silencieuse du même mensonge.
        unreadMessages: enEchec ? precedent.badges.unreadMessages : fils.totalNonLus,
        shipmentsToHandle: envois.filter((e) => sectionDeLEnvoi(e) === 'aTraiter').length,
      },
      envois,
      demandes,
      // Une panne garde la DERNIÈRE liste connue : un écran qui se vide
      // pendant que le réseau hoquette est pire qu'un écran un peu vieux.
      conversations: enEchec ? precedent.conversations : fils.items,
      conversationsEnEchec: enEchec,
      pret: true,
    }));
  }, [isCarrier]);

  useEffect(() => {
    if (status !== 'authenticated') {
      setEtat(VIDE);
      return;
    }
    void relire();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void relire();
    });
    return () => subscription.remove();
  }, [status, relire]);

  const valeur = useMemo<Activite>(() => ({ ...etat, rafraichir: relire }), [etat, relire]);

  return <ActiviteContext.Provider value={valeur}>{children}</ActiviteContext.Provider>;
}

/**
 * L'activité complète. Rend l'état VIDE hors du fournisseur plutôt que de
 * jeter : un badge absent n'a jamais à casser un écran (c'est déjà la
 * doctrine de ce hook — « un badge qui échoue vaut zéro »).
 */
export function useActivite(): Activite {
  return useContext(ActiviteContext) ?? RIEN;
}

/** Les compteurs seuls. Même signature qu'avant D114 : rien à changer chez les appelants. */
export function useTabBadges(): TabBadges {
  const { badges } = useActivite();
  return useMemo(() => badges, [badges]);
}
