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
import { mesDemandes } from '@/lib/api/my-deals.api';
import { mesEnvois } from '@/lib/api/shipment.api';
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
  /** `false` tant que la première lecture n'est pas revenue. */
  pret: boolean;
};

const VIDE: ActiviteState = { badges: ZERO, envois: [], demandes: [], pret: false };

const ActiviteContext = createContext<ActiviteState | null>(null);

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
      apiFetch<{ totalUnread: number }>('/messages/conversations').catch(() => null),
      mesEnvois(),
    ]);

    const demandes = deals
      .map(demandeDeLApi)
      .filter((d): d is DemandeDeLaListe => d !== null);
    const envois = envoisBruts
      .map(envoiDeLApi)
      .filter((e): e is EnvoiDeLaListe => e !== null);

    setEtat({
      // LES COMPTEURS DÉRIVENT DES LISTES : c'est ce qui rend impossible
      // qu'un badge dise autre chose que l'écran vers lequel il mène.
      badges: {
        pendingDeals: demandes.filter((d) => sectionDeLaDemande(d) === 'aRepondre').length,
        draftTrips: tripsOf(trips ?? []).filter(
          (t) => t.status === 'DRAFT' || t.status === 'PAUSED'
        ).length,
        unreadMessages: conversations?.totalUnread ?? 0,
        shipmentsToHandle: envois.filter((e) => sectionDeLEnvoi(e) === 'aTraiter').length,
      },
      envois,
      demandes,
      pret: true,
    });
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

  return <ActiviteContext.Provider value={etat}>{children}</ActiviteContext.Provider>;
}

/**
 * L'activité complète. Rend l'état VIDE hors du fournisseur plutôt que de
 * jeter : un badge absent n'a jamais à casser un écran (c'est déjà la
 * doctrine de ce hook — « un badge qui échoue vaut zéro »).
 */
export function useActivite(): ActiviteState {
  return useContext(ActiviteContext) ?? VIDE;
}

/** Les compteurs seuls. Même signature qu'avant D114 : rien à changer chez les appelants. */
export function useTabBadges(): TabBadges {
  const { badges } = useActivite();
  return useMemo(() => badges, [badges]);
}
