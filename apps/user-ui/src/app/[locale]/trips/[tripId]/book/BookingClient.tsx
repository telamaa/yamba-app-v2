/**
 * BookingClient.tsx
 * =================
 * Routeur desktop/mobile du wizard de réservation — sur le VRAI trajet
 * (GET /trips/:id/public), plus de mock. Le poids saisi en recherche
 * (localStorage) pré-remplit le colis.
 */

"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import BookingMobile from "@/components/booking/BookingMobile";
import BookingWizard from "@/components/booking/BookingWizard";
import { mapPublicTripToContext } from "@/components/booking/trip-context.mapper";
import { useIsMobile } from "@/hooks/useIsMobile";
import { usePublicTrip } from "@/hooks/usePublicTrip";
import { useRouter } from "@/i18n/navigation";

type Props = {
  tripId: string;
};

export default function BookingClient({ tripId }: Props) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const t = useTranslations("tripDetail");
  const tLoc = useTranslations("booking.locationKinds");
  const { data: publicTrip, isLoading, isError } = usePublicTrip(tripId);

  const trip = useMemo(
    () => (publicTrip ? mapPublicTripToContext(publicTrip, (k) => tLoc(k)) : null),
    [publicTrip, tLoc]
  );

  const handleClose = useCallback(() => {
    router.push(`/trips/${tripId}`);
  }, [router, tripId]);

  if (isMobile === null || isLoading) {
    return <BookingFallback />;
  }

  if (isError || !trip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center dark:bg-slate-950">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{t("notFound.title")}</p>
        <button
          type="button"
          onClick={() => router.push("/search")}
          className="rounded-full bg-[#FF9900] px-4 py-2 text-sm font-bold text-slate-950"
        >
          {t("back")}
        </button>
      </div>
    );
  }

  if (isMobile) {
    return <BookingMobile trip={trip} onCloseAction={handleClose} />;
  }

  return <BookingWizard trip={trip} onCloseAction={handleClose} />;
}

function BookingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#FF9900]" />
    </div>
  );
}
