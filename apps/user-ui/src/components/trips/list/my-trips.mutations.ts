import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

/**
 * Mutations trajets extraites de MyTripsTable (legacy) pour être
 * partagées avec MyTripsList. Les hooks pause/resume/cancel/restore
 * vivent déjà dans @/hooks/useTrip.
 */

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      // ⭐ Lot 3 — le backend honore désormais réellement ?hard=true :
      // soft delete du brouillon (isDeleted + deletedAt), plus de
      // fantôme "Annulé" dans l'Historique.
      await apiClient.delete(`/trips/${tripId}`, {
        params: { hard: true },
        requireAuth: true,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
    },
  });
}

/**
 * ⭐ Lot 3 — NOUVEAU : archive réelle (COMPLETED/CANCELLED → ARCHIVED).
 * Remplace le toast fake `case "archive": ok(...)` dans MyTripsList,
 * MyTripsTable et TripDetails. One-way : pas de désarchivage (MVP),
 * Dupliquer reste disponible sur un trip archivé.
 */
export function useArchiveTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      await apiClient.post(`/trips/${tripId}/archive`, {}, { requireAuth: true });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
    },
  });
}

export function useDuplicateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const res = await apiClient.get(`/trips/${tripId}`, { requireAuth: true });
      const o = res.data.trip;
      await apiClient.post(
        "/trips",
        {
          transportMode: o.transportMode,
          tripType: o.tripType,
          originLabel: o.originLabel,
          originPlaceId: o.originPlaceId,
          originCity: o.originCity,
          originRegion: o.originRegion,
          originCountry: o.originCountry,
          originLat: o.originLat,
          originLng: o.originLng,
          destinationLabel: o.destinationLabel,
          destinationPlaceId: o.destinationPlaceId,
          destinationCity: o.destinationCity,
          destinationRegion: o.destinationRegion,
          destinationCountry: o.destinationCountry,
          destinationLat: o.destinationLat,
          destinationLng: o.destinationLng,
          acceptedCategories: o.acceptedCategories,
          categoryConditions: o.categoryConditions,
          handDeliveryOnly: o.handDeliveryOnly,
          instantBooking: o.instantBooking,
          currencyCode: o.currencyCode,
          notes: o.notes,
          publish: false,
        },
        { requireAuth: true }
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
    },
  });
}

/** DRAFT → PUBLISHED */
export function useActivateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      await apiClient.post(`/trips/${tripId}/publish`, {}, { requireAuth: true });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
    },
  });
}

/** PUBLISHED/PAUSED → DRAFT */
export function useRevertToDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      await apiClient.post(`/trips/${tripId}/unpublish`, {}, { requireAuth: true });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
    },
  });
}
