/**
 * BookingTrackerClient.tsx
 * ========================
 * Orchestrateur principal du module BookingTracker côté Expéditeur.
 * Switch sur booking.status :
 *   ACCEPTED  → BookingAccepted*
 *   PICKED_UP → BookingPickedUp* (code révélé)
 *   (futurs)  → IN_TRANSIT, DELIVERED, VERIFIED, etc.
 * L'URL reste stable : /bookings/[bookingId]
 *
 * Mock : un bookingId contenant "picked" charge le statut PICKED_UP.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";
import { getBooking } from "./booking-tracker.api";
import type { Booking } from "./booking-tracker.types";
import BookingTrackerSkeleton from "./BookingTrackerSkeleton";
import BookingAcceptedDesktop from "./views/accepted/BookingAcceptedDesktop";
import BookingAcceptedMobile from "./views/accepted/BookingAcceptedMobile";
import BookingPickedUpDesktop from "./views/picked-up/BookingPickedUpDesktop";
import BookingPickedUpMobile from "./views/picked-up/BookingPickedUpMobile";
import BookingDeliveredDesktop from "./views/delivered/BookingDeliveredDesktop";
import BookingDeliveredMobile from "./views/delivered/BookingDeliveredMobile";
import BookingInTransitDesktop from "./views/in-transit/BookingInTransitDesktop";
import BookingInTransitMobile from "./views/in-transit/BookingInTransitMobile";

type Props = {
  bookingId: string;
};

export default function BookingTrackerClient({ bookingId }: Props) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBooking(null);
    setLoadError(false);
    getBooking(bookingId)
      .then((b) => {
        if (!cancelled) setBooking(b);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const handleClose = useCallback(() => {
    router.push("/");
  }, [router]);

  // Mise à jour locale du code après régénération (le mock ne persiste pas)
  const handleCodeRegenerated = useCallback(
    (newCode: string, regeneratedCount: number) => {
      setBooking((prev) =>
        prev
          ? {
            ...prev,
            deliveryCode: {
              ...prev.deliveryCode,
              code: newCode,
              regeneratedCount,
            },
          }
          : prev
      );
    },
    []
  );

  const [earlyConfirmedAt, setEarlyConfirmedAt] = useState<string | null>(null);

  const handleEarlyConfirmed = useCallback((confirmedAt: string) => {
    setEarlyConfirmedAt(confirmedAt);
    setBooking((prev) =>
      prev && prev.delivery
        ? {
          ...prev,
          delivery: { ...prev.delivery, confirmedEarlyAt: confirmedAt },
        }
        : prev
    );
  }, []);

  if (isMobile === null || (!booking && !loadError)) {
    return <BookingTrackerSkeleton />;
  }

  if (loadError) {
    return <BookingTrackerError onBackAction={handleClose} />;
  }

  if (!booking) {
    return <BookingTrackerSkeleton />;
  }

  if (booking.status === "DELIVERED") {
    const isConfirmed =
      earlyConfirmedAt !== null || !!booking.delivery?.confirmedEarlyAt;
    return isMobile ? (
      <BookingDeliveredMobile
        booking={booking}
        isConfirmed={isConfirmed}
        onCloseAction={handleClose}
        onConfirmedAction={handleEarlyConfirmed}
      />
    ) : (
      <BookingDeliveredDesktop
        booking={booking}
        isConfirmed={isConfirmed}
        onCloseAction={handleClose}
        onConfirmedAction={handleEarlyConfirmed}
      />
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

  // Statuts futurs (IN_TRANSIT, DELIVERED, VERIFIED, etc.) — fallback ACCEPTED
  // eslint-disable-next-line no-console
  console.info(
    "[booking] Status",
    booking.status,
    "— view not yet implemented, fallback to ACCEPTED view"
  );
  return isMobile ? (
    <BookingAcceptedMobile booking={booking} onCloseAction={handleClose} />
  ) : (
    <BookingAcceptedDesktop booking={booking} onCloseAction={handleClose} />
  );
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
