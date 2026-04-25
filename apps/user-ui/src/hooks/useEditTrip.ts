/**
 * useEditTrip.ts
 * ==============
 * Hook for edit mode in the trip creation wizard.
 * Reads `?edit=TRIP_ID` from searchParams, fetches the trip,
 * and returns a pre-filled Draft.
 *
 * 📁 Place in: apps/user-ui/src/hooks/useEditTrip.ts
 */

"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTrip } from "@/hooks/useTrip";
import { mapTripToDraft } from "@/components/trips/create/create-trip.reverse-mapper";
import type { Draft } from "@/components/trips/create/create-trip.types";

export function useEditTrip() {
  const searchParams = useSearchParams();
  const editTripId = searchParams.get("edit") ?? null;

  const { data: trip, isLoading, isError } = useTrip(editTripId);

  const editDraft: Draft | null = useMemo(() => {
    if (!trip) return null;
    return mapTripToDraft(trip);
  }, [trip]);

  return {
    /** The trip ID being edited, or null if creating */
    editTripId,
    /** Whether we're in edit mode */
    isEditMode: !!editTripId,
    /** The pre-filled draft (null while loading or if creating) */
    editDraft,
    /** True while fetching the trip for edit */
    isLoadingEdit: !!editTripId && isLoading,
    /** True if fetch failed */
    isEditError: isError,
  };
}
