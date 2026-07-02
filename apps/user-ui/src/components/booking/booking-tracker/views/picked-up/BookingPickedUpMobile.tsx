/**
 * BookingPickedUpMobile.tsx
 * =========================
 * Vue mobile PICKED_UP : header sticky 56px, banner flush, code card,
 * partage, photos, suivi inline, tip. Pas de bottom-bar (pas d'action urgente).
 */

"use client";

import { useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";
import DealStepper, {
  type StepperStep,
} from "@/components/carrier/deal/shared/DealStepper";
import BookingAcceptedHeader from "../accepted/BookingAcceptedHeader";
import BookingCarrierCard from "../accepted/BookingCarrierCard";
import BookingTipList from "../../shared/BookingTipList";
import BookingCodeCard from "./BookingCodeCard";
import BookingPickedUpBanner from "./BookingPickedUpBanner";
import BookingPickupPhotos from "./BookingPickupPhotos";
import BookingShareCode from "./BookingShareCode";
import BookingTrackingSidebar from "./BookingTrackingSidebar";

type Props = {
  booking: Booking;
  onCloseAction: () => void;
  onCodeRegeneratedAction: (newCode: string, regeneratedCount: number) => void;
};

export default function BookingPickedUpMobile({
                                                booking,
                                                onCloseAction,
                                                onCodeRegeneratedAction,
                                              }: Props) {
  const t = useTranslations("bookingTracker");

  const carrierFirstName = booking.carrier.firstName;
  const recipientFirstName = booking.recipient.firstName;

  const steps: StepperStep[] = [
    { id: "accepted", label: t("timeline.steps.accepted") },
    { id: "pickup", label: t("timeline.steps.pickup") },
    { id: "transport", label: t("timeline.steps.transport") },
    { id: "delivery", label: t("timeline.steps.delivery") },
    { id: "verification", label: t("timeline.steps.verificationShort") },
  ];

  const tipItems = [
    t("pickedUp.nextSteps.items.transmit", { recipientFirstName }),
    t("pickedUp.nextSteps.items.travel", {
      carrierFirstName,
      originCity: booking.trip.originCity,
      destinationCity: booking.trip.destinationCity,
    }),
    t("pickedUp.nextSteps.items.arrival", { carrierFirstName, recipientFirstName }),
    t("pickedUp.nextSteps.items.verification"),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <BookingAcceptedHeader
        booking={booking}
        onBackAction={onCloseAction}
        variant="mobile"
      />

      <BookingPickedUpBanner booking={booking} variant="flush" />

      <div className="flex-1 space-y-4 px-4 pb-8 pt-4">
        <header>
          <h2 className="text-[19px] font-black tracking-tight text-slate-900 dark:text-white">
            {t("pickedUp.h1Short")}
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {t("pickedUp.h1SubtitleShort", { recipientFirstName })}
          </p>
        </header>

        <BookingCodeCard
          booking={booking}
          onCodeRegeneratedAction={onCodeRegeneratedAction}
          compact
        />

        <BookingShareCode booking={booking} compact />

        <DealStepper
          steps={steps}
          currentStep={3}
          title={t("timeline.titleShort")}
          compact
        />

        <BookingPickupPhotos booking={booking} compact />

        <BookingTrackingSidebar booking={booking} />

        <BookingCarrierCard booking={booking} compact />

        <BookingTipList title={t("pickedUp.nextSteps.title")} items={tipItems} />
      </div>
    </div>
  );
}
