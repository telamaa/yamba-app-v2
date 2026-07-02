/**
 * DealAcceptedDesktop.tsx
 * =======================
 * Vue desktop pour un Deal en statut ACCEPTED.
 * Layout 2 cols : contenu principal + sidebar sticky (Ton paiement + Ton voyage).
 *
 * Header avec back discret + H1 "Mon Deal accepté" + sous-titre dynamique
 * (= confirmation contextuelle "où je suis").
 * H2 dans le body : "Et maintenant ?" (= call to action "que faire").
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import type { DealRequest } from "@/components/carrier/deal/deal.types";
import DealNextStepsTip from "@/components/carrier/deal/shared/DealNextStepsTip";
import DealStepper, {
  type StepperStep,
} from "@/components/carrier/deal/shared/DealStepper";
import DealAcceptedBanner from "./DealAcceptedBanner";
import DealAcceptedHeader from "./DealAcceptedHeader";
import DealAcceptedRecap from "./DealAcceptedRecap";
import DealContactShipperCard from "./DealContactShipperCard";
import DealPaymentBlock from "./DealPaymentBlock";
import DealTripSidebar from "./DealTripSidebar";

type Props = {
  deal: DealRequest;
  onCloseAction: () => void;
};

export default function DealAcceptedDesktop({ deal, onCloseAction }: Props) {
  const t = useTranslations("carrierDealAccepted");
  const locale = useLocale();

  const currentStep = 2;

  const steps: StepperStep[] = [
    { id: "accepted", label: t("timeline.steps.accepted") },
    { id: "pickup", label: t("timeline.steps.pickup") },
    { id: "transport", label: t("timeline.steps.transport") },
    { id: "delivery", label: t("timeline.steps.delivery") },
    { id: "payout", label: t("timeline.steps.payout") },
  ];

  const recipientFirstName =
    deal.deliveryLocation.name.split(" ")[0] || deal.deliveryLocation.name;

  const netAmount = formatAmount(deal.earnings.netForCarrier, locale);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6">
        <DealAcceptedHeader
          deal={deal}
          onBackAction={onCloseAction}
          variant="desktop"
        />

        <div className="my-5">
          <DealAcceptedBanner
            shipperFirstName={deal.shipper.firstName}
            variant="inset"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main column */}
          <div className="space-y-5">
            <header>
              <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                {t("h1")}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("h1Subtitle")}
              </p>
            </header>

            <DealStepper
              steps={steps}
              currentStep={currentStep}
              title={t("timeline.title")}
            />

            <DealContactShipperCard deal={deal} />

            <DealAcceptedRecap deal={deal} />

            <DealNextStepsTip
              shipperFirstName={deal.shipper.firstName}
              recipientFirstName={recipientFirstName}
              netAmount={netAmount}
              payoutDelayDays={deal.earnings.payoutDelayDays}
            />
          </div>

          {/* Sidebar sticky */}
          <aside className="hidden lg:block">
            <div className="sticky top-[88px] space-y-4">
              <DealPaymentBlock
                netForCarrier={deal.earnings.netForCarrier}
                payoutDelayDays={deal.earnings.payoutDelayDays}
                variant="sidebar"
              />

              <DealTripSidebar deal={deal} />

              <div className="text-center">
                <button
                  type="button"
                  className="text-[12px] font-semibold text-[#185FA5] hover:text-[#0C447C] dark:text-blue-400 dark:hover:text-blue-300"
                  onClick={() => console.info("[deal] open dashboard")}
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

function formatAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
