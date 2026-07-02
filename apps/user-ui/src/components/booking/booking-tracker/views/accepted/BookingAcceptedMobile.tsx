/**
 * BookingAcceptedMobile.tsx
 * =========================
 * Vue mobile pour un Booking en statut ACCEPTED.
 * Layout 1 colonne sans bottom-bar (pas d'action urgente).
 *
 * Standards mobile natif :
 *  - Header sticky 56px iOS-like
 *  - Banner edge-to-edge sous le header
 *  - Body padding 16px latéral standard
 *  - Pas de safe-area inset bottom (pas de footer fixe)
 */

"use client";

import { useTranslations } from "next-intl";
import type { Booking } from "@/components/booking/booking-tracker/booking-tracker.types";
import DealStepper, {
  type StepperStep,
} from "@/components/carrier/deal/shared/DealStepper";
import BookingAcceptedBanner from "./BookingAcceptedBanner";
import BookingAcceptedHeader from "./BookingAcceptedHeader";
import BookingAcceptedRecap from "./BookingAcceptedRecap";
import BookingCarrierCard from "./BookingCarrierCard";
import BookingDeliveryCodeCard from "./BookingDeliveryCodeCard";
import BookingNextStepsTip from "./BookingNextStepsTip";
import BookingParcelChecklist from "./BookingParcelChecklist";
import BookingPaymentBlock from "./BookingPaymentBlock";

type Props = {
  booking: Booking;
  onCloseAction: () => void;
};

export default function BookingAcceptedMobile({ booking, onCloseAction }: Props) {
  const t = useTranslations("bookingTracker");

  // L'étape active sur ACCEPTED = step 2 (Pickup), step 1 (Accepté) est done
  const currentStep = 2;

  // Mobile : labels courts ("Vérif." au lieu de "Vérification")
  const steps: StepperStep[] = [
    { id: "accepted", label: t("timeline.steps.accepted") },
    { id: "pickup", label: t("timeline.steps.pickup") },
    { id: "transport", label: t("timeline.steps.transport") },
    { id: "delivery", label: t("timeline.steps.delivery") },
    { id: "verification", label: t("timeline.steps.verificationShort") },
  ];

  const carrierFirstName = booking.carrier.firstName;

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <BookingAcceptedHeader
        booking={booking}
        onBackAction={onCloseAction}
        variant="mobile"
      />

      <BookingAcceptedBanner booking={booking} variant="flush" />

      <div className="flex-1 space-y-4 px-4 pb-8 pt-4">
        <header>
          <h2 className="text-[19px] font-black tracking-tight text-slate-900 dark:text-white">
            {t("h1")}
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {t("h1SubtitleMobile", { carrierFirstName })}
          </p>
        </header>

        <DealStepper
          steps={steps}
          currentStep={currentStep}
          title={t("timeline.titleShort")}
          compact
        />

        <BookingDeliveryCodeCard booking={booking} compact />

        <BookingParcelChecklist booking={booking} compact />

        <BookingCarrierCard booking={booking} compact />

        <BookingAcceptedRecap booking={booking} compact />

        <BookingPaymentBlock booking={booking} variant="inline" />

        <BookingNextStepsTip booking={booking} compact />
      </div>
    </div>
  );
}
