/**
 * DealAcceptedMobile.tsx
 * ======================
 * Vue mobile pour un Deal en statut ACCEPTED.
 * Layout 1 colonne sans bottom-bar fixe (pas d'action urgente).
 *
 * Standards mobile natif :
 *  - Header sticky 56px iOS-like
 *  - Banner edge-to-edge sous le header
 *  - Body padding 16px latéral standard
 *  - Pas de safe-area inset bottom (pas de footer fixe)
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
import DealPickupCta from "@/components/carrier/deal/views/pickup/DealPickupCta";

type Props = {
  deal: DealRequest;
  onCloseAction: () => void;
};

export default function DealAcceptedMobile({ deal, onCloseAction }: Props) {
  const t = useTranslations("carrierDealAccepted");
  const locale = useLocale();

  // L'étape active sur ACCEPTED = step 2 (Pickup), step 1 (Accepté) est done
  const currentStep = 2;

  const steps: StepperStep[] = [
    { id: "accepted", label: t("timeline.steps.acceptedShort") },
    { id: "pickup", label: t("timeline.steps.pickupShort") },
    { id: "transport", label: t("timeline.steps.transport") },
    { id: "delivery", label: t("timeline.steps.delivery") },
    { id: "payout", label: t("timeline.steps.payout") },
  ];

  // TODO Phase backend: ajouter recipientFirstName comme champ explicite
  const recipientFirstName =
    deal.deliveryLocation.name.split(" ")[0] || deal.deliveryLocation.name;

  const netAmount = formatAmount(deal.earnings.netForCarrier, locale);

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      <DealAcceptedHeader
        deal={deal}
        onBackAction={onCloseAction}
        variant="mobile"
      />

      <DealAcceptedBanner
        shipperFirstName={deal.shipper.firstName}
        variant="flush"
      />

      <div className="flex-1 space-y-4 px-4 pb-8 pt-4">
        <header>
          <h2 className="text-[17px] font-semibold tracking-tight text-slate-900 dark:text-white">
            {t("h1")}
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {t("h1SubtitleMobile")}
          </p>
        </header>

        <DealStepper
          steps={steps}
          currentStep={currentStep}
          title={t("timeline.titleShort")}
          compact
        />

        <DealContactShipperCard deal={deal} compact />

        <DealPickupCta dealId={deal.id} shipperFirstName={deal.shipper.firstName} compact />

        <DealAcceptedRecap deal={deal} />

        <DealPaymentBlock
          netForCarrier={deal.earnings.netForCarrier}
          payoutDelayDays={deal.earnings.payoutDelayDays}
          variant="inline"
        />

        <DealNextStepsTip
          shipperFirstName={deal.shipper.firstName}
          recipientFirstName={recipientFirstName}
          netAmount={netAmount}
          payoutDelayDays={deal.earnings.payoutDelayDays}
        />
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
