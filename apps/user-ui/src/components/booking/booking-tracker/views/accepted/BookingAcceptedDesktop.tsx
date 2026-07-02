/**
 * BookingAcceptedDesktop.tsx
 * ==========================
 * Vue desktop pour un Booking en statut ACCEPTED.
 * Layout 2 cols : contenu principal + sidebar sticky (Ton paiement + Ton trajet).
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
import BookingTripSidebar from "./BookingTripSidebar";

type Props = {
  booking: Booking;
  onCloseAction: () => void;
};

export default function BookingAcceptedDesktop({
                                                 booking,
                                                 onCloseAction,
                                               }: Props) {
  const t = useTranslations("bookingTracker");

  const currentStep = 2;

  const steps: StepperStep[] = [
    { id: "accepted", label: t("timeline.steps.accepted") },
    { id: "pickup", label: t("timeline.steps.pickup") },
    { id: "transport", label: t("timeline.steps.transport") },
    { id: "delivery", label: t("timeline.steps.delivery") },
    { id: "verification", label: t("timeline.steps.verification") },
  ];

  const carrierFirstName = booking.carrier.firstName;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        <BookingAcceptedHeader
          booking={booking}
          onBackAction={onCloseAction}
          variant="desktop"
        />

        <div className="my-5">
          <BookingAcceptedBanner booking={booking} variant="inset" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main column */}
          <div className="space-y-5">
            <header>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                {t("h1")}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("h1Subtitle", { carrierFirstName })}
              </p>
            </header>

            <DealStepper
              steps={steps}
              currentStep={currentStep}
              title={t("timeline.title")}
            />

            <BookingDeliveryCodeCard booking={booking} />

            <BookingParcelChecklist booking={booking} />

            <BookingCarrierCard booking={booking} />

            <BookingAcceptedRecap booking={booking} />

            <BookingNextStepsTip booking={booking} />
          </div>

          {/* Sidebar sticky */}
          <aside className="hidden lg:block">
            <div className="sticky top-[88px] space-y-4">
              <BookingPaymentBlock booking={booking} variant="sidebar" />

              <BookingTripSidebar booking={booking} />

              <div className="text-center">
                <button
                  type="button"
                  className="text-[12px] font-semibold text-[#185FA5] hover:text-[#0C447C] dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={() => console.info("[booking] open dashboard")}
                >
                  {t("dashboardLink")}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
