/**
 * use-tab-badges.ts — les compteurs des onglets (lot tabs D36).
 * =============================================================
 * Trajets : le badge « à traiter » du web (A44) transposé — demandes PENDING
 * (GET /me/deals, Voyageur seulement) + trajets DRAFT/PAUSED (GET /trips/my).
 * Messages : `totalUnread` de GET /messages/conversations — le serveur compte,
 * jamais le client. Rafraîchi à l'ouverture de session et au retour de l'app
 * au premier plan ; un visiteur anonyme n'a aucun badge. Un badge qui échoue
 * vaut zéro : il ne casse jamais la coquille.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { apiFetch } from '@/lib/api/client';
import { mesEnvois } from '@/lib/api/shipment.api';
import { envoiDeLApi, sectionDeLEnvoi } from '@/lib/mes-envois';
import { useSession } from '@/lib/session-context';

type TripLike = { status?: string };
type MyTripsResponse = TripLike[] | { trips?: TripLike[] };

export type TabBadges = {
  /** Demandes PENDING reçues (Voyageur). */
  pendingDeals: number;
  /** Trajets DRAFT ou PAUSED à finaliser (Voyageur). */
  draftTrips: number;
  /** Messages non lus, toutes conversations (compté par le serveur). */
  unreadMessages: number;
  /**
   * Envois qui attendent un geste de l'EXPÉDITEUR (D112).
   *
   * Compté par `sectionDeLEnvoi`, la règle même qu'applique l'écran « Mes
   * envois » : un compteur calculé à part finit par dire autre chose que
   * l'écran vers lequel il mène — c'est le défaut mesuré sur le site, où
   * « En cours » affiche deux nombres différents sur le même écran.
   */
  shipmentsToHandle: number;
};

const ZERO: TabBadges = {
  pendingDeals: 0,
  draftTrips: 0,
  unreadMessages: 0,
  shipmentsToHandle: 0,
};

function tripsOf(body: MyTripsResponse): TripLike[] {
  if (Array.isArray(body)) return body;
  return Array.isArray(body.trips) ? body.trips : [];
}

export function useTabBadges(): TabBadges {
  const { status, user } = useSession();
  const [badges, setBadges] = useState<TabBadges>(ZERO);
  const isCarrier = user?.roles.includes('CARRIER') ?? false;

  const refresh = useCallback(async () => {
    const [deals, trips, conversations, envois] = await Promise.all([
      isCarrier
        ? apiFetch<{ deals: { status: string }[] }>('/me/deals').catch(() => null)
        : Promise.resolve(null),
      apiFetch<MyTripsResponse>('/trips/my').catch(() => null),
      apiFetch<{ totalUnread: number }>('/messages/conversations').catch(() => null),
      // `mesEnvois` se tait déjà en cas d'échec : un badge qui échoue vaut
      // zéro, il ne casse jamais la coquille.
      mesEnvois(),
    ]);
    setBadges({
      pendingDeals: deals?.deals.filter((d) => d.status === 'PENDING').length ?? 0,
      draftTrips: tripsOf(trips ?? []).filter(
        (t) => t.status === 'DRAFT' || t.status === 'PAUSED'
      ).length,
      unreadMessages: conversations?.totalUnread ?? 0,
      shipmentsToHandle: envois
        .map(envoiDeLApi)
        .filter((envoi) => envoi !== null && sectionDeLEnvoi(envoi) === 'aTraiter').length,
    });
  }, [isCarrier]);

  useEffect(() => {
    if (status !== 'authenticated') {
      setBadges(ZERO);
      return;
    }
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [status, refresh]);

  return badges;
}
