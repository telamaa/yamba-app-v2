"use client";

/**
 * useTripsBadge — compteur « à traiter » de Mes trajets (A44)
 * ============================================================
 * Demandes en attente (deals réels, GET /me/deals) + brouillons/pauses à
 * finaliser. Partagé par la sidebar desktop et la barre mobile : un seul
 * calcul, un seul cache.
 */

import { useMemo } from "react";
import useUser from "@/hooks/useUser";
import { useMyTrips } from "@/hooks/useTrip";
import { useMyDeals } from "@/hooks/useMyDeals";
import type { TripListItem } from "@/components/trips/list/my-trips.config";

export function useTripsBadge(): number {
  const { user } = useUser();
  const isCarrier = Boolean((user as { roles?: string[] } | undefined)?.roles?.includes("CARRIER"));
  const { data: rawTripsData } = useMyTrips();
  const { data: dealViews } = useMyDeals({ enabled: isCarrier });

  return useMemo(() => {
    const trips: TripListItem[] = !rawTripsData
      ? []
      : Array.isArray(rawTripsData)
        ? rawTripsData
        : Array.isArray(rawTripsData.trips)
          ? rawTripsData.trips
          : [];
    const pendingDeals = (dealViews ?? []).filter((d) => d.status === "PENDING").length;
    return trips.reduce(
      (count, trip) => count + (trip.status === "DRAFT" || trip.status === "PAUSED" ? 1 : 0),
      pendingDeals
    );
  }, [rawTripsData, dealViews]);
}
