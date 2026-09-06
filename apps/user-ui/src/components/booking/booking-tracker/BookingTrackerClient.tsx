/**
 * BookingTrackerClient.tsx
 * ========================
 * Orchestrateur principal du module BookingTracker côté Expéditeur.
 * Données RÉELLES : GET /deals/:id (vue Shipper) via l'adapter (A37),
 * TanStack Query (relecture serveur, jamais de vérité locale).
 * Switch sur booking.status :
 *   ACCEPTED           → É3  (BookingAccepted*)
 *   PICKED_UP sans/avec trackingEvents → É4b / É6
 *   DELIVERED          → É8
 *   autres statuts     → BookingStatusNotice (jamais de fallback menteur)
 * L'URL reste stable : /bookings/[bookingId]
 *
 * Les handlers de code régénéré / confirmation anticipée écrivent le
 * cache local car leurs actions sont ENCORE MOCK (B3/B4) — ils
 * deviendront des invalidateQueries quand les endpoints existeront.
 */

"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
import { getBooking } from "./booking-tracker.api";
import { NOTIFICATIONS_QUERY_KEY } from "@/hooks/useNotifications";
import BookingTrackerSkeleton from "./BookingTrackerSkeleton";
import BookingAcceptedDesktop from "./views/accepted/BookingAcceptedDesktop";
import BookingAcceptedMobile from "./views/accepted/BookingAcceptedMobile";
import BookingPickedUpDesktop from "./views/picked-up/BookingPickedUpDesktop";
import BookingPickedUpMobile from "./views/picked-up/BookingPickedUpMobile";
import BookingDeliveredDesktop from "./views/delivered/BookingDeliveredDesktop";
import BookingDeliveredMobile from "./views/delivered/BookingDeliveredMobile";
import BookingInTransitDesktop from "./views/in-transit/BookingInTransitDesktop";
import BookingInTransitMobile from "./views/in-transit/BookingInTransitMobile";
import BookingStatusNotice from "./views/status/BookingStatusNotice";
import BookingCompletedDesktop from "./views/completed/BookingCompletedDesktop";
import BookingCompletedMobile from "./views/completed/BookingCompletedMobile";
import BookingDisputedDesktop from "./views/disputed/BookingDisputedDesktop";
import BookingDisputedMobile from "./views/disputed/BookingDisputedMobile";

export const bookingQueryKey = (bookingId: string) => ["booking", bookingId];

type Props = {
  bookingId: string;
};

export default function BookingTrackerClient({ bookingId }: Props) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: booking,
    isPending,
    isError,
  } = useQuery({
    queryKey: bookingQueryKey(bookingId),
    queryFn: () => getBooking(bookingId),
    staleTime: 30_000,
    retry: 1,
  });

  const handleClose = useCallback(() => {
    router.push("/dashboard/shipments");
  }, [router]);

  // Régénération RÉELLE (B3/A43) : le serveur a écrit le nouveau code, on
  // RELIT — le code affiché vient toujours de GET /deals/:id, jamais du
  // cache local (les deux paramètres restent pour la signature des cards).
  const handleCodeRegenerated = useCallback(
    (_newCode: string, _regeneratedCount: number) => {
      void queryClient.invalidateQueries({ queryKey: bookingQueryKey(bookingId) });
    },
    [queryClient, bookingId]
  );

  // Confirmation anticipée RÉELLE (B4-PR2) : le serveur a clos le deal, on
  // RELIT — la vue « Envoi terminé » vient de GET /deals/:id (A71).
  const handleEarlyConfirmed = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: bookingQueryKey(bookingId) });
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }); // A91 : la cloche suit le geste
  }, [queryClient, bookingId]);

  if (isMobile === null || isPending) {
    return <BookingTrackerSkeleton />;
  }

  if (isError || !booking) {
    return <BookingTrackerError onBackAction={handleClose} />;
  }

  if (booking.status === "DELIVERED") {
    return isMobile ? (
      <BookingDeliveredMobile booking={booking} onCloseAction={handleClose} onConfirmedAction={handleEarlyConfirmed} />
    ) : (
      <BookingDeliveredDesktop booking={booking} onCloseAction={handleClose} onConfirmedAction={handleEarlyConfirmed} />
    );
  }

  // B4-PR2 (A71) : la fin de transaction et le litige ont leur vraie vue.
  if (booking.status === "VERIFIED") {
    return isMobile ? (
      <BookingCompletedMobile booking={booking} onCloseAction={handleClose} />
    ) : (
      <BookingCompletedDesktop booking={booking} onCloseAction={handleClose} />
    );
  }

  if (booking.status === "DISPUTED") {
    return isMobile ? (
      <BookingDisputedMobile booking={booking} onCloseAction={handleClose} />
    ) : (
      <BookingDisputedDesktop booking={booking} onCloseAction={handleClose} />
    );
  }

  if (booking.status === "PICKED_UP") {
    // Écran 6 (voyage en cours) si le Voyageur a confirmé des événements,
    // sinon écran 4 (code fraîchement révélé, priorité à la transmission)
    const hasTrackingEvents = (booking.trackingEvents ?? []).length > 0;

    if (hasTrackingEvents) {
      return isMobile ? (
        <BookingInTransitMobile
          booking={booking}
          onCloseAction={handleClose}
          onCodeRegeneratedAction={handleCodeRegenerated}
        />
      ) : (
        <BookingInTransitDesktop
          booking={booking}
          onCloseAction={handleClose}
          onCodeRegeneratedAction={handleCodeRegenerated}
        />
      );
    }

    return isMobile ? (
      <BookingPickedUpMobile
        booking={booking}
        onCloseAction={handleClose}
        onCodeRegeneratedAction={handleCodeRegenerated}
      />
    ) : (
      <BookingPickedUpDesktop
        booking={booking}
        onCloseAction={handleClose}
        onCodeRegeneratedAction={handleCodeRegenerated}
      />
    );
  }

  if (booking.status === "ACCEPTED") {
    return isMobile ? (
      <BookingAcceptedMobile booking={booking} onCloseAction={handleClose} />
    ) : (
      <BookingAcceptedDesktop booking={booking} onCloseAction={handleClose} />
    );
  }

  // AWAITING_CARRIER, DECLINED, EXPIRED, CANCELLED :
  // vue d'état neutre — une URL directe ne ment jamais (A37).
  return <BookingStatusNotice booking={booking} onBackAction={handleClose} />;
}

function BookingTrackerError({ onBackAction }: { onBackAction: () => void }) {
  const t = useTranslations("bookingTracker");
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-slate-950">
      <div className="max-w-sm text-center">
        <p className="text-[14px] text-slate-600 dark:text-slate-400">
          {t("error.notFound")}
        </p>
        <button
          type="button"
          onClick={onBackAction}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-[#FF9900] px-5 py-2 text-[13px] font-bold text-slate-950 hover:bg-[#F08700]"
        >
          {t("back")}
        </button>
      </div>
    </div>
  );
}
