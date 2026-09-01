/**
 * DealRequestMobile.tsx
 * =====================
 * Vue mobile pour un Deal en statut PENDING.
 * Layout 1 colonne avec bottom-bar sticky.
 */

"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { DealRequest, DeclineReason } from "@/components/carrier/deal/deal.types";
import { useDealRequestActions } from "./useDealRequestActions";
import DealLocationsBlock from "@/components/carrier/deal/shared/DealLocationsBlock";
import DealParcelDetails from "@/components/carrier/deal/shared/DealParcelDetails";
import DealParcelPhotos from "@/components/carrier/deal/shared/DealParcelPhotos";
import DealShipperCard from "@/components/carrier/deal/shared/DealShipperCard";
import DealAcceptTip from "./DealAcceptTip";
import DealActionsFooter from "./DealActionsFooter";
import DealCarrierCharter from "./DealCarrierCharter";
import DealCoverageCard from "./DealCoverageCard";
import DealDeclineSheet from "./DealDeclineSheet";
import DealEarningsBreakdown from "./DealEarningsBreakdown";
import DealEarningsHero from "./DealEarningsHero";
import DealExpiryBanner from "./DealExpiryBanner";
import DealRequestHeader from "./DealRequestHeader";

type Props = {
  deal: DealRequest;
  onCloseAction: () => void;
  onAcceptedAction: () => void;
};

export default function DealRequestMobile({
                                            deal,
                                            onCloseAction,
                                            onAcceptedAction,
                                          }: Props) {
  const t = useTranslations("carrierDealRequest");

  const [charterAccepted, setCharterAccepted] = useState(false);
  const [charterError, setCharterError] = useState(false);
  const [declineSheetOpen, setDeclineSheetOpen] = useState(false);

  const {
    submitAccept,
    submitDecline,
    isSubmitting,
    isSubmittingDecline,
  } = useDealRequestActions({ deal, onAcceptedAction, onCloseAction });

  // Miroir des allowedActions serveur (cf. DealRequestDesktop).
  const canRespond =
    !deal.allowedActions || deal.allowedActions.includes("accept");

  const handleAccept = async () => {
    if (!charterAccepted) {
      setCharterError(true);
      document
        .getElementById("carrier-charter-block-mobile")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    await submitAccept();
  };

  const handleDeclineConfirm = async (payload: { reason?: DeclineReason }) => {
    const ok = await submitDecline(payload);
    if (ok) setDeclineSheetOpen(false);
  };

  return (
    <>
      <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
        <DealRequestHeader
          receivedAtIso={deal.createdAt}
          onBackAction={onCloseAction}
        />

        <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-32 pt-4">
          <DealExpiryBanner expiresAtIso={deal.expiresAt} variant="banner" />

          <DealEarningsHero
            netForCarrier={deal.earnings.netForCarrier}
            payoutDelayDays={deal.earnings.payoutDelayDays}
          />

          <DealShipperCard
            shipper={deal.shipper}
            onViewProfileAction={() =>
              console.info("[deal] view shipper profile")
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

          <DealAcceptTip shipperFirstName={deal.shipper.firstName} compact />

          <div id="carrier-charter-block-mobile">
            <DealCarrierCharter
              accepted={charterAccepted}
              onChangeAction={(checked: boolean) => {
                setCharterAccepted(checked);
                if (checked) setCharterError(false);
              }}
              hasError={charterError}
              errorMessage={t("charter.acceptError")}
            />
          </div>
        </div>

        {canRespond && (
          <DealActionsFooter
            shipperFirstName={deal.shipper.firstName}
            charterAccepted={charterAccepted}
            onDeclineAction={() => setDeclineSheetOpen(true)}
            onAcceptAction={handleAccept}
            isSubmitting={isSubmitting}
            variant="mobile"
          />
        )}
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
