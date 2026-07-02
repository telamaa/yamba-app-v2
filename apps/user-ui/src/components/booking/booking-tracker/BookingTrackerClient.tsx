/**
 * BookingTrackerClient.tsx
 * ========================
 * Orchestrateur principal du module BookingTracker côté Expéditeur.
 * Charge le Booking puis switch sur le statut pour rendre la bonne view :
 *   ACCEPTED  → BookingAcceptedDesktop/Mobile
 *   (futurs)  → PICKED_UP, IN_TRANSIT, DELIVERED, VERIFIED, etc.
 *
 * L'URL reste stable : /bookings/[bookingId]
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

  if (isMobile === null || (!booking && !loadError)) {
    return <BookingTrackerSkeleton />;
  }

  if (loadError) {
    return <BookingTrackerError onBackAction={handleClose} />;
  }

  if (!booking) {
    return <BookingTrackerSkeleton />;
  }

  // Statut ACCEPTED → vues post-confirmation paiement
  if (booking.status === "ACCEPTED") {
    return isMobile ? (
      <BookingAcceptedMobile booking={booking} onCloseAction={handleClose} />
    ) : (
      <BookingAcceptedDesktop booking={booking} onCloseAction={handleClose} />
    );
  }

  // Statuts futurs (PICKED_UP, IN_TRANSIT, DELIVERED, VERIFIED, etc.)
  // À implémenter dans les prochaines PRs
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
