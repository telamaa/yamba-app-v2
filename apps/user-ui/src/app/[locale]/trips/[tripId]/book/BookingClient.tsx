/**
 * BookingClient.tsx
 * =================
 * Client-side router between BookingWizard (desktop) and BookingMobile.
 */

"use client";

import { useCallback } from "react";
import BookingMobile from "@/components/booking/BookingMobile";
import { mockTrip } from "@/components/booking/booking.state";
import BookingWizard from "@/components/booking/BookingWizard";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useRouter } from "@/i18n/navigation";

type Props = {
  tripId: string;
};

export default function BookingClient({ tripId }: Props) {
  const isMobile = useIsMobile();
  const router = useRouter();

  // MVP: ignore tripId, use mock. Wire to trip-service when ready.
  const trip = mockTrip;

  const handleClose = useCallback(() => {
    router.push(`/trips/${tripId}`);
  }, [router, tripId]);

  if (isMobile === null) {
    return <BookingFallback />;
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
