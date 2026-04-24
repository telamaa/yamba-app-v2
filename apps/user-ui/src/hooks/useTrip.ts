/**
 * useTrip — Hooks React Query pour les opérations Trip
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { Draft } from "@/components/trips/create/create-trip.types";
import { mapDraftToPayload } from "@/components/trips/create/create-trip.mapper";

const BASE = "/trips";

/** Helper: send documents after trip creation/update */
async function syncTripDocuments(tripId: string, draft: Draft) {
  if (!draft.tripDocuments || draft.tripDocuments.length === 0) return;

  const documents = draft.tripDocuments.map((d) => ({
    type: "TICKET_PROOF",
    fileId: d.fileId,
    url: d.url,
    originalName: d.name,
    mimeType: d.mimeType,
    sizeBytes: d.size,
  }));

  await apiClient.post(
    `${BASE}/${tripId}/documents`,
    { documents },
    { requireAuth: true }
  );
}

/** Créer un trip (brouillon ou publié directement) */
export function useCreateTrip() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ draft, publish }: { draft: Draft; publish: boolean }) => {
      const payload = mapDraftToPayload(draft, publish);
      const res = await apiClient.post(BASE, payload, { requireAuth: true });
      const trip = res.data.trip;

      // Sync documents (if any)
      if (trip?.id && draft.tripDocuments?.length > 0) {
        await syncTripDocuments(trip.id, draft);
      }

      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
    },
  });
}

/** Mettre à jour un trip existant */
export function useUpdateTrip() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
                         tripId,
                         draft,
                         publish,
                       }: {
      tripId: string;
      draft: Draft;
      publish?: boolean;
    }) => {
      const payload = mapDraftToPayload(draft, publish ?? false);
      const res = await apiClient.put(`${BASE}/${tripId}`, payload, {
        requireAuth: true,
      });

      // Sync new documents (only those that don't have an existing id in DB)
      // Note: for edit mode, existing documents already on server are kept.
      // New uploads in draft.tripDocuments will be added.
      if (draft.tripDocuments?.length > 0) {
        // Only send docs with a fileId that aren't yet in the server's trip
        // Since the draft stores all uploaded docs, we send them all and the backend
        // handles deduplication via fileId if needed, or you can filter here.
        await syncTripDocuments(tripId, draft);
      }

      return res.data;
    },
    onSuccess: (_, { tripId }) => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
      void qc.invalidateQueries({ queryKey: ["trip", tripId] });
    },
  });
}

/** Publier un brouillon existant */
export function usePublishTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const res = await apiClient.post(`${BASE}/${tripId}/publish`, {}, {
        requireAuth: true,
      });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
    },
  });
}

/** Annuler un trip */
export function useCancelTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const res = await apiClient.delete(`${BASE}/${tripId}`, {
        requireAuth: true,
      });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
    },
  });
}

/** Restaurer un trip annulé */
export function useRestoreTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const res = await apiClient.post(`${BASE}/${tripId}/restore`, {}, {
        requireAuth: true,
      });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
    },
  });
}

/** Mettre en pause */
export function usePauseTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const res = await apiClient.post(`${BASE}/${tripId}/pause`, {}, {
        requireAuth: true,
      });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
    },
  });
}

/** Reprendre */
export function useResumeTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const res = await apiClient.post(`${BASE}/${tripId}/resume`, {}, {
        requireAuth: true,
      });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-trips"] });
    },
  });
}

/** Ajouter des documents */
export function useAddTripDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
                         tripId,
                         documents,
                       }: {
      tripId: string;
      documents: Array<{
        type: string;
        fileId: string;
        url: string;
        originalName?: string;
        mimeType?: string;
        sizeBytes?: number;
      }>;
    }) => {
      const res = await apiClient.post(
        `${BASE}/${tripId}/documents`,
        { documents },
        { requireAuth: true }
      );
      return res.data;
    },
    onSuccess: (_, { tripId }) => {
      void qc.invalidateQueries({ queryKey: ["trip", tripId] });
    },
  });
}

/** Supprimer un document */
export function useRemoveTripDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
                         tripId,
                         documentId,
                       }: {
      tripId: string;
      documentId: string;
    }) => {
      const res = await apiClient.delete(
        `${BASE}/${tripId}/documents/${documentId}`,
        { requireAuth: true }
      );
      return res.data;
    },
    onSuccess: (_, { tripId }) => {
      void qc.invalidateQueries({ queryKey: ["trip", tripId] });
    },
  });
}

/** Récupérer un trip par ID */
export function useTrip(tripId: string | null) {
  return useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const res = await apiClient.get(`${BASE}/${tripId}`, {
        requireAuth: true,
      });
      return res.data.trip;
    },
    enabled: !!tripId,
  });
}

/** Récupérer tous les trips */
export function useMyTrips(status?: string) {
  return useQuery({
    queryKey: ["my-trips", status],
    queryFn: async () => {
      const url = status ? `${BASE}/my?status=${status}` : `${BASE}/my`;
      const res = await apiClient.get(url, { requireAuth: true });
      return res.data;
    },
  });
}
