/**
 * BookingInTransitDesktop.tsx
 * ===========================
 * Écran 6 desktop — suivi du voyage côté Expéditrice (LECTURE) :
 * header + banner teal dynamique · gauche = code compact + timeline +
 * communication + signaler · sidebar = colis + paiement + couverture.
 */

"use client";

import DisputeInTransitLink from "../../shared/DisputeInTransitLink";

import { useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";
import BookingAcceptedHeader from "../accepted/BookingAcceptedHeader";
import {
  SenderCarrierContact,
  SenderRecipientContact,
} from "./SenderCommunicationCards";
import SenderCodeCard from "./SenderCodeCard";
import SenderTrackingBanner from "./SenderTrackingBanner";
import SenderTrackingTimeline from "./SenderTrackingTimeline";
import {
  SenderCoverageCard,
  SenderParcelCard,
  SenderPaymentCard,
} from "./SenderTrackingSideCards";

type Props = {
  booking: Booking;
  onCloseAction: () => void;
  onCodeRegeneratedAction: (newCode: string, regeneratedCount: number) => void;
};

export default function BookingInTransitDesktop({
                                                  booking,
                                                  onCloseAction,
                                                  onCodeRegeneratedAction,
                                                }: Props) {
  const t = useTranslations("bookingTracker");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        <BookingAcceptedHeader
          booking={booking}
          onBackAction={onCloseAction}
          variant="desktop"
        />

        <div className="my-5">
          <SenderTrackingBanner booking={booking} variant="inset" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main — lecture */}
          <div className="space-y-4">
            <SenderCodeCard
              booking={booking}
              onCodeRegeneratedAction={onCodeRegeneratedAction}
            />

            <SenderTrackingTimeline booking={booking} />

            <div>
              <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t("senderTracking.communication.label")}
              </h3>
              <div className="space-y-3">
                <SenderCarrierContact booking={booking} />
                <SenderRecipientContact booking={booking} />
              </div>
            </div>

            {/* B4-PR2 (A72) : « non livré » — actif 48 h après le départ, sinon désactivé avec la date servie. */}
            <DisputeInTransitLink booking={booking} />
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-[88px] space-y-4">
              <SenderParcelCard booking={booking} />
              <SenderPaymentCard booking={booking} />
              <SenderCoverageCard booking={booking} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
