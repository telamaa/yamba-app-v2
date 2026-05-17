/**
 * DealRequestMobile.tsx
 * =====================
 * Wrapper mobile : layout 1 colonne avec bottom-bar sticky.
 * Le banner d'expiration est dans le scrollable content pour hériter
 * du même padding latéral que les autres cards (alignement visuel).
 */

"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { acceptDeal, declineDeal } from "./deal-request.api";
import type { DealRequest, DeclineReason } from "./deal-request.types";
import DealAcceptTip from "./DealAcceptTip";
import DealActionsFooter from "./DealActionsFooter";
import DealCarrierCharter from "./DealCarrierCharter";
import DealCoverageCard from "./DealCoverageCard";
import DealDeclineSheet from "./DealDeclineSheet";
import DealEarningsBreakdown from "./DealEarningsBreakdown";
import DealEarningsHero from "./DealEarningsHero";
import DealExpiryBanner from "./DealExpiryBanner";
import DealLocationsBlock from "./DealLocationsBlock";
import DealParcelDetails from "./DealParcelDetails";
import DealParcelPhotos from "./DealParcelPhotos";
import DealRequestHeader from "./DealRequestHeader";
import DealShipperCard from "./DealShipperCard";

type Props = {
  deal: DealRequest;
  onCloseAction: () => void;
};

export default function DealRequestMobile({ deal, onCloseAction }: Props) {
  const t = useTranslations("carrierDealRequest");

  const [charterAccepted, setCharterAccepted] = useState(false);
  const [charterError, setCharterError] = useState(false);
  const [isSubmittingAccept, setIsSubmittingAccept] = useState(false);
  const [isSubmittingDecline, setIsSubmittingDecline] = useState(false);
  const [declineSheetOpen, setDeclineSheetOpen] = useState(false);

  const handleAccept = async () => {
    if (!charterAccepted) {
      setCharterError(true);
      document
        .getElementById("carrier-charter-block-mobile")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setIsSubmittingAccept(true);
    try {
      const result = await acceptDeal(deal.id, { charterAccepted: true });
      toast.success(t("accept.toastSuccess"), { duration: 4500 });
      // eslint-disable-next-line no-console
      console.info("[deal-request] accepted, deliveryCode:", result.deliveryCode);
      onCloseAction();
    } catch {
      toast.error(t("accept.toastError"));
    } finally {
      setIsSubmittingAccept(false);
    }
  };

  const handleDeclineConfirm = async (payload: {
    reason?: DeclineReason;
    details?: string;
  }) => {
    setIsSubmittingDecline(true);
    try {
      await declineDeal(deal.id, payload);
      toast.success(
        t("decline.toastSuccess", { shipperFirstName: deal.shipper.firstName }),
        { duration: 4500 }
      );
      setDeclineSheetOpen(false);
      onCloseAction();
    } catch {
      toast.error(t("decline.toastError"));
    } finally {
      setIsSubmittingDecline(false);
    }
  };

  const isSubmitting = isSubmittingAccept || isSubmittingDecline;

  return (
    <>
      <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
        <DealRequestHeader
          receivedAtIso={deal.createdAt}
          onBackAction={onCloseAction}
        />

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-4">
          {/* Banner d'expiration intégré dans le content (hérite du px-4) */}
          <DealExpiryBanner expiresAtIso={deal.expiresAt} variant="banner" />

          <DealEarningsHero
            netForCarrier={deal.earnings.netForCarrier}
            payoutDelayDays={deal.earnings.payoutDelayDays}
          />

          <DealShipperCard
            shipper={deal.shipper}
            onViewProfileAction={() =>
              console.info("[deal-request] view shipper profile")
            }
          />

          <DealParcelDetails
            category={deal.parcel.category}
            weightKg={deal.parcel.weightKg}
            declaredValueEur={deal.parcel.declaredValueEur}
            description={deal.parcel.description}
          />

          <DealParcelPhotos
            photos={deal.parcel.photos}
            shipperFirstName={deal.shipper.firstName}
          />

          <DealLocationsBlock
            pickup={deal.pickupLocation}
            delivery={deal.deliveryLocation}
          />

          <DealEarningsBreakdown earnings={deal.earnings} variant="mobile" />

          <DealCoverageCard
            insurance={deal.insurance}
            shipperFirstName={deal.shipper.firstName}
            variant="inline"
          />

          <DealAcceptTip
            shipperFirstName={deal.shipper.firstName}
            compact
          />

          <div id="carrier-charter-block-mobile">
            <DealCarrierCharter
              accepted={charterAccepted}
              onChangeAction={(checked) => {
                setCharterAccepted(checked);
                if (checked) setCharterError(false);
              }}
              hasError={charterError}
              errorMessage={t("charter.acceptError")}
            />
          </div>
        </div>

        <DealActionsFooter
          shipperFirstName={deal.shipper.firstName}
          charterAccepted={charterAccepted}
          onDeclineAction={() => setDeclineSheetOpen(true)}
          onAcceptAction={handleAccept}
          isSubmitting={isSubmitting}
          variant="mobile"
        />
      </div>

      <DealDeclineSheet
        isOpen={declineSheetOpen}
        shipperFirstName={deal.shipper.firstName}
        isSubmitting={isSubmittingDecline}
        onCloseAction={() => !isSubmittingDecline && setDeclineSheetOpen(false)}
        onConfirmAction={handleDeclineConfirm}
      />
    </>
  );
}
