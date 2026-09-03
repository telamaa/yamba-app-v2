/**
 * BookingPickedUpDesktop.tsx
 * ==========================
 * Vue desktop PICKED_UP : le code est révélé.
 * Header + banner emerald + stepper (étape 3) + code card + partage +
 * photos pickup + tip · sidebar : suivi + Voyageur.
 */

"use client";

import DisputeInTransitLink from "../../shared/DisputeInTransitLink";

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

export default function BookingPickedUpDesktop({
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
    { id: "verification", label: t("timeline.steps.verification") },
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        <BookingAcceptedHeader
          booking={booking}
          onBackAction={onCloseAction}
          variant="desktop"
        />

        <div className="my-5">
          <BookingPickedUpBanner booking={booking} variant="inset" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main */}
          <div className="space-y-5">
            <header>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                {t("pickedUp.h1")}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("pickedUp.h1Subtitle", { recipientFirstName, carrierFirstName })}
              </p>
            </header>

            <DealStepper
              steps={steps}
              currentStep={3}
              title={t("timeline.title")}
            />

            <BookingCodeCard
              booking={booking}
              onCodeRegeneratedAction={onCodeRegeneratedAction}
            />

            <BookingShareCode booking={booking} />

            <BookingPickupPhotos booking={booking} />

            <BookingTipList
              title={t("pickedUp.nextSteps.title")}
              items={tipItems}
            />

            {/* B4-PR2 (A72) : « non livré » — 48 h après le départ. */}
            <DisputeInTransitLink booking={booking} />
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-[88px] space-y-4">
              <BookingTrackingSidebar booking={booking} />
              <BookingCarrierCard booking={booking} compact />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
